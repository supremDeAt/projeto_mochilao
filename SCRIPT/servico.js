/* =====================================================
   O MOCHILÃO — servico.js  (ES module)
   Página de um serviço: PAGES/servico.html?s=hoteis
   Mostra os parceiros desse serviço (fotos, nome e informações
   básicas). Os parceiros são geridos no admin → Parceiros.
   ===================================================== */

import { db } from "./firebase-config.js";
import { listServices, DEFAULT_SERVICES, serviceHref } from "./services-store.js";
import { serviceIconSVG } from "./services-icons.js";
import { listPartners, loadPartnerPhotos } from "./partners-store.js";

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const withBreaks = (s) => esc(String(s || "").trim()).replace(/\r?\n/g, "<br />");
const safeImg = (u) => (/^(data:image\/|https?:\/\/)/i.test(u || "") ? u : "");

const slug = new URLSearchParams(location.search).get("s") || "";

const els = {
  crumb: $("svcCrumb"),
  icon: $("svcIcon"),
  title: $("svcTitle"),
  text: $("svcText"),
  count: $("svcCount"),
  others: $("svcOthers"),
  grid: $("partnersGrid"),
  status: $("partnersStatus"),
};

/* ─────────────────────────────────────────
   1. SERVIÇO
   ───────────────────────────────────────── */
function renderService(service, all) {
  document.title = `${service.nome} — O Mochilão Aventuras`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", service.descricao || "");
  els.crumb.textContent = service.nome;
  els.title.textContent = service.nome;
  els.text.textContent = service.descricao || "";
  els.icon.innerHTML = serviceIconSVG(service.icone);
  els.icon.hidden = false;

  const others = all.filter((s) => s.slug !== service.slug && !s.link);
  els.others.innerHTML = others.length
    ? `<span class="svc-others__label">Outros serviços</span>` +
      others
        .map(
          (s) => `<a class="svc-others__link" href="${esc(serviceHref(s, "../").replace("../PAGES/", ""))}">
            <span class="svc-others__icon">${serviceIconSVG(s.icone)}</span>${esc(s.nome)}</a>`,
        )
        .join("")
    : "";
  els.others.hidden = !others.length;
}

function renderNotFound() {
  document.title = "Serviço não encontrado — O Mochilão Aventuras";
  els.crumb.textContent = "Serviço não encontrado";
  els.title.textContent = "Serviço não encontrado";
  els.text.textContent = "O endereço pode estar errado ou o serviço já não está disponível.";
  els.count.hidden = true;
  els.grid.innerHTML = "";
  els.status.innerHTML = `
    <div class="svc-empty">
      <i class="fa-solid fa-compass"></i>
      <p><strong>Não encontrámos este serviço.</strong></p>
      <a href="../index.html#services" class="btn btn--primary">Ver todos os serviços</a>
    </div>`;
}

/* ─────────────────────────────────────────
   2. PARCEIROS
   ───────────────────────────────────────── */
let partners = [];

function cardHTML(p, i) {
  const cover = safeImg(p.capa);
  const n = Array.isArray(p.fotos) ? p.fotos.length : 0;
  const tags = (p.destaques || []).slice(0, 4);
  const more = (p.destaques || []).length - tags.length;
  return `
    <li class="partner-card" style="--i:${i}">
      <button type="button" class="partner-card__btn" data-index="${i}" aria-label="Ver fotos e informações de ${esc(p.nome)}">
        <span class="partner-card__media">
          ${cover ? `<img src="${cover}" alt="" loading="lazy" />` : `<span class="partner-card__ph"><i class="fa-regular fa-image"></i></span>`}
          ${n > 1 ? `<span class="partner-card__count"><i class="fa-regular fa-images"></i> ${n}</span>` : ""}
        </span>
        <span class="partner-card__body">
          <span class="partner-card__name">${esc(p.nome)}</span>
          ${p.localizacao ? `<span class="partner-card__loc"><i class="fa-solid fa-location-dot"></i> ${esc(p.localizacao)}</span>` : ""}
          ${p.descricao ? `<span class="partner-card__desc">${esc(p.descricao)}</span>` : ""}
          ${
            tags.length
              ? `<span class="partner-card__tags">${tags.map((t) => `<span>${esc(t)}</span>`).join("")}${
                  more > 0 ? `<span class="is-more">+${more}</span>` : ""
                }</span>`
              : ""
          }
          <span class="partner-card__more">Ver fotos <i class="fa-solid fa-arrow-right"></i></span>
        </span>
      </button>
    </li>`;
}

function renderPartners(service) {
  els.count.hidden = false;
  els.count.textContent = partners.length
    ? `${partners.length} ${partners.length === 1 ? "parceiro" : "parceiros"}`
    : "Parceiros em breve";
  if (!partners.length) {
    els.grid.innerHTML = "";
    els.status.innerHTML = `
      <div class="svc-empty">
        <i class="fa-regular fa-handshake"></i>
        <p><strong>Em breve.</strong><br />Estamos a preparar a apresentação dos nossos parceiros de ${esc(
          service.nome.toLowerCase(),
        )}.</p>
      </div>`;
    return;
  }
  els.status.innerHTML = "";
  els.grid.innerHTML = partners.map(cardHTML).join("");
}

