import asyncio
import hashlib
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser

from app.database import save_article
from app.matcher import TickerMatcher
from app.sentiment import FinancialSentimentAnalyzer

matcher = TickerMatcher()
sentiment_analyzer = FinancialSentimentAnalyzer()

FEED_SOURCES = [
    {
        "name": "CNBC Indonesia",
        "url": "https://www.cnbcindonesia.com/market/rss",
        "category": "Market & Saham"
    },
    {
        "name": "Detik Finance",
        "url": "https://finance.detik.com/rss",
        "category": "Bursa & Korporasi"
    },
    {
        "name": "Katadata Finansial",
        "url": "https://katadata.co.id/rss/finansial",
        "category": "Analisis Pasar"
    },
    {
        "name": "Investor Daily",
        "url": "https://investor.id/rss/market",
        "category": "Pasar Modal"
    }
]

class FullArticleParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paragraphs = []
        self.current_tag = None
        self.current_text = []
        self.in_script = False
        self.og_image = ""
        self.author = ""

    def handle_starttag(self, tag, attrs):
        self.current_tag = tag
        attr_dict = dict(attrs)
        
        if tag == 'meta':
            prop = attr_dict.get('property', '') or attr_dict.get('name', '')
            if prop in ('og:image', 'twitter:image') and not self.og_image:
                self.og_image = attr_dict.get('content', '')
            if prop in ('author', 'dable:author', 'og:author') and not self.author:
                self.author = attr_dict.get('content', '')

        if tag in ('script', 'style', 'nav', 'header', 'footer', 'aside'):
            self.in_script = True
        elif tag == 'p':
            self.current_text = []

    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'nav', 'header', 'footer', 'aside'):
            self.in_script = False
        elif tag == 'p':
            p_str = "".join(self.current_text).strip()
            # Clean unwanted boilerplates
            if (len(p_str) > 35 and 
                not p_str.startswith("ADVERTISEMENT") and 
                not "SCROLL TO RESUME" in p_str and
                not "SCROLL TO CONTINUE" in p_str and
                not "BACA JUGA" in p_str and
                not "Simak berita lainnya" in p_str and
                not "Dilarang mengutip" in p_str and
                not "Pilihan Editor" in p_str and
                not "Halaman Berikutnya" in p_str):
                self.paragraphs.append(p_str)
            self.current_text = []
        self.current_tag = None

    def handle_data(self, data):
        if not self.in_script and self.current_tag == 'p':
            self.current_text.append(data)

def clean_html(raw_html: str) -> str:
    if not raw_html:
        return ""
    clean_text = re.sub(r"<[^>]+>", " ", raw_html)
    clean_text = re.sub(r"\s+", " ", clean_text).strip()
    return clean_text

def extract_image_url(item_elem, raw_description: str) -> str:
    enclosure = item_elem.find("enclosure")
    if enclosure is not None and enclosure.get("url"):
        return enclosure.get("url")
    if raw_description:
        m = re.search(r'<img[^>]+src=["\'](https?://[^"\']+)["\']', raw_description)
        if m:
            return m.group(1)
    return ""

def fetch_full_content_sync(article_url: str) -> tuple[str, str, str]:
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    try:
        req = urllib.request.Request(article_url, headers=headers)
        with urllib.request.urlopen(req, timeout=6) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
        parser = FullArticleParser()
        parser.feed(html)
        full_text = "\n\n".join(parser.paragraphs)
        return full_text, parser.author or "Redaksi", parser.og_image or ""
    except Exception:
        return "", "Redaksi", ""

def parse_feed_content(xml_bytes: bytes, source_name: str) -> list[dict]:
    items = []
    try:
        root = ET.fromstring(xml_bytes)
    except Exception:
        return []

    for item in root.findall(".//item"):
        title_el = item.find("title")
        link_el = item.find("link")
        desc_el = item.find("description")
        pubdate_el = item.find("pubDate")
        guid_el = item.find("guid")

        title = (title_el.text or "").strip() if title_el is not None else ""
        link = (link_el.text or "").strip() if link_el is not None else ""
        raw_desc = (desc_el.text or "").strip() if desc_el is not None else ""
        pub_raw = (pubdate_el.text or "").strip() if pubdate_el is not None else ""
        guid = (guid_el.text or "").strip() if guid_el is not None else link

        if not title or not link:
            continue

        clean_summary = clean_html(raw_desc)
        img_url = extract_image_url(item, raw_desc)
        
        try:
            dt = parsedate_to_datetime(pub_raw)
            published_at = dt.isoformat()
        except Exception:
            published_at = datetime.utcnow().isoformat()

        canonical = guid if guid else link
        guid_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()

        items.append({
            "guid_hash": guid_hash,
            "source": source_name,
            "title": title,
            "summary": clean_summary,
            "url": link,
            "image_url": img_url,
            "published_at": published_at
        })
    return items

async def fetch_feed(source: dict) -> list[dict]:
    url = source["url"]
    name = source["name"]
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    
    loop = asyncio.get_event_loop()
    def _fetch():
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.read()
            
    try:
        content = await loop.run_in_executor(None, _fetch)
        return parse_feed_content(content, name)
    except Exception as e:
        print(f"[Worker] Error fetching {name}: {e}")
        return []

async def enrich_full_article(item: dict) -> dict:
    loop = asyncio.get_event_loop()
    full_text, author, og_img = await loop.run_in_executor(None, fetch_full_content_sync, item["url"])
    item["content_text"] = full_text or item.get("summary", "")
    item["author"] = author or "Redaksi"
    if og_img and not item.get("image_url"):
        item["image_url"] = og_img
    return item

async def poll_all_sources(broadcast_cb = None, enrich_content: bool = True) -> int:
    tasks = [fetch_feed(src) for src in FEED_SOURCES]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    all_raw_items = []
    for feed_items in results:
        if isinstance(feed_items, list):
            all_raw_items.extend(feed_items)
            
    # Process items
    new_count = 0
    for item in all_raw_items:
        # Match tickers
        matches = matcher.match(item["title"], item["summary"])
        tickers = [m["ticker"] for m in matches]
        item["tickers"] = tickers
        
        # Analyze financial sentiment
        sentiment_res = sentiment_analyzer.analyze(item["title"], item["summary"])
        item["sentiment"] = sentiment_res["label"]
        item["sentiment_score"] = sentiment_res["score"]
        
        # Enrich top 15 newest items with full content text asynchronously
        if enrich_content and new_count < 15:
            await enrich_full_article(item)
            
        inserted = save_article(item)
        if inserted:
            new_count += 1
            if broadcast_cb:
                await broadcast_cb(item)
                
    return new_count

async def worker_loop(broadcast_cb = None, interval_seconds: int = 40):
    print("[Worker] Background news ingestion worker started.")
    try:
        initial_new = await poll_all_sources(broadcast_cb, enrich_content=True)
        print(f"[Worker] Initial poll completed: {initial_new} new articles indexed.")
    except Exception as e:
        print(f"[Worker] Initial poll error: {e}")
        
    while True:
        await asyncio.sleep(interval_seconds)
        try:
            new_articles = await poll_all_sources(broadcast_cb, enrich_content=True)
            if new_articles > 0:
                print(f"[Worker] Ingested {new_articles} new realtime articles.")
        except Exception as e:
            print(f"[Worker] Loop error: {e}")
