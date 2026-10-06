/* =====================================================
   O MOCHILÃO — team-public.js  (ES module)
   Desenha os cards da secção "Equipa" (index.html)
   a partir da coleção "team" do Firestore.

   Se a coleção estiver vazia ou não houver ligação,
   ficam os cards escritos no HTML (conteúdo de reserva).
   ===================================================== */

import { db } from "./firebase-config.js";
import { listTeam } from "./team-store.js";

const grid = document.getElementById("teamGrid");

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Só aceita links http(s) e imagens data:/http(s) — nada de "javascript:"
const safeUrl = (url) => (/^https?:\/\//i.test(url || "") ? url : "");
const safeImg = (url) => (/^(data:image\/|https?:\/\/)/i.test(url || "") ? url : "");

export function teamCardHTML(m, i = 0) {
  const foto = safeImg(m.fotoURL);
  const insta = safeUrl(m.instagram);

  return `
    <article class="team-card" style="--i: ${i}">
      <div class="team-card__media">
        ${
          foto
            ? `<img src="${esc(foto)}" alt="${esc(m.nome)}" class="team-card__img" loading="lazy">`
            : `<div class="team-card__ph"><i class="fa-solid fa-user"></i></div>`
        }
      </div>
      <div class="team-card__info">
        <div class="team-card__text">
          <h3 class="team-card__name">${esc(m.nome)}</h3>
          <p class="team-card__role">${esc(m.cargo)}</p>
        </div>
        ${
          insta
            ? `<a href="${esc(insta)}" target="_blank" rel="noopener" class="team-card__social" aria-label="Instagram de ${esc(m.nome)}">
                 <i class="fa-brands fa-instagram"></i>
               </a>`
            : ""
        }
      </div>
    </article>`;
}

(async function init() {
  if (!grid) return;
  try {
    const members = await listTeam(db, { onlyActive: true });
    if (!members.length) return; // mantém os cards do HTML
    grid.innerHTML = members.map(teamCardHTML).join("");
  } catch (err) {
    console.warn("[equipa] A usar os cards do HTML:", err);
  }
})();