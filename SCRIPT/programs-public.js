import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ── Preço: o MENOR valor dos pacotes ("A partir de" se houver mais de 1) ── */
const formatKz = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " Kz";

function cardPrice(program) {
  const vals = (Array.isArray(program.pacotes) ? program.pacotes : [])
    .map((p) => Number(p && p.valor) || 0)
    .filter((v) => v > 0);
  if (vals.length) {
    return { label: vals.length > 1 ? "A partir de" : "Preço", value: formatKz(Math.min(...vals)) };
  }
  // Programas antigos (sem pacotes): o texto de preço que já tinham
  const raw = String(program.preco || "").trim();
  const legacy = raw.replace(/^a partir de\s*/i, "").trim();
  return { label: legacy !== raw ? "A partir de" : "Preço", value: legacy || "A consultar" };
}

/* ── Duração: nº de dias da próxima partida ("20 – 22 mai" → "3 dias") ──
   Só nos cards do index; a página do programa continua a mostrar as datas. */
const parseISO = (iso) => {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  return y && m && d ? { y, m, d } : null;
};
const daysLabel = (n) => `${n} ${n === 1 ? "dia" : "dias"}`;
function tripDays(inicio, fim) {
  const a = parseISO(inicio);
  const b = parseISO(fim) || a;
  if (!a) return 0;
  const ms = Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d);
  return Math.max(1, Math.round(ms / 86400000) + 1); // conta o dia de partida e o de regresso
}
function cardDate(program) {
  const t = new Date();
  const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  const next = (Array.isArray(program.datas) ? program.datas : [])
    .filter((d) => d && parseISO(d.inicio) && d.inicio >= today)
    .sort((a, b) => (a.inicio < b.inicio ? -1 : 1))[0];
  if (next) return { label: "Duração", value: daysLabel(tripDays(next.inicio, next.fim || next.inicio)) };
  // Sem datas: a duração escrita no painel (ex.: "3 Dias"), senão "Em breve"
  const dur = String(program.duracao || "").trim();
  return { label: "Duração", value: dur || "Datas em breve" };
}

function renderPrograms(programs) {
  const grid = document.querySelector(".packages:not(.pkg-more) .packages__grid");
  if (!grid || !programs.length) return;

  grid.innerHTML = programs
    .map((program) => {
      const image = program.imagemURL
        ? `<img src="${escapeHtml(program.imagemURL)}" alt="${escapeHtml(program.nome)}" class="package-card__img">`
        : `<div class="package-card__ph"><i class="fa-solid fa-map-location-dot"></i></div>`;
      const price = cardPrice(program);
      const date = cardDate(program);

      return `
        <article class="package-card reveal-up">
          <div class="package-card__media">${image}</div>
          <div class="package-card__body">
            <h3 class="package-card__title">${escapeHtml(program.nome || "Programa")}</h3>
            <p class="package-card__desc">${escapeHtml(program.slogan || program.descricao || "Conheça esta experiência em Angola.")}</p>
            <div class="package-card__meta">
              <div class="package-card__meta-item">
                <span class="package-card__meta-label">${escapeHtml(date.label)}</span>
                <span class="package-card__meta-value package-card__meta-value--date">${escapeHtml(date.value)}</span>
              </div>
              <div class="package-card__meta-item">
                <span class="package-card__meta-label">${escapeHtml(price.label)}</span>
                <span class="package-card__meta-value">${escapeHtml(price.value)}</span>
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

// Leitura única (não fica a "ouvir" o Firestore): gasta menos leituras do plano
getDocs(collection(db, "programs"))
  .then((snapshot) => {
    const programs = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      // Programas criados só para a página "Viagens Personalizadas" não aparecem aqui
      .filter((program) => !program.soPersonalizada);
    renderPrograms(programs);
  })
  .catch((error) => console.warn("Não foi possível carregar os programas públicos.", error));
