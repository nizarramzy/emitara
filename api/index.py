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


@app.get("/api/debug-feeds")
@app.get("/debug-feeds")
async def debug_feeds():
    import urllib.request
    import time
    
    results = {}
    feeds = [
        ("CNBC", "https://www.cnbcindonesia.com/market/rss"),
        ("Detik", "https://finance.detik.com/rss"),
        ("Katadata", "https://katadata.co.id/rss/finansial"),
        ("Investor", "https://investor.id/rss/market")
    ]
    
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    
    for name, u in feeds:
        t0 = time.time()
        try:
            req = urllib.request.Request(u, headers=headers)
            with urllib.request.urlopen(req, timeout=3) as resp:
                d = resp.read(500)
                results[name] = {"status": resp.status, "time": round(time.time() - t0, 2), "sample": len(d)}
        except Exception as e:
            results[name] = {"error": str(e), "time": round(time.time() - t0, 2)}
            
    return results
