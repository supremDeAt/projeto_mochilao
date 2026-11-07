/* =====================================================
   O MOCHILÃO — program-form-ui.js  (ES module)
   Lógica de UI do formulário completo de Programas
   (admin.html → #programForm)

   • Inclui / Não inclui  → linhas <input> + 🗑️
   • Roteiro              → cards { dia, titulo, descricao } + 🗑️
   • Preços               → escalões { a partir de N pessoas, preço por pessoa }
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
  gallery: [], // [{ key, kind: "existing"|"new", url, publicId?, file? }]
  removedGallery: [], // [{ url, publicId }] existentes marcados para apagar
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
    priceTiers: $("progPriceTiers"),
    tplTier: $("tplPriceTier"),
    addTierBtn: $("addPriceTierBtn"),
    datesList: $("progDatasList"),
    tplDate: $("tplProgDate"),
    addDateBtn: $("addProgDateBtn"),
    navLinks: form.querySelectorAll(".program-form__nav-link"),
  };
  els.coverPlaceholder = els.coverPreview ? els.coverPreview.innerHTML : "";

  /* Botões "Adicionar Item" (Inclui / Não inclui) */
  form.querySelectorAll(".dyn-add[data-target]").forEach((btn) => {
    btn.addEventListener("click", () => addListItem($(btn.dataset.target)));
  });

  /* Botão "Adicionar Dia" */
  els.addDayBtn?.addEventListener("click", () => addItineraryDay());

  /* Botão "Adicionar pacote" (preços) */
  els.addTierBtn?.addEventListener("click", () => addPriceTier());

  /* Botão "Adicionar data" */
  els.addDateBtn?.addEventListener("click", () => addProgDate());

  /* Remover (delegação: funciona para linhas criadas depois) */
  form.addEventListener("click", (e) => {
    const rmItem = e.target.closest(".dyn-item__remove");
    if (rmItem) return removeListItem(rmItem.closest(".dyn-item"));

    const rmDay = e.target.closest(".day-card__remove");
    if (rmDay) return removeItineraryDay(rmDay.closest(".day-card"));

    const rmImg = e.target.closest(".gallery-manager__remove");
    if (rmImg) return removeGalleryItem(rmImg.closest(".gallery-manager__item"));

    const rmDate = e.target.closest(".prog-date__remove");
    if (rmDate) {
      rmDate.closest(".prog-date")?.remove();
      els.addDateBtn?.focus();
      return;
    }

    const rmTier = e.target.closest(".price-tier__remove");
    if (rmTier) {
      rmTier.closest(".price-tier")?.remove();
      els.addTierBtn?.focus();
    }
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
    // Enter numa data → não submete o formulário
    if (t.closest?.(".prog-date")) {
      e.preventDefault();
      return;
    }
    // Enter num preço → novo pacote (nunca submete o formulário)
    if (t.closest?.(".price-tier")) {
      e.preventDefault();
      if (t.classList.contains("price-tier__valor") && t.value.trim()) {
        const row = t.closest(".price-tier");
        if (!row.nextElementSibling && nextFreeTipo()) addPriceTier();
      }
    }
  });

  /* Limpa o erro de um campo assim que é corrigido */
  form.addEventListener("input", (e) => {
    if (e.target.classList?.contains("is-invalid") && e.target.value.trim()) {
      e.target.classList.remove("is-invalid");
    }
  });
  form.addEventListener("change", (e) => {
    if (e.target.classList?.contains("price-tier__tipo")) {
      if (e.target.value) e.target.classList.remove("is-invalid");
      refreshTipoOptions();
    }
  });

  /* Tipos de pacote (Site Web → Pacotes) chegam do Firestore → atualiza as listas */
  window.MochilaoPacotes?.onCatalog(() => refreshTipoOptions());

  /* Preço escrito sem pontos → fica 760.000 ao sair do campo */
  form.addEventListener("focusout", (e) => {
    const v = e.target.closest?.(".price-tier__valor");
    if (v && toNumber(v.value)) v.value = formatKz(toNumber(v.value)).replace(" Kz", "");
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
  if (!els.priceTiers?.children.length) addPriceTier({}, { focus: false });
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
   PACOTES E PREÇOS
   Cada linha: tipo de pacote (Site Web → Pacotes) + preço do pacote.
   Guardados no programa como
     pacotes: [{ tipo: "casal", nome: "Casal", pessoas: 2, valor: 600000 }]
   (o nome e o nº de pessoas vão junto: o programa continua certo
   mesmo que o tipo seja mudado ou apagado mais tarde)
   ───────────────────────────────────────── */
const toNumber = (v) => {
  if (typeof v === "number") return isFinite(v) ? Math.round(v) : 0;
  const d = String(v ?? "").replace(/[^\d]/g, "");
  return d ? parseInt(d, 10) : 0;
};
export const formatKz = (n) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " Kz";

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pessoasLabel = (n) => `${n} ${n === 1 ? "pessoa" : "pessoas"}`;
const catalogTipos = () => window.MochilaoPacotes?.getCatalog().tipos || [];

/** Opções de um <select>: tipos do catálogo + o tipo guardado, se já não existir */
function fillTipoSelect(select, keep = null) {
  const value = keep?.tipo ?? select.value;
  const extra = keep?.tipo ? keep : select._extra || null; // tipo antigo/apagado
  const tipos = catalogTipos();
  // Preço antigo convertido: lembra a que grupo correspondia
  const opts = [`<option value="">${select._antes ? `Era ${esc(select._antes)} → escolha` : "— Escolha o pacote —"}</option>`];
  tipos.forEach((t) =>
    opts.push(
      `<option value="${esc(t.id)}" data-nome="${esc(t.nome)}" data-pessoas="${t.pessoas}">${esc(t.nome)} · ${pessoasLabel(t.pessoas)}</option>`,
    ),
  );
  if (extra && extra.tipo && !tipos.some((t) => t.id === extra.tipo)) {
    select._extra = extra;
    opts.push(
      `<option value="${esc(extra.tipo)}" data-nome="${esc(extra.nome)}" data-pessoas="${extra.pessoas}">${esc(extra.nome)} · ${pessoasLabel(extra.pessoas)} (tipo antigo)</option>`,
    );
  }
  select.innerHTML = opts.join("");
  select.value = value || "";
  // form.reset() repõe esta opção (não apaga a linha)
  Array.from(select.options).forEach((o) => (o.defaultSelected = o.value === select.value));
}

/** Atualiza todas as listas; tipos já usados noutra linha ficam indisponíveis */
function refreshTipoOptions() {
  const rows = getTierRows();
  rows.forEach((r) => fillTipoSelect(r.tipo));
  const used = rows.map((r) => r.tipo.value).filter(Boolean);
  rows.forEach((r) =>
    Array.from(r.tipo.options).forEach((o) => {
      o.disabled = !!o.value && o.value !== r.tipo.value && used.includes(o.value);
    }),
  );
  if (els?.addTierBtn) els.addTierBtn.disabled = !nextFreeTipo();
}

/** Primeiro tipo do catálogo ainda sem linha (ou "" se já estão todos) */
function nextFreeTipo() {
  const used = getTierRows().map((r) => r.tipo.value);
  return catalogTipos().find((t) => !used.includes(t.id))?.id || "";
}

export function addPriceTier(data = {}, opts = {}) {
  if (!els?.priceTiers || !els.tplTier) return null;
  const { focus = true } = opts;
  const li = els.tplTier.content.firstElementChild.cloneNode(true);
  const tipo = li.querySelector(".price-tier__tipo");
  const valor = li.querySelector(".price-tier__valor");

  els.priceTiers.appendChild(li);
  if (data.tipo === "" && data.nome) tipo._antes = data.nome;
  // Linha nova: sugere o próximo tipo ainda não usado
  fillTipoSelect(tipo, data.tipo ? data : { tipo: data.tipo === "" ? "" : nextFreeTipo() });
  valor.value = data.valor ? formatKz(data.valor).replace(" Kz", "") : "";
  valor.defaultValue = valor.value;
  refreshTipoOptions();

  if (focus) (tipo.value ? valor : tipo).focus();
  return li;
}

function getTierRows() {
  if (!els?.priceTiers) return [];
  return Array.from(els.priceTiers.querySelectorAll(".price-tier")).map((li) => ({
    li,
    tipo: li.querySelector(".price-tier__tipo"),
    valor: li.querySelector(".price-tier__valor"),
  }));
}

/** Pacotes válidos, pela ordem do formulário */
export function getPriceTiers() {
  const seen = new Set();
  return getTierRows()
    .map((r) => {
      const opt = r.tipo.selectedOptions[0];
      return {
        tipo: r.tipo.value,
        nome: opt?.dataset.nome || "",
        pessoas: parseInt(opt?.dataset.pessoas, 10) || 1,
        valor: toNumber(r.valor.value),
      };
    })
    .filter((p) => p.tipo && p.nome && p.valor > 0 && !seen.has(p.tipo) && seen.add(p.tipo));
}

/** Texto do "Preço" nos detalhes da viagem ("A partir de 300.000 Kz") */
function autoPriceText(pacotes) {
  if (window.MochilaoPacotes) return window.MochilaoPacotes.priceText(pacotes);
  if (!pacotes.length) return "";
  return `A partir de ${formatKz(Math.min(...pacotes.map((p) => p.valor)))}`;
}

/** Pacotes guardados; programas antigos (preço por pessoa) → convertidos, sem tipo */
function parseStoredPackages(program) {
  if (Array.isArray(program.pacotes) && program.pacotes.length) {
    return { legacy: false, list: window.MochilaoPacotes.fromProgram(program) };
  }
  const list = window.MochilaoPacotes ? window.MochilaoPacotes.fromLegacy(program.precos, program.preco) : [];
  return { legacy: list.length > 0, list: list.map((p) => ({ ...p, tipo: "" })) };
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
    // Só é apagado quando o programa for gravado
    state.removedGallery.push({ url: item.url, publicId: item.publicId || "" });
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
 *  keep     → [{url, publicId}] fotos já guardadas que continuam
 *  toUpload → [File]            fotos novas a gravar
 *  toDelete → [{url, publicId}] fotos removidas a apagar
 *  (publicId = id da foto; o program-save.js usa-o para saber
 *   quais fotos manter — sem ele, todas desapareciam ao gravar)
 */
export function getGalleryChanges() {
  return {
    keep: state.gallery
      .filter((g) => g.kind === "existing")
      .map(({ url, publicId }) => ({ url, publicId: publicId || "" })),
    toUpload: state.gallery.filter((g) => g.kind === "new").map((g) => g.file),
    toDelete: [...state.removedGallery],
  };
}

/* ─────────────────────────────────────────
   RESET / POPULAR (edição)
   ───────────────────────────────────────── */
function clearDynamicState() {
  if (!els) return;
  els.datesList?.replaceChildren();
  const occ = $("progVagasList");
  if (occ) {
    occ.hidden = true;
    occ.replaceChildren();
  }

  els.includeList?.replaceChildren();
  els.excludeList?.replaceChildren();
  els.itinerary?.replaceChildren();
  els.priceTiers?.replaceChildren();
  addPriceTier({}, { focus: false }); // formulário limpo começa com 1 pacote
  const legacyNote = document.getElementById("progPriceLegacy");
  if (legacyNote) legacyNote.hidden = true;

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
  // Pacotes e preços
  const stored = parseStoredPackages(program);
  els.priceTiers?.replaceChildren();
  stored.list.forEach((p) => addPriceTier(p, { focus: false }));
  if (!stored.list.length) addPriceTier({}, { focus: false });
  const legacyNote = document.getElementById("progPriceLegacy");
  if (legacyNote) legacyNote.hidden = !stored.legacy;
  set("progStartPoint", program.pontoPartida);
  set("progVagas", parseInt(program.vagas, 10) > 0 ? parseInt(program.vagas, 10) : "");
  els.datesList?.replaceChildren();
  (Array.isArray(program.datas) ? program.datas : [])
    .filter((d) => d && d.inicio)
    .sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)))
    .forEach((d) => addProgDate(d, { focus: false }));
  renderOccupancy(program.id, parseInt(program.vagas, 10) || 0);
  const onlyCustom = $("progSoPersonalizada");
  if (onlyCustom) onlyCustom.checked = program.soPersonalizada === true;
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
      publicId: g.publicId || "",
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
    // Pacotes (Individual, Casal, Kamba…) com preço fechado
    pacotes: getPriceTiers(),
    precos: [], // formato antigo (preço por pessoa) deixa de ser usado
    preco: autoPriceText(getPriceTiers()),
    pontoPartida: val("progStartPoint"),
    // Lugares por data (0 = sem limite)
    vagas: Math.max(0, Math.min(999, parseInt(val("progVagas"), 10) || 0)),
    // Datas da viagem: [{ inicio, fim }] por ordem
    datas: getProgDates(),
    // true = só aparece na página Viagens Personalizadas
    soPersonalizada: $("progSoPersonalizada")?.checked === true,
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
    ["progStartPoint", "Ponto de partida"],
    ["progDesc", "Descrição"],
  ].forEach(([id, label]) => {
    const el = $(id);
    if (el && !el.value.trim()) mark(el, `${label} é obrigatório.`);
  });

  // Pacotes: pelo menos um completo; linhas a meio ficam marcadas
  const rows = getTierRows();
  rows.forEach((r, i) => {
    const hasTipo = !!r.tipo.value;
    const hasValor = toNumber(r.valor.value) > 0;
    if (hasTipo !== hasValor || (!hasTipo && rows.length === 1)) {
      if (!hasTipo) mark(r.tipo, `Pacote ${i + 1}: escolha o tipo de pacote.`);
      if (!hasValor) mark(r.valor, `Pacote ${i + 1}: indique o preço do pacote.`);
    }
  });
  if (!getPriceTiers().length && !errors.some((m) => m.startsWith("Pacote"))) {
    mark(els.addTierBtn, "Adicione pelo menos um pacote com preço.");
  }

  if (isNew && !state.coverFile) {
    mark(els.coverInput?.nextElementSibling, "A imagem de capa é obrigatória.");
  }

  // Datas: partida obrigatória, regresso igual ou depois da partida, sem repetir
  const seenDates = new Set();
  getDateRows().forEach((r, i) => {
    const ini = r.inicio.value;
    const fim = r.fim.value;
    if (!ini && !fim) return; // linha vazia é ignorada
    if (!ini) mark(r.inicio, `Data ${i + 1}: indique o dia de partida.`);
    else if (fim && fim < ini) mark(r.fim, `Data ${i + 1}: o regresso não pode ser antes da partida.`);
    else if (seenDates.has(ini)) mark(r.inicio, `Data ${i + 1}: esta partida já existe.`);
    seenDates.add(ini);
  });

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
/* ─────────────────────────────────────────
   VAGAS — lugares já reservados por data (só leitura)
   ocupacao/{programId}__{data} → { programId, data, pessoas }
   ───────────────────────────────────────── */
