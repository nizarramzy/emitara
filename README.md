# EMITARA: Portal Warta Saham & Aksi Korporasi IHSG Realtime

Emitara adalah portal berita pasar modal Indonesia (IHSG) dan terminal editorial cerdas dengan aliran data realtime, analitik sentimen bursa, serta pembaca naskah in-app mandiri.

## Fitur Utama

- **Realtime News Ingestion**: Mengagregasi warta bursa terverifikasi dari CNBC Indonesia, Detik Finance, Katadata Finansial, dan Investor Daily tiap 40 detik.
- **In-App Article Reader**: Membaca naskah berita lengkap langsung di dalam web tanpa dialihkan ke situs pihak ketiga.
- **Running Ticker Pita Saham**: Pergerakan harga bursa riil (IHSG, BBCA, BBRI, BMRI, TLKM, ASII, BREN, dll) dengan rotasi continuous loop mulus.
- **Bloomberg-Style Markets Mega Menu**: Dropdown navigasi institusional memuat sub-kategori warta emiten, sektor BEI, kisi sekuritas teraktif live, dan akses cepat watchlist.
- **Dynamic Scroll Rhythm**: Alur feed tidak monoton, menyisipkan 4 modul visual berbeda secara konsisten (kisi tematik 3-kolom, split card, quote callout, duo asimetris).
- **Sticky Market Radar**: Barometer sentimen pasar live, agenda aksi korporasi/dividen mendatang, dan tabel indeks sektoral BEI yang terkunci mengikuti pergerakan scroll.
- **Watchlist & Bookmark**: Simpan emiten pantauan dan warta favorit dengan penyimpanan lokal (localStorage).
- **Audio Alert**: Nada dering instan saat berita baru mendarat via Server-Sent Events (SSE).

## Struktur Direktori

```text
ProjectEmitara/
├── api/
│   └── index.py            # Entry point Serverless ASGI untuk Vercel
├── app/
│   ├── database.py         # Engine database SQLite & query artikel
│   ├── main.py             # Router FastAPI REST API & SSE Hub
│   ├── matcher.py          # 2-layer ticker extraction (951 emiten BEI)
│   ├── quotes.py           # Feed harga bursa live Yahoo Finance
│   ├── sentiment.py        # Lexicon analisis sentimen finansial
│   └── worker.py           # Background ingestion worker & scraper naskah
├── data/
│   ├── emitara.db          # Database SQLite lokal (berisi ratusan artikel utuh)
│   └── emiten_master.json  # Master data 951 kode emiten dan alias
├── static/
│   ├── css/style.css       # Desain sistem Vogue Luxury & Neumorphic
│   ├── js/app.js           # Controller feed, reader modal, dan mega menu
│   ├── js/audioAlert.js    # Web Audio API synthetic chime
│   ├── js/tickerFilter.js  # State filter live ticker
│   └── index.html          # Markup portal utama
├── DESIGN.md               # Spek desain Google tokens (WCAG AA valid)
├── requirements.txt        # Dependensi Python
├── run.py / run.bat        # Runner server lokal
└── vercel.json             # Konfigurasi deployment Vercel
```

## Menjalankan Secara Lokal

1. Install dependensi:
   ```bash
   pip install -r requirements.txt
   ```
2. Jalankan aplikasi:
   ```bash
   python run.py
   ```
3. Buka di peramban: `http://localhost:8050`

## Deployment ke Vercel

Proyek ini telah dikonfigurasi untuk langsung di-deploy ke Vercel:
1. Push repositori ini ke GitHub.
2. Buka dashboard `vercel.com`, klik **Add New Project**.
3. Hubungkan repositori GitHub Anda dan klik **Deploy**.
