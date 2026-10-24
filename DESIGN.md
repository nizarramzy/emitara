---
version: alpha
name: Emitara Editorial Luxury
description: Editorial market news portal and in-app reader for IDX equities, crafted with warm espresso palette and Didone luxury typography.
colors:
  primary: "#291C0E"
  secondary: "#BEB5A9"
  tertiary: "#6E473B"
  tertiary-hover: "#8C5B4C"
  neutral: "#A78D78"
  canvas: "#E1D4C2"
  canvas-card: "#FBF8F4"
  border: "#D8CEBF"
  border-subtle: "#E6DEC2"
  text-primary: "#291C0E"
  text-secondary: "#6E473B"
  text-muted: "#6A5849"
  bullish: "#1E5128"
  bullish-bg: "#D8E8D4"
  bearish: "#8B2500"
  bearish-bg: "#FCDDD2"
  neutral-tag: "#3D2B1F"
  neutral-bg: "#E8DFD3"
typography:
  display-h1:
    fontFamily: "Playfair Display, Bodoni Moda, serif"
    fontSize: 2.25rem
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  h2:
    fontFamily: "Playfair Display, serif"
    fontSize: 1.375rem
    fontWeight: 600
    lineHeight: 1.3
  body-md:
    fontFamily: "Plus Jakarta Sans, Inter, sans-serif"
    fontSize: 0.9375rem
    fontWeight: 400
    lineHeight: 1.6
  body-article:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: 1.0625rem
    fontWeight: 400
    lineHeight: 1.7
  ticker-badge:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: 0.75rem
    fontWeight: 700
    letterSpacing: "0.04em"
  mono-timestamp:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: 0.6875rem
    fontWeight: 500
rounded:
  sm: 4px
  md: 8px
  lg: 14px
  xl: 18px
  pill: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 36px
components:
  container-canvas:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: 24px
  card-hero:
    backgroundColor: "{colors.canvas-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: 24px
  card-news-row:
    backgroundColor: "{colors.canvas-card}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.xl}"
    padding: 16px
  panel-mega-menu:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: 24px
  sheet-reader:
    backgroundColor: "{colors.canvas-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: 36px
  badge-category:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.neutral-tag}"
    rounded: "{rounded.pill}"
    padding: 4px
  badge-ticker:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.tertiary}"
    rounded: "{rounded.sm}"
    padding: 4px
  badge-bullish:
    backgroundColor: "{colors.bullish-bg}"
    textColor: "{colors.bullish}"
    rounded: "{rounded.pill}"
    padding: 4px
  badge-bearish:
    backgroundColor: "{colors.bearish-bg}"
    textColor: "{colors.bearish}"
    rounded: "{rounded.pill}"
    padding: 4px
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: 10px
  button-primary-hover:
    backgroundColor: "{colors.tertiary-hover}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: 10px
  border-separator:
    backgroundColor: "{colors.border}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: 2px
  meta-byline:
    backgroundColor: "{colors.border-subtle}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.sm}"
    padding: 4px
  panel-taupe:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 16px
---

## Overview

Emitara adalah portal berita pasar modal Indonesia (IHSG) dan pembaca in-app berstandar editorial prestisius. Visual mengambil inspirasi langsung dari tipografi editorial majalah mode dunia (Vogue) serta palet warna hangat earthy luxury (Warm Espresso, Chestnut, Taupe, Oatmeal, Almond Milk Cream). Antarmuka mengutamakan kenyamanan membaca naskah panjang tanpa keletihan mata, dipadukan dengan aliran data bursa realtime.

Dial pengarah desain: ENERGY 2 / RHYTHM 2 / MOTION 2.

## Colors

- Primary (`#291C0E`): Deep Espresso pekat untuk masthead, judul berita utama, dan batas ketegasan layout.
- Canvas (`#E1D4C2`): Warm Almond Cream sebagai latar belakang dasar. Menggantikan putih steril dengan kehangatan kertas cetak edisi terbatas.
- Canvas Card (`#FBF8F4`): Pure Creamy White untuk kontainer kartu berita dan lembar baca artikel (reader sheet).
- Tertiary (`#6E473B`): Warm Chestnut untuk aksen interaktif, tombol aksi primer, dan penanda kategori aktif.
- Neutral (`#A78D78`): Muted Taupe untuk byline reporter dan garis pemisah halus.
- Secondary (`#BEB5A9`): Pale Oatmeal untuk latar kontainer sekunder.
- Bullish (`#1E5128` teks pada `#D8E8D4` latar): Muted Forest Olive untuk sinyal pasar positif yang tenang.
- Bearish (`#8B2500` teks pada `#FCDDD2` latar): Warm Terracotta Red untuk sinyal koreksi atau risiko emiten.
- Border (`#D8CEBF`): Garis pembatas hangat yang memisahkan modul konten dengan elegan.

## Typography

