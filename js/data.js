/**
 * SFlix movie catalog and NguonC API adapter.
 */
const MovieDB = {
  apiBase: 'https://phim.nguonc.com/api',
  apiMovies: new Map(),
  catalogFilters: {
    genres: [
      { slug: 'hanh-dong', name: 'Hành động' },
      { slug: 'tinh-cam', name: 'Tình cảm' },
      { slug: 'kinh-di', name: 'Kinh dị' },
      { slug: 'co-trang', name: 'Cổ trang' },
      { slug: 'phieu-luu', name: 'Phiêu lưu' },
      { slug: 'khoa-hoc-vien-tuong', name: 'Khoa học viễn tưởng' },
      { slug: 'tam-ly', name: 'Tâm lý' },
      { slug: 'chinh-kich', name: 'Chính kịch' },
      { slug: 'hinh-su', name: 'Hình sự' },
      { slug: 'bi-an', name: 'Bí ẩn' },
      { slug: 'gia-dinh', name: 'Gia đình' },
      { slug: 'chien-tranh', name: 'Chiến tranh' },
      { slug: 'tai-lieu', name: 'Tài liệu' }
    ],
    countries: [
      { slug: 'my', name: 'Mỹ' },
      { slug: 'viet-nam', name: 'Việt Nam' },
      { slug: 'trung-quoc', name: 'Trung Quốc' },
      { slug: 'han-quoc', name: 'Hàn Quốc' },
      { slug: 'nhat-ban', name: 'Nhật Bản' },
      { slug: 'thai-lan', name: 'Thái Lan' },
      { slug: 'anh', name: 'Anh' },
      { slug: 'uc', name: 'Úc' },
      { slug: 'canada', name: 'Ca-na-đa' },
      { slug: 'duc', name: 'Đức' },
      { slug: 'nga', name: 'Nga' },
      { slug: 'indonesia', name: 'In-đô-nê-xi-a' },
      { slug: 'philippines', name: 'Phi-líp-pin' },
      { slug: 'tho-nhi-ky', name: 'Thổ Nhĩ Kỳ' },
      { slug: 'tay-ban-nha', name: 'Tây Ban Nha' }
    ],
    languages: [
      { slug: 'vietsub', name: 'Vietsub' },
      { slug: 'thuyet-minh', name: 'Thuyết minh' },
      { slug: 'long-tieng', name: 'Lồng tiếng' }
    ]
  },

  movies: [

  ],

  getTrending() {
    return this.movies.filter(m => m.isTrending);
  },

  getByGenre(genre) {
    return this.movies.filter(m => m.genre === genre);
  },

  getById(id) {
    return this.movies.find(m => m.id === id) || this.apiMovies.get(id) || this.movieFromId(id);
  },

  movieFromId(id) {
    const prefix = 'nguonc--';
    if (!id.startsWith(prefix)) return null;
    const slug = id.slice(prefix.length);
    if (!slug) return null;
    return {
      id,
      source: 'nguonc',
      slug,
      title: 'Đang tải phim...',
      originalTitle: '',
      year: '',
      category: 'series',
      genre: '',
      country: '',
      rating: 0,
      duration: '',
      poster: '',
      banner: '',
      overview: ''
    };
  },

  async fetchCatalog({ page = 1, search = '', genre = 'all', country = 'all', year = 'all', language = 'all', type = 'latest' } = {}) {
    let path;
    const params = new URLSearchParams({ page: String(page) });

    if (type === 'animation') {
      path = '/films/danh-sach/hoat-hinh';
    } else if (search.trim()) {
      path = '/films/search';
      params.set('keyword', search.trim());
    } else if (genre !== 'all') {
      const selectedGenre = this.catalogFilters.genres.find(item =>
        item.slug === genre || this.toSlug(item.name) === this.toSlug(genre)
      );
      const genreSlug = selectedGenre?.slug || this.toSlug(genre);
      path = `/films/the-loai/${genreSlug}`;
    } else if (country !== 'all') {
      const selectedCountry = this.catalogFilters.countries.find(item => item.slug === country);
      path = `/films/quoc-gia/${selectedCountry?.slug || this.toSlug(country)}`;
    } else if (year !== 'all') {
      path = `/films/nam-phat-hanh/${encodeURIComponent(year)}`;
    } else if (language !== 'all') {
      path = `/films/ngon-ngu/${language}`;
    } else if (type === 'series') {
      path = '/films/danh-sach/phim-bo';
    } else if (type === 'movies') {
      path = '/films/danh-sach/phim-le';
    } else {
      path = '/films/phim-moi-cap-nhat';
    }

    const response = await fetch(`${this.apiBase}${path}?${params.toString()}`);
    if (!response.ok) throw new Error(`NguonC trả về HTTP ${response.status}`);
    const data = await response.json();
    if (data.status !== 'success' || !Array.isArray(data.items)) {
      throw new Error('NguonC trả về dữ liệu danh sách không hợp lệ.');
    }

    const appliedFilters = {
      genre: type !== 'animation' && !search.trim() && genre !== 'all'
        ? this.catalogFilters.genres.find(item => item.slug === genre || this.toSlug(item.name) === this.toSlug(genre))?.name || ''
        : 'all',
      country: type !== 'animation' && !search.trim() && genre === 'all' && country !== 'all'
        ? this.catalogFilters.countries.find(item => item.slug === country)?.name || ''
        : 'all',
      type: type === 'animation'
        ? type
        : !search.trim() && genre === 'all' && country === 'all' && year === 'all' && language === 'all'
          ? type
          : 'latest'
    };
    const movies = data.items
      .filter(item => type !== 'animation' || !search.trim() || `${item.name || ''} ${item.original_name || ''}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')))
      .map(item => this.normalizeMovie(item, appliedFilters));
    movies.forEach(movie => this.apiMovies.set(movie.id, movie));
    return { movies, pagination: data.paginate || null };
  },

  async fetchMovieDetail(movie) {
    if (!movie || movie.source !== 'nguonc') return movie;

    const response = await fetch(`${this.apiBase}/film/${encodeURIComponent(movie.slug)}`);
    if (!response.ok) throw new Error(`Không tải được thông tin phim (HTTP ${response.status}).`);
    const data = await response.json();
    if (data.status !== 'success' || !data.movie) {
      throw new Error('NguonC không trả về thông tin phim hợp lệ.');
    }

    const sourceMovie = data.movie;
    const categories = Object.values(sourceMovie.category || {});
    const findCategory = keyword => {
      const group = categories.find(item => (item.group?.name || '').toLocaleLowerCase('vi').includes(keyword));
      return group?.list?.map(item => item.name).filter(Boolean) || [];
    };
    const genres = findCategory('thể loại');
    const countries = findCategory('quốc gia');
    const servers = (Array.isArray(sourceMovie.episodes) ? sourceMovie.episodes : [])
      .filter(server => Array.isArray(server.items) && server.items.length)
      .map(server => ({ name: server.server_name || 'Server', items: server.items }));
    const detail = {
      ...movie,
      title: sourceMovie.name || movie.title,
      originalTitle: sourceMovie.original_name || movie.originalTitle,
      year: Number.parseInt(sourceMovie.year, 10) || movie.year,
      category: Number.parseInt(sourceMovie.total_episodes, 10) > 1 ? 'series' : 'movie',
      genre: genres.join(', ') || movie.genre,
      country: countries.join(', ') || movie.country,
      rating: Number(sourceMovie.tmdb?.vote_average) || movie.rating,
      duration: sourceMovie.time || movie.duration,
      overview: sourceMovie.description || movie.overview,
      poster: sourceMovie.thumb_url || sourceMovie.poster_url || movie.poster,
      banner: sourceMovie.poster_url_webp || sourceMovie.poster_url || sourceMovie.thumb_url_webp || sourceMovie.thumb_url || movie.banner,
      servers,
      episodes: servers[0]?.items.length || 0
    };
    this.apiMovies.set(detail.id, detail);
    return detail;
  },

  normalizeMovie(item, filters = {}) {
    const id = `nguonc--${item.slug}`;
    const totalEpisodes = Number.parseInt(item.total_episodes, 10) || 0;
    const title = item.name || 'Chưa có tên phim';
    const category = filters.type === 'series'
      ? 'series'
      : filters.type === 'movies'
        ? 'movie'
        : item.tmdb?.type === 'tv' || totalEpisodes > 1
          ? 'series'
          : 'movie';
    return {
      id,
      source: 'nguonc',
      slug: item.slug,
      title,
      originalTitle: item.original_name || '',
      category,
      catalogType: filters.type === 'animation' ? 'animation' : '',
      genre: filters.genre && filters.genre !== 'all' ? filters.genre : '',
      country: filters.country && filters.country !== 'all' ? filters.country : '',
      year: Number.parseInt(item.year, 10) || '',
      rating: Number(item.tmdb?.vote_average) || 0,
      duration: item.time || '',
      language: item.language || '',
      isTrending: true,
      banner: item.poster_url_webp || item.poster_url || item.thumb_url_webp || item.thumb_url || '',
      poster: item.thumb_url_webp || item.thumb_url || item.poster_url_webp || item.poster_url || '',
      videoUrl: '',
      episodes: totalEpisodes,
      overview: item.description || ''
    };
  },

  toSlug(value) {
    return value
      .toLocaleLowerCase('vi')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
};