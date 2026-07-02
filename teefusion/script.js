// TeeFusion — interactions
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

  // === THEME ===
  const THEME_KEY = 'teefusion.theme';
  const getTheme = () => root.dataset.theme || localStorage.getItem(THEME_KEY) || 'dark';
  const setTheme = (t) => {
    root.dataset.theme = t;
    try { localStorage.setItem(THEME_KEY, t); } catch (_) {}
    document.querySelectorAll('[data-theme-toggle]').forEach((b) => {
      b.setAttribute('aria-label', t === 'dark' ? 'Light theme' : 'Dark theme');
    });
  };

  // Initial theme
  setTheme(getTheme());

  let swapping = false;
  const swapTheme = () => {
    if (swapping) return;
    const next = getTheme() === 'dark' ? 'light' : 'dark';

    if (!document.startViewTransition || reduceMotion) {
      setTheme(next);
      return;
    }

    // Origin = logo in the nav (first .logo-mark in DOM)
    const logo = document.querySelector('header .logo-mark') || document.querySelector('.logo-mark');
    const r = logo ? logo.getBoundingClientRect() : null;
    const cx = r ? r.left + r.width / 2 : 32;
    const cy = r ? r.top + r.height / 2 : 32;
    const radius = Math.hypot(
      Math.max(cx, innerWidth - cx),
      Math.max(cy, innerHeight - cy)
    ) + 24;

    swapping = true;
    const transition = document.startViewTransition(() => setTheme(next));
    transition.ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${cx}px ${cy}px)`,
              `circle(${radius}px at ${cx}px ${cy}px)`,
            ],
          },
          {
            duration: 620,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            pseudoElement: '::view-transition-new(root)',
          }
        );
      })
      .catch(() => {});
    transition.finished.finally(() => {
      swapping = false;
    });
  };

  document.querySelectorAll('[data-theme-toggle]').forEach((b) => {
    b.addEventListener('click', swapTheme);
  });

  // === LANG ===
  const LANG_KEY = 'teefusion.lang';
  const supported = ['ru', 'en'];
  const detectLang = () => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved && supported.includes(saved)) return saved;
    } catch (_) {}
    const nav = (navigator.language || 'ru').slice(0, 2);
    return supported.includes(nav) ? nav : 'ru';
  };

  const applyLang = (lang) => {
    const dict = (window.TF_I18N && window.TF_I18N[lang]) || {};
    root.lang = lang;
    try { localStorage.setItem(LANG_KEY, lang); } catch (_) {}

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const k = el.getAttribute('data-i18n');
      if (dict[k] != null) el.textContent = dict[k];
    });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const k = el.getAttribute('data-i18n-html');
      if (dict[k] != null) el.innerHTML = dict[k];
    });
    document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      // format: "attr:key,attr:key"
      const spec = el.getAttribute('data-i18n-attr');
      spec.split(',').forEach((pair) => {
        const [attr, key] = pair.split(':').map((s) => s.trim());
        if (attr && key && dict[key] != null) el.setAttribute(attr, dict[key]);
      });
    });
    if (dict['meta.title.' + (root.dataset.page || 'index')]) {
      document.title = dict['meta.title.' + (root.dataset.page || 'index')];
    }
    document.querySelectorAll('[data-lang-switch] button').forEach((b) => {
      b.setAttribute('aria-pressed', b.dataset.lang === lang ? 'true' : 'false');
    });
  };

  const initialLang = detectLang();
  applyLang(initialLang);

  document.querySelectorAll('[data-lang-switch] button').forEach((b) => {
    b.addEventListener('click', () => {
      applyLang(b.dataset.lang);
    });
  });

  // === NAV ===
  const nav = document.querySelector('[data-nav]');
  if (nav) {
    const onScroll = () => {
      if (window.scrollY > 12) nav.classList.add('scrolled');
      else nav.classList.remove('scrolled');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // === MOBILE DRAWER ===
  const burger = document.querySelector('[data-burger]');
  const drawer = document.querySelector('[data-drawer]');
  if (burger && drawer) {
    burger.addEventListener('click', () => {
      const open = drawer.classList.toggle('open');
      burger.setAttribute('aria-expanded', String(open));
    });
    drawer.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', () => {
        drawer.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      })
    );
  }

  // === REVEAL ON SCROLL ===
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target;
            const delay = parseInt(el.dataset.delay || '0', 10);
            setTimeout(() => el.classList.add('in'), delay);
            io.unobserve(el);
          }
        });
      },
      { rootMargin: '-8% 0px -8% 0px', threshold: 0.05 }
    );
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
  }

  // === COPY IP ===
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const value = btn.getAttribute('data-copy');
      try {
        await navigator.clipboard.writeText(value);
      } catch (_) {
        const tmp = document.createElement('textarea');
        tmp.value = value;
        document.body.appendChild(tmp);
        tmp.select();
        try { document.execCommand('copy'); } catch (e) {}
        tmp.remove();
      }
      const label = btn.querySelector('[data-copy-label]');
      const lang = root.lang || 'ru';
      const dict = (window.TF_I18N && window.TF_I18N[lang]) || {};
      const idleText = dict['servers.copy.idle'] || 'Copy';
      const doneText = dict['servers.copy.done'] || 'Copied';
      btn.classList.add('copied');
      if (label) label.textContent = doneText;
      clearTimeout(btn._t);
      btn._t = setTimeout(() => {
        btn.classList.remove('copied');
        if (label) label.textContent = idleText;
      }, 1400);
    });
  });

  // === HERO VIDEO DECK — rotate every ~15s ===
  const deck = document.querySelector('[data-hero-deck]');
  if (deck) {
    const videos = Array.from(deck.querySelectorAll('video'));
    if (videos.length) {
      let active = 0;
      videos[0].classList.add('is-active');
      videos.forEach((v) => {
        v.muted = true;
        v.playsInline = true;
        v.loop = false;
      });
      videos[0].play().catch(() => {});

      const footEl = document.querySelector('[data-hero-foot]');
      const setFoot = (v) => {
        if (!footEl) return;
        const key = v.getAttribute('data-foot');
        if (!key) return;
        footEl.setAttribute('data-i18n', key);
        const lang = root.lang || 'ru';
        const dict = (window.TF_I18N && window.TF_I18N[lang]) || {};
        if (dict[key] != null) footEl.textContent = dict[key];
      };
      setFoot(videos[0]);

      const ROTATE_MS = 15000;
      const advance = () => {
        const cur = videos[active];
        const next = (active + 1) % videos.length;
        const nextV = videos[next];
        nextV.currentTime = 0;
        nextV.play().catch(() => {});
        nextV.classList.add('is-active');
        cur.classList.remove('is-active');
        setFoot(nextV);
        setTimeout(() => {
          if (!cur.classList.contains('is-active')) {
            cur.pause();
            cur.currentTime = 0;
          }
        }, 900);
        active = next;
      };
      setInterval(advance, ROTATE_MS);
    }
  }

  // === MODE CARD VIDEOS — autoplay when in view ===
  if ('IntersectionObserver' in window) {
    const vio = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const v = e.target;
          if (e.isIntersecting) v.play().catch(() => {});
          else v.pause();
        });
      },
      { threshold: 0.25 }
    );
    document.querySelectorAll('video[data-loop]').forEach((v) => vio.observe(v));
  }

  // === RULES TOC ACTIVE ===
  const tocLinks = document.querySelectorAll('[data-toc] a');
  if (tocLinks.length) {
    const sections = Array.from(tocLinks)
      .map((a) => document.querySelector(a.getAttribute('href')))
      .filter(Boolean);
    const setActive = () => {
      const y = window.scrollY + 120;
      let active = sections[0];
      for (const s of sections) {
        if (s.offsetTop <= y) active = s;
      }
      tocLinks.forEach((a) =>
        a.classList.toggle('active', a.getAttribute('href') === '#' + active.id)
      );
    };
    setActive();
    window.addEventListener('scroll', setActive, { passive: true });
  }

  // === COUNT-UP ===
  const counts = document.querySelectorAll('[data-count-target]');
  counts.forEach((el) => {
    const target = parseInt(el.dataset.countTarget, 10);
    if (Number.isNaN(target)) return;
    if (reduceMotion) {
      el.textContent = String(target);
      return;
    }
    let started = false;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !started) {
          started = true;
          const dur = 1200;
          const t0 = performance.now();
          const tick = (t) => {
            const p = Math.min((t - t0) / dur, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = String(Math.round(eased * target));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          obs.disconnect();
        }
      });
    });
    obs.observe(el);
  });

  // === YEAR ===
  const yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();
})();
