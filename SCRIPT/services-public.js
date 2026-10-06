/* =====================================================
   O MOCHILÃO — services-public.js  (ES module)
   Desenha os cards da secção "Serviços" (index.html)
   a partir da coleção "services" do Firestore.

   Coleção vazia ou sem ligação → ficam os cards do HTML.
   ===================================================== */

import { db } from "./firebase-config.js";
import { listServices, serviceHref } from "./services-store.js";
import { serviceIconSVG } from "./services-icons.js";

const grid = document.getElementById("servicesGrid");

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Bloqueia "javascript:" e afins
function safeHref(href) {
  return /^\s*(javascript|data|vbscript):/i.test(href) ? "#" : href;
}

export function serviceCardHTML(s, i = 0, base = "") {
  const href = safeHref(serviceHref(s, base));
  const external = /^https?:\/\//i.test(href);
  return `
    <a class="service-card" href="${esc(href)}" style="--i: ${i}"${
      external ? ' target="_blank" rel="noopener"' : ""
    }>
      <span class="service-card__icon">${serviceIconSVG(s.icone)}</span>
      <h3 class="service-card__title">${esc(s.nome)}</h3>
      <p class="service-card__desc">${esc(s.descricao)}</p>
      <span class="service-card__more">Saber mais <i class="fa-solid fa-arrow-right"></i></span>
    </a>`;
}

(async function init() {
  if (!grid) return;
  try {
    const services = await listServices(db, { onlyActive: true });
    if (!services.length) return; // mantém os cards do HTML
    grid.innerHTML = services.map((s, i) => serviceCardHTML(s, i)).join("");
  } catch (err) {
    console.warn("[serviços] A usar os cards do HTML:", err);
  }
})();