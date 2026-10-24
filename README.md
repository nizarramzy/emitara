# EMITARA

> **High-Frequency Realtime Stock News Terminal & Editorial Portal for Indonesia Stock Exchange (IDX)**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.12+-3776AB.svg?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![Database](https://img.shields.io/badge/Database-SQLite-003B57.svg?style=flat&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Deployment](https://img.shields.io/badge/Deployment-Vercel%20Serverless-000000.svg?style=flat&logo=vercel&logoColor=white)](https://vercel.com)

---

## 1. Executive Summary

**Emitara** adalah portal warta pasar modal Indonesia (IHSG) dan terminal editorial finansial yang dirancang untuk investor ritel dan institusi. Platform ini menggabungkan kecepatan latensi rendah dari terminal bursa (Bloomberg-grade) dengan estetika editorial majalah prestisius (Vogue / Financial Times). 

Dilengkapi dengan ekstraksi entitas emiten otomatis (951 emiten BEI), analisis sentimen pasar berbasis leksikon finansial, pembaca naskah penuh di dalam aplikasi (in-app reader), dan pita harga bursa riil yang berjalan secara berkesinambungan tanpa jeda.

---

## 2. Arsitektur Sistem

Pipeline data dirancang terpisah antara proses ingestion warta dengan penyajian ke pengguna untuk menjamin throughput tinggi dan latensi sub-detik:

```text
[ Sumber Data: CNBC, Detik, Katadata, Investor Daily ]
                          │
                          ▼ (Asynchronous Worker 40s)
               [ Parser & Content Scraper ]
                          │
        ┌─────────────────┴─────────────────┐
        ▼                                   ▼
 [ Hash Deduplication ]             [ Ticker Disambiguation ]
 (SHA-256 Canonical URL)            (2-Layer Matcher 951 Emiten)
        │                                   │
        └─────────────────┬─────────────────┘
                          ▼
              [ Financial Sentiment Engine ]
              (Bullish, Bearish, Neutral)
                          │
                          ▼
            [ SQLite Database Engine ]
            (Indeks Unik & Arsip Warta)
                          │
        ┌─────────────────┴─────────────────┐
        ▼                                   ▼
[ REST Endpoints /api/news ]       [ SSE Stream Hub /stream ]
(Initial Hydration & Reader)       (Sub-second Realtime Push)
        │                                   │
        └─────────────────┬─────────────────┘
                          ▼
           [ Dashboard UI / In-App Reader ]
```

---

## 3. Fitur Utama

### A. Aliran Warta & In-App Reader Mandiri
- **Continuous Ingestion**: Mengagregasi warta bursa terverifikasi setiap 40 detik secara otomatis dari media finansial resmi.
- **Full Article Reader**: Mengambil seluruh paragraf naskah asli jurnalis, byline reporter, dan foto resolusi tinggi, memungkinkan pengguna membaca naskah penuh langsung di aplikasi tanpa dialihkan ke web pihak ketiga.
- **Deep Linking Support**: Setiap warta memiliki hash URL mandiri (`#/berita/{id}`) yang dapat dibagikan dan diakses langsung.

### B. Live Ticker & Pasar Riil (Zero-Dummy Data)
- **Live Market Feed**: Terhubung langsung ke data pasar Bursa Efek Indonesia (Yahoo Finance chart API) yang memperbarui harga penutupan dan fluktuasi persentase IHSG serta saham LQ45/unggulan secara berkala.
- **Seamless Infinite Marquee**: Animasi pita saham menggunakan teknik duplikasi kontainer kembar sehingga berputar 100% mulus tanpa jeda, tanpa loncatan, dan tanpa ruang kosong.

### C. Bloomberg-Style Markets Mega Menu
- Panel navigasi institusional yang dapat diperluas (*flyout panel*) dari bilah navigasi utama.
- Menyediakan pintasan aksi korporasi (Dividen, RUPS, IPO, Laba), navigasi sektor BEI, serta kisi 3x3 ubin saham teraktif (*Top Securities*) berdata riil.

### D. Dynamic Scroll Rhythm
- Mencegah kelelahan visual saat menelusuri ratusan berita melalui rotasi 4 modul layout bervariasi:
  1. *Pola A*: Kisi tematik 3-kolom foto lanskap.
  2. *Pola B*: Wide split feature card 50/50.
  3. *Pola C*: Market insight callout dengan kutipan analisis redaksi.
  4. *Pola D*: Asymmetric duo card (kombinasi kontras foto utama dan naskah tajam).

### E. Sticky Market Radar & Personalisasi
- **Barometer Sentimen**: Menghitung rasio sentimen pasar hari ini secara dinamis dari database.
- **Kalender Aksi Korporasi**: Pemantauan agenda dividen dan RUPS mendatang.
- **Personal Watchlist**: Menyimpan daftar emiten yang dipantau ke penyimpanan lokal peramban (*localStorage*).
- **Bookmark Warta**: Menandai artikel favorit untuk dibaca kembali kapan saja.

---

## 4. Spesifikasi Desain & Standar Aksesibilitas

Desain Emitara berpedoman pada spesifikasi formal token Google (`DESIGN.md`):
- **Palet Warna**: Warm Almond Milk (`#E1D4C2`), Warm Card White (`#FBF8F4`), Deep Espresso (`#291C0E`), dan Warm Chestnut (`#6E473B`).
- **Tipografi**: Playfair Display / Bodoni Didone Serif untuk tajuk utama berwibawa, dipadukan dengan Plus Jakarta Sans untuk teks artikel dan JetBrains Mono untuk angka bursa.
- **Aksesibilitas**: Seluruh komponen teks dan badge sentimen telah divalidasi lolos standar rasio kontras WCAG AA (0 warnings, 0 errors pada `@google/design.md` linter).

---

## 5. Dokumentasi API

| Endpoint | Metode | Deskripsi |
| :--- | :--- | :--- |
| `/api/news` | `GET` | Mengambil daftar warta terindeks (mendukung `limit`, `offset`, `ticker`, `sentiment`, `category`). |
| `/api/news/{id}` | `GET` | Mengambil detail naskah artikel utuh, jurnalis, foto, dan warta terkait. |
| `/api/news/stream` | `GET` | Aliran Server-Sent Events (SSE) realtime satu arah untuk notifikasi warta baru. |
| `/api/market/ticker` | `GET` | Mengambil harga bursa dan persentase live 15 emiten teraktif IHSG (cache 45 detik). |
| `/api/trending` | `GET` | Mengambil statistik frekuensi emiten paling banyak disebut dalam 24 jam terakhir. |
| `/api/refresh` | `POST` | Memaksa worker untuk melakukan sinkronisasi warta baru seketika. |
| `/api/cron/poll` | `GET` | Endpoint penjadwal cron untuk lingkungan serverless (Vercel Cron). |

---

## 6. Panduan Instalasi Lokal

### Prasyarat
- Python 3.10 atau versi lebih baru
- Git

### Langkah Instalasi
1. Clone repositori:
   ```bash
   git clone https://github.com/nizarramzy/Emitara.git
   cd Emitara
   ```
2. Pasang pustaka dependensi:
   ```bash
   pip install -r requirements.txt
   ```
3. Jalankan server lokal:
   ```bash
   python run.py
   ```
4. Buka peramban di: `http://localhost:8050`

---

## 7. Deployment ke Vercel

Proyek ini telah dikonfigurasi penuh dengan arsitektur serverless melalui berkas `vercel.json` dan `api/index.py`:

1. Buka [Vercel Dashboard](https://vercel.com/dashboard).
2. Klik tombol **Add New...** lalu pilih **Project**.
3. Hubungkan repositori GitHub `nizarramzy/Emitara`.
4. Pilih **Framework Preset**: `Other`.
5. Klik **Deploy**.

Proses build akan mendeteksi runtime Python secara otomatis dan menyajikan antarmuka statis dengan fungsionalitas API serverless lengkap.

---

## 8. Lisensi

Didistribusikan di bawah lisensi MIT. Lihat berkas `LICENSE` untuk informasi lebih lanjut.
