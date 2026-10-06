/* =====================================================
   O MOCHILÃO — services-admin.js  (ES module)
   Ecrã "Serviços" do painel admin:
   adicionar, editar, eliminar, reordenar e
   mostrar/esconder os cards da secção "Serviços".

   Dados: coleção "services" (ver services-store.js)
   ===================================================== */

import {
  collection,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import {
  SERVICES_COLLECTION,
  DESC_MAX,
  slugify,
  saveService,
  deleteService,
  reorderServices,
  setServiceActive,
  importDefaultServices,
} from "./services-store.js";
import { SERVICE_ICONS, DEFAULT_ICON, serviceIconSVG } from "./services-icons.js";

const $ = (id) => document.getElementById(id);

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function errorMessage(err) {
  const map = {
    "services/invalid": err?.message,
    "permission-denied":
      'Sem permissão no Firestore. Confirme a regra da coleção "services".',
    unavailable: "Sem ligação ao Firebase. Verifique a internet.",
    "resource-exhausted": "A quota diária gratuita do Firestore foi atingida.",
  };
  return map[err?.code] || err?.message || "Operação não concluída.";
}

export function initServicesAdmin({ db, canEdit = false }) {
  const grid = $("serviceAdminGrid");
  const form = $("serviceForm");
  if (!grid || !form) return;

  const addBtn = $("addServiceBtn");
  const els = {
    id: $("serviceId"),
    title: $("serviceFormTitle"),
    name: $("serviceName"),
    desc: $("serviceDesc"),
    count: $("serviceDescCount"),
    slug: $("serviceSlug"),
    link: $("serviceLink"),
    active: $("serviceActive"),
    picker: $("serviceIconPicker"),
    pIcon: $("servicePreviewIcon"),
    pName: $("servicePreviewName"),
    pDesc: $("servicePreviewDesc"),
    save: $("saveServiceBtn"),
  };

  let services = [];
  let busy = false;
  let slugTouched = false; // o admin editou o slug à mão?

  if (addBtn) addBtn.hidden = !canEdit;

  /* ── Seletor de ícones ── */
  els.picker.innerHTML = Object.entries(SERVICE_ICONS)
    .map(
      ([key, icon]) => `
      <label class="svc-icon-picker__opt" title="${esc(icon.label)}">
        <input type="radio" name="serviceIcon" value="${key}" class="visually-hidden">
        ${serviceIconSVG(key)}
        <span class="visually-hidden">${esc(icon.label)}</span>
      </label>`,
    )
    .join("");

  const selectedIcon = () =>
    form.querySelector('input[name="serviceIcon"]:checked')?.value || DEFAULT_ICON;

  function selectIcon(key) {
    const input = form.querySelector(`input[name="serviceIcon"][value="${key}"]`) ||
      form.querySelector(`input[name="serviceIcon"][value="${DEFAULT_ICON}"]`);
    if (input) input.checked = true;
    updatePreview();
  }

  /* ─────────────────────────────────────────
     LISTA (tempo real)
     ───────────────────────────────────────── */
  onSnapshot(
    collection(db, SERVICES_COLLECTION),
    (snap) => {
      services = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999));
      render();
    },
    (err) => {
      console.error("[serviços] Erro a ler a coleção:", err);
      grid.innerHTML = `<p class="team-admin__empty">Não foi possível carregar os serviços: ${esc(errorMessage(err))}</p>`;
    },
  );

  function render() {
    if (!services.length) {
      grid.innerHTML = `
        <div class="team-admin__empty">
          <i class="fa-solid fa-bell-concierge"></i>
          <p><strong>Ainda não há serviços no Firestore.</strong><br>
          O site está a mostrar os 4 cards escritos no HTML (Transfer, Hotéis, Aluguer de Autocarro e City Tour Tuk-Tuk).
          Assim que adicionar o primeiro serviço, o site passa a mostrar só os serviços desta lista.</p>
          ${
            canEdit
              ? `<button type="button" class="btn btn--primary btn--sm" data-action="import">
                   <i class="fa-solid fa-file-import"></i> Importar os serviços atuais do site
                 </button>`
              : ""
          }
        </div>`;
      return;
    }

    const last = services.length - 1;
    grid.innerHTML = services
      .map((s, i) => {
        const hidden = s.ativo === false;
        return `
        <article class="svc-admin-card${hidden ? " is-hidden" : ""}" data-id="${esc(s.id)}">
          <span class="team-admin-card__pos">${i + 1}</span>
          ${hidden ? `<span class="team-admin-card__badge">Escondido</span>` : ""}
          <span class="svc-admin-card__icon">${serviceIconSVG(s.icone)}</span>
          <strong class="svc-admin-card__title">${esc(s.nome)}</strong>
          <p class="svc-admin-card__desc">${esc(s.descricao)}</p>
          <code class="svc-admin-card__link">${esc(s.link || `servico.html?s=${s.slug}`)}</code>
          ${
            canEdit
              ? `<div class="team-admin-card__actions svc-admin-card__actions">
                  <button type="button" class="team-admin-card__btn" data-action="left" ${i === 0 ? "disabled" : ""} title="Mover para a esquerda" aria-label="Mover para a esquerda">
                    <i class="fa-solid fa-arrow-left"></i>
                  </button>
                  <button type="button" class="team-admin-card__btn" data-action="right" ${i === last ? "disabled" : ""} title="Mover para a direita" aria-label="Mover para a direita">
                    <i class="fa-solid fa-arrow-right"></i>
                  </button>
                  <button type="button" class="team-admin-card__btn" data-action="toggle" title="${hidden ? "Mostrar no site" : "Esconder do site"}" aria-label="${hidden ? "Mostrar no site" : "Esconder do site"}">
                    <i class="fa-solid ${hidden ? "fa-eye" : "fa-eye-slash"}"></i>
                  </button>
                  <button type="button" class="team-admin-card__btn" data-action="edit" title="Editar" aria-label="Editar">
                    <i class="fa-solid fa-pen"></i>
                  </button>
                  <button type="button" class="team-admin-card__btn team-admin-card__btn--danger" data-action="delete" title="Eliminar" aria-label="Eliminar">
                    <i class="fa-regular fa-trash-can"></i>
                  </button>
                </div>`
              : ""
          }
        </article>`;
      })
      .join("");
  }

  /* ─────────────────────────────────────────
     AÇÕES NOS CARDS
     ───────────────────────────────────────── */
  async function run(task) {
    busy = true;
    grid.classList.add("is-busy");
    try {
      await task();
    } catch (err) {
      console.error("[serviços]", err);
      alert("Erro: " + errorMessage(err));
    } finally {
      busy = false;
      grid.classList.remove("is-busy");
    }
  }

  grid.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn || busy || !canEdit) return;
    const action = btn.dataset.action;

    if (action === "import") {
      btn.disabled = true;
      btn.textContent = "A importar...";
      return run(() => importDefaultServices(db));
    }

    const id = btn.closest(".svc-admin-card")?.dataset.id;
    const index = services.findIndex((s) => s.id === id);
    const service = services[index];
    if (!service) return;

    if (action === "edit") return openForm(service);

    await run(async () => {
      if (action === "left" || action === "right") {
        const target = action === "left" ? index - 1 : index + 1;
        const ids = services.map((s) => s.id);
        [ids[index], ids[target]] = [ids[target], ids[index]];
        await reorderServices(db, ids);
      } else if (action === "toggle") {
        await setServiceActive(db, id, service.ativo === false);
      } else if (action === "delete") {
        if (!confirm(`Eliminar o serviço "${service.nome}" do site?`)) return;
        await deleteService(db, id);
        const rest = services.filter((s) => s.id !== id).map((s) => s.id);
        if (rest.length) await reorderServices(db, rest);
      }
    });
  });

  /* ─────────────────────────────────────────
     FORMULÁRIO
     ───────────────────────────────────────── */
  function updatePreview() {
    els.pIcon.innerHTML = serviceIconSVG(selectedIcon());
    els.pName.textContent = els.name.value.trim() || "Nome do serviço";
    els.pDesc.textContent = els.desc.value.trim() || "Descrição curta do serviço.";
    els.count.textContent = `${els.desc.value.length}/${DESC_MAX}`;
  }

  function openForm(service = null) {
    form.reset();
    els.id.value = service?.id || "";
    els.title.textContent = service ? "Editar Serviço" : "Novo Serviço";
    els.name.value = service?.nome || "";
    els.desc.value = service?.descricao || "";
    els.slug.value = service?.slug || "";
    els.link.value = service?.link || "";
    els.active.checked = service ? service.ativo !== false : true;
    slugTouched = Boolean(service); // ao editar, não mexer no endereço sozinho
    selectIcon(service?.icone || DEFAULT_ICON);
    form.classList.add("is-open");
    els.name.focus();
  }

  function closeForm() {
    form.classList.remove("is-open");
  }

  addBtn?.addEventListener("click", () => openForm());
  form.querySelectorAll(".drawer-cancel-action").forEach((b) => b.addEventListener("click", closeForm));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && form.classList.contains("is-open")) closeForm();
  });

  els.name.addEventListener("input", () => {
    if (!slugTouched) els.slug.value = slugify(els.name.value);
    updatePreview();
  });
  els.slug.addEventListener("input", () => {
    slugTouched = true;
  });
  els.slug.addEventListener("blur", () => {
    els.slug.value = slugify(els.slug.value);
  });
  els.desc.addEventListener("input", updatePreview);
  els.picker.addEventListener("change", updatePreview);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy || !canEdit) return;

    const original = els.save.innerHTML;
    els.save.disabled = true;
    els.save.textContent = "A guardar...";
    busy = true;

    try {
      await saveService(db, {
        id: els.id.value,
        data: {
          nome: els.name.value,
          descricao: els.desc.value,
          slug: els.slug.value || els.name.value,
          icone: selectedIcon(),
          link: els.link.value,
          ativo: els.active.checked,
        },
      });
      closeForm();
    } catch (err) {
      console.error("[serviços] Erro ao salvar:", err);
      alert("Erro ao salvar serviço:\n" + errorMessage(err));
    } finally {
      busy = false;
      els.save.disabled = false;
      els.save.innerHTML = original;
    }
  });
}