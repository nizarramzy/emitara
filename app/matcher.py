import re
import json
import os

class TickerMatcher:
    def __init__(self, master_file: str = None):
        if master_file is None:
            master_file = os.path.join(os.path.dirname(__file__), "..", "data", "emiten_master.json")
        
        with open(master_file, "r", encoding="utf-8") as f:
            self.emiten_list = json.load(f)
            
        self.ticker_set = set()
        self.ambiguous_set = set()
        self.alias_to_ticker = {}
        self.ticker_to_name = {}
        
        for item in self.emiten_list:
            t = item["ticker"]
            self.ticker_set.add(t)
            self.ticker_to_name[t] = item["name"]
            if item.get("is_ambiguous"):
                self.ambiguous_set.add(t)
            for alias in item.get("aliases", []):
                self.alias_to_ticker[alias.lower()] = t

        # Financial context keywords for disambiguating common words
        self.context_keywords = {
            "saham", "emiten", "ihsg", "dividen", "laba", "rugi", "rupiah",
            "bei", "idx", "rups", "investor", "bursa", "pasar modal",
            "kinerja", "akuisisi", "buyback", "suspensi", "rekomendasi",
            "target harga", "transaksi", "closing", "opening", "portofolio",
            "sekuritas", "ipo", "right issue", "obligasi", "pemegang saham"
        }

    def match(self, title: str, summary: str = "") -> list[dict]:
        text_full = f"{title} {summary}"
        text_lower = text_full.lower()
        
        found_tickers = set()
        
        # 1. Alias matching (e.g. 'Bank Central Asia', 'BCA', 'Bukalapak', 'Telkom')
        for alias, ticker in self.alias_to_ticker.items():
            pattern = r"\b" + re.escape(alias) + r"\b"
            if re.search(pattern, text_lower):
                found_tickers.add(ticker)

        # Check if financial context exists in text
        has_context = any(kw in text_lower for kw in self.context_keywords)
        
        # 2. Uppercase 4-letter token matching
        # Regex for uppercase 4 letters
        tokens = re.findall(r"\b[A-Z]{4}\b", text_full)
        for token in tokens:
            if token in self.ticker_set:
                if token in self.ambiguous_set:
                    # Require financial context or alias
                    if has_context:
                        found_tickers.add(token)
                else:
                    found_tickers.add(token)
                    
        result = []
        for t in sorted(found_tickers):
            result.append({
                "ticker": t,
                "name": self.ticker_to_name.get(t, "")
            })
        return result
