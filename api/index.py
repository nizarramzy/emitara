import sys
import os

root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from app.main import app
from fastapi import Request

@app.middleware("http")
async def log_requests(request: Request, call_next):
    # Print path for Vercel logs
    print(f"[Vercel Request] Path: {request.url.path} | Query: {request.url.query}")
    response = await call_next(request)
    return response

# Also add explicit routes directly on app in index.py for debugging
@app.get("/api/debug-paths")
@app.get("/debug-paths")
async def debug_paths(request: Request):
    return {
        "url_path": request.url.path,
        "scope_path": request.scope.get("path"),
        "raw_path": request.scope.get("raw_path", b"").decode(),
        "routes": [r.path for r in app.routes]
    }


from app.main import render_article_ssr

@app.get("/berita/{article_id}")
@app.get("/warta/{article_id}")
@app.get("/api/berita/{article_id}")
@app.get("/api/warta/{article_id}")
async def index_render_ssr(article_id: int):
    return await render_article_ssr(article_id)


@app.get("/api/debug-turso-recent")
async def debug_turso_recent():
    import traceback
    from app.database import is_turso_active, turso_execute
    try:
        query = "SELECT id, title, published_at FROM articles ORDER BY published_at DESC, id DESC LIMIT 5 OFFSET 0"
        res = turso_execute(query, [])
        return {
            "turso_active": is_turso_active(),
            "count": len(res.get("rows", [])),
            "rows": res.get("rows", [])
        }
    except Exception as e:
        return {"error": str(e), "traceback": traceback.format_exc()}
