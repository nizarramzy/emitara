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
  const highlightsSection = document.getElementById('highlightsSection');
  const highlightsCarousel = document.getElementById('highlightsCarousel');
  const newsList = document.getElementById('newsList');
  const feedCounter = document.getElementById('feedCounter');
  const feedSectionTitle = document.getElementById('feedSectionTitle');
  const searchInput = document.getElementById('searchInput');
  const catPills = document.querySelectorAll('.cat-pill');
  const sentimentBtns = document.querySelectorAll('.sentiment-btn-clean');
  const btnLoadMore = document.getElementById('btnLoadMore');
  const loadMoreContainer = document.getElementById('loadMoreContainer');
  
  // Header and Switchers
  const btnModeNews = document.getElementById('btnModeNews');
  const btnModeAudio = document.getElementById('btnModeAudio');
  const btnWatchlistTab = document.getElementById('btnWatchlistTab');
  const btnBookmarksTab = document.getElementById('btnBookmarksTab');
  const btnAudio = document.getElementById('btnAudio');
  const btnRefresh = document.getElementById('btnRefresh');
  const watchlistCountEl = document.getElementById('watchlistCount');
  const bookmarkCountEl = document.getElementById('bookmarkCount');

  // Reader Modal
  const readerOverlay = document.getElementById('readerOverlay');
  const btnCloseReader = document.getElementById('btnCloseReader');
  const btnReaderAudioPlay = document.getElementById('btnReaderAudioPlay');
  const readerTitle = document.getElementById('readerTitle');
  const readerMeta = document.getElementById('readerMeta');
  const readerAuthor = document.getElementById('readerAuthor');
  const readerMedia = document.getElementById('readerMedia');
  const readerBody = document.getElementById('readerBody');
  const readerTickers = document.getElementById('readerTickers');
  const readerRelated = document.getElementById('readerRelated');

  // Audio Player Sheet
  const audioPlayerModal = document.getElementById('audioPlayerModal');
  const btnCloseAudioSheet = document.getElementById('btnCloseAudioSheet');
  const audioPlayerTitle = document.getElementById('audioPlayerTitle');
  const audioPlayerSource = document.getElementById('audioPlayerSource');
  const audioWaveform = document.getElementById('audioWaveform');
  const btnAudioTogglePlay = document.getElementById('btnAudioTogglePlay');
  const audioPlayIcon = document.getElementById('audioPlayIcon');
  const audioCurrentTime = document.getElementById('audioCurrentTime');
  const audioTotalDuration = document.getElementById('audioTotalDuration');

  // Mobile Dock Buttons
  const dockBtnHome = document.getElementById('dockBtnHome');
  const dockBtnAudio = document.getElementById('dockBtnAudio');
  const dockBtnWatchlist = document.getElementById('dockBtnWatchlist');
  const dockBtnSaved = document.getElementById('dockBtnSaved');

  // Helpers
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
      const tickers = Array.isArray(item.tickers) ? item.tickers : [];
      if (!tickers.some(t => state.watchlist.includes(t))) return false;
    } else if (state.viewMode === 'BOOKMARKS') {
      if (!state.bookmarks.some(b => b.id === item.id)) return false;
    }

    if (state.activeTicker) {
      const tickers = Array.isArray(item.tickers) ? item.tickers : [];
      if (!tickers.includes(state.activeTicker)) return false;
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

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      const text = `${item.title} ${item.summary || ''} ${item.source} ${(item.tickers || []).join(' ')}`.toLowerCase();
      if (!text.includes(q)) return false;
    }

    return true;
  }

  // Render Highlights Carousel (Top 3 Cards)
  function renderHighlights(items) {
    if (!highlightsCarousel || !highlightsSection) return;
    if (state.viewMode !== 'ALL' || state.activeCategory !== 'ALL' || state.searchQuery || state.activeTicker || state.activeSentiment !== 'ALL') {
      highlightsSection.style.display = 'none';
      return;
    }

    highlightsSection.style.display = 'block';
    const topStories = items.slice(0, 3);
    if (topStories.length === 0) {
      highlightsSection.style.display = 'none';
      return;
    }

    highlightsCarousel.innerHTML = topStories.map(story => {
      const thumb = story.image_url || 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80';
      return `
        <article class="highlight-card" data-id="${story.id}">
          <img src="${escapeHtml(thumb)}" alt="${escapeHtml(story.title)}" class="highlight-card-img" loading="eager" onerror="this.src='https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80'">
          <div class="highlight-card-overlay">
            <div class="highlight-tag-row">
              <span class="highlight-tag">${escapeHtml(story.source)}</span>
              <span style="font-size: 10px; font-family: var(--font-mono);">${formatRelativeTime(story.published_at)}</span>
            </div>
            <h3 class="highlight-title">${escapeHtml(story.title)}</h3>
            <div class="highlight-meta">
              <span>${estimateReadTime(story.summary)}</span>
              <span style="font-weight: 700;">Baca &rarr;</span>
            </div>
          </div>
        </article>
      `;
    }).join('');

    highlightsCarousel.querySelectorAll('.highlight-card').forEach(card => {
      card.addEventListener('click', () => {
        openReader(card.dataset.id);
      });
    });
  }

  // Render Primary Article Flow List (2-Column Media Flow Style)
  function renderPortal(scrollToTop = false) {
    const filtered = state.articles.filter(passesFilter);
    feedCounter.textContent = `${filtered.length} Warta`;

    if (feedSectionTitle) {
      if (state.viewMode === 'AUDIO') feedSectionTitle.textContent = 'Audio Podcasts & Ringkasan Suara';
      else if (state.viewMode === 'WATCHLIST') feedSectionTitle.textContent = 'Warta Watchlist Saham Anda';
      else if (state.viewMode === 'BOOKMARKS') feedSectionTitle.textContent = 'Warta Tersimpan';
      else feedSectionTitle.textContent = 'Aliran Warta Pasar';
    }

    if (filtered.length === 0) {
      if (highlightsSection) highlightsSection.style.display = 'none';
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

    // Render Highlights
    renderHighlights(filtered);

    // Render Article List Items
    newsList.innerHTML = '';
    const itemsToRender = (highlightsSection && highlightsSection.style.display !== 'none') ? filtered.slice(3) : filtered;

    itemsToRender.forEach(item => {
      const row = document.createElement('article');
      row.className = 'article-flow-item';
      row.dataset.id = item.id;

      const thumb = item.image_url || 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=400&q=80';
      const sentimentClass = (item.sentiment || 'NEUTRAL').toLowerCase();
      const tickersHtml = (item.tickers || []).slice(0, 3).map(t => `<span style="font-family: var(--font-mono); font-size: 10px; font-weight: 700; padding: 2px 6px; background-color: var(--color-surface-subtle); border-radius: var(--radius-xs); color: var(--color-text-primary);">${escapeHtml(t)}</span>`).join('');
      const isBookmarked = state.bookmarks.some(b => b.id === item.id);
      const audioDuration = estimateAudioDuration(item.summary);

      row.innerHTML = `
        <div class="flow-thumb-container">
          <img src="${escapeHtml(thumb)}" alt="${escapeHtml(item.title)}" class="flow-thumb-img" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=400&q=80'">
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
            <div style="display: flex; align-items: center; gap: 6px;">
              <button type="button" class="btn-audio-listen btn-play-speech" data-id="${item.id}" title="Dengarkan warta suara">
                <span>▶</span>
                <span>${audioDuration}</span>
              </button>
              ${tickersHtml}
            </div>
            <time style="font-family: var(--font-mono); font-size: 11px;">${formatRelativeTime(item.published_at)}</time>
          </div>
        </div>
      `;

      row.addEventListener('click', (e) => {
        if (e.target.closest('.btn-flow-bookmark') || e.target.closest('.btn-play-speech')) return;
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

      const btnSpeech = row.querySelector('.btn-play-speech');
      btnSpeech.addEventListener('click', (e) => {
        e.stopPropagation();
        startAudioPlayback(item);
      });

      newsList.appendChild(row);
    });

    if (scrollToTop) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Audio Playback & Voice Synthesis (Media Flow Screen 5)
  function startAudioPlayback(article) {
    state.speakingArticle = article;
    if (audioPlayerTitle) audioPlayerTitle.textContent = article.title;
    if (audioPlayerSource) audioPlayerSource.textContent = `${article.source} • Suara Berita Emitara`;
    if (audioTotalDuration) audioTotalDuration.textContent = estimateAudioDuration(article.summary || article.content_text);

    if (audioPlayerModal) audioPlayerModal.classList.add('open');

    // Web Speech API
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const textToRead = `${article.title}. Sumber: ${article.source}. ${article.summary || ''}`;
      const utterance = new SpeechSynthesisUtterance(textToRead);
      utterance.lang = 'id-ID';
      utterance.rate = 1.0;

      utterance.onstart = () => {
        state.isAudioPlaying = true;
        updateAudioPlayerControls();
      };

      utterance.onend = () => {
        state.isAudioPlaying = false;
        updateAudioPlayerControls();
      };

      state.synthUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    }
  }

  function toggleAudioPlayState() {
    if (!('speechSynthesis' in window)) return;
    if (state.isAudioPlaying) {
      window.speechSynthesis.pause();
      state.isAudioPlaying = false;
    } else {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        state.isAudioPlaying = true;
      } else if (state.speakingArticle) {
        startAudioPlayback(state.speakingArticle);
      }
    }
    updateAudioPlayerControls();
  }

  function updateAudioPlayerControls() {
    if (audioPlayIcon) {
      audioPlayIcon.textContent = state.isAudioPlaying ? '❚❚' : '▶';
    }
    if (audioWaveform) {
      audioWaveform.style.opacity = state.isAudioPlaying ? '1' : '0.4';
    }
  }

  function closeAudioPlayer() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    state.isAudioPlaying = false;
    if (audioPlayerModal) audioPlayerModal.classList.remove('open');
  }

  // Reader Modal Logic
  async function openReader(articleId) {
    if (!readerOverlay) return;
    readerOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    window.location.hash = `#/berita/${articleId}`;

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
        <span style="font-weight: 700; text-transform: uppercase; font-size: 11px;">${escapeHtml(article.source)}</span>
        <span style="font-family: var(--font-mono); font-size: 11px; color: var(--color-text-muted);">&bull; ${formatRelativeTime(article.published_at)} &bull; ${estimateReadTime(article.content_text)}</span>
      `;

      const authorName = article.author || 'Tim Redaksi';
      readerAuthor.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--color-text-muted);">
          <span>Oleh: <strong style="color: var(--color-text-primary);">${escapeHtml(authorName)}</strong></span>
          <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer" style="color: var(--color-text-primary); text-decoration: underline;">Tautan Asli &nearr;</a>
        </div>
      `;

      if (btnReaderAudioPlay) {
        btnReaderAudioPlay.onclick = () => {
          startAudioPlayback(article);
        };
      }

      if (article.image_url) {
        readerMedia.innerHTML = `<img src="${escapeHtml(article.image_url)}" alt="${escapeHtml(article.title)}" style="width: 100%; max-height: 420px; object-fit: cover; display: block;">`;
      }

      let paragraphs = [];
      if (article.content_text && article.content_text.length > 50) {
        paragraphs = article.content_text.split('\n\n').filter(p => p.trim().length > 0);
      } else if (article.summary) {
        paragraphs = [article.summary];
      }

      readerBody.innerHTML = paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('');

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
            state.activeTicker = btn.dataset.ticker;
            renderPortal(true);
          });
        });
      }
    } catch (err) {
      readerTitle.textContent = 'Gagal memuat artikel';
      readerBody.innerHTML = `<p style="color: var(--color-bearish-text);">${escapeHtml(err.message)}</p>`;
    }
  }

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

      const res = await fetch(`/api/news?limit=${state.pageSize}&offset=${state.currentOffset}`);
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

      if (btnLoadMore && loadMoreContainer) {
        btnLoadMore.textContent = 'Muat Lebih Banyak Warta ↓';
        btnLoadMore.disabled = false;
        loadMoreContainer.style.display = (state.articles.length >= totalAvailable || newBatch.length < state.pageSize) ? 'none' : 'block';
      }
    } catch (e) {
      console.error('Fetch news error:', e);
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
          <span class="ticker-strip-item">
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
          state.activeTicker = row.dataset.ticker;
          renderPortal(true);
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
    if (!c) return;
    if (state.watchlist.length === 0) {
      c.innerHTML = '<span style="font-size: 11px; color: var(--color-text-muted);">Belum ada emiten dipantau.</span>';
      return;
    }
    c.innerHTML = state.watchlist.map(t => `
      <span style="display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px; background-color: #FFFFFF; border: 1px solid var(--color-border); border-radius: var(--radius-pill); font-family: var(--font-mono); font-size: 11px; font-weight: 700; cursor: pointer;" data-ticker="${escapeHtml(t)}" class="w-chip">
        <span>${escapeHtml(t)}</span>
        <span style="color: var(--color-text-muted);" class="w-rm" data-rm="${escapeHtml(t)}">&times;</span>
      </span>
    `).join('');

    c.querySelectorAll('.w-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        if (e.target.classList.contains('w-rm')) return;
        state.activeTicker = chip.dataset.ticker;
        state.viewMode = 'ALL';
        updateModeButtons();
        renderPortal(true);
      });
    });

    c.querySelectorAll('.w-rm').forEach(rm => {
      rm.addEventListener('click', (e) => {
        e.stopPropagation();
        state.watchlist = state.watchlist.filter(t => t !== rm.dataset.rm);
        localStorage.setItem('emitara_watchlist', JSON.stringify(state.watchlist));
        updateBadgeCounts();
        renderWatchlistChips();
        if (state.viewMode === 'WATCHLIST') renderPortal();
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

  function updateModeButtons() {
    if (btnModeNews) btnModeNews.classList.toggle('active', state.viewMode === 'ALL');
    if (btnModeAudio) btnModeAudio.classList.toggle('active', state.viewMode === 'AUDIO');
    if (btnWatchlistTab) btnWatchlistTab.classList.toggle('active', state.viewMode === 'WATCHLIST');
    if (btnBookmarksTab) btnBookmarksTab.classList.toggle('active', state.viewMode === 'BOOKMARKS');

    if (dockBtnHome) dockBtnHome.classList.toggle('active', state.viewMode === 'ALL');
    if (dockBtnAudio) dockBtnAudio.classList.toggle('active', state.viewMode === 'AUDIO');
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
  if (btnModeNews) {
    btnModeNews.addEventListener('click', () => {
      state.viewMode = 'ALL';
      updateModeButtons();
      renderPortal(true);
    });
  }

  if (btnModeAudio) {
    btnModeAudio.addEventListener('click', () => {
      state.viewMode = 'AUDIO';
      updateModeButtons();
      renderPortal(true);
    });
  }

  if (btnWatchlistTab) {
    btnWatchlistTab.addEventListener('click', () => {
      state.viewMode = state.viewMode === 'WATCHLIST' ? 'ALL' : 'WATCHLIST';
      state.activeTicker = null;
      updateModeButtons();
      renderPortal(true);
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
  if (dockBtnHome) dockBtnHome.addEventListener('click', () => { state.viewMode = 'ALL'; updateModeButtons(); renderPortal(true); });
  if (dockBtnAudio) dockBtnAudio.addEventListener('click', () => { state.viewMode = 'AUDIO'; updateModeButtons(); renderPortal(true); });
  if (dockBtnWatchlist) dockBtnWatchlist.addEventListener('click', () => { state.viewMode = 'WATCHLIST'; updateModeButtons(); renderPortal(true); });
  if (dockBtnSaved) dockBtnSaved.addEventListener('click', () => { state.viewMode = 'BOOKMARKS'; updateModeButtons(); renderPortal(true); });

  // Categories & Search
  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      catPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.activeCategory = pill.dataset.category;
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

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim();
      renderPortal();
    });
  }

  if (btnLoadMore) {
    btnLoadMore.addEventListener('click', () => {
      state.currentOffset += state.pageSize;
      loadNews(true);
    });
  }

  // Audio Player Listeners
  if (btnCloseAudioSheet) btnCloseAudioSheet.addEventListener('click', closeAudioPlayer);
  if (btnAudioTogglePlay) btnAudioTogglePlay.addEventListener('click', toggleAudioPlayState);

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
      if (audioPlayerModal && audioPlayerModal.classList.contains('open')) closeAudioPlayer();
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

  document.querySelectorAll('.btn-suggest-ticker').forEach(btn => {
    btn.addEventListener('click', () => {
      addWatchlistTicker(btn.dataset.ticker);
    });
  });

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

  // Init
  updateBadgeCounts();
  renderWatchlistChips();
  loadLiveMarketQuotes();
  setInterval(loadLiveMarketQuotes, 45000);
  loadNews();
  loadTrending();
  setInterval(loadTrending, 60000);
  connectSSE();
})();
