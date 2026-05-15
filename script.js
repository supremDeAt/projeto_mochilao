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


  /* ─────────────────────────────────────────
     2. SIDEBAR MOBILE — abrir / fechar
     ───────────────────────────────────────── */
  const sidebar        = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const burgerBtn      = document.getElementById('burgerBtn');
  const closeBtn       = document.getElementById('closeBtn');

  function openSidebar() {
    sidebar.classList.add('is-open');
    sidebarOverlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    burgerBtn.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    sidebar.classList.remove('is-open');
    sidebarOverlay.classList.remove('is-open');
    document.body.style.overflow = '';
    burgerBtn.setAttribute('aria-expanded', 'false');
  }

  burgerBtn.addEventListener('click', openSidebar);
  closeBtn.addEventListener('click', closeSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);

  // Fechar ao clicar num link do sidebar
  sidebar.querySelectorAll('.sidebar__link').forEach(function (link) {
    link.addEventListener('click', closeSidebar);
  });

  // Fechar com tecla Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sidebar.classList.contains('is-open')) {
      closeSidebar();
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
     6. RESERVATION DRAWER — dados e lógica
     ───────────────────────────────────────── */

  /* ── Tour data ──────────────────────────── */
  const TOUR_DATA = {
    'cabo-ledo': {
      title: 'Cabo Ledo',
      badge: 'Sobre Rodas',
      emoji: '🏄',
      duration: '1 dia',
      description: 'Uma aventura completa pela costa angolana, desde as icónicas formações rochosas do Miradouro da Lua até às ondas da Praia dos Surfistas.',
      highlights: ['Miradouro da Lua', 'Gruta das Sereias', 'Praia dos Surfistas'],
      includes: ['Transporte ida e volta', 'Almoço incluído', 'Guia local experiente', 'Kit de boas-vindas'],
      maxSpots: 15,
    },
    'quicama': {
      title: 'Quiçama',
      badge: 'Safari',
      emoji: '🦏',
      duration: '1 dia',
      description: 'Safari guiado no maior parque nacional de Angola, com observação de fauna selvagem em plena natureza, encerrando no Miradouro da Lua.',
      highlights: ['Parque Nacional da Quiçama', 'Safari com guia especializado', 'Almoço típico angolano', 'Miradouro da Lua'],
      includes: ['Transporte 4×4', 'Almoço local', 'Guia especializado em fauna', 'Seguro de viagem'],
      maxSpots: 12,
    },
    'huambo': {
      title: 'Huambo — Águas Frias',
      badge: 'Camping · 3 dias',
      emoji: '⛺',
      duration: '3 dias / 2 noites',
      description: 'Acampamento nas Águas Frias do Huambo, com trilhas ecológicas, fogueiras noturnas e imersão total na natureza angolana das serras.',
      highlights: ['Águas Frias camping', 'Trilhas guiadas', 'Fogueiras noturnas', 'Piscinas naturais'],
      includes: ['Tendas e equipamento completo', 'Alimentação completa (6 refeições)', 'Água ilimitada', 'Trilhas guiadas', 'Kit de segurança'],
      maxSpots: 20,
    },
    'bengo': {
      title: 'Bengo — Kifuka',
      badge: 'Camping · 2 dias',
      emoji: '🔥',
      duration: '2 dias / 1 noite',
      description: 'Kifuka Camping no Bengo: atividades de lazer em plena natureza angolana, com fogueiras, convívio e descanso total.',
      highlights: ['Kifuka camping', 'Atividades de lazer', 'Contacto com a natureza', 'Noite sob as estrelas'],
      includes: ['Tendas', 'Refeições incluídas', 'Água à vontade', 'Atividades de lazer', 'Seguro de viagem'],
      maxSpots: 20,
    },
    'malanje': {
      title: 'Malanje',
      badge: 'Excursão · 3 dias',
      emoji: '🗿',
      duration: '3 dias / 2 noites',
      description: 'Excursão à Terra da Palanca Negra, com visita às icónicas Pedras de Pungo Andongo e imersão na cultura e gastronomia de Malanje.',
      highlights: ['Pedras de Pungo Andongo', 'Centro histórico de Malanje', 'Cultura e gastronomia local'],
      includes: ['Transporte incluído', 'T-shirt exclusiva O Mochilão', 'Snacks e água ilimitada', 'Guia local', 'Seguro de viagem'],
      maxSpots: 25,
    },
    'cuanza-norte': {
      title: 'Cuanza Norte',
      badge: 'Camping · 3 dias',
      emoji: '🌊',
      duration: '3 dias / 2 noites',
      description: 'Acampamento ecológico com trilhas guiadas e imersão na biodiversidade única do Cuanza Norte, às margens do Rio Cuanza.',
      highlights: ['Rio Cuanza', 'Trilhas ecológicas', 'Fauna e flora angolana', 'Acampamento à beira do rio'],
      includes: ['Tendas e equipamento', 'Alimentação completa', 'Água disponível', 'Trilhas ecológicas guiadas', 'Seguro de viagem'],
      maxSpots: 20,
    },
    'luanda': {
      title: 'Luanda City Tour Kids',
      badge: 'City Tour',
      emoji: '🏙️',
      duration: '1 dia',
      description: 'Passeio educativo e recreativo pelas principais atrações de Luanda, desenvolvido especialmente para o público infantil, com guia experiente.',
      highlights: ['Atrações históricas de Luanda', 'Museus interativos', 'Pontos de interesse cultural', 'Atividades para crianças'],
      includes: ['Transporte', 'Guia educativo certificado', 'Almoço infantil', 'Material didático', 'Seguro incluído'],
      maxSpots: 30,
    },
    'personalizado': {
      title: 'Programa Personalizado',
      badge: 'À Medida',
      emoji: '🗺️',
      duration: 'À sua escolha',
      description: 'Crie o seu roteiro de sonho com a nossa equipa. Destino, duração, atividades e orçamento totalmente definidos à sua medida.',
      highlights: ['Destino à sua escolha', 'Duração totalmente flexível', 'Atividades personalizadas', 'Atendimento exclusivo'],
      includes: ['Pacote totalmente negociável', 'Suporte dedicado da equipa', 'Experiência 100% personalizada'],
      maxSpots: 30,
    },
    'em-breve': {
      title: 'Novo Destino',
      badge: 'Em Breve',
      emoji: '✨',
      duration: 'A confirmar',
      description: 'Estamos a preparar uma nova aventura incrível. Deixe os seus contactos e avisamos quando estiver disponível.',
      highlights: ['Surpresa!'],
      includes: ['A confirmar em breve'],
      maxSpots: 30,
    },
  };

  /* ── DOM references ──────────────────────── */
  const resOverlay     = document.getElementById('resOverlay');
  const resDrawer      = document.getElementById('resDrawer');
  const resClose       = document.getElementById('resClose');
  const resForm        = document.getElementById('resForm');
  const resSuccess     = document.getElementById('resSuccess');
  const resBody        = document.getElementById('resBody');

  let currentTour      = null;
  let currentSpots     = 1;

  /* ── Open drawer ────────────────────────── */
  function openReservation(destination) {
    const tour = TOUR_DATA[destination] || TOUR_DATA['personalizado'];
    currentTour  = { destination, ...tour };
    currentSpots = 1;

    // Populate header
    document.getElementById('resDrawerTitle').textContent = tour.title;
    document.querySelector('.res-drawer__pre').textContent = 'Reservar viagem';

    // Populate tour info panel
    document.getElementById('resEmoji').textContent     = tour.emoji;
    document.getElementById('resBadge').textContent     = tour.badge;
    document.getElementById('resDuration').textContent  = tour.duration;
    document.getElementById('resDesc').textContent      = tour.description;
    document.getElementById('resTourField').value       = tour.title;

    const hlList = document.getElementById('resHighlights');
    hlList.innerHTML = tour.highlights.map(h => `<li>${h}</li>`).join('');

    const incList = document.getElementById('resIncludes');
    incList.innerHTML = tour.includes.map(i => `<li>${i}</li>`).join('');

    // Reset form
    resetReservationForm();

    // Set date minimum (tomorrow)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];
    document.getElementById('resDate').min = minDate;

    // Show/hide date field only for custom packages (hide only the date field itself)
    var resDateEl = document.getElementById('resDate');
    var dateFieldContainer = resDateEl ? resDateEl.closest('.res-field') : null;
    var isPersonalized = destination === 'personalizado';
    if (dateFieldContainer) dateFieldContainer.style.display = isPersonalized ? '' : 'none';

    // Update spot counter UI
    updateSpotCounter();

    // Actualizar label do botão mobile
    updateInfoToggleLabel(tour.title);

    // Show drawer
    resDrawer.classList.add('is-open');
    resOverlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    // Focus first field after transition
    setTimeout(function () {
      document.getElementById('resName').focus();
    }, 520);
  }

  /* ── Close drawer ────────────────────────── */
  function closeReservation() {
    resDrawer.classList.remove('is-open');
    resOverlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  /* ── Reset form to initial state ────────── */
  function resetReservationForm() {
    resForm.reset();
    resForm.hidden    = false;
    resSuccess.hidden = true;
    currentSpots      = 1;
    document.getElementById('resSpots').value          = '1';
    document.getElementById('resCountVal').textContent = '1';

    // Reset submit button — desfaz o estado de loading
    const submitBtn  = document.getElementById('resSubmit');
    const submitText = submitBtn.querySelector('.res-submit__text');
    const submitLoad = submitBtn.querySelector('.res-submit__loading');
    submitText.hidden  = false;
    submitLoad.hidden  = true;
    submitBtn.disabled = false;

    // Clear validation errors
    document.querySelectorAll('.res-field__error').forEach(function (el) {
      el.textContent = '';
    });
    document.querySelectorAll('.res-field input, .res-field textarea').forEach(function (el) {
      el.classList.remove('is-invalid');
    });
  }

  /* ── Spot counter ────────────────────────── */
  function updateSpotCounter() {
    const maxSpots = (currentTour && currentTour.maxSpots) || 20;
    const minus    = document.getElementById('resMinus');
    const plus     = document.getElementById('resPlus');
    const val      = document.getElementById('resCountVal');
    const hidden   = document.getElementById('resSpots');

    val.textContent = currentSpots;
    hidden.value    = currentSpots;
    minus.disabled  = currentSpots <= 1;
    plus.disabled   = currentSpots >= Math.min(maxSpots, 10);
  }

  document.getElementById('resMinus').addEventListener('click', function () {
    if (currentSpots > 1) { currentSpots--; updateSpotCounter(); }
  });
  document.getElementById('resPlus').addEventListener('click', function () {
    const max = Math.min((currentTour && currentTour.maxSpots) || 20, 10);
    if (currentSpots < max) { currentSpots++; updateSpotCounter(); }
  });

  /* ── Form validation ─────────────────────── */
  function validateReservationForm() {
    let valid = true;

    function setError(inputId, errorId, message) {
      const input = document.getElementById(inputId);
      const error = document.getElementById(errorId);
      if (message) {
        input.classList.add('is-invalid');
        error.textContent = message;
        valid = false;
      } else {
        input.classList.remove('is-invalid');
        error.textContent = '';
      }
    }

    const name  = document.getElementById('resName').value.trim();
    const email = document.getElementById('resEmail').value.trim();
    const phone = document.getElementById('resPhone').value.trim();
    const date  = document.getElementById('resDate').value;
    const isPersonalized = (currentTour && currentTour.destination === 'personalizado');

    setError('resName', 'resNameErr', name.length < 3 ? 'Por favor insira o seu nome completo.' : '');
    setError('resEmail', 'resEmailErr', !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Email inválido.' : '');
    setError('resPhone', 'resPhoneErr', phone.replace(/\D/g, '').length < 9 ? 'Número inválido (mínimo 9 dígitos).' : '');
    if (isPersonalized) {
      setError('resDate', 'resDateErr', !date ? 'Selecione uma data preferida.' : '');
    } else {
      setError('resDate', 'resDateErr', '');
    }

    return valid;
  }

  /* ── Form submission ─────────────────────── */
  resForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    if (!validateReservationForm()) return;

    // Show loading state
    const submitBtn    = document.getElementById('resSubmit');
    const submitText   = submitBtn.querySelector('.res-submit__text');
    const submitLoad   = submitBtn.querySelector('.res-submit__loading');
    submitText.hidden  = true;
    submitLoad.hidden  = false;
    submitBtn.disabled = true;

    const formData = {
      programa:       document.getElementById('resTourField').value,
      nome:           document.getElementById('resName').value.trim(),
      email:          document.getElementById('resEmail').value.trim(),
      telefone:       document.getElementById('resPhone').value.trim(),
      data_preferida: document.getElementById('resDate').value,
      vagas:          document.getElementById('resSpots').value,
      mensagem:       document.getElementById('resMessage').value.trim() || '—',
      _subject:       'Nova Reserva — O Mochilão Aventuras',
      _template:      'table',
      _autoresponse:  'Olá! Recebemos o seu pedido de reserva. A nossa equipa entrará em contacto em breve para confirmar os detalhes. Obrigado por escolher o Mochilão Aventuras!',
    };

    /* Save to localStorage as admin backup */
    saveReservationLocally(formData);

    /* Send via formsubmit.co AJAX */
    try {
      const response = await fetch('https://formsubmit.co/ajax/valganhosapalo@gmail.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Network error');
    } catch (err) {
      // Silent fail — data is already saved to localStorage
      console.warn('formsubmit.co error (data saved locally):', err);
    }

    showReservationSuccess(formData);
  });

  /* ── Show success state ──────────────────── */
  function showReservationSuccess(data) {
    resForm.hidden    = true;
    resSuccess.hidden = false;

    document.getElementById('resSuccessTour').textContent = data.programa;

    const dateFormatted = data.data_preferida
      ? new Date(data.data_preferida + 'T00:00:00').toLocaleDateString('pt-PT', {
          day: 'numeric', month: 'long', year: 'numeric'
        })
      : '—';

    const details = [
      ['Programa',    data.programa],
      ['Nome',        data.nome],
      ['Email',       data.email],
      ['Telefone',    data.telefone],
      ['Data',        dateFormatted],
      ['Vagas',       data.vagas + (data.vagas === '1' ? ' vaga' : ' vagas')],
    ];

    document.getElementById('resSuccessDetails').innerHTML = details
      .map(function (d) {
        return '<div class="res-success__detail-row"><span>' + d[0] + '</span><span>' + d[1] + '</span></div>';
      })
      .join('');

    // Scroll success into view on mobile
    resSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ── Save to localStorage (admin panel later) ── */
  function saveReservationLocally(data) {
    const key         = 'mochilao_reservations';
    const existing    = JSON.parse(localStorage.getItem(key) || '[]');
    const reservation = Object.assign({
      id:        'RES-' + Date.now(),
      timestamp: new Date().toISOString(),
      status:    'pending',
    }, data);
    existing.push(reservation);
    localStorage.setItem(key, JSON.stringify(existing));
  }

  /* ── Event delegation for "Reservar" buttons ── */
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-open-reservation]');
    if (!btn) return;
    e.preventDefault();
    const card        = btn.closest('.tour-card');
    const destination = card ? card.dataset.destination : 'personalizado';
    openReservation(destination);
  });

  /* ── Close listeners ─────────────────────── */
  resClose.addEventListener('click', closeReservation);
  resOverlay.addEventListener('click', closeReservation);

  document.getElementById('resSuccessClose').addEventListener('click', closeReservation);
  document.getElementById('resSuccessNew').addEventListener('click', function () {
    resetReservationForm();
    // Scroll back to top of form wrap on mobile
    document.querySelector('.res-form-wrap').scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ESC key closes drawer
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && resDrawer.classList.contains('is-open')) {
      closeReservation();
    }
  });

  // Inline validation on blur
  document.getElementById('resName').addEventListener('blur', function () {
    const val = this.value.trim();
    const err = document.getElementById('resNameErr');
    if (val.length > 0 && val.length < 3) {
      this.classList.add('is-invalid');
      err.textContent = 'Nome muito curto.';
    } else {
      this.classList.remove('is-invalid');
      err.textContent = '';
    }
  });
  document.getElementById('resEmail').addEventListener('blur', function () {
    const val = this.value.trim();
    const err = document.getElementById('resEmailErr');
    if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      this.classList.add('is-invalid');
      err.textContent = 'Email inválido.';
    } else {
      this.classList.remove('is-invalid');
      err.textContent = '';
    }
  });


  /* ─────────────────────────────────────────
     7. MOBILE INFO BOTTOM SHEET
     ───────────────────────────────────────── */
  const infoSheet        = document.getElementById('infoSheet');
  const infoSheetBackdrop = document.getElementById('infoSheetBackdrop');
  const infoSheetClose   = document.getElementById('infoSheetClose');
  const infoSheetBody    = document.getElementById('infoSheetBody');
  const infoSheetTitle   = document.getElementById('infoSheetTitle');
  const resInfoToggle    = document.getElementById('resInfoToggle');

  function openInfoSheet() {
    if (!currentTour) return;

    // Build the same content as the desktop res-info panel
    infoSheetTitle.textContent = currentTour.title;

    const highlightsHtml = currentTour.highlights
      .map(function (h) { return '<li>' + h + '</li>'; }).join('');

    const includesHtml = currentTour.includes
      .map(function (i) { return '<li>' + i + '</li>'; }).join('');

    infoSheetBody.innerHTML =
      '<div class="res-info__top">' +
        '<span class="res-info__emoji">' + currentTour.emoji + '</span>' +
        '<span class="res-info__badge">' + currentTour.badge + '</span>' +
      '</div>' +
      '<p class="res-info__duration"><i class="fa-regular fa-clock"></i> ' + currentTour.duration + '</p>' +
      '<p class="res-info__desc">' + currentTour.description + '</p>' +
      '<div class="res-info__block">' +
        '<h4 class="res-info__block-title"><i class="fa-solid fa-location-dot"></i> Destaques</h4>' +
        '<ul class="res-info__list">' + highlightsHtml + '</ul>' +
      '</div>' +
      '<div class="res-info__block">' +
        '<h4 class="res-info__block-title"><i class="fa-solid fa-circle-check"></i> O que inclui</h4>' +
        '<ul class="res-info__list">' + includesHtml + '</ul>' +
      '</div>';

    infoSheet.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeInfoSheet() {
    infoSheet.classList.remove('is-open');
    // Só repõe o overflow se o drawer principal também não estiver aberto
    if (!resDrawer.classList.contains('is-open')) {
      document.body.style.overflow = '';
    }
  }

  resInfoToggle.addEventListener('click', openInfoSheet);
  infoSheetClose.addEventListener('click', closeInfoSheet);
  infoSheetBackdrop.addEventListener('click', closeInfoSheet);

  // Fechar sheet com ESC (sem fechar o drawer principal)
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && infoSheet.classList.contains('is-open')) {
      e.stopPropagation();
      closeInfoSheet();
    }
  });

  // Actualizar o label do botão com o nome do programa
  function updateInfoToggleLabel(title) {
    const label = document.getElementById('resInfoToggleLabel');
    if (label) label.textContent = title || 'Informações sobre o programa';
  }


})();