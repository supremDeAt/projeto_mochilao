/* =====================================================
   O MOCHILÃO — admin-dashboard.js  (ES module)
   Ecrã inicial do painel: indicadores, gráfico de reservas,
   programas mais procurados, próximas viagens, alertas e
   atividade recente.
   ===================================================== */

import { esc, toDate, formatDate, timeAgo, formatKz, formatKzShort, slugClass } from "./admin-utils.js";
import { normalizeReservation, isPaidStatus } from "./admin-reservas.js";
import { normalizeMessage } from "./admin-mensagens.js";

const DAY = 86400000;
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const $ = (id) => document.getElementById(id);
const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function createDashboard({ getUserName, onOpenReservation, onOpenMessage, goTo }) {
  let reservations = [];
  let messages = [];
  let programs = [];

  /* ── Saudação ── */
  function renderGreeting() {
    const h = new Date().getHours();
    const hello = h < 12 ? "Bom dia" : h < 19 ? "Boa tarde" : "Boa noite";
    const name = (getUserName() || "").split(" ")[0];
    if ($("dashGreeting")) $("dashGreeting").textContent = `${hello}${name ? ", " + name : ""}!`;
    if ($("dashToday")) {
      $("dashToday").textContent = new Date().toLocaleDateString("pt-PT", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
    }
  }

  /* ── Indicadores ── */
  function renderKpis() {
    const now = new Date();
    const paid = reservations.filter((r) => isPaidStatus(r.status));
    const receita = paid.reduce((s, r) => s + r.total, 0);
    const receitaMes = paid
      .filter((r) => r.criadoEm && r.criadoEm.getMonth() === now.getMonth() && r.criadoEm.getFullYear() === now.getFullYear())
      .reduce((s, r) => s + r.total, 0);

    const pend = reservations.filter((r) => r.group === "pendente");
    const pendValor = pend.reduce((s, r) => s + r.total, 0);

    const porResponder = messages.filter((m) => m.status === "Pendente");
    const novas = messages.filter((m) => !m.lido).length;

    const today = startOfDay();
    const limit = new Date(today.getTime() + 30 * DAY);
    let viajantes = 0;
    let saidas = 0;
    reservations
      .filter((r) => r.group !== "cancelada")
      .forEach((r) =>
        r.itens.forEach((i) => {
          const d = toDate(i.data);
          if (d && d >= today && d <= limit) {
            viajantes += i.pax || 0;
            saidas++;
          }
        }),
      );

    const set = (id, v) => $(id) && ($(id).textContent = v);
    set("kpiRevenue", formatKzShort(receita));
    set("kpiRevenueSub", `Este mês: ${formatKz(receitaMes)}`);
    set("kpiPending", pend.length);
    set("kpiPendingSub", pend.length ? `${formatKz(pendValor)} por receber` : "Nada pendente");
    set("kpiMessages", porResponder.length);
    set("kpiMessagesSub", novas ? `${novas} nova${novas !== 1 ? "s" : ""} por ler` : "Todas lidas");
    set("kpiTravelers", viajantes);
    set("kpiTravelersSub", `${saidas} saída${saidas !== 1 ? "s" : ""} nos próximos 30 dias`);
  }

  /* ── Gráfico: reservas por mês (últimos 6 meses) ── */
  function renderMonthly() {
    const el = $("dashMonthly");
    if (!el) return;
    const now = new Date();
    const months = [];
    for (let k = 5; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      months.push({ y: d.getFullYear(), m: d.getMonth(), n: 0, valor: 0 });
    }
    reservations
      .filter((r) => r.group !== "cancelada" && r.criadoEm)
      .forEach((r) => {
        const b = months.find((x) => x.y === r.criadoEm.getFullYear() && x.m === r.criadoEm.getMonth());
        if (b) {
          b.n++;
          b.valor += r.total;
        }
      });
    const max = Math.max(1, ...months.map((b) => b.n));
    const total = months.reduce((s, b) => s + b.n, 0);

    if (!total) {
      el.innerHTML = `<p class="dash-empty">Ainda sem reservas nos últimos 6 meses.</p>`;
      return;
    }

    el.innerHTML = `
      <div class="bar-chart" role="img" aria-label="Reservas por mês nos últimos 6 meses">
        ${months
          .map((b, i) => {
            const pct = (b.n / max) * 100;
            const label = `${MONTHS[b.m]} ${b.y}: ${b.n} reserva${b.n !== 1 ? "s" : ""} · ${formatKz(b.valor)}`;
            const isLast = i === months.length - 1;
            return `
            <div class="bar-chart__col" tabindex="0" aria-label="${esc(label)}">
              <span class="bar-chart__tip">${esc(label)}</span>
              <div class="bar-chart__track">
                ${isLast && b.n ? `<span class="bar-chart__value">${b.n}</span>` : ""}
                <div class="bar-chart__bar${isLast ? " is-current" : ""}" style="height:${b.n ? Math.max(pct, 4) : 0}%"></div>
              </div>
              <span class="bar-chart__label">${MONTHS[b.m]}</span>
            </div>`;
          })
          .join("")}
      </div>
      <table class="visually-hidden">
        <caption>Reservas por mês</caption>
        <tr><th>Mês</th><th>Reservas</th><th>Valor</th></tr>
        ${months.map((b) => `<tr><td>${MONTHS[b.m]} ${b.y}</td><td>${b.n}</td><td>${formatKz(b.valor)}</td></tr>`).join("")}
      </table>`;
  }

  /* ── Programas mais procurados (por nº de pessoas) ── */
  function renderTopPrograms() {
    const el = $("dashTopPrograms");
    if (!el) return;
    const map = new Map();
    reservations
      .filter((r) => r.group !== "cancelada")
      .forEach((r) =>
        r.itens.forEach((i) => {
          const key = i.nome || "Programa";
          const cur = map.get(key) || { nome: key, pax: 0, reservas: 0 };
          cur.pax += i.pax || 0;
          cur.reservas++;
          map.set(key, cur);
        }),
      );
    const top = [...map.values()].sort((a, b) => b.pax - a.pax || b.reservas - a.reservas).slice(0, 5);
    if (!top.length) {
      el.innerHTML = `<p class="dash-empty">Os programas mais reservados aparecem aqui.</p>`;
      return;
    }
    const max = Math.max(1, ...top.map((t) => t.pax));
    el.innerHTML = `<ul class="hbar-list">${top
      .map(
        (t) => `
        <li class="hbar" title="${esc(`${t.nome}: ${t.pax} pessoas em ${t.reservas} reserva(s)`)}">
          <span class="hbar__name">${esc(t.nome)}</span>
          <span class="hbar__track"><span class="hbar__fill" style="width:${Math.max((t.pax / max) * 100, 3)}%"></span></span>
          <span class="hbar__value">${t.pax} pax</span>
        </li>`,
      )
      .join("")}</ul>`;
  }

  /* ── Próximas viagens (60 dias) ── */
  function renderUpcoming() {
    const el = $("dashUpcoming");
    if (!el) return;
    const today = startOfDay();
    const limit = new Date(today.getTime() + 60 * DAY);
    const trips = [];
    reservations
      .filter((r) => r.group !== "cancelada")
      .forEach((r) =>
        r.itens.forEach((i) => {
          const d = toDate(i.data);
          if (d && d >= today && d <= limit) trips.push({ d, item: i, r });
        }),
      );
    trips.sort((a, b) => a.d - b.d);

    if (!trips.length) {
      el.innerHTML = `<li class="dash-empty">Sem viagens marcadas para os próximos 60 dias.</li>`;
      return;
    }
    el.innerHTML = trips
      .slice(0, 6)
      .map(({ d, item, r }) => {
        const dias = Math.round((d - today) / DAY);
        const quando = dias === 0 ? "Hoje" : dias === 1 ? "Amanhã" : `Em ${dias} dias`;
        return `
        <li>
          <button type="button" class="trip" data-res="${esc(r.id)}">
            <span class="trip__date"><strong>${d.getDate()}</strong>${MONTHS[d.getMonth()]}</span>
            <span class="trip__body">
              <strong>${esc(item.nome)}</strong>
              <span>${esc(r.cliente.nome)} · ${item.pax || "–"} pax · ${quando}</span>
            </span>
            <span class="status-badge status-badge--${slugClass(r.status)}" title="${esc(r.status)}">${esc(r.status === "Aguardando Pagamento" ? "Por pagar" : r.status)}</span>
          </button>
        </li>`;
      })
      .join("");
  }

  /* ── Alertas ── */
  function renderAlerts() {
    const el = $("dashAlertsList");
    if (!el) return;
    const now = Date.now();
    const today = startOfDay();
    const alerts = [];

    const semPagamento = reservations.filter(
      (r) => r.group === "pendente" && r.criadoEm && now - r.criadoEm.getTime() > 2 * DAY,
    );
    if (semPagamento.length) {
      alerts.push({
        icon: "fa-hourglass-half",
        title: `${semPagamento.length} reserva${semPagamento.length > 1 ? "s" : ""} pendente${semPagamento.length > 1 ? "s" : ""} há mais de 48 h`,
        desc: "Contacte o cliente para confirmar o pagamento.",
        view: "reservas",
      });
    }

    const urgentes = reservations.filter(
      (r) =>
        r.group === "pendente" &&
        r.itens.some((i) => {
          const d = toDate(i.data);
          return d && d >= today && d - today <= 7 * DAY;
        }),
    );
    if (urgentes.length) {
      alerts.push({
        icon: "fa-triangle-exclamation",
        danger: true,
        title: `${urgentes.length} viagem${urgentes.length > 1 ? "s" : ""} nos próximos 7 dias sem confirmação`,
        desc: urgentes.slice(0, 2).map((r) => `${r.ref} · ${r.cliente.nome}`).join(" · "),
        view: "reservas",
      });
    }

    const antigas = messages.filter(
      (m) => m.status === "Pendente" && m.criadoEm && now - m.criadoEm.getTime() > DAY,
    );
    if (antigas.length) {
      alerts.push({
        icon: "fa-envelope",
        title: `${antigas.length} mensage${antigas.length > 1 ? "ns" : "m"} à espera há mais de 24 h`,
        desc: "Clientes à espera de resposta.",
        view: "mensagens",
      });
    }

    if (!programs.length) {
      alerts.push({
        icon: "fa-map-location-dot",
        danger: true,
        title: "Nenhum programa no Firestore",
        desc: "Adicione programas para aparecerem no site.",
        view: "programas",
      });
    }

    if (!alerts.length) {
      el.innerHTML = `<li class="alerts-list__empty"><i class="fa-solid fa-circle-check"></i> Tudo em ordem! Sem alertas de momento.</li>`;
      return;
    }
    el.innerHTML = alerts
      .map(
        (a) => `
        <li>
          <button type="button" class="alert-item${a.danger ? " alert-item--danger" : ""}" data-view="${a.view}">
            <i class="fa-solid ${a.icon}"></i>
            <span><strong>${esc(a.title)}</strong>${esc(a.desc)}</span>
            <i class="fa-solid fa-chevron-right alert-item__go"></i>
          </button>
        </li>`,
      )
      .join("");
  }

  /* ── Atividade recente ── */
  function renderRecent() {
    const el = $("dashRecentList");
    if (!el) return;
    const dot = (status) =>
      ({ Confirmada: "--green", Concluída: "--green", Respondido: "--green", Cancelada: "--red", Arquivado: "--blue", "Em análise": "--blue" })[status] || "";

    const entries = [
      ...reservations.map((r) => ({
        when: r.criadoEm,
        title: r.cliente.nome,
        desc: `Reserva ${r.ref} · ${r.programas}${r.total ? " · " + formatKz(r.total) : ""}`,
        status: r.status,
        icon: "fa-calendar-check",
        open: () => onOpenReservation(r.id),
      })),
      ...messages.map((m) => ({
        when: m.criadoEm,
        title: m.nome,
        desc: `Mensagem · ${m.assunto}`,
        status: m.lido ? m.status : "Nova",
        icon: "fa-envelope",
        open: () => onOpenMessage(m.id),
      })),
    ]
      .filter((e) => e.when)
      .sort((a, b) => b.when - a.when)
      .slice(0, 8);

    recentEntries = entries;
    if (!entries.length) {
      el.innerHTML = `<li class="recent-list__empty">Sem atividade recente.</li>`;
      return;
    }
    el.innerHTML = entries
      .map(
        (e, i) => `
        <li>
          <button type="button" class="recent-item" data-recent="${i}">
            <span class="recent-item__icon"><i class="fa-solid ${e.icon}"></i></span>
            <span class="recent-item__body">
              <span class="recent-item__title">${esc(e.title)}</span>
              <span class="recent-item__desc">${esc(e.desc)}</span>
            </span>
            <span class="recent-item__meta">
              <span class="recent-item__badge recent-item__badge${dot(e.status)}">${esc(e.status)}</span>
              <time>${esc(timeAgo(e.when))}</time>
            </span>
          </button>
        </li>`,
      )
      .join("");
  }

  let recentEntries = [];

  /* ── Cliques ── */
  $("dashRecentList")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-recent]");
    if (b) recentEntries[+b.dataset.recent]?.open();
  });
  $("dashAlertsList")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-view]");
    if (b) goTo(b.dataset.view);
  });
  $("dashUpcoming")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-res]");
    if (b) onOpenReservation(b.dataset.res);
  });
  document.querySelectorAll("[data-goto]").forEach((el) =>
    el.addEventListener("click", () => goTo(el.dataset.goto)),
  );

  function renderAll() {
    renderGreeting();
    renderKpis();
    renderMonthly();
    renderTopPrograms();
    renderUpcoming();
    renderAlerts();
    renderRecent();
  }

  return {
    setReservations(list) {
      reservations = (list || []).map(normalizeReservation);
      renderAll();
    },
    setMessages(list) {
      messages = (list || []).map(normalizeMessage);
      renderAll();
    },
    setPrograms(list) {
      programs = list || [];
      renderAlerts();
    },
    refresh: renderAll,
  };
}