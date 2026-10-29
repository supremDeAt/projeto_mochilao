/* =====================================================
   O MOCHILÃO — gallery-masonry.js
   Galeria do programa (programa.html):
   • Linhas justificadas: todas as fotos de uma linha têm a
     mesma altura e mantêm o seu formato (sem cortes). A
     galeria acaba sempre numa linha reta.
   • Ao clicar numa foto abre-se em grande, com setas para
     ver as outras (visualizador em lightbox.js).

   O script lê o formato de cada foto (--r = largura ÷ altura)
   e calcula as linhas; a altura alvo e o espaço entre fotos
   vêm do CSS (programas.css → "GALERIA EM LINHAS").

   Funciona com qualquer conteúdo posto em #pkgGallery
   (programas.js ou programa-firestore.js), mesmo que a
   galeria seja substituída depois de a página abrir.
   ===================================================== */

(function () {
  "use strict";

  // Endereço deste ficheiro (só se consegue ler agora, no arranque)
  const SELF_URL = (document.currentScript && document.currentScript.src) || location.href;

  const getGrid = () => document.getElementById("pkgGallery");
  let busy = false; // true enquanto o próprio script mexe na galeria

  /* Arruma as fotos em linhas: todas as fotos de uma linha ficam com a
     mesma altura e a linha ocupa a largura toda. Cada linha fica com a
     altura mais próxima de "alvo". A última linha mantém a altura
     normal e fica alinhada à esquerda. */
  function justifyRows(box, items, alvo, gap) {
    const W = box.clientWidth;
    if (!W || !items.length) return;
    const ratioOf = (el) => parseFloat(el.style.getPropertyValue("--r")) || 1.333;
    const place = (row, h) =>
      row.forEach((el) => {
        el.style.flex = "0 0 auto";
        el.style.height = h.toFixed(2) + "px";
        el.style.width = Math.floor(ratioOf(el) * h * 100) / 100 + "px";
      });
    let row = [];
    let sum = 0;
    items.forEach((el) => {
      const r = ratioOf(el);
      const hWith = (W - gap * row.length) / (sum + r);
      if (row.length && hWith < alvo) {
        const hWithout = (W - gap * (row.length - 1)) / sum;
        // Fica com a opção cuja altura está mais perto do alvo
        if (Math.abs(hWith - alvo) < Math.abs(hWithout - alvo)) {
          row.push(el);
          place(row, hWith);
          row = [];
          sum = 0;
          return;
        }
        place(row, hWithout);
        row = [];
        sum = 0;
      }
      row.push(el);
      sum += r;
    });
    if (row.length) {
      const h = Math.min(alvo, (W - gap * (row.length - 1)) / sum);
      place(row, h);
    }
  }

  function relayout() {
    const grid = getGrid();
    if (!grid) return;
    const cs = getComputedStyle(grid);
    const alvo = parseFloat(cs.getPropertyValue("--row-h")) || 280;
    const gap = parseFloat(cs.columnGap) || 0;
    busy = true;
    try {
      justifyRows(grid, Array.from(grid.querySelectorAll(".pkg-gallery__item")), alvo, gap);
    } finally {
      observer.takeRecords();
      busy = false;
    }
  }

  function setRatio(item) {
    const img = item.querySelector("img");
    if (img && img.naturalWidth && img.naturalHeight) {
      item.style.setProperty("--r", (img.naturalWidth / img.naturalHeight).toFixed(4));
    }
    relayout();
  }

  /* Prepara a galeria: um quadro por foto, pela ordem original */
  function prepare() {
    const grid = getGrid();
    if (!grid) return;
    busy = true;
    try {
      // Fotos soltas (<img> sem o quadro .pkg-gallery__item) → cria-se o quadro
      grid.querySelectorAll("img").forEach((img) => {
        if (!img.closest(".pkg-gallery__item")) {
          const wrap = document.createElement("div");
          wrap.className = "pkg-gallery__item";
          img.classList.add("pkg-gallery__img");
          img.replaceWith(wrap);
          wrap.appendChild(img);
        }
      });

      // Versões antigas punham as fotos em colunas → tira-as das colunas
      const items = Array.from(grid.querySelectorAll(".pkg-gallery__item"));
      if (grid.querySelector(".pkg-gallery__col")) {
        items.sort((a, b) => (a.dataset.order ?? 0) - (b.dataset.order ?? 0));
        grid.replaceChildren(...items);
      }
      grid.classList.remove("is-masonry");
      grid.classList.add("is-justified");

      const photos = items.filter((item) => item.querySelector("img"));
      items.forEach((item) => {
        item.classList.remove("pkg-gallery__item--tall"); // formato vem da própria foto
        const img = item.querySelector("img");
        if (!img) return;

        img.loading = "eager";
        if (img.complete) setRatio(item);
        else if (!img.dataset.wait) {
          img.dataset.wait = "1";
          img.addEventListener("load", () => setRatio(item), { once: true });
        }

        // Pode-se clicar para ver em grande
        item.classList.add("pkg-gallery__item--photo");
        item.tabIndex = 0;
        item.setAttribute("role", "button");
        item.setAttribute(
          "aria-label",
          "Ver foto " + (photos.indexOf(item) + 1) + " de " + photos.length + " em grande",
        );
      });
    } finally {
      observer.takeRecords(); // ignora as mudanças feitas aqui
      busy = false;
    }
    relayout();
  }

  let timer;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(prepare, 30);
  }

  // Volta a preparar sempre que a galeria (ou a página) muda
  const observer = new MutationObserver((records) => {
    if (busy) return;
    const grid = getGrid();
    if (!grid) return;
    const touchesGallery = records.some(
      (r) =>
        r.target === grid ||
        grid.contains(r.target) ||
        Array.from(r.addedNodes).some((n) => n === grid || (n.contains && n.contains(grid))),
    );
    if (touchesGallery) schedule();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(relayout, 120);
  });

  /* ── Visualizador ── */

  /* Procura o lightbox.js: na mesma pasta deste ficheiro, na pasta
     acima (se os scripts estiverem em subpastas) ou em SCRIPT/. */
  let lightboxModule = null;
  async function loadLightbox() {
    if (lightboxModule) return lightboxModule;
    const pageRoot = new URL(/\/PAGES\//i.test(location.pathname) ? "../" : "./", location.href);
    const candidates = [
      new URL("lightbox.js", SELF_URL),
      new URL("../lightbox.js", SELF_URL),
      new URL("SCRIPT/lightbox.js", pageRoot),
    ].map(String);
    for (const href of [...new Set(candidates)]) {
      try {
        lightboxModule = await import(href);
        return lightboxModule;
      } catch (e) {
        /* tenta o próximo endereço */
      }
    }
    throw new Error("lightbox.js não encontrado. Procurado em: " + candidates.join(" | "));
  }

  function openAt(item) {
    const grid = getGrid();
    if (!grid) return;
    const list = Array.from(grid.querySelectorAll(".pkg-gallery__item")).filter((el) =>
      el.querySelector("img"),
    );
    const index = list.indexOf(item);
    if (index < 0) return;
    const photos = list.map((el) => {
      const img = el.querySelector("img");
      return { src: img.currentSrc || img.src, alt: img.alt || "", caption: "" };
    });
    loadLightbox()
      .then((m) => m.openLightbox(photos, index, item))
      .catch((err) => console.error("[galeria] Não foi possível abrir o visualizador:", err.message));
  }

  // Cliques ouvidos na página inteira: funciona mesmo se a galeria for trocada
  function photoFromEvent(e) {
    const item = e.target.closest && e.target.closest("#pkgGallery .pkg-gallery__item");
    return item && item.querySelector("img") ? item : null;
  }
  document.addEventListener("click", (e) => {
    const item = photoFromEvent(e);
    if (!item) return;
    e.preventDefault();
    openAt(item);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const item = photoFromEvent(e);
    if (!item) return;
    e.preventDefault();
    openAt(item);
  });

  // Arranque (se o script vier no <head>, espera pela página)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", prepare);
  } else {
    prepare();
  }
  console.info("[galeria] gallery-masonry.js ativo (v5 — linhas)");
})();
