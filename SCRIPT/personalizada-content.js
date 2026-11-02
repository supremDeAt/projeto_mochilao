/* =====================================================
   O MOCHILÃO — personalizada-content.js  (ES module)
   Conteúdo da página "Viagens Personalizadas"
   (PAGES/personalizada.html), editável no painel:
   Admin → Site Web → Pág. Personalizada.

   Usado por:
     • personalizada.js               → aplica na página
     • admin-personalizada-pagina.js  → formulário + pré-visualização

   Firestore:
     siteConfig/personalizada            → textos + programas escolhidos
     siteConfig/personalizada-foto-<key> → { data: url da foto }
       (uma foto por documento: o Firestore aceita até 1 MB cada)

   Campo vazio no painel = fica o texto original (PC_DEFAULTS).
   ===================================================== */

export const PC_DOC = "personalizada";
export const pcPhotoDoc = (key) => `personalizada-foto-${key}`;

/* Fotos da página (a original fica se não houver foto no painel) */
export const PC_PHOTOS = [
  { key: "hero", label: "Fundo do topo", hint: "Horizontal, larga.", def: "../imagens/fundo_kifuka2.jpeg" },
  { key: "medida1", label: "Foto de \"Destinos à sua medida\"", hint: "Vertical ou quadrada.", def: "../imagens/malanje2.webp" },
  { key: "como", label: "Foto de \"Como funciona\"", hint: "Vertical ou quadrada.", def: "../imagens/camelo.jpeg" },
  { key: "contacto", label: "Fundo do contacto", hint: "Horizontal. Fica escurecida.", def: "../imagens/huambo.webp" },
];

/* Secções e campos de texto (a ordem é a da página).
   [chave, etiqueta no painel, máx. caracteres, linhas (1 = campo simples)] */
export const PC_SECTIONS = [
  {
    key: "hero",
    title: "1. Topo",
    photos: ["hero"],
    fields: [
      ["tag", "Etiqueta (por cima do título)", 40, 1],
      ["titulo", "Título", 80, 2],
      ["texto", "Texto", 300, 3],
    ],
  },
  {
    key: "medida",
    title: "2. Destinos à sua medida",
    photos: ["medida1"],
    // Interruptores (sim/não): [chave, texto no painel]
    toggles: [["mostrarFactos", "Mostrar os 3 destaques (5 dias · Qualquer · Angola)"]],
    fields: [
      ["tag", "Etiqueta", 40, 1],
      ["titulo", "Título", 80, 2],
      ["texto", "Texto", 500, 4],
      ["f1v", "Destaque 1 — valor", 14, 1],
      ["f1t", "Destaque 1 — legenda", 40, 1],
      ["f2v", "Destaque 2 — valor", 14, 1],
      ["f2t", "Destaque 2 — legenda", 40, 1],
      ["f3v", "Destaque 3 — valor", 14, 1],
      ["f3t", "Destaque 3 — legenda", 40, 1],
      ["seloV", "Selo sobre as fotos — valor", 6, 1],
      ["seloT", "Selo sobre as fotos — legenda", 30, 1],
    ],
  },
  {
    key: "como",
    title: "3. Como funciona",
    photos: ["como"],
    fields: [
      ["tag", "Etiqueta", 40, 1],
      ["titulo", "Título", 80, 2],
      ["p1t", "Passo 1 — título", 40, 1],
      ["p1d", "Passo 1 — texto", 160, 2],
      ["p2t", "Passo 2 — título", 40, 1],
      ["p2d", "Passo 2 — texto", 160, 2],
      ["p3t", "Passo 3 — título", 40, 1],
      ["p3d", "Passo 3 — texto", 160, 2],
      ["p4t", "Passo 4 — título", 40, 1],
      ["p4d", "Passo 4 — texto", 160, 2],
    ],
  },
  {
    key: "destinos",
    title: "4. Conheça alguns destinos",
    photos: [],
    programs: true, // escolha de até 6 programas (do site ou criados só para esta página)
    fields: [
      ["tag", "Etiqueta", 40, 1],
      ["titulo", "Título", 80, 2],
    ],
  },
  {
    key: "contacto",
    title: "5. Contacto",
    photos: ["contacto"],
    fields: [
      ["tag", "Etiqueta", 40, 1],
      ["titulo", "Título", 80, 2],
      ["texto", "Texto", 300, 3],
      ["wpp", "Botão WhatsApp — texto", 30, 1],
      ["mail", "Botão Email — texto", 30, 1],
      ["mensagem", "Mensagem já escrita no WhatsApp", 300, 2],
    ],
  },
];

export const PC_MAX_PROGRAMS = 6;

