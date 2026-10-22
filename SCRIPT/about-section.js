/* =====================================================
   O MOCHILÃO — about-section.js  (ES module)
   Secção "Sobre o Mochilão" do index, gerida no painel
   admin → Site Web → Sobre.

   siteConfig/sobre →
     pt: { tag, titulo, citacao, texto, botao }
     en: { tag, titulo, citacao, texto, botao }      (opcional)
     contadores: { viagens, clientes, satisfacao }   (valores)
     contadoresInfo: [ { sufixo, pt, en } × 3 ]      (sufixo e legenda)
     botao: { mostrar, link }
     tamanhos: { titulo, citacao, texto, largura }   (px)
     fotoPos: "center" | "top" | "bottom" | "left" | "right"
   siteConfig/sobre-foto → { data }   (foto à parte: até 1 MB por documento)

   Texto com Enter → nova linha; linha em branco → novo parágrafo.
   Campo vazio → fica o texto original do site (e a tradução).
   Usado pelo site e pela pré-visualização do admin.
   ===================================================== */

export const ABOUT_DOC = ["siteConfig", "sobre"];
export const ABOUT_PHOTO_DOC = ["siteConfig", "sobre-foto"];

/* Textos atuais do site (usados como exemplo no admin) */
export const ABOUT_DEFAULTS = {
  pt: {
    tag: "Sobre o Mochilão",
    titulo: "A experiência é o percurso, o destino é consequência",
    citacao:
      "Acreditamos que cada passo da viagem\nimporta tanto quanto o lugar a que chegamos.\nÉ nessa jornada que nascem as histórias que ficam.",
    texto:
      "O Mochilão nasceu da paixão e do desejo de explorar Angola em toda a sua grandiosidade. Mais do que uma empresa, somos movidos pelo fascínio de revelar as maravilhas naturais, os povos, as culturas e a rica gastronomia que compõem o vasto mosaico cultural angolano.",
    botao: "Saber Mais",
  },
  en: {
    tag: "About Mochilão",
    titulo: "The experience is the journey, the destination is a consequence",
    citacao:
      "We believe that every step of the trip matters as much as where we end up — it is in that journey that the stories worth keeping are born.",
    texto:
      "Mochilão was born from a passion for exploring Angola in all its grandeur. More than a company, we are driven by the fascination of revealing the natural wonders, peoples, cultures and rich gastronomy that make up the vast Angolan mosaic.",
    botao: "Learn More",
  },
  contadores: { viagens: 120, clientes: 300, satisfacao: 98 },
  contadoresInfo: [
    { sufixo: "+", pt: "Viagens", en: "Trips" },
    { sufixo: "", pt: "Clientes", en: "Clients" },
    { sufixo: "%", pt: "Satisfação", en: "Satisfaction" },
  ],
  tamanhos: { titulo: 80, citacao: 17, texto: 17, largura: 420 },
};

export const SIZE_LIMITS = {
  titulo: { min: 44, max: 120, step: 1, label: "Título (computador)" },
  citacao: { min: 13, max: 30, step: 1, label: "Citação" },
  texto: { min: 13, max: 26, step: 1, label: "Texto" },
  largura: { min: 300, max: 640, step: 10, label: "Largura do texto" },
};

export const PHOTO_POSITIONS = {
  center: "Centro",
  top: "Cima",
  bottom: "Baixo",
  left: "Esquerda",
  right: "Direita",
};

const COUNTER_KEYS = ["viagens", "clientes", "satisfacao"];

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Enter → <br> */
export const withBreaks = (s) => esc(String(s).trim()).replace(/\r?\n/g, "<br />");

/** Linha em branco → parágrafos separados */
export const toParagraphs = (s) =>
  String(s)
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);

