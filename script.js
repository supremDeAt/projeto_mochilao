/* =====================================================
   O MOCHILÃO AVENTURAS — script.js
   Organizado em módulos: Navbar, Sidebar, Reveal, Counters
   ===================================================== */

(function () {
  'use strict';

  /* ─────────────────────────────────────────
     1. NAVBAR — adiciona fundo ao fazer scroll
     ───────────────────────────────────────── */
  const navbar = document.getElementById('navbar');

  function handleNavbarScroll() {
    if (window.scrollY > 60) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', handleNavbarScroll, { passive: true });
  handleNavbarScroll(); // Verificar estado inicial

  /* ── Link ativo no menu, baseado na secção visível ── */
  var navLinks = document.querySelectorAll('.navbar__link[href^="#"]:not(.navbar__link--cta), .sidebar__link[href^="#"]:not([href="#hero"])');
  var sectionIds = Array.from(new Set(
    Array.from(navLinks).map(function(link) {
      return link.getAttribute('href').replace('#', '');
    })
  ));
  var sections = sectionIds.map(function(id) {
    return document.getElementById(id);
  }).filter(Boolean);

  function updateActiveLink() {
    var scrollY = window.scrollY + 120;
    var current = '';
    sections.forEach(function(section) {
      if (section && section.offsetTop <= scrollY) {
        current = section.id;
      }
    });
    navLinks.forEach(function(link) {
      var isActive = link.getAttribute('href') === '#' + current;
      link.classList.toggle('navbar__link--active', isActive && link.classList.contains('navbar__link'));
      link.classList.toggle('sidebar__link--active', isActive && link.classList.contains('sidebar__link'));
    });
  }

  window.addEventListener('scroll', updateActiveLink, { passive: true });
  updateActiveLink();


  /* ─────────────────────────────────────────
     2. MENU — abrir / fechar
     Desktop/tablet: os links deslizam dentro da
     própria navbar (da direita para a esquerda).
     Mobile estreito: usa a sidebar lateral.
     ───────────────────────────────────────── */
  const navLinksBar    = document.getElementById('navLinks');
  const sidebar        = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const burgerBtn      = document.getElementById('burgerBtn');
  const closeBtn       = document.getElementById('closeBtn');

  function useSidebar() {
    return window.innerWidth <= 640; // ecrã estreito demais para links inline
  }

  function isMenuOpen() {
    return useSidebar()
      ? sidebar.classList.contains('is-open')
      : navLinksBar.classList.contains('is-open');
  }

  function openMenu() {
    if (useSidebar()) {
      sidebar.classList.add('is-open');
      sidebarOverlay.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    } else {
      navLinksBar.classList.add('is-open');
    }
    burgerBtn.classList.add('is-active');
    burgerBtn.setAttribute('aria-expanded', 'true');
    burgerBtn.setAttribute('aria-label', 'Fechar menu');
  }

  function closeMenu() {
    sidebar.classList.remove('is-open');
    sidebarOverlay.classList.remove('is-open');
    navLinksBar.classList.remove('is-open');
    document.body.style.overflow = '';
    burgerBtn.classList.remove('is-active');
    burgerBtn.setAttribute('aria-expanded', 'false');
    burgerBtn.setAttribute('aria-label', 'Abrir menu');
  }

  function toggleMenu() {
    if (isMenuOpen()) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  burgerBtn.addEventListener('click', toggleMenu);
  closeBtn.addEventListener('click', closeMenu);
  sidebarOverlay.addEventListener('click', closeMenu);

  // Fechar ao clicar num link (navbar ou sidebar)
  document.querySelectorAll('.navbar__link, .sidebar__link').forEach(function (link) {
    link.addEventListener('click', closeMenu);
  });

  // Fechar ao redimensionar para o outro modo (evita estado inconsistente)
  window.addEventListener('resize', closeMenu);

  // Fechar com tecla Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isMenuOpen()) {
      closeMenu();
    }
  });


  /* ─────────────────────────────────────────
     3. SCROLL REVEAL — Intersection Observer
     ───────────────────────────────────────── */
  const revealElements = document.querySelectorAll(
    '.reveal-up, .reveal-left, .reveal-right, .reveal-fade'
  );

  if (revealElements.length > 0) {
    const revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target); // Anima apenas uma vez
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    revealElements.forEach(function (el) {
      revealObserver.observe(el);
    });
  }


  /* ─────────────────────────────────────────
     4. CONTADORES ANIMADOS
     ───────────────────────────────────────── */
  const countersSection = document.getElementById('counters');
  let countersStarted   = false;

  function animateCounter(el) {
    const target    = parseInt(el.getAttribute('data-target'), 10);
    const duration  = 1800; // ms
    const startTime = performance.now();

    function step(currentTime) {
      const elapsed  = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing: ease-out cubic
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(easedProgress * target);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = target;
      }
    }

    requestAnimationFrame(step);
  }

  if (countersSection) {
    const counterObserver = new IntersectionObserver(
      function (entries) {
        if (entries[0].isIntersecting && !countersStarted) {
          countersStarted = true;
          // Animar barras douradas
          countersSection.classList.add('counters--visible');
          // Animar números
          document.querySelectorAll('.counter__num').forEach(function (num) {
            animateCounter(num);
          });
          counterObserver.disconnect();
        }
      },
      { threshold: 0.4 }
    );

    counterObserver.observe(countersSection);
  }

  /* ─────────────────────────────────────────
     4b. PARALLAX NA IMAGEM DO ABOUT
     ───────────────────────────────────────── */
  var aboutImage = document.querySelector('.about__image');
  if (aboutImage && window.innerWidth > 768) {
    window.addEventListener('scroll', function () {
      var rect = aboutImage.getBoundingClientRect();
      var visible = rect.top < window.innerHeight && rect.bottom > 0;
      if (visible) {
        var progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
        var offset = (progress - 0.5) * 60; // máx ±30px
        aboutImage.style.backgroundPositionY = 'calc(50% + ' + offset + 'px)';
      }
    }, { passive: true });
  }


  /* ─────────────────────────────────────────
     5. BOTÃO "VOLTAR AO TOPO" — mostrar / esconder
     ───────────────────────────────────────── */
  const topBtn = document.querySelector('.float-btn--top');

  if (topBtn) {
    function toggleTopBtn() {
      topBtn.style.opacity   = window.scrollY > 300 ? '1' : '0';
      topBtn.style.pointerEvents = window.scrollY > 300 ? 'auto' : 'none';
    }

    topBtn.style.transition = 'opacity 0.3s ease';
    topBtn.style.opacity    = '0';
    topBtn.style.pointerEvents = 'none';

    window.addEventListener('scroll', toggleTopBtn, { passive: true });
  }

  /* ─────────────────────────────────────────
     5b. PARALLAX CARDS — flutuam suavemente
         enquanto o utilizador faz scroll
     ───────────────────────────────────────── */
  var overlapCards = document.querySelectorAll('.hero__cards-overlap .tour-card');
  var heroEl = document.querySelector('.hero');

  function isMobile() { return window.innerWidth <= 540; }

  if (overlapCards.length && heroEl) {
    function onScrollParallax() {
      if (isMobile()) return; // desliga em mobile
      var heroBottom = heroEl.getBoundingClientRect().bottom;
      var viewH = window.innerHeight;
      var progress = 1 - Math.min(Math.max(heroBottom / viewH, 0), 1);

      overlapCards.forEach(function (card, i) {
        var offset = progress * (18 + i * 6);
        card.style.setProperty('--parallax-y', (-offset) + 'px');
      });
    }

    window.addEventListener('scroll', onScrollParallax, { passive: true });
  }

  /* ─────────────────────────────────────────
     5c. ENTRADA DOS CARDS — trigger imediato
         após carregamento da página
     ───────────────────────────────────────── */
  var overlapReveal = document.querySelectorAll('.hero__cards-overlap .tour-card.reveal-up');
  if (overlapReveal.length) {
    // Espera a página carregar, depois anima os cards
    window.addEventListener('load', function () {
      overlapReveal.forEach(function (card) {
        // Pequeno timeout para garantir que o browser pintou o estado inicial
        setTimeout(function () {
          card.classList.add('is-visible');
        }, 200);
      });
    });
  }

})();