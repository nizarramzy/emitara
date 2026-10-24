from app.quotes import get_live_market_quotes
import asyncio
import json
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Query, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db, get_recent_articles, get_total_articles_count, get_trending_tickers, get_article_by_id, save_article
from app.worker import worker_loop, poll_all_sources, fetch_full_content_sync

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
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
async def root():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

@app.get("/api/news")
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

@app.get("/api/news/stream")
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

@app.get("/api/news/{article_id}")
async def get_single_news(article_id: int):
    article = get_article_by_id(article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
        
    # If content_text is missing or shorter than 100 chars, scrape on-demand
    if not article.get("content_text") or len(article.get("content_text", "")) < 80:
        loop = asyncio.get_event_loop()
        full_text, author, og_img = await loop.run_in_executor(None, fetch_full_content_sync, article["url"])
        if full_text:
            article["content_text"] = full_text
            article["author"] = author or article.get("author", "Redaksi")
            if og_img and not article.get("image_url"):
                article["image_url"] = og_img
            # Persist back to database
            save_article(article)
            
    return {"status": "ok", "data": article}


@app.get("/api/market/ticker")
async def get_market_ticker():
    quotes = get_live_market_quotes()
    return {"status": "ok", "count": len(quotes), "data": quotes}

@app.get("/api/trending")
async def get_trending(limit: int = Query(8, ge=1, le=20)):
    trending = get_trending_tickers(limit=limit)
    return {"status": "ok", "data": trending}


@app.get("/api/cron/poll")
async def cron_poll():
    new_count = await poll_all_sources(broadcast_article, enrich_content=True)
    return {"status": "ok", "new_articles": new_count}

@app.post("/api/refresh")
async def trigger_refresh():
    new_count = await poll_all_sources(broadcast_article, enrich_content=True)
    return {"status": "ok", "new_articles": new_count}