export const PC_DEFAULTS = {
  hero: {
    tag: "Viagens Personalizadas",
    titulo: "A viagem é sua,\no roteiro também",
    texto:
      "Desenhamos o programa à sua medida: destino, datas, alojamento e experiências — para famílias, amigos, casais e empresas.",
  },
  medida: {
    tag: "Feita à sua medida",
    titulo: "Destinos à\nsua medida",
    texto:
      "Criamos a viagem de raiz ou adaptamos um dos nossos programas às datas e ao ritmo do seu grupo. Diga-nos o que imagina e nós tratamos do resto.",
    f1v: "5 dias",
    f1t: "para receber a proposta",
    f2v: "Qualquer",
    f2t: "tamanho de grupo",
    f3v: "Angola",
    f3t: "e Namíbia",
    seloV: "4",
    seloT: "passos simples",
  },
  como: {
    tag: "Como funciona",
    titulo: "Simples, do início ao fim",
    p1t: "Fale connosco",
    p1d: "Por WhatsApp ou email: destino, datas, número de pessoas e tipo de viagem.",
    p2t: "Recebe a proposta",
    p2d: "Preparamos o roteiro com alojamento, transporte e preço.",
    p3t: "Ajustamos juntos",
    p3d: "Mudamos o que for preciso até ficar perfeito.",
    p4t: "É só partir",
    p4d: "Confirmada a reserva, tratamos de tudo.",
  },
  destinos: {
    tag: "Inspire-se",
    titulo: "Conheça alguns destinos",
  },
  contacto: {
    tag: "Vamos planear?",
    titulo: "Conte-nos a sua ideia",
    texto: "Escolha a forma mais fácil para si. A nossa equipa responde com rapidez e sem compromisso.",
    wpp: "WhatsApp",
    mail: "Email",
    mensagem: "Olá O Mochilão! Gostaria de planear uma viagem personalizada.",
  },
};

/* ─────────────────────────────────────────
   UTILITÁRIOS
   ───────────────────────────────────────── */
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const safeImg = (u) => (/^(data:image\/|https?:\/\/|\.\.\/)/i.test(u || "") ? u : "");

/** Valor final de um campo: o do painel, ou o original */
export function pcValue(data, sec, key) {
  const v = data?.[sec]?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : PC_DEFAULTS[sec][key];
}

/** Número de WhatsApp (siteConfig/contactos) no formato do wa.me */
export function waNumber(raw, fallback = "244926509821") {
  let n = String(raw || "").replace(/\D/g, "");
  if (n.length === 9) n = "244" + n;
  return n.length >= 9 ? n : fallback;
}

/* ─────────────────────────────────────────
   APLICAR NA PÁGINA
   d        → document da página (ou da pré-visualização)
   data     → siteConfig/personalizada
   photos   → { hero: url, medida1: url, … } (vazio = foto original)
   data.medida.mostrarFactos === false → esconde os 3 destaques
   extra    → { contactos: {whatsapp, email}, programs: [{id, nome, slogan, imagemURL}] }
   ───────────────────────────────────────── */
export function applyPersonalizada(d, data = {}, photos = {}, extra = {}) {
  if (!d?.querySelector(".pc-page")) return;

  // Textos: <… data-pc="secção.campo">  (Enter no painel = nova linha)
  d.querySelectorAll("[data-pc]").forEach((el) => {
    const [sec, key] = el.dataset.pc.split(".");
    if (!PC_DEFAULTS[sec] || !(key in PC_DEFAULTS[sec])) return;
    el.innerHTML = esc(pcValue(data, sec, key)).replace(/\n/g, "<br>");
  });

  // Os 3 destaques podem ser escondidos no painel
  d.querySelectorAll(".pc-facts").forEach((el) => (el.hidden = data?.medida?.mostrarFactos === false));

  // Fotos: <img data-pc-img="key"> ou fundo: <… data-pc-bg="key">
  PC_PHOTOS.forEach(({ key, def }) => {
    const url = safeImg(photos[key]) || def;
    d.querySelectorAll(`img[data-pc-img="${key}"]`).forEach((img) => {
      if (img.getAttribute("src") !== url) img.src = url;
    });
    d.querySelectorAll(`[data-pc-bg="${key}"]`).forEach((el) => {
      el.style.setProperty("--pc-bg", `url("${url.replace(/"/g, "%22")}")`);
    });
  });

  // Botões de contacto
  const c = extra.contactos || {};
  const msg = pcValue(data, "contacto", "mensagem");
  const wa = d.querySelector("[data-pc-wpp]");
  if (wa) wa.href = `https://wa.me/${waNumber(c.whatsapp)}?text=${encodeURIComponent(msg)}`;
  const mail = d.querySelector("[data-pc-mail]");
  if (mail) {
    const email = String(c.email || "").trim() || mail.dataset.pcMailDefault || "";
    mail.href = `mailto:${email}?subject=${encodeURIComponent("Viagem personalizada")}&body=${encodeURIComponent(msg + "\n\n")}`;
    mail.hidden = !email;
  }

  // Programas (até 3). Sem programas do Firestore → ficam os do HTML.
  const grid = d.querySelector("[data-pc-destinos]");
  const programs = Array.isArray(extra.programs) ? extra.programs : null;
  if (grid && programs && programs.length) {
    const chosen = Array.isArray(data?.destinos?.programas) ? data.destinos.programas : [];
    const byId = new Map(programs.map((p) => [p.id, p]));
    let list = chosen.map((id) => byId.get(id)).filter(Boolean);
    if (!list.length) list = programs;
    grid.innerHTML = list
      .slice(0, PC_MAX_PROGRAMS)
      .map(
        (p) => `
        <a class="pc-card" href="programa.html?d=${encodeURIComponent(p.id)}">
          <span class="pc-card__media">${
            safeImg(p.imagemURL)
              ? `<img src="${esc(p.imagemURL)}" alt="${esc(p.nome)}" loading="lazy" />`
              : `<i class="fa-solid fa-map-location-dot" aria-hidden="true"></i>`
          }</span>
          <span class="pc-card__body">
            <strong>${esc(p.nome || "Programa")}</strong>
            <span>${esc(p.slogan || "")}</span>
          </span>
        </a>`,
      )
      .join("");
  }
}
