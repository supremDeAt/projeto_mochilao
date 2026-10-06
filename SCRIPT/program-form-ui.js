/* =====================================================
   O MOCHILÃO — program-form-ui.js  (ES module)
   Lógica de UI do formulário completo de Programas
   (admin.html → #programForm)

   • Inclui / Não inclui  → linhas <input> + 🗑️
   • Roteiro              → cards { dia, titulo, descricao } + 🗑️
   • Capa                 → pré-visualização local
   • Galeria              → miniaturas (existentes + novas), remover
   • Reset                → qualquer form.reset() limpa tudo
   • Getters              → dados prontos para o Passo 3 (Firebase)

   Não faz uploads nem escreve no Firestore (isso é o Passo 3).
   ===================================================== */

/* ─────────────────────────────────────────
   CONFIG
   ───────────────────────────────────────── */
const MAX_IMAGE_MB = 8;
const MAX_GALLERY = 24;

/* ─────────────────────────────────────────
   ESTADO
   ───────────────────────────────────────── */
let els = null;
let keySeq = 0;

const state = {
  coverFile: null, // File novo da capa (ou null)
  coverObjectUrl: null, // URL temporário da pré-visualização
  gallery: [], // [{ key, kind: "existing"|"new", url, path?, file? }]
  removedGallery: [], // [{ url, path }] existentes marcados para apagar
};

const $ = (id) => document.getElementById(id);

/* ─────────────────────────────────────────
   INIT
   ───────────────────────────────────────── */
export function initProgramFormUI() {
  const form = $("programForm");
  if (!form || els) return; // já iniciado

  els = {
    form,
    includeList: $("progIncludeList"),
    excludeList: $("progExcludeList"),
    itinerary: $("progItineraryList"),
    addDayBtn: $("addItineraryDayBtn"),
    coverInput: $("progImage"),
    coverPreview: $("progCoverPreview"),
    galleryInput: $("progGallery"),
    galleryPreview: $("progGalleryPreview"),
    galleryCount: $("progGalleryCount"),
    tplItem: $("tplListItem"),
    tplDay: $("tplItineraryDay"),
    tplGallery: $("tplGalleryItem"),
    navLinks: form.querySelectorAll(".program-form__nav-link"),
  };
  els.coverPlaceholder = els.coverPreview ? els.coverPreview.innerHTML : "";

  /* Botões "Adicionar Item" (Inclui / Não inclui) */
  form.querySelectorAll(".dyn-add[data-target]").forEach((btn) => {
    btn.addEventListener("click", () => addListItem($(btn.dataset.target)));
  });

  /* Botão "Adicionar Dia" */
  els.addDayBtn?.addEventListener("click", () => addItineraryDay());

  /* Remover (delegação: funciona para linhas criadas depois) */
  form.addEventListener("click", (e) => {
    const rmItem = e.target.closest(".dyn-item__remove");
    if (rmItem) return removeListItem(rmItem.closest(".dyn-item"));

    const rmDay = e.target.closest(".day-card__remove");
    if (rmDay) return removeItineraryDay(rmDay.closest(".day-card"));

    const rmImg = e.target.closest(".gallery-manager__remove");
    if (rmImg) return removeGalleryItem(rmImg.closest(".gallery-manager__item"));
  });

  /* Teclado: Enter numa linha da lista cria a seguinte
     e nunca submete o formulário a partir dos campos dinâmicos */
  form.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const t = e.target;

    if (t.classList.contains("dyn-item__input")) {
      e.preventDefault();
      if (t.value.trim()) {
        const li = t.closest(".dyn-item");
        addListItem(li.parentElement, "", { after: li });
      }
      return;
    }
    if (t.tagName === "INPUT" && t.classList.contains("day-card__input")) {
      e.preventDefault();
    }
  });

  /* Limpa o erro de um campo assim que é corrigido */
  form.addEventListener("input", (e) => {
    if (e.target.classList?.contains("is-invalid") && e.target.value.trim()) {
      e.target.classList.remove("is-invalid");
    }
  });

  /* Capa */
  els.coverInput?.addEventListener("change", handleCoverChange);

  /* Galeria */
  els.galleryInput?.addEventListener("change", () => {
    handleGalleryFiles(els.galleryInput.files);
    els.galleryInput.value = ""; // permite escolher o mesmo ficheiro de novo
  });

  /* Qualquer form.reset() (ex: botão "Adicionar Novo") limpa tudo */
  form.addEventListener("reset", clearDynamicState);

  /* Navegação por secções dentro do drawer */
  setupSectionNav();

  renderGallery();
}

