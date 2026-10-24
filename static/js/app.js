// Emitara Editorial Portal & In-App Reader Logic
(function() {
  const state = {
    articles: [],
    seenGuids: new Set(),
    activeCategory: 'ALL',
    activeSentiment: 'ALL',
    activeTicker: null,
    searchQuery: '',
    viewMode: 'ALL', // 'ALL' | 'WATCHLIST' | 'BOOKMARKS'
    watchlist: JSON.parse(localStorage.getItem('emitara_watchlist') || '["BBCA", "BMRI", "TLKM"]'),
    bookmarks: JSON.parse(localStorage.getItem('emitara_bookmarks') || '[]'),
    eventSource: null
  };

  // DOM Elements
  const heroContainer = document.getElementById('heroContainer');
  const newsList = document.getElementById('newsList');
  const feedCounter = document.getElementById('feedCounter');
  const trendingList = document.getElementById('trendingList');
  const readerOverlay = document.getElementById('readerOverlay');
  const btnCloseReader = document.getElementById('btnCloseReader');
  const searchInput = document.getElementById('searchInput');
  const categoryPills = document.querySelectorAll('.category-pill');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const btnAudio = document.getElementById('btnAudio');
  const btnRefresh = document.getElementById('btnRefresh');
  const btnViewBookmarks = document.getElementById('btnViewBookmarks');
  const bookmarkCountEl = document.getElementById('bookmarkCount');

  // Helpers
  
  function toggleBookmark(item) {
    const idx = state.bookmarks.findIndex(b => b.id === item.id);
    if (idx >= 0) {
      state.bookmarks.splice(idx, 1);
    } else {
      state.bookmarks.push({
        id: item.id,
        title: item.title,
        source: item.source,
        published_at: item.published_at,
        url: item.url,
        image_url: item.image_url
      });
    }
    localStorage.setItem('emitara_bookmarks', JSON.stringify(state.bookmarks));
  }

  function formatRelativeTime(isoString) {
    if (!isoString) return '';
    try {
      const pubDate = new Date(isoString);
      const now = new Date();
      const diffSec = Math.floor((now - pubDate) / 1000);
      if (diffSec < 60) return 'Baru saja';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin} menit lalu`;
      const diffHour = Math.floor(diffMin / 60);
      if (diffHour < 24) return `${diffHour} jam lalu`;
      const diffDay = Math.floor(diffHour / 24);
      return `${diffDay} hari lalu`;
    } catch (e) {
      return isoString;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function estimateReadTime(text) {
    if (!text) return '2 mnt baca';
    const words = text.split(/\s+/).length;
    const mins = Math.max(1, Math.round(words / 160));
    return `${mins} mnt baca`;
  }

  // Filter checking
  function passesFilter(item) {
    // 0. View Mode (Watchlist or Bookmarks)
    if (state.viewMode === 'WATCHLIST') {
      const tickers = Array.isArray(item.tickers) ? item.tickers : [];
      const hasWatched = tickers.some(t => state.watchlist.includes(t));
      if (!hasWatched) return false;
    } else if (state.viewMode === 'BOOKMARKS') {
      const isSaved = state.bookmarks.some(b => b.id === item.id);
      if (!isSaved) return false;
    }

    // 1. Ticker
    if (state.activeTicker) {
      const tickers = Array.isArray(item.tickers) ? item.tickers : [];
      if (!tickers.includes(state.activeTicker)) return false;
    }

    // 2. Sentiment
    if (state.activeSentiment !== 'ALL') {
      if ((item.sentiment || '').toUpperCase() !== state.activeSentiment) return false;
    }

    // 3. Category
    if (state.activeCategory !== 'ALL') {
      const cat = state.activeCategory.toLowerCase();
      const text = `${item.title} ${item.summary || ''} ${(item.tickers || []).join(' ')}`.toLowerCase();
      if (!text.includes(cat)) {
        if (cat === 'finansial' && !/finansial|bank|saham|ihsg|kredit|modal|dana|bbca|bbri|bmri|bbni|ojk|bei|dividen|laba|rugi|obligasi/i.test(text)) return false;
        if (cat === 'energi' && !/energi|minyak|batu bara|gas|emas|nikel|ptba|adaro|antam|medco|tambang|bren|esdm|pln|cuan/i.test(text)) return false;
        if (cat === 'konsumer' && !/konsumer|ritel|makanan|minuman|indofood|unilever|daya beli|belanja|harga|pangan|beras|ekspor|ukm/i.test(text)) return false;
        if (cat === 'teknologi' && !/teknologi|digital|telkom|goto|ai|startup|aplikasi|gadget|data|internet|software/i.test(text)) return false;
        if (cat === 'makro' && !/makro|ekonomi|pajak|inflasi|suku bunga|bi|apbn|fiskal|pemerintah|menteri|rupiah|gdp|pertumbuhan/i.test(text)) return false;
      }
    }

    // 4. Search query
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      const text = `${item.title} ${item.summary || ''} ${item.source} ${(item.tickers || []).join(' ')}`.toLowerCase();
      if (!text.includes(q)) return false;
    }

    return true;
  }

  // Render Portal Feed
  
  // Helper for Pattern A: Themed 3-column showcase blocks
  function createShowcaseBlock(title, badge, variant, articles, moreLabel, onMoreClick) {
    if (!articles || articles.length === 0) return null;
    const block = document.createElement('section');
    block.className = `showcase-block ${variant || ''}`;
    block.innerHTML = `
      <div class="showcase-header">
        <div class="showcase-title-group">
          <span class="showcase-badge">${escapeHtml(badge)}</span>
          <h3 class="showcase-title">${escapeHtml(title)}</h3>
        </div>
        <button type="button" class="btn-showcase-more">${escapeHtml(moreLabel)} &rarr;</button>
      </div>
      <div class="showcase-grid-3">
        ${articles.slice(0, 3).map(art => {
          const thumb = art.image_url || 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80';
          return `
            <div class="showcase-card" data-id="${art.id}" role="button" tabindex="0">
              <div class="showcase-card-media">
                <img src="${escapeHtml(thumb)}" alt="${escapeHtml(art.title)}" class="showcase-card-img" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80'">
              </div>
              <div class="showcase-card-body">
                <div class="showcase-card-meta">
                  <span style="font-weight: 700; color: #E5C07B;">${escapeHtml(art.source)}</span>
                  <span>${formatRelativeTime(art.published_at)}</span>
                </div>
                <h4 class="showcase-card-title">${escapeHtml(art.title)}</h4>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    block.querySelectorAll('.showcase-card').forEach(card => {
      card.addEventListener('click', () => {
        openReader(card.dataset.id);
      });
    });

    const moreBtn = block.querySelector('.btn-showcase-more');
    if (moreBtn && onMoreClick) {
      moreBtn.addEventListener('click', onMoreClick);
    }

    return block;
  }

  // Helper for Pattern B: Wide Split Feature Card
  function createFeatureSplitCard(art) {
    if (!art) return null;
    const card = document.createElement('article');
    card.className = 'feature-split-card';
    card.dataset.id = art.id;

    const thumb = art.image_url || 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80';
    const sentimentClass = (art.sentiment || 'NEUTRAL').toLowerCase();
    const tickersHtml = (art.tickers || []).map(t => `<span class="ticker-mini-tag">${escapeHtml(t)}</span>`).join('');

    card.innerHTML = `
      <div class="feature-split-media">
        <img src="${escapeHtml(thumb)}" alt="${escapeHtml(art.title)}" class="feature-split-img" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80'">
      </div>
      <div class="feature-split-content">
        <div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span class="news-source-tag">${escapeHtml(art.source)}</span>
            <span class="sentiment-badge ${sentimentClass}">${escapeHtml(art.sentiment || 'NEUTRAL')}</span>
          </div>
          <h3 class="feature-split-title">${escapeHtml(art.title)}</h3>
          ${art.summary ? `<p class="feature-split-desc">${escapeHtml(art.summary)}</p>` : ''}
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--color-text-muted);">
          <div class="ticker-mini-pills">${tickersHtml}</div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span>${estimateReadTime(art.summary)}</span>
            <span>&bull;</span>
            <time>${formatRelativeTime(art.published_at)}</time>
          </div>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      openReader(art.id);
    });

    return card;
  }

  // Helper for Pattern C: Market Insight Duo Callout
  function createInsightCalloutBlock(quoteText, miniArticles) {
    if (!miniArticles || miniArticles.length < 2) return null;
    const block = document.createElement('section');
    block.className = 'insight-callout-block';

    block.innerHTML = `
      <div class="insight-quote-side">
        <div>
          <span class="insight-badge">Sorotan Analis &amp; Redaksi</span>
          <p class="insight-quote-text">"${escapeHtml(quoteText)}"</p>
        </div>
        <div style="font-size: 11px; color: #E5C07B; margin-top: 14px;">
          Emitara Market Research &bull; Sentimen Pasar
        </div>
      </div>
      <div class="insight-cards-side">
        ${miniArticles.slice(0, 2).map(art => `
          <div class="insight-mini-card" data-id="${art.id}" role="button" tabindex="0">
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: var(--color-oatmeal); margin-bottom: 4px;">
              <span style="font-weight: 700; color: #E5C07B;">${escapeHtml(art.source)}</span>
              <span>${formatRelativeTime(art.published_at)}</span>
            </div>
            <h4 class="insight-mini-title">${escapeHtml(art.title)}</h4>
          </div>
        `).join('')}
      </div>
    `;

    block.querySelectorAll('.insight-mini-card').forEach(card => {
      card.addEventListener('click', () => {
        openReader(card.dataset.id);
      });
    });

    return block;
  }

  // Helper for Pattern D: Asymmetric Duo Block
  function createAsymmetricDuoBlock(artMajor, artMinor) {
    if (!artMajor || !artMinor) return null;
    const block = document.createElement('section');
    block.className = 'asymmetric-duo-block';

    const thumbMajor = artMajor.image_url || 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80';
    const sentimentMajor = (artMajor.sentiment || 'NEUTRAL').toLowerCase();

    block.innerHTML = `
      <article class="duo-card-major" data-id="${artMajor.id}">
        <div class="duo-major-media">
          <img src="${escapeHtml(thumbMajor)}" alt="${escapeHtml(artMajor.title)}" class="showcase-card-img" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80'">
        </div>
        <div style="padding: 16px 18px; display: flex; flex-direction: column; justify-content: space-between; flex: 1; gap: 8px;">
          <div>
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; margin-bottom: 6px;">
              <span class="news-source-tag">${escapeHtml(artMajor.source)}</span>
              <span class="sentiment-badge ${sentimentMajor}">${escapeHtml(artMajor.sentiment || 'NEUTRAL')}</span>
            </div>
            <h3 class="news-title" style="font-size: 1.15rem; margin-bottom: 6px;">${escapeHtml(artMajor.title)}</h3>
          </div>
          <div style="font-size: 11px; color: var(--color-text-muted); display: flex; justify-content: space-between;">
            <span>${estimateReadTime(artMajor.summary)}</span>
            <time>${formatRelativeTime(artMajor.published_at)}</time>
          </div>
        </div>
      </article>

      <article class="duo-card-minor" data-id="${artMinor.id}">
        <div>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; margin-bottom: 8px;">
            <span style="font-weight: 700; color: #E5C07B;">${escapeHtml(artMinor.source)}</span>
            <span style="font-size: 10px; color: var(--color-oatmeal);">${formatRelativeTime(artMinor.published_at)}</span>
          </div>
          <h3 style="font-family: var(--font-serif); font-size: 1.1rem; line-height: 1.35; color: #FFFFFF; margin-bottom: 8px;">
            ${escapeHtml(artMinor.title)}
          </h3>
          ${artMinor.summary ? `<p style="font-size: 12px; color: var(--color-oatmeal); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(artMinor.summary)}</p>` : ''}
        </div>
        <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
          <span style="color: #E5C07B; font-weight: 700;">Baca Naskah &rarr;</span>
          <span style="color: var(--color-oatmeal);">${estimateReadTime(artMinor.summary)}</span>
        </div>
      </article>
    `;

    block.querySelectorAll('article').forEach(card => {
      card.addEventListener('click', () => {
        openReader(card.dataset.id);
      });
    });

    return block;
  }

  function renderPortal(scrollToTop = false) {
    const filtered = state.articles.filter(passesFilter);
    feedCounter.textContent = `${filtered.length} Warta`;

    if (filtered.length === 0) {
      heroContainer.innerHTML = '';
      
      let emptyTitle = 'Tidak ada warta yang sesuai';
      let emptyDesc = 'Silakan atur ulang kata kunci atau pilih rubrik lain.';
      let emptyBtn = 'Tampilkan Semua Warta';

      if (state.viewMode === 'BOOKMARKS') {
        emptyTitle = 'Belum Ada Warta Tersimpan';
        emptyDesc = 'Klik ikon pita bookmark pada kartu berita mana saja untuk menyimpannya ke daftar baca ini.';
        emptyBtn = 'Kembali ke Semua Warta';
      } else if (state.viewMode === 'WATCHLIST') {
        emptyTitle = 'Belum Ada Warta untuk Watchlist';
        emptyDesc = state.watchlist.length > 0 
          ? `Belum ada warta terbaru untuk emiten pantauan (${state.watchlist.join(', ')}). Coba tambahkan emiten lain.`
          : 'Watchlist masih kosong. Tambahkan kode saham di bilah samping.';
        emptyBtn = 'Tampilkan Semua Warta';
      }

      newsList.innerHTML = `
        <div class="state-box-editorial">
          <h3 class="state-title-editorial">${emptyTitle}</h3>
          <p class="state-desc-editorial">${emptyDesc}</p>
          <button type="button" class="btn-editorial-action" id="btnResetFilter" style="cursor: pointer;">${emptyBtn}</button>
        </div>
      `;
      if (scrollToTop) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    // 1. Render Hero Story (First item)
    const hero = filtered[0];
    const heroImg = hero.image_url || 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80';
    const heroTickers = (hero.tickers || []).map(t => `<span class="ticker-mini-tag">${escapeHtml(t)}</span>`).join('');

    heroContainer.innerHTML = `
      <article class="hero-card" data-id="${hero.id}">
        <div class="hero-media">
          <img src="${escapeHtml(heroImg)}" alt="${escapeHtml(hero.title)}" class="hero-img" loading="eager" onerror="this.src='https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80'">
          <div class="hero-overlay">
            <div class="hero-meta-row">
              <span class="hero-badge-tag">${escapeHtml(hero.source)}</span>
              <span class="hero-read-time">${estimateReadTime(hero.summary)}</span>
              <span style="font-size: 11px;">${formatRelativeTime(hero.published_at)}</span>
            </div>
            <h2 class="hero-title">${escapeHtml(hero.title)}</h2>
            ${hero.summary ? `<p class="hero-summary">${escapeHtml(hero.summary)}</p>` : ''}
            <div class="hero-footer-row">
              <div class="ticker-mini-pills">${heroTickers}</div>
              <span style="font-weight: 700; color: #E1D4C2;">Baca Selengkapnya &rarr;</span>
            </div>
          </div>
        </div>
      </article>
    `;

    heroContainer.querySelector('.hero-card').addEventListener('click', () => {
      openReader(hero.id);
    });

    // 2. Render List News (Remaining items)
    newsList.innerHTML = '';
    const listItems = filtered.slice(1);
    
    const canInjectBlocks = state.viewMode === 'ALL' && state.activeCategory === 'ALL' && !state.searchQuery && !state.activeTicker && state.activeSentiment === 'ALL';
    
    // Quotes for Pattern C insights
    const insightQuotes = [
      "Likuiditas pasar modal Indonesia mencerminkan resiliensi kuat di tengah dinamika suku bunga dan fluktuasi komoditas global.",
      "Aksi korporasi emiten berkapitalisasi besar menjadi penopang utama keyakinan investor institusi di lantai bursa.",
      "Diversifikasi portofolio ke sektor energi terbarukan dan konsumer defensif menjadi strategi kunci pelaku pasar saat ini."
    ];

    listItems.forEach((item, index) => {
      // Rotate 4 distinct layout patterns consistently every 5 cards!
      if (canInjectBlocks) {
        const cycle = index % 20;

        // Pattern A: Themed 3-Column Showcase at index 4, 24, 44, 64...
        if (cycle === 4) {
          const shownIds = new Set(listItems.slice(0, index).map(a => a.id));
          const freshTopic = state.articles.filter(a => !shownIds.has(a.id) && /energi|tambang|batu bara|minyak|gas|emas|nikel|ptba|adaro|antam|bren|esdm/i.test(`${a.title} ${a.summary || ''}`));
          if (freshTopic.length >= 3) {
            const block = createShowcaseBlock(
              'Sorotan Sektor: Energi & Komoditas',
              'Sektor BEI',
              'variant-chestnut',
              freshTopic,
              'Lihat Sektor Energi',
              () => {
                state.activeCategory = 'Energi';
                updateTabStyles();
                renderPortal();
              }
            );
            if (block) newsList.appendChild(block);
          }
        }
        // Pattern B: Wide Split Feature Card at index 9, 29, 49, 69...
        else if (cycle === 9) {
          const shownIds = new Set(listItems.slice(0, index).map(a => a.id));
          const splitCandidate = state.articles.find(a => !shownIds.has(a.id) && a.image_url && a.summary);
          if (splitCandidate) {
            const splitCard = createFeatureSplitCard(splitCandidate);
            if (splitCard) newsList.appendChild(splitCard);
          }
        }
        // Pattern C: Market Insight Duo Callout at index 14, 34, 54, 74...
        else if (cycle === 14) {
          const shownIds = new Set(listItems.slice(0, index).map(a => a.id));
          const miniCandidates = state.articles.filter(a => !shownIds.has(a.id));
          if (miniCandidates.length >= 2) {
            const quoteIdx = Math.floor(index / 20) % insightQuotes.length;
            const insightBlock = createInsightCalloutBlock(insightQuotes[quoteIdx], miniCandidates);
            if (insightBlock) newsList.appendChild(insightBlock);
          }
        }
        // Pattern D: Asymmetric Duo Block at index 19, 39, 59, 79...
        else if (cycle === 19) {
          const shownIds = new Set(listItems.slice(0, index).map(a => a.id));
          const duoCandidates = state.articles.filter(a => !shownIds.has(a.id));
          if (duoCandidates.length >= 2) {
            const duoBlock = createAsymmetricDuoBlock(duoCandidates[0], duoCandidates[1]);
            if (duoBlock) newsList.appendChild(duoBlock);
          }
        }
      }

      const row = document.createElement('article');
      row.className = 'news-row-card';
      row.dataset.id = item.id;
      
      const thumb = item.image_url || 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=400&q=80';
      const sentimentClass = (item.sentiment || 'NEUTRAL').toLowerCase();
      const tickersHtml = (item.tickers || []).map(t => `<span class="ticker-mini-tag">${escapeHtml(t)}</span>`).join('');
      const isBookmarked = state.bookmarks.some(b => b.id === item.id);

      row.innerHTML = `
        <div class="news-info" style="flex: 1; min-width: 0;">
          <div class="news-top-line" style="margin-bottom: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="news-source-tag">${escapeHtml(item.source)}</span>
              <span class="sentiment-badge ${sentimentClass}">${escapeHtml(item.sentiment || 'NEUTRAL')}</span>
            </div>
            <button type="button" class="btn-card-bookmark ${isBookmarked ? 'bookmarked' : ''}" data-id="${item.id}" aria-label="Simpan warta" title="Simpan ke daftar baca">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="${isBookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
              </svg>
            </button>
          </div>
          <h3 class="news-title" style="margin-bottom: 8px;">${escapeHtml(item.title)}</h3>
          <div class="news-bottom-line">
            <div class="ticker-mini-pills">${tickersHtml}</div>
            <div style="display: flex; align-items: center; gap: 6px; font-size: 11px;">
              <span>${estimateReadTime(item.summary)}</span>
              <span>&bull;</span>
              <time datetime="${escapeHtml(item.published_at)}">${formatRelativeTime(item.published_at)}</time>
            </div>
          </div>
        </div>
        <div class="thumb-wrapper">
          <img src="${escapeHtml(thumb)}" alt="${escapeHtml(item.title)}" class="thumb-img" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=400&q=80'">
        </div>
      `;

      row.addEventListener('click', (e) => {
        if (e.target.closest('.btn-card-bookmark')) return;
        openReader(item.id);
      });

      const btnBm = row.querySelector('.btn-card-bookmark');
      btnBm.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleBookmark(item);
        btnBm.classList.toggle('bookmarked');
        const icon = btnBm.querySelector('svg');
        const currentlyBookmarked = state.bookmarks.some(b => b.id === item.id);
        icon.setAttribute('fill', currentlyBookmarked ? 'currentColor' : 'none');
      });

      newsList.appendChild(row);
    });

    if (scrollToTop) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Open Full-Content In-App Reader
  async function openReader(articleId) {
    const readerTitle = document.getElementById('readerTitle');
    const readerMeta = document.getElementById('readerMeta');
    const readerAuthor = document.getElementById('readerAuthor');
    const readerMedia = document.getElementById('readerMedia');
    const readerBody = document.getElementById('readerBody');
    const readerTickers = document.getElementById('readerTickers');
    const readerRelated = document.getElementById('readerRelated');

    readerOverlay.classList.add('open');
    window.location.hash = `#/berita/${articleId}`;
    document.body.style.overflow = 'hidden';

    // Loading indicator inside reader
    readerTitle.textContent = 'Memuat naskah berita...';
    readerBody.innerHTML = '<p style="color: var(--color-text-muted);">Menyiapkan teks artikel lengkap dari redaksi...</p>';
    readerMedia.innerHTML = '';
    readerTickers.innerHTML = '';
    readerRelated.innerHTML = '';

    try {
      const res = await fetch(`/api/news/${articleId}`);
      if (!res.ok) throw new Error('Gagal memuat artikel');
      const json = await res.json();
      const article = json.data;

      readerTitle.textContent = article.title;
      readerMeta.innerHTML = `
        <span class="hero-badge-tag">${escapeHtml(article.source)}</span>
        <span style="font-family: var(--font-mono); font-size: 11px; color: var(--color-text-muted);">
          ${formatRelativeTime(article.published_at)} &bull; ${estimateReadTime(article.content_text)}
        </span>
      `;

      const authorName = article.author || 'Tim Redaksi';
      const initial = authorName.charAt(0).toUpperCase();
      readerAuthor.innerHTML = `
        <div class="author-info">
          <div class="author-avatar">${initial}</div>
          <div>
            <div style="font-weight: 700; color: var(--color-primary);">${escapeHtml(authorName)}</div>
            <div style="font-size: 11px; color: var(--color-text-muted);">Kanal ${escapeHtml(article.source)}</div>
          </div>
        </div>
        <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer" class="btn-editorial-action" style="font-size: 11px;">
          Tautan Asli &nearr;
        </a>
      `;

      if (article.image_url) {
        readerMedia.innerHTML = `
          <div class="reader-lead-media">
            <img src="${escapeHtml(article.image_url)}" alt="${escapeHtml(article.title)}" class="reader-lead-img">
          </div>
        `;
      } else {
        readerMedia.innerHTML = '';
      }

      // Format Paragraphs
      let paragraphs = [];
      if (article.content_text && article.content_text.length > 50) {
        paragraphs = article.content_text.split('\n\n').filter(p => p.trim().length > 0);
      } else if (article.summary) {
        paragraphs = [article.summary];
      }

      if (paragraphs.length > 0) {
        readerBody.innerHTML = paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('');
      } else {
        readerBody.innerHTML = `<p>${escapeHtml(article.summary || 'Artikel tidak memuat naskah tambahan.')}</p>`;
      }

      // Tickers
      if (article.tickers && article.tickers.length > 0) {
        readerTickers.innerHTML = `
          <span style="font-size: 12px; font-weight: 700; color: var(--color-primary);">Emiten Terkait:</span>
          ${article.tickers.map(t => `<button type="button" class="btn-editorial-action btn-filter-ticker" data-ticker="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')}
        `;
        readerTickers.querySelectorAll('.btn-filter-ticker').forEach(btn => {
          btn.addEventListener('click', () => {
            const t = btn.dataset.ticker;
            closeReader();
            state.activeTicker = t;
            renderPortal();
          });
        });
      }

      // Related Stories
      if (article.related_articles && article.related_articles.length > 0) {
        readerRelated.innerHTML = `
          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--color-border);">
            <h4 style="font-family: var(--font-serif); font-size: 1.1rem; margin-bottom: 12px;">Warta Terkait</h4>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${article.related_articles.map(rel => `
                <div class="trending-row rel-click" data-id="${rel.id}" style="cursor: pointer;">
                  <span style="font-weight: 600; font-size: 12px;">${escapeHtml(rel.title)}</span>
                  <span style="font-size: 10px; color: var(--color-chestnut);">${escapeHtml(rel.source)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
        readerRelated.querySelectorAll('.rel-click').forEach(r => {
          r.addEventListener('click', () => {
            openReader(r.dataset.id);
          });
        });
      }

    } catch (err) {
      readerTitle.textContent = 'Gagal memuat artikel';
      readerBody.innerHTML = `<p style="color: var(--color-bearish-text);">${escapeHtml(err.message)}</p>`;
    }
  }

  function closeReader() {
    readerOverlay.classList.remove('open');
    history.pushState('', document.title, window.location.pathname + window.location.search);
    document.body.style.overflow = '';
  }

  // Load News from API with Pagination (Load More)
  const btnLoadMore = document.getElementById('btnLoadMore');
  const loadMoreContainer = document.getElementById('loadMoreContainer');
  let currentOffset = 0;
  const pageSize = 50;

  async function loadNews(append = false) {
    if (!append) {
      currentOffset = 0;
    }

    try {
      if (btnLoadMore && append) {
        btnLoadMore.textContent = 'Memuat Warta...';
        btnLoadMore.disabled = true;
      }

      const res = await fetch(`/api/news?limit=${pageSize}&offset=${currentOffset}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const newBatch = json.data || [];
      const totalAvailable = json.total_available || 0;

      if (append) {
        newBatch.forEach(item => {
          if (!state.seenGuids.has(item.guid_hash)) {
            state.seenGuids.add(item.guid_hash);
            state.articles.push(item);
          }
        });
      } else {
        state.articles = newBatch;
        state.seenGuids.clear();
        state.articles.forEach(a => state.seenGuids.add(a.guid_hash));
      }

      renderPortal();
      updateSentimentBarometer();
      if (!append) checkUrlHash();

      // Update Load More button state
      if (btnLoadMore && loadMoreContainer) {
        btnLoadMore.textContent = 'Muat Lebih Banyak Warta';
        btnLoadMore.disabled = false;
        if (state.articles.length >= totalAvailable || newBatch.length < pageSize) {
          loadMoreContainer.style.display = 'none';
        } else {
          loadMoreContainer.style.display = 'block';
        }
      }
    } catch (e) {
      console.error('Fetch news error:', e);
      if (btnLoadMore) {
        btnLoadMore.textContent = 'Coba Muat Lagi';
        btnLoadMore.disabled = false;
      }
    }
  }

  if (btnLoadMore) {
    btnLoadMore.addEventListener('click', () => {
      currentOffset += pageSize;
      loadNews(true);
    });
  }

  // Load Trending Tickers
  async function loadTrending() {
    try {
      const res = await fetch('/api/trending?limit=8');
      if (!res.ok) return;
      const json = await res.json();
      const list = json.data || [];
      if (list.length === 0) {
        trendingList.innerHTML = '<span style="font-size: 12px; color: var(--color-text-muted);">Belum ada data mention</span>';
        return;
      }
      trendingList.innerHTML = list.map(item => `
        <div class="trending-row" data-ticker="${escapeHtml(item.ticker)}" tabindex="0">
          <span class="trending-code">${escapeHtml(item.ticker)}</span>
          <span class="trending-badge">${escapeHtml(String(item.count))}x Warta</span>
        </div>
      `).join('');

      trendingList.querySelectorAll('.trending-row').forEach(row => {
        row.addEventListener('click', () => {
          state.activeTicker = row.dataset.ticker;
          renderPortal(true);
        });
      });
    } catch (e) {
      console.warn('Load trending failed:', e);
    }
  }

  // Connect SSE
  function connectSSE() {
    if (state.eventSource) state.eventSource.close();
    state.eventSource = new EventSource('/api/news/stream');

    state.eventSource.onopen = () => {
      if (statusText) statusText.textContent = 'IDX Terhubung';
      if (statusDot) statusDot.classList.remove('disconnected');
    };

    state.eventSource.onmessage = (event) => {
      if (!event.data) return;
      try {
        const article = JSON.parse(event.data);
        if (state.seenGuids.has(article.guid_hash)) return;

        state.seenGuids.add(article.guid_hash);
        state.articles.unshift(article);

        renderPortal();
        window.audioAlert.playPing(920, 0.12);
      } catch (e) {
        console.warn('SSE parse error:', e);
      }
    };

    state.eventSource.onerror = () => {
      if (statusText) statusText.textContent = 'Menghubungkan...';
      if (statusDot) statusDot.classList.add('disconnected');
    };
  }

  
  // Reset all filters and view mode
  function resetAllFilters() {
    state.viewMode = 'ALL';
    state.activeCategory = 'ALL';
    state.activeTicker = null;
    state.activeSentiment = 'ALL';
    state.searchQuery = '';
    if (searchInput) searchInput.value = '';
    updateTabStyles();
    if (typeof updateViewModeButtons === 'function') updateViewModeButtons();
    if (sentimentToggleBtns) {
      sentimentToggleBtns.forEach(b => {
        b.classList.toggle('active', b.dataset.sentiment === 'ALL');
        b.classList.remove('bullish-active', 'bearish-active');
      });
    }
    renderPortal(true);
  }

  // Event delegation on newsList for reset button click
  if (newsList) {
    newsList.addEventListener('click', (e) => {
      const resetBtn = e.target.closest('#btnResetFilter');
      if (resetBtn) {
        e.preventDefault();
        e.stopPropagation();
        resetAllFilters();
      }
    });
  }

  function updateTabStyles() {
    categoryPills.forEach(pill => {
      const cat = pill.dataset.category;
      if (cat === state.activeCategory) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });
  }

  // Listeners
  categoryPills.forEach(pill => {
    pill.addEventListener('click', () => {
      state.activeCategory = pill.dataset.category;
      updateTabStyles();
      renderPortal(true);
    });
  });

  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim();
    renderPortal(true);
  });

  btnCloseReader.addEventListener('click', closeReader);
  readerOverlay.addEventListener('click', (e) => {
    if (e.target === readerOverlay) closeReader();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && readerOverlay.classList.contains('open')) {
      closeReader();
    }
  });

  // Audio Toggle
  btnAudio.addEventListener('click', () => {
    const enabled = window.audioAlert.toggle();
    btnAudio.classList.toggle('active', enabled);
  });
  if (window.audioAlert.enabled) {
    btnAudio.classList.add('active');
  }

  // Manual Refresh
  btnRefresh.addEventListener('click', async () => {
    btnRefresh.textContent = 'Sinkronisasi...';
    btnRefresh.disabled = true;
    try {
      await fetch('/api/refresh', { method: 'POST' });
      await 
  // Hash routing for deep-linking
  function checkUrlHash() {
    const hash = window.location.hash;
    if (hash === '#/menu') { openMegaMenu(); }
    if (hash && hash.startsWith('#/berita/')) {
      const id = parseInt(hash.replace('#/berita/', ''), 10);
      if (!isNaN(id)) {
        openReader(id);
      }
    }
  }

  window.addEventListener('hashchange', checkUrlHash);

  
  // Live Market Quotes via Yahoo Finance API
  async function loadLiveMarketQuotes() {
    const tickerMove = document.getElementById('tickerMove');
    if (!tickerMove) return;

    try {
      const res = await fetch('/api/market/ticker');
      if (!res.ok) return;
      const json = await res.json();
      const quotes = json.data || [];
      if (quotes.length === 0) return;

      const itemsHtml = quotes.map(q => {
        let changeClass = '';
        if (q.is_up) changeClass = 'ticker-up';
        else if (q.is_down) changeClass = 'ticker-down';
        else changeClass = 'ticker-neutral';

        return `<span class="ticker-item"><span class="ticker-sym">${escapeHtml(q.symbol)}</span> <span class="ticker-price">${escapeHtml(q.price)}</span> <span class="${changeClass}">${escapeHtml(q.change_pct)}</span></span>`;
      }).join('');

      tickerMove.innerHTML = `
        <div class="ticker-group">
          ${itemsHtml}
        </div>
        <div class="ticker-group" aria-hidden="true">
          ${itemsHtml}
        </div>
      `;

      // Also populate the Bloomberg Mega Menu Top Securities grid!
      const megaGrid = document.getElementById('megaSecuritiesGrid');
      if (megaGrid) {
        megaGrid.innerHTML = quotes.slice(0, 9).map(q => {
          let changeColor = '#A78D78';
          if (q.is_up) changeColor = '#6EE7B7';
          else if (q.is_down) changeColor = '#FCA5A5';

          return `
            <div class="mega-tile" data-ticker="${escapeHtml(q.symbol)}" tabindex="0" role="button" aria-label="Lihat warta ${escapeHtml(q.symbol)}">
              <span class="mega-tile-sym">${escapeHtml(q.symbol)}</span>
              <div class="mega-tile-price-row">
                <span class="mega-tile-price">${escapeHtml(q.price)}</span>
                <span style="color: ${changeColor}; font-weight: 700;">${escapeHtml(q.change_pct)}</span>
              </div>
            </div>
          `;
        }).join('');

        megaGrid.querySelectorAll('.mega-tile').forEach(tile => {
          tile.addEventListener('click', () => {
            const sym = tile.dataset.ticker;
            closeMegaMenu();
            state.activeTicker = sym === 'IHSG' ? null : sym;
            state.viewMode = 'ALL';
            renderPortal();
          });
        });
      }
    } catch (e) {
      console.warn('Failed to load live market quotes:', e);
    }
  }

  loadLiveMarketQuotes();
  setInterval(loadLiveMarketQuotes, 45000);
  loadNews();
      await loadTrending();
    } finally {
      btnRefresh.textContent = 'Sinkronkan';
      btnRefresh.disabled = false;
    }
  });

  // Init
  
  // Hash routing for deep-linking
  function checkUrlHash() {
    const hash = window.location.hash;
    if (hash === '#/menu') { openMegaMenu(); }
    if (hash && hash.startsWith('#/berita/')) {
      const id = parseInt(hash.replace('#/berita/', ''), 10);
      if (!isNaN(id)) {
        openReader(id);
      }
    }
  }

  window.addEventListener('hashchange', checkUrlHash);

  
  // Live Market Quotes via Yahoo Finance API
  async function loadLiveMarketQuotes() {
    const tickerMove = document.getElementById('tickerMove');
    if (!tickerMove) return;

    try {
      const res = await fetch('/api/market/ticker');
      if (!res.ok) return;
      const json = await res.json();
      const quotes = json.data || [];
      if (quotes.length === 0) return;

      const itemsHtml = quotes.map(q => {
        let changeClass = '';
        if (q.is_up) changeClass = 'ticker-up';
        else if (q.is_down) changeClass = 'ticker-down';
        else changeClass = 'ticker-neutral';

        return `<span class="ticker-item"><span class="ticker-sym">${escapeHtml(q.symbol)}</span> <span class="ticker-price">${escapeHtml(q.price)}</span> <span class="${changeClass}">${escapeHtml(q.change_pct)}</span></span>`;
      }).join('');

      tickerMove.innerHTML = `
        <div class="ticker-group">
          ${itemsHtml}
        </div>
        <div class="ticker-group" aria-hidden="true">
          ${itemsHtml}
        </div>
      `;

      // Also populate the Bloomberg Mega Menu Top Securities grid!
      const megaGrid = document.getElementById('megaSecuritiesGrid');
      if (megaGrid) {
        megaGrid.innerHTML = quotes.slice(0, 9).map(q => {
          let changeColor = '#A78D78';
          if (q.is_up) changeColor = '#6EE7B7';
          else if (q.is_down) changeColor = '#FCA5A5';

          return `
            <div class="mega-tile" data-ticker="${escapeHtml(q.symbol)}" tabindex="0" role="button" aria-label="Lihat warta ${escapeHtml(q.symbol)}">
              <span class="mega-tile-sym">${escapeHtml(q.symbol)}</span>
              <div class="mega-tile-price-row">
                <span class="mega-tile-price">${escapeHtml(q.price)}</span>
                <span style="color: ${changeColor}; font-weight: 700;">${escapeHtml(q.change_pct)}</span>
              </div>
            </div>
          `;
        }).join('');

        megaGrid.querySelectorAll('.mega-tile').forEach(tile => {
          tile.addEventListener('click', () => {
            const sym = tile.dataset.ticker;
            closeMegaMenu();
            state.activeTicker = sym === 'IHSG' ? null : sym;
            state.viewMode = 'ALL';
            renderPortal();
          });
        });
      }
    } catch (e) {
      console.warn('Failed to load live market quotes:', e);
    }
  }

  loadLiveMarketQuotes();
  setInterval(loadLiveMarketQuotes, 45000);
  loadNews();
  loadTrending();
  connectSSE();

  // Watchlist & Bookmark Badge Updaters
  const watchlistCountEl = document.getElementById('watchlistCount');
  // bookmarkCountEl already declared above
  const btnWatchlistTab = document.getElementById('btnWatchlistTab');
  const btnBookmarksTab = document.getElementById('btnBookmarksTab');
  const btnFilterWatchlist = document.getElementById('btnFilterWatchlist');
  const watchlistChipsContainer = document.getElementById('watchlistChips');
  const watchlistInput = document.getElementById('watchlistInput');
  const btnAddWatchlist = document.getElementById('btnAddWatchlist');
  const sentimentToggleBtns = document.querySelectorAll('.sentiment-toggle-btn');

  function updateBadgeCounts() {
    if (watchlistCountEl) watchlistCountEl.textContent = state.watchlist.length;
    if (bookmarkCountEl) bookmarkCountEl.textContent = state.bookmarks.length;
  }

  function renderWatchlistChips() {
    if (!watchlistChipsContainer) return;
    if (state.watchlist.length === 0) {
      watchlistChipsContainer.innerHTML = '<span style="font-size: 11px; color: var(--color-text-muted);">Belum ada emiten dipantau.</span>';
      return;
    }
    watchlistChipsContainer.innerHTML = state.watchlist.map(ticker => `
      <span class="watchlist-chip" data-ticker="${escapeHtml(ticker)}">
        <span>${escapeHtml(ticker)}</span>
        <span class="watchlist-chip-remove" data-remove="${escapeHtml(ticker)}" title="Hapus dari watchlist">&times;</span>
      </span>
    `).join('');

    watchlistChipsContainer.querySelectorAll('.watchlist-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        if (e.target.classList.contains('watchlist-chip-remove')) return;
        state.activeTicker = chip.dataset.ticker;
        state.viewMode = 'ALL';
        updateViewModeButtons();
        renderPortal();
      });
    });

    watchlistChipsContainer.querySelectorAll('.watchlist-chip-remove').forEach(rm => {
      rm.addEventListener('click', (e) => {
        e.stopPropagation();
        removeWatchlistTicker(rm.dataset.remove);
      });
    });
  }

  function addWatchlistTicker(ticker) {
    if (!ticker) return;
    const clean = ticker.trim().toUpperCase();
    if (clean.length >= 2 && !state.watchlist.includes(clean)) {
      state.watchlist.push(clean);
      localStorage.setItem('emitara_watchlist', JSON.stringify(state.watchlist));
      updateBadgeCounts();
      renderWatchlistChips();
      if (state.viewMode === 'WATCHLIST') renderPortal();
    }
  }

  function removeWatchlistTicker(ticker) {
    state.watchlist = state.watchlist.filter(t => t !== ticker);
    localStorage.setItem('emitara_watchlist', JSON.stringify(state.watchlist));
    updateBadgeCounts();
    renderWatchlistChips();
    if (state.viewMode === 'WATCHLIST') renderPortal(true);
  }

  function updateViewModeButtons() {
    if (btnWatchlistTab) btnWatchlistTab.classList.toggle('active', state.viewMode === 'WATCHLIST');
    if (btnBookmarksTab) btnBookmarksTab.classList.toggle('active', state.viewMode === 'BOOKMARKS');
    if (btnFilterWatchlist) btnFilterWatchlist.classList.toggle('active', state.viewMode === 'WATCHLIST');
  }

  // Sentiment Toggles
  sentimentToggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sentimentToggleBtns.forEach(b => b.classList.remove('active', 'bullish-active', 'bearish-active'));
      const sent = btn.dataset.sentiment;
      state.activeSentiment = sent;
      btn.classList.add('active');
      if (sent === 'BULLISH') btn.classList.add('bullish-active');
      if (sent === 'BEARISH') btn.classList.add('bearish-active');
      renderPortal(true);
    });
  });

  // Watchlist Input
  if (btnAddWatchlist && watchlistInput) {
    btnAddWatchlist.addEventListener('click', () => {
      addWatchlistTicker(watchlistInput.value);
      watchlistInput.value = '';
    });
    watchlistInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addWatchlistTicker(watchlistInput.value);
        watchlistInput.value = '';
      }
    });
  }

  // Suggestion Pills
  document.querySelectorAll('.btn-suggest-ticker').forEach(btn => {
    btn.addEventListener('click', () => {
      addWatchlistTicker(btn.dataset.ticker);
    });
  });

  // Tab buttons
  if (btnWatchlistTab) {
    btnWatchlistTab.addEventListener('click', () => {
      state.viewMode = state.viewMode === 'WATCHLIST' ? 'ALL' : 'WATCHLIST';
      state.activeTicker = null;
      updateViewModeButtons();
      renderPortal(true);
    });
  }

  if (btnFilterWatchlist) {
    btnFilterWatchlist.addEventListener('click', () => {
      state.viewMode = state.viewMode === 'WATCHLIST' ? 'ALL' : 'WATCHLIST';
      state.activeTicker = null;
      updateViewModeButtons();
      renderPortal(true);
    });
  }

  if (btnBookmarksTab) {
    btnBookmarksTab.addEventListener('click', () => {
      state.viewMode = state.viewMode === 'BOOKMARKS' ? 'ALL' : 'BOOKMARKS';
      state.activeTicker = null;
      updateViewModeButtons();
      renderPortal(true);
    });
  }

  // Update badge count when bookmark toggled
  const origToggleBookmark = toggleBookmark;
  toggleBookmark = function(item) {
    origToggleBookmark(item);
    updateBadgeCounts();
    if (state.viewMode === 'BOOKMARKS') renderPortal(true);
  };

  // Init features
  updateBadgeCounts();
  renderWatchlistChips();


  // Bloomberg-Style Markets Mega Menu Logic
  const btnToggleMarketsMenu = document.getElementById('btnToggleMarketsMenu');
  const megaMenuMarkets = document.getElementById('megaMenuMarkets');
  const btnOpenWatchlistFromMega = document.getElementById('btnOpenWatchlistFromMega');

  function openMegaMenu() {
    if (!megaMenuMarkets) return;
    megaMenuMarkets.classList.add('open');
    if (btnToggleMarketsMenu) {
      btnToggleMarketsMenu.setAttribute('aria-expanded', 'true');
      btnToggleMarketsMenu.classList.add('active');
    }
  }

  function closeMegaMenu() {
    if (!megaMenuMarkets) return;
    megaMenuMarkets.classList.remove('open');
    if (btnToggleMarketsMenu) {
      btnToggleMarketsMenu.setAttribute('aria-expanded', 'false');
      btnToggleMarketsMenu.classList.remove('active');
    }
  }

  function toggleMegaMenu() {
    if (!megaMenuMarkets) return;
    if (megaMenuMarkets.classList.contains('open')) {
      closeMegaMenu();
    } else {
      openMegaMenu();
    }
  }

  if (btnToggleMarketsMenu) {
    btnToggleMarketsMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMegaMenu();
    });
  }

  // Close mega menu on outside click
  document.addEventListener('click', (e) => {
    if (megaMenuMarkets && megaMenuMarkets.classList.contains('open')) {
      if (!megaMenuMarkets.contains(e.target) && e.target !== btnToggleMarketsMenu && !btnToggleMarketsMenu.contains(e.target)) {
        closeMegaMenu();
      }
    }
  });

  // Close on Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && megaMenuMarkets && megaMenuMarkets.classList.contains('open')) {
      closeMegaMenu();
    }
  });

  // Mega Menu Links
  if (megaMenuMarkets) {
    megaMenuMarkets.querySelectorAll('.mega-nav-link').forEach(link => {
      link.addEventListener('click', () => {
        closeMegaMenu();
        if (link.dataset.category) {
          state.activeCategory = link.dataset.category;
          state.viewMode = 'ALL';
          state.activeTicker = null;
          updateTabStyles();
          renderPortal();
        } else if (link.dataset.search) {
          state.searchQuery = link.dataset.search;
          if (searchInput) searchInput.value = link.dataset.search;
          state.viewMode = 'ALL';
          renderPortal();
        }
      });
    });
  }

  if (btnOpenWatchlistFromMega) {
    btnOpenWatchlistFromMega.addEventListener('click', () => {
      closeMegaMenu();
      state.viewMode = 'WATCHLIST';
      updateViewModeButtons();
      renderPortal();
    });
  }


  // Sentiment Barometer Calculator & Filter
  function updateSentimentBarometer() {
    if (!state.articles || state.articles.length === 0) return;
    const total = state.articles.length;
    let bullishCount = 0;
    let bearishCount = 0;
    let neutralCount = 0;

    state.articles.forEach(a => {
      const s = (a.sentiment || 'NEUTRAL').toUpperCase();
      if (s === 'BULLISH') bullishCount++;
      else if (s === 'BEARISH') bearishCount++;
      else neutralCount++;
    });

    const pctBull = Math.round((bullishCount / total) * 100);
    const pctBear = Math.round((bearishCount / total) * 100);
    const pctNeut = 100 - pctBull - pctBear;

    const baroBull = document.getElementById('baroBullish');
    const baroNeut = document.getElementById('baroNeutral');
    const baroBear = document.getElementById('baroBearish');
    const txtBull = document.getElementById('pctBullish');
    const txtNeut = document.getElementById('pctNeutral');
    const txtBear = document.getElementById('pctBearish');

    if (baroBull) baroBull.style.width = `${pctBull}%`;
    if (baroNeut) baroNeut.style.width = `${pctNeut}%`;
    if (baroBear) baroBear.style.width = `${pctBear}%`;
    if (txtBull) txtBull.textContent = `${pctBull}%`;
    if (txtNeut) txtNeut.textContent = `${pctNeut}%`;
    if (txtBear) txtBear.textContent = `${pctBear}%`;
  }

  // Legend clicks filter sentiment
  const legBull = document.getElementById('legendBullish');
  const legNeut = document.getElementById('legendNeutral');
  const legBear = document.getElementById('legendBearish');

  if (legBull) {
    legBull.addEventListener('click', () => {
      state.activeSentiment = 'BULLISH';
      sentimentToggleBtns.forEach(b => {
        b.classList.toggle('active', b.dataset.sentiment === 'BULLISH');
        b.classList.toggle('bullish-active', b.dataset.sentiment === 'BULLISH');
      });
      renderPortal();
    });
  }

  if (legNeut) {
    legNeut.addEventListener('click', () => {
      state.activeSentiment = 'NEUTRAL';
      sentimentToggleBtns.forEach(b => {
        b.classList.toggle('active', b.dataset.sentiment === 'NEUTRAL');
      });
      renderPortal();
    });
  }

  if (legBear) {
    legBear.addEventListener('click', () => {
      state.activeSentiment = 'BEARISH';
      sentimentToggleBtns.forEach(b => {
        b.classList.toggle('active', b.dataset.sentiment === 'BEARISH');
        b.classList.toggle('bearish-active', b.dataset.sentiment === 'BEARISH');
      });
      renderPortal();
    });
  }

  // Corporate Calendar clicks
  document.querySelectorAll('.calendar-event-item').forEach(item => {
    item.addEventListener('click', () => {
      if (item.dataset.ticker) {
        state.activeTicker = item.dataset.ticker;
        state.viewMode = 'ALL';
        renderPortal();
      } else if (item.dataset.search) {
        state.searchQuery = item.dataset.search;
        if (searchInput) searchInput.value = item.dataset.search;
        state.viewMode = 'ALL';
        renderPortal();
      }
    });
  });

  // Sector table clicks
  document.querySelectorAll('.sector-row').forEach(row => {
    row.addEventListener('click', () => {
      if (row.dataset.category) {
        state.activeCategory = row.dataset.category;
        state.viewMode = 'ALL';
        state.activeTicker = null;
        updateTabStyles();
        renderPortal();
      } else if (row.dataset.search) {
        state.searchQuery = row.dataset.search;
        if (searchInput) searchInput.value = row.dataset.search;
        state.viewMode = 'ALL';
        renderPortal();
      }
    });
  });

})();
