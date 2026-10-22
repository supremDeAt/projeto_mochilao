/* =====================================================
   O MOCHILÃO — site-appearance.js  (ES module)
   Tamanhos de ícones, botões e títulos do site,
   controlados pelo painel admin → Site Web → Aparência.

   • Lista de ajustes (SETTINGS) partilhada pelo site e pelo admin.
   • Guardado em siteConfig/aparencia → { valores: { chave: número } }
   • No site: lê os valores e injeta um <style> que se sobrepõe ao CSS.
     Só os valores diferentes do padrão são aplicados — o resto
     continua exatamente como está no estilo.css / programas.css.

   Para acrescentar um ajuste novo: juntar uma entrada a SETTINGS.
   ===================================================== */

export const APPEARANCE_DOC = ["siteConfig", "aparencia"];
const CACHE_KEY = "mochilao-aparencia";

const r = (n) => Math.round(n * 10) / 10; // arredonda a 0,1 px

/**
 * Cada ajuste:
 *  key      → nome guardado no Firestore
 *  group    → secção no admin
 *  label    → texto no admin
 *  def      → valor atual do CSS (padrão)
 *  min/max/step → limites do controlo
 *  preview  → tipo de pré-visualização no admin
 *  css(v)   → regras aplicadas em todos os ecrãs
 *  mobile(v)→ (opcional) regras só para telemóvel (≤ 540px)
 *  desktopOnly → aplica só em ecrãs ≥ 901px (títulos grandes)
 */
export const SETTINGS = [
  /* ── Dicas de viagem ── */
  {
    key: "tipsIcon",
    group: "Dicas de viagem",
    label: "Ícones das dicas",
    hint: "Círculo e símbolo crescem juntos.",
    def: 40, min: 28, max: 84, step: 2,
    preview: { type: "circle", icon: "fa-shoe-prints" },
    css: (v) => `
      .tip-card__icon-wrap { width: ${v}px; height: ${v}px; }
      .tip-card__icon-wrap i { font-size: ${r(v * 0.36)}px; }
      .tip-card__trigger { min-height: ${Math.max(78, v + 38)}px; }`,
  },

  /* ── Serviços ── */
  {
    key: "serviceIcon",
    group: "Serviços",
    label: "Ícones dos cards de serviços",
    def: 72, min: 40, max: 128, step: 4,
    preview: { type: "svg" },
    css: (v) => `.service-card__icon { width: ${v}px; height: ${v}px; }`,
    mobile: (v) => `.service-card__icon { width: ${r(v * 0.83)}px; height: ${r(v * 0.83)}px; }`,
  },

  /* ── Página do programa ── */
  {
    key: "programDetailIcon",
    group: "Página do programa",
    label: "Ícones dos detalhes (duração, preço, partida)",
    def: 40, min: 28, max: 72, step: 2,
    preview: { type: "circle", icon: "fa-clock" },
    css: (v) => `.pkg-detail__icon { width: ${v}px; height: ${v}px; font-size: ${r(v * 0.36)}px; }`,
  },
  {
    key: "programListIcon",
    group: "Página do programa",
    label: "Ícones das listas “Inclui / Não inclui”",
    def: 12, min: 10, max: 28, step: 1,
    preview: { type: "icon", icon: "fa-check" },
    css: (v) => `
      .pkg-inclui__list li i, .pkg-nao-inclui__list li i,
      .pkg-roteiro__list li i { font-size: ${v}px; margin-top: ${r(Math.max(2, 13 - v / 2))}px; }`,
  },

  /* ── Contacto e redes ── */
  {
    key: "socialBtn",
    group: "Contacto e redes",
    label: "Botões das redes sociais (secção Contacto)",
    def: 44, min: 32, max: 72, step: 2,
    preview: { type: "circle", icon: "fa-instagram", brand: true, filled: true },
    css: (v) => `.social-btn { width: ${v}px; height: ${v}px; font-size: ${r(v * 0.38)}px; }`,
  },
  {
    key: "footerSocial",
    group: "Contacto e redes",
    label: "Ícones das redes no rodapé",
    def: 16, min: 12, max: 32, step: 1,
    preview: { type: "icon", icon: "fa-instagram", brand: true },
    css: (v) => `.footer__socials a { font-size: ${v}px; }`,
  },

  /* ── Botões flutuantes ── */
  {
    key: "floatBtn",
    group: "Botões flutuantes",
    label: "Botões “voltar ao topo” e “Mochila”",
    def: 48, min: 36, max: 72, step: 2,
    preview: { type: "circle", icon: "fa-bag-shopping", filled: true },
    css: (v) => `.float-btn { width: ${v}px; height: ${v}px; font-size: ${r(v * 0.37)}px; }`,
  },

  /* ── Títulos (só computador; no telemóvel ficam os tamanhos automáticos) ── */
  {
    key: "heroTitle",
    group: "Títulos (computador)",
    label: "Título do topo da página inicial",
    def: 85, min: 48, max: 130, step: 1,
    preview: { type: "text", text: "Descubra Angola" },
    desktopOnly: true,
    css: (v) => `.hero__title { font-size: ${v}px; }`,
  },
  {
    key: "sectionTitle",
    group: "Títulos (computador)",
    label: "Títulos das secções",
    def: 80, min: 44, max: 120, step: 1,
    preview: { type: "text", text: "Prepara-te" },
    desktopOnly: true,
    css: (v) => `.section-title { font-size: ${v}px; }`,
  },
];

