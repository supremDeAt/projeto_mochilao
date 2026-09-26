import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderPrograms(programs) {
  const grid = document.querySelector(".packages:not(.pkg-more) .packages__grid");
  if (!grid || !programs.length) return;

  grid.innerHTML = programs
    .map((program) => {
      const image = program.imagemURL
        ? `<img src="${escapeHtml(program.imagemURL)}" alt="${escapeHtml(program.nome)}" class="package-card__img">`
        : `<div class="package-card__ph"><i class="fa-solid fa-map-location-dot"></i></div>`;

      return `
        <article class="package-card reveal-up">
          <div class="package-card__media">${image}</div>
          <div class="package-card__body">
            <h3 class="package-card__title">${escapeHtml(program.nome || "Programa")}</h3>
            <p class="package-card__desc">${escapeHtml(program.slogan || program.descricao || "Conheça esta experiência em Angola.")}</p>
            <div class="package-card__meta">
              <div class="package-card__meta-item">
                <span class="package-card__meta-label">Preço/Pax</span>
                <span class="package-card__meta-value">${escapeHtml(program.preco || "A consultar")}</span>
              </div>
              <div class="package-card__meta-item">
                <span class="package-card__meta-label">Duração</span>
                <span class="package-card__meta-value">${escapeHtml(program.duracao || "A consultar")}</span>
              </div>
            </div>
            <div class="package-card__actions">
              <a href="PAGES/programa.html?d=${encodeURIComponent(program.id)}" class="btn btn--primary btn--sm pkg-btn">Saber Mais</a>
            </div>
          </div>
        </article>`;
    })
    .join("");

  requestAnimationFrame(() => {
    grid.querySelectorAll(".package-card.reveal-up").forEach((card, index) => {
      setTimeout(() => card.classList.add("is-visible"), index * 100);
    });
  });
}

onSnapshot(
  collection(db, "programs"),
  (snapshot) => {
    const programs = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderPrograms(programs);
  },
  (error) => console.warn("Não foi possível carregar os programas públicos.", error),
);
