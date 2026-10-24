---
version: alpha
name: Emitara Bloomberg Asia Editorial
description: Architectural editorial layout modeled after Bloomberg Asia, featuring an asymmetric lead story package, 3-up kicker matrices, text dispatches, and live market intelligence.
colors:
  primary: "#000000"
  secondary: "#111111"
  tertiary: "#1E293B"
  neutral: "#6B7280"
  canvas: "#FFFFFF"
  canvas-card: "#FFFFFF"
  canvas-subtle: "#F5F5F7"
  border: "#E5E7EB"
  border-subtle: "#F3F4F6"
  text-primary: "#111111"
  text-secondary: "#4B5563"
  text-muted: "#4B5563"
  bullish: "#15803D"
  bullish-bg: "#DCFCE7"
  bearish: "#B91C1C"
  bearish-bg: "#FEE2E2"
  accent-blue: "#075985"
  accent-blue-bg: "#E0F2FE"
  accent-gold: "#E2BA73"
  dark-surface: "#12161F"
typography:
  display-h1:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: 2.25rem
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  h2:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: 1.35rem
    fontWeight: 700
    lineHeight: 1.3
  body-md:
    fontFamily: "Plus Jakarta Sans, Inter, sans-serif"
    fontSize: 0.9375rem
    fontWeight: 400
    lineHeight: 1.55
  body-article:
    fontFamily: "Plus Jakarta Sans, Inter, sans-serif"
    fontSize: 1.0625rem
    fontWeight: 400
    lineHeight: 1.75
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
  card-hero-split:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: 24px
  card-3up-matrix:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: 16px
  card-dispatch:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: 12px
  card-news-row:
    backgroundColor: "{colors.canvas-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: 16px
  card-breakout-dark:
    backgroundColor: "{colors.dark-surface}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: 24px
  sheet-reader:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    padding: 36px
  badge-kicker:
    backgroundColor: "{colors.canvas-subtle}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sm}"
    padding: 4px
  badge-kicker-gold:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.accent-gold}"
    rounded: "{rounded.sm}"
    padding: 4px
  badge-ticker:
    backgroundColor: "{colors.canvas-subtle}"
    textColor: "{colors.secondary}"
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
  badge-verified:
    backgroundColor: "{colors.accent-blue-bg}"
    textColor: "{colors.accent-blue}"
    rounded: "{rounded.pill}"
    padding: 4px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.tertiary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: 12px
  border-separator:
    backgroundColor: "{colors.border}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: 2px
  border-neutral:
    backgroundColor: "{colors.neutral}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: 2px
  dock-bottom:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.pill}"
    padding: 12px
  subtle-line:
    backgroundColor: "{colors.border-subtle}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: 1px
  card-media-subtle:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.sm}"
    padding: 8px
---

## Overview

Emitara Bloomberg Asia Editorial mengadopsi arsitektur visual berstandar Bloomberg Terminal, Bloomberg Asia, dan CNBC Pro. Menghilangkan nuansa neon kasual atau day-trading retail, menggantikannya dengan palet institusional: Lead Story Package, matriks 3-kolom kicker tematik, baris warta teks analitik tanpa gambar, serta modul riset gelap institusional beraksen champagne gold.

Dial pengarah desain: ENERGY 2 / RHYTHM 3 / MOTION 2.

## Colors

- Primary (`#000000`): Pitch black untuk tombol aksi dan garis pembatas utama.
- Dark Surface (`#12161F`): Deep charcoal navy-slate untuk kontainer riset pasar institusional.
- Accent Gold (`#E2BA73`): Champagne gold ala Bloomberg Terminal untuk kicker Market Intelligence dan aksen riset premium.
- Secondary (`#111111`): Warna tajuk warta utama dengan kontras tinggi.
- Canvas (`#FFFFFF`): Putih murni untuk latar belakang halaman editorial.
- Canvas Subtle (`#F5F5F7`): Abu-abu netral lembut untuk kontainer kicker dan widget samping.
- Text Primary (`#111111`): Hitam tajam untuk kenyamanan membaca tajuk.
- Text Secondary & Muted (`#4B5563`): Abu-abu dingin proporsional untuk byline, jam terbit, dan cuplikan naskah.
- Border (`#E5E7EB`): Hairline rule 1px sebagai pemisah kolom ala media cetak prestisius.
- Bullish (`#15803D` pada `#DCFCE7`) dan Bearish (`#B91C1C` pada `#FEE2E2`): Penanda sentimen pasar dengan kontras rasio WCAG AA teruji.

