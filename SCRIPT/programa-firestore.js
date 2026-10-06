/* =====================================================
   O MOCHILÃO — programa-firestore.js  (ES module)
   Preenche PAGES/programa.html com um programa do Firestore
   (formato do painel admin):

   programs/{id}
     nome, slogan, categoria, duracao, preco, pontoPartida, descricao,
     imagemURL (miniatura da capa), capaId, galeria [{id}],
     inclui [], naoInclui [], roteiro [{dia, titulo, descricao}],
     precos [{pax, valor}] (opcional)
   programs/{id}/imagens/{imgId}  → { tipo, data (Base64) }

   URL: programa.html?d=<id do documento>
   Os programas antigos (malanje, cabo-ledo…) continuam a ser
   desenhados pelo programas.js — este ficheiro ignora-os.
   ===================================================== */

import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  limit,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getProgramMedia } from "./image-store.js";

const $ = (sel) => document.querySelector(sel);
const HERO_GRADIENT =
  "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.72) 100%)";

const params = new URLSearchParams(window.location.search);
const programId = params.get("d") || params.get("id") || "";

// Programa estático (programas.js)? Então não é connosco.
const isStatic =
  typeof PROGRAMAS !== "undefined" && programId && Boolean(PROGRAMAS[programId]);

/* ─────────────────────────────────────────
   UTILITÁRIOS
   ───────────────────────────────────────── */
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Texto do admin → HTML seguro (linha em branco = novo parágrafo)
function textToHtml(text) {
  return String(text || "")
    .trim()
    .split(/\n\s*\n/)
    .map((p) => esc(p.trim()).replace(/\n/g, "<br>"))
    .join("<br><br>");
}

function setText(sel, value) {
  const el = $(sel);
  if (el) el.textContent = value ?? "";
}

function setHero(url) {
  const hero = $(".pkg-hero");
  if (!hero || !url) return;
  hero.style.backgroundImage = `${HERO_GRADIENT}, url("${url}")`;
  hero.style.backgroundSize = "cover";
  hero.style.backgroundPosition = "center";
}

/* ─────────────────────────────────────────
   RENDER — texto (imediato)
   ───────────────────────────────────────── */
function renderText(p) {
  document.title = `${p.nome} — O Mochilão Aventuras`;

  setText(".pkg-breadcrumb span", p.nome);
  setText(".pkg-hero__title", p.nome);
  setText(".pkg-hero__desc", p.slogan);
  setText("#pkgTitle", p.nome);

  const desc = textToHtml(p.descricao);
  if ($(".pkg-descricao")) $(".pkg-descricao").innerHTML = desc;
  if ($(".pkg-descricao-cta")) $(".pkg-descricao-cta").innerHTML = desc;

  // Detalhes
  setText(".pkg-detail--dur .pkg-detail__value", p.duracao || "—");
  setText(".pkg-detail--preco .pkg-detail__value", p.preco || "—");
  setText(".pkg-detail--partida .pkg-detail__value", p.pontoPartida || p.partida || "—");

  const roteiro = Array.isArray(p.roteiro) ? p.roteiro : [];

  // Lista "Roteiro" (resumo): um ponto por dia
  const stops = $(".pkg-roteiro__list");
  if (stops) {
    stops.innerHTML = roteiro.length
      ? roteiro
          .map(
            (d) =>
              `<li><i class="fa-solid fa-circle-dot"></i>${esc(
                [d.dia, d.titulo].filter(Boolean).join(" — "),
              )}</li>`,
          )
          .join("")
      : `<li><i class="fa-solid fa-circle-dot"></i>Roteiro a anunciar</li>`;
  }

  // Itinerário (acordeão)
  const acc = $(".pkg-accordion");
  if (acc) {
    acc.innerHTML = roteiro
      .map(
        (d, i) => `
        <div class="pkg-accordion__item">
          <button type="button" class="pkg-accordion__trigger" aria-expanded="${i === 0}">
            <span class="pkg-accordion__day">${esc(d.dia)}</span>
            <span class="pkg-accordion__label">${esc(d.titulo)}</span>
            <i class="fa-solid fa-chevron-down pkg-accordion__icon"></i>
          </button>
          <div class="pkg-accordion__body" ${i === 0 ? "" : "hidden"}>
            <p>${textToHtml(d.descricao)}</p>
          </div>
        </div>`,
      )
      .join("");
  }

  // Inclui / Não inclui
  const li = (icon) => (item) =>
    `<li><i class="fa-solid ${icon}"></i>${esc(item)}</li>`;
  const inc = $(".pkg-inclui__list");
  const exc = $(".pkg-nao-inclui__list");
  if (inc) inc.innerHTML = (p.inclui || []).map(li("fa-check")).join("");
  if (exc) exc.innerHTML = (p.naoInclui || []).map(li("fa-xmark")).join("");

  // Preços por nº de pessoas (o programa-cart.js lê esta lista)
  const precos =
    Array.isArray(p.precos) && p.precos.length
      ? p.precos
      : [{ pax: "Por pessoa", valor: p.preco || "A consultar" }];
  const precosEl = $(".pkg-precos__list");
  if (precosEl) {
    precosEl.innerHTML = precos
      .map((x) => `<li><span>${esc(x.pax)}</span><strong>${esc(x.valor)}</strong></li>`)
      .join("");
  }

  // Miniatura enquanto as fotos grandes carregam
  setHero(p.imagemURL);
  const box = $(".pkg-img-box");
  if (box && p.imagemURL) {
    box.dataset.cartImg = p.imagemURL; // usada pelo carrinho
    box.innerHTML = `<img src="${p.imagemURL}" alt="${esc(p.nome)}" class="pkg-img-box__img">`;
  }
}

