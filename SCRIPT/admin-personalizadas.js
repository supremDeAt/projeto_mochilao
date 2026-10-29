/* =====================================================
   O MOCHILÃO — admin-personalizadas.js  (ES module)
   Ecrã "Personalizadas": pedidos de viagem à medida
   feitos na página PAGES/personalizada.html.

   customTrips/{id}: nome, telefone, email, destino, pessoas, quando,
                     duracao, tipo, interesses[], alojamento,
                     orcamento, mensagem,
                     status, lido, notas, criadoEm, historico[]
   (os pedidos antigos só têm nome, telefone, destino, pessoas, quando)
   Estados: Novo → Em proposta → Confirmado · Arquivado
   ===================================================== */

import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  arrayUnion,
  serverTimestamp,
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

const STATUSES = [
  { key: "Novo", label: "Novos", icon: "fa-inbox", hint: "Ainda ninguém tratou" },
  { key: "Em proposta", label: "Em proposta", icon: "fa-pen-ruler", hint: "Proposta enviada, à espera do cliente" },
  { key: "Confirmado", label: "Confirmados", icon: "fa-circle-check", hint: "Cliente aceitou" },
  { key: "Arquivado", label: "Arquivados", icon: "fa-box-archive", hint: "Sem seguimento" },
];
const TABS = [...STATUSES, { key: "todos", label: "Todos", icon: "fa-layer-group" }];

function normalize(raw) {
  const t = raw || {};
  const trip = {
    id: t.id,
    nome: t.nome || "Sem nome",
    telefone: t.telefone || "",
    destino: t.destino || "",
    pessoas: Number(t.pessoas) || 0,
    quando: t.quando || "",
    email: t.email || "",
    duracao: t.duracao || "",
    tipo: t.tipo || "",
    interesses: Array.isArray(t.interesses) ? t.interesses : [],
    alojamento: t.alojamento || "",
    orcamento: t.orcamento || "",
    mensagem: t.mensagem || "",
    notas: t.notas || "",
    status: STATUSES.some((s) => s.key === t.status) ? t.status : "Novo",
    lido: t.lido === true || (t.status && t.status !== "Novo"),
    criadoEm: toDate(t.criadoEm),
    historico: Array.isArray(t.historico) ? t.historico : [],
  };
  trip.search = searchable(
    trip.nome, trip.telefone, trip.email, trip.destino, trip.quando,
    trip.tipo, trip.interesses.join(" "), trip.mensagem, trip.notas,
  );
  return trip;
}

