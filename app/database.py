import sqlite3
import os
import json
from datetime import datetime

import shutil

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BUNDLED_DB = os.path.join(BASE_DIR, "..", "data", "emitara.db")

import tempfile

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

def init_db():
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
        
        # In case table existed without author or content_text, add columns
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
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            tickers_str = json.dumps(article_data.get("tickers", []))
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
                datetime.utcnow().isoformat()
            ))
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            # If already exists but lacks content_text, update it
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

def get_total_articles_count() -> int:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM articles")
        return cursor.fetchone()[0]

def get_recent_articles(limit: int = 50, offset: int = 0, ticker: str = None, sentiment: str = None, category: str = None) -> list[dict]:
    with get_db() as conn:
        cursor = conn.cursor()
        query = "SELECT id, guid_hash, source, author, title, summary, url, image_url, published_at, sentiment, sentiment_score, tickers, created_at FROM articles WHERE 1=1"
        params = []
        
        if ticker:
            query += " AND tickers LIKE ?"
            params.append(f'%"{ticker.upper()}"%')
            
        if sentiment:
            query += " AND sentiment = ?"
            params.append(sentiment.upper())
            
        if category and category != 'ALL':
            query += " AND (title LIKE ? OR summary LIKE ?)"
            params.append(f"%{category}%")
            params.append(f"%{category}%")
            
        query += " ORDER BY id DESC LIMIT ? OFFSET ?"
        params.append(limit)
        params.append(offset)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        articles = []
        for r in rows:
            d = dict(r)
            try:
                d["tickers"] = json.loads(d["tickers"])
            except Exception:
                d["tickers"] = []
            articles.append(d)
        return articles

def get_article_by_id(article_id: int) -> dict:
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
            
        # Also find related articles by ticker
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
        return d

def get_trending_tickers(limit: int = 8) -> list[dict]:
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