- Display H1 & H2 (Playfair Display / Bodoni Didone): Huruf serif kontras tinggi untuk Masthead koran, tajuk artikel sorotan, dan headline pembaca. Menghadirkan wibawa jurnalisme berkelas tinggi.
- Body MD & Article (Plus Jakarta Sans / Inter): Huruf proporsional modern dengan spasi baris 1.6 hingga 1.7 untuk kenikmatan membaca artikel utuh ratusan kata.
- Ticker Badge & Timestamp (JetBrains Mono): Tipografi angka dan kode emiten 4 huruf (BBCA, BBRI, BMRI) untuk presisi data bursa.

## Layout

- Top Bar Masthead: Logo EMITARA beraksen Didone serif di tengah, indikator status bursa IDX live, dan akses pencarian.
- Running Ticker Bar: Baris mendatar di bawah header memuat indeks bursa dan saham aktif.
- Feed Portal View:
  - Hero Featured Card: Satu berita headline terbesar dengan foto beresolusi tinggi, kategori tag, estimasi waktu baca, dan judul besar.
  - Category Pills Bar: Tab horizontal (Terkini, Finansial, Energi & Tambang, Konsumer, Teknologi, Makro).
  - News List Column: Kartu horizontal modular memadukan thumbnail squircle 90px dengan judul tebal dua baris, metadata media, dan label sentimen.
  - Market Radar Sidebar: Top mention emiten 24 jam dan pergerakan tren bursa.
- In-App Article Reader View:
  - Lembar artikel mandiri muncul saat kartu diklik tanpa meninggalkan web aplikasi.
  - Header navigasi kembali ke feed (Kembali ke Berita).
  - Foto utama editorial berskala penuh dengan atribusi jurnalis dan sumber media.
  - Paragraf isi berita lengkap tersusun rapi bebas dari iklan eksternal.
  - Ticker terkait dan rekomendasi bacaan di bagian penutup artikel.

## Elevation & Depth

- Zero Excessive Shadows: Menghilangkan shadow blur berlebihan yang membuat elemen melayang tanpa arah (anti-slop R-12).
- Tactile Layering: Kedalaman visual dibentuk oleh tumpukan warna lembut: kanvas `#E1D4C2` membungkus kartu `#FBF8F4` dengan garis tepi halus `#D8CEBF`.
- Reader Sheet Inset: Lembar baca artikel hadir sebagai fokus utama dengan margin bernafas yang lega.

## Shapes

- Radius Bertingkat: Hero Card `{rounded.lg}` (14px), News Row Card `{rounded.md}` (8px), dan Badge Status `{rounded.pill}` (9999px). Variasi radius mencerminkan hierarki fungsi (anti-slop R-11).

## Components

- card-hero: Kartu berita sorotan utama dengan gambar lanskap beresolusi tinggi, tag kategori, estimasi menit baca, dan bookmark.
- panel-mega-menu: Panel navigasi flyout berstandar Bloomberg Terminal. Memuat menu sub-kategori aksi korporasi, sektor pasar modal BEI, kisi live kartu saham teraktif (Top Securities), dan kartu pintasan Watchlist.
- card-news-row: Komponen kartu warta baris horizontal dengan estetika soft glassmorphic/neumorphic. Sisi kiri memuat teks judul (70%), penerbit, dan ticker; sisi kanan memuat squircle thumbnail 80x80px sudut 14px (30%). Menggunakan bayangan lembut berdifusi tinggi dan hairline highlight putih kaca.
- sheet-reader: Wadah artikel utuh yang memuat seluruh teks paragraf, nama jurnalis, tanggal terbit, dan badge ticker emiten.
- badge-ticker: Label kode saham monospace dengan sudut terukur `{rounded.sm}`.
- badge-bullish & badge-bearish: Label sentimen pasar teruji standar rasio kontras WCAG AA.
- button-primary: Tombol aksi utama berbentuk kapsul dengan warna chestnut hangat.

## Do's and Don'ts

### Do's
- Gunakan font Didone Serif khusus untuk Masthead dan judul berita utama agar menghadirkan kesan majalah prestisius.
- Berikan jarak baris (line-height 1.65+) dan spasi antar-paragraf yang lega pada isi artikel agar nyaman dibaca.
- Cantumkan nama media asal dan jurnalis resmi pada setiap artikel hasil kloning.

### Don'ts
- Dilarang memakai warna hitam pekat `#000000` di atas putih murni `#FFFFFF` yang menyebabkan silau tajam; gunakan deep espresso `#291C0E` di atas warm cream `#FBF8F4`.
- Dilarang membuat semua tombol dan kartu menjadi seragam tanpa hierarki visual (anti-slop R-05, R-11).
- Dilarang menggunakan karakter em dash pada seluruh teks judul, kutipan, maupun antarmuka (anti-slop R-02).
- Dilarang menambahkan teks gimik seperti AI Powered atau Revolutionary (anti-slop R-16).
