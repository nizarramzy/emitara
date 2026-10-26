import re
import html
def sanitize_article_text(text: str, current_img: str = "") -> tuple[str, str]:
    if not text:
        return "", current_img
    new_img = current_img
    if not new_img:
        m_img = re.search(r'<img[^>]+src="([^"]+)"', text)
        if m_img:
            new_img = m_img.group(1)
    clean = re.sub(r'<[^>]+>', ' ', text)
    clean = html.unescape(clean)
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean, new_img

import sqlite3
import os
import json
from datetime import datetime
import shutil
import tempfile
import urllib.request
import base64

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BUNDLED_DB = os.path.join(BASE_DIR, "..", "data", "emitara.db")

# Turso Cloud Environment Variables
TURSO_DATABASE_URL = os.environ.get("TURSO_DATABASE_URL")
TURSO_AUTH_TOKEN = os.environ.get("TURSO_AUTH_TOKEN")

def sanitize_dict_article(d: dict) -> dict:
    if not d:
        return d
    if d.get("summary") and "<" in d["summary"]:
        clean_s, ext_img = sanitize_article_text(d["summary"], d.get("image_url", ""))
        d["summary"] = clean_s
        if ext_img and not d.get("image_url"):
            d["image_url"] = ext_img
    if d.get("content_text") and "<" in d["content_text"]:
        clean_c, ext_img = sanitize_article_text(d["content_text"], d.get("image_url", ""))
        d["content_text"] = clean_c
        if ext_img and not d.get("image_url"):
            d["image_url"] = ext_img
    if d.get("title") and "<" in d["title"]:
        clean_t, _ = sanitize_article_text(d["title"], "")
        d["title"] = clean_t
    return d

def is_turso_active() -> bool:
    return bool(TURSO_DATABASE_URL and TURSO_AUTH_TOKEN)

# Fallback Local / Serverless SQLite
if os.environ.get("VERCEL"):
    DB_PATH = os.path.join(tempfile.gettempdir(), "emitara.db")
    if not os.path.exists(DB_PATH) and os.path.exists(BUNDLED_DB):
        try:
            shutil.copyfile(BUNDLED_DB, DB_PATH)
        except Exception:
            DB_PATH = BUNDLED_DB
else:
    DB_PATH = BUNDLED_DB

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# ==========================================
# TURSO HTTP LIB SQL ENGINE
# ==========================================
def serialize_turso_arg(val):
    if val is None:
        return {"type": "null"}
    elif isinstance(val, bool):
        return {"type": "integer", "value": "1" if val else "0"}
    elif isinstance(val, int):
        return {"type": "integer", "value": str(val)}
    elif isinstance(val, float):
        return {"type": "float", "value": val}
    elif isinstance(val, (bytes, bytearray)):
        return {"type": "blob", "base64": base64.b64encode(val).decode()}
    else:
        return {"type": "text", "value": str(val)}

def parse_turso_value(val_obj):
    if not val_obj or val_obj.get("type") == "null":
        return None
    val = val_obj.get("value")
    t = val_obj.get("type")
    if t == "integer":
        try:
            return int(val)
        except Exception:
            return val
    elif t == "float":
        try:
            return float(val)
        except Exception:
            return val
    return val

def turso_execute(sql: str, params: list = None) -> dict:
    base_url = TURSO_DATABASE_URL.replace("libsql://", "https://").rstrip("/")
    pipeline_url = f"{base_url}/v2/pipeline" if not base_url.endswith("/v2/pipeline") else base_url

    args = [serialize_turso_arg(p) for p in (params or [])]
    payload = {
        "requests": [
            {
                "type": "execute",
                "stmt": {
                    "sql": sql,
                    "args": args,
                    "want_rows": True
                }
            },
            {"type": "close"}
        ]
    }
    
    req = urllib.request.Request(
        pipeline_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {TURSO_AUTH_TOKEN}",
            "Content-Type": "application/json",
            "User-Agent": "Emitara/1.0"
        }
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        results = res.get("results", [])
        if not results:
            return {"rows": [], "affected_row_count": 0}
        first = results[0]
        if first.get("type") == "error":
            raise Exception(f"Turso Error: {first.get('error', {}).get('message')}")
        result_data = first.get("response", {}).get("result", {})
        
        cols = [c["name"] for c in result_data.get("cols", [])]
        raw_rows = result_data.get("rows", [])
        
        rows = []
        for r in raw_rows:
            d = {}
            for i, c in enumerate(cols):
                d[c] = parse_turso_value(r[i])
            rows.append(d)
            
        return {
            "rows": rows,
            "affected_row_count": result_data.get("affected_row_count", 0),
            "last_insert_rowid": result_data.get("last_insert_rowid")
        }

