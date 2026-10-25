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


@app.get("/api/debug-query")
@app.get("/debug-query")
async def debug_query(request: Request):
    return {
        "query_params": dict(request.query_params),
        "url": str(request.url),
        "raw_query": request.scope.get("query_string", b"").decode()
    }