let occSeq = 0;
async function renderOccupancy(programId, vagas) {
  const box = $("progVagasList");
  if (!box || !programId) return;
  const mine = ++occSeq;
  try {
    const [{ db }, fs] = await Promise.all([
      import("./firebase-config.js"),
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js"),
    ]);
    const snap = await fs.getDocs(fs.query(fs.collection(db, "ocupacao"), fs.where("programId", "==", programId)));
    if (mine !== occSeq) return;
    const today = new Date().toISOString().slice(0, 10);
    const rows = snap.docs
      .map((d) => d.data())
      .filter((o) => o.data >= today && (parseInt(o.pessoas, 10) || 0) > 0)
      .sort((a, b) => String(a.data).localeCompare(String(b.data)));
    if (!rows.length) {
      box.hidden = true;
      return;
    }
    const fmt = (iso) => {
      const [y, m, d] = String(iso).split("-");
      return d && m && y ? `${d}/${m}/${y}` : iso;
    };
    box.innerHTML =
      '<li class="prog-vagas__title">Lugares reservados nas próximas datas</li>' +
      rows
        .map((o) => {
          const n = parseInt(o.pessoas, 10) || 0;
          const full = vagas && n >= vagas;
          return `<li class="${full ? "is-full" : ""}"><span>${fmt(o.data)}</span><strong>${
            vagas ? `${n} de ${vagas}${full ? " · esgotado" : ""}` : `${n} reservado${n === 1 ? "" : "s"}`
          }</strong></li>`;
        })
        .join("");
    box.hidden = false;
  } catch (err) {
    console.warn("[vagas] Não foi possível ler as datas reservadas:", err);
    box.hidden = true;
  }
}