def turso_batch(stmts: list[tuple[str, list]]) -> list[dict]:
    base_url = TURSO_DATABASE_URL.replace("libsql://", "https://").rstrip("/")
    pipeline_url = f"{base_url}/v2/pipeline" if not base_url.endswith("/v2/pipeline") else base_url
    
    requests = []
    for sql, params in stmts:
        args = [serialize_turso_arg(p) for p in (params or [])]
        requests.append({
            "type": "execute",
            "stmt": {
                "sql": sql,
                "args": args,
                "want_rows": False
            }
        })
    requests.append({"type": "close"})
    
    payload = {"requests": requests}
    req = urllib.request.Request(
        pipeline_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {TURSO_AUTH_TOKEN}",
            "Content-Type": "application/json",
            "User-Agent": "Emitara/1.0"
        }
    )
    with urllib.request.urlopen(req, timeout=25) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        return res.get("results", [])

# ==========================================
# UNIVERSAL DATABASE OPERATIONS
# ==========================================

def init_db():
    if is_turso_active():
        print("[DB] Initializing Turso Cloud Database...")
        turso_execute("""
        CREATE TABLE IF NOT EXISTS articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guid_hash TEXT UNIQUE NOT NULL,
            source TEXT NOT NULL,
            author TEXT DEFAULT 'Redaksi',
            title TEXT NOT NULL,
            summary TEXT,
            content_text TEXT,
            url TEXT NOT NULL,
            image_url TEXT,
            published_at TEXT NOT NULL,
            sentiment TEXT NOT NULL,
            sentiment_score REAL NOT NULL,
            tickers TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """)
        try:
            turso_execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_guid_hash ON articles(guid_hash);")
            turso_execute("CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);")
            turso_execute("CREATE INDEX IF NOT EXISTS idx_articles_sentiment ON articles(sentiment);")
        except Exception:
            pass
            
        # Check if Turso database needs synchronization from bundled database
        try:
            check_res = turso_execute("SELECT COUNT(*) as count FROM articles")
            turso_count = check_res["rows"][0]["count"] if check_res.get("rows") else 0
            if os.path.exists(BUNDLED_DB):
                with sqlite3.connect(BUNDLED_DB) as b_conn:
                    b_conn.row_factory = sqlite3.Row
                    b_cursor = b_conn.cursor()
                    b_cursor.execute("SELECT guid_hash, source, author, title, summary, content_text, url, image_url, published_at, sentiment, sentiment_score, tickers, created_at FROM articles ORDER BY id ASC")
                    all_bundled = b_cursor.fetchall()
                    
                    if len(all_bundled) > turso_count:
                        print(f"[DB] Syncing {len(all_bundled) - turso_count} newer articles from bundled archive to Turso Cloud...")
                        for i in range(0, len(all_bundled), 40):
                            chunk = all_bundled[i:i+40]
                            stmts = []
                            for row in chunk:
                                stmts.append((
                                    """INSERT OR IGNORE INTO articles (
                                        guid_hash, source, author, title, summary, content_text, url, image_url,
                                        published_at, sentiment, sentiment_score, tickers, created_at
                                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                                    list(row)
                                ))
                            turso_batch(stmts)
                        print(f"[DB] Successfully synced to Turso Cloud! (Total bundled: {len(all_bundled)})")
        except Exception as e:
            print("[DB] Error checking/seeding Turso:", e)
        return

    # Local SQLite Fallback
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guid_hash TEXT UNIQUE NOT NULL,
            source TEXT NOT NULL,
            author TEXT DEFAULT 'Redaksi',
            title TEXT NOT NULL,
            summary TEXT,
            content_text TEXT,
            url TEXT NOT NULL,
            image_url TEXT,
            published_at TEXT NOT NULL,
            sentiment TEXT NOT NULL,
            sentiment_score REAL NOT NULL,
            tickers TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """)
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_guid_hash ON articles(guid_hash);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_articles_sentiment ON articles(sentiment);")
        
        try:
            cursor.execute("ALTER TABLE articles ADD COLUMN author TEXT DEFAULT 'Redaksi'")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE articles ADD COLUMN content_text TEXT")
        except Exception:
            pass
            
        conn.commit()

def save_article(article_data: dict) -> bool:
    """Returns True if inserted, False if already exists (deduplicated)"""
    # Sanitize title, summary, content_text
    raw_img = article_data.get("image_url", "")
    clean_summary, raw_img = sanitize_article_text(article_data.get("summary", ""), raw_img)
    clean_content, raw_img = sanitize_article_text(article_data.get("content_text", ""), raw_img)
    clean_title, _ = sanitize_article_text(article_data.get("title", ""), "")
    
    article_data["summary"] = clean_summary
    article_data["content_text"] = clean_content
    article_data["title"] = clean_title
    if raw_img:
        article_data["image_url"] = raw_img

    tickers_str = json.dumps(article_data.get("tickers", []))
    created_at = datetime.utcnow().isoformat()
    
    if is_turso_active():
        try:
            insert_res = turso_execute("""
            INSERT OR IGNORE INTO articles (
                guid_hash, source, author, title, summary, content_text, url, image_url,
                published_at, sentiment, sentiment_score, tickers, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, [
                article_data["guid_hash"],
                article_data["source"],
                article_data.get("author", "Redaksi"),
                article_data["title"],
                article_data.get("summary", ""),
                article_data.get("content_text", ""),
                article_data["url"],
                article_data.get("image_url", ""),
                article_data["published_at"],
                article_data["sentiment"],
                article_data["sentiment_score"],
                tickers_str,
                created_at
            ])
            if insert_res.get("affected_row_count", 0) > 0:
                return True
        except Exception as e:
            print("[Turso Save Error]", e)
            
        # If exists, update content_text if available
        if article_data.get("content_text"):
            try:
                turso_execute("""
                UPDATE articles SET content_text = ?, author = ?, image_url = COALESCE(NULLIF(image_url, ''), ?)
                WHERE guid_hash = ? AND (content_text IS NULL OR content_text = '')
                """, [
                    article_data["content_text"],
                    article_data.get("author", "Redaksi"),
                    article_data.get("image_url", ""),
                    article_data["guid_hash"]
                ])
            except Exception:
                pass
        return False

    with get_db() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("""
            INSERT INTO articles (
                guid_hash, source, author, title, summary, content_text, url, image_url,
                published_at, sentiment, sentiment_score, tickers, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                article_data["guid_hash"],
                article_data["source"],
                article_data.get("author", "Redaksi"),
                article_data["title"],
                article_data.get("summary", ""),
                article_data.get("content_text", ""),
                article_data["url"],
                article_data.get("image_url", ""),
                article_data["published_at"],
                article_data["sentiment"],
                article_data["sentiment_score"],
                tickers_str,
                created_at
            ))
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            if article_data.get("content_text"):
                try:
                    cursor.execute("""
                    UPDATE articles SET content_text = ?, author = ?, image_url = COALESCE(NULLIF(image_url, ''), ?)
                    WHERE guid_hash = ? AND (content_text IS NULL OR content_text = '')
                    """, (
                        article_data["content_text"],
                        article_data.get("author", "Redaksi"),
                        article_data.get("image_url", ""),
                        article_data["guid_hash"]
                    ))
                    conn.commit()
                except Exception:
                    pass
            return False

def build_category_condition(category: str) -> tuple[str, list]:
    if not category or category == 'ALL':
        return "", []
    cat = category.lower()
    if cat == 'finansial':
        keywords = ['bank', 'saham', 'ihsg', 'bbca', 'bbri', 'bmri', 'bbni', 'laba', 'dividen', 'ojk', 'kredit', 'bursa', 'modal', 'dana', 'reksadana', 'sekuritas']
    elif cat == 'energi':
        keywords = ['energi', 'minyak', 'batu bara', 'gas', 'emas', 'nikel', 'ptba', 'adaro', 'antam', 'bren', 'esdm', 'tambang', 'pln', 'cuan', 'migas']
    elif cat == 'konsumer':
        keywords = ['konsumer', 'ritel', 'pangan', 'beras', 'makanan', 'minuman', 'indofood', 'unilever', 'belanja', 'harga', 'ekspor', 'petani', 'pasar']
    elif cat == 'teknologi':
        keywords = ['teknologi', 'digital', 'telkom', 'goto', 'ai', 'startup', 'aplikasi', 'data', 'software', 'internet', 'telko', 'gadget']
    elif cat == 'makro':
        keywords = ['ekonomi', 'pajak', 'inflasi', 'suku bunga', 'bi', 'apbn', 'fiskal', 'rupiah', 'gdp', 'pertumbuhan', 'pemerintah', 'prabowo', 'menteri']
    else:
        return " AND (title LIKE ? OR summary LIKE ?)", [f"%{category}%", f"%{category}%"]
        
    clauses = " OR ".join(["title LIKE ? OR summary LIKE ?" for _ in keywords])
    params = []
    for kw in keywords:
        params.extend([f"%{kw}%", f"%{kw}%"])
    return f" AND ({clauses})", params

def get_total_articles_count(ticker: str = None, sentiment: str = None, category: str = None, q: str = None) -> int:
    query = "SELECT COUNT(*) as count FROM articles WHERE 1=1"
    params = []
    
    if ticker:
        ticker_list = [t.strip().upper() for t in ticker.split(",") if t.strip()]
        if ticker_list:
            clause = " OR ".join(["tickers LIKE ?" for _ in ticker_list])
            query += f" AND ({clause})"
            params.extend([f'%"{t}"%' for t in ticker_list])
        
    if sentiment:
        query += " AND sentiment = ?"
        params.append(sentiment.upper())
        
    cat_sql, cat_params = build_category_condition(category)
    if cat_sql:
        query += cat_sql
        params.extend(cat_params)
        
    if q and q.strip():
        query += " AND (title LIKE ? OR summary LIKE ? OR tickers LIKE ?)"
        clean_q = q.strip()
        params.append(f"%{clean_q}%")
        params.append(f"%{clean_q}%")
        params.append(f"%{clean_q.upper()}%")
        
    if is_turso_active():
        try:
            res = turso_execute(query, params)
            if res.get("rows"):
                return int(res["rows"][0]["count"])
            return 0
        except Exception as e:
            print("[Turso Count Error]", e)
            
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        return cursor.fetchone()[0]

def get_recent_articles(limit: int = 50, offset: int = 0, ticker: str = None, sentiment: str = None, category: str = None, q: str = None) -> list[dict]:
    query = "SELECT id, guid_hash, source, author, title, summary, url, image_url, published_at, sentiment, sentiment_score, tickers, created_at FROM articles WHERE 1=1"
    params = []
    
    if ticker:
        ticker_list = [t.strip().upper() for t in ticker.split(",") if t.strip()]
        if ticker_list:
            clause = " OR ".join(["tickers LIKE ?" for _ in ticker_list])
            query += f" AND ({clause})"
            params.extend([f'%"{t}"%' for t in ticker_list])
        
    if sentiment:
        query += " AND sentiment = ?"
        params.append(sentiment.upper())
        
    cat_sql, cat_params = build_category_condition(category)
    if cat_sql:
        query += cat_sql
        params.extend(cat_params)
        
    if q and q.strip():
        query += " AND (title LIKE ? OR summary LIKE ? OR tickers LIKE ?)"
        clean_q = q.strip()
        params.append(f"%{clean_q}%")
        params.append(f"%{clean_q}%")
        params.append(f"%{clean_q.upper()}%")
        
    query += " ORDER BY published_at DESC, id DESC LIMIT ? OFFSET ?"
    params.append(limit)
    params.append(offset)
    
    if is_turso_active():
        try:
            res = turso_execute(query, params)
            articles = []
            for r in res.get("rows", []):
                d = dict(r)
                try:
                    d["tickers"] = json.loads(d["tickers"]) if isinstance(d["tickers"], str) else (d["tickers"] or [])
                except Exception:
                    d["tickers"] = []
                articles.append(sanitize_dict_article(d))
            return articles
        except Exception as e:
            print("[Turso Query Error]", e)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        articles = []
        for r in rows:
            d = dict(r)
            try:
                d["tickers"] = json.loads(d["tickers"])
            except Exception:
                d["tickers"] = []
            articles.append(sanitize_dict_article(d))
        return articles

def get_article_by_id(article_id: int) -> dict:
    if is_turso_active():
        try:
            res = turso_execute("SELECT * FROM articles WHERE id = ?", [article_id])
            if res.get("rows"):
                d = dict(res["rows"][0])
            try:
                d["tickers"] = json.loads(d["tickers"]) if isinstance(d["tickers"], str) else (d["tickers"] or [])
            except Exception:
                d["tickers"] = []
                
            related = []
            if d["tickers"]:
                first_ticker = d["tickers"][0]
                rel_res = turso_execute("""
                SELECT id, title, source, published_at, image_url, sentiment, tickers
                FROM articles WHERE tickers LIKE ? AND id != ?
                ORDER BY id DESC LIMIT 3
                """, [f'%"{first_ticker}"%', article_id])
                for rel_row in rel_res.get("rows", []):
                    rd = dict(rel_row)
                    try:
                        rd["tickers"] = json.loads(rd["tickers"]) if isinstance(rd["tickers"], str) else (rd["tickers"] or [])
                    except Exception:
                        rd["tickers"] = []
                    related.append(rd)
                d["related_articles"] = related
                return sanitize_dict_article(d)
        except Exception as e:
            print("[Turso Get By Id Error]", e)

    # Fallback to local database if not found in Turso
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM articles WHERE id = ?", (article_id,))
        row = cursor.fetchone()
        if not row:
            return None
        d = dict(row)
        try:
            d["tickers"] = json.loads(d["tickers"])
        except Exception:
            d["tickers"] = []
            
        related = []
        if d["tickers"]:
            first_ticker = d["tickers"][0]
            cursor.execute("""
            SELECT id, title, source, published_at, image_url, sentiment, tickers
            FROM articles WHERE tickers LIKE ? AND id != ?
            ORDER BY id DESC LIMIT 3
            """, (f'%"{first_ticker}"%', article_id))
            for rel_row in cursor.fetchall():
                rd = dict(rel_row)
                try:
                    rd["tickers"] = json.loads(rd["tickers"])
                except Exception:
                    rd["tickers"] = []
                related.append(rd)
                
        d["related_articles"] = related
        return sanitize_dict_article(d)

def get_trending_tickers(limit: int = 8) -> list[dict]:
    if is_turso_active():
        try:
            res = turso_execute("SELECT tickers FROM articles ORDER BY id DESC LIMIT 200")
            counts = {}
            for r in res.get("rows", []):
                try:
                    raw_t = r.get("tickers")
                    t_list = json.loads(raw_t) if isinstance(raw_t, str) else (raw_t or [])
                    for t in t_list:
                        counts[t] = counts.get(t, 0) + 1
                except Exception:
                    continue
            sorted_counts = sorted(counts.items(), key=lambda x: x[1], reverse=True)
            return [{"ticker": k, "count": v} for k, v in sorted_counts[:limit]]
        except Exception as e:
            print("[Turso Trending Error]", e)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT tickers FROM articles ORDER BY id DESC LIMIT 200")
        rows = cursor.fetchall()
        
        counts = {}
        for r in rows:
            try:
                t_list = json.loads(r["tickers"])
                for t in t_list:
                    counts[t] = counts.get(t, 0) + 1
            except Exception:
                continue
                
        sorted_counts = sorted(counts.items(), key=lambda x: x[1], reverse=True)
        return [{"ticker": k, "count": v} for k, v in sorted_counts[:limit]]