/* ─────────────────────────────────────────
   RENDER — imagens (subcoleção, carregadas depois)
   ───────────────────────────────────────── */
async function renderMedia(p) {
  let media;
  try {
    media = await getProgramMedia(db, p);
  } catch (err) {
    console.error("[programa] Erro ao carregar imagens:", err);
    return;
  }

  if (media.capa) setHero(media.capa);

  // Foto vertical ao lado do texto: 1.ª da galeria (ou a capa)
  const box = $(".pkg-img-box");
  const side = media.galeria[0] || media.capa;
  if (box && side) {
    box.innerHTML = `<img src="${side}" alt="${esc(p.nome)}" class="pkg-img-box__img">`;
  }

  // Galeria
  const grid = document.getElementById("pkgGallery");
  if (grid && media.galeria.length) {
    grid.innerHTML = media.galeria
      .map(
        (src, i) => `
        <div class="pkg-gallery__item${i === 0 ? " pkg-gallery__item--tall" : ""}">
          <img src="${src}" alt="${esc(p.nome)} — foto ${i + 1}" class="pkg-gallery__img" loading="lazy">
        </div>`,
      )
      .join("");
  }
}

/* ─────────────────────────────────────────
   OUTROS DESTINOS
   ───────────────────────────────────────── */
async function renderOthers(currentId) {
  const grid = $(".pkg-more .packages__grid");
  if (!grid) return;

  let others = [];
  try {
    const snap = await getDocs(query(collection(db, "programs"), limit(6)));
    others = snap.docs
      .filter((d) => d.id !== currentId)
      .map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("[programa] Outros destinos:", err);
  }

  // Completa com os programas estáticos, se faltarem
  if (others.length < 3 && typeof PROGRAMAS !== "undefined") {
    Object.entries(PROGRAMAS).forEach(([key, s]) => {
      if (others.length < 3) {
        others.push({ id: key, nome: s.nome, slogan: s.slogan, preco: s.preco, duracao: s.duracao, imagemURL: s.heroImg });
      }
    });
  }

  grid.innerHTML = others
    .slice(0, 3)
    .map(
      (o) => `
      <article class="package-card">
        <div class="package-card__media">
          ${
            o.imagemURL
              ? `<img src="${o.imagemURL}" alt="${esc(o.nome)}" class="package-card__img" loading="lazy">`
              : `<div class="package-card__ph"><i class="fa-solid fa-map-location-dot"></i></div>`
          }
        </div>
        <div class="package-card__body">
          <h3 class="package-card__title">${esc(o.nome)}</h3>
          <p class="package-card__desc">${esc(o.slogan)}</p>
          <div class="package-card__meta">
            <div class="package-card__meta-item">
              <span class="package-card__meta-label">Preço/Pax</span>
              <span class="package-card__meta-value">${esc(o.preco)}</span>
            </div>
            <div class="package-card__meta-item">
              <span class="package-card__meta-label">Duração</span>
              <span class="package-card__meta-value">${esc(o.duracao)}</span>
            </div>
          </div>
          <div class="package-card__actions">
            <a href="programa.html?d=${encodeURIComponent(o.id)}" class="btn btn--primary btn--sm pkg-btn">Saber Mais</a>
          </div>
        </div>
      </article>`,
    )
    .join("");
}

/* ─────────────────────────────────────────
   INTERAÇÕES (o programas.js não as liga para programas do Firestore)
   ───────────────────────────────────────── */
function bindInteractions() {
  // Acordeão
  const acc = $(".pkg-accordion");
  acc?.addEventListener("click", (e) => {
    const trigger = e.target.closest(".pkg-accordion__trigger");
    if (!trigger) return;
    const wasOpen = trigger.getAttribute("aria-expanded") === "true";
    acc.querySelectorAll(".pkg-accordion__trigger").forEach((t) => {
      t.setAttribute("aria-expanded", "false");
      t.nextElementSibling.hidden = true;
    });
    if (!wasOpen) {
      trigger.setAttribute("aria-expanded", "true");
      trigger.nextElementSibling.hidden = false;
    }
  });

  // Navbar ao fazer scroll
  const navbar = document.getElementById("navbar");
  if (navbar) {
    window.addEventListener(
      "scroll",
      () => navbar.classList.toggle("scrolled", window.scrollY > 60),
      { passive: true },
    );
  }

  // Menu hambúrguer
  const burger = document.getElementById("burgerBtn");
  const links = document.getElementById("navLinks");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const closeBtn = document.getElementById("closeBtn");
  if (burger && links) {
    burger.addEventListener("click", () => {
      const open = links.classList.toggle("is-open");
      const mobile = window.innerWidth <= 640;
      burger.classList.toggle("is-active", open);
      sidebar?.classList.toggle("is-open", open && mobile);
      overlay?.classList.toggle("is-open", open && mobile);
    });
    const close = () => {
      links.classList.remove("is-open");
      burger.classList.remove("is-active");
      sidebar?.classList.remove("is-open");
      overlay?.classList.remove("is-open");
    };
    closeBtn?.addEventListener("click", close);
    overlay?.addEventListener("click", close);
  }
}

/* ─────────────────────────────────────────
   INIT
   ───────────────────────────────────────── */
(async function init() {
  if (!programId || isStatic) return;

  let snap;
  try {
    snap = await getDoc(doc(db, "programs", programId));
  } catch (err) {
    console.error("[programa] Erro ao ler o programa:", err);
    setText(".pkg-hero__title", "Erro ao carregar o programa");
    return;
  }

  if (!snap.exists()) {
    setText(".pkg-hero__title", "Programa não encontrado");
    return;
  }

  const program = { id: snap.id, ...snap.data() };
  bindInteractions();
  renderText(program);
  renderMedia(program); // fotos grandes chegam depois, sem bloquear o texto
  renderOthers(program.id);
})();