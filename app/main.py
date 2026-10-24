import asyncio
import json
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Query, HTTPException, APIRouter
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.database import (
    init_db,
    get_recent_articles,
    get_trending_tickers,
    get_article_by_id,
    save_article,
    get_total_articles_count
)
from app.worker import worker_loop, poll_all_sources, fetch_full_content_sync
from app.quotes import get_live_market_quotes

subscribers: set[asyncio.Queue] = set()

async def broadcast_article(article_dict: dict):
    if not subscribers:
        return
    payload = f"data: {json.dumps(article_dict)}\n\n"
    for queue in list(subscribers):
        try:
            await queue.put(payload)
        except Exception:
            subscribers.discard(queue)

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    worker_task = None
    if not os.environ.get("VERCEL"):
        worker_task = asyncio.create_task(worker_loop(broadcast_article, interval_seconds=40))
    yield
    if worker_task:
        worker_task.cancel()

app = FastAPI(title="Emitara API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static")
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
async def root():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"status": "ok", "message": "Emitara API Live"}

# Router to handle routes both with /api and without /api (to handle Vercel rewrites gracefully)
api_router = APIRouter()

@api_router.get("/health")
async def health_check():
    total = get_total_articles_count()
    return {
        "status": "ok",
        "total_articles": total,
        "environment": "vercel" if os.environ.get("VERCEL") else "local"
    }

@api_router.get("/news")
async def get_news(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    ticker: str = Query(None),
    sentiment: str = Query(None),
    category: str = Query(None)
):
    articles = get_recent_articles(limit=limit, offset=offset, ticker=ticker, sentiment=sentiment, category=category)
    total = get_total_articles_count()
    return {
        "status": "ok",
        "count": len(articles),
        "total_available": total,
        "offset": offset,
        "data": articles
    }

@api_router.get("/market/ticker")
async def get_market_ticker():
    quotes = get_live_market_quotes()
    return {"status": "ok", "count": len(quotes), "data": quotes}

@api_router.get("/trending")
async def get_trending(limit: int = Query(8, ge=1, le=20)):
    trending = get_trending_tickers(limit=limit)
    return {"status": "ok", "data": trending}

@api_router.get("/cron/poll")
async def cron_poll():
    new_count = await poll_all_sources(broadcast_article, enrich_content=True)
    return {"status": "ok", "new_articles": new_count}

@api_router.post("/refresh")
async def trigger_refresh():
    new_count = await poll_all_sources(broadcast_article, enrich_content=True)
    return {"status": "ok", "new_articles": new_count}

@api_router.get("/news/stream")
async def news_stream(request: Request):
    queue = asyncio.Queue()
    subscribers.add(queue)

    async def event_generator():
        try:
            yield ": connected\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=20.0)
                    yield data
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            subscribers.discard(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@api_router.get("/news/{article_id}")
async def get_single_news(article_id: int):
    article = get_article_by_id(article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    if not article.get("content_text") or len(article.get("content_text", "")) < 80:
        loop = asyncio.get_event_loop()
        full_text, author, og_img = await loop.run_in_executor(None, fetch_full_content_sync, article["url"])
        if full_text:
            article["content_text"] = full_text
            article["author"] = author or article.get("author", "Redaksi")
            if og_img and not article.get("image_url"):
                article["image_url"] = og_img
            save_article(article)

    return {"status": "ok", "data": article}

# Mount both with prefix /api and without prefix!
app.include_router(api_router, prefix="/api")
app.include_router(api_router)


# Universal fallback dispatcher to guarantee 100% path matching across all Vercel rewrites
import re

@app.api_route("/{full_path:path}", methods=["GET", "POST", "HEAD"])
async def universal_dispatcher(request: Request, full_path: str):
    p = full_path.strip("/").lower()

    if "ticker" in p:
        return await get_market_ticker()

    if "trending" in p:
        limit = int(request.query_params.get("limit", 8))
        return await get_trending(limit=limit)

    m = re.search(r'news/(\d+)', p)
    if m:
        article_id = int(m.group(1))
        return await get_single_news(article_id)

    if "stream" in p:
        return await news_stream(request)

    if "news" in p:
        limit = int(request.query_params.get("limit", 50))
        offset = int(request.query_params.get("offset", 0))
        ticker = request.query_params.get("ticker")
        sentiment = request.query_params.get("sentiment")
        category = request.query_params.get("category")
        return await get_news(limit=limit, offset=offset, ticker=ticker, sentiment=sentiment, category=category)

    if "refresh" in p or "cron" in p or "poll" in p:
        return await cron_poll()

    # Resolve the real sub-path from query parameter __path__ or path or headers
    path_param = (request.query_params.get("__path__") or "").strip("/").lower()
    matched_path = (request.headers.get("x-matched-path", "") or request.headers.get("x-now-route-matches", "")).lower()
    full_url = str(request.url).lower()
    
    check_str = f"{path_param} {p} {matched_path} {full_url}"

    # 1. Market ticker
    if "ticker" in check_str:
        return await get_market_ticker()

    # 2. Trending
    if "trending" in check_str:
        limit = int(request.query_params.get("limit", 8))
        return await get_trending(limit=limit)

    # 3. Single news detail: e.g. /news/123 or __path__=news/123
    m = re.search(r'news/(\d+)', check_str)
    if m:
        article_id = int(m.group(1))
        return await get_single_news(article_id)

    # 4. News stream (SSE)
    if "stream" in check_str:
        return await news_stream(request)

    # 5. News list: e.g. /news or __path__=news
    if "news" in check_str:
        limit = int(request.query_params.get("limit", 50))
        offset = int(request.query_params.get("offset", 0))
        ticker = request.query_params.get("ticker")
        sentiment = request.query_params.get("sentiment")
        category = request.query_params.get("category")
        return await get_news(limit=limit, offset=offset, ticker=ticker, sentiment=sentiment, category=category)

    # 6. Cron / Refresh
    if "refresh" in check_str or "cron" in check_str or "poll" in check_str:
        return await cron_poll()

    # 7. Health
    if "health" in check_str:
        return await health_check()

    return {
        "status": "ok",
        "message": "Emitara Dispatcher Live",
        "path": full_path,
        "matched_path": matched_path,
        "url": str(request.url),
        "headers": dict(request.headers)
    }
