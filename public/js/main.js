(() => {
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('mainNav');
  const mobileQuery = window.matchMedia('(max-width: 1099px)');

  if (toggle && nav) {
    let isOpen = false;
    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    const setExpandedState = open => {
      isOpen = open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Chiudi il menu' : 'Apri il menu');
      nav.classList.toggle('is-open', open);
      document.body.classList.toggle('nav-open', open);

      if (mobileQuery.matches) {
        nav.hidden = !open;
        nav.inert = !open;
      } else {
        nav.hidden = false;
        nav.inert = false;
      }
    };

    const closeMenu = (returnFocus = false) => {
      if (!isOpen && mobileQuery.matches) {
        nav.hidden = true;
        nav.inert = true;
        return;
      }
      setExpandedState(false);
      if (returnFocus && mobileQuery.matches) toggle.focus();
    };

    const openMenu = () => {
      setExpandedState(true);
      const focusable = [...nav.querySelectorAll(focusableSelector)];
      if (focusable.length) focusable[0].focus();
    };

    const syncNavigationMode = () => {
      if (mobileQuery.matches) {
        closeMenu(false);
      } else {
        setExpandedState(false);
      }
    };

    toggle.addEventListener('click', () => {
      if (isOpen) closeMenu(true);
      else openMenu();
    });

    document.addEventListener('click', event => {
      if (isOpen && !nav.contains(event.target) && !toggle.contains(event.target)) {
        closeMenu(true);
      }
    });

    document.addEventListener('keydown', event => {
      if (!isOpen || !mobileQuery.matches) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu(true);
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = [...nav.querySelectorAll(focusableSelector)]
        .filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    nav.addEventListener('click', event => {
      if (mobileQuery.matches && event.target.closest('a')) closeMenu(false);
    });

    if (typeof mobileQuery.addEventListener === 'function') {
      mobileQuery.addEventListener('change', syncNavigationMode);
    } else {
      mobileQuery.addListener(syncNavigationMode);
    }

    syncNavigationMode();
    document.documentElement.classList.add('nav-enhanced');
  }

  document.querySelectorAll('img[src^="/uploads/"]').forEach(image => {
    const removeFailedImage = () => {
      const mediaOnlyContainer = image.closest(
        'figure, .news-lead__media, .archive-lead__media'
      );
      if (mediaOnlyContainer) mediaOnlyContainer.remove();
      else image.remove();
    };

    if (image.complete && image.naturalWidth === 0) removeFailedImage();
    else image.addEventListener('error', removeFailedImage, { once: true });
  });

  const formFeedback = document.getElementById('form-feedback');
  if (formFeedback && formFeedback.getAttribute('role') === 'status') {
    formFeedback.focus({ preventScroll: true });
  }
})();
