// Emitara Media Flow Controller
(function() {
  const state = {
    articles: [],
    seenGuids: new Set(),
    activeCategory: 'ALL',
    activeSentiment: 'ALL',
    activeTicker: null,
    searchQuery: '',
    viewMode: 'ALL', // 'ALL' | 'AUDIO' | 'WATCHLIST' | 'BOOKMARKS'
    watchlist: JSON.parse(localStorage.getItem('emitara_watchlist') || '["BBCA", "BMRI", "TLKM"]'),
    bookmarks: JSON.parse(localStorage.getItem('emitara_bookmarks') || '[]'),
    eventSource: null,
    currentOffset: 0,
    pageSize: 50,
    // Speech synthesis state
    speakingArticle: null,
    synthUtterance: null,
    isAudioPlaying: false
  };

  // DOM Elements
  // Bloomberg Packages Container initialized dynamically
  const newsList = document.getElementById('newsList');
  const feedCounter = document.getElementById('feedCounter');
  const feedSectionTitle = document.getElementById('feedSectionTitle');
  const searchInput = document.getElementById('searchInput');
  const catPills = document.querySelectorAll('.cat-pill');
  const sentimentBtns = document.querySelectorAll('.sentiment-btn-clean');
  const btnLoadMore = document.getElementById('btnLoadMore');
  const loadMoreContainer = document.getElementById('loadMoreContainer');
  
  // Header and Action Controls
  const btnWatchlistTab = document.getElementById('btnWatchlistTab');
  const btnBookmarksTab = document.getElementById('btnBookmarksTab');
  const btnAudio = document.getElementById('btnAudio');
  const btnRefresh = document.getElementById('btnRefresh');
  const watchlistCountEl = document.getElementById('watchlistCount');
  const bookmarkCountEl = document.getElementById('bookmarkCount');
  const activeFilterPillContainer = document.getElementById('activeFilterPillContainer');
  const btnFilterWatchlist = document.getElementById('btnFilterWatchlist');

  // Reader Modal Controls
  const readerOverlay = document.getElementById('readerOverlay');
  const btnCloseReader = document.getElementById('btnCloseReader');
  const readerTitle = document.getElementById('readerTitle');
  const readerMeta = document.getElementById('readerMeta');
  const readerAuthor = document.getElementById('readerAuthor');
  const readerMedia = document.getElementById('readerMedia');
  const readerBody = document.getElementById('readerBody');
  const readerTickers = document.getElementById('readerTickers');
  const readerRelated = document.getElementById('readerRelated');

  // Mobile Dock Buttons
  const dockBtnHome = document.getElementById('dockBtnHome');
  const dockBtnMarkets = document.getElementById('dockBtnMarkets');
  const dockBtnWatchlist = document.getElementById('dockBtnWatchlist');
  const dockBtnSaved = document.getElementById('dockBtnSaved');

  // Helpers
    // Curated rotating financial photography for articles lacking an official image
  const curatedStockImages = [
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80', // trading monitors
    'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=800&q=80', // financial charts desk
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80', // financial skyscraper
    'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=800&q=80', // money / bank currency
    'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80', // corporate executive
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80', // logistics port trade
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80', // corporate meeting
    'https://images.unsplash.com/photo-1535320903710-d993d3d77d29?auto=format&fit=crop&w=800&q=80'  // stock exchange board
  ];

  const seenImagesInSession = new Set();

    function getFallbackImage(seed = 0) {
    return curatedStockImages[Math.abs(seed) % curatedStockImages.length];
  }

  function getArticleImage(item, idx = 0) {
    // Check if item has a unique real news photo (not generic stock candlestick)
    const raw = item && item.image_url ? item.image_url : '';
    const isGeneric = !raw || 
      raw.includes('placeholder') || 
      raw.includes('default') || 
      raw.includes('6c8cb0b4') || // Detik's repeated default chart
      raw.includes('grafik') || 
      seenImagesInSession.has(raw);

    if (!isGeneric && raw.startsWith('http')) {
      seenImagesInSession.add(raw);
      return raw;
    }

    // Assign strictly rotating high-resolution broadsheet photo
    return curatedStockImages[Math.abs(idx) % curatedStockImages.length];
  }

  function formatRelativeTime(isoString) {
    if (!isoString) return '';
    try {
      const pubDate = new Date(isoString);
      const now = new Date();
      const diffSec = Math.floor((now - pubDate) / 1000);
      if (diffSec < 60) return 'Baru saja';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin} mnt lalu`;
      const diffHour = Math.floor(diffMin / 60);
      if (diffHour < 24) return `${diffHour} jam lalu`;
      const diffDay = Math.floor(diffHour / 24);
      return `${diffDay} hari lalu`;
    } catch (e) {
      return isoString;
    }
  }

    function cleanHeadline(title) {
    if (!title) return '';
    let t = title.replace(/<[^>]*>?/gm, ' ');
    t = t
      .replace(/&nbsp;/g, ' ')
      .replace(/\u00a0/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    t = t.replace(/^(?:Wow|Cek|Yuk|Simak|Waduh|Hore|Duh|Ternyata|Gokil|Heboh|Astaga)!\s*/i, '');
    t = t.replace(/\s+/g, ' ');
    return t.replace(/^[\s\u200B\u00A0]+/, '').trim();
  }

  function escapeHtml(str) {
    if (!str) return '';
    let clean = cleanHeadline(str);
    return clean
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function estimateReadTime(text) {
    if (!text) return '2 mnt baca';
    const words = text.split(/\s+/).length;
    const mins = Math.max(1, Math.round(words / 150));
    return `${mins} mnt`;
  }

  function estimateAudioDuration(text) {
    if (!text) return '01:30';
    const words = text.split(/\s+/).length;
    const totalSecs = Math.max(45, Math.round((words / 120) * 60));
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // Filter checker
  function passesFilter(item) {
    if (state.viewMode === 'WATCHLIST') {
      const tickers = (Array.isArray(item.tickers) ? item.tickers : []).map(t => (t || '').toUpperCase());
      const watchSet = state.watchlist.map(t => (t || '').toUpperCase());
      if (!tickers.some(t => watchSet.includes(t))) return false;
    } else if (state.viewMode === 'BOOKMARKS') {
      if (!state.bookmarks.some(b => b.id === item.id)) return false;
    }

    if (state.activeTicker) {
      const tickers = (Array.isArray(item.tickers) ? item.tickers : []).map(t => (t || '').toUpperCase());
      if (!tickers.includes(state.activeTicker.toUpperCase())) return false;
    }

    if (state.activeSentiment !== 'ALL') {
      if ((item.sentiment || '').toUpperCase() !== state.activeSentiment) return false;
    }

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

    // Filter out consumer discount promos to keep institutional market tone
    if (/transmart|full day sale|promo diskon|voucher belanja|katalog promo/i.test(item.title)) {
      return false;
    }

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      const text = `${item.title} ${item.summary || ''} ${item.content_text || ''} ${item.source} ${(item.tickers || []).join(' ')}`.toLowerCase();
      if (!text.includes(q)) {
        const tickers = Array.isArray(item.tickers) ? item.tickers : [];
        if (!tickers.some(t => t.toLowerCase().includes(q))) return false;
      }
    }

    return true;
  }

    // Compute real market impact and hotness score for an article
  function computeHotScore(art) {
    if (!art) return 0;
    let score = 0;
    const text = `${art.title} ${art.summary || ''}`.toLowerCase();

    // 1. High-impact equity keywords
    const hotKeywords = [
      'laba', 'dividen', 'akuisisi', 'buyback', 'rekor', 'merger', 'suspensi',
      'borong saham', 'investor asing', 'net buy', 'terbang', 'melonjak',
      'gagal bayar', 'anomali', 'msci', 'ipo', 'bursa', 'kinerja'
    ];
    hotKeywords.forEach(kw => {
      if (text.includes(kw)) score += 15;
    });

    // 2. High-volume market driver tickers
    const tickers = Array.isArray(art.tickers) ? art.tickers : [];
    score += tickers.length * 10;
    tickers.forEach(t => {
      if (['BBCA', 'BBRI', 'BMRI', 'BREN', 'TLKM', 'BYAN', 'AMMN', 'ASII', 'CUAN'].includes(t)) {
        score += 25;
      }
    });

    // 3. Image availability bonus
    if (art.image_url && art.image_url.startsWith('http')) {
      score += 10;
    }

    return score;
  }

  // Render Bloomberg Asia Editorial Packages (Hot Lead Story + 3-Up Matrix + Text Dispatches)
  function renderBloombergAsiaPackages(items) {
    const container = document.getElementById('bloombergPackagesContainer');
    if (!container) return new Set();

    if (state.viewMode !== 'ALL' || state.activeCategory !== 'ALL' || state.searchQuery || state.activeTicker || state.activeSentiment !== 'ALL') {
      container.style.display = 'none';
      return new Set();
    }

    if (items.length < 4) {
      container.style.display = 'none';
      return new Set();
    }

    container.style.display = 'block';

    // Rank top 25 newest items by real market hotness score
    const hotPool = items.slice(0, 25).map(art => ({
      art,
      score: computeHotScore(art)
    }));
    hotPool.sort((a, b) => b.score - a.score);

    const usedIds = new Set();

    // 1. Hot Lead Story (Highest scoring market mover)
    const lead = hotPool[0].art;
    usedIds.add(lead.id);

    const leadImg = getArticleImage(lead, 0);
    const leadTickers = (lead.tickers || []).map(t => `<span style="font-family: var(--font-mono); font-size: 10px; font-weight: 700; padding: 2px 6px; background-color: var(--color-surface-subtle); border-radius: var(--radius-xs);">${escapeHtml(t)}</span>`).join('');

    const leadHtml = `
      <article class="bloomberg-lead-package" data-id="${lead.id}">
        <div class="lead-text-side">
          <div>
            <div class="lead-kicker"><span style="color: #B91C1C; font-weight: 800;">HOT TOPIC</span> &bull; ${escapeHtml(lead.source)}</div>
            <h1 class="lead-headline">${escapeHtml(lead.title)}</h1>
            ${lead.summary ? `<p class="lead-summary">${escapeHtml(lead.summary)}</p>` : ''}
          </div>
          <div>
            <div style="display: flex; gap: 4px; margin-bottom: 10px; flex-wrap: wrap;">${leadTickers}</div>
            <div class="lead-byline-row">
              <span>Oleh: <strong style="color: var(--color-text-primary);">${escapeHtml(lead.author || 'Tim Redaksi')}</strong></span>
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-family: var(--font-mono);">${formatRelativeTime(lead.published_at)}</span>
                <span style="font-weight: 700; color: var(--color-black);">Baca Naskah &rarr;</span>
              </div>
            </div>
          </div>
        </div>
        <div class="lead-media-side">
          <img src="${escapeHtml(leadImg)}" alt="${escapeHtml(lead.title)}" class="lead-media-img" loading="eager" onerror="this.onerror=null; this.src='${getFallbackImage(lead.id || 1)}';">
        </div>
      </article>
    `;

    // 2. 3-Up Matrix (Next 3 highest scoring articles)
    const remainingHot = hotPool.filter(h => !usedIds.has(h.art.id));
    const matrixStories = remainingHot.slice(0, 3).map(h => h.art);
    matrixStories.forEach(s => usedIds.add(s.id));

    const kickers3Up = ['The Big Take', 'Analisis Pasar', 'Aksi Emiten'];
    const matrixHtml = `
      <div class="matrix-3up-grid">
        ${matrixStories.map((story, i) => {
          const thumb = getArticleImage(story, i + 2);
          return `
            <article class="matrix-card" data-id="${story.id}">
              <div class="matrix-media">
                <img src="${escapeHtml(thumb)}" alt="${escapeHtml(story.title)}" class="matrix-media-img" loading="lazy" onerror="this.onerror=null; this.src='${getFallbackImage(story.id || i + 3)}';">
              </div>
              <div class="matrix-kicker">${kickers3Up[i % kickers3Up.length]} &bull; ${escapeHtml(story.source)}</div>
              <h3 class="matrix-headline">${escapeHtml(story.title)}</h3>
              <div class="matrix-meta">
                <span>${estimateReadTime(story.summary)}</span>
                <span style="font-family: var(--font-mono);">${formatRelativeTime(story.published_at)}</span>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;

    // 3. Text Dispatch Triad (Next 3 high-density text stories)
    const remainingDispatches = remainingHot.filter(h => !usedIds.has(h.art.id));
    const dispatchStories = remainingDispatches.slice(0, 3).map(h => h.art);
    dispatchStories.forEach(s => usedIds.add(s.id));

    const kickersDispatch = ['Dispatch Khusus', 'Laporan Finansial', 'Opini Analis'];
    const dispatchHtml = dispatchStories.length >= 2 ? `
      <div class="dispatch-text-grid">
        ${dispatchStories.map((dStory, i) => `
          <div class="dispatch-col" data-id="${dStory.id}">
            <div class="dispatch-kicker">${kickersDispatch[i % kickersDispatch.length]}</div>
            <h4 class="dispatch-headline">${escapeHtml(dStory.title)}</h4>
            ${dStory.summary ? `<p class="dispatch-excerpt">${escapeHtml(dStory.summary)}</p>` : ''}
            <div style="font-size: 11px; font-family: var(--font-mono); color: var(--color-text-muted); margin-top: 6px;">
              ${escapeHtml(dStory.source)} &bull; ${formatRelativeTime(dStory.published_at)}
            </div>
          </div>
        `).join('')}
      </div>
    ` : '';

    container.innerHTML = leadHtml + matrixHtml + dispatchHtml;

    container.querySelectorAll('article, .dispatch-col').forEach(card => {
      card.addEventListener('click', () => {
        openReader(card.dataset.id);
      });
    });

    return usedIds;
  }

  // Render Portal Stream with Continuous Rotating Layout Rhythm (Never Monotonous Down to Bottom)
  function renderPortal(scrollToTop = false) {
    seenImagesInSession.clear();
    const filtered = state.articles.filter(passesFilter);
    feedCounter.textContent = `${filtered.length} Warta`;

    // Active Filter Badges Container
    if (activeFilterPillContainer) {
      let badgesHtml = '';
      if (state.searchQuery) {
        badgesHtml += `
          <span class="active-filter-badge">
            <span>Cari: "${escapeHtml(state.searchQuery)}"</span>
            <button type="button" class="btn-clear-active-badge" id="btnClearSearchPill" aria-label="Hapus kata kunci">&times;</button>
          </span>
        `;
      }
      if (state.activeTicker) {
        badgesHtml += `
          <span class="active-filter-badge">
            <span>Emiten: ${escapeHtml(state.activeTicker)}</span>
            <button type="button" class="btn-clear-active-badge" id="btnClearTickerPill" aria-label="Hapus filter emiten">&times;</button>
          </span>
        `;
      }
      if (state.viewMode === 'WATCHLIST') {
        badgesHtml += `
          <button type="button" class="btn-header-clean" id="btnClearModePill" aria-label="Kembali ke semua warta" style="font-size: 11px; padding: 2px 10px; border-radius: var(--radius-pill); background: var(--color-surface-subtle); color: var(--color-text-secondary); border: 1px solid var(--color-border); cursor: pointer;">
            &larr; Kembali ke Semua Warta
          </button>
        `;
      } else if (state.viewMode === 'BOOKMARKS') {
        badgesHtml += `
          <button type="button" class="btn-header-clean" id="btnClearModePill" aria-label="Kembali ke semua warta" style="font-size: 11px; padding: 2px 10px; border-radius: var(--radius-pill); background: var(--color-surface-subtle); color: var(--color-text-secondary); border: 1px solid var(--color-border); cursor: pointer;">
            &larr; Kembali ke Semua Warta
          </button>
        `;
      }
      activeFilterPillContainer.innerHTML = badgesHtml;

      const btnClearSearch = document.getElementById('btnClearSearchPill');
      if (btnClearSearch) {
        btnClearSearch.addEventListener('click', () => {
          state.searchQuery = '';
          if (searchInput) searchInput.value = '';
          loadNews(false);
        });
      }

      const btnClearTicker = document.getElementById('btnClearTickerPill');
      if (btnClearTicker) {
        btnClearTicker.addEventListener('click', () => {
          state.activeTicker = null;
          loadNews(false);
        });
      }

      const btnClearMode = document.getElementById('btnClearModePill');
      if (btnClearMode) {
        btnClearMode.addEventListener('click', () => {
          state.viewMode = 'ALL';
          updateModeButtons();
          loadNews(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }
    }

    if (feedSectionTitle) {
      if (state.viewMode === 'WATCHLIST') feedSectionTitle.textContent = 'Warta Watchlist Saham Anda';
      else if (state.viewMode === 'BOOKMARKS') feedSectionTitle.textContent = 'Warta Tersimpan';
      else feedSectionTitle.textContent = 'Aliran Warta Pasar';
    }

    // Empty state
    if (filtered.length === 0) {
      const packageContainer = document.getElementById('bloombergPackagesContainer');
      if (packageContainer) packageContainer.style.display = 'none';

      newsList.innerHTML = `
        <div style="padding: 48px 24px; text-align: center; background-color: var(--color-surface-subtle); border: 1px solid var(--color-border); border-radius: var(--radius-lg); margin: 20px 0;">
          <h3 style="font-family: var(--font-serif); font-size: 1.25rem; font-weight: 700; margin-bottom: 8px;">Tidak ada warta yang sesuai</h3>
          <p style="font-size: 13px; color: var(--color-text-muted); margin-bottom: 16px;">Silakan atur ulang kata kunci atau kembali ke semua warta.</p>
          <button type="button" class="btn-header-clean" id="btnResetFilter" style="background-color: var(--color-black); color: #FFFFFF;">Tampilkan Semua Warta</button>
        </div>
      `;
      if (scrollToTop) window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Render Bloomberg Asia Lead & Top Packages
    const usedInPackages = renderBloombergAsiaPackages(filtered);
    const packageActive = usedInPackages.size > 0;

    // Filter out articles already used in the top packages to guarantee zero duplication!
    const availablePool = packageActive ? filtered.filter(a => !usedInPackages.has(a.id)) : filtered;

    newsList.innerHTML = '';

    // Register stories consumed by special interspersed layout modules
    const consumedInModules = new Set();

    availablePool.forEach((item, index) => {
      if (consumedInModules.has(item.id)) return;

      // CONTINUOUS ROTATING EDITORIAL RHYTHM (Breaks monotony all the way down)
      if (packageActive) {
        const cycle = index % 18;

        // 1. Themed 3-Up Matrix at index 5, 23, 41, 59...
        if (cycle === 5) {
          const fresh3 = availablePool.slice(index, index + 8).filter(a => !consumedInModules.has(a.id)).slice(0, 3);
          if (fresh3.length === 3) {
            fresh3.forEach(f => consumedInModules.add(f.id));
            const matrixBlock = document.createElement('section');
            matrixBlock.className = 'matrix-3up-grid';
            matrixBlock.style.margin = '24px 0';
            matrixBlock.innerHTML = fresh3.map((s, i) => `
              <article class="matrix-card" data-id="${s.id}">
                <div class="matrix-media">
                  <img src="${escapeHtml(getArticleImage(s, index + i))}" alt="${escapeHtml(s.title)}" class="matrix-media-img" loading="lazy" onerror="this.onerror=null; this.src='${getFallbackImage(index + i)}';">
                </div>
                <div class="matrix-kicker">Sorotan Sektor &bull; ${escapeHtml(s.source)}</div>
                <h3 class="matrix-headline">${escapeHtml(s.title)}</h3>
                <div class="matrix-meta">
                  <span>${estimateReadTime(s.summary)}</span>
                  <span style="font-family: var(--font-mono);">${formatRelativeTime(s.published_at)}</span>
                </div>
              </article>
            `).join('');

            matrixBlock.querySelectorAll('.matrix-card').forEach(c => {
              c.addEventListener('click', () => openReader(c.dataset.id));
            });
            newsList.appendChild(matrixBlock);
          }
        }

        // 2. Wide Split Package at index 11, 29, 47, 65...
        else if (cycle === 11) {
          const splitCandidate = availablePool.slice(index, index + 6).find(a => !consumedInModules.has(a.id) && a.summary);
          if (splitCandidate) {
            consumedInModules.add(splitCandidate.id);
            const splitCard = document.createElement('article');
            splitCard.className = 'wide-split-package';
            splitCard.dataset.id = splitCandidate.id;
            const splitImg = getArticleImage(splitCandidate, index + 5);

            splitCard.innerHTML = `
              <div class="wide-split-media">
                <img src="${escapeHtml(splitImg)}" alt="${escapeHtml(splitCandidate.title)}" class="wide-split-img" loading="lazy" onerror="this.onerror=null; this.src='${getFallbackImage(index + 5)}';">
              </div>
              <div class="wide-split-content">
                <div>
                  <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-secondary); margin-bottom: 6px;">
                    Laporan Mendalam &bull; ${escapeHtml(splitCandidate.source)}
                  </div>
                  <h3 class="wide-split-title">${escapeHtml(splitCandidate.title)}</h3>
                  <p class="wide-split-desc">${escapeHtml(splitCandidate.summary)}</p>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--color-text-muted);">
                  <span>${estimateReadTime(splitCandidate.summary)}</span>
                  <span style="font-weight: 700; color: var(--color-black);">Baca Naskah &rarr;</span>
                </div>
              </div>
            `;
            splitCard.addEventListener('click', () => openReader(splitCandidate.id));
            newsList.appendChild(splitCard);
          }
        }

        // 3. Dark Intelligence Breakout at index 17, 35, 53, 71...
        else if (cycle === 17) {
          const darkMain = availablePool.slice(index, index + 6).find(a => !consumedInModules.has(a.id) && a.summary);
          const darkSides = availablePool.slice(index, index + 8).filter(a => a.id !== (darkMain ? darkMain.id : null) && !consumedInModules.has(a.id)).slice(0, 2);

          if (darkMain && darkSides.length === 2) {
            consumedInModules.add(darkMain.id);
            darkSides.forEach(s => consumedInModules.add(s.id));

            const darkModule = document.createElement('section');
            darkModule.className = 'dark-breakout-module';
            darkModule.innerHTML = `
              <div class="breakout-featured" data-id="${darkMain.id}">
                <div>
                  <div class="breakout-kicker">Market Intelligence &bull; ${escapeHtml(darkMain.source)}</div>
                  <h2 class="breakout-title">${escapeHtml(darkMain.title)}</h2>
                  <p class="breakout-desc">${escapeHtml(darkMain.summary)}</p>
                </div>
                <div class="breakout-footer-row">
                  <span>${estimateReadTime(darkMain.summary)}</span>
                  <span class="breakout-cta">Pelajari Riset &rarr;</span>
                </div>
              </div>
              <div class="breakout-side-stack">
                ${darkSides.map(ds => `
                  <div class="breakout-mini-item" data-id="${ds.id}">
                    <div class="breakout-mini-meta">${escapeHtml(ds.source)} &bull; ${formatRelativeTime(ds.published_at)}</div>
                    <h4 class="breakout-mini-title">${escapeHtml(ds.title)}</h4>
                  </div>
                `).join('')}
              </div>
            `;
            darkModule.querySelectorAll('[data-id]').forEach(el => {
              el.addEventListener('click', () => openReader(el.dataset.id));
            });
            newsList.appendChild(darkModule);
          }
        }
      }

      if (consumedInModules.has(item.id)) return;

      // Standard 2-Column Wire Row Card
      const row = document.createElement('article');
      row.className = 'article-flow-item';
      row.dataset.id = item.id;

      const thumb = getArticleImage(item, index + 4);
      const tickersHtml = (item.tickers || []).slice(0, 3).map(t => `<span style="font-family: var(--font-mono); font-size: 10px; font-weight: 700; padding: 2px 6px; background-color: var(--color-surface-subtle); border-radius: var(--radius-xs); color: var(--color-text-primary);">${escapeHtml(t)}</span>`).join('');
      const isBookmarked = state.bookmarks.some(b => b.id === item.id);

      row.innerHTML = `
        <div class="flow-thumb-container">
          <img src="${escapeHtml(thumb)}" alt="${escapeHtml(item.title)}" class="flow-thumb-img" loading="lazy" onerror="this.onerror=null; this.src='${getFallbackImage(index + 3)}';">
        </div>
        <div class="flow-content-side">
          <div class="flow-top-meta">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="flow-source-badge">${escapeHtml(item.source)}</span>
              <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: var(--radius-pill); background-color: ${item.sentiment === 'BULLISH' ? 'var(--color-bullish-bg)' : item.sentiment === 'BEARISH' ? 'var(--color-bearish-bg)' : 'var(--color-surface-subtle)'}; color: ${item.sentiment === 'BULLISH' ? 'var(--color-bullish-text)' : item.sentiment === 'BEARISH' ? 'var(--color-bearish-text)' : 'var(--color-text-muted)'};">${escapeHtml(item.sentiment || 'NEUTRAL')}</span>
            </div>
            <button type="button" class="btn-flow-bookmark ${isBookmarked ? 'bookmarked' : ''}" data-id="${item.id}" aria-label="Simpan warta" title="Simpan ke daftar baca">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="${isBookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
            </button>
          </div>
          <h3 class="flow-title">${escapeHtml(item.title)}</h3>
          <div class="flow-bottom-meta">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              ${tickersHtml}
              <span style="font-size: 11px; color: var(--color-text-muted);">&bull;</span>
              <span style="font-size: 11px; color: var(--color-text-muted);">${estimateReadTime(item.summary)}</span>
            </div>
            <time style="font-family: var(--font-mono); font-size: 11px;">${formatRelativeTime(item.published_at)}</time>
          </div>
        </div>
      `;

      row.addEventListener('click', (e) => {
        if (e.target.closest('.btn-flow-bookmark')) return;
        openReader(item.id);
      });

      const btnBm = row.querySelector('.btn-flow-bookmark');
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


  // Reader Modal Logic
    function renderArticleInModal(article, isFallback = false) {
    if (!article) return;
    readerTitle.textContent = article.title || 'Warta Pasar Modal';
    readerMeta.innerHTML = `
      <span style="font-weight: 700; text-transform: uppercase; font-size: 11px;">${escapeHtml(article.source || 'Emitara')}</span>
      <span style="font-family: var(--font-mono); font-size: 11px; color: var(--color-text-muted);">&bull; ${formatRelativeTime(article.published_at)} &bull; ${estimateReadTime(article.content_text || article.summary)}</span>
    `;

    const authorName = article.author || 'Tim Redaksi';
    readerAuthor.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--color-text-muted);">
        <span>Oleh: <strong style="color: var(--color-text-primary);">${escapeHtml(authorName)}</strong></span>
        ${article.url ? `<a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer" style="color: var(--color-text-primary); text-decoration: underline;">Tautan Asli &nearr;</a>` : ''}
      </div>
    `;

    // Share Button Handler
    const btnShareReader = document.getElementById('btnShareReader');
    if (btnShareReader) {
      btnShareReader.onclick = async () => {
        const shareUrl = `https://emitara.web.id/berita/${article.id}`;
        if (navigator.share) {
          try {
            await navigator.share({
              title: `${article.title} - Emitara`,
              text: article.summary || article.title,
              url: shareUrl
            });
          } catch (err) {}
        } else {
          try {
            await navigator.clipboard.writeText(shareUrl);
            const origHtml = btnShareReader.innerHTML;
            btnShareReader.innerHTML = `<span>&check; Tautan Disalin!</span>`;
            setTimeout(() => { btnShareReader.innerHTML = origHtml; }, 2500);
          } catch (e) {
            prompt('Salin tautan warta ini:', shareUrl);
          }
        }
      };
    }

    // TradingView Stock Chart & Market Radar
    const readerMarketRadar = document.getElementById('readerMarketRadar');
    if (readerMarketRadar) {
      const tickers = Array.isArray(article.tickers) ? article.tickers : [];
      if (tickers.length > 0) {
        let activeTicker = tickers[0];

        const injectTV = (t) => {
          const chartWrap = document.getElementById('radarChartWrap');
          if (!chartWrap) return;
          chartWrap.innerHTML = '';
          
          const widgetBox = document.createElement('div');
          widgetBox.className = 'tradingview-widget-container';
          widgetBox.style.height = '100%';
          widgetBox.style.width = '100%';

          const innerWidget = document.createElement('div');
          innerWidget.className = 'tradingview-widget-container__widget';
          innerWidget.style.height = 'calc(100% - 32px)';
          innerWidget.style.width = '100%';
          widgetBox.appendChild(innerWidget);

          const script = document.createElement('script');
          script.type = 'text/javascript';
          script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
          script.async = true;
          script.innerHTML = JSON.stringify({
            "symbol": `IDX:${t}`,
            "width": "100%",
            "height": "220",
            "locale": "id",
            "dateRange": "1M",
            "colorTheme": "light",
            "isTransparent": true,
            "autosize": false,
            "largeChartUrl": ""
          });
          widgetBox.appendChild(script);
          chartWrap.appendChild(widgetBox);
        };

        readerMarketRadar.innerHTML = `
          <div class="reader-radar-card">
            <div class="reader-radar-top">
              <div class="reader-radar-title">Radar Saham BEI: IDX:${escapeHtml(activeTicker)}</div>
              ${tickers.length > 1 ? `
                <div class="radar-tabs">
                  ${tickers.map(tk => `<button type="button" class="radar-tab-btn ${tk === activeTicker ? 'active' : ''}" data-ticker="${escapeHtml(tk)}">${escapeHtml(tk)}</button>`).join('')}
                </div>
              ` : ''}
            </div>
            <div class="radar-chart-wrap" id="radarChartWrap"></div>
          </div>
        `;

        injectTV(activeTicker);

        readerMarketRadar.querySelectorAll('.radar-tab-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const newT = btn.dataset.ticker;
            readerMarketRadar.querySelectorAll('.radar-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.ticker === newT));
            const titleEl = readerMarketRadar.querySelector('.reader-radar-title');
            if (titleEl) titleEl.textContent = `Radar Saham BEI: IDX:${newT}`;
            injectTV(newT);
          });
        });
      } else {
        readerMarketRadar.innerHTML = '';
      }
    }

    if (article.image_url) {
      readerMedia.innerHTML = `<img src="${escapeHtml(article.image_url)}" alt="${escapeHtml(article.title)}" style="width: 100%; max-height: 420px; object-fit: cover; display: block;" onerror="this.onerror=null; this.src='${getFallbackImage(article.id || 1)}';">`;
    } else {
      readerMedia.innerHTML = '';
    }

    let rawText = (article.content_text && article.content_text.length > 50) ? article.content_text : (article.summary || article.title);
    let paragraphs = rawText.split('\n\n').filter(p => p.trim().length > 0);

    let htmlBody = paragraphs.map(p => {
      const cleanP = (p || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
      return cleanP ? `<p>${escapeHtml(cleanP)}</p>` : '';
    }).filter(Boolean).join('');

    if (isFallback && article.url) {
      htmlBody += `
        <div style="margin-top: 24px; padding: 14px 18px; background: var(--color-surface-subtle); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 13px; color: var(--color-text-muted); line-height: 1.5;">
          <strong style="color: var(--color-text-primary); display: block; margin-bottom: 4px;">Informasi Redaksi:</strong>
          Menampilkan ringkasan warta resmi dari feed bursa. Untuk ulasan mendalam, silakan baca artikel lengkap di 
          <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer" style="color: var(--color-text-primary); font-weight: 600; text-decoration: underline;">situs resmi penerbit (${escapeHtml(article.source || 'Media Asal')}) &nearr;</a>
        </div>
      `;
    }

    readerBody.innerHTML = htmlBody;

    if (article.tickers && article.tickers.length > 0) {
      readerTickers.innerHTML = `
        <div style="font-size: 12px; font-weight: 700; margin-bottom: 8px;">Emiten Terkait:</div>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          ${article.tickers.map(t => `<button type="button" class="btn-header-clean btn-filter-ticker" data-ticker="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')}
        </div>
      `;
      readerTickers.querySelectorAll('.btn-filter-ticker').forEach(btn => {
        btn.addEventListener('click', () => {
          closeReader();
          state.activeTicker = (btn.dataset.ticker || '').toUpperCase();
          state.viewMode = 'ALL';
          updateModeButtons();
          loadNews(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      });
    } else {
      readerTickers.innerHTML = '';
    }
  }

  async function openReader(articleId) {
    if (!readerOverlay) return;
    readerOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    window.location.hash = `#/berita/${articleId}`;

    // 1. Instant Cache Render: Check if article is already in loaded state
    const cached = state.articles.find(a => String(a.id) === String(articleId));
    if (cached) {
      renderArticleInModal(cached, false);
    } else {
      readerTitle.textContent = 'Memuat naskah berita...';
      readerMeta.innerHTML = '';
      readerAuthor.innerHTML = '';
      readerMedia.innerHTML = '';
      readerTickers.innerHTML = '';
      readerRelated.innerHTML = '';
      readerBody.innerHTML = '<p style="color: var(--color-text-muted);">Menyiapkan teks artikel lengkap dari redaksi...</p>';
      const radarInit = document.getElementById('readerMarketRadar');
      if (radarInit) radarInit.innerHTML = '';
    }

    // 2. Fetch full article data from server
    try {
      const res = await fetch(`/api/news/${articleId}`);
      if (!res.ok) {
        if (cached) {
          renderArticleInModal(cached, true);
          return;
        }
        throw new Error('Warta tidak dapat diakses saat ini');
      }
      const json = await res.json();
      const article = json.data;
      if (!article) throw new Error('Data warta kosong');
      renderArticleInModal(article, false);
    } catch (err) {
      if (cached) {
        renderArticleInModal(cached, true);
      } else {
        readerTitle.textContent = 'Warta Sedang Disiapkan';
        readerBody.innerHTML = `
          <div style="padding: 24px 0; text-align: center;">
            <p style="color: var(--color-text-muted); font-size: 14px; margin-bottom: 16px;">
              Teks warta ini sedang disinkronkan oleh sistem atau jaringan sedang sibuk.
            </p>
            <button type="button" class="btn-clean-primary" onclick="window.openReader(${articleId})" style="padding: 8px 18px; font-size: 12px; font-weight: 600; cursor: pointer;">
              &orarr; Coba Muat Ulang
            </button>
          </div>
        `;
      }
    }
  }

  // Expose to window for inline onclick handlers
  window.openReader = openReader;

  function closeReader() {
    if (!readerOverlay) return;
    readerOverlay.classList.remove('open');
    document.body.style.overflow = '';
    history.pushState('', document.title, window.location.pathname + window.location.search);
  }

  // Load News from API with Pagination
  async function loadNews(append = false) {
    if (!append) state.currentOffset = 0;

    try {
      if (btnLoadMore && append) {
        btnLoadMore.textContent = 'Memuat Warta...';
        btnLoadMore.disabled = true;
      }

      let url = `/api/news?limit=${state.pageSize}&offset=${state.currentOffset}`;
      if (state.searchQuery) url += `&q=${encodeURIComponent(state.searchQuery)}`;
      if (state.activeTicker) {
        url += `&ticker=${encodeURIComponent(state.activeTicker)}`;
      } else if (state.viewMode === 'WATCHLIST' && state.watchlist.length > 0) {
        url += `&ticker=${encodeURIComponent(state.watchlist.join(','))}`;
      }
      if (state.activeSentiment !== 'ALL') url += `&sentiment=${encodeURIComponent(state.activeSentiment)}`;
      if (state.activeCategory !== 'ALL') url += `&category=${encodeURIComponent(state.activeCategory)}`;

      const res = await fetch(url);
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

      // Always sort articles strictly by published_at DESC (newest on top)
      state.articles.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

      renderPortal();
      updateSentimentBarometer();
      if (!append) checkUrlHash();

      if (btnLoadMore && loadMoreContainer) {
        btnLoadMore.textContent = 'Muat Lebih Banyak Warta ↓';
        btnLoadMore.disabled = false;
        loadMoreContainer.style.display = (state.articles.length >= totalAvailable || newBatch.length < state.pageSize) ? 'none' : 'block';
      }
    } catch (e) {
      console.error('Fetch news error stack:', e ? (e.stack || e.message) : 'unknown');
      if (btnLoadMore) {
        btnLoadMore.textContent = 'Coba Muat Lagi';
        btnLoadMore.disabled = false;
      }
    }
  }

  // Live Market Quotes via /api/market/ticker
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
        let deltaClass = q.is_up ? 'up' : q.is_down ? 'down' : '';
        return `
          <span class="ticker-strip-item ticker-tape-click" data-ticker="${escapeHtml(q.symbol)}" role="button" tabindex="0" title="Klik untuk filter warta ${escapeHtml(q.symbol)}">
            <span class="sym">${escapeHtml(q.symbol)}</span>
            <span class="price">${escapeHtml(q.price)}</span>
            <span class="${deltaClass}">${escapeHtml(q.change_pct)}</span>
          </span>
        `;
      }).join('');

      tickerMove.innerHTML = `
        <div class="ticker-strip-group">${itemsHtml}</div>
        <div class="ticker-strip-group" aria-hidden="true">${itemsHtml}</div>
      `;

      tickerMove.querySelectorAll('.ticker-tape-click').forEach(tapeItem => {
        tapeItem.addEventListener('click', () => {
          const t = tapeItem.dataset.ticker;
          state.activeTicker = (t === 'IHSG' ? null : t.toUpperCase());
          state.viewMode = 'ALL';
          updateModeButtons();
          loadNews(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      });

      // Populate Bloomberg Mega Menu Top Securities grid
      const megaGrid = document.getElementById('megaSecuritiesGrid');
      if (megaGrid) {
        megaGrid.innerHTML = quotes.slice(0, 9).map(q => {
          let deltaColor = '#9CA3AF';
          if (q.is_up) deltaColor = '#4ADE80';
          else if (q.is_down) deltaColor = '#F87171';

          return `
            <div class="mega-stock-tile" data-ticker="${escapeHtml(q.symbol)}" tabindex="0" role="button" aria-label="Lihat warta ${escapeHtml(q.symbol)}">
              <span class="mega-stock-sym">${escapeHtml(q.symbol)}</span>
              <div class="mega-stock-meta-row">
                <span class="mega-stock-price">${escapeHtml(q.price)}</span>
                <span style="color: ${deltaColor}; font-weight: 700;">${escapeHtml(q.change_pct)}</span>
              </div>
            </div>
          `;
        }).join('');

        megaGrid.querySelectorAll('.mega-stock-tile').forEach(tile => {
          tile.addEventListener('click', () => {
            const sym = tile.dataset.ticker;
            closeMegaMenu();
            state.activeTicker = sym === 'IHSG' ? null : sym;
            state.viewMode = 'ALL';
            updateModeButtons();
            renderPortal(true);
          });
        });
      }
    } catch (e) {
      console.warn('Quotes error:', e);
    }
  }

  // Load Trending Tickers
  async function loadTrending() {
    const trendingList = document.getElementById('trendingList');
    if (!trendingList) return;
    try {
      const res = await fetch('/api/trending?limit=8');
      if (!res.ok) return;
      const json = await res.json();
      const list = json.data || [];

      if (list.length === 0) {
        trendingList.innerHTML = '<span style="font-size: 12px; color: var(--color-text-muted);">Belum ada data</span>';
        return;
      }

      trendingList.innerHTML = list.map(item => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; background-color: #FFFFFF; border: 1px solid var(--color-border); border-radius: var(--radius-sm); margin-bottom: 6px; cursor: pointer;" data-ticker="${escapeHtml(item.ticker)}" class="trending-click-row">
          <span style="font-family: var(--font-mono); font-size: 11px; font-weight: 700;">${escapeHtml(item.ticker)}</span>
          <span style="font-size: 11px; color: var(--color-text-muted);">${escapeHtml(String(item.count))}x warta</span>
        </div>
      `).join('');

      trendingList.querySelectorAll('.trending-click-row').forEach(row => {
        row.addEventListener('click', () => {
          state.activeTicker = (row.dataset.ticker || '').toUpperCase();
          state.viewMode = 'ALL';
          updateModeButtons();
          loadNews(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      });
    } catch (e) {
      console.warn('Trending error:', e);
    }
  }

  // Sentiment Barometer Calculator
  function updateSentimentBarometer() {
    if (!state.articles || state.articles.length === 0) return;
    const total = state.articles.length;
    let bCount = 0, rCount = 0, nCount = 0;

    state.articles.forEach(a => {
      const s = (a.sentiment || 'NEUTRAL').toUpperCase();
      if (s === 'BULLISH') bCount++;
      else if (s === 'BEARISH') rCount++;
      else nCount++;
    });

    const pctB = Math.round((bCount / total) * 100);
    const pctR = Math.round((rCount / total) * 100);
    const pctN = 100 - pctB - pctR;

    const barB = document.getElementById('baroBullish');
    const barN = document.getElementById('baroNeutral');
    const barR = document.getElementById('baroBearish');
    const txtB = document.getElementById('pctBullish');
    const txtN = document.getElementById('pctNeutral');
    const txtR = document.getElementById('pctBearish');

    if (barB) barB.style.width = `${pctB}%`;
    if (barN) barN.style.width = `${pctN}%`;
    if (barR) barR.style.width = `${pctR}%`;
    if (txtB) txtB.textContent = `${pctB}%`;
    if (txtN) txtN.textContent = `${pctN}%`;
    if (txtR) txtR.textContent = `${pctR}%`;
  }

  // Bookmarks Storage
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
    updateBadgeCounts();
    if (state.viewMode === 'BOOKMARKS') renderPortal();
  }

  function updateBadgeCounts() {
    if (watchlistCountEl) watchlistCountEl.textContent = state.watchlist.length;
    if (bookmarkCountEl) bookmarkCountEl.textContent = state.bookmarks.length;
  }

  function renderWatchlistChips() {
    const c = document.getElementById('watchlistChips');
    const suggestContainer = document.getElementById('suggestTickerButtons');
    if (!c) return;

    if (state.watchlist.length === 0) {
      c.innerHTML = '<span style="font-size: 11px; color: var(--color-text-muted);">Belum ada emiten dipantau.</span>';
    } else {
      c.innerHTML = state.watchlist.map(t => `
        <span class="watchlist-chip" data-ticker="${escapeHtml(t)}">
          <span>${escapeHtml(t)}</span>
          <span class="watchlist-chip-remove" data-rm="${escapeHtml(t)}" title="Hapus dari watchlist">&times;</span>
        </span>
      `).join('');

      c.querySelectorAll('.watchlist-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
          if (e.target.classList.contains('watchlist-chip-remove')) return;
          state.activeTicker = (chip.dataset.ticker || '').toUpperCase();
          state.viewMode = 'ALL';
          updateModeButtons();
          loadNews(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      });

      c.querySelectorAll('.watchlist-chip-remove').forEach(rm => {
        rm.addEventListener('click', (e) => {
          e.stopPropagation();
          state.watchlist = state.watchlist.filter(t => t !== rm.dataset.rm);
          localStorage.setItem('emitara_watchlist', JSON.stringify(state.watchlist));
          updateBadgeCounts();
          renderWatchlistChips();
          if (state.viewMode === 'WATCHLIST') loadNews(false);
        });
      });
    }

    // Dynamic suggestions (excludes already watched stocks)
    if (suggestContainer) {
      const candidates = ['BBCA', 'BBRI', 'BMRI', 'TLKM', 'ASII', 'BREN', 'AMMN', 'ANTM', 'BRIS', 'ADRO'];
      const unpicked = candidates.filter(sym => !state.watchlist.includes(sym)).slice(0, 4);
      suggestContainer.innerHTML = unpicked.map(sym => `
        <button type="button" class="btn-suggest-ticker" data-ticker="${escapeHtml(sym)}">+ ${escapeHtml(sym)}</button>
      `).join('');

      suggestContainer.querySelectorAll('.btn-suggest-ticker').forEach(btn => {
        btn.addEventListener('click', () => {
          addWatchlistTicker(btn.dataset.ticker);
        });
      });
    }
  }

  function addWatchlistTicker(ticker) {
    if (!ticker) return;
    const clean = ticker.trim().toUpperCase();
    if (clean.length >= 2 && !state.watchlist.includes(clean)) {
      state.watchlist.push(clean);
      localStorage.setItem('emitara_watchlist', JSON.stringify(state.watchlist));
      updateBadgeCounts();
      renderWatchlistChips();
      if (state.viewMode === 'WATCHLIST') loadNews(false);
    }
  }

  function updateModeButtons() {
    if (btnWatchlistTab) btnWatchlistTab.classList.toggle('active', state.viewMode === 'WATCHLIST');
    if (btnBookmarksTab) btnBookmarksTab.classList.toggle('active', state.viewMode === 'BOOKMARKS');
    if (btnFilterWatchlist) btnFilterWatchlist.classList.toggle('active', state.viewMode === 'WATCHLIST');

    if (dockBtnHome) dockBtnHome.classList.toggle('active', state.viewMode === 'ALL');
    if (dockBtnWatchlist) dockBtnWatchlist.classList.toggle('active', state.viewMode === 'WATCHLIST');
    if (dockBtnSaved) dockBtnSaved.classList.toggle('active', state.viewMode === 'BOOKMARKS');
  }

  // Hash Routing
  function checkUrlHash() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#/berita/')) {
      const id = parseInt(hash.replace('#/berita/', ''), 10);
      if (!isNaN(id)) openReader(id);
    }
  }

  // Realtime SSE Connection
  function connectSSE() {
    if (state.eventSource) state.eventSource.close();
    state.eventSource = new EventSource('/api/news/stream');

    state.eventSource.onmessage = (event) => {
      if (!event.data) return;
      try {
        const article = JSON.parse(event.data);
        if (state.seenGuids.has(article.guid_hash)) return;

        state.seenGuids.add(article.guid_hash);
        state.articles.unshift(article);
        state.articles.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

        renderPortal();
        window.audioAlert.playPing(940, 0.12);
      } catch (e) {
        console.warn('SSE parse error:', e);
      }
    };
  }

  // Event Delegation for Reset Button
  if (newsList) {
    newsList.addEventListener('click', (e) => {
      const rBtn = e.target.closest('#btnResetFilter');
      if (rBtn) {
        state.viewMode = 'ALL';
        state.activeCategory = 'ALL';
        state.activeTicker = null;
        state.activeSentiment = 'ALL';
        state.searchQuery = '';
        if (searchInput) searchInput.value = '';
        updateModeButtons();
        catPills.forEach(p => p.classList.toggle('active', p.dataset.category === 'ALL'));
        sentimentBtns.forEach(b => b.classList.toggle('active', b.dataset.sentiment === 'ALL'));
        renderPortal(true);
      }
    });
  }

  // Listeners

  if (btnWatchlistTab) {
    btnWatchlistTab.addEventListener('click', () => {
      state.viewMode = state.viewMode === 'WATCHLIST' ? 'ALL' : 'WATCHLIST';
      state.activeTicker = null;
      updateModeButtons();
      loadNews(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (btnBookmarksTab) {
    btnBookmarksTab.addEventListener('click', () => {
      state.viewMode = state.viewMode === 'BOOKMARKS' ? 'ALL' : 'BOOKMARKS';
      state.activeTicker = null;
      updateModeButtons();
      renderPortal(true);
    });
  }

  // Mobile Dock Controls
  if (dockBtnHome) dockBtnHome.addEventListener('click', () => {
    state.viewMode = 'ALL';
    state.activeTicker = null;
    state.searchQuery = '';
    if (searchInput) searchInput.value = '';
    updateModeButtons();
    loadNews(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  
  if (dockBtnWatchlist) dockBtnWatchlist.addEventListener('click', () => {
    state.viewMode = 'WATCHLIST';
    state.activeTicker = null;
    updateModeButtons();
    loadNews(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  if (dockBtnSaved) dockBtnSaved.addEventListener('click', () => { state.viewMode = 'BOOKMARKS'; updateModeButtons(); renderPortal(true); });

  // Categories & Search
  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      catPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.activeCategory = pill.dataset.category;
      state.viewMode = 'ALL';
      state.activeTicker = null;
      if (pill.dataset.category === 'ALL') {
        state.searchQuery = '';
        if (searchInput) searchInput.value = '';
      }
      updateModeButtons();
      renderPortal(true);
    });
  });

  sentimentBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sentimentBtns.forEach(b => b.classList.remove('active', 'bullish-active', 'bearish-active'));
      btn.classList.add('active');
      const sent = btn.dataset.sentiment;
      if (sent === 'BULLISH') btn.classList.add('bullish-active');
      if (sent === 'BEARISH') btn.classList.add('bearish-active');
      state.activeSentiment = sent;
      renderPortal(true);
    });
  });

  let searchDebounceTimer = null;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim();
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        loadNews(false);
      }, 350);
    });
  }

  if (btnLoadMore) {
    btnLoadMore.addEventListener('click', () => {
      state.currentOffset += state.pageSize;
      loadNews(true);
    });
  }

  // Audio Player Listeners
  
  

  // Reader Modal Listeners
  if (btnCloseReader) btnCloseReader.addEventListener('click', closeReader);
  if (readerOverlay) {
    readerOverlay.addEventListener('click', (e) => {
      if (e.target === readerOverlay) closeReader();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (readerOverlay && readerOverlay.classList.contains('open')) closeReader();
      
    }
  });

  // Watchlist Input
  const wInput = document.getElementById('watchlistInput');
  const wAdd = document.getElementById('btnAddWatchlist');
  if (wInput && wAdd) {
    wAdd.addEventListener('click', () => {
      addWatchlistTicker(wInput.value);
      wInput.value = '';
    });
    wInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addWatchlistTicker(wInput.value);
        wInput.value = '';
      }
    });
  }



  // Audio Alert Toggle
  if (btnAudio) {
    btnAudio.addEventListener('click', () => {
      const enabled = window.audioAlert.toggle();
      btnAudio.classList.toggle('active', enabled);
    });
    if (window.audioAlert.enabled) btnAudio.classList.add('active');
  }

  // Refresh Button
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      btnRefresh.textContent = 'Sinkron...';
      btnRefresh.disabled = true;
      try {
        await fetch('/api/refresh', { method: 'POST' });
        await loadNews();
        await loadTrending();
      } finally {
        btnRefresh.textContent = 'Sinkron';
        btnRefresh.disabled = false;
      }
    });
  }

  
  // Filter Watchlist button inside sidebar card
  if (btnFilterWatchlist) {
    btnFilterWatchlist.addEventListener('click', () => {
      state.viewMode = state.viewMode === 'WATCHLIST' ? 'ALL' : 'WATCHLIST';
      state.activeTicker = null;
      updateModeButtons();
      loadNews(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Sentiment Barometer Legend Click Filters
  const legBull = document.getElementById('legendBullish');
  const legNeut = document.getElementById('legendNeutral');
  const legBear = document.getElementById('legendBearish');

  if (legBull) {
    legBull.addEventListener('click', () => {
      state.activeSentiment = 'BULLISH';
      sentimentBtns.forEach(b => {
        b.classList.toggle('active', b.dataset.sentiment === 'BULLISH');
        b.classList.toggle('bullish-active', b.dataset.sentiment === 'BULLISH');
        b.classList.remove('bearish-active');
      });
      renderPortal(true);
    });
  }

  if (legNeut) {
    legNeut.addEventListener('click', () => {
      state.activeSentiment = 'NEUTRAL';
      sentimentBtns.forEach(b => {
        b.classList.toggle('active', b.dataset.sentiment === 'NEUTRAL');
        b.classList.remove('bullish-active', 'bearish-active');
      });
      renderPortal(true);
    });
  }

  if (legBear) {
    legBear.addEventListener('click', () => {
      state.activeSentiment = 'BEARISH';
      sentimentBtns.forEach(b => {
        b.classList.toggle('active', b.dataset.sentiment === 'BEARISH');
        b.classList.toggle('bearish-active', b.dataset.sentiment === 'BEARISH');
        b.classList.remove('bullish-active');
      });
      renderPortal(true);
    });
  }

  // Corporate Action Calendar Clicks
  document.querySelectorAll('.calendar-event-item').forEach(calItem => {
    calItem.addEventListener('click', () => {
      const t = calItem.dataset.ticker;
      if (t) {
        state.activeTicker = t.toUpperCase();
        state.viewMode = 'ALL';
        updateModeButtons();
        loadNews(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });

  // Mobile Dock Markets Button
  if (dockBtnMarkets) {
    dockBtnMarkets.addEventListener('click', () => {
      toggleMegaMenu();
    });
  }

  // Init
  updateBadgeCounts();
  renderWatchlistChips();
  loadLiveMarketQuotes();
  setInterval(loadLiveMarketQuotes, 45000);
  loadNews();
  loadTrending();
  setInterval(loadTrending, 60000);
  connectSSE();

  // Bloomberg-Style Markets Mega Menu Logic
  const btnMegaMenuMarkets = document.getElementById('btnMegaMenuMarkets');
  const megaMenuMarkets = document.getElementById('megaMenuMarkets');
  const btnOpenWatchlistFromMega = document.getElementById('btnOpenWatchlistFromMega');

  function openMegaMenu() {
    if (!megaMenuMarkets) return;
    megaMenuMarkets.classList.add('open');
    if (btnMegaMenuMarkets) {
      btnMegaMenuMarkets.setAttribute('aria-expanded', 'true');
      btnMegaMenuMarkets.classList.add('active');
    }
  }

  function closeMegaMenu() {
    if (!megaMenuMarkets) return;
    megaMenuMarkets.classList.remove('open');
    if (btnMegaMenuMarkets) {
      btnMegaMenuMarkets.setAttribute('aria-expanded', 'false');
      btnMegaMenuMarkets.classList.remove('active');
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

  if (btnMegaMenuMarkets) {
    btnMegaMenuMarkets.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMegaMenu();
    });
  }

  // Close mega menu on outside click
  document.addEventListener('click', (e) => {
    if (megaMenuMarkets && megaMenuMarkets.classList.contains('open')) {
      if (!megaMenuMarkets.contains(e.target) && e.target !== btnMegaMenuMarkets && !btnMegaMenuMarkets.contains(e.target)) {
        closeMegaMenu();
      }
    }
  });

  // Close on Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (megaMenuMarkets && megaMenuMarkets.classList.contains('open')) closeMegaMenu();
    }
  });

  // Mega Menu Links
  if (megaMenuMarkets) {
    megaMenuMarkets.querySelectorAll('.mega-item-link').forEach(link => {
      link.addEventListener('click', () => {
        closeMegaMenu();
        if (link.dataset.category) {
          state.activeCategory = link.dataset.category;
          state.searchQuery = '';
          if (searchInput) searchInput.value = '';
          state.viewMode = 'ALL';
          state.activeTicker = null;
          catPills.forEach(p => p.classList.toggle('active', p.dataset.category === state.activeCategory));
          updateModeButtons();
          loadNews(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (link.dataset.search) {
          state.searchQuery = link.dataset.search;
          if (searchInput) searchInput.value = link.dataset.search;
          state.activeCategory = 'ALL';
          state.viewMode = 'ALL';
          state.activeTicker = null;
          catPills.forEach(p => p.classList.toggle('active', p.dataset.category === 'ALL'));
          updateModeButtons();
          loadNews(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });

    // Top Securities cards in Mega Menu
    megaMenuMarkets.querySelectorAll('.mega-stock-card').forEach(card => {
      card.addEventListener('click', () => {
        closeMegaMenu();
        const symEl = card.querySelector('.mega-stock-sym');
        if (symEl && symEl.textContent) {
          state.activeTicker = symEl.textContent.trim().toUpperCase();
          state.searchQuery = '';
          if (searchInput) searchInput.value = '';
          state.activeCategory = 'ALL';
          state.viewMode = 'ALL';
          catPills.forEach(p => p.classList.toggle('active', p.dataset.category === 'ALL'));
          updateModeButtons();
          loadNews(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });
  }

  if (btnOpenWatchlistFromMega) {
    btnOpenWatchlistFromMega.addEventListener('click', () => {
      closeMegaMenu();
      state.viewMode = 'WATCHLIST';
      state.activeTicker = null;
      updateModeButtons();
      renderPortal(true);
    });
  }

})();
