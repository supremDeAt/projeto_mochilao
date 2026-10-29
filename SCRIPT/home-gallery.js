/* =====================================================
   O MOCHILÃO — home-gallery.js  (ES module)
   Galeria da página inicial ("Galeria de Aventuras").
   As fotos são geridas no painel admin → Site Web → Galeria.

   Cada foto é um documento:
     siteConfig/galeria-main, galeria-r1 … galeria-r4
     { data: "<url da imagem>", alt, atualizadoEm }

   • Linhas justificadas: todas as fotos de uma linha têm a
     mesma altura e mantêm o seu formato (sem cortes); a
     galeria acaba sempre numa linha reta.
   • Ao clicar abre-se a foto em grande, com setas para
     avançar e recuar (teclado, botões e deslizar no telemóvel).
   • Sem fotos no Firestore (ou sem ligação) → ficam os
     quadrados de exemplo do HTML.
   ===================================================== */

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

/** Altura alvo das linhas e espaço entre fotos, lidos do CSS */
function rowSettings(box) {
  const cs = getComputedStyle(box);
  return {
    alvo: parseFloat(cs.getPropertyValue("--row-h")) || 280,
    gap: parseFloat(cs.columnGap) || 0,
  };
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
  box.replaceChildren(...items);

  const relayout = () => {
    const { alvo, gap } = rowSettings(box);
    justifyRows(box, items, alvo, gap);
  };
  relayout();

  // Cada foto que carrega: passa o seu formato (--r) e reorganiza as linhas
  items.forEach((item) => {
    const img = item.querySelector("img");
    const done = () => {
      if (img.naturalWidth && img.naturalHeight) {
        item.style.setProperty("--r", (img.naturalWidth / img.naturalHeight).toFixed(4));
      }
      item.classList.add("is-loaded");
      relayout();
    };
    if (img.complete && img.naturalWidth) done();
    else {
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    }
  });

  // Ecrã muda de largura → refaz as linhas
  let t;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(relayout, 120);
  });

  box.addEventListener("click", (e) => {
    const item = e.target.closest(".gallery__item--photo");
    if (!item) return;
    import("./lightbox.js")
      .then((m) => m.openLightbox(photos, Number(item.dataset.index), item))
      .catch((err) => console.error("[galeria] Não foi possível abrir o visualizador (falta o SCRIPT/lightbox.js?)", err));
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
