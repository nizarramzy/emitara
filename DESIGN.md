---
version: alpha
name: Emitara Media Flow
description: Contemporary editorial media and market news system for IDX equities, blending high-contrast monochrome minimalism with tactile typography.
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
  sm: 6px
  md: 10px
  lg: 16px
  xl: 20px
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
  card-highlight:
    backgroundColor: "{colors.canvas-subtle}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: 16px
  card-news-row:
    backgroundColor: "{colors.canvas-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: 16px
  sheet-reader:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    padding: 36px
  badge-verified:
    backgroundColor: "{colors.accent-blue-bg}"
    textColor: "{colors.accent-blue}"
    rounded: "{rounded.pill}"
    padding: 4px
  card-media-subtle:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.sm}"
    padding: 8px
  border-neutral:
    backgroundColor: "{colors.neutral}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: 2px
  badge-category:
    backgroundColor: "{colors.canvas-subtle}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.pill}"
    padding: 6px
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
---

## Overview

Emitara Media Flow mengadopsi estetika penerbitan digital kontemporer (Apple News meets Financial Times). Menekankan kanvas putih bersih, kontras hitam pekat, batas hairline 1px halus, dan tipografi dual-font berwibawa: serif untuk tajuk editorial dan sans-serif untuk fungsi navigasi.

Dial pengarah desain: ENERGY 2 / RHYTHM 3 / MOTION 2.

## Colors

- Primary (`#000000`): Pitch black untuk tombol aktif, indikator pill, dan penegasan visual.
- Secondary (`#111111`): Warna utama teks tajuk editorial.
- Canvas (`#FFFFFF`): Putih murni untuk latar belakang dan kartu warta.
- Canvas Subtle (`#F5F5F7`): Abu netral lembut untuk kontainer input, chip kategori, dan media carousel.
- Neutral & Text Muted (`#6B7280`): Abu-abu dingin untuk teks sekunder, waktu rilis, dan byline.
- Border (`#E5E7EB`): Garis pembatas rambut 1px yang bersih.
- Bullish (`#15803D` pada `#DCFCE7`): Hijau zamrud lembut untuk indikasi pasar positif.
- Bearish (`#B91C1C` pada `#FEE2E2`): Merah tua lembut untuk indikasi koreksi pasar.

## Typography

- Display H1 & H2 (Playfair Display / Georgia): Serif Didone modern dengan kontras goresan tajam untuk tajuk utama editorial.
- Body MD & Article (Plus Jakarta Sans / Inter): Tipografi proporsional dengan keterbacaan tinggi pada layar sentuh maupun desktop.
- Ticker Badge & Timestamp (JetBrains Mono): Tipografi angka dan kode emiten presisi.

## Layout

- Top Bar: Header ringkas dengan logo EMITARA serif dan tombol aksi.
- Segmented Switcher: Tab beralih antara Semua Warta dan Audio/Podcast.
- Search & Category Pills: Input pencarian kapsul dan filter rubrik geser mendatar.
- Highlights Carousel: Deretan kartu sorotan rasio 4:5 geser horizontal untuk berita utama.
- News List Stream: Kartu 2-kolom dengan thumbnail 88x88px sudut 12px di sisi kiri dan naskah tajuk di sisi kanan.
- In-App Reader & Audio Player: Lembar baca artikel utuh dilengkapi pemutar audio naskah berita.
- Floating Bottom Dock (Mobile): Bar navigasi 5-ikon di bagian bawah layar ponsel.

## Elevation & Depth

- Zero Heavy Shadows: Kedalaman visual dibangun melalui kontras permukaan `#FFFFFF` dan `#F5F5F7` serta garis pembatas 1px `#E5E7EB`.
- Floating Bottom Bar: Menggunakan bayangan ambient lembut `0 4px 20px rgba(0, 0, 0, 0.08)`.

## Shapes

- Radius Kontemporer: Sudut kartu list `{rounded.md}` (10px), kartu sorotan `{rounded.lg}` (16px), tombol dan pill `{rounded.pill}` (9999px).

## Components

- card-highlight: Kartu sorotan utama dalam format carousel horizontal.
- card-news-row: Kartu warta baris 2-kolom (thumbnail kiri, naskah kanan).
- sheet-reader: Lembar baca naskah artikel utuh.
- dock-bottom: Bar navigasi mengambang untuk navigasi jempol di ponsel.

## Do's and Don'ts

### Do's
- Gunakan spasi putih lapang (whitespace) untuk memisahkan kelompok informasi.
- Gunakan font serif untuk tajuk warta utama dan sans-serif untuk label fungsi.
- Pertahankan sudut membulat kontinu 12px-16px pada wadah gambar.

### Don'ts
- Dilarang memakai bayangan tebal kotor atau gradien neon (anti-slop R-01, R-12).
- Dilarang membuat tombol atau tautan yang tidak berfungsi (anti-slop R-26).
- Dilarang memakai karakter em dash pada seluruh teks (anti-slop R-02).
