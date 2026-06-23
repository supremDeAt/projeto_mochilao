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

  /* ─────────────────────────────────────────
     6. RESERVATION — FULL SCREEN PAGE
     ───────────────────────────────────────── */

  /* ── Dados de cada programa ──────────────
     Para adicionar fotos, preencha o array "photos" de cada destino:
     photos: ['imagens/foto1.webp', 'imagens/foto2.webp', ...]
  ─────────────────────────────────────────── */
  var TOUR_DATA = {
    'cabo-ledo': {
      title: 'Cabo Ledo',
      badge: 'Sobre Rodas',
      emoji: '🏄',
      duration: '1 dia',
      color: '#0e1e2a',
      description: 'Uma aventura completa pela costa angolana, desde as icónicas formações rochosas do Miradouro da Lua até às ondas da Praia dos Surfistas.',
      highlights: ['Miradouro da Lua', 'Gruta das Sereias', 'Praia dos Surfistas'],
      includes: ['Transporte ida e volta', 'Almoço incluído', 'Guia local experiente', 'Kit de boas-vindas'],
      maxSpots: 15,
      photos: [
        // 'imagens/caboledo-1.webp',
        // 'imagens/caboledo-2.webp',
        // 'imagens/caboledo-3.webp',
        // 'imagens/caboledo-4.webp',
        // 'imagens/caboledo-5.webp',
      ],
    },
    'quicama': {
      title: 'Quiçama',
      badge: 'Safari',
      emoji: '🦏',
      duration: '1 dia',
      color: '#0e1a0a',
      description: 'Safari guiado no maior parque nacional de Angola, com observação de fauna selvagem e encerramento no Miradouro da Lua.',
      highlights: ['Parque Nacional da Quiçama', 'Safari com guia especializado', 'Almoço típico angolano', 'Miradouro da Lua'],
      includes: ['Transporte 4×4', 'Almoço local', 'Guia especializado em fauna', 'Seguro de viagem'],
      maxSpots: 12,
      photos: [],
    },
    'huambo': {
      title: 'Huambo — Kifuka Camping',
      badge: 'Camping · 3 dias',
      emoji: '⛺',
      duration: '3 dias / 2 noites',
      color: '#0d0d1e',
      description: 'Acampamento no Huambo, com trilhas ecológicas, fogueiras noturnas e imersão total na natureza angolana das serras.',
      highlights: ['Kifuka camping', 'Trilhas guiadas', 'Fogueiras noturnas', 'Piscinas naturais'],
      includes: ['Tendas e equipamento', 'Alimentação completa', 'Água ilimitada', 'Trilhas guiadas', 'Kit de segurança'],
      maxSpots: 20,
      photos: [],
    },
    'personalizado': {
      title: 'Programa Personalizado',
      badge: 'À Medida',
      emoji: '🗺️',
      duration: 'À sua escolha',
      color: '#2a1a0a',
      description: 'Crie o seu roteiro de sonho com a nossa equipa. Destino, duração, atividades e orçamento definidos totalmente à sua medida.',
      highlights: ['Destino à sua escolha', 'Duração totalmente flexível', 'Atividades personalizadas', 'Atendimento exclusivo'],
      includes: ['Pacote totalmente negociável', 'Suporte dedicado da equipa', 'Experiência 100% personalizada'],
      maxSpots: 30,
      photos: [],
    },
    'em-breve': {
      title: 'Novo Destino',
      badge: 'Em Breve',
      emoji: '✨',
      duration: 'A confirmar',
      color: '#1a1a1a',
      description: 'Estamos a preparar uma nova aventura incrível. Deixe os seus contactos e avisamos quando estiver disponível.',
      highlights: ['Surpresa!'],
      includes: ['A confirmar em breve'],
      maxSpots: 30,
      photos: [],
    },
  };

  /* ── DOM refs ────────────────────────────── */
  var resPage            = document.getElementById('resPage');
  var resClose           = document.getElementById('resClose');
  var resForm            = document.getElementById('resForm');
  var resConfirmOverlay  = document.getElementById('resConfirmOverlay');
  var resConfirmClose    = document.getElementById('resConfirmClose');
  var resConfirmNew      = document.getElementById('resConfirmNew');

  var currentTour  = null;
  var currentSpots = 1;
  var savedScrollY = 0;

  /* ── Abrir reserva ───────────────────────── */
  function openReservation(destination) {
    var tour = TOUR_DATA[destination] || TOUR_DATA['personalizado'];
    currentTour  = Object.assign({ destination: destination }, tour);
    currentSpots = 1;

    /* Nav title */
    document.getElementById('resNavTitle').textContent = tour.title;

    /* Hero */
    var hero = document.getElementById('resHero');
    hero.style.background =
      'linear-gradient(160deg, ' + (tour.color || '#2a1a0a') + ' 0%, #0d0a06 100%)';

    document.getElementById('resEmoji').textContent    = tour.emoji;
    document.getElementById('resBadge').textContent    = tour.badge;
    document.getElementById('resDuration').textContent = tour.duration;
    document.getElementById('resDrawerTitle').textContent = tour.title;
    document.getElementById('resDesc').textContent     = tour.description;
    document.getElementById('resTourField').value      = tour.title;

    document.getElementById('resHighlights').innerHTML =
      tour.highlights.map(function (h) { return '<li>' + h + '</li>'; }).join('');
    document.getElementById('resIncludes').innerHTML =
      tour.includes.map(function (i) { return '<li>' + i + '</li>'; }).join('');

    /* Photo strip */
    renderPhotoStrip(tour.photos || []);

    /* Date min = tomorrow */
    var tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    document.getElementById('resDate').min = tmrw.toISOString().split('T')[0];

    /* Reset form state */
    resetResForm();

    /* Open */
    savedScrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    resPage.classList.add('is-open');
    resPage.scrollTo({ top: 0, behavior: 'instant' });

    /* Focus first field */
    setTimeout(function () {
      document.getElementById('resName').focus();
    }, 450);
  }

  /* ── Fechar reserva ──────────────────────── */
  function closeReservation() {
    resPage.classList.remove('is-open');
    document.body.style.overflow = '';
    window.scrollTo({ top: savedScrollY, behavior: 'instant' });
  }

  /* ── Render photo strip ──────────────────── */
  function renderPhotoStrip(photos) {
    var strip = document.getElementById('resPhotosStrip');
    strip.innerHTML = '';
    var total = Math.max(photos.length, 5); /* sempre mostra pelo menos 5 slots */

    for (var i = 0; i < total; i++) {
      var slot = document.createElement('div');
      slot.className = 'res-photo-slot';

      if (photos[i]) {
        slot.innerHTML = '<img src="' + photos[i] + '" alt="Foto ' + (i + 1) + '" loading="lazy">';
      } else {
        slot.innerHTML =
          '<div class="res-photo-slot__ph">' +
            '<i class="fa-regular fa-image"></i>' +
            '<span>Foto ' + (i + 1) + '</span>' +
          '</div>';
      }
      strip.appendChild(slot);
    }
  }

  /* ── Reset do formulário ─────────────────── */
  function resetResForm() {
    resForm.reset();
    currentSpots = 1;
    document.getElementById('resSpots').value          = '1';
    document.getElementById('resCountVal').textContent = '1';

    /* Reset botão */
    var submitBtn  = document.getElementById('resSubmit');
    submitBtn.querySelector('.res-submit__text').hidden  = false;
    submitBtn.querySelector('.res-submit__loading').hidden = true;
    submitBtn.disabled = false;

    /* Limpar erros */
    document.querySelectorAll('.res-field__error').forEach(function (el) {
      el.textContent = '';
    });
    document.querySelectorAll('.res-field input, .res-field textarea').forEach(function (el) {
      el.classList.remove('is-invalid');
    });

    updateSpotCounter();
  }

  /* ── Contador de vagas ───────────────────── */
  function updateSpotCounter() {
    var max    = Math.min((currentTour && currentTour.maxSpots) || 20, 10);
    var minus  = document.getElementById('resMinus');
    var plus   = document.getElementById('resPlus');
    var valEl  = document.getElementById('resCountVal');
    var hidden = document.getElementById('resSpots');

    valEl.textContent  = currentSpots;
    hidden.value       = currentSpots;
    minus.disabled     = currentSpots <= 1;
    plus.disabled      = currentSpots >= max;
  }

  document.getElementById('resMinus').addEventListener('click', function () {
    if (currentSpots > 1) { currentSpots--; updateSpotCounter(); }
  });
  document.getElementById('resPlus').addEventListener('click', function () {
    var max = Math.min((currentTour && currentTour.maxSpots) || 20, 10);
    if (currentSpots < max) { currentSpots++; updateSpotCounter(); }
  });

  /* ── Validação ───────────────────────────── */
  function validateResForm() {
    var ok = true;

    function check(inputId, errorId, msg) {
      var el  = document.getElementById(inputId);
      var err = document.getElementById(errorId);
      if (msg) {
        el.classList.add('is-invalid');
        err.textContent = msg;
        ok = false;
      } else {
        el.classList.remove('is-invalid');
        err.textContent = '';
      }
    }

    var name  = document.getElementById('resName').value.trim();
    var email = document.getElementById('resEmail').value.trim();
    var phone = document.getElementById('resPhone').value.trim();
    var date  = document.getElementById('resDate').value;

    check('resName',  'resNameErr',  name.length  < 3   ? 'Por favor insira o nome completo.' : '');
    check('resEmail', 'resEmailErr', !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Email inválido.' : '');
    check('resPhone', 'resPhoneErr', phone.replace(/\D/g, '').length < 9 ? 'Número inválido (mín. 9 dígitos).' : '');
    check('resDate',  'resDateErr',  !date ? 'Selecione uma data preferida.' : '');

    return ok;
  }

  /* ── Submissão ───────────────────────────── */
  resForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validateResForm()) {
      /* Scroll até ao primeiro erro */
      var firstErr = resPage.querySelector('.is-invalid');
      if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    /* Loading */
    var btn   = document.getElementById('resSubmit');
    btn.querySelector('.res-submit__text').hidden   = true;
    btn.querySelector('.res-submit__loading').hidden = false;
    btn.disabled = true;

    var data = {
      programa:       document.getElementById('resTourField').value,
      nome:           document.getElementById('resName').value.trim(),
      email:          document.getElementById('resEmail').value.trim(),
      telefone:       document.getElementById('resPhone').value.trim(),
      data_preferida: document.getElementById('resDate').value,
      vagas:          document.getElementById('resSpots').value,
      mensagem:       document.getElementById('resMessage').value.trim() || '—',
      _subject:       'Nova Reserva — O Mochilão Aventuras',
      _template:      'table',
    };

    /* Backup local */
    saveReservationLocal(data);

    /* Enviar via formsubmit AJAX */
    fetch('https://formsubmit.co/ajax/valganhosapalo@gmail.com', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    JSON.stringify(data),
    })
    .catch(function (err) { console.warn('formsubmit (dados guardados localmente):', err); })
    .finally(function () { showConfirmation(data); });
  });

  /* ── Popup de confirmação ────────────────── */
  function showConfirmation(data) {
    document.getElementById('resConfirmTour').textContent = data.programa;

    var dateStr = data.data_preferida
      ? new Date(data.data_preferida + 'T00:00:00').toLocaleDateString('pt-PT', {
          day: 'numeric', month: 'long', year: 'numeric' })
      : '—';

    var rows = [
      ['Programa', data.programa],
      ['Nome',     data.nome],
      ['Email',    data.email],
      ['Telefone', data.telefone],
      ['Data',     dateStr],
      ['Vagas',    data.vagas + (data.vagas === '1' ? ' vaga' : ' vagas')],
    ];

    document.getElementById('resConfirmSummary').innerHTML = rows.map(function (r) {
      return '<div class="res-confirm__row">' +
               '<span class="res-confirm__row-lbl">' + r[0] + '</span>' +
               '<span class="res-confirm__row-val">' + r[1] + '</span>' +
             '</div>';
    }).join('');

    resConfirmOverlay.classList.add('is-open');
  }

  function closeConfirmation() {
    resConfirmOverlay.classList.remove('is-open');
  }

  resConfirmClose.addEventListener('click', function () {
    closeConfirmation();
    closeReservation();
  });

  resConfirmNew.addEventListener('click', function () {
    closeConfirmation();
    resetResForm();
    resPage.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ── Backup localStorage ─────────────────── */
  function saveReservationLocal(data) {
    var key      = 'mochilao_reservations';
    var existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.push(Object.assign({
      id:        'RES-' + Date.now(),
      timestamp: new Date().toISOString(),
      status:    'pending',
    }, data));
    localStorage.setItem(key, JSON.stringify(existing));
  }

  /* ── Event delegation — botões Reservar ─── */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-open-reservation]');
    if (!btn) return;
    e.preventDefault();
    var card = btn.closest('.tour-card');
    openReservation(card ? card.dataset.destination : 'personalizado');
  });

  /* ── Fechar com botão/ESC ────────────────── */
  resClose.addEventListener('click', closeReservation);

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (resConfirmOverlay.classList.contains('is-open')) {
      closeConfirmation();
    } else if (resPage.classList.contains('is-open')) {
      closeReservation();
    }
  });

  /* ── Validação inline ao sair do campo ──── */
  document.getElementById('resName').addEventListener('blur', function () {
    var err = document.getElementById('resNameErr');
    if (this.value.trim().length > 0 && this.value.trim().length < 3) {
      this.classList.add('is-invalid'); err.textContent = 'Nome muito curto.';
    } else { this.classList.remove('is-invalid'); err.textContent = ''; }
  });
  document.getElementById('resEmail').addEventListener('blur', function () {
    var err = document.getElementById('resEmailErr');
    var v   = this.value.trim();
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      this.classList.add('is-invalid'); err.textContent = 'Email inválido.';
    } else { this.classList.remove('is-invalid'); err.textContent = ''; }
  });


})();