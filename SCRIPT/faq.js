/* =====================================================
   O MOCHILÃO — faq.js
   Página PAGES/faq.html
   • Acordeão (abre/fecha com animação)
   • Categorias (mostra só um grupo ou todos)
   • Pesquisa (filtra, destaca o termo e abre as respostas)
   • Links diretos: faq.html#voos abre essa pergunta
   ===================================================== */

(function () {
  "use strict";

  const questions = Array.from(document.querySelectorAll(".faq-q"));
  const groups = Array.from(document.querySelectorAll(".faq-group"));
  const navLinks = Array.from(document.querySelectorAll(".faq-nav__link"));
  const search = document.getElementById("faqSearch");
  const clearBtn = document.getElementById("faqSearchClear");
  const status = document.getElementById("faqStatus");
  const empty = document.getElementById("faqEmpty");
  if (!questions.length) return;

  let currentCat = "all";

  /* Altura real da navbar → as categorias (telemóvel) ficam logo por baixo */
  const navbar = document.getElementById("navbar");
  function syncNavbarHeight() {
    if (navbar) document.documentElement.style.setProperty("--faq-navbar-h", navbar.offsetHeight + "px");
  }
  syncNavbarHeight();
  window.addEventListener("resize", syncNavbarHeight);

  /* ── Guarda o texto original (para poder destacar e repor) ── */
  questions.forEach((q) => {
    q._title = q.querySelector(".faq-q__text");
    q._answer = q.querySelector(".faq-q__inner p");
    q._titleText = q._title.textContent;
    q._answerText = q._answer.textContent;
  });

  /* ─────────────────────────────────────────
     ACORDEÃO
     ───────────────────────────────────────── */
  function setOpen(q, open) {
    q.classList.toggle("is-open", open);
    q.querySelector(".faq-q__trigger").setAttribute("aria-expanded", String(open));
  }

  questions.forEach((q) => {
    q.querySelector(".faq-q__trigger").addEventListener("click", () => {
      setOpen(q, !q.classList.contains("is-open"));
    });
  });

  /* Copiar link de uma pergunta */
  document.addEventListener("click", async (e) => {
    const link = e.target.closest("[data-copy-link]");
    if (!link) return;
    e.preventDefault();
    const url = location.href.split("#")[0] + link.getAttribute("href");
    try {
      await navigator.clipboard.writeText(url);
      const original = link.innerHTML;
      link.innerHTML = '<i class="fa-solid fa-check"></i> Link copiado';
      setTimeout(() => (link.innerHTML = original), 1800);
    } catch {
      history.replaceState(null, "", link.getAttribute("href"));
    }
  });

  /* ─────────────────────────────────────────
     PESQUISA + CATEGORIAS
     ───────────────────────────────────────── */
  const normalize = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();

  const escapeHtml = (s) =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // Destaca o termo ignorando acentos ("credito" encontra "crédito")
  function highlight(text, term) {
    if (!term) return escapeHtml(text);
    const norm = normalize(text);
    let out = "";
    let i = 0;
    let idx = norm.indexOf(term);
    while (idx !== -1) {
      out += escapeHtml(text.slice(i, idx)) + "<mark>" + escapeHtml(text.slice(idx, idx + term.length)) + "</mark>";
      i = idx + term.length;
      idx = norm.indexOf(term, i);
    }
    return out + escapeHtml(text.slice(i));
  }

  function apply() {
    const term = normalize(search ? search.value.trim() : "");
    let shown = 0;

    questions.forEach((q) => {
      const inCat = currentCat === "all" || q.closest(".faq-group").id === currentCat;
      const match = !term || normalize(q._titleText + " " + q._answerText).includes(term);
      const visible = inCat && match;
      q.hidden = !visible;
      if (visible) shown++;

      q._title.innerHTML = highlight(q._titleText, term);
      q._answer.innerHTML = highlight(q._answerText, term);
      // Na pesquisa, abre as respostas encontradas
      if (term) setOpen(q, visible);
    });

    groups.forEach((g) => {
      g.hidden = !g.querySelector(".faq-q:not([hidden])");
    });

    if (empty) empty.hidden = shown > 0;
    if (clearBtn) clearBtn.hidden = !term;
    if (status) {
      status.textContent = term
        ? shown
          ? `${shown} resposta${shown !== 1 ? "s" : ""} encontrada${shown !== 1 ? "s" : ""}`
          : "Nenhuma resposta encontrada"
        : "";
    }
  }

  function selectCategory(cat, { scroll = true } = {}) {
    currentCat = cat;
    navLinks.forEach((l) => l.classList.toggle("is-active", l.dataset.cat === cat));
    apply();
    if (scroll) {
      const target = cat === "all" ? document.getElementById("faqContent") : document.getElementById(cat);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    history.replaceState(null, "", cat === "all" ? location.pathname : "#" + cat);
  }

  navLinks.forEach((l) =>
    l.addEventListener("click", (e) => {
      e.preventDefault();
      selectCategory(l.dataset.cat);
    }),
  );

  let timer;
  search?.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      // Pesquisar procura em todas as categorias
      if (search.value.trim() && currentCat !== "all") {
        currentCat = "all";
        navLinks.forEach((l) => l.classList.toggle("is-active", l.dataset.cat === "all"));
      }
      apply();
      if (!search.value.trim()) questions.forEach((q) => setOpen(q, false));
    }, 150);
  });

  search?.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      search.value = "";
      search.dispatchEvent(new Event("input"));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("faqContent")?.scrollIntoView({ behavior: "smooth" });
    }
  });

  clearBtn?.addEventListener("click", () => {
    search.value = "";
    search.dispatchEvent(new Event("input"));
    search.focus();
  });

  /* ─────────────────────────────────────────
     LINK DIRETO (faq.html#voos ou faq.html#reservas)
     ───────────────────────────────────────── */
  function openFromHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;

    if (el.classList.contains("faq-group")) {
      selectCategory(id);
      return;
    }
    if (el.classList.contains("faq-q")) {
      setOpen(el, true);
      el.classList.remove("is-target");
      void el.offsetWidth; // reinicia a animação
      el.classList.add("is-target");
      setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    }
  }

  window.addEventListener("hashchange", openFromHash);
  apply();
  openFromHash();
})();