/* ─────────────────────────────────────────
   LISTAS: INCLUI / NÃO INCLUI
   ───────────────────────────────────────── */
export function addListItem(listEl, value = "", opts = {}) {
  if (!listEl || !els?.tplItem) return null;
  const { focus = true, after = null } = opts;

  const li = els.tplItem.content.firstElementChild.cloneNode(true);
  const input = li.querySelector(".dyn-item__input");
  input.value = value;

  if (after && after.parentElement === listEl) after.after(li);
  else listEl.appendChild(li);

  if (focus) input.focus();
  return li;
}

function removeListItem(li) {
  if (!li) return;
  const list = li.parentElement;
  const prev = li.previousElementSibling || li.nextElementSibling;
  li.remove();

  // Mantém o foco num sítio lógico (acessibilidade de teclado)
  const focusTarget =
    prev?.querySelector(".dyn-item__input") ||
    list?.closest(".dyn-list")?.querySelector(".dyn-add");
  focusTarget?.focus();
}

export function getListValues(listEl) {
  if (!listEl) return [];
  return Array.from(listEl.querySelectorAll(".dyn-item__input"))
    .map((input) => input.value.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

/* ─────────────────────────────────────────
   ROTEIRO (ITINERÁRIO)
   ───────────────────────────────────────── */
export function addItineraryDay(data = {}, opts = {}) {
  if (!els?.itinerary || !els.tplDay) return null;
  const { focus = true } = opts;

  const li = els.tplDay.content.firstElementChild.cloneNode(true);
  const count = els.itinerary.children.length;

  const dia = li.querySelector(".day-card__dia");
  const titulo = li.querySelector(".day-card__titulo");
  const descricao = li.querySelector(".day-card__descricao");

  // Dia novo vem pré-preenchido com "Dia N"
  dia.value = data.dia ?? `Dia ${count + 1}`;
  titulo.value = data.titulo ?? "";
  descricao.value = data.descricao ?? "";

  els.itinerary.appendChild(li);

  if (focus) {
    titulo.focus();
    li.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  return li;
}

function removeItineraryDay(card) {
  if (!card) return;
  const hasContent =
    card.querySelector(".day-card__titulo").value.trim() ||
    card.querySelector(".day-card__descricao").value.trim();

  if (hasContent && !confirm("Remover este dia do roteiro?")) return;

  card.remove();
  els.addDayBtn?.focus();
}

export function getItinerary() {
  if (!els?.itinerary) return [];
  return Array.from(els.itinerary.querySelectorAll(".day-card"))
    .map((card) => ({
      dia: card.querySelector(".day-card__dia").value.trim(),
      titulo: card.querySelector(".day-card__titulo").value.trim(),
      descricao: card.querySelector(".day-card__descricao").value.trim(),
    }))
    .filter((d) => d.dia || d.titulo || d.descricao); // ignora blocos vazios
}

/* ─────────────────────────────────────────
   CAPA
   ───────────────────────────────────────── */
function isValidImage(file) {
  if (!file.type.startsWith("image/")) return `"${file.name}" não é uma imagem.`;
  if (file.size > MAX_IMAGE_MB * 1024 * 1024)
    return `"${file.name}" tem mais de ${MAX_IMAGE_MB} MB.`;
  return "";
}

function handleCoverChange() {
  const file = els.coverInput.files?.[0];
  if (!file) return;

  const error = isValidImage(file);
  if (error) {
    alert(error);
    els.coverInput.value = "";
    return;
  }

  state.coverFile = file;
  if (state.coverObjectUrl) URL.revokeObjectURL(state.coverObjectUrl);
  state.coverObjectUrl = URL.createObjectURL(file);
  setCoverPreview(state.coverObjectUrl);
}

export function setCoverPreview(url) {
  if (!els?.coverPreview) return;
  if (!url) {
    els.coverPreview.innerHTML = els.coverPlaceholder;
    return;
  }
  const img = document.createElement("img");
  img.src = url;
  img.alt = "Pré-visualização da capa";
  els.coverPreview.replaceChildren(img);
}

export function getCoverFile() {
  return state.coverFile;
}

/* ─────────────────────────────────────────
   GALERIA
   ───────────────────────────────────────── */
function handleGalleryFiles(fileList) {
  const files = Array.from(fileList || []);
  const errors = [];

  for (const file of files) {
    if (state.gallery.length >= MAX_GALLERY) {
      errors.push(`Limite de ${MAX_GALLERY} fotos na galeria atingido.`);
      break;
    }
    const error = isValidImage(file);
    if (error) {
      errors.push(error);
      continue;
    }
    state.gallery.push({
      key: `g${++keySeq}`,
      kind: "new",
      file,
      url: URL.createObjectURL(file),
    });
  }

  if (errors.length) alert(errors.join("\n"));
  renderGallery();
}

function removeGalleryItem(li) {
  const key = li?.dataset.key;
  const idx = state.gallery.findIndex((g) => g.key === key);
  if (idx === -1) return;

  const [item] = state.gallery.splice(idx, 1);
  if (item.kind === "new") {
    URL.revokeObjectURL(item.url);
  } else {
    // Só é apagado do Storage quando o programa for gravado (Passo 3)
    state.removedGallery.push({ url: item.url, path: item.path || "" });
  }
  renderGallery();
}

function renderGallery() {
  if (!els?.galleryPreview || !els.tplGallery) return;

  const frag = document.createDocumentFragment();
  state.gallery.forEach((item, i) => {
    const li = els.tplGallery.content.firstElementChild.cloneNode(true);
    li.dataset.key = item.key;
    li.classList.toggle("gallery-manager__item--new", item.kind === "new");
    const img = li.querySelector(".gallery-manager__img");
    img.src = item.url;
    img.alt = `Foto ${i + 1} da galeria`;
    img.loading = "lazy";
    frag.appendChild(li);
  });
  els.galleryPreview.replaceChildren(frag);

  if (els.galleryCount) {
    const n = state.gallery.length;
    els.galleryCount.textContent = `${n} foto${n === 1 ? "" : "s"}`;
  }
}

/**
 * Para o Passo 3:
 *  keep     → [{url, path}] fotos já guardadas que continuam
 *  toUpload → [File]        fotos novas a enviar para o Storage
 *  toDelete → [{url, path}] fotos removidas a apagar do Storage
 */
export function getGalleryChanges() {
  return {
    keep: state.gallery
      .filter((g) => g.kind === "existing")
      .map(({ url, path }) => ({ url, path: path || "" })),
    toUpload: state.gallery.filter((g) => g.kind === "new").map((g) => g.file),
    toDelete: [...state.removedGallery],
  };
}

/* ─────────────────────────────────────────
   RESET / POPULAR (edição)
   ───────────────────────────────────────── */
function clearDynamicState() {
  if (!els) return;

  els.includeList?.replaceChildren();
  els.excludeList?.replaceChildren();
  els.itinerary?.replaceChildren();

  // Liberta a memória dos URLs temporários
  if (state.coverObjectUrl) URL.revokeObjectURL(state.coverObjectUrl);
  state.gallery
    .filter((g) => g.kind === "new")
    .forEach((g) => URL.revokeObjectURL(g.url));

  state.coverFile = null;
  state.coverObjectUrl = null;
  state.gallery = [];
  state.removedGallery = [];

  setCoverPreview("");
  renderGallery();

  els.form
    .querySelectorAll(".is-invalid")
    .forEach((el) => el.classList.remove("is-invalid"));
  els.form.scrollTop = 0;
}

/** Limpa o formulário inteiro (campos normais + dinâmicos). */
export function resetProgramForm() {
  if (!els) initProgramFormUI();
  els.form.reset(); // dispara o evento "reset" → clearDynamicState()
  $("programId").value = "";
}

/** Preenche o formulário com um documento da colecção "programs". */
export function populateProgramForm(program = {}) {
  resetProgramForm();

  const set = (id, value) => {
    const el = $(id);
    if (el) el.value = value ?? "";
  };

  set("programId", program.id);
  set("progName", program.nome);
  set("progSlogan", program.slogan);
  set("progDuration", program.duracao);
  set("progPrice", program.preco);
  set("progStartPoint", program.pontoPartida);
  set("progDesc", program.descricao);

  // Categoria que não exista no <select> é acrescentada (não se perde)
  const cat = $("progCategory");
  if (cat && program.categoria) {
    if (![...cat.options].some((o) => o.value === program.categoria)) {
      cat.add(new Option(program.categoria, program.categoria));
    }
    cat.value = program.categoria;
  }

  (program.inclui || []).forEach((v) =>
    addListItem(els.includeList, v, { focus: false }),
  );
  (program.naoInclui || []).forEach((v) =>
    addListItem(els.excludeList, v, { focus: false }),
  );

  // Compatível com o formato antigo "itinerario: [{dia, titulo, texto}]"
  const roteiro = program.roteiro?.length
    ? program.roteiro
    : (program.itinerario || []).map((d) => ({
        dia: d.dia,
        titulo: d.titulo,
        descricao: d.descricao ?? d.texto,
      }));
  roteiro.forEach((d) => addItineraryDay(d, { focus: false }));

  setCoverPreview(program.imagemURL || "");

  state.gallery = (program.galeria || [])
    .filter((g) => g && g.url)
    .map((g) => ({
      key: `g${++keySeq}`,
      kind: "existing",
      url: g.url,
      path: g.path || "",
    }));
  renderGallery();
}

/* ─────────────────────────────────────────
   LEITURA + VALIDAÇÃO (usado no Passo 3)
   ───────────────────────────────────────── */
export function getProgramFormData() {
  const val = (id) => ($(id)?.value || "").trim();
  return {
    nome: val("progName"),
    slogan: val("progSlogan"),
    categoria: val("progCategory"),
    duracao: val("progDuration"),
    preco: val("progPrice"),
    pontoPartida: val("progStartPoint"),
    descricao: val("progDesc"),
    inclui: getListValues(els.includeList),
    naoInclui: getListValues(els.excludeList),
    roteiro: getItinerary(),
  };
}

/**
 * Valida o formulário, marca os campos com erro e faz scroll até ao 1.º.
 * @returns {string[]} lista de erros (vazia = válido)
 */
export function validateProgramForm({ isNew = false } = {}) {
  const errors = [];
  let first = null;

  const mark = (el, msg) => {
    if (!el) return;
    el.classList.add("is-invalid");
    errors.push(msg);
    first = first || el;
  };

  [
    ["progName", "Nome do destino"],
    ["progSlogan", "Slogan"],
    ["progDuration", "Duração"],
    ["progPrice", "Preço"],
    ["progStartPoint", "Ponto de partida"],
    ["progDesc", "Descrição"],
  ].forEach(([id, label]) => {
    const el = $(id);
    if (el && !el.value.trim()) mark(el, `${label} é obrigatório.`);
  });

  if (isNew && !state.coverFile) {
    mark(els.coverInput?.nextElementSibling, "A imagem de capa é obrigatória.");
  }

  // Dias com conteúdo mas sem título
  els.itinerary?.querySelectorAll(".day-card").forEach((card, i) => {
    const titulo = card.querySelector(".day-card__titulo");
    const desc = card.querySelector(".day-card__descricao");
    if (desc.value.trim() && !titulo.value.trim()) {
      mark(titulo, `O dia ${i + 1} do roteiro precisa de um título.`);
    }
  });

  if (first) {
    first.scrollIntoView({ block: "center", behavior: "smooth" });
    if (typeof first.focus === "function") first.focus({ preventScroll: true });
  }
  return errors;
}

/* ─────────────────────────────────────────
   NAVEGAÇÃO POR SECÇÕES (dentro do drawer)
   ───────────────────────────────────────── */
function setupSectionNav() {
  if (!els.navLinks.length) return;

  els.navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault(); // não mexe no #hash da página do admin
      const target = els.form.querySelector(link.getAttribute("href"));
      target?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  });

  if (!("IntersectionObserver" in window)) return;

  const setActive = (id) =>
    els.navLinks.forEach((l) =>
      l.classList.toggle("is-active", l.getAttribute("href") === `#${id}`),
    );

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((en) => en.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActive(visible.target.id);
    },
    { root: els.form, rootMargin: "-160px 0px -55% 0px", threshold: 0 },
  );

  els.form
    .querySelectorAll(".program-form__section")
    .forEach((sec) => observer.observe(sec));
  setActive("progSecBasic");
}