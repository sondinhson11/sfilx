/**
 * Main Application Routing & UI Controller
 */
const app = {
  currentPage: 'home',
  currentMovie: null,
  currentEpisode: 1,
  currentServer: 0,
  heroSwiper: null,
  watchLoadToken: 0,
  filterLoadToken: 0,
  explorePage: 1,
  exploreHasMore: false,
  exploreFilters: null,
  exploreType: 'series',
  searchTimer: null,

  init() {
    // Khởi tạo các module
    MovieDB.movies = [];
    this.populateExploreFilters();
    this.populateYearFilter();
    PlayerController.init();
    TVNavigator.init();
    this.renderHomeSections();
    this.setupEventListeners();

    // Lắng nghe hash router
    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute(); // Trang ban đầu
    this.loadHomeSections();
  },

  setupSwiper() {
    const trending = MovieDB.getTrending();
    const heroWrapper = document.getElementById('hero-slider-wrapper');
    if (!heroWrapper) return;

    const movies = trending.slice(0, 5);
    heroWrapper.innerHTML = movies.map(movie => `
      <div class="swiper-slide hero-slide relative">
        <img src="${this.escapeHtml(movie.banner)}" class="hero-image w-full h-full object-cover" alt="${this.escapeHtml(movie.title)}">
        <div class="hero-overlay absolute inset-0 flex flex-col justify-end p-6 sm:p-12">
          <span class="hero-kicker mb-3">ĐỀ XUẤT HÔM NAY <span></span></span>
          <h2 class="hero-title mb-2">${this.escapeHtml(movie.title)}</h2>
          <div class="hero-meta mb-3">${this.escapeHtml(movie.year)}<span></span>${this.escapeHtml(movie.genre || movie.duration || 'Phim mới')}<span></span>${movie.rating ? `<i class="fa-solid fa-star"></i> ${this.escapeHtml(movie.rating)}` : ''}</div>
          <p class="hero-overview text-xs sm:text-sm text-slate-200 line-clamp-2 max-w-2xl mb-5">${this.escapeHtml(movie.overview || 'Khám phá phim mới được cập nhật.')}</p>
          <div class="flex items-center gap-2">
            <button onclick="app.playMovie('${encodeURIComponent(movie.id)}')" class="tv-focusable hero-primary px-5 py-2.5 text-white font-bold text-sm flex items-center gap-2">
              <i class="fa-solid fa-play"></i> Xem Ngay
            </button>
          </div>
        </div>
      </div>
    `).join('');

    const hero = heroWrapper.closest('.heroSwiper');
    if (!movies.length) {
      if (this.heroSwiper) {
        this.heroSwiper.destroy(true, true);
        this.heroSwiper = null;
      }
      if (hero) hero.classList.add('hidden');
      return;
    }
    if (hero) hero.classList.remove('hidden');
    const homePage = document.getElementById('page-home');
    if (homePage?.classList.contains('hidden')) return;
    if (this.heroSwiper) this.heroSwiper.destroy(true, true);
    this.heroSwiper = new Swiper('.heroSwiper', {
      loop: true,
      autoplay: { delay: 4500, disableOnInteraction: false },
      pagination: { el: '.swiper-pagination', clickable: true },
      navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' }
    });
  },

  renderMovieCard(movie) {
    const score = movie.rating
      ? `<i class="fa-solid fa-star"></i> ${this.escapeHtml(movie.rating)}`
      : 'MỚI';
    return `
      <button type="button" class="movie-card tv-focusable cursor-pointer group transition-all text-left"
           onclick="app.playMovie('${encodeURIComponent(movie.id)}')"
           data-id="${this.escapeHtml(movie.id)}">
        <div class="poster-container mb-2">
          <img src="${this.escapeHtml(movie.poster)}" class="poster-img" alt="${this.escapeHtml(movie.title)}" loading="lazy" referrerpolicy="no-referrer">
          <span class="absolute top-2 left-2 bg-black/70 backdrop-blur text-[10px] text-amber-400 font-bold px-1.5 py-0.5 rounded">
            ${score}
          </span>
        </div>
        <h4 class="font-bold text-xs sm:text-sm text-slate-100 truncate group-hover:text-red-400">${this.escapeHtml(movie.title)}</h4>
        <div class="flex items-center justify-between text-[11px] text-slate-400 mt-1">
          <span>${this.escapeHtml(movie.year || '')}</span>
          <span class="text-[10px] px-1.5 py-0.2 bg-white/5 rounded">${this.escapeHtml(movie.genre || (movie.catalogType === 'animation' ? 'Hoạt hình' : movie.category === 'series' ? 'Phim bộ' : 'Phim lẻ'))}</span>
        </div>
      </button>
    `;
  },

  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);
  },

  async loadHomeSections() {
    const status = document.getElementById('catalog-status');
    const requests = await Promise.allSettled([
      MovieDB.fetchCatalog(),
      MovieDB.fetchCatalog({ genre: 'Hành Động' }),
      MovieDB.fetchCatalog({ type: 'series' })
    ]);

    const [latestResult, actionResult, seriesResult] = requests;
    if (latestResult.status === 'fulfilled') {
      const latest = latestResult.value.movies;
      const action = actionResult.status === 'fulfilled' ? actionResult.value.movies : [];
      const series = seriesResult.status === 'fulfilled' ? seriesResult.value.movies : [];
      const combined = new Map([...latest, ...action, ...series].map(movie => [movie.id, movie]));
      MovieDB.movies = [...combined.values()];
      latest.forEach(movie => { movie.isTrending = true; });
      this.renderHomeSections({
        trending: latest,
        action,
        series
      });
      this.setupSwiper();
      if (status) status.classList.add('hidden');
      if (actionResult.status === 'rejected' || seriesResult.status === 'rejected') {
        this.setCatalogStatus('Một số danh mục chưa tải được. Bạn vẫn có thể tìm phim.', 'warning');
      }
      return;
    }

    MovieDB.movies = [];
    this.renderHomeSections({ trending: [], action: [], series: [] });
    if (status) {
      const message = latestResult.reason instanceof Error ? latestResult.reason.message : 'Lỗi kết nối không xác định.';
      status.textContent = `Không tải được danh sách phim từ NguonC: ${message}`;
      status.classList.remove('hidden');
      status.classList.add('is-error');
    }
    this.setupSwiper();
  },

  renderHomeSections(sections = {}) {
    const trendingGrid = document.getElementById('trending-grid');
    const actionGrid = document.getElementById('action-grid');
    const seriesGrid = document.getElementById('series-grid');

    if (trendingGrid) {
      const movies = sections.trending || MovieDB.getTrending();
      trendingGrid.innerHTML = movies.map(m => this.renderMovieCard(m)).join('');
    }
    if (actionGrid) {
      const movies = sections.action || MovieDB.getByGenre('Hành Động');
      actionGrid.innerHTML = movies.map(m => this.renderMovieCard(m)).join('');
    }
    if (seriesGrid) {
      const movies = sections.series || MovieDB.movies.filter(m => m.category === 'series');
      seriesGrid.innerHTML = movies.map(m => this.renderMovieCard(m)).join('');
    }
  },

  setCatalogStatus(message, type = 'info') {
    const status = document.getElementById('catalog-status');
    if (!status) return;
    status.textContent = message;
    status.classList.remove('hidden', 'is-error', 'is-warning');
    if (type === 'error') status.classList.add('is-error');
    if (type === 'warning') status.classList.add('is-warning');
  },

  populateYearFilter() {
    const select = document.getElementById('filter-year');
    if (!select) return;
    const allYearsOption = select.querySelector('option[value="all"]');
    select.replaceChildren(allYearsOption);
    for (let year = new Date().getFullYear(); year >= 1900; year--) {
      select.add(new Option(String(year), String(year)));
    }
  },

  populateExploreFilters() {
    const populate = (id, options, placeholder) => {
      const select = document.getElementById(id);
      if (!select) return;
      select.replaceChildren(new Option(placeholder, 'all'));
      options.forEach(option => select.add(new Option(option.name, option.slug)));
    };
    populate('filter-genre', MovieDB.catalogFilters.genres, 'Tất cả thể loại');
    populate('filter-country', MovieDB.catalogFilters.countries, 'Tất cả quốc gia');
    populate('filter-language', MovieDB.catalogFilters.languages, 'Tất cả ngôn ngữ');
  },

  handleRoute() {
    const hash = window.location.hash.slice(1) || 'home';
    const [page, param] = hash.split('/').map(decodeURIComponent);

    if (page === 'explore') {
      this.exploreType = ['series', 'movies', 'animation'].includes(param) ? param : 'series';
      this.updateExploreTabs();
    }
    this.showPage(page);

    if (page === 'watch' && param) {
      this.loadWatchPage(param);
    } else if (page === 'explore') {
      this.filterMovies();
    }
  },

  navigate(page, params = null) {
    if (page === 'watch' && params) {
      window.location.hash = `#watch/${params}`;
    } else if (page === 'explore' && ['series', 'movies', 'animation'].includes(params)) {
      window.location.hash = `#explore/${params}`;
    } else {
      window.location.hash = `#${page}`;
    }
  },

  updateExploreTabs() {
    document.querySelectorAll('.explore-tab').forEach(button => {
      const active = button.dataset.exploreType === this.exploreType;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    const categoryFiltersAvailable = this.exploreType !== 'animation';
    ['filter-genre', 'filter-country'].forEach(id => {
      const select = document.getElementById(id);
      if (select) {
        select.disabled = !categoryFiltersAvailable;
        if (!categoryFiltersAvailable) select.value = 'all';
      }
    });
  },

  goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.navigate('home');
    }
  },

  showPage(pageName) {
    if (this.currentPage === 'watch' && pageName !== 'watch') {
      PlayerController.clearStream();
    }
    this.currentPage = pageName;
    document.querySelectorAll('.spa-page').forEach(page => page.classList.add('hidden'));

    const target = document.getElementById(`page-${pageName}`);
    if (target) {
      target.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (pageName === 'home') this.setupSwiper();
    }

    // Cập nhật tab active trên navigation
    document.querySelectorAll('.nav-link').forEach(btn => {
      if (btn.dataset.page === pageName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Reset TV focus vào phần tử đầu tiên của trang mới
    setTimeout(() => {
      const firstFocusable = target ? target.querySelector(TVNavigator.focusableSelector) : null;
      if (firstFocusable) {
        TVNavigator.setFocus(firstFocusable);
      }
    }, 200);
  },

  playMovie(id) {
    this.navigate('watch', id);
  },

  async loadWatchPage(id) {
    const requestToken = ++this.watchLoadToken;
    const movie = MovieDB.getById(id);
    if (!movie) {
      this.setWatchStatus('Không tìm thấy phim trong danh sách.', 'error');
      return;
    }
    if (!this.currentMovie || this.currentMovie.id !== movie.id) {
      this.currentEpisode = 1;
      this.currentServer = 0;
    }
    this.currentMovie = movie;
    PlayerController.clearStream();
    this.renderServers([]);
    this.showWatchMovie(movie);

    if (movie.source !== 'nguonc') {
      this.renderEpisodeList(movie.episodes || 1, this.currentEpisode);
      this.renderServers([]);
      this.updateEpisodeNavigation();
      PlayerController.loadStream(this.getEpisodeStream(movie, this.currentEpisode));
      return;
    }

    this.setWatchStatus('Đang tải thông tin phim và danh sách tập...');
    this.renderEpisodeList([], 1);
    try {
      const detail = await MovieDB.fetchMovieDetail(movie);
      if (requestToken !== this.watchLoadToken) return;
      this.currentMovie = detail;
      this.currentServer = Math.min(this.currentServer, Math.max(0, detail.servers.length - 1));
      this.showWatchMovie(detail);
      this.renderServers(detail.servers);
      const episodes = this.getCurrentEpisodes();
      this.currentEpisode = Math.min(this.currentEpisode, Math.max(1, episodes.length));
      this.renderEpisodeList(episodes, this.currentEpisode);
      this.updateEpisodeNavigation();
      this.setWatchStatus('');
      if (!episodes.length) {
        this.setWatchStatus('NguonC chưa cung cấp tập phát cho phim này.', 'warning');
        return;
      }
      this.loadCurrentEpisode();
    } catch (error) {
      if (requestToken !== this.watchLoadToken) return;
      this.setWatchStatus(`Không tải được phim: ${error.message}`, 'error');
    }
  },

  showWatchMovie(movie) {
    document.getElementById('watch-title').textContent = movie.title;
    document.getElementById('watch-year').textContent = movie.year;
    document.getElementById('watch-rating').innerHTML = movie.rating
      ? `<i class="fa-solid fa-star mr-1"></i>${this.escapeHtml(movie.rating)}`
      : '';
    document.getElementById('watch-duration').textContent = movie.duration;
    document.getElementById('watch-genre').textContent = movie.genre || 'Đang cập nhật';
    document.getElementById('watch-overview').textContent = movie.overview || 'Nội dung phim đang cập nhật...';
  },

  setWatchStatus(message, type = 'info') {
    const status = document.getElementById('watch-source-status');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('hidden', !message);
    status.classList.toggle('is-error', type === 'error');
    status.classList.toggle('is-warning', type === 'warning');
  },

  getEpisodeStream(movie, episode) {
    if (movie.servers) {
      const currentEpisodes = this.getCurrentEpisodes();
      const selectedEpisode = currentEpisodes[episode - 1];
      return selectedEpisode?.embed || selectedEpisode?.link_embed || selectedEpisode?.url || selectedEpisode?.file || '';
    }
    return movie.episodeUrls && movie.episodeUrls[episode - 1]
      ? movie.episodeUrls[episode - 1]
      : movie.videoUrl;
  },

  renderEpisodeList(count, activeEpisode = 1) {
    const list = document.getElementById('episode-list');
    const episodes = Array.isArray(count) ? count : null;
    const episodeCount = episodes ? episodes.length : count;
    document.getElementById('episode-count-badge').textContent = `${activeEpisode} / ${episodeCount}`;
    if (!list) return;

    let html = '';
    for (let i = 1; i <= episodeCount; i++) {
      const episodeName = episodes ? (episodes[i - 1].name || `Tập ${i}`) : i;
      html += `
        <button class="tv-focusable episode-btn ${i === activeEpisode ? 'bg-red-600 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'} font-bold py-2 rounded-lg text-xs"
                aria-current="${i === activeEpisode ? 'true' : 'false'}"
                onclick="app.selectEpisode(${i}, this)">
          ${this.escapeHtml(episodeName)}
        </button>
      `;
    }
    list.innerHTML = html;
  },

  selectEpisode(ep, btn) {
    const episodeCount = this.getCurrentEpisodes().length || (this.currentMovie?.episodes || 1);
    if (!this.currentMovie || ep < 1 || ep > episodeCount) return;

    this.currentEpisode = ep;
    document.getElementById('episode-count-badge').textContent = `${ep} / ${episodeCount}`;
    document.querySelectorAll('.episode-btn').forEach(b => {
      b.classList.remove('bg-red-600', 'text-white');
      b.classList.add('bg-white/5', 'text-slate-300');
      b.setAttribute('aria-current', 'false');
    });
    const selectedButton = btn || document.querySelector(`.episode-btn:nth-child(${ep})`);
    if (selectedButton) {
      selectedButton.classList.remove('bg-white/5', 'text-slate-300');
      selectedButton.classList.add('bg-red-600', 'text-white');
      selectedButton.setAttribute('aria-current', 'true');
    }

    this.updateEpisodeNavigation();
    this.loadCurrentEpisode();
  },

  getCurrentEpisodes() {
    if (this.currentMovie?.servers) {
      return this.currentMovie.servers[this.currentServer]?.items || [];
    }
    return Array.from({ length: this.currentMovie?.episodes || 0 }, (_, index) => ({ name: String(index + 1) }));
  },

  loadCurrentEpisode() {
    if (!this.currentMovie) return;
    const stream = this.getEpisodeStream(this.currentMovie, this.currentEpisode);
    if (stream) {
      try {
        PlayerController.loadStream(stream);
        this.setWatchStatus('');
      } catch (error) {
        this.setWatchStatus(`Không thể phát tập này: ${error.message}`, 'error');
      }
    } else {
      this.setWatchStatus('Không tìm thấy đường dẫn phát cho tập này.', 'warning');
    }
  },

  renderServers(servers) {
    const list = document.getElementById('server-list');
    const section = list?.closest('.pt-4');
    if (!list || !section) return;
    list.replaceChildren();
    section.classList.toggle('hidden', !servers.length);
    servers.forEach((server, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `tv-focusable server-btn px-3 py-1.5 rounded-lg text-xs font-semibold ${index === this.currentServer ? 'bg-red-600 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'}`;
      button.textContent = server.name;
      button.addEventListener('click', () => this.selectServer(index));
      list.appendChild(button);
    });
  },

  selectServer(index) {
    if (!this.currentMovie?.servers || !this.currentMovie.servers[index]) return;
    this.currentServer = index;
    this.currentEpisode = Math.min(this.currentEpisode, this.currentMovie.servers[index].items.length);
    this.renderServers(this.currentMovie.servers);
    this.renderEpisodeList(this.getCurrentEpisodes(), this.currentEpisode);
    this.updateEpisodeNavigation();
    this.loadCurrentEpisode();
  },

  nextEpisode() {
    if (!this.currentMovie || this.currentEpisode >= this.getCurrentEpisodes().length) return;
    this.selectEpisode(this.currentEpisode + 1);
  },

  updateEpisodeNavigation() {
    const button = document.getElementById('next-episode-btn');
    if (!button) return;

    const episodeCount = this.getCurrentEpisodes().length || (this.currentMovie?.episodes || 1);
    const hasNextEpisode = this.currentEpisode < episodeCount;
    button.disabled = !hasNextEpisode;
    button.querySelector('span').textContent = hasNextEpisode
      ? `Tập tiếp theo · ${this.currentEpisode + 1}`
      : 'Đã hết tập';
  },

  async filterMovies({ append = false } = {}) {
    const genre = document.getElementById('filter-genre').value;
    const country = document.getElementById('filter-country').value;
    const year = document.getElementById('filter-year').value;
    const language = document.getElementById('filter-language').value;
    const search = document.getElementById('search-input').value.trim();
    const type = this.exploreType;
    const filters = { genre, country, year, language, search, type };
    if (!append) {
      this.filterLoadToken++;
      this.explorePage = 1;
      this.exploreFilters = filters;
    }
    const requestToken = this.filterLoadToken;
    const page = append ? this.explorePage + 1 : 1;
    const grid = document.getElementById('explore-grid');
    const countEl = document.getElementById('filter-result-count');
    const loadMore = document.getElementById('explore-load-more');
    if (!append) {
      if (countEl) countEl.textContent = 'Đang tải phim...';
      if (grid) grid.replaceChildren();
      if (loadMore) loadMore.classList.add('hidden');
    } else if (loadMore) {
      loadMore.disabled = true;
      loadMore.textContent = 'Đang tải...';
    }

    try {
      const result = await MovieDB.fetchCatalog({ ...filters, page });
      if (requestToken !== this.filterLoadToken) return;
      let movies = result.movies.filter(movie => {
        if (type === 'animation') return movie.catalogType === 'animation';
        return type === 'series' ? movie.category === 'series' : movie.category === 'movie';
      });
      if (year !== 'all') movies = movies.filter(movie => String(movie.year) === year);
      if (language !== 'all') {
        movies = movies.filter(movie => MovieDB.toSlug(movie.language || '').includes(language));
      }
      if (search && type === 'animation') {
        const keyword = search.toLocaleLowerCase('vi');
        movies = movies.filter(movie => `${movie.title} ${movie.originalTitle}`.toLocaleLowerCase('vi').includes(keyword));
      }
      if (append && grid) {
        const existingIds = new Set([...grid.querySelectorAll('[data-id]')].map(card => card.dataset.id));
        movies = movies.filter(movie => !existingIds.has(movie.id));
        grid.insertAdjacentHTML('beforeend', movies.map(movie => this.renderMovieCard(movie)).join(''));
      } else if (grid) {
        grid.innerHTML = movies.length
          ? movies.map(movie => this.renderMovieCard(movie)).join('')
          : '<p class="col-span-full text-center text-slate-400 py-10">Không tìm thấy phim phù hợp với tiêu chí lọc.</p>';
      }

      this.explorePage = page;
      const pagination = result.pagination || {};
      const currentPage = Number(pagination.current_page || pagination.currentPage || page);
      const totalPages = Number(pagination.total_page || pagination.total_pages || pagination.totalPages || 0);
      const hasMore = totalPages ? currentPage < totalPages : result.movies.length >= 20;
      this.exploreHasMore = hasMore;
      if (countEl) {
        const total = Number(pagination.total_items || pagination.totalItems || 0);
        const visibleCount = grid?.querySelectorAll('[data-id]').length || movies.length;
        const exactTabCatalog = !search && genre === 'all' && country === 'all' && year === 'all' && language === 'all';
        countEl.textContent = exactTabCatalog && total
          ? `Hiển thị ${visibleCount} / ${total} phim`
          : `Đã tải ${visibleCount} ${type === 'series' ? 'phim bộ' : type === 'movies' ? 'phim lẻ' : 'phim hoạt hình'}`;
      }
      if (loadMore) {
        loadMore.classList.toggle('hidden', !hasMore);
        loadMore.disabled = false;
        loadMore.textContent = 'Tải thêm phim';
      }
    } catch (error) {
      if (requestToken !== this.filterLoadToken) return;
      const message = error instanceof Error ? error.message : 'Lỗi kết nối không xác định.';
      if (countEl) countEl.textContent = `Không tải được danh sách: ${message}`;
      if (grid && !append) {
        grid.innerHTML = '<p class="col-span-full text-center text-red-300 py-10">Không thể kết nối nguồn phim. Vui lòng thử lại.</p>';
      }
      if (loadMore) {
        loadMore.classList.add('hidden');
        loadMore.disabled = false;
        loadMore.textContent = 'Tải thêm phim';
      }
    }
  },

  handleExploreFilterChange(changedId) {
    const selectedValue = document.getElementById(changedId)?.value;
    if (selectedValue && selectedValue !== 'all') {
      ['filter-genre', 'filter-country', 'filter-year', 'filter-language']
        .filter(id => id !== changedId)
        .forEach(id => { document.getElementById(id).value = 'all'; });
    }
    this.filterMovies();
  },

  setupEventListeners() {
    // Navigation bar clicks
    document.querySelectorAll('.nav-link').forEach(btn => {
      btn.addEventListener('click', () => {
        this.navigate(btn.dataset.page);
      });
    });

    const nextEpisodeBtn = document.getElementById('next-episode-btn');
    if (nextEpisodeBtn) {
      nextEpisodeBtn.addEventListener('click', () => this.nextEpisode());
    }

    document.querySelectorAll('.explore-tab').forEach(button => {
      button.addEventListener('click', () => this.navigate('explore', button.dataset.exploreType));
    });

    // Filter selectors
    ['filter-genre', 'filter-country', 'filter-year', 'filter-language'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => this.handleExploreFilterChange(id));
    });
    const loadMoreBtn = document.getElementById('explore-load-more');
    if (loadMoreBtn) loadMoreBtn.addEventListener('click', () => this.filterMovies({ append: true }));

    // Realtime search
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('clear-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        if (clearBtn) clearBtn.classList.toggle('hidden', !val);
        if (this.currentPage !== 'explore') {
          this.navigate('explore');
        }
        clearTimeout(this.searchTimer);
        if (val) {
          ['filter-genre', 'filter-country'].forEach(id => { document.getElementById(id).value = 'all'; });
        }
        this.searchTimer = setTimeout(() => this.filterMovies(), 300);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        clearBtn.classList.add('hidden');
        clearTimeout(this.searchTimer);
        this.filterMovies();
      });
    }

    // Modal Remote guide
    const guideBtn = document.getElementById('tv-guide-btn');
    const guideModal = document.getElementById('tv-guide-modal');
    const closeBtn = document.getElementById('close-guide-btn');
    const ackBtn = document.getElementById('ack-guide-btn');

    if (guideBtn && guideModal) {
      guideBtn.addEventListener('click', () => guideModal.classList.remove('hidden'));
    }
    [closeBtn, ackBtn].forEach(b => {
      if (b && guideModal) {
        b.addEventListener('click', () => guideModal.classList.add('hidden'));
      }
    });
  }
};

// Start application
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});