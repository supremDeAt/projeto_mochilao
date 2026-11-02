/* =====================================================
   O MOCHILÃO — hero-cards.js  (ES module)
   Os 3 cards na base do hero do index.html.

   Editados no painel: Site Web → "Cards do Hero"
     siteConfig/hero-cards          → { cards: [{ programa, titulo, local }, …] }
     siteConfig/hero-card-foto-1..3 → { data: url da foto }   (opcional)

   programa = id de um programa (colecção "programs")
              ou "personalizada" → página Viagens Personalizadas
   Título vazio → nome do programa.  Foto vazia → capa do programa.
   Card sem nada escolhido no painel → fica como está no HTML.
   ===================================================== */

export const HC_DOC = "hero-cards";
export const HC_COUNT = 3;
export const HC_CUSTOM = "personalizada";
export const hcPhotoDoc = (i) => `hero-card-foto-${i + 1}`;

const GRADIENT = "linear-gradient(to bottom, var(--clr-rust-1e) 0%, var(--clr-rust-1e) 100%)";

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const safeImg = (u) => (/^(https:|data:image\/|\.\.?\/|imagens\/)/.test(String(u || "")) ? String(u) : "");

/** Junta o que foi escolhido no painel com os dados do programa. */
export function resolveCard(card = {}, program = null, photo = "", base = "") {
  const id = String(card.programa || "");
  if (!id) return null;
  const isCustom = id === HC_CUSTOM;
  return {
    titulo: String(card.titulo || "").trim() || (isCustom ? "Viagem Personalizada" : program?.nome || ""),
    local: String(card.local || "").trim(),
    href: isCustom ? `${base}PAGES/personalizada.html` : `${base}PAGES/programa.html?d=${encodeURIComponent(id)}`,
    img: safeImg(photo) || safeImg(program?.imagemURL) || "",
    missing: !isCustom && !program, // programa apagado ou desativado
  };
}

/** Aplica os cards a um documento (o index.html). */
export function applyHeroCards(d, data = {}, photos = [], programs = new Map()) {
  const cards = d.querySelectorAll(".hero__cards-overlap .tour-card");
  const list = Array.isArray(data?.cards) ? data.cards : [];
  cards.forEach((el, i) => {
    if (i >= HC_COUNT) return;
    const c = resolveCard(list[i], programs.get(list[i]?.programa), photos[i]);
    if (!c || c.missing || !c.titulo) return; // fica o card do HTML

    const badge = el.querySelector(".tour-card__badge");
    if (badge) {
      badge.innerHTML =
        esc(c.titulo).replace(/\n/g, "<br>") +
        (c.local ? `<br /><span class="tour-card__place">${esc(c.local)}</span>` : "");
    }
    const btn = el.querySelector(".tour-card__btn");
    if (btn) {
      btn.href = c.href;
      btn.setAttribute("aria-label", `Saber mais — ${c.titulo.replace(/\n/g, " ")}`);
    }
    if (c.img) el.style.backgroundImage = `${GRADIENT}, url("${c.img.replace(/"/g, "%22")}")`;
  });
}

/* ─────────────────────────────────────────
   ARRANQUE NO INDEX
   ───────────────────────────────────────── */
async function load() {
  try {
    const [{ db }, { doc, getDoc }] = await Promise.all([
      import("./firebase-config.js"),
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js"),
    ]);
    const get = (col, id) =>
      getDoc(doc(db, col, id))
        .then((s) => (s.exists() ? s.data() : null))
        .catch(() => null);

    const [data, ...photoDocs] = await Promise.all([
      get("siteConfig", HC_DOC),
      ...Array.from({ length: HC_COUNT }, (_, i) => get("siteConfig", hcPhotoDoc(i))),
    ]);
    if (!data) return;

    // Só lê os programas escolhidos (até 3)
    const ids = [...new Set((data.cards || []).map((c) => c?.programa).filter((id) => id && id !== HC_CUSTOM))];
    const programs = new Map();
    await Promise.all(
      ids.map(async (id) => {
        const p = await get("programs", id);
        if (p && p.ativo !== false) programs.set(id, p);
      }),
    );

    applyHeroCards(document, data, photoDocs.map((p) => p?.data || ""), programs);
  } catch (err) {
    console.warn("[hero-cards] A usar os cards do HTML:", err);
  }
}

if (document.querySelector(".hero__cards-overlap") && !document.querySelector(".admin-page")) load();
