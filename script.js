/* =====================================================
   O MOCHILÃO AVENTURAS — script.js
   Organizado em módulos: Navbar, Sidebar, Reveal, Counters
   ===================================================== */

(function () {
  "use strict";

  /* ─────────────────────────────────────────
     1. NAVBAR — adiciona fundo ao fazer scroll
     ───────────────────────────────────────── */
  const navbar = document.getElementById("navbar");

  function handleNavbarScroll() {
    if (window.scrollY > 60) {
      navbar.classList.add("scrolled");
    } else {
      navbar.classList.remove("scrolled");
    }
  }

  window.addEventListener("scroll", handleNavbarScroll, { passive: true });
  handleNavbarScroll(); // Verificar estado inicial

  /* ── Link ativo no menu, baseado na secção visível ── */
  var navLinks = document.querySelectorAll(
    '.navbar__link[href^="#"]:not(.navbar__link--cta), .sidebar__link[href^="#"]:not([href="#hero"])',
  );
  var sectionIds = Array.from(
    new Set(
      Array.from(navLinks).map(function (link) {
        return link.getAttribute("href").replace("#", "");
      }),
    ),
  );
  var sections = sectionIds
    .map(function (id) {
      return document.getElementById(id);
    })
    .filter(Boolean);

  function updateActiveLink() {
    var scrollY = window.scrollY + 120;
    var current = "";
    sections.forEach(function (section) {
      if (section && section.offsetTop <= scrollY) {
        current = section.id;
      }
    });
    navLinks.forEach(function (link) {
      var isActive = link.getAttribute("href") === "#" + current;
      link.classList.toggle(
        "navbar__link--active",
        isActive && link.classList.contains("navbar__link"),
      );
      link.classList.toggle(
        "sidebar__link--active",
        isActive && link.classList.contains("sidebar__link"),
      );
    });
  }

  window.addEventListener("scroll", updateActiveLink, { passive: true });
  updateActiveLink();

  /* ─────────────────────────────────────────
     2. MENU — abrir / fechar
     Desktop/tablet: os links deslizam dentro da
     própria navbar (da direita para a esquerda).
     Mobile estreito: usa a sidebar lateral.
     ───────────────────────────────────────── */
  const navLinksBar = document.getElementById("navLinks");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const burgerBtn = document.getElementById("burgerBtn");
  const closeBtn = document.getElementById("closeBtn");

  function useSidebar() {
    return window.innerWidth <= 640; // ecrã estreito demais para links inline
  }

  function isMenuOpen() {
    return useSidebar()
      ? sidebar.classList.contains("is-open")
      : navLinksBar.classList.contains("is-open");
  }

  function openMenu() {
    if (useSidebar()) {
      sidebar.classList.add("is-open");
      sidebarOverlay.classList.add("is-open");
      document.body.style.overflow = "hidden";
    } else {
      navLinksBar.classList.add("is-open");
    }
    burgerBtn.classList.add("is-active");
    burgerBtn.setAttribute("aria-expanded", "true");
    burgerBtn.setAttribute("aria-label", "Fechar menu");
  }

  function closeMenu() {
    sidebar.classList.remove("is-open");
    sidebarOverlay.classList.remove("is-open");
    navLinksBar.classList.remove("is-open");
    document.body.style.overflow = "";
    burgerBtn.classList.remove("is-active");
    burgerBtn.setAttribute("aria-expanded", "false");
    burgerBtn.setAttribute("aria-label", "Abrir menu");
  }

  function toggleMenu() {
    if (isMenuOpen()) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  burgerBtn.addEventListener("click", toggleMenu);
  closeBtn.addEventListener("click", closeMenu);
  sidebarOverlay.addEventListener("click", closeMenu);

  // Fechar ao clicar num link (navbar ou sidebar)
  document
    .querySelectorAll(".navbar__link, .sidebar__link")
    .forEach(function (link) {
      link.addEventListener("click", closeMenu);
    });

  // Fechar ao redimensionar para o outro modo (evita estado inconsistente)
  window.addEventListener("resize", closeMenu);

  // Fechar com tecla Escape
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isMenuOpen()) {
      closeMenu();
    }
  });

  /* ─────────────────────────────────────────
     3. SCROLL REVEAL — Intersection Observer
     ───────────────────────────────────────── */
  const revealElements = document.querySelectorAll(
    ".reveal-up, .reveal-left, .reveal-right, .reveal-fade",
  );

  if (revealElements.length > 0) {
    const revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target); // Anima apenas uma vez
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -40px 0px",
      },
    );

    revealElements.forEach(function (el) {
      revealObserver.observe(el);
    });
  }

  /* ─────────────────────────────────────────
     4. CONTADORES ANIMADOS
     ───────────────────────────────────────── */
  const countersSection = document.getElementById("counters");
  let countersStarted = false;

  function animateCounter(el) {
    const target = parseInt(el.getAttribute("data-target"), 10);
    const duration = 1800; // ms
    const startTime = performance.now();

    function step(currentTime) {
      const elapsed = currentTime - startTime;
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
          countersSection.classList.add("counters--visible");
          // Animar números
          document.querySelectorAll(".counter__num").forEach(function (num) {
            animateCounter(num);
          });
          counterObserver.disconnect();
        }
      },
      { threshold: 0.4 },
    );

    counterObserver.observe(countersSection);
  }

  /* ─────────────────────────────────────────
     4b. PARALLAX NA IMAGEM DO ABOUT
     ───────────────────────────────────────── */
  var aboutImage = document.querySelector(".about__image");
  if (aboutImage && window.innerWidth > 768) {
    window.addEventListener(
      "scroll",
      function () {
        var rect = aboutImage.getBoundingClientRect();
        var visible = rect.top < window.innerHeight && rect.bottom > 0;
        if (visible) {
          var progress =
            (window.innerHeight - rect.top) /
            (window.innerHeight + rect.height);
          var offset = (progress - 0.5) * 60; // máx ±30px
          aboutImage.style.backgroundPositionY = "calc(50% + " + offset + "px)";
        }
      },
      { passive: true },
    );
  }

  /* ─────────────────────────────────────────
     5. BOTÃO "VOLTAR AO TOPO" — mostrar / esconder
     ───────────────────────────────────────── */
  const topBtn = document.querySelector(".float-btn--top");

  if (topBtn) {
    function toggleTopBtn() {
      topBtn.style.opacity = window.scrollY > 300 ? "1" : "0";
      topBtn.style.pointerEvents = window.scrollY > 300 ? "auto" : "none";
    }

    topBtn.style.transition = "opacity 0.3s ease";
    topBtn.style.opacity = "0";
    topBtn.style.pointerEvents = "none";

    window.addEventListener("scroll", toggleTopBtn, { passive: true });
  }

  /* ─────────────────────────────────────────
     5b. PARALLAX CARDS — flutuam suavemente
         enquanto o utilizador faz scroll
     ───────────────────────────────────────── */
  var overlapCards = document.querySelectorAll(
    ".hero__cards-overlap .tour-card",
  );
  var heroEl = document.querySelector(".hero");

  function isMobile() {
    return window.innerWidth <= 540;
  }

  if (overlapCards.length && heroEl) {
    function onScrollParallax() {
      if (isMobile()) return; // desliga em mobile
      var heroBottom = heroEl.getBoundingClientRect().bottom;
      var viewH = window.innerHeight;
      var progress = 1 - Math.min(Math.max(heroBottom / viewH, 0), 1);

      overlapCards.forEach(function (card, i) {
        var offset = progress * (18 + i * 6);
        card.style.setProperty("--parallax-y", -offset + "px");
      });
    }

    window.addEventListener("scroll", onScrollParallax, { passive: true });
  }

  /* ─────────────────────────────────────────
     5c. ENTRADA DOS CARDS — trigger imediato
         após carregamento da página
     ───────────────────────────────────────── */
  var overlapReveal = document.querySelectorAll(
    ".hero__cards-overlap .tour-card.reveal-up",
  );
  if (overlapReveal.length) {
    // Espera a página carregar, depois anima os cards
    window.addEventListener("load", function () {
      overlapReveal.forEach(function (card) {
        // Pequeno timeout para garantir que o browser pintou o estado inicial
        setTimeout(function () {
          card.classList.add("is-visible");
        }, 200);
      });
    });
  }

  /* ─────────────────────────────────────────
     6. INTERNACIONALIZAÇÃO — 🇦🇴 / 🇬🇧
     ───────────────────────────────────────── */
  const translations = {
    pt: {
      "nav.home": "Início",
      "nav.tours": "Viagens",
      "nav.gallery": "Galeria",
      "nav.custom": "Personalizado",
      "nav.about": "Sobre",
      "nav.team": "Equipa",
      "nav.tips": "Dicas",
      "nav.contact": "Fale Connosco",
      "hero.badge": "BEM-VINDO AO MOCHILÃO",
      "hero.title":
        "Descubra Angola <br> através de experiências que <br> ficam para a vida",
      "hero.subtitle":
        "Cada viagem começa com uma escolha.<br>Faça a sua e eternize momentos únicos por Angola.",
      "hero.cta1": "Faça a sua reserva",
      "hero.cta2": "Fale connosco",
      "hero.scroll": "Explorar",
      "about.tag": "Sobre o Mochilão",
      "about.title": "A experiência é o percurso, o destino é consequência",
      "about.quote":
        "Acreditamos que cada passo da viagem importa tanto quanto o lugar a que chegamos — é nessa jornada que nascem as histórias que ficam.",
      "about.text":
        "O Mochilão nasceu da paixão e do desejo de explorar Angola em toda a sua grandiosidade. Mais do que uma empresa, somos movidos pelo fascínio de revelar as maravilhas naturais, os povos, as culturas e a rica gastronomia que compõem o vasto mosaico cultural angolano.",
      "about.btn": "Saber Mais",
      "about.counter1": "Viagens",
      "about.counter2": "Clientes",
      "about.counter3": "Satisfação",
      "pkg.tag": "Viagens em Grupo",
      "pkg.title": "Experiências únicas em Angola",
      "pkg.desc":
        "Roteiros com data marcada, feitos para viver em grupo. Escolhe o teu próximo destino.",
      "gallery.tag": "Momentos",
      "gallery.title": "Galeria de Aventuras",
      "gallery.desc":
        "Momentos reais das nossas viagens. Segue-nos no Instagram para mais.",
      "custom.tag": "Programa Personalizado",
      "custom.title": "Crie a sua",
      "custom.titleem": "própria aventura.",
      "custom.lead":
        "Não encontrou o destino certo? Nós construímos a viagem à sua imagem — datas, percurso, grupo e ritmo definidos por si.",
      "custom.s1h": "Diz-nos o que queres",
      "custom.s1p":
        "Destino, duração, número de pessoas e experiências que procura.",
      "custom.s2h": "Nós desenhamos o roteiro",
      "custom.s2p":
        "A nossa equipa cria um plano detalhado e personalizado para si.",
      "custom.s3h": "Parte em aventura",
      "custom.s3p":
        "Tudo tratado — logística, guias e suporte durante toda a viagem.",
      "custom.btn": "Iniciar o meu programa",
      "custom.wpp": "Falar com a equipa",
      "team.tag": "Quem Somos",
      "team.title": "Conheça a Equipa",
      "team.desc": "Quem pilota as aventuras por trás dos bastidores.",
      "tips.tag": "Dicas de Viagem",
      "tips.title": "Prepare-se<br>para a aventura.",
      "tips.subtitle":
        "Pequenos detalhes que fazem a diferença entre uma boa viagem e uma viagem inesquecível.",
      "footer.tagline": "A experiência é o percurso.",
    },
    en: {
      "nav.home": "Home",
      "nav.tours": "Trips",
      "nav.gallery": "Gallery",
      "nav.custom": "Custom",
      "nav.about": "About",
      "nav.team": "Team",
      "nav.tips": "Tips",
      "nav.contact": "Contact Us",
      "hero.badge": "WELCOME TO MOCHILÃO",
      "hero.title":
        "Discover Angola <br> through experiences that <br> last a lifetime",
      "hero.subtitle":
        "Every journey starts with a choice.<br>Make yours and create unique memories across Angola.",
      "hero.cta1": "Book your trip",
      "hero.cta2": "Contact us",
      "hero.scroll": "Explore",
      "about.tag": "About Mochilão",
      "about.title":
        "The experience is the journey, the destination is a consequence",
      "about.quote":
        "We believe that every step of the trip matters as much as where we end up — it is in that journey that the stories worth keeping are born.",
      "about.text":
        "Mochilão was born from a passion for exploring Angola in all its grandeur. More than a company, we are driven by the fascination of revealing the natural wonders, peoples, cultures and rich gastronomy that make up the vast Angolan mosaic.",
      "about.btn": "Learn More",
      "about.counter1": "Trips",
      "about.counter2": "Clients",
      "about.counter3": "Satisfaction",
      "pkg.tag": "Group Trips",
      "pkg.title": "Unique experiences in Angola",
      "pkg.desc":
        "Scheduled itineraries, made to experience in group. Choose your next destination.",
      "gallery.tag": "Moments",
      "gallery.title": "Adventure Gallery",
      "gallery.desc":
        "Real moments from our trips. Follow us on Instagram for more.",
      "custom.tag": "Custom Program",
      "custom.title": "Create your",
      "custom.titleem": "own adventure.",
      "custom.lead":
        "Couldn't find the right destination? We build the trip in your image — dates, route, group and pace defined by you.",
      "custom.s1h": "Tell us what you want",
      "custom.s1p":
        "Destination, duration, number of people and the experiences you are looking for.",
      "custom.s2h": "We design the itinerary",
      "custom.s2p":
        "Our team creates a detailed and personalised plan just for you.",
      "custom.s3h": "Set off on adventure",
      "custom.s3p":
        "Everything handled — logistics, guides and support throughout the trip.",
      "custom.btn": "Start my programme",
      "custom.wpp": "Talk to the team",
      "team.tag": "Who We Are",
      "team.title": "Meet the Team",
      "team.desc": "The people who drive the adventures behind the scenes.",
      "tips.tag": "Travel Tips",
      "tips.title": "Get ready<br>for the adventure.",
      "tips.subtitle":
        "Small details that make the difference between a good trip and an unforgettable one.",
      "footer.tagline": "The experience is the journey.",
    },
  };

  const langBtn = document.getElementById("langBtn");
  const htmlEl = document.documentElement;
  let currentLang = localStorage.getItem("mochilao-lang") || "pt";

  function applyLang(lang) {
    const t = translations[lang];
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (t[key] !== undefined) el.innerHTML = t[key];
    });
    htmlEl.setAttribute("lang", lang === "en" ? "en" : "pt-BR");

    /* Actualizar bandeiras — destaca a activa */
    if (langBtn) {
      langBtn
        .querySelector(".navbar__lang-pt")
        .classList.toggle("lang--active", lang === "pt");
      langBtn
        .querySelector(".navbar__lang-en")
        .classList.toggle("lang--active", lang === "en");
    }

    currentLang = lang;
    localStorage.setItem("mochilao-lang", lang);
  }

  if (langBtn) {
    langBtn.addEventListener("click", function () {
      applyLang(currentLang === "pt" ? "en" : "pt");
    });
  }

  applyLang(currentLang);

  /* ─────────────────────────────────────────
     FAQ — accordion (lista única, sem grupos)
     ───────────────────────────────────────── */
  document.querySelectorAll(".faq__trigger").forEach(function (trigger) {
    trigger.addEventListener("click", function () {
      var isOpen = this.getAttribute("aria-expanded") === "true";
      var body = this.nextElementSibling;

      // Fecha todos os outros itens
      document.querySelectorAll(".faq__trigger").forEach(function (t) {
        t.setAttribute("aria-expanded", "false");
        if (t.nextElementSibling) t.nextElementSibling.hidden = true;
      });

      // Abre o clicado se estava fechado
      if (!isOpen) {
        this.setAttribute("aria-expanded", "true");
        body.hidden = false;
      }
    });
  });

  /* TIPS — mostra uma dica de cada vez ao clicar no ícone */
  document.querySelectorAll(".tip-card__trigger").forEach(function (trigger) {
    trigger.addEventListener("click", function () {
      var card = this.closest(".tip-card");
      var body = document.getElementById(this.getAttribute("aria-controls"));
      var isOpen = this.getAttribute("aria-expanded") === "true";

      document
        .querySelectorAll(".tip-card__trigger")
        .forEach(function (otherTrigger) {
          otherTrigger.setAttribute("aria-expanded", "false");
          var otherBody = document.getElementById(
            otherTrigger.getAttribute("aria-controls"),
          );
          if (otherBody) otherBody.hidden = true;
          otherTrigger.closest(".tip-card").classList.remove("is-open");
        });

      if (!isOpen && body) {
        this.setAttribute("aria-expanded", "true");
        body.hidden = false;
        card.classList.add("is-open");
      }
    });
  });
})();