const safeImg = (u) => (/^(data:image\/|https?:\/\/)/i.test(u || "") ? u : "");
const safeLink = (u) => (/^(https?:\/\/|#|\.{0,2}\/|[\w-]+\.html)/i.test(u || "") ? u : "");

/* Guarda o conteúdo original para poder voltar atrás.
   Elementos traduzidos pelo script.js (data-i18n): um original por idioma,
   apanhado logo depois de o script escrever a tradução. */
const origKey = (el, lang) => (el.hasAttribute("data-i18n") ? "aboutOrig" + lang : "aboutOrig");
function remember(el, lang) {
  if (el && el.dataset[origKey(el, lang)] === undefined) el.dataset[origKey(el, lang)] = el.innerHTML;
}
function restore(el, lang) {
  const v = el?.dataset[origKey(el, lang)];
  if (v !== undefined) el.innerHTML = v;
}

/** Texto de um campo no idioma pedido ("" = manter o do site) */
function pick(data, lang, key) {
  const v = data?.[lang]?.[key];
  return typeof v === "string" && v.trim() ? v : "";
}

/**
 * Aplica os dados à secção "Sobre" de um documento (site ou iframe do admin).
 * @param {Document} d
 * @param {object} data  conteúdo de siteConfig/sobre
 * @param {string|null} photo  dataURL da foto (null = manter)
 * @param {"pt"|"en"} lang
 */
export function applyAbout(d, data = {}, photo = null, lang = "pt") {
  const sec = d.getElementById("about");
  if (!sec) return;

  /* ── Textos ── */
  const tag = sec.querySelector(".section-tag");
  const title = sec.querySelector(".section-title");
  const quote = sec.querySelector(".about__quote");
  const textEl = sec.querySelector(".about__text");
  const cta = sec.querySelector(".about__cta");
  [tag, title, quote, textEl, cta].forEach((el) => remember(el, lang));

  /* Em inglês sem texto próprio: elementos com tradução no site ficam com
     a tradução; os outros mostram o texto português do admin. */
  const value = (el, key) =>
    pick(data, lang, key) || (lang === "en" && el && !el.hasAttribute("data-i18n") ? pick(data, "pt", key) : "");
  const setOrRestore = (el, key, html) => {
    if (!el) return;
    const v = value(el, key);
    if (v) el.innerHTML = html(v);
    else restore(el, lang);
  };
  setOrRestore(tag, "tag", esc);
  setOrRestore(title, "titulo", withBreaks);
  setOrRestore(quote, "citacao", withBreaks);
  setOrRestore(cta, "botao", esc);

  // Texto principal: 1.º parágrafo no <p> original, os outros a seguir
  sec.querySelectorAll("[data-about-extra]").forEach((p) => p.remove());
  const texto = value(textEl, "texto");
  if (textEl) {
    if (texto) {
      const paras = toParagraphs(texto);
      textEl.innerHTML = withBreaks(paras[0] || "");
      let after = textEl;
      paras.slice(1).forEach((para) => {
        const p = d.createElement("p");
        p.className = "about__text";
        p.dataset.aboutExtra = "";
        p.innerHTML = withBreaks(para);
        after.after(p);
        after = p;
      });
    } else restore(textEl, lang);
  }

  /* ── Botão ── */
  if (cta) {
    const b = data.botao || {};
    cta.hidden = b.mostrar === false;
    const link = safeLink(b.link);
    cta.dataset.aboutLink = link;
    if (!cta.dataset.aboutBound) {
      cta.dataset.aboutBound = "1";
      cta.addEventListener("click", () => {
        const href = cta.dataset.aboutLink;
        if (!href) return;
        if (href.startsWith("#")) d.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
        else if (/^https?:\/\//i.test(href)) window.open(href, "_blank", "noopener");
        else d.defaultView.location.href = href;
      });
    }
  }

  /* ── Números ── */
  const counters = sec.querySelectorAll("#counters .counter");
  const vals = data.contadores || {};
  const info = Array.isArray(data.contadoresInfo) ? data.contadoresInfo : [];
  counters.forEach((c, i) => {
    const num = c.querySelector(".counter__num");
    const v = parseInt(vals[COUNTER_KEYS[i]], 10);
    if (num && Number.isFinite(v)) {
      num.dataset.target = String(v);
      // Se a animação já correu, mostra logo o valor novo
      if (num.textContent.trim() !== "0") num.textContent = String(v);
    }
    const inf = info[i] || {};
    const label = c.querySelector(".counter__label");
    if (typeof inf.sufixo === "string") {
      let suf = c.querySelector(".counter__suffix");
      if (!suf && inf.sufixo) {
        suf = d.createElement("span");
        suf.className = "counter__suffix";
        num?.after(suf);
      }
      if (suf) suf.textContent = inf.sufixo.slice(0, 3);
    }
    if (!label) return;
    remember(label, lang);
    const lv = typeof inf[lang] === "string" && inf[lang].trim() ? inf[lang].trim() : "";
    if (lv) label.textContent = lv;
    else restore(label, lang);
  });

  /* ── Foto ── */
  const visual = sec.querySelector(".about__visual");
  if (visual) {
    const src = safeImg(photo);
    if (src) visual.style.backgroundImage = `url("${src}")`;
    else if (photo === "") visual.style.removeProperty("background-image");
    visual.style.backgroundPosition = PHOTO_POSITIONS[data.fotoPos] ? data.fotoPos : "";
  }

  /* ── Tamanhos ── */
  let style = d.getElementById("about-sizes");
  if (!style) {
    style = d.createElement("style");
    style.id = "about-sizes";
    d.head.appendChild(style);
  }
  style.textContent = sizesCSS(data.tamanhos);
}

function sizesCSS(t = {}) {
  const def = ABOUT_DEFAULTS.tamanhos;
  const val = (k) => {
    const v = Number(t[k]);
    if (!Number.isFinite(v) || v === def[k]) return null;
    return Math.min(SIZE_LIMITS[k].max, Math.max(SIZE_LIMITS[k].min, v));
  };
  const S = "html body #about";
  let all = "";
  let desk = "";
  const title = val("titulo");
  const quote = val("citacao");
  const text = val("texto");
  const width = val("largura");
  if (title) desk += `${S} .section-title { font-size: ${title}px; }`;
  if (quote) all += `${S} .about__quote { font-size: ${quote}px; }`;
  if (text) all += `${S} .about__text { font-size: ${text}px; }`;
  if (width) all += `${S} .about__text, ${S} .about__quote { max-width: ${width}px; }`;
  // Parágrafos extra do texto
  all += `${S} .about__text + .about__text { margin-top: -1rem; }`;
  return all + (desk ? `@media (min-width: 901px) { ${desk} }` : "");
}

/* ─────────────────────────────────────────
   NO SITE
   ───────────────────────────────────────── */
async function applyOnSite() {
  if (!document.getElementById("about")) return;
  try {
    const [{ db }, { doc, getDoc }] = await Promise.all([
      import("./firebase-config.js"),
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js"),
    ]);
    const [snap, photoSnap] = await Promise.all([
      getDoc(doc(db, ...ABOUT_DOC)),
      getDoc(doc(db, ...ABOUT_PHOTO_DOC)).catch(() => null),
    ]);
    const data = snap.exists() ? snap.data() : {};
    const photo = photoSnap?.exists() ? photoSnap.data().data || null : null;

    const lang = () => (document.documentElement.lang === "en" ? "en" : "pt");
    applyAbout(document, data, photo, lang());

    // O botão PT/EN do site reescreve os textos → voltar a aplicar
    new MutationObserver(() => applyAbout(document, data, null, lang())).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });
  } catch (err) {
    console.warn("[sobre] A usar o conteúdo do HTML:", err);
  }
}

if (!document.querySelector(".admin-page")) applyOnSite();