export function initCustomTripsAdmin({ db, getPerms, getRole, getUser, openModal, closeModal }) {
  const listEl = document.getElementById("customTripsList");
  const tabsEl = document.getElementById("customTabs");
  const searchInput = document.getElementById("customSearch");
  if (!listEl) return;

  let all = [];
  let tab = "Novo";
  let query = "";

  onSnapshot(
    collection(db, "customTrips"),
    (snap) => {
      all = snap.docs.map((d) => normalize({ id: d.id, ...d.data() }));
      setNavBadge("personalizadas", all.filter((t) => !t.lido).length);
      renderTabs();
      renderList();
    },
    (err) => {
      console.error("[personalizadas]", err);
      listEl.innerHTML = `<li class="inbox__empty"><i class="fa-solid fa-lock"></i> ${
        err?.code === "permission-denied"
          ? 'Sem permissão no Firestore. Publique a regra da coleção "customTrips".'
          : "Não foi possível carregar os pedidos."
      }</li>`;
    },
  );

  /* ─────────────────────────────────────────
     LISTA
     ───────────────────────────────────────── */
  function visible() {
    const q = searchable(query).trim();
    return all
      .filter((t) => tab === "todos" || t.status === tab)
      .filter((t) => !q || t.search.includes(q))
      .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
  }

  function renderTabs() {
    if (!tabsEl) return;
    tabsEl.innerHTML = TABS.map((t) => {
      const n = t.key === "todos" ? all.length : all.filter((x) => x.status === t.key).length;
      return `
        <button type="button" class="filter-chip${tab === t.key ? " is-active" : ""}" data-tab="${t.key}" ${t.hint ? `title="${esc(t.hint)}"` : ""}>
          <i class="fa-solid ${t.icon}"></i> ${t.label} <span class="filter-chip__count">${n}</span>
        </button>`;
    }).join("");
  }

  const summary = (t) =>
    [t.destino || "Destino por definir", t.pessoas ? `${t.pessoas} pessoa${t.pessoas === 1 ? "" : "s"}` : "", t.quando]
      .filter(Boolean)
      .join(" · ");

  function renderList() {
    const rows = visible();
    if (!rows.length) {
      const empty = !all.length
        ? "Ainda sem pedidos de viagens personalizadas."
        : query
          ? "Nenhum pedido corresponde à pesquisa."
          : tab === "Novo"
            ? "Tudo tratado! Não há pedidos novos."
            : "Sem pedidos neste estado.";
      listEl.innerHTML = `<li class="inbox__empty"><i class="fa-regular fa-map"></i> ${empty}</li>`;
      return;
    }
    listEl.innerHTML = rows
      .map(
        (t) => `
        <li>
          <button type="button" class="inbox-item${t.lido ? "" : " is-unread"}" data-id="${esc(t.id)}">
            <span class="inbox-item__avatar" aria-hidden="true"><i class="fa-solid fa-route"></i></span>
            <span class="inbox-item__body">
              <span class="inbox-item__top">
                <strong class="inbox-item__name">${esc(t.nome)}</strong>
                <time class="inbox-item__time" title="${esc(formatDate(t.criadoEm, true))}">${esc(timeAgo(t.criadoEm))}</time>
              </span>
              <span class="inbox-item__subject">${esc(summary(t))}</span>
              <span class="inbox-item__snippet">${esc(t.telefone)}${t.notas ? " · " + esc(t.notas.slice(0, 100)) : ""}</span>
            </span>
            ${t.status !== "Novo" ? `<span class="status-badge status-badge--${slugClass(t.status)}">${esc(t.status)}</span>` : ""}
          </button>
        </li>`,
      )
      .join("");
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
  listEl.addEventListener("click", (e) => {
    const item = e.target.closest(".inbox-item");
    if (item) openDetail(item.dataset.id);
  });

  /* ─────────────────────────────────────────
     DETALHE
     ───────────────────────────────────────── */
  async function update(id, data, okMsg) {
    try {
      await updateDoc(doc(db, "customTrips", id), { ...data, atualizadoEm: serverTimestamp() });
      if (okMsg) toast(okMsg);
      return true;
    } catch (err) {
      console.error("[personalizadas]", err);
      toast(err?.code === "permission-denied" ? "Sem permissão para alterar." : "Não foi possível guardar.", "error");
      return false;
    }
  }

  function openDetail(id) {
    const t = all.find((x) => x.id === id);
    if (!t) return;
    const canEdit = getPerms().canManageReservations;
    const isSuper = getRole() === "Super Admin";
    if (canEdit && !t.lido) update(id, { lido: true });

    const primeiro = t.nome.split(" ")[0];
    const wpp = waLink(
      t.telefone,
      `Olá ${primeiro}! Obrigado pelo seu pedido de viagem personalizada${t.destino ? ` para ${t.destino}` : ""} com O Mochilão. `,
    );
    const hist = t.historico
      .slice(-5)
      .reverse()
      .map((h) => `<li>${esc(h.para)} · ${esc(h.por || "")} · ${esc(formatDate(toDate(h.em), true))}</li>`)
      .join("");

    const html = `
      <div class="msg-detail ct-detail">
        <div class="msg-detail__head">
          <span class="inbox-item__avatar inbox-item__avatar--lg"><i class="fa-solid fa-route"></i></span>
          <div>
            <p class="detail-block__name">${esc(t.nome)}</p>
            <p class="cell-sub">${esc(t.telefone || "sem telefone")}</p>
            ${t.email ? `<p class="cell-sub"><a href="mailto:${esc(t.email)}">${esc(t.email)}</a></p>` : ""}
            <p class="cell-sub">Pedido ${esc(formatDate(t.criadoEm, true))}</p>
          </div>
        </div>

        <dl class="ct-facts">
          <div><dt>Destino</dt><dd>${esc(t.destino || "Por definir")}</dd></div>
          <div><dt>Pessoas</dt><dd>${t.pessoas || "–"}</dd></div>
          <div><dt>Quando</dt><dd>${esc(t.quando || "–")}</dd></div>
          ${t.duracao ? `<div><dt>Duração</dt><dd>${esc(t.duracao)}</dd></div>` : ""}
          ${t.tipo ? `<div><dt>Grupo</dt><dd>${esc(t.tipo)}</dd></div>` : ""}
          ${t.alojamento ? `<div><dt>Alojamento</dt><dd>${esc(t.alojamento)}</dd></div>` : ""}
          ${t.orcamento ? `<div><dt>Orçamento / pessoa</dt><dd>${esc(t.orcamento)}</dd></div>` : ""}
          ${
            t.interesses.length
              ? `<div class="ct-facts__wide"><dt>Interesses</dt><dd class="ct-tags">${t.interesses
                  .map((i) => `<span>${esc(i)}</span>`)
                  .join("")}</dd></div>`
              : ""
          }
          <div><dt>Estado</dt><dd><span class="status-badge status-badge--${slugClass(t.status)}">${esc(t.status)}</span></dd></div>
        </dl>

        ${
          t.mensagem
            ? `<div class="ct-message"><p class="detail-block__title">Mensagem do cliente</p><p>${esc(t.mensagem).replace(/\n/g, "<br>")}</p></div>`
            : ""
        }

        <div class="detail-actions">
          ${wpp ? `<a href="${esc(wpp)}" target="_blank" rel="noopener" class="btn btn--sm btn--wpp"><i class="fa-brands fa-whatsapp"></i> Falar no WhatsApp</a>` : ""}
        </div>

        ${
          canEdit
            ? `<div class="ct-status" role="group" aria-label="Mudar estado">
                ${STATUSES.map(
                  (s) => `<button type="button" class="filter-chip${s.key === t.status ? " is-active" : ""}" data-set="${s.key}" title="${esc(s.hint)}">
                    <i class="fa-solid ${s.icon}"></i> ${s.key}</button>`,
                ).join("")}
              </div>
              <div class="field">
                <label for="ctNotes">Notas internas <small>(só a equipa vê)</small></label>
                <textarea id="ctNotes" rows="4" maxlength="2000" placeholder="Ex: Proposta enviada a 12/11 — 3 dias em Malanje, 4 pessoas, 380.000 Kz.">${esc(t.notas)}</textarea>
                <button type="button" class="btn btn--primary btn--sm ct-save" data-notes>Guardar notas</button>
              </div>`
            : t.notas
              ? `<div class="msg-detail__text">${esc(t.notas).replace(/\n/g, "<br>")}</div>`
              : ""
        }
        ${hist ? `<div class="ct-history"><p class="detail-block__title">Histórico</p><ul>${hist}</ul></div>` : ""}
        ${isSuper ? `<div class="detail-danger"><button type="button" class="btn-link-danger" data-delete><i class="fa-regular fa-trash-can"></i> Eliminar pedido</button></div>` : ""}
      </div>`;

    openModal("Viagem personalizada", html);

    const body = document.querySelector(".ct-detail");
    body?.addEventListener("click", async (e) => {
      const set = e.target.closest("[data-set]");
      if (set && set.dataset.set !== t.status) {
        const para = set.dataset.set;
        const ok = await update(
          id,
          {
            status: para,
            lido: true,
            historico: arrayUnion({ de: t.status, para, por: getUser()?.email || "", em: new Date().toISOString() }),
          },
          `Pedido: ${para.toLowerCase()}.`,
        );
        if (ok) closeModal();
        return;
      }
      if (e.target.closest("[data-notes]")) {
        const notas = body.querySelector("#ctNotes").value.trim();
        await update(id, { notas }, "Notas guardadas.");
        return;
      }
      if (e.target.closest("[data-delete]")) {
        if (!confirm(`Eliminar o pedido de ${t.nome}?`)) return;
        try {
          await deleteDoc(doc(db, "customTrips", id));
          closeModal();
          toast("Pedido eliminado.");
        } catch (err) {
          console.error("[personalizadas]", err);
          toast("Sem permissão para eliminar.", "error");
        }
      }
    });
  }

  return { openDetail };
}
