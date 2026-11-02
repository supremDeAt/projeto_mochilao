/* =====================================================
   O MOCHILÃO — testemunhos.js  (ES module)
   Mostra os testemunhos APROVADOS no painel.

   • index.html            → [data-tm-track]  fila com setas (destaques primeiro)
   • PAGES/testemunhos.html → [data-tm-grid]   mosaico com "Ver mais"

   Colecção "testimonials":
     { nome, local, programaId, programaNome, estrelas (1-5), texto,
       foto (data URL pequena ou ""), status: "pendente" | "aprovado" | "recusado",
       destaque (bool), origem: "site" | "painel", criadoEm }
   Só os "aprovado" podem ser lidos pelo público (regras do Firestore).
   ===================================================== */

const IN_PAGES = window.location.pathname.includes("/PAGES/");
const INDEX_MAX = 9; // cartões no index
const PAGE_STEP = 12; // cartões por "Ver mais" na página

export const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const safeImg = (u) => (/^(data:image\/(png|jpe?g|webp);|https:\/\/)/.test(String(u || "")) ? String(u) : "");

export function initials(nome) {
  const parts = String(nome || "?").trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

const toMillis = (t) => (t?.toMillis ? t.toMillis() : t?.seconds ? t.seconds * 1000 : Number(t) || 0);

/** Ordem: destaques, depois "ordem" (se houver), depois mais recentes */
export function sortTestimonials(list) {
  return [...list].sort(
    (a, b) =>
      Number(!!b.destaque) - Number(!!a.destaque) ||
      (Number(a.ordem) || 0) - (Number(b.ordem) || 0) ||
      toMillis(b.criadoEm) - toMillis(a.criadoEm),
  );
}

/** HTML de um cartão (usado também na pré-visualização do painel) */
export function cardHTML(t, { base = IN_PAGES ? "" : "PAGES/" } = {}) {
  const n = Math.max(1, Math.min(5, parseInt(t.estrelas, 10) || 5));
  const stars = Array.from({ length: 5 }, (_, i) => `<i class="fa-solid fa-star${i < n ? "" : " is-off"}"></i>`).join("");
  const foto = safeImg(t.foto);
  const trip = t.programaNome
    ? t.programaId
      ? `<a class="t-card__trip" href="${base}programa.html?d=${encodeURIComponent(t.programaId)}"><i class="fa-solid fa-location-dot"></i> ${esc(t.programaNome)}</a>`
      : `<span class="t-card__trip"><i class="fa-solid fa-location-dot"></i> ${esc(t.programaNome)}</span>`
    : "";
  return `
    <article class="t-card">
      <div class="t-card__top">
        <span class="t-card__stars" role="img" aria-label="${n} de 5 estrelas">${stars}</span>
        <span class="t-card__quote" aria-hidden="true">“</span>
      </div>
      ${trip}
      <p class="t-card__text">${esc(t.texto)}</p>
      <button type="button" class="t-card__more" hidden>Ler mais</button>
      <div class="t-card__author">
        ${
          foto
            ? `<img class="t-card__avatar" src="${esc(foto)}" alt="" loading="lazy" />`
            : `<span class="t-card__avatar" aria-hidden="true">${esc(initials(t.nome))}</span>`
        }
        <div>
          <strong class="t-card__name">${esc(t.nome)}</strong>
          ${t.local ? `<span class="t-card__meta">${esc(t.local)}</span>` : ""}
        </div>
      </div>
    </article>`;
}

/** Mostra "Ler mais" só nos textos que foram cortados */
export function setupReadMore(root) {
  root.querySelectorAll(".t-card").forEach((card) => {
    const text = card.querySelector(".t-card__text");
    const btn = card.querySelector(".t-card__more");
    if (!text || !btn || card.classList.contains("is-open")) return;
    btn.hidden = text.scrollHeight <= text.clientHeight + 2;
  });
}

function bindReadMore(root) {
  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".t-card__more");
    if (!btn) return;
    const card = btn.closest(".t-card");
    const open = card.classList.toggle("is-open");
    btn.textContent = open ? "Ler menos" : "Ler mais";
  });
}

/* ─────────────────────────────────────────
   INDEX — fila com setas
   ───────────────────────────────────────── */
function renderTrack(track, list) {
  const section = track.closest(".testimonials");
  const empty = section?.querySelector("[data-tm-empty]");
  const prev = section?.querySelector("[data-tm-prev]");
  const next = section?.querySelector("[data-tm-next]");

  const items = sortTestimonials(list).slice(0, INDEX_MAX);
  track.innerHTML = items.map((t) => cardHTML(t)).join("");
  track.hidden = !items.length;
  if (empty) empty.hidden = !!items.length;

  const update = () => {
    const max = track.scrollWidth - track.clientWidth;
    const noScroll = max <= 4;
    if (prev) {
      prev.hidden = noScroll;
      prev.disabled = track.scrollLeft <= 4;
    }
    if (next) {
      next.hidden = noScroll;
      next.disabled = track.scrollLeft >= max - 4;
    }
  };
  const step = (dir) => {
    const card = track.querySelector(".t-card");
    const gap = parseFloat(getComputedStyle(track).columnGap) || 24;
    track.scrollBy({ left: dir * ((card?.offsetWidth || 300) + gap), behavior: "smooth" });
  };
  prev?.addEventListener("click", () => step(-1));
  next?.addEventListener("click", () => step(1));
  track.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", () => {
    update();
    setupReadMore(track);
  });
  update();
  setupReadMore(track);
  bindReadMore(track);
}

/* ─────────────────────────────────────────
   PÁGINA — mosaico com "Ver mais"
   ───────────────────────────────────────── */
function renderGrid(grid, list) {
  const more = document.querySelector("[data-tm-more]");
  const empty = document.querySelector("[data-tm-empty]");
  const items = sortTestimonials(list);
  let shown = 0;

  const showNext = () => {
    const slice = items.slice(shown, shown + PAGE_STEP);
    grid.insertAdjacentHTML("beforeend", slice.map((t) => cardHTML(t)).join(""));
    shown += slice.length;
    if (more) more.hidden = shown >= items.length;
    setupReadMore(grid);
  };

  grid.innerHTML = "";
  if (empty) empty.hidden = !!items.length;
  showNext();
  more?.querySelector("button")?.addEventListener("click", showNext);
  window.addEventListener("resize", () => setupReadMore(grid));
  bindReadMore(grid);
}

/* ─────────────────────────────────────────
   ARRANQUE
   ───────────────────────────────────────── */
async function load() {
  const track = document.querySelector("[data-tm-track]");
  const grid = document.querySelector("[data-tm-grid]");
  if (!track && !grid) return;

  let list = [];
  try {
    const [{ db }, fs] = await Promise.all([
      import("./firebase-config.js"),
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js"),
    ]);
    const snap = await fs.getDocs(fs.query(fs.collection(db, "testimonials"), fs.where("status", "==", "aprovado")));
    list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("[testemunhos] Não foi possível carregar:", err);
  }

  if (track) renderTrack(track, list);
  if (grid) renderGrid(grid, list);
}

if (!document.querySelector(".admin-page")) load();
