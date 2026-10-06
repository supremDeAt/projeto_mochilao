/* =====================================================
   O MOCHILÃO — admin-reservas.js  (ES module)
   Ecrã "Reservas" do painel admin.

   Lê os dois formatos que existem na coleção "reservations":
   • Checkout (carrinho):  { clienteInfo{nome,email,telefone}, itens[], total,
                             status, dataPedido }
   • Formulário antigo:    { nome, telefone, destino, data, pessoas, status }
   ===================================================== */

import {
  doc,
  updateDoc,
  deleteDoc,
  arrayUnion,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import {
  esc,
  toDate,
  formatDate,
  timeAgo,
  formatKz,
  toNumber,
  waLink,
  slugClass,
  searchable,
  toast,
  downloadCSV,
  setNavBadge,
} from "./admin-utils.js";

/* ─────────────────────────────────────────
   ESTADOS
   ───────────────────────────────────────── */
export const RES_STATUS = [
  { value: "Aguardando Pagamento", short: "A aguardar", group: "pendente", icon: "fa-hourglass-half" },
  { value: "Em análise", short: "Em análise", group: "pendente", icon: "fa-magnifying-glass" },
  { value: "Confirmada", short: "Confirmadas", group: "confirmada", icon: "fa-circle-check" },
  { value: "Concluída", short: "Concluídas", group: "concluida", icon: "fa-flag-checkered" },
  { value: "Cancelada", short: "Canceladas", group: "cancelada", icon: "fa-ban" },
];

// "Pendente" vem do formulário antigo → conta como pendente
export function statusGroup(status) {
  if (!status || status === "Pendente") return "pendente";
  return RES_STATUS.find((s) => s.value === status)?.group || "pendente";
}

export const isPaidStatus = (status) => ["Confirmada", "Concluída"].includes(status);

/* ─────────────────────────────────────────
   NORMALIZAÇÃO
   ───────────────────────────────────────── */
export function normalizeReservation(raw) {
  const r = raw || {};
  const cliente = r.clienteInfo || {
    nome: r.nome,
    email: r.email,
    telefone: r.telefone,
  };

  let itens;
  if (Array.isArray(r.itens) && r.itens.length) {
    itens = r.itens.map((i) => {
      const pax = parseInt(i.pax, 10) || 1;
      const precoUnitario = toNumber(i.precoUnitario);
      return {
        nome: i.nome || "Programa",
        programId: i.programId || "",
        imagem: i.imagem || "",
        data: i.data || "",
        pax,
        precoUnitario,
        total: toNumber(i.total) || precoUnitario * pax,
      };
    });
  } else {
    // formato antigo: um único destino
    itens = [
      {
        nome: r.destino || "Programa",
        programId: "",
        imagem: "",
        data: r.data || "",
        pax: parseInt(r.pessoas, 10) || 0,
        precoUnitario: 0,
        total: toNumber(r.total),
      },
    ];
  }

  const total = toNumber(r.total) || itens.reduce((s, i) => s + i.total, 0);
  const pax = itens.reduce((s, i) => s + (i.pax || 0), 0);
  const datas = itens.map((i) => toDate(i.data)).filter(Boolean).sort((a, b) => a - b);
  const status = r.status || "Pendente";

  const res = {
    id: r.id,
    ref: r.ref || "MCH-" + String(r.id || "").slice(0, 6).toUpperCase(),
    cliente: {
      nome: cliente.nome || "Cliente sem nome",
      email: cliente.email || "",
      telefone: cliente.telefone || "",
    },
    itens,
    total,
    pax,
    viagem: datas[0] || null,
    criadoEm: toDate(r.dataPedido || r.criadoEm || r.createdAt || r.timestamp),
    status,
    group: statusGroup(status),
    notas: r.notas || "",
    historico: Array.isArray(r.historico) ? r.historico : [],
    legacy: !Array.isArray(r.itens),
  };
  res.programas = itens.map((i) => i.nome).join(", ");
  res.search = searchable(res.ref, res.cliente.nome, res.cliente.email, res.cliente.telefone, res.programas);
  return res;
}

function statusBadge(status) {
  return `<span class="status-badge status-badge--${slugClass(status)}">${esc(status)}</span>`;
}

function statusOptions(current) {
  const values = RES_STATUS.map((s) => s.value);
  if (!values.includes(current)) values.unshift(current); // ex.: "Pendente"
  return values
    .map((v) => `<option value="${esc(v)}" ${v === current ? "selected" : ""}>${esc(v)}</option>`)
    .join("");
}

/** Mensagem de WhatsApp pronta, conforme o estado. */
function whatsappMessage(r) {
  const nome = r.cliente.nome.split(" ")[0];
  const base = `${r.programas} (${r.ref})`;
  switch (r.status) {
    case "Confirmada":
      return `Olá ${nome}! A sua reserva ${base} está confirmada. Obrigado por viajar com O Mochilão! Em breve enviamos todos os detalhes da viagem.`;
    case "Cancelada":
      return `Olá ${nome}! Escrevemos sobre a sua reserva ${base}, que foi cancelada. Se precisar de ajuda para remarcar, estamos disponíveis.`;
    case "Concluída":
      return `Olá ${nome}! Esperamos que tenha gostado da experiência ${r.programas}. Adorávamos saber a sua opinião!`;
    default:
      return `Olá ${nome}! Recebemos a sua reserva ${base} no valor de ${formatKz(r.total)}. Para a confirmar, faça a transferência e envie-nos o comprovativo por aqui. Obrigado!`;
  }
}

/* ─────────────────────────────────────────
   ECRÃ
   ───────────────────────────────────────── */
export function createReservationsView({ db, getPerms, getRole, getUser, openModal, closeModal }) {
  const tbody = document.getElementById("reservationsList");
  const searchInput = document.getElementById("resSearch");
  const filters = document.getElementById("resFilters");
  const summary = document.getElementById("resSummary");
  const exportBtn = document.getElementById("resExportBtn");

  let all = [];
  let filter = "todas";
  let query = "";

  /* ── Lista filtrada ── */
  function visible() {
    const q = searchable(query).trim();
    return all
      .filter((r) => filter === "todas" || r.group === filter || r.status === filter)
      .filter((r) => !q || r.search.includes(q))
      .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
  }

  function renderFilters() {
    if (!filters) return;
    const count = (g) => all.filter((r) => r.group === g).length;
    const chips = [
      { key: "todas", label: "Todas", n: all.length },
      { key: "pendente", label: "Pendentes", n: count("pendente") },
      { key: "confirmada", label: "Confirmadas", n: count("confirmada") },
      { key: "concluida", label: "Concluídas", n: count("concluida") },
      { key: "cancelada", label: "Canceladas", n: count("cancelada") },
    ];
    filters.innerHTML = chips
      .map(
        (c) => `
        <button type="button" class="filter-chip${filter === c.key ? " is-active" : ""}" data-filter="${c.key}">
          ${c.label} <span class="filter-chip__count">${c.n}</span>
        </button>`,
      )
      .join("");
  }

  function renderTable() {
    if (!tbody) return;
    const perms = getPerms();
    const rows = visible();

    if (summary) {
      const soma = rows.reduce((s, r) => s + r.total, 0);
      summary.textContent = rows.length
        ? `${rows.length} reserva${rows.length !== 1 ? "s" : ""} · ${formatKz(soma)}`
        : "";
    }

    if (!all.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="admin-empty-state">Ainda sem reservas registadas.</td></tr>`;
      return;
    }
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="admin-empty-state">Nenhuma reserva corresponde à pesquisa.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows
      .map((r) => {
        const extra = r.itens.length > 1 ? ` <span class="res-more">+${r.itens.length - 1}</span>` : "";
        const statusCell = perms.canManageReservations
          ? `<select class="status-select status-select--${slugClass(r.status)}" data-id="${esc(r.id)}" aria-label="Estado da reserva ${esc(r.ref)}">${statusOptions(r.status)}</select>`
          : statusBadge(r.status);
        return `
        <tr class="is-clickable" data-id="${esc(r.id)}">
          <td>
            <strong class="res-ref">${esc(r.ref)}</strong>
            <div class="cell-sub">${esc(timeAgo(r.criadoEm))}</div>
          </td>
          <td>
            <strong>${esc(r.cliente.nome)}</strong>
            <div class="cell-sub">${esc(r.cliente.telefone || r.cliente.email || "")}</div>
          </td>
          <td class="cell-truncate">${esc(r.itens[0].nome)}${extra}</td>
          <td style="white-space:nowrap">${esc(formatDate(r.viagem))}</td>
          <td style="text-align:center">${r.pax || "–"}</td>
          <td style="white-space:nowrap"><strong>${r.total ? esc(formatKz(r.total)) : "–"}</strong></td>
          <td>${statusCell}</td>
        </tr>`;
      })
      .join("");
  }

  function render(list) {
    all = (list || []).map(normalizeReservation);
    const pending = all.filter((r) => r.group === "pendente").length;
    setNavBadge("reservas", pending);
    renderFilters();
    renderTable();
    // Se o detalhe estiver aberto, atualiza-o
    if (openId && document.getElementById("resDetail")) openDetail(openId, true);
  }

  /* ── Atualizar estado (+ histórico) ── */
  async function changeStatus(id, newStatus) {
    const r = all.find((x) => x.id === id);
    if (!r || r.status === newStatus) return;
    const user = getUser();
    await updateDoc(doc(db, "reservations", id), {
      status: newStatus,
      historico: arrayUnion({
        de: r.status,
        para: newStatus,
        por: user?.email || "admin",
        em: new Date(),
      }),
    });
    toast(`${r.ref}: ${newStatus}`);
  }

  /* ── Eventos da tabela ── */
  tbody?.addEventListener("change", async (e) => {
    const sel = e.target.closest(".status-select");
    if (!sel) return;
    sel.disabled = true;
    try {
      await changeStatus(sel.dataset.id, sel.value);
    } catch (err) {
      console.error("[reservas]", err);
      toast("Não foi possível mudar o estado.", "error");
      renderTable();
    } finally {
      sel.disabled = false;
    }
  });

  tbody?.addEventListener("click", (e) => {
    if (e.target.closest("select, a, button")) return;
    const row = e.target.closest("tr[data-id]");
    if (row) openDetail(row.dataset.id);
  });

  filters?.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-filter]");
    if (!chip) return;
    filter = chip.dataset.filter;
    renderFilters();
    renderTable();
  });

  searchInput?.addEventListener("input", () => {
    query = searchInput.value;
    renderTable();
  });

  exportBtn?.addEventListener("click", () => {
    const rows = visible();
    if (!rows.length) return toast("Não há reservas para exportar.", "info");
    const data = [["Referência", "Pedido em", "Cliente", "Email", "Telefone", "Programas", "Data da viagem", "Pessoas", "Total (Kz)", "Estado", "Notas"]];
    rows.forEach((r) =>
      data.push([
        r.ref,
        formatDate(r.criadoEm, true),
        r.cliente.nome,
        r.cliente.email,
        r.cliente.telefone,
        r.programas,
        formatDate(r.viagem),
        r.pax,
        r.total,
        r.status,
        r.notas,
      ]),
    );
    const today = new Date().toISOString().slice(0, 10);
    downloadCSV(`reservas-mochilao-${today}.csv`, data);
  });

  /* ─────────────────────────────────────────
     DETALHE (modal)
     ───────────────────────────────────────── */
  let openId = null;

  function openDetail(id, refresh = false) {
    const r = all.find((x) => x.id === id);
    if (!r) return;
    // Não redesenhar enquanto o admin está a escrever as notas
    if (refresh && document.activeElement?.id === "resNotes") return;
    openId = id;
    const perms = getPerms();
    const isSuper = getRole() === "Super Admin";

    // Ao atualizar em tempo real, preserva o texto que está a ser escrito nas notas
    const typedNotes = refresh ? document.getElementById("resNotes")?.value : null;

    const wpp = waLink(r.cliente.telefone, whatsappMessage(r));
    const itensHtml = r.itens
      .map(
        (i) => `
        <li class="res-item">
          ${
            i.imagem
              ? `<img src="${esc(i.imagem)}" alt="" class="res-item__img" loading="lazy">`
              : `<span class="res-item__img res-item__img--ph"><i class="fa-solid fa-map-location-dot"></i></span>`
          }
          <div class="res-item__body">
            <strong>${esc(i.nome)}</strong>
            <span>${esc(formatDate(i.data))} · ${i.pax || "–"} pessoa${i.pax === 1 ? "" : "s"}${
              i.precoUnitario ? ` × ${esc(formatKz(i.precoUnitario))}` : ""
            }</span>
          </div>
          <strong class="res-item__total">${i.total ? esc(formatKz(i.total)) : "–"}</strong>
        </li>`,
      )
      .join("");

    const historico = [...r.historico]
      .sort((a, b) => (toDate(b.em) || 0) - (toDate(a.em) || 0))
      .map(
        (h) => `
        <li><span>${esc(formatDate(h.em, true))}</span>
          ${esc(h.de || "–")} → <strong>${esc(h.para)}</strong>
          <em>${esc(h.por || "")}</em></li>`,
      )
      .join("");

    const html = `
      <div class="res-detail" id="resDetail">
        <div class="res-detail__top">
          ${statusBadge(r.status)}
          <span class="cell-sub">Pedido ${esc(formatDate(r.criadoEm, true))}</span>
        </div>

        <section class="detail-block">
          <h4 class="detail-block__title">Cliente</h4>
          <p class="detail-block__name">${esc(r.cliente.nome)}</p>
          <p class="cell-sub">${esc(r.cliente.email || "sem email")} · ${esc(r.cliente.telefone || "sem telefone")}</p>
          <div class="detail-actions">
            ${wpp ? `<a href="${esc(wpp)}" target="_blank" rel="noopener" class="btn btn--sm btn--wpp"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>` : ""}
            ${r.cliente.telefone ? `<a href="tel:${esc(r.cliente.telefone.replace(/\s/g, ""))}" class="btn btn--outline btn--sm"><i class="fa-solid fa-phone"></i> Ligar</a>` : ""}
            ${r.cliente.email ? `<a href="mailto:${esc(r.cliente.email)}?subject=${encodeURIComponent("Reserva " + r.ref + " — O Mochilão")}" class="btn btn--outline btn--sm"><i class="fa-solid fa-envelope"></i> Email</a>` : ""}
          </div>
        </section>

        <section class="detail-block">
          <h4 class="detail-block__title">Programas</h4>
          <ul class="res-items">${itensHtml}</ul>
          <div class="res-total"><span>Total</span><strong>${r.total ? esc(formatKz(r.total)) : "A definir"}</strong></div>
        </section>

        ${
          perms.canManageReservations
            ? `<section class="detail-block">
                <h4 class="detail-block__title">Estado</h4>
                <div class="status-steps" id="resStatusSteps">
                  ${RES_STATUS.map(
                    (s) => `
                    <button type="button" class="status-step status-step--${slugClass(s.value)}${r.status === s.value ? " is-current" : ""}" data-status="${esc(s.value)}">
                      <i class="fa-solid ${s.icon}"></i> ${esc(s.value)}
                    </button>`,
                  ).join("")}
                </div>
              </section>`
            : ""
        }

        <section class="detail-block">
          <h4 class="detail-block__title">Notas internas</h4>
          <textarea id="resNotes" class="detail-notes" rows="3" placeholder="Ex: cliente quer guia em inglês, pagou 50%..." ${
            perms.canManageReservations ? "" : "disabled"
          }>${esc(typedNotes ?? r.notas)}</textarea>
          ${perms.canManageReservations ? `<button type="button" id="resSaveNotes" class="btn btn--primary btn--sm">Guardar notas</button>` : ""}
        </section>

        ${historico ? `<section class="detail-block"><h4 class="detail-block__title">Histórico</h4><ul class="res-history">${historico}</ul></section>` : ""}

        ${
          isSuper
            ? `<div class="detail-danger"><button type="button" id="resDelete" class="btn-link-danger"><i class="fa-regular fa-trash-can"></i> Eliminar reserva</button></div>`
            : ""
        }
      </div>`;

    openModal(`Reserva ${r.ref}`, html, { wide: true, onClose: () => (openId = null) });

    document.getElementById("resStatusSteps")?.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-status]");
      if (!btn || btn.classList.contains("is-current")) return;
      btn.disabled = true;
      try {
        await changeStatus(id, btn.dataset.status);
      } catch (err) {
        console.error("[reservas]", err);
        toast("Não foi possível mudar o estado.", "error");
        btn.disabled = false;
      }
    });

    document.getElementById("resSaveNotes")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        await updateDoc(doc(db, "reservations", id), {
          notas: document.getElementById("resNotes").value.trim(),
        });
        toast("Notas guardadas.");
      } catch (err) {
        console.error("[reservas]", err);
        toast("Erro ao guardar as notas.", "error");
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById("resDelete")?.addEventListener("click", async () => {
      if (!confirm(`Eliminar definitivamente a reserva ${r.ref} de ${r.cliente.nome}?`)) return;
      try {
        await deleteDoc(doc(db, "reservations", id));
        openId = null;
        closeModal();
        toast(`Reserva ${r.ref} eliminada.`);
      } catch (err) {
        console.error("[reservas]", err);
        toast("Sem permissão para eliminar.", "error");
      }
    });
  }

  return { render, openDetail, normalize: normalizeReservation };
}