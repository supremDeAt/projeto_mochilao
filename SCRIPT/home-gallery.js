/* =====================================================
   O MOCHILÃO — home-gallery.js  (ES module)
   Galeria da página inicial ("Galeria de Aventuras").
   As fotos são geridas no painel admin → Site Web → Galeria.

   Cada foto é um documento:
     siteConfig/galeria-main, galeria-r1 … galeria-r4
     { data: "<url da imagem>", alt, atualizadoEm }

   • Mosaico: cada foto aparece no seu formato original
     (vertical, horizontal ou quadrada), sem cortes.
   • Ao clicar abre-se a foto em grande, com setas para
     avançar e recuar (teclado, botões e deslizar no telemóvel).
   • Sem fotos no Firestore (ou sem ligação) → ficam os
     quadrados de exemplo do HTML.
   ===================================================== */

import { openLightbox } from "./lightbox.js";

export const GALLERY_SLOTS = [
  { key: "main", label: "Foto 1" },
  { key: "r1", label: "Foto 2" },
  { key: "r2", label: "Foto 3" },
  { key: "r3", label: "Foto 4" },
  { key: "r4", label: "Foto 5" },
];

export const slotDocId = (key) => `galeria-${key}`;

const DEFAULT_ALT = "Momento de uma viagem O Mochilão";
const safeImg = (u) => (/^(data:image\/|https?:\/\/)/i.test(u || "") ? u : "");

/* Fotos do Cloudinary: no mosaico pede-se uma versão mais leve
   (900 px); a foto em grande usa o tamanho original guardado. */
function thumbUrl(src) {
  return src.replace(/\/upload\/([^/]*?)c_limit,w_\d+,h_\d+/, "/upload/$1c_limit,w_900,h_900");
}

/* ─────────────────────────────────────────
   MOSAICO
   ───────────────────────────────────────── */

/** Contentor do mosaico. Aceita o HTML novo (.gallery__masonry)
    e o antigo (.gallery__right + foto grande na coluna esquerda). */
function getMasonry() {
  const section = document.querySelector(".gallery");
  if (!section) return null;
  let box = section.querySelector(".gallery__masonry");
  if (!box) {
    box = section.querySelector(".gallery__right");
    if (!box) return null;
    box.classList.add("gallery__masonry");
  }
  // HTML antigo: a foto grande estava na coluna esquerda
  section.querySelector(".gallery__left .gallery__item--main")?.remove();
  return box;
}

function renderMasonry(box, photos) {
  const items = photos.map((p, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gallery__item gallery__item--photo";
    btn.dataset.index = i;
    btn.setAttribute("aria-label", `Ver foto ${i + 1} de ${photos.length} em grande`);
    btn.innerHTML = `
      <img src="${thumbUrl(p.src)}" alt="${escAttr(p.alt)}" decoding="async" />
      <span class="gallery__hover" aria-hidden="true"><i class="fa-solid fa-expand"></i></span>`;
    return btn;
  });

  box.innerHTML = "";
  box.classList.add("is-js");

  /* Coloca cada foto na coluna mais baixa nesse momento, pela ordem
     do painel: o mosaico fica equilibrado seja qual for o formato. */
  let cols = 0;
  function layout(force) {
    const n = parseInt(getComputedStyle(box).getPropertyValue("--gallery-cols"), 10) || 2;
    if (n === cols && !force) return;
    cols = n;
    const columns = Array.from({ length: n }, () => {
      const c = document.createElement("div");
      c.className = "gallery__col";
      return c;
    });
    const heights = new Array(n).fill(0);
    items.forEach((item) => {
      const img = item.querySelector("img");
      const ratio = img.naturalWidth ? img.naturalHeight / img.naturalWidth : 0.75;
      const k = heights.indexOf(Math.min(...heights));
      columns[k].appendChild(item);
      heights[k] += ratio;
    });
    box.replaceChildren(...columns);
  }

  layout(true);

  // Cada foto que carrega: mostra-a e reequilibra as colunas
  items.forEach((item) => {
    const img = item.querySelector("img");
    const done = () => {
      item.classList.add("is-loaded");
      layout(true);
    };
    if (img.complete && img.naturalWidth) done();
    else img.addEventListener("load", done, { once: true });
  });

  // Muda o nº de colunas quando o ecrã muda de largura
  let t;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(() => layout(false), 150);
  });

  box.addEventListener("click", (e) => {
    const item = e.target.closest(".gallery__item--photo");
    if (item) openLightbox(photos, Number(item.dataset.index), item);
  });
}

function escAttr(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/* ─────────────────────────────────────────
   DADOS
   ───────────────────────────────────────── */

async function applyOnSite() {
  const box = getMasonry();
  if (!box) return;
  try {
    const [{ db }, { doc, getDoc }] = await Promise.all([
      import("./firebase-config.js"),
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js"),
    ]);
    const snaps = await Promise.all(
      GALLERY_SLOTS.map((s) => getDoc(doc(db, "siteConfig", slotDocId(s.key)))),
    );
    const photos = snaps
      .map((snap) => (snap.exists() ? snap.data() : null))
      .map((d) => {
        const alt = (d?.alt || "").trim();
        return { src: safeImg(d?.data), alt: alt || DEFAULT_ALT, caption: alt };
      })
      .filter((p) => p.src);

    // Sem nenhuma foto publicada: ficam os quadrados de exemplo
    if (photos.length) renderMasonry(box, photos);
  } catch (err) {
    console.warn("[galeria] A usar o conteúdo do HTML:", err);
  }
}

if (!document.querySelector(".admin-page")) applyOnSite();