/* ─────────────────────────────────────────
     7. TEAM CAROUSEL
     ───────────────────────────────────────── */
const teamCardsContainer = document.getElementById("teamCards");
const teamDotsContainer = document.getElementById("teamDots");

if (teamCardsContainer && teamDotsContainer) {
  const cards = Array.from(teamCardsContainer.querySelectorAll(".team-card"));
  const dots = Array.from(
    teamDotsContainer.querySelectorAll(".team-carousel__dot"),
  );
  let currentIndex = 0;
  let autoplayTimer;

  function updateCarousel(index) {
    const total = cards.length;
    currentIndex = (index + total) % total;

    cards.forEach((card, i) => {
      let diff = i - currentIndex;
      // Permite o loop contínuo garantindo valores positivos
      if (diff < 0) diff += total;
      card.setAttribute("data-pos", diff);
    });

    dots.forEach((dot, i) => {
      dot.classList.toggle("active", i === currentIndex);
    });
  }

  function startAutoplay() {
    clearInterval(autoplayTimer);
    autoplayTimer = setInterval(function () {
      updateCarousel(currentIndex + 1);
    }, 5000);
  }

  function goToSlide(index) {
    updateCarousel(index);
    startAutoplay();
  }

  // Clique nas bolinhas
  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => {
      goToSlide(i);
    });
  });

  // Clique direto no cartão de trás para trazê-lo para a frente
  cards.forEach((card) => {
    card.addEventListener("click", function () {
      const pos = parseInt(this.getAttribute("data-pos"), 10);
      if (pos === 0) return; // Já está ativo e na frente

      const cardIndex = cards.indexOf(this);
      goToSlide(cardIndex);
    });
  });

  teamCardsContainer.addEventListener("mouseenter", function () {
    clearInterval(autoplayTimer);
  });
  teamCardsContainer.addEventListener("mouseleave", startAutoplay);
  startAutoplay();
}
