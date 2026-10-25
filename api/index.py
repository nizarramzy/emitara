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


@app.get("/api/debug-version")
@app.get("/debug-version")
async def debug_version():
    return {
        "version": "v_sort_fix_1",
        "turso_active": is_turso_active()
    }
