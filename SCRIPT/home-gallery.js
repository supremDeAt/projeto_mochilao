/* =====================================================
   O MOCHILÃO — home-gallery.js  (ES module)
   Galeria da página inicial ("Galeria de Aventuras").
   As fotos são geridas no painel admin → Site Web → Galeria.

   Cada lugar da galeria é um documento:
     siteConfig/galeria-main, galeria-r1 … galeria-r4
     { data: "data:image/webp;base64,…", link, alt, atualizadoEm }
   (um documento por foto: o Firestore aceita até 1 MB por documento)

   Lugar sem foto no Firestore → fica o que está no HTML.
   ===================================================== */

export const GALLERY_SLOTS = [
  { key: "main", label: "Foto grande (vertical, à esquerda)", css: "gallery__item--main", shape: "portrait" },
  { key: "r1", label: "Grelha — em cima à esquerda", css: "gallery__item--r1", shape: "landscape" },
  { key: "r2", label: "Grelha — em cima à direita", css: "gallery__item--r2", shape: "landscape" },
  { key: "r3", label: "Grelha — em baixo à esquerda", css: "gallery__item--r3", shape: "landscape" },
  { key: "r4", label: "Grelha — em baixo à direita", css: "gallery__item--r4", shape: "landscape" },
];

export const DEFAULT_LINK = "https://www.instagram.com/o_mochilao/";
export const slotDocId = (key) => `galeria-${key}`;

const safeImg = (u) => (/^(data:image\/|https?:\/\/)/i.test(u || "") ? u : "");
const safeLink = (u) => (/^https?:\/\//i.test(u || "") ? u : "");

/** Mostra a foto de um lugar na galeria do index. */
function fillSlot(slot, data) {
  const el = document.querySelector(`.gallery .${slot.css}`);
  if (!el || !data) return;
  const src = safeImg(data.data);
  if (!src) return;

  el.querySelector(".gallery__ph")?.remove();
  let img = el.querySelector("img");
  if (!img) {
    img = document.createElement("img");
    img.loading = "lazy";
    el.prepend(img);
  }
  img.src = src;
  img.alt = data.alt || "Momento de uma viagem O Mochilão";

  const link = safeLink(data.link);
  if (link) el.href = link;
}

async function applyOnSite() {
  if (!document.querySelector(".gallery")) return;
  try {
    const [{ db }, { doc, getDoc }] = await Promise.all([
      import("./firebase-config.js"),
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js"),
    ]);
    // As 5 leituras em paralelo: cada foto aparece assim que chega
    await Promise.all(
      GALLERY_SLOTS.map(async (slot) => {
        const snap = await getDoc(doc(db, "siteConfig", slotDocId(slot.key)));
        if (snap.exists()) fillSlot(slot, snap.data());
      }),
    );
  } catch (err) {
    console.warn("[galeria] A usar as imagens do HTML:", err);
  }
}

if (!document.querySelector(".admin-page")) applyOnSite();
