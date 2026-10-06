/* =====================================================
   O MOCHILÃO — team-admin.js  (ES module)
   Ecrã "Equipa do Site" do painel admin:
   adicionar, editar, eliminar, reordenar e
   mostrar/esconder os cards da secção "Conheça a Equipa".

   Dados: coleção "team" (ver team-store.js)
   ===================================================== */

import {
  collection,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import {
  TEAM_COLLECTION,
  saveMember,
  deleteMember,
  reorderTeam,
  setMemberActive,
} from "./team-store.js";

// Equipa que estava escrita no index.html (botão "Importar")
const DEFAULT_TEAM = [
  { nome: "Perpétuo de Assis", cargo: "Fundador & Guia Principal", foto: "../imagens/assis.webp" },
  { nome: "Matias Matis", cargo: "Coordenador de Viagens", foto: "../imagens/matias.webp" },
  { nome: "Funeno Puca", cargo: "Guia & Logística", foto: "../imagens/guia.webp" },
];

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
    "team/invalid": err?.message,
    "image/invalid": err?.message,
    "image/too-large": err?.message,
    "permission-denied":
      'Sem permissão no Firestore. Confirme a regra da coleção "team".',
    unavailable: "Sem ligação ao Firebase. Verifique a internet.",
    "resource-exhausted": "A quota diária gratuita do Firestore foi atingida.",
  };
  return map[err?.code] || err?.message || "Operação não concluída.";
}

/**
 * @param {{db: import("firebase/firestore").Firestore, canEdit: boolean}} opts
 */
