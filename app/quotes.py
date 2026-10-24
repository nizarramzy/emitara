import urllib.request
import json
import time
import concurrent.futures

SYMBOLS = [
    ("^JKSE", "IHSG"),
    ("BBCA.JK", "BBCA"),
    ("BBRI.JK", "BBRI"),
    ("BMRI.JK", "BMRI"),
    ("BBNI.JK", "BBNI"),
    ("TLKM.JK", "TLKM"),
    ("ASII.JK", "ASII"),
    ("BREN.JK", "BREN"),
    ("AMMN.JK", "AMMN"),
    ("BRIS.JK", "BRIS"),
    ("ADRO.JK", "ADRO"),
    ("PTBA.JK", "PTBA"),
    ("ANTM.JK", "ANTM"),
    ("GOTO.JK", "GOTO"),
    ("ICBP.JK", "ICBP"),
]

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

_cache = {
    "data": [],
    "last_fetched": 0
}

def _fetch_single(sym_tuple):
    sym, label = sym_tuple
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval=1d&range=1d"
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode())
            meta = data['chart']['result'][0]['meta']
            price = meta.get('regularMarketPrice', 0)
            prev_close = meta.get('chartPreviousClose') or price
            change = price - prev_close
            pct = (change / prev_close) * 100 if prev_close else 0
            
            # Format price
            if label == "IHSG":
                price_str = f"{price:,.2f}"
            else:
                price_str = f"{int(price):,}"
                
            return {
                "symbol": label,
                "price": price_str,
                "raw_price": price,
                "change": round(change, 2),
                "change_pct": f"{pct:+.2f}%",
                "is_up": change > 0,
                "is_down": change < 0
            }
    except Exception as e:
        return None

def get_live_market_quotes() -> list[dict]:
    now = time.time()
    # Cache for 45 seconds to stay fast and avoid rate limits
    if _cache["data"] and (now - _cache["last_fetched"]) < 45:
        return _cache["data"]
        
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(_fetch_single, SYMBOLS))
        
    valid_results = [r for r in results if r is not None]
    if valid_results:
        _cache["data"] = valid_results
        _cache["last_fetched"] = now
        return valid_results
        
    return _cache["data"]