/** Gera o CSS só para os valores diferentes do padrão. */
export function buildAppearanceCSS(values = {}) {
  let all = "";
  let desktop = "";
  let mobile = "";
  SETTINGS.forEach((s) => {
    const v = Number(values[s.key]);
    if (!Number.isFinite(v) || v === s.def) return;
    const clamped = Math.min(s.max, Math.max(s.min, v));
    if (s.desktopOnly) desktop += s.css(clamped);
    else all += s.css(clamped);
    if (s.mobile) mobile += s.mobile(clamped);
  });
  // "html body" dá prioridade a estas regras sobre o CSS normal
  const scope = (css) => css.replace(/(^|})\s*([^{}@]+)\{/g, (m, end, sel) =>
    `${end}\n${sel.split(",").map((x) => "html body " + x.trim()).join(", ")} {`);
  let out = scope(all);
  if (desktop) out += `\n@media (min-width: 901px) {${scope(desktop)}\n}`;
  if (mobile) out += `\n@media (max-width: 540px) {${scope(mobile)}\n}`;
  return out.trim();
}

export function applyAppearanceCSS(values) {
  let el = document.getElementById("site-appearance");
  if (!el) {
    el = document.createElement("style");
    el.id = "site-appearance";
    document.head.appendChild(el);
  }
  el.textContent = buildAppearanceCSS(values);
}

/* ─────────────────────────────────────────
   NO SITE: aplica automaticamente
   (no painel admin este ficheiro só fornece as definições)
   ───────────────────────────────────────── */
async function applyOnSite() {
  // 1. Versão guardada no navegador → sem "salto" ao abrir a página
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (cached) applyAppearanceCSS(cached);
  } catch {
    /* sem armazenamento local: segue */
  }

  // 2. Versão atual do Firestore
  try {
    const [{ db }, { doc, getDoc }] = await Promise.all([
      import("./firebase-config.js"),
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js"),
    ]);
    const snap = await getDoc(doc(db, ...APPEARANCE_DOC));
    const values = (snap.exists() && snap.data().valores) || {};
    applyAppearanceCSS(values);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(values));
    } catch {
      /* ignora */
    }
  } catch (err) {
    console.warn("[aparência] A usar os tamanhos do CSS:", err);
  }
}

if (!document.querySelector(".admin-page")) applyOnSite();
