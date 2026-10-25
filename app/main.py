import asyncio
import json
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Query, HTTPException, APIRouter
from fastapi.responses import StreamingResponse, FileResponse, HTMLResponse
import html
import urllib.parse
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

_last_poll_timestamp = 0

async def maybe_auto_poll():
    global _last_poll_timestamp
    now = time.time()
    if now - _last_poll_timestamp > 120:  # 2 minutes cooldown
        _last_poll_timestamp = now
        try:
            await poll_all_sources(broadcast_article, enrich_content=False)
        except Exception as e:
            print("[Auto-Poll Error]", e)

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
    category: str = Query(None),
    q: str = Query(None)
):
    if offset == 0 and not ticker and not sentiment and not category and not q:
        asyncio.create_task(maybe_auto_poll())

    articles = get_recent_articles(limit=limit, offset=offset, ticker=ticker, sentiment=sentiment, category=category, q=q)
    total = get_total_articles_count(ticker=ticker, sentiment=sentiment, category=category, q=q)
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
    new_count = await poll_all_sources(broadcast_article, enrich_content=False)
    return {"status": "ok", "new_articles": new_count}

@api_router.post("/refresh")
async def trigger_refresh():
    new_count = await poll_all_sources(broadcast_article, enrich_content=False)
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

@app.get("/berita/{article_id}", response_class=HTMLResponse)
@app.get("/warta/{article_id}", response_class=HTMLResponse)
@api_router.get("/berita/{article_id}", response_class=HTMLResponse)
@api_router.get("/warta/{article_id}", response_class=HTMLResponse)
async def render_article_ssr(article_id: int):
    article = get_article_by_id(article_id)
    if not article:
        return HTMLResponse(
            status_code=404,
            content="""<!DOCTYPE html><html><head><title>Warta Tidak Ditemukan - Emitara</title></head><body style="font-family: sans-serif; text-align: center; padding: 50px;"><h2>Warta tidak ditemukan atau sudah diarsipkan.</h2><p><a href="/">Kembali ke Portal Emitara</a></p></body></html>"""
        )

    if not article.get("content_text") or len(article.get("content_text", "")) < 80:
        loop = asyncio.get_event_loop()
        full_text, author, og_img = await loop.run_in_executor(None, fetch_full_content_sync, article["url"])
        if full_text:
            article["content_text"] = full_text
            article["author"] = author or article.get("author", "Redaksi")
            if og_img and not article.get("image_url"):
                article["image_url"] = og_img
            save_article(article)

    esc_title = html.escape(article.get("title") or "Warta Pasar Modal")
    esc_summary = html.escape(article.get("summary") or "")
    esc_author = html.escape(article.get("author") or "Tim Redaksi")
    esc_source = html.escape(article.get("source") or "Emitara")
    canonical_url = f"https://emitara.web.id/berita/{article_id}"
    img_url = article.get("image_url") or "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80"

    paragraphs = []
    if article.get("content_text"):
        paragraphs = [p.strip() for p in article["content_text"].split("\n\n") if p.strip()]
    elif article.get("summary"):
        paragraphs = [article["summary"]]

    paragraphs_html = "".join([f"<p style='font-size: 16.5px; line-height: 1.75; margin-bottom: 20px; color: #2D3748;'>{html.escape(p)}</p>" for p in paragraphs])

    tickers = article.get("tickers") or []
    tickers_html = ""
    chart_html = ""
    if tickers:
        t_badges = "".join([f"<span style='font-family: monospace; font-size: 11px; font-weight: 700; padding: 3px 8px; background: #F1F5F9; border-radius: 4px; margin-right: 6px; color: #0F172A;'>{html.escape(t)}</span>" for t in tickers])
        tickers_html = f"<div style='margin-bottom: 20px; font-size: 12.5px;'><strong>Emiten Terkait:</strong> {t_badges}</div>"
        primary_ticker = tickers[0]
        chart_html = f"""
        <div style="margin: 22px 0 26px 0; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; background: #FAFBFD;">
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748B; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-block; width: 6px; height: 6px; background: #16A34A; border-radius: 50%;"></span>
            Radar Saham BEI: IDX:{html.escape(primary_ticker)}
          </div>
          <div style="height: 220px; width: 100%;">
            <div class="tradingview-widget-container" style="height: 100%; width: 100%;">
              <div class="tradingview-widget-container__widget" style="height: calc(100% - 32px); width: 100%;"></div>
              <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js" async>
              {{
                "symbol": "IDX:{html.escape(primary_ticker)}",
                "width": "100%",
                "height": "220",
                "locale": "id",
                "dateRange": "1M",
                "colorTheme": "light",
                "isTransparent": true,
                "autosize": false,
                "largeChartUrl": ""
              }}
              </script>
            </div>
          </div>
        </div>
        """

    share_text = urllib.parse.quote(f"{article['title']} - {canonical_url}")
    wa_url = f"https://api.whatsapp.com/send?text={share_text}"
    x_url = f"https://twitter.com/intent/tweet?text={urllib.parse.quote(article['title'])}&url={urllib.parse.quote(canonical_url)}"

    html_content = f"""<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{esc_title} - Emitara Warta Pasar Modal</title>
  
  <meta name="title" content="{esc_title}">
  <meta name="description" content="{esc_summary[:200]}">
  
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Emitara Pasar Modal">
  <meta property="og:url" content="{canonical_url}">
  <meta property="og:title" content="{esc_title}">
  <meta property="og:description" content="{esc_summary[:200]}">
  <meta property="og:image" content="{img_url}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="{canonical_url}">
  <meta name="twitter:title" content="{esc_title}">
  <meta name="twitter:description" content="{esc_summary[:200]}">
  <meta name="twitter:image" content="{img_url}">
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,600;6..72,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  
  <style>
    body {{
      margin: 0;
      padding: 0;
      font-family: 'Plus Jakarta Sans', sans-serif;
      background-color: #FFFFFF;
      color: #111111;
      -webkit-font-smoothing: antialiased;
    }}
    .article-wrap {{
      max-width: 760px;
      margin: 0 auto;
      padding: 24px 20px 80px 20px;
    }}
    .top-bar {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 16px;
      margin-bottom: 24px;
      border-bottom: 1px solid #E5E7EB;
    }}
    .btn-back {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 700;
      color: #111111;
      text-decoration: none;
      padding: 8px 14px;
      border: 1px solid #E5E7EB;
      border-radius: 9999px;
      background: #FFFFFF;
      transition: all 0.2s;
    }}
    .btn-back:hover {{
      background: #F8FAFC;
      border-color: #CBD5E1;
    }}
    .article-headline {{
      font-family: Georgia, 'Newsreader', serif;
      font-size: 2.15rem;
      font-weight: 700;
      line-height: 1.25;
      letter-spacing: -0.015em;
      margin: 14px 0 16px 0;
      color: #0F172A;
    }}
    .meta-line {{
      font-size: 12px;
      color: #64748B;
      margin-bottom: 20px;
      padding-bottom: 14px;
      border-bottom: 1px solid #F1F5F9;
    }}
    .share-row {{
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 36px;
      padding-top: 20px;
      border-top: 1px solid #E5E7EB;
      flex-wrap: wrap;
    }}
    .btn-share {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12.5px;
      font-weight: 700;
      text-decoration: none;
      padding: 8px 14px;
      border-radius: 6px;
      transition: opacity 0.2s;
    }}
  </style>
</head>
<body>
  <div class="article-wrap">
    <div class="top-bar">
      <a href="/" class="btn-back">&larr; Buka Portal Emitara</a>
      <a href="/" style="font-family: Georgia, serif; font-size: 1.25rem; font-weight: 900; color: #111111; text-decoration: none; letter-spacing: -0.02em;">EMITARA</a>
    </div>
    
    <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #0284C7;">
      {esc_source} &bull; Warta Pasar Modal
    </div>
    
    <h1 class="article-headline">{esc_title}</h1>
    
    <div class="meta-line">
      Oleh: <strong style="color: #111111;">{esc_author}</strong> &bull; Terbit: {article.get('published_at', '')[:10]} &bull; <a href="{html.escape(article.get('url', ''))}" target="_blank" rel="noopener noreferrer" style="color: #64748B; text-decoration: underline;">Sumber Asli &nearr;</a>
    </div>

    {chart_html}

    <div style="margin-bottom: 24px; border-radius: 8px; overflow: hidden; border: 1px solid #E2E8F0;">
      <img src="{img_url}" alt="{esc_title}" style="width: 100%; max-height: 440px; object-fit: cover; display: block;" onerror="this.src='https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80'">
    </div>

    {tickers_html}

    <div style="margin-top: 24px;">
      {paragraphs_html}
    </div>

    <div class="share-row">
      <span style="font-size: 12px; font-weight: 700; color: #475569;">Bagikan Warta:</span>
      <a href="{wa_url}" target="_blank" rel="noopener" class="btn-share" style="background: #25D366; color: #FFFFFF;">
        WhatsApp
      </a>
      <a href="{x_url}" target="_blank" rel="noopener" class="btn-share" style="background: #000000; color: #FFFFFF;">
        X / Twitter
      </a>
      <button type="button" onclick="navigator.clipboard.writeText(window.location.href); alert('Tautan warta disalin!');" class="btn-share" style="background: #F1F5F9; color: #1E293B; border: 1px solid #CBD5E1; cursor: pointer;">
        Salin Tautan
      </button>
    </div>
  </div>
</body>
</html>"""
    return HTMLResponse(content=html_content)


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

    m_p_ssr = re.search(r'(?:berita|warta)(?:/|%2f)(\d+)', p, re.I)
    if m_p_ssr:
        return await render_article_ssr(int(m_p_ssr.group(1)))

    m = re.search(r'news(?:/|%2f)(\d+)', p, re.I)
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
        q = request.query_params.get("q")
        return await get_news(limit=limit, offset=offset, ticker=ticker, sentiment=sentiment, category=category, q=q)

    if "refresh" in p or "cron" in p or "poll" in p:
        return await cron_poll()

    # Resolve the real sub-path from query parameter __path__ or path or headers
    path_param = (request.query_params.get("__path__") or "").strip("/").lower()
    matched_path = (request.headers.get("x-matched-path", "") or request.headers.get("x-now-route-matches", "")).lower()
    full_url = str(request.url).lower()
    
    check_str = urllib.parse.unquote(f"{path_param} {p} {matched_path} {full_url}")

    # 1. Market ticker
    if "ticker" in check_str:
        return await get_market_ticker()

    # 2. Trending
    if "trending" in check_str:
        limit = int(request.query_params.get("limit", 8))
        return await get_trending(limit=limit)

    # 3. Single news detail: e.g. /news/123 or __path__=news/123
    m_ssr = re.search(r'(?:berita|warta)(?:/|%2f)(\d+)', check_str, re.I)
    if m_ssr:
        return await render_article_ssr(int(m_ssr.group(1)))

    m = re.search(r'news(?:/|%2f)(\d+)', check_str, re.I)
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
        q = request.query_params.get("q")
        return await get_news(limit=limit, offset=offset, ticker=ticker, sentiment=sentiment, category=category, q=q)

    # 6. Cron / Refresh
    if "refresh" in check_str or "cron" in check_str or "poll" in check_str:
        return await cron_poll()

    # 7. Health
    if "health" in check_str:
        return await health_check()

    return {
        "status": "ok",
        "message": "Emitara Dispatcher Live",
        "check_str": check_str,
        "m_ssr_found": bool(re.search(r'(?:berita|warta)', check_str, re.I)),
        "path": full_path,
        "url": str(request.url)
    }
