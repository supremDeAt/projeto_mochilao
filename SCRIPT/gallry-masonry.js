/* =====================================================
   O MOCHILÃO — gallery-masonry.js
   Galeria do programa (programa.html) em "mosaico":
   cada foto aparece no seu formato original — vertical
   continua vertical, horizontal continua horizontal —
   sem cortes.

   Funciona com qualquer conteúdo posto em #pkgGallery
   (programas.js ou programa-firestore.js): observa a
   galeria e volta a organizar sempre que muda.
   ===================================================== */

(function () {
  "use strict";

  const grid = document.getElementById("pkgGallery");
  if (!grid) return;

  let items = [];
  let currentCols = 0;

  // Nº de colunas conforme a largura disponível
  function columnCount() {
    const w = grid.clientWidth || window.innerWidth;
    if (w < 520) return 2;
    if (w < 900) return 2;
    return 3;
  }

  // Altura relativa da foto (altura ÷ largura). Antes de carregar: 3/4.
  function ratio(item) {
    const img = item.querySelector("img");
    if (img && img.naturalWidth) return img.naturalHeight / img.naturalWidth;
    return 0.75;
  }

  const observer = new MutationObserver(() => refresh());

  /* Distribui as fotos pela coluna mais "baixa" em cada momento,
     mantendo a ordem da esquerda para a direita. */
  function layout() {
    if (!items.length) return;
    observer.disconnect();

    const n = columnCount();
    currentCols = n;
    const cols = Array.from({ length: n }, () => {
      const c = document.createElement("div");
      c.className = "pkg-gallery__col";
      return c;
    });
    const heights = new Array(n).fill(0);

    items.forEach((item) => {
      const r = ratio(item);
      item.classList.remove("pkg-gallery__item--tall"); // formato vem da própria foto
      item.classList.toggle("is-portrait", r > 1.05);
      item.classList.toggle("is-landscape", r < 0.95);
      const k = heights.indexOf(Math.min(...heights));
      cols[k].appendChild(item);
      heights[k] += r;
    });

    grid.replaceChildren(...cols);
    grid.classList.add("is-masonry");
    observer.observe(grid, { childList: true });
  }

  // Volta a organizar quando cada foto termina de carregar
  let relayoutTimer;
  function scheduleLayout() {
    clearTimeout(relayoutTimer);
    relayoutTimer = setTimeout(layout, 60);
  }

  function refresh() {
    items = Array.from(grid.querySelectorAll(".pkg-gallery__item"));
    if (!items.length) return;
    items.forEach((item) => {
      const img = item.querySelector("img");
      if (img && !img.complete) {
        img.addEventListener("load", scheduleLayout, { once: true });
        img.addEventListener("error", scheduleLayout, { once: true });
      }
      // Carregar já: a altura real é precisa para organizar o mosaico
      if (img) img.loading = "eager";
    });
    layout();
  }

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (columnCount() !== currentCols) layout();
    }, 150);
  });

  observer.observe(grid, { childList: true });
  refresh();
})();