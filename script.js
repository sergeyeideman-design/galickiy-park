(() => {
  'use strict';

  const doc = document;
  const root = doc.documentElement;
  const header = doc.querySelector('[data-header]');
  const menuToggle = doc.querySelector('[data-menu-toggle]');
  const menuLabel = doc.querySelector('[data-menu-label]');
  const mobileMenu = doc.querySelector('[data-mobile-menu]');
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* -----------------------------------------------------------------------
     Park clock: Krasnodar is UTC+3 all year round.
     ----------------------------------------------------------------------- */
  const clockFormat = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const getParkState = () => {
    const parts = clockFormat.formatToParts(new Date());
    const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
    const minutes = hour * 60 + minute;
    return {
      time: clockFormat.format(new Date()),
      isOpen: minutes >= 300 && minutes < 1440,
    };
  };

  const updateParkClock = () => {
    const state = getParkState();

    doc.querySelectorAll('[data-park-clock]').forEach((node) => {
      node.textContent = state.time;
    });

    doc.querySelectorAll('[data-park-live]').forEach((node) => {
      node.textContent = state.isOpen ? 'открыто' : 'закрыто';
    });

    doc.querySelectorAll('[data-park-status]').forEach((node) => {
      const dot = node.querySelector('.status-dot');
      if (dot) dot.classList.toggle('is-closed', !state.isOpen);
      node.setAttribute(
        'aria-label',
        state.isOpen
          ? `Сейчас ${state.time}, парк открыт до 24:00`
          : `Сейчас ${state.time}, парк закрыт до 05:00`
      );
    });

    const year = doc.querySelector('[data-year]');
    if (year) year.textContent = String(new Date().getFullYear());
  };

  updateParkClock();
  window.setInterval(updateParkClock, 30000);

  /* -----------------------------------------------------------------------
     Header, menu and scroll spy
     ----------------------------------------------------------------------- */
  let menuOpen = false;
  let lastFocused = null;

  const focusableInMenu = () =>
    Array.from(mobileMenu.querySelectorAll('a[href], button:not([disabled])')).filter(
      (el) => el.offsetParent !== null
    );

  const openMenu = () => {
    if (!mobileMenu || !menuToggle || menuOpen) return;
    menuOpen = true;
    lastFocused = doc.activeElement;
    menuToggle.setAttribute('aria-expanded', 'true');
    if (menuLabel) menuLabel.textContent = 'Закрыть меню';
    mobileMenu.classList.add('is-open');
    doc.body.classList.add('menu-open');
    header.classList.add('is-scrolled');
    window.setTimeout(() => {
      const first = focusableInMenu()[0];
      if (first) first.focus();
    }, 40);
  };

  const closeMenu = (returnFocus = true) => {
    if (!mobileMenu || !menuToggle || !menuOpen) return;
    menuOpen = false;
    menuToggle.setAttribute('aria-expanded', 'false');
    if (menuLabel) menuLabel.textContent = 'Открыть меню';
    mobileMenu.classList.remove('is-open');
    doc.body.classList.remove('menu-open');
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 12);
    if (returnFocus) {
      const target = lastFocused instanceof HTMLElement && lastFocused !== doc.body ? lastFocused : menuToggle;
      target.focus();
    }
  };

  menuToggle?.addEventListener('click', () => {
    if (menuOpen) closeMenu();
    else openMenu();
  });

  mobileMenu?.querySelectorAll('a[href]').forEach((link) => {
    link.addEventListener('click', () => closeMenu(false));
  });

  doc.addEventListener('keydown', (event) => {
    if (!menuOpen) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = focusableInMenu();
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && doc.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && doc.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.matchMedia('(min-width: 1081px)').addEventListener('change', (event) => {
    if (event.matches) closeMenu(false);
  });

  const navLinks = Array.from(doc.querySelectorAll('.nav a[href^="#"]'));
  const navSections = navLinks
    .map((link) => {
      const id = link.getAttribute('href').slice(1);
      const section = doc.getElementById(id);
      return section ? { link, section } : null;
    })
    .filter(Boolean);

  let ticking = false;

  const updateOnScroll = () => {
    ticking = false;

    if (header) {
      header.classList.toggle('is-scrolled', window.scrollY > 12 || menuOpen);
    }

    if (!navSections.length) return;

    const marker = window.scrollY + (parseInt(getComputedStyle(root).getPropertyValue('--header-h'), 10) || 84) + 90;
    let active = null;

    navSections.forEach((item) => {
      if (marker >= item.section.offsetTop) active = item;
    });

    navLinks.forEach((link) => {
      const isActive = Boolean(active && active.link === link);
      link.classList.toggle('is-active', isActive);
      if (isActive) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  };

  const requestScrollUpdate = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateOnScroll);
  };

  window.addEventListener('scroll', requestScrollUpdate, { passive: true });
  window.addEventListener('resize', requestScrollUpdate, { passive: true });
  updateOnScroll();

  /* -----------------------------------------------------------------------
     Tabs: guests / locals
     ----------------------------------------------------------------------- */
  const tabsRoot = doc.querySelector('.tabs');
  const tabs = Array.from(doc.querySelectorAll('[role="tab"]'));
  const panels = Array.from(doc.querySelectorAll('[role="tabpanel"]'));

  const activateTab = (tab, moveFocus = false) => {
    if (!tab || !tabsRoot) return;

    tabs.forEach((item) => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
    });

    panels.forEach((panel) => {
      const selected = panel.id === tab.getAttribute('aria-controls');
      panel.hidden = !selected;
      panel.classList.remove('is-entering');
      if (selected && !prefersReduced) {
        void panel.offsetWidth;
        panel.classList.add('is-entering');
      }
    });

    tabsRoot.classList.toggle('is-locals', tab.id === 'tab-locals');

    if (moveFocus) tab.focus();
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateTab(tab));

    tab.addEventListener('keydown', (event) => {
      let nextIndex = index;

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        nextIndex = (index + 1) % tabs.length;
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        nextIndex = (index - 1 + tabs.length) % tabs.length;
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = tabs.length - 1;
      } else {
        return;
      }

      event.preventDefault();
      activateTab(tabs[nextIndex], true);
    });
  });

  /* -----------------------------------------------------------------------
     Scroll reveals
     ----------------------------------------------------------------------- */
  const revealItems = Array.from(doc.querySelectorAll('.reveal'));

  if (!('IntersectionObserver' in window) || prefersReduced) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );

    revealItems.forEach((item) => revealObserver.observe(item));
  }

  /* -----------------------------------------------------------------------
     Small niceties
     ----------------------------------------------------------------------- */
  doc.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', () => {
      if (link.closest('.mobile-menu')) closeMenu(false);
    });
  });

  // If a browser restores focus inside a hidden tab panel, bring it back.
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'visible' && menuOpen && !mobileMenu.classList.contains('is-open')) {
      closeMenu(false);
    }
  });
})();