## Typography

- Display H1 & H2 (Playfair Display / Georgia): Serif Didone modern untuk tajuk utama berita sorotan, menghadirkan karakter jurnalisme investigatif berkelas.
- Body MD & Article (Plus Jakarta Sans / Inter): Tipografi proporsional untuk naskah berita lengkap dan teks UI.
- Ticker Badge & Timestamp (JetBrains Mono): Tipografi angka dan kode emiten presisi.

## Layout

- Top Bar: Masthead EMITARA dengan akses cepat ke menu pasar Bloomberg.
- Running Ticker Tape: Pita harga saham bursa riil yang berputar mulus 100% tanpa jeda.
- Hero Lead Package (Asymmetric Split): Tajuk utama berhuruf besar di sisi kiri dengan kutipan pembuka dan byline reporter, dipadukan dengan foto lanskap beresolusi tinggi di sisi kanan.
- 3-Up Kicker Matrix: Tiga kolom kartu berita di bawah tajuk utama dengan foto lanskap 16:9, label kicker kapital tebal (THE BIG TAKE, ANALISIS, RISET), dan tajuk tebal.
- Text Dispatch Row: Tiga kolom kartu teks murni berdensitas tinggi untuk warta kilat dan opini pasar.
- Dark Intelligence Breakout Strip: Blok modul gelap bergaya Bloomberg/CNBC Pro `#12161F` dengan kicker champagne gold `#E2BA73` dan tautan riset elegan.
- Right Sidebar Rail: Aliran warta terkini 24 jam, watchlist saham personal, barometer sentimen live, dan kalender aksi korporasi yang terkunci mengikuti gulir halaman (sticky).

## Elevation & Depth

- Zero Heavy Drop Shadows: Seluruh kedalaman visual dibangun dari garis pembatas 1px hairline rule `#E5E7EB` dan kontras permukaan putih `#FFFFFF` vs abu `#F5F5F7` (anti-slop R-12).
- Floating Bottom Dock (Mobile): Bar navigasi mengambang untuk navigasi jempol di ponsel.

## Shapes

- Radius Tajam & Minimalis: Sudut kartu matriks `{rounded.sm}` (4px), kartu baris `{rounded.md}` (8px), wadah gambar `{rounded.lg}` (14px). Menolak sudut serba bulat pada seluruh elemen (anti-slop R-11).

## Components

- card-hero-split: Paket tajuk berita utama asimetris.
- card-3up-matrix: Kartu warta 3-kolom bergaya Bloomberg Asia dengan label kicker tematik.
- card-dispatch: Kartu warta teks berdensitas tinggi tanpa gambar.
- card-news-row: Kartu warta baris horizontal dengan thumbnail presisi di sisi kiri.
- card-breakout-dark: Modul riset pasar gelap institusional Bloomberg/CNBC Pro.
- sheet-reader: Lembar baca naskah artikel utuh di dalam aplikasi.

## Do's and Don'ts

### Do's
- Gunakan warna champagne gold (`#E2BA73`) atau slate gray (`#94A3B8`) pada kicker dan aksen modul gelap untuk menghadirkan aura riset institusional Bloomberg.
- Gunakan label kicker kapital tebal (THE BIG TAKE, DISPATCH, ANALISIS) untuk menciptakan panduan mata vertikal sebelum judul berita.
- Pertahankan garis pemisah hairline 1px halus di antara artikel untuk menjaga kerapian grid editorial.

### Don'ts
- Dilarang memakai warna hijau neon lime atau mint cyber pada teks kicker dan tombol aksi statis (anti-slop R-08); warna hijau khusus untuk persentase kenaikan harga saham.
- Dilarang mengulang satu bentuk kartu yang sama secara terus-menerus tanpa variasi (anti-slop R-05, R-14).
- Dilarang menggunakan karakter em dash pada seluruh teks judul maupun kutipan (anti-slop R-02).
