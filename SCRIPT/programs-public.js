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

/* ── Data: a próxima partida (as que já passaram não contam) ── */
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const parseISO = (iso) => {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  return y && m && d ? { y, m, d } : null;
};
function formatRange(inicio, fim) {
  const a = parseISO(inicio);
  const b = parseISO(fim);
  if (!a) return "";
  const one = (x, year) => `${x.d} ${MESES[x.m - 1]}${year ? " " + x.y : ""}`;
  if (!b || fim === inicio) return one(a, true);
  if (a.y !== b.y) return `${one(a, true)} – ${one(b, true)}`;
  if (a.m !== b.m) return `${one(a, false)} – ${one(b, true)}`;
  return `${a.d} – ${one(b, true)}`;
}
function cardDate(program) {
  const t = new Date();
  const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  const list = (Array.isArray(program.datas) ? program.datas : [])
    .filter((d) => d && parseISO(d.inicio) && d.inicio >= today)
    .sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
  if (!list.length) return { label: "Data", value: "Em breve" };
  const extra = list.length - 1;
  return {
    label: extra ? "Próxima data" : "Data",
    value: formatRange(list[0].inicio, list[0].fim || list[0].inicio),
    extra: extra ? `+${extra} ${extra === 1 ? "data" : "datas"}` : "",
  };
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
                <span class="package-card__meta-value package-card__meta-value--date">${escapeHtml(date.value)}${
                  date.extra ? ` <small class="package-card__meta-more">${escapeHtml(date.extra)}</small>` : ""
                }</span>
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
