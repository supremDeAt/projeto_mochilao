/* =====================================================
   O MOCHILÃO — partners-admin.js  (ES module)
   Ecrã "Parceiros" do painel admin: adicionar, editar,
   eliminar, ordenar e mostrar/esconder os parceiros de
   cada serviço, com várias fotos cada.

   Dados: coleção "partners" (ver partners-store.js)
   ===================================================== */

import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { compressToDataURL } from "./image-store.js";
import { SERVICES_COLLECTION } from "./services-store.js";
import { serviceIconSVG } from "./services-icons.js";
import {
  PARTNERS_COLLECTION,
  DESC_MAX,
  HIGHLIGHTS_MAX,
  PHOTOS_MAX,
  PHOTO_SIZE,
  COVER_SIZE,
  cleanHighlights,
  loadPartnerPhotos,
  savePartner,
  deletePartner,
  reorderPartners,
  setPartnerActive,
} from "./partners-store.js";
import { esc, toast } from "./admin-utils.js";

const $ = (id) => document.getElementById(id);

/* Sugestões de destaques conforme o ícone do serviço */
const SUGGESTIONS = {
  hotel: ["Piscina", "Wi-Fi grátis", "Pequeno-almoço incluído", "Restaurante", "Estacionamento", "Ar condicionado", "Vista mar", "Ginásio"],
  transfer: ["Ar condicionado", "Aeroporto ⇄ hotel", "Motorista bilingue", "Disponível 24h", "Viaturas 4x4", "Cadeirinha para bebé"],
  autocarro: ["Até 50 lugares", "Ar condicionado", "Motorista incluído", "Viagens interprovinciais", "Eventos e empresas"],
  tuktuk: ["Guia local", "Passeio de 2 horas", "Pontos emblemáticos", "Paragens para fotos", "Grupos pequenos"],
};
const DEFAULT_SUGGESTIONS = ["Wi-Fi grátis", "Ar condicionado", "Estacionamento", "Acessível", "Aceita grupos"];

function errorMessage(err) {
  const map = {
    "partners/invalid": err?.message,
    "permission-denied": 'Sem permissão no Firestore. Confirme a regra da coleção "partners".',
    unavailable: "Sem ligação ao Firebase. Verifique a internet.",
    "resource-exhausted": "A quota diária gratuita do Firestore foi atingida.",
  };
  if (err?.code?.startsWith("image/")) return err.message;
  return map[err?.code] || err?.message || "Operação não concluída.";
}

/* dataURL → Blob (para gerar a miniatura de uma foto já guardada) */
async function dataURLtoFile(url) {
  const blob = await (await fetch(url)).blob();
  return new File([blob], "foto", { type: blob.type || "image/webp" });
}

