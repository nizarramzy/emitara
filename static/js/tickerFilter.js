// Emitara Ticker and Sentiment Filter Controller
class FilterController {
  constructor() {
    this.activeTicker = null;
    this.activeSentiment = 'ALL';
    this.searchQuery = '';
    this.listeners = [];
  }

  onChange(callback) {
    this.listeners.push(callback);
  }

  notify() {
    for (const cb of this.listeners) {
      cb({
        ticker: this.activeTicker,
        sentiment: this.activeSentiment,
        query: this.searchQuery
      });
    }
  }

  setTicker(ticker) {
    this.activeTicker = ticker ? ticker.toUpperCase() : null;
    this.notify();
  }

  clearTicker() {
    this.activeTicker = null;
    this.notify();
  }

  setSentiment(sentiment) {
    this.activeSentiment = sentiment;
    this.notify();
  }

  setSearchQuery(q) {
    this.searchQuery = (q || '').trim().toLowerCase();
    this.notify();
  }

  matches(article) {
    // 1. Ticker filter
    if (this.activeTicker) {
      const tickers = Array.isArray(article.tickers) ? article.tickers : [];
      if (!tickers.includes(this.activeTicker)) {
        return false;
      }
    }

    // 2. Sentiment filter
    if (this.activeSentiment !== 'ALL') {
      if ((article.sentiment || '').toUpperCase() !== this.activeSentiment) {
        return false;
      }
    }

    // 3. Search query
    if (this.searchQuery) {
      const title = (article.title || '').toLowerCase();
      const summary = (article.summary || '').toLowerCase();
      const source = (article.source || '').toLowerCase();
      const tickers = (article.tickers || []).join(' ').toLowerCase();
      
      const full = `${title} ${summary} ${source} ${tickers}`;
      if (!full.includes(this.searchQuery)) {
        return false;
      }
    }

    return true;
  }
}

window.filterCtrl = new FilterController();
