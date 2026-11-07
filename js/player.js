/**
 * SFlix Video Player Module with Plyr.js & Hls.js Integration
 */
const PlayerController = {
  playerInstance: null,
  hlsInstance: null,

  init() {
    const videoElement = document.getElementById('player');
    if (!videoElement) return;

    this.playerInstance = new Plyr(videoElement, {
      iconUrl: 'https://cdn.jsdelivr.net/npm/plyr@3.7.8/dist/plyr.svg',
      controls: [
        'play-large', 'play', 'progress', 'current-time', 'duration',
        'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'
      ],
      keyboard: { focused: false, global: false } // Sẽ được TVNavigator quản lý để tránh xung đột
    });

    const qualitySelect = document.getElementById('video-quality');
    if (qualitySelect) {
      qualitySelect.addEventListener('change', () => {
        if (this.hlsInstance) {
          this.hlsInstance.currentLevel = Number(qualitySelect.value);
        }
      });
    }
  },

  loadStream(streamUrl) {
    const videoElement = document.getElementById('player');
    const embedElement = document.getElementById('player-embed');
    if (!videoElement || !embedElement) return;

    this.clearStream();
    const qualitySelect = document.getElementById('video-quality');

    let url;
    try {
      url = new URL(streamUrl);
    } catch {
      throw new Error('Đường dẫn phát phim không hợp lệ.');
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('Nguồn phát phim không dùng giao thức được hỗ trợ.');
    }

    const isHls = /\.m3u8(?:$|[?#])/i.test(url.href);
    if (!isHls && !/\.(?:mp4|webm|ogg)(?:$|[?#])/i.test(url.href)) {
      this.setQualityOptions([], false, 'Không áp dụng cho nguồn này');
      embedElement.src = url.href;
      embedElement.classList.remove('hidden');
      videoElement.closest('.plyr')?.classList.add('hidden');
      return;
    }

    this.setQualityOptions([], true);

    if (window.Hls?.isSupported() && isHls) {
      const hls = new Hls({
        autoStartLoad: true
      });
      hls.loadSource(url.href);
      hls.attachMedia(videoElement);
      this.hlsInstance = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const levels = hls.levels
          .map((level, index) => ({ height: level.height, index }))
          .filter(level => level.height > 0)
          .sort((a, b) => b.height - a.height);
        const uniqueLevels = levels.filter((level, index) =>
          levels.findIndex(candidate => candidate.height === level.height) === index
        );
        this.setQualityOptions(uniqueLevels, false);
        videoElement.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal && qualitySelect) {
          this.setQualityOptions([], false, 'Không tải được chất lượng');
        }
      });
    } else {
      if (isHls && !videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        this.setQualityOptions([], false, 'Trình duyệt không hỗ trợ HLS');
        throw new Error('Trình duyệt này không hỗ trợ phát HLS.');
      }
      this.setQualityOptions([], false, isHls ? 'Tự động' : 'Không áp dụng');
      videoElement.src = url.href;
      videoElement.play().catch(() => {});
    }
  },

  clearStream() {
    const videoElement = document.getElementById('player');
    const embedElement = document.getElementById('player-embed');
    if (!videoElement || !embedElement) return;

    if (this.hlsInstance) {
      this.hlsInstance.destroy();
      this.hlsInstance = null;
    }
    if (this.playerInstance) this.playerInstance.pause();
    videoElement.pause();
    videoElement.removeAttribute('src');
    videoElement.load();
    embedElement.src = 'about:blank';
    embedElement.classList.add('hidden');
    videoElement.closest('.plyr')?.classList.remove('hidden');
    this.setQualityOptions([], false, 'Chưa chọn nguồn phát');
  },

  setQualityOptions(levels, loading, label = 'Tự động') {
    const qualitySelect = document.getElementById('video-quality');
    if (!qualitySelect) return;

    qualitySelect.replaceChildren();
    if (loading) {
      qualitySelect.add(new Option('Đang tải...', '-1'));
      qualitySelect.disabled = true;
      return;
    }

    qualitySelect.add(new Option(label, '-1'));
    levels.forEach(level => {
      qualitySelect.add(new Option(`${level.height}p`, String(level.index)));
    });
    qualitySelect.value = '-1';
    qualitySelect.disabled = levels.length === 0;
  },

  togglePlay() {
    if (!this.playerInstance) return;
    this.playerInstance.togglePlay();
  },

  toggleFullscreen() {
    if (!this.playerInstance) return;
    this.playerInstance.fullscreen.toggle();
  },

  destroy() {
    if (this.hlsInstance) {
      this.hlsInstance.destroy();
      this.hlsInstance = null;
    }
    if (this.playerInstance) {
      this.playerInstance.stop();
    }
  }
};