/* ─────────────────────────────────────────
   DATAS DA VIAGEM (partida e regresso)
   Guardadas no programa como datas: [{ inicio: "AAAA-MM-DD", fim: "AAAA-MM-DD" }]
   ───────────────────────────────────────── */
export function addProgDate(data = {}, opts = {}) {
  if (!els?.datesList || !els.tplDate) return null;
  const { focus = true } = opts;
  const li = els.tplDate.content.firstElementChild.cloneNode(true);
  const ini = li.querySelector(".prog-date__inicio");
  const fim = li.querySelector(".prog-date__fim");
  ini.value = data.inicio || "";
  fim.value = data.fim || "";
  // form.reset() não apaga as datas carregadas
  ini.defaultValue = ini.value;
  fim.defaultValue = fim.value;
  // Regresso não pode ser antes da partida
  const sync = () => {
    fim.min = ini.value || "";
    if (ini.value && (!fim.value || fim.value < ini.value)) fim.value = ini.value;
  };
  ini.addEventListener("change", sync);
  sync();
  const today = new Date().toISOString().slice(0, 10);
  li.classList.toggle("is-past", !!ini.value && (fim.value || ini.value) < today);
  els.datesList.appendChild(li);
  if (focus) ini.focus();
  return li;
}

function getDateRows() {
  if (!els?.datesList) return [];
  return Array.from(els.datesList.querySelectorAll(".prog-date")).map((li) => ({
    li,
    inicio: li.querySelector(".prog-date__inicio"),
    fim: li.querySelector(".prog-date__fim"),
  }));
}

/** Datas válidas, sem repetir, por ordem */
export function getProgDates() {
  const seen = new Set();
  return getDateRows()
    .map((r) => ({ inicio: r.inicio.value, fim: r.fim.value || r.inicio.value }))
    .filter((d) => d.inicio && d.fim >= d.inicio && !seen.has(d.inicio) && seen.add(d.inicio))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}