export function initPartnersAdmin({ db, canEdit = false }) {
  const grid = $("partnerAdminGrid");
  const form = $("partnerForm");
  if (!grid || !form) return;

  const filterBar = $("partnerFilter");
  const addBtn = $("addPartnerBtn");
  const els = {
    id: $("partnerId"),
    title: $("partnerFormTitle"),
    service: $("partnerService"),
    name: $("partnerName"),
    loc: $("partnerLoc"),
    desc: $("partnerDesc"),
    count: $("partnerDescCount"),
    tags: $("partnerTags"),
    tagInput: $("partnerTagInput"),
    suggest: $("partnerSuggest"),
    photos: $("partnerPhotos"),
    photoInput: $("partnerPhotoInput"),
    photoHint: $("partnerPhotoHint"),
    active: $("partnerActive"),
    save: $("savePartnerBtn"),
  };

  let services = [];
  let partners = [];
  let filter = "all";
  let busy = false;
  // Estado do formulário
  let tags = [];
  let photos = []; // [{ id?, data, thumb? }]
  let photosLoading = false;

  if (addBtn) addBtn.hidden = !canEdit;
  els.desc.maxLength = DESC_MAX;

  /* ─────────────────────────────────────────
     DADOS EM TEMPO REAL
     ───────────────────────────────────────── */
  onSnapshot(
    collection(db, SERVICES_COLLECTION),
    (snap) => {
      services = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999));
      fillServiceSelect();
      render();
    },
    (err) => console.error("[parceiros] serviços:", err),
  );
  onSnapshot(
    collection(db, PARTNERS_COLLECTION),
    (snap) => {
      partners = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      render();
    },
    (err) => {
      console.error("[parceiros]", err);
      grid.innerHTML = `<p class="team-admin__empty">Não foi possível carregar os parceiros: ${esc(errorMessage(err))}</p>`;
    },
  );

  const serviceOf = (p) => services.find((s) => s.id === p.servico);
  const siblings = (p) =>
    partners.filter((x) => x.servico === p.servico).sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999));

  function fillServiceSelect() {
    const current = els.service.value;
    els.service.innerHTML =
      `<option value="">Escolha o serviço…</option>` +
      services.map((s) => `<option value="${s.id}">${esc(s.nome)}</option>`).join("");
    if (current) els.service.value = current;
  }

  /* ─────────────────────────────────────────
     LISTA
     ───────────────────────────────────────── */
  function render() {
    if (!services.length) {
      filterBar.innerHTML = "";
      grid.innerHTML = `
        <div class="team-admin__empty">
          <i class="fa-solid fa-bell-concierge"></i>
          <p><strong>Ainda não há serviços.</strong><br>
          Os parceiros pertencem a um serviço (Hotéis, Transfer…). Crie ou importe os serviços primeiro no ecrã <a href="#servicos" data-goto-view="servicos">Serviços</a>.</p>
        </div>`;
      return;
    }

    if (filter !== "all" && !services.some((s) => s.id === filter)) filter = "all";
    const count = (id) => partners.filter((p) => p.servico === id).length;
    filterBar.innerHTML =
      `<button type="button" class="pt-chip ${filter === "all" ? "is-active" : ""}" data-filter="all">Todos <span>${partners.length}</span></button>` +
      services
        .map(
          (s) => `<button type="button" class="pt-chip ${filter === s.id ? "is-active" : ""}" data-filter="${s.id}">
            <span class="pt-chip__icon">${serviceIconSVG(s.icone)}</span>${esc(s.nome)} <span>${count(s.id)}</span></button>`,
        )
        .join("");

    // Agrupados por serviço, pela ordem dos serviços
    const groups = services
      .filter((s) => filter === "all" || s.id === filter)
      .map((s) => ({ s, list: siblings({ servico: s.id }) }));
    const orphans = partners.filter((p) => !serviceOf(p));

    const groupHTML = ({ s, list }) => `
      <section class="pt-group">
        <header class="pt-group__head">
          <span class="pt-group__icon">${serviceIconSVG(s.icone)}</span>
          <h3>${esc(s.nome)}</h3>
          <a class="pt-group__link" href="../PAGES/servico.html?s=${encodeURIComponent(s.slug || "")}" target="_blank" rel="noopener">
            Ver página <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
        </header>
        ${
          list.length
            ? `<div class="pt-admin__grid">${list.map((p, i) => cardHTML(p, i, list.length)).join("")}</div>`
            : `<p class="pt-group__empty">Sem parceiros. ${
                canEdit ? `<button type="button" class="btn-link" data-add-for="${s.id}">Adicionar o primeiro</button>` : ""
              }</p>`
        }
      </section>`;

    grid.innerHTML =
      groups.map(groupHTML).join("") +
      (orphans.length && filter === "all"
        ? `<section class="pt-group"><header class="pt-group__head"><h3>Sem serviço</h3></header>
            <p class="pt-group__empty">O serviço destes parceiros foi eliminado. Edite-os para escolher outro.</p>
            <div class="pt-admin__grid">${orphans.map((p, i) => cardHTML(p, i, 1)).join("")}</div></section>`
        : "");
  }

  function cardHTML(p, i, total) {
    const n = Array.isArray(p.fotos) ? p.fotos.length : 0;
    const hidden = p.ativo === false;
    return `
      <article class="pt-card ${hidden ? "is-hidden" : ""}" data-id="${p.id}">
        <div class="pt-card__media">
          ${p.capa ? `<img src="${p.capa}" alt="" loading="lazy" />` : `<i class="fa-regular fa-image"></i>`}
          <span class="pt-card__pos">${i + 1}</span>
          ${hidden ? `<span class="pt-card__badge">Escondido</span>` : ""}
          <span class="pt-card__photos"><i class="fa-regular fa-images"></i> ${n}</span>
        </div>
        <div class="pt-card__body">
          <strong class="pt-card__name">${esc(p.nome)}</strong>
          ${p.localizacao ? `<span class="pt-card__loc"><i class="fa-solid fa-location-dot"></i> ${esc(p.localizacao)}</span>` : ""}
          ${(p.destaques || []).length ? `<span class="pt-card__tags">${p.destaques.slice(0, 3).map(esc).join(" · ")}${p.destaques.length > 3 ? " …" : ""}</span>` : ""}
        </div>
        ${
          canEdit
            ? `<div class="pt-card__actions">
                <button type="button" data-action="up" title="Mover para trás" ${i === 0 ? "disabled" : ""}><i class="fa-solid fa-arrow-left"></i></button>
                <button type="button" data-action="down" title="Mover para a frente" ${i >= total - 1 ? "disabled" : ""}><i class="fa-solid fa-arrow-right"></i></button>
                <button type="button" data-action="toggle" title="${hidden ? "Mostrar no site" : "Esconder do site"}"><i class="fa-regular ${hidden ? "fa-eye" : "fa-eye-slash"}"></i></button>
                <button type="button" data-action="edit" title="Editar"><i class="fa-solid fa-pen"></i></button>
                <button type="button" data-action="delete" class="is-danger" title="Eliminar"><i class="fa-regular fa-trash-can"></i></button>
              </div>`
            : ""
        }
      </article>`;
  }

  filterBar.addEventListener("click", (e) => {
    const b = e.target.closest("[data-filter]");
    if (!b) return;
    filter = b.dataset.filter;
    render();
  });

  async function run(task, okMsg) {
    busy = true;
    grid.classList.add("is-busy");
    try {
      await task();
      if (okMsg) toast(okMsg);
    } catch (err) {
      console.error("[parceiros]", err);
      toast(errorMessage(err), "error");
    } finally {
      busy = false;
      grid.classList.remove("is-busy");
    }
  }

  grid.addEventListener("click", async (e) => {
    const goto = e.target.closest("[data-goto-view]");
    if (goto) {
      e.preventDefault();
      document.querySelector(`.admin-nav__link[data-view="${goto.dataset.gotoView}"]`)?.click();
      return;
    }
    const addFor = e.target.closest("[data-add-for]");
    if (addFor) return openForm(null, addFor.dataset.addFor);

    const btn = e.target.closest("[data-action]");
    if (!btn || busy || !canEdit) return;
    const id = btn.closest(".pt-card")?.dataset.id;
    const p = partners.find((x) => x.id === id);
    if (!p) return;
    const action = btn.dataset.action;

    if (action === "edit") return openForm(p);
    if (action === "toggle") return run(() => setPartnerActive(db, id, p.ativo === false), p.ativo === false ? "Parceiro visível no site." : "Parceiro escondido do site.");
    if (action === "up" || action === "down") {
      const list = siblings(p).map((x) => x.id);
      const i = list.indexOf(id);
      const j = action === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      return run(() => reorderPartners(db, list));
    }
    if (action === "delete") {
      if (!confirm(`Eliminar o parceiro "${p.nome}" e todas as suas fotos?`)) return;
      return run(async () => {
        await deletePartner(db, id);
        const rest = siblings(p).filter((x) => x.id !== id).map((x) => x.id);
        if (rest.length) await reorderPartners(db, rest);
      }, "Parceiro eliminado.");
    }
  });

  /* ─────────────────────────────────────────
     FORMULÁRIO
     ───────────────────────────────────────── */
  function renderTags() {
    els.tags.innerHTML = tags
      .map(
        (t, i) => `<span class="pt-tag">${esc(t)}<button type="button" data-tag-remove="${i}" aria-label="Remover ${esc(t)}"><i class="fa-solid fa-xmark"></i></button></span>`,
      )
      .join("");
    els.tagInput.disabled = tags.length >= HIGHLIGHTS_MAX || !canEdit;
    els.tagInput.placeholder = tags.length >= HIGHLIGHTS_MAX ? `Máximo de ${HIGHLIGHTS_MAX}` : "Escreva e carregue Enter";
    renderSuggestions();
  }

  function renderSuggestions() {
    const s = services.find((x) => x.id === els.service.value);
    const list = (SUGGESTIONS[s?.icone] || DEFAULT_SUGGESTIONS).filter(
      (x) => !tags.some((t) => t.toLowerCase() === x.toLowerCase()),
    );
    els.suggest.innerHTML = list.length && tags.length < HIGHLIGHTS_MAX
      ? `<span>Sugestões:</span>` + list.map((x) => `<button type="button" data-suggest="${esc(x)}">+ ${esc(x)}</button>`).join("")
      : "";
  }

  function addTag(value) {
    const v = String(value || "").replace(/,/g, "").trim();
    if (!v) return;
    tags = cleanHighlights([...tags, v]);
    renderTags();
  }

  function renderPhotos() {
    els.photos.innerHTML =
      photos
        .map(
          (p, i) => `
        <figure class="pt-photo ${i === 0 ? "is-cover" : ""}" data-i="${i}">
          <img src="${p.data}" alt="" />
          ${i === 0 ? `<span class="pt-photo__cover"><i class="fa-solid fa-star"></i> Capa</span>` : ""}
          ${
            canEdit
              ? `<div class="pt-photo__actions">
                  ${i > 0 ? `<button type="button" data-photo="cover" title="Usar como capa"><i class="fa-regular fa-star"></i></button>` : ""}
                  ${i > 0 ? `<button type="button" data-photo="left" title="Mover para trás"><i class="fa-solid fa-arrow-left"></i></button>` : ""}
                  ${i < photos.length - 1 ? `<button type="button" data-photo="right" title="Mover para a frente"><i class="fa-solid fa-arrow-right"></i></button>` : ""}
                  <button type="button" data-photo="remove" class="is-danger" title="Remover"><i class="fa-regular fa-trash-can"></i></button>
                </div>`
              : ""
          }
        </figure>`,
        )
        .join("") +
      (canEdit && photos.length < PHOTOS_MAX
        ? `<label class="pt-photo pt-photo--add" for="partnerPhotoInput">
            <i class="fa-solid fa-plus"></i><span>${photos.length ? "Mais fotos" : "Juntar fotos"}</span>
          </label>`
        : "") +
      (photosLoading ? `<div class="pt-photo pt-photo--loading"><i class="fa-solid fa-spinner fa-spin"></i></div>` : "");
    els.photoHint.textContent = `${photos.length}/${PHOTOS_MAX} fotos · a 1.ª é a capa do card. Horizontais ficam melhor.`;
  }

  async function openForm(partner = null, presetService = "") {
    form.reset();
    fillServiceSelect();
    els.id.value = partner?.id || "";
    els.title.textContent = partner ? "Editar Parceiro" : "Novo Parceiro";
    els.service.value = partner?.servico || presetService || (filter !== "all" ? filter : "");
    els.name.value = partner?.nome || "";
    els.loc.value = partner?.localizacao || "";
    els.desc.value = partner?.descricao || "";
    els.active.checked = partner ? partner.ativo !== false : true;
    tags = [...(partner?.destaques || [])];
    photos = [];
    updateCount();
    renderTags();
    form.classList.add("is-open");
    els.name.focus();

    if (partner) {
      photosLoading = true;
      renderPhotos();
      try {
        const list = await loadPartnerPhotos(db, partner);
        if (els.id.value !== partner.id) return; // entretanto abriu outro
        photos = list.map((x) => ({ id: x.id, data: x.data }));
      } catch (err) {
        toast("Não foi possível carregar as fotos: " + errorMessage(err), "error");
      } finally {
        photosLoading = false;
        renderPhotos();
      }
    } else {
      renderPhotos();
    }
  }

  function closeForm() {
    form.classList.remove("is-open");
  }

  function updateCount() {
    els.count.textContent = `${els.desc.value.length}/${DESC_MAX}`;
  }

  addBtn?.addEventListener("click", () => openForm());
  form.querySelectorAll(".drawer-cancel-action").forEach((b) => b.addEventListener("click", closeForm));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && form.classList.contains("is-open")) closeForm();
  });
  els.desc.addEventListener("input", updateCount);
  els.service.addEventListener("change", renderSuggestions);

  els.tagInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(els.tagInput.value);
      els.tagInput.value = "";
    } else if (e.key === "Backspace" && !els.tagInput.value && tags.length) {
      tags.pop();
      renderTags();
    }
  });
  els.tagInput.addEventListener("blur", () => {
    if (els.tagInput.value.trim()) {
      addTag(els.tagInput.value);
      els.tagInput.value = "";
    }
  });
  els.tags.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tag-remove]");
    if (!b) return;
    tags.splice(Number(b.dataset.tagRemove), 1);
    renderTags();
  });
  els.suggest.addEventListener("click", (e) => {
    const b = e.target.closest("[data-suggest]");
    if (b) addTag(b.dataset.suggest);
  });

  // Fotos: juntar várias de uma vez
  els.photoInput.addEventListener("change", async () => {
    const files = [...(els.photoInput.files || [])];
    els.photoInput.value = "";
    if (!files.length) return;
    const room = PHOTOS_MAX - photos.length;
    if (files.length > room) toast(`Só cabem mais ${room} foto(s). As restantes foram ignoradas.`, "info");
    photosLoading = true;
    renderPhotos();
    for (const file of files.slice(0, room)) {
      try {
        const data = await compressToDataURL(file, PHOTO_SIZE);
        // A miniatura só é precisa se esta foto for (ou passar a ser) a capa
        photos.push({ data, file });
        renderPhotos();
      } catch (err) {
        toast(errorMessage(err), "error");
      }
    }
    photosLoading = false;
    renderPhotos();
  });

  els.photos.addEventListener("click", (e) => {
    const b = e.target.closest("[data-photo]");
    if (!b) return;
    const i = Number(b.closest("[data-i]").dataset.i);
    const action = b.dataset.photo;
    if (action === "remove") photos.splice(i, 1);
    else if (action === "cover") photos.unshift(...photos.splice(i, 1));
    else if (action === "left") [photos[i - 1], photos[i]] = [photos[i], photos[i - 1]];
    else if (action === "right") [photos[i + 1], photos[i]] = [photos[i], photos[i + 1]];
    renderPhotos();
  });

  async function makeThumb(photo) {
    const file = photo.file || (await dataURLtoFile(photo.data));
    return compressToDataURL(file, COVER_SIZE);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy || !canEdit) return;
    if (photosLoading) return toast("Aguarde: as fotos ainda estão a ser preparadas.", "info");
    if (els.tagInput.value.trim()) {
      addTag(els.tagInput.value);
      els.tagInput.value = "";
    }

    const original = els.save.innerHTML;
    els.save.disabled = true;
    els.save.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A guardar…';
    busy = true;
    try {
      await savePartner(db, {
        id: els.id.value,
        data: {
          servico: els.service.value,
          nome: els.name.value,
          localizacao: els.loc.value,
          descricao: els.desc.value,
          destaques: tags,
          ativo: els.active.checked,
          photos, // as fotos novas recebem o id ao gravar → se falhar, tentar de novo não as duplica
        },
        makeThumb,
      });
      toast(els.id.value ? "Parceiro atualizado." : "Parceiro adicionado ao site.");
      closeForm();
    } catch (err) {
      console.error("[parceiros] Erro ao guardar:", err);
      toast(errorMessage(err), "error");
    } finally {
      busy = false;
      els.save.disabled = false;
      els.save.innerHTML = original;
    }
  });
}
