/**
 * Spatial TV Remote & D-Pad Keyboard Navigation Engine
 * Hỗ trợ: Phím mũi tên (ArrowUp, ArrowDown, ArrowLeft, ArrowRight), Enter, Backspace, Escape, Space, F
 * Tự động tính toán khoảng cách 2D để nhảy tới phần tử trực quan gần nhất (Spatial Navigation)
 */
const TVNavigator = {
  currentFocus: null,
  focusableSelector: '.tv-focusable:not([disabled]):not(.hidden)',

  init() {
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    // Chuột hover vào element cũng tự cập nhật focus
    document.addEventListener('mouseover', (e) => {
      const target = e.target.closest(this.focusableSelector);
      if (target && target !== this.currentFocus) {
        this.setFocus(target, false);
      }
    });

    // Thiết lập focus đầu tiên sau khi trang load
    setTimeout(() => {
      if (!this.currentFocus) {
        const first = document.querySelector(this.focusableSelector);
        if (first) this.setFocus(first);
      }
    }, 400);
  },

  getFocusableElements() {
    // Chỉ lấy các elements nằm trong trang đang hiển thị
    return Array.from(document.querySelectorAll(this.focusableSelector)).filter(el => {
      return el.offsetParent !== null && !el.closest('.hidden');
    });
  },

  setFocus(el, shouldScroll = true) {
    if (!el) return;
    if (this.currentFocus) {
      this.currentFocus.classList.remove('tv-focused');
    }
    this.currentFocus = el;
    el.classList.add('tv-focused');
    el.focus({ preventScroll: true });

    if (shouldScroll) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  },

  handleKeyDown(e) {
    // Khi đang gõ phím trong ô tìm kiếm, không chặn các nút mũi tên trừ Enter/Esc
    if (document.activeElement && document.activeElement.tagName === 'INPUT') {
      if (e.key === 'Escape' || e.key === 'ArrowDown') {
        document.activeElement.blur();
        const firstMovie = document.querySelector('.movie-card.tv-focusable');
        if (firstMovie) this.setFocus(firstMovie);
        e.preventDefault();
      }
      return;
    }

    const key = e.key;
    const isDirection = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key);

    if (isDirection) {
      e.preventDefault();
      this.navigateDirection(key);
      return;
    }

    if (key === 'Enter') {
      if (this.currentFocus) {
        e.preventDefault();
        this.currentFocus.click();
      }
      return;
    }

    if (key === 'Escape' || key === 'Backspace' || key === 'BrowserBack') {
      // Nếu modal đang mở thì đóng modal
      const guideModal = document.getElementById('tv-guide-modal');
      if (guideModal && !guideModal.classList.contains('hidden')) {
        e.preventDefault();
        guideModal.classList.add('hidden');
        return;
      }
      // Nếu đang ở trang xem phim thì back về trang chủ
      if (window.location.hash.startsWith('#watch')) {
        e.preventDefault();
        window.history.back();
      }
      return;
    }

    // Media shortcuts
    if (key === ' ' || key === 'Spacebar') {
      e.preventDefault();
      if (window.PlayerController) window.PlayerController.togglePlay();
    } else if (key === 'f' || key === 'F') {
      e.preventDefault();
      if (window.PlayerController) window.PlayerController.toggleFullscreen();
    }
  },

  navigateDirection(direction) {
    const elements = this.getFocusableElements();
    if (!elements.length) return;

    if (!this.currentFocus || !elements.includes(this.currentFocus)) {
      this.setFocus(elements[0]);
      return;
    }

    const currentRect = this.currentFocus.getBoundingClientRect();
    const currentCenter = {
      x: currentRect.left + currentRect.width / 2,
      y: currentRect.top + currentRect.height / 2
    };

    let bestCandidate = null;
    let minDistance = Infinity;

    for (const el of elements) {
      if (el === this.currentFocus) continue;
      const rect = el.getBoundingClientRect();
      const center = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };

      const dx = center.x - currentCenter.x;
      const dy = center.y - currentCenter.y;

      let isValid = false;
      let primaryDist = 0;
      let secondaryDist = 0;

      switch (direction) {
        case 'ArrowRight':
          isValid = dx > 8; // ở phía bên phải
          primaryDist = dx;
          secondaryDist = Math.abs(dy);
          break;
        case 'ArrowLeft':
          isValid = dx < -8; // ở phía bên trái
          primaryDist = -dx;
          secondaryDist = Math.abs(dy);
          break;
        case 'ArrowDown':
          isValid = dy > 8; // ở phía dưới
          primaryDist = dy;
          secondaryDist = Math.abs(dx);
          break;
        case 'ArrowUp':
          isValid = dy < -8; // ở phía trên
          primaryDist = -dy;
          secondaryDist = Math.abs(dx);
          break;
      }

      if (isValid) {
        // Trọng số ưu tiên đi theo trục chính, phạt góc lệch lớn
        const score = primaryDist + (secondaryDist * 2.2);
        if (score < minDistance) {
          minDistance = score;
          bestCandidate = el;
        }
      }
    }

    if (bestCandidate) {
      this.setFocus(bestCandidate);
    }
  }
};