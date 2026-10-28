/* =====================================================
   O MOCHILÃO — gallery-masonry.js
   Galeria do programa (programa.html):
   • Mosaico: cada foto aparece no seu formato original —
     vertical continua vertical, horizontal continua
     horizontal — sem cortes.
   • Ao clicar numa foto abre-se em grande, com setas para
     ver as outras (visualizador em lightbox.js).

   Funciona com qualquer conteúdo posto em #pkgGallery
   (programas.js ou programa-firestore.js), mesmo que a
   galeria seja substituída depois de a página abrir:
   procura sempre a galeria actual na página.
   ===================================================== */

(function () {
  "use strict";

  // Endereço deste ficheiro (só se consegue ler agora, no arranque)
  const SELF_URL = (document.currentScript && document.currentScript.src) || location.href;

  const getGrid = () => document.getElementById("pkgGallery");

  let currentCols = 0;
  let busy = false; // true enquanto o próprio script mexe na galeria

  // Nº de colunas conforme a largura disponível
  function columnCount(grid) {
    const w = grid.clientWidth || window.innerWidth;
    return w < 900 ? 2 : 3;
  }

  // Altura relativa da foto (altura ÷ largura). Antes de carregar: 3/4.
  function ratio(item) {
    const img = item.querySelector("img");
    if (img && img.naturalWidth) return img.naturalHeight / img.naturalWidth;
    return 0.75;
  }

  /* Itens da galeria, pela ordem original. Se vierem fotos soltas
     (<img> sem o quadro .pkg-gallery__item), cria-se o quadro. */
  function collectItems(grid) {
    grid.querySelectorAll("img").forEach((img) => {
      if (!img.closest(".pkg-gallery__item")) {
        const wrap = document.createElement("div");
        wrap.className = "pkg-gallery__item";
        img.classList.add("pkg-gallery__img");
        img.replaceWith(wrap);
        wrap.appendChild(img);
      }
    });
    const items = Array.from(grid.querySelectorAll(".pkg-gallery__item"));
    // Guarda a ordem original na 1.ª vez que o item aparece
    let next = items.reduce((m, el) => Math.max(m, Number(el.dataset.order ?? -1)), -1) + 1;
    items.forEach((el) => {
      if (el.dataset.order === undefined) el.dataset.order = next++;
    });
    return items.sort((a, b) => a.dataset.order - b.dataset.order);
  }

  /* Distribui as fotos pela coluna mais "baixa" em cada momento,
     mantendo a ordem da esquerda para a direita. */
  function layout() {
    const grid = getGrid();
    if (!grid) return;
    busy = true;
    try {
      const items = collectItems(grid);
      if (!items.length) return;

      const n = columnCount(grid);
      currentCols = n;
      const cols = Array.from({ length: n }, () => {
        const c = document.createElement("div");
        c.className = "pkg-gallery__col";
        return c;
      });
      const heights = new Array(n).fill(0);

      const photos = items.filter((item) => item.querySelector("img"));
      items.forEach((item) => {
        const r = ratio(item);
        item.classList.remove("pkg-gallery__item--tall"); // formato vem da própria foto
        item.classList.toggle("is-portrait", r > 1.05);
        item.classList.toggle("is-landscape", r < 0.95);
        const k = heights.indexOf(Math.min(...heights));
        cols[k].appendChild(item);
        heights[k] += r;

        const img = item.querySelector("img");
        if (img) {
          img.loading = "eager"; // a altura real é precisa para o mosaico
          if (!img.complete && !img.dataset.wait) {
            img.dataset.wait = "1";
            img.addEventListener("load", scheduleLayout, { once: true });
            img.addEventListener("error", scheduleLayout, { once: true });
          }
          // Pode-se clicar para ver em grande
          item.classList.add("pkg-gallery__item--photo");
          item.tabIndex = 0;
          item.setAttribute("role", "button");
          item.setAttribute(
            "aria-label",
            "Ver foto " + (photos.indexOf(item) + 1) + " de " + photos.length + " em grande",
          );
        }
      });

      grid.replaceChildren(...cols);
      grid.classList.add("is-masonry");
    } finally {
      // Ignora as mudanças feitas aqui antes de voltar a ouvir
      observer.takeRecords();
      busy = false;
    }
  }

  let layoutTimer;
  function scheduleLayout() {
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(layout, 60);
  }

  // Volta a organizar sempre que a galeria (ou a página) muda
  const observer = new MutationObserver((records) => {
    if (busy) return;
    const grid = getGrid();
    if (!grid) return;
    const touchesGallery = records.some(
      (r) =>
        r.target === grid ||
        grid.contains(r.target) ||
        // a galeria inteira foi (re)colocada na página
        Array.from(r.addedNodes).some((n) => n === grid || (n.contains && n.contains(grid))),
    );
    if (touchesGallery) scheduleLayout();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener("resize", () => {
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(() => {
      const grid = getGrid();
      if (grid && columnCount(grid) !== currentCols) layout();
    }, 150);
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
    const list = Array.from(grid.querySelectorAll(".pkg-gallery__item"))
      .filter((el) => el.querySelector("img"))
      .sort((a, b) => (a.dataset.order ?? 0) - (b.dataset.order ?? 0));
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
    document.addEventListener("DOMContentLoaded", layout);
  } else {
    layout();
  }
  console.info("[galeria] gallery-masonry.js ativo (v4)");
})();
