/* =====================================================
   O MOCHILÃO — parceiros-logos.js  (ES module)
   Faixa de logótipos dos parceiros no index.

   siteConfig/parceiros-logos = {
     titulo: "Os nossos parceiros",
     itens: [{ id, nome, url, logo }]   ← pela ordem do painel
   }
   Sem logótipos → a secção fica escondida.
   ===================================================== */

export const PL_DOC = "parceiros-logos";
export const PL_DEFAULT_TITLE = "Os nossos parceiros";

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const safeImg = (u) => (/^(data:image\/(png|jpe?g|webp|svg\+xml);|https:\/\/)/.test(String(u || "")) ? String(u) : "");
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : "");

/** Desenha a faixa (usado também na pré-visualização do painel) */
export function renderPartnerLogos(section, data = {}) {
  if (!section) return;
  const list = section.querySelector("[data-pl-list]");
  const label = section.querySelector("[data-pl-title]");
  const itens = (Array.isArray(data.itens) ? data.itens : []).filter((p) => safeImg(p.logo));

  if (label) label.textContent = typeof data.titulo === "string" ? data.titulo : PL_DEFAULT_TITLE;
  list.innerHTML = itens
    .map((p) => {
      const img = `<img src="${esc(safeImg(p.logo))}" alt="${esc(p.nome || "Parceiro")}" loading="lazy" />`;
      const url = safeUrl(p.url);
      return `<li class="partner-logos__item">${
        url
          ? `<a href="${esc(url)}" target="_blank" rel="noopener" title="${esc(p.nome || "")}">${img}</a>`
          : `<span title="${esc(p.nome || "")}">${img}</span>`
      }</li>`;
    })
    .join("");
  section.hidden = !itens.length;
}

async function load() {
  const section = document.querySelector("[data-partner-logos]");
  if (!section) return;
  try {
    const [{ db }, { doc, getDoc }] = await Promise.all([
      import("./firebase-config.js"),
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js"),
    ]);
    const snap = await getDoc(doc(db, "siteConfig", PL_DOC));
    renderPartnerLogos(section, snap.exists() ? snap.data() : {});
  } catch (err) {
    console.warn("[parceiros] Não foi possível carregar os logótipos:", err);
  }
}

if (!document.querySelector(".admin-page")) load();
