import re

class FinancialSentimentAnalyzer:
    def __init__(self):
        self.bullish_keywords = [
            "laba naik", "laba bersih melonjak", "laba bersih naik", "dividen", "dividen jumbo",
            "akuisisi", "buyback", "rekor laba", "rekor pendapatan", "pertumbuhan pendapatan",
            "surplus", "kantongi kontrak", "merger", "kinerja moncer", "kinerja positif",
            "target naik", "akumulasi", "net buy", "rebound", "menguat", "melonjak", "terbang",
            "cuan", "ekspansi bisnis", "pendapatan naik", "dividen interim", "kinerja cemerlang",
            "melesat", "lampaui target", "prospek cerah", "rekomendasi beli"
        ]
        
        self.bearish_keywords = [
            "rugi bersih", "gagal bayar", "suspensi", "suspensi saham", "merosot", "anjlok",
            "pkpu", "kebangkrutan", "denda", "tertekan", "melemah", "net sell", "penurunan laba",
            "tunggakan", "utang bengkak", "turun tajam", "kinerja anjlok", "gugat", "sita aset",
            "penjualan anjlok", "default", "rating turun", "peringkat turun", "rugi membengkak",
            "peringatan bursa", "uma", "unusual market activity"
        ]

    def analyze(self, title: str, summary: str = "") -> dict:
        text = f"{title} {summary}".lower()
        
        bullish_score = 0
        bearish_score = 0
        matched_triggers = []
        
        for kw in self.bullish_keywords:
            if kw in text:
                bullish_score += 1
                matched_triggers.append(kw)
                
        for kw in self.bearish_keywords:
            if kw in text:
                bearish_score += 1
                matched_triggers.append(kw)
                
        if bullish_score > bearish_score:
            sentiment = "BULLISH"
            score = round(min(0.5 + (bullish_score * 0.15), 0.98), 2)
        elif bearish_score > bullish_score:
            sentiment = "BEARISH"
            score = round(min(0.5 + (bearish_score * 0.15), 0.98), 2)
        else:
            sentiment = "NEUTRAL"
            score = 0.50
            
        return {
            "label": sentiment,
            "score": score,
            "matched_terms": matched_triggers
        }