/* ─────────────────────────────────────────
   3. GALERIA (janela com fotos + informação)
   ───────────────────────────────────────── */
const modal = $("partnerModal");
const m = {
  img: $("pmImg"),
  prev: $("pmPrev"),
  next: $("pmNext"),
  counter: $("pmCounter"),
  thumbs: $("pmThumbs"),
  service: $("pmService"),
  name: $("pmName"),
  loc: $("pmLoc"),
  desc: $("pmDesc"),
  tags: $("pmTags"),
  loading: $("pmLoading"),
};
let photos = [];
let current = 0;
let lastFocus = null;
const photoCache = new Map();

function showPhoto(i) {
  if (!photos.length) return;
  current = (i + photos.length) % photos.length;
  m.img.src = photos[current];
  m.counter.textContent = `${current + 1} / ${photos.length}`;
  const single = photos.length < 2;
  m.prev.hidden = m.next.hidden = m.counter.hidden = single;
  m.thumbs.hidden = single;
  m.thumbs.querySelectorAll("button").forEach((b, k) => {
    b.classList.toggle("is-active", k === current);
    if (k === current) b.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  });
}

async function openPartner(index, serviceName) {
  const p = partners[index];
  if (!p) return;
  lastFocus = document.activeElement;

  m.service.textContent = serviceName;
  m.name.textContent = p.nome;
  m.loc.innerHTML = p.localizacao ? `<i class="fa-solid fa-location-dot"></i> ${esc(p.localizacao)}` : "";
  m.loc.hidden = !p.localizacao;
  m.desc.innerHTML = withBreaks(p.descricao);
  m.desc.hidden = !p.descricao;
  m.tags.innerHTML = (p.destaques || []).map((t) => `<li><i class="fa-solid fa-check"></i> ${esc(t)}</li>`).join("");
  m.tags.hidden = !(p.destaques || []).length;

  // Mostra logo a capa; as fotos grandes chegam a seguir
  photos = [safeImg(p.capa)].filter(Boolean);
  m.thumbs.innerHTML = "";
  showPhoto(0);
  modal.hidden = false;
  document.body.classList.add("partner-modal-open");
  requestAnimationFrame(() => modal.classList.add("is-open"));
  $("pmClose").focus();

  if (!photoCache.has(p.id)) {
    m.loading.hidden = false;
    try {
      photoCache.set(p.id, (await loadPartnerPhotos(db, p)).map((x) => safeImg(x.data)).filter(Boolean));
    } catch (err) {
      console.warn("[parceiros] fotos:", err);
    } finally {
      m.loading.hidden = true;
    }
  }
  const list = photoCache.get(p.id);
  if (list?.length && !modal.hidden) {
    photos = list;
    m.thumbs.innerHTML = photos
      .map((src, k) => `<button type="button" data-k="${k}" aria-label="Foto ${k + 1}"><img src="${src}" alt="" /></button>`)
      .join("");
    showPhoto(0);
  }
}

function closePartner() {
  modal.classList.remove("is-open");
  document.body.classList.remove("partner-modal-open");
  setTimeout(() => (modal.hidden = true), 200);
  lastFocus?.focus?.();
}

function bindModal() {
  $("pmClose").addEventListener("click", closePartner);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closePartner();
  });
  m.prev.addEventListener("click", () => showPhoto(current - 1));
  m.next.addEventListener("click", () => showPhoto(current + 1));
  m.thumbs.addEventListener("click", (e) => {
    const b = e.target.closest("[data-k]");
    if (b) showPhoto(Number(b.dataset.k));
  });
  document.addEventListener("keydown", (e) => {
    if (modal.hidden) return;
    if (e.key === "Escape") closePartner();
    else if (e.key === "ArrowLeft") showPhoto(current - 1);
    else if (e.key === "ArrowRight") showPhoto(current + 1);
  });
  // Deslizar com o dedo
  let startX = null;
  const stage = $("pmStage");
  stage.addEventListener("pointerdown", (e) => (startX = e.clientX));
  stage.addEventListener("pointerup", (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 45) showPhoto(current + (dx < 0 ? 1 : -1));
  });
}

/* ─────────────────────────────────────────
   ARRANQUE
   ───────────────────────────────────────── */
(async function init() {
  bindModal();
  let all = [];
  try {
    all = await listServices(db, { onlyActive: true });
  } catch (err) {
    console.warn("[serviço] Sem ligação ao Firestore:", err);
  }
  if (!all.length) all = DEFAULT_SERVICES.map((s, i) => ({ ...s, id: "", ordem: i }));

  const service = all.find((s) => s.slug === slug) || (!slug ? all[0] : null);
  if (!service) return renderNotFound();
  renderService(service, all);

  try {
    partners = service.id ? await listPartners(db, { serviceId: service.id, onlyActive: true }) : [];
  } catch (err) {
    console.warn("[parceiros]", err);
    partners = [];
  }
  renderPartners(service);

  els.grid.addEventListener("click", (e) => {
    const b = e.target.closest("[data-index]");
    if (b) openPartner(Number(b.dataset.index), service.nome);
  });
})();
