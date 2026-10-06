/* =====================================================
   O MOCHILÃO — admin-mensagens.js  (ES module)
   Ecrã "Mensagens" (caixa de entrada do formulário de contacto).

   messages/{id}: nome, email, telefone, assunto, mensagem,
                  data | criadoEm, status, lido
   Estados: "Pendente" (por responder) · "Respondido" · "Arquivado"
   ===================================================== */

import {
  doc,
  updateDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import {
  esc,
  toDate,
  formatDate,
  timeAgo,
  waLink,
  slugClass,
  searchable,
  toast,
  setNavBadge,
} from "./admin-utils.js";

export function normalizeMessage(raw) {
  const m = raw || {};
  const status = m.status || "Pendente";
  const msg = {
    id: m.id,
    nome: m.nome || "Sem nome",
    email: m.email || "",
    telefone: m.telefone || "",
    assunto: m.assunto || "Sem assunto",
    mensagem: m.mensagem || "",
    criadoEm: toDate(m.data || m.criadoEm || m.createdAt || m.timestamp),
    status,
    // Mensagens antigas sem o campo "lido": só as pendentes contam como novas
    lido: m.lido === true || status !== "Pendente",
  };
  msg.search = searchable(msg.nome, msg.email, msg.telefone, msg.assunto, msg.mensagem);
  return msg;
}

const TABS = [
  { key: "Pendente", label: "Por responder", icon: "fa-inbox" },
  { key: "Respondido", label: "Respondidas", icon: "fa-reply" },
  { key: "Arquivado", label: "Arquivadas", icon: "fa-box-archive" },
  { key: "todas", label: "Todas", icon: "fa-layer-group" },
];

export function createMessagesView({ db, getPerms, getRole, openModal, closeModal }) {
  const listEl = document.getElementById("messagesList");
  const tabsEl = document.getElementById("msgTabs");
  const searchInput = document.getElementById("msgSearch");

  let all = [];
  let tab = "Pendente";
  let query = "";

  function visible() {
    const q = searchable(query).trim();
    return all
      .filter((m) => tab === "todas" || m.status === tab)
      .filter((m) => !q || m.search.includes(q))
      .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
  }

  function renderTabs() {
    if (!tabsEl) return;
    tabsEl.innerHTML = TABS.map((t) => {
      const n = t.key === "todas" ? all.length : all.filter((m) => m.status === t.key).length;
      return `
        <button type="button" class="filter-chip${tab === t.key ? " is-active" : ""}" data-tab="${t.key}">
          <i class="fa-solid ${t.icon}"></i> ${t.label} <span class="filter-chip__count">${n}</span>
        </button>`;
    }).join("");
  }

  function renderList() {
    if (!listEl) return;
    const rows = visible();

    if (!rows.length) {
      const empty = !all.length
        ? "A caixa de entrada está vazia. Ainda sem mensagens de clientes."
        : query
          ? "Nenhuma mensagem corresponde à pesquisa."
          : tab === "Pendente"
            ? "Tudo respondido! Não há mensagens à espera."
            : "Sem mensagens nesta pasta.";
      listEl.innerHTML = `<li class="inbox__empty"><i class="fa-regular fa-envelope-open"></i> ${empty}</li>`;
      return;
    }

    listEl.innerHTML = rows
      .map(
        (m) => `
        <li>
          <button type="button" class="inbox-item${m.lido ? "" : " is-unread"}" data-id="${esc(m.id)}">
            <span class="inbox-item__avatar" aria-hidden="true">${esc(m.nome.trim().charAt(0).toUpperCase() || "?")}</span>
            <span class="inbox-item__body">
              <span class="inbox-item__top">
                <strong class="inbox-item__name">${esc(m.nome)}</strong>
                <time class="inbox-item__time" title="${esc(formatDate(m.criadoEm, true))}">${esc(timeAgo(m.criadoEm))}</time>
              </span>
              <span class="inbox-item__subject">${esc(m.assunto)}</span>
              <span class="inbox-item__snippet">${esc(m.mensagem.slice(0, 140))}</span>
            </span>
            ${m.status !== "Pendente" ? `<span class="status-badge status-badge--${slugClass(m.status)}">${esc(m.status)}</span>` : ""}
          </button>
        </li>`,
      )
      .join("");
  }

  function render(list) {
    all = (list || []).map(normalizeMessage);
    setNavBadge("mensagens", all.filter((m) => !m.lido).length);
    renderTabs();
    renderList();
  }

  tabsEl?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (!b) return;
    tab = b.dataset.tab;
    renderTabs();
    renderList();
  });

  searchInput?.addEventListener("input", () => {
    query = searchInput.value;
    renderList();
  });

  listEl?.addEventListener("click", (e) => {
    const item = e.target.closest(".inbox-item");
    if (item) openDetail(item.dataset.id);
  });

  async function update(id, data, okMsg) {
    try {
      await updateDoc(doc(db, "messages", id), data);
      if (okMsg) toast(okMsg);
      return true;
    } catch (err) {
      console.error("[mensagens]", err);
      toast("Não foi possível atualizar a mensagem.", "error");
      return false;
    }
  }

  /* ── Detalhe ── */
  function openDetail(id) {
    const m = all.find((x) => x.id === id);
    if (!m) return;
    const perms = getPerms();
    const canEdit = perms.canManageReservations;
    const isSuper = getRole() === "Super Admin";

    // Abrir = marcar como lida (o estado só muda quando o admin decidir)
    if (canEdit && !m.lido) update(id, { lido: true });

    const primeiro = m.nome.split(" ")[0];
    const wpp = waLink(
      m.telefone,
      `Olá ${primeiro}! Obrigado pelo seu contacto com O Mochilão sobre "${m.assunto}". `,
    );
    const mailto = m.email
      ? `mailto:${m.email}?subject=${encodeURIComponent("Re: " + m.assunto)}&body=${encodeURIComponent(
          `Olá ${primeiro},\n\nObrigado pelo seu contacto.\n\n\n\n— Equipa O Mochilão\n\n> ${m.mensagem.replace(/\n/g, "\n> ")}`,
        )}`
      : "";

    const html = `
      <div class="msg-detail">
        <div class="msg-detail__head">
          <span class="inbox-item__avatar inbox-item__avatar--lg">${esc(m.nome.charAt(0).toUpperCase())}</span>
          <div>
            <p class="detail-block__name">${esc(m.nome)}</p>
            <p class="cell-sub">${esc(m.email || "sem email")}${m.telefone ? " · " + esc(m.telefone) : ""}</p>
            <p class="cell-sub">${esc(formatDate(m.criadoEm, true))}</p>
          </div>
        </div>

        <h4 class="msg-detail__subject">${esc(m.assunto)}</h4>
        <div class="msg-detail__text">${esc(m.mensagem || "Sem conteúdo.").replace(/\n/g, "<br>")}</div>

        <div class="detail-actions">
          ${wpp ? `<a href="${esc(wpp)}" target="_blank" rel="noopener" class="btn btn--sm btn--wpp"><i class="fa-brands fa-whatsapp"></i> Responder no WhatsApp</a>` : ""}
          ${mailto ? `<a href="${esc(mailto)}" class="btn btn--outline btn--sm"><i class="fa-solid fa-envelope"></i> Responder por email</a>` : ""}
        </div>

        ${
          canEdit
            ? `<div class="msg-detail__status">
                ${
                  m.status === "Respondido"
                    ? `<button type="button" class="btn btn--outline btn--sm" data-set="Pendente"><i class="fa-solid fa-rotate-left"></i> Voltar a "por responder"</button>`
                    : `<button type="button" class="btn btn--primary btn--sm" data-set="Respondido"><i class="fa-solid fa-check"></i> Marcar como respondida</button>`
                }
                ${
                  m.status === "Arquivado"
                    ? `<button type="button" class="btn btn--outline btn--sm" data-set="Pendente"><i class="fa-solid fa-inbox"></i> Tirar do arquivo</button>`
                    : `<button type="button" class="btn btn--outline btn--sm" data-set="Arquivado"><i class="fa-solid fa-box-archive"></i> Arquivar</button>`
                }
                <button type="button" class="btn btn--outline btn--sm" data-unread><i class="fa-regular fa-envelope"></i> Marcar como não lida</button>
              </div>`
            : ""
        }
        ${isSuper ? `<div class="detail-danger"><button type="button" class="btn-link-danger" data-delete><i class="fa-regular fa-trash-can"></i> Eliminar mensagem</button></div>` : ""}
      </div>`;

    openModal("Mensagem", html, { wide: false });

    const body = document.querySelector(".msg-detail");
    body?.addEventListener("click", async (e) => {
      const set = e.target.closest("[data-set]");
      if (set) {
        const status = set.dataset.set;
        const ok = await update(id, { status, lido: true }, `Mensagem: ${status === "Pendente" ? "por responder" : status.toLowerCase()}.`);
        if (ok) closeModal();
        return;
      }
      if (e.target.closest("[data-unread]")) {
        if (await update(id, { lido: false }, "Marcada como não lida.")) closeModal();
        return;
      }
      if (e.target.closest("[data-delete]")) {
        if (!confirm(`Eliminar a mensagem de ${m.nome}?`)) return;
        try {
          await deleteDoc(doc(db, "messages", id));
          closeModal();
          toast("Mensagem eliminada.");
        } catch (err) {
          console.error("[mensagens]", err);
          toast("Sem permissão para eliminar.", "error");
        }
      }
    });
  }

  return { render, openDetail };
}