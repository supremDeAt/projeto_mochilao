/* =====================================================
   O MOCHILÃO — lightbox.js  (ES module)
   Visualizador de fotos em ecrã inteiro, usado por:
     • home-gallery.js     → galeria do index
     • gallery-masonry.js  → galeria de cada programa

   openLightbox(fotos, índice, elementoQueAbriu)
     fotos = [{ src, alt, caption }]

   Setas ← →, Esc para fechar, deslizar o dedo no telemóvel.
   O estilo vem dentro deste ficheiro (não depende do CSS da página).
   ===================================================== */

/* ─────────────────────────────────────────
   VISUALIZADOR (lightbox)
   ───────────────────────────────────────── */

/* Estilo do visualizador: vai junto com o script, para funcionar
   em qualquer página mesmo que o CSS da página não o tenha. */
const CSS = `
html.lightbox-open {
  overflow: hidden;
}

.lightbox {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-rows: auto minmax(0, 1fr);
  align-items: center;
  gap: 0 1rem;
  padding: 1rem 1.5rem 1.5rem;
  background: var(--clr-black-94, rgba(13, 10, 6, 0.94));
  opacity: 0;
  transition: opacity 0.25s ease;
}
.lightbox[hidden] {
  display: none;
}
.lightbox.is-open {
  opacity: 1;
}

.lightbox__top {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
}
.lightbox__counter {
  font-family: var(--font-body, sans-serif);
  font-size: 0.85rem;
  letter-spacing: 0.12em;
  color: var(--clr-white-70, rgba(255, 255, 255, 0.7));
}

.lightbox__stage {
  grid-column: 2;
  margin: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.9rem;
  min-height: 0;
}
.lightbox__img {
  display: block;
  max-width: 100%;
  max-height: calc(100dvh - 9rem);
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 4px;
  opacity: 0;
  transform: scale(0.98);
  transition:
    opacity 0.3s ease,
    transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.lightbox__img.is-loaded {
  opacity: 1;
  transform: none;
}
.lightbox__caption {
  font-family: var(--font-body, sans-serif);
  font-size: 0.9rem;
  color: var(--clr-white-70, rgba(255, 255, 255, 0.7));
  text-align: center;
  max-width: 60ch;
}
.lightbox__caption:empty {
  display: none;
}

.lightbox__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border: 0;
  border-radius: 50%;
  background: var(--clr-white-12, rgba(255, 255, 255, 0.12));
  color: var(--clr-white, #fff);
  font-size: 1.1rem;
  cursor: pointer;
  transition: background 0.2s ease;
}
.lightbox__btn:hover {
  background: var(--clr-white-25, rgba(255, 255, 255, 0.25));
}
.lightbox__btn:focus-visible {
  outline: 2px solid var(--clr-white, #fff);
  outline-offset: 2px;
}
.lightbox__btn[hidden] {
  display: none;
}
.lightbox__nav--prev { grid-column: 1; grid-row: 2; }
.lightbox__nav--next { grid-column: 3; grid-row: 2; }

/* Telemóvel: setas por cima da foto, nos cantos de baixo */
@media (max-width: 640px) {
  .lightbox {
    grid-template-columns: minmax(0, 1fr);
    padding: 0.75rem 0.75rem 1rem;
  }
  .lightbox__stage {
    grid-column: 1;
    grid-row: 2;
  }
  .lightbox__img {
    max-height: calc(100dvh - 10rem);
  }
  .lightbox__nav {
    position: absolute;
    bottom: 1rem;
    width: 44px;
    height: 44px;
  }
  .lightbox__nav--prev { left: 1rem; }
  .lightbox__nav--next { right: 1rem; }
}
`;

function injectCss() {
  if (document.getElementById("lightbox-css")) return;
  const style = document.createElement("style");
  style.id = "lightbox-css";
  style.textContent = CSS;
  document.head.appendChild(style);
}

let lb = null; // elementos do visualizador (criado na 1ª vez)

function buildLightbox() {
  injectCss();
  const el = document.createElement("div");
  el.className = "lightbox";
  el.hidden = true;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", "Galeria de fotos");
  el.innerHTML = `
    <div class="lightbox__top">
      <span class="lightbox__counter" aria-live="polite"></span>
      <button type="button" class="lightbox__btn lightbox__close" aria-label="Fechar">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <button type="button" class="lightbox__btn lightbox__nav lightbox__nav--prev" aria-label="Foto anterior">
      <i class="fa-solid fa-chevron-left"></i>
    </button>
    <figure class="lightbox__stage">
      <img class="lightbox__img" alt="" />
      <figcaption class="lightbox__caption"></figcaption>
    </figure>
    <button type="button" class="lightbox__btn lightbox__nav lightbox__nav--next" aria-label="Foto seguinte">
      <i class="fa-solid fa-chevron-right"></i>
    </button>`;
  document.body.appendChild(el);

  const refs = {
    el,
    img: el.querySelector(".lightbox__img"),
    caption: el.querySelector(".lightbox__caption"),
    counter: el.querySelector(".lightbox__counter"),
    prev: el.querySelector(".lightbox__nav--prev"),
    next: el.querySelector(".lightbox__nav--next"),
    close: el.querySelector(".lightbox__close"),
    photos: [],
    index: 0,
    opener: null,
  };

  refs.prev.addEventListener("click", () => go(-1));
  refs.next.addEventListener("click", () => go(1));
  refs.close.addEventListener("click", closeLightbox);

  // Clicar fora da foto fecha
  el.addEventListener("click", (e) => {
    if (e.target === el || e.target.classList.contains("lightbox__stage")) closeLightbox();
  });

  // Teclado: ← → Esc, e o Tab fica dentro do visualizador
  document.addEventListener("keydown", (e) => {
    if (el.hidden) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft") go(-1);
    else if (e.key === "ArrowRight") go(1);
    else if (e.key === "Tab") {
      const btns = [...el.querySelectorAll("button:not([hidden])")];
      const first = btns[0];
      const last = btns[btns.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // Deslizar o dedo para o lado (telemóvel)
  let startX = 0;
  let startY = 0;
  el.addEventListener(
    "touchstart",
    (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    },
    { passive: true },
  );
  el.addEventListener(
    "touchend",
    (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
    },
    { passive: true },
  );

  return refs;
}

function show(index) {
  const n = lb.photos.length;
  lb.index = (index + n) % n;
  const p = lb.photos[lb.index];

  lb.img.classList.remove("is-loaded");
  lb.img.onload = () => lb.img.classList.add("is-loaded");
  lb.img.src = p.src;
  lb.img.alt = p.alt || "";
  if (lb.img.complete && lb.img.naturalWidth) lb.img.classList.add("is-loaded");

  lb.caption.textContent = p.caption || "";
  lb.counter.textContent = `${lb.index + 1} / ${n}`;

  // Pré-carrega a anterior e a seguinte para a troca ser imediata
  [lb.index - 1, lb.index + 1].forEach((i) => {
    const near = lb.photos[(i + n) % n];
    if (near) new Image().src = near.src;
  });
}

function go(step) {
  if (lb.photos.length > 1) show(lb.index + step);
}

export function openLightbox(photos, index, opener) {
  lb ||= buildLightbox();
  lb.photos = photos;
  lb.opener = opener || null;
  const single = photos.length < 2;
  lb.prev.hidden = single;
  lb.next.hidden = single;
  show(index);

  lb.el.hidden = false;
  document.documentElement.classList.add("lightbox-open");
  requestAnimationFrame(() => lb.el.classList.add("is-open"));
  lb.close.focus({ preventScroll: true });
}

export function closeLightbox() {
  if (!lb || lb.el.hidden) return;
  lb.el.classList.remove("is-open");
  document.documentElement.classList.remove("lightbox-open");
  lb.el.hidden = true;
  lb.img.removeAttribute("src");
  lb.opener?.focus({ preventScroll: true });
}