export function initTeamAdmin({ db, canEdit = false }) {
  const grid = $("teamAdminGrid");
  const form = $("teamForm");
  if (!grid || !form) return;

  const addBtn = $("addTeamMemberBtn");
  const els = {
    id: $("teamMemberId"),
    title: $("teamFormTitle"),
    name: $("teamName"),
    role: $("teamRole"),
    insta: $("teamInstagram"),
    active: $("teamActive"),
    photo: $("teamPhoto"),
    photoRemove: $("teamPhotoRemove"),
    preview: $("teamPhotoPreview"),
    ph: $("teamPhotoPh"),
    pName: $("teamPreviewName"),
    pRole: $("teamPreviewRole"),
    save: $("saveTeamBtn"),
  };

  let members = [];
  let busy = false;
  let photoFile = null; // nova foto escolhida
  let removePhoto = false; // apagar a foto atual
  let objectUrl = null;

  if (addBtn) addBtn.hidden = !canEdit;

  /* ─────────────────────────────────────────
     LISTA (tempo real)
     ───────────────────────────────────────── */
  onSnapshot(
    collection(db, TEAM_COLLECTION),
    (snap) => {
      members = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999));
      render();
    },
    (err) => {
      console.error("[equipa] Erro a ler a coleção:", err);
      grid.innerHTML = `<p class="team-admin__empty">Não foi possível carregar a equipa: ${esc(errorMessage(err))}</p>`;
    },
  );

  function render() {
    if (!members.length) {
      grid.innerHTML = `
        <div class="team-admin__empty">
          <i class="fa-solid fa-people-group"></i>
          <p><strong>Ainda não há membros no Firestore.</strong><br>
          O site está a mostrar os 3 cards escritos no HTML.
          Assim que adicionar o primeiro membro, o site passa a mostrar só os membros desta lista.</p>
          ${
            canEdit
              ? `<button type="button" class="btn btn--primary btn--sm" data-action="import">
                   <i class="fa-solid fa-file-import"></i> Importar a equipa atual do site
                 </button>`
              : ""
          }
        </div>`;
      return;
    }

    const last = members.length - 1;
    grid.innerHTML = members
      .map((m, i) => {
        const hidden = m.ativo === false;
        return `
        <article class="team-admin-card${hidden ? " is-hidden" : ""}" data-id="${esc(m.id)}">
          <div class="team-admin-card__media">
            ${
              m.fotoURL
                ? `<img src="${esc(m.fotoURL)}" alt="" class="team-admin-card__img" loading="lazy">`
                : `<div class="team-admin-card__ph"><i class="fa-solid fa-user"></i></div>`
            }
            <span class="team-admin-card__pos">${i + 1}</span>
            ${hidden ? `<span class="team-admin-card__badge">Escondido</span>` : ""}
            <div class="team-admin-card__overlay">
              <strong class="team-admin-card__name">${esc(m.nome)}</strong>
              <span class="team-admin-card__role">${esc(m.cargo)}</span>
            </div>
          </div>
          ${
            canEdit
              ? `<div class="team-admin-card__actions">
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
  grid.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn || busy || !canEdit) return;
    const action = btn.dataset.action;

    if (action === "import") return importDefaults(btn);

    const id = btn.closest(".team-admin-card")?.dataset.id;
    const index = members.findIndex((m) => m.id === id);
    const member = members[index];
    if (!member) return;

    if (action === "edit") return openForm(member);

    await run(async () => {
      if (action === "left" || action === "right") {
        const target = action === "left" ? index - 1 : index + 1;
        const ids = members.map((m) => m.id);
        [ids[index], ids[target]] = [ids[target], ids[index]];
        await reorderTeam(db, ids);
      } else if (action === "toggle") {
        await setMemberActive(db, id, member.ativo === false);
      } else if (action === "delete") {
        if (!confirm(`Eliminar "${member.nome}" da equipa do site?\nA foto também será apagada.`)) return;
        await deleteMember(db, id);
        // Fecha o "buraco" na numeração
        const rest = members.filter((m) => m.id !== id).map((m) => m.id);
        if (rest.length) await reorderTeam(db, rest);
      }
    });
  });

  async function run(task) {
    busy = true;
    grid.classList.add("is-busy");
    try {
      await task();
    } catch (err) {
      console.error("[equipa]", err);
      alert("Erro: " + errorMessage(err));
    } finally {
      busy = false;
      grid.classList.remove("is-busy");
    }
  }

  async function importDefaults(btn) {
    btn.disabled = true;
    btn.textContent = "A importar...";
    await run(async () => {
      for (let i = 0; i < DEFAULT_TEAM.length; i++) {
        const d = DEFAULT_TEAM[i];
        btn.textContent = `A importar ${i + 1}/${DEFAULT_TEAM.length}...`;
        let file = null;
        try {
          const res = await fetch(d.foto);
          if (res.ok) {
            const blob = await res.blob();
            file = new File([blob], d.foto.split("/").pop(), { type: blob.type });
          }
        } catch {
          /* sem foto: pode ser adicionada depois */
        }
        await saveMember(db, {
          data: { nome: d.nome, cargo: d.cargo, instagram: "", ativo: true, ordem: i },
          photoFile: file,
        });
      }
    });
  }

  /* ─────────────────────────────────────────
     FORMULÁRIO
     ───────────────────────────────────────── */
  function setPreviewImage(src) {
    els.preview.hidden = !src;
    els.ph.hidden = Boolean(src);
    if (src) els.preview.src = src;
    else els.preview.removeAttribute("src");
    els.photoRemove.hidden = !src;
  }

  function updatePreviewText() {
    els.pName.textContent = els.name.value.trim() || "Nome";
    els.pRole.textContent = els.role.value.trim() || "Cargo";
  }

  function clearObjectUrl() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }

  function openForm(member = null) {
    form.reset();
    clearObjectUrl();
    photoFile = null;
    removePhoto = false;

    els.id.value = member?.id || "";
    els.title.textContent = member ? "Editar Membro" : "Novo Membro";
    els.name.value = member?.nome || "";
    els.role.value = member?.cargo || "";
    els.insta.value = member?.instagram || "";
    els.active.checked = member ? member.ativo !== false : true;

    setPreviewImage(member?.fotoURL || "");
    updatePreviewText();
    form.classList.add("is-open");
    els.name.focus();
  }

  function closeForm() {
    form.classList.remove("is-open");
    clearObjectUrl();
  }

  addBtn?.addEventListener("click", () => openForm());
  form.querySelectorAll(".drawer-cancel-action").forEach((b) => b.addEventListener("click", closeForm));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && form.classList.contains("is-open")) closeForm();
  });

  els.name.addEventListener("input", updatePreviewText);
  els.role.addEventListener("input", updatePreviewText);

  els.photo.addEventListener("change", () => {
    const file = els.photo.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Escolha um ficheiro de imagem.");
      els.photo.value = "";
      return;
    }
    clearObjectUrl();
    objectUrl = URL.createObjectURL(file);
    photoFile = file;
    removePhoto = false;
    setPreviewImage(objectUrl);
  });

  els.photoRemove.addEventListener("click", () => {
    clearObjectUrl();
    photoFile = null;
    removePhoto = true;
    els.photo.value = "";
    setPreviewImage("");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy || !canEdit) return;

    const original = els.save.innerHTML;
    els.save.disabled = true;
    els.save.textContent = photoFile ? "A otimizar a foto..." : "A guardar...";
    busy = true;

    try {
      await saveMember(db, {
        id: els.id.value,
        data: {
          nome: els.name.value,
          cargo: els.role.value,
          instagram: els.insta.value,
          ativo: els.active.checked,
        },
        photoFile,
        removePhoto,
      });
      closeForm();
    } catch (err) {
      console.error("[equipa] Erro ao salvar:", err);
      alert("Erro ao salvar membro:\n" + errorMessage(err));
    } finally {
      busy = false;
      els.save.disabled = false;
      els.save.innerHTML = original;
    }
  });
}