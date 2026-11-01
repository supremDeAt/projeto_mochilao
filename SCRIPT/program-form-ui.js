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
    navLinks: form.querySelectorAll(".program-form__nav-link"),
  };
  els.coverPlaceholder = els.coverPreview ? els.coverPreview.innerHTML : "";

  /* Botões "Adicionar Item" (Inclui / Não inclui) */
  form.querySelectorAll(".dyn-add[data-target]").forEach((btn) => {
    btn.addEventListener("click", () => addListItem($(btn.dataset.target)));
  });

  /* Botão "Adicionar Dia" */
  els.addDayBtn?.addEventListener("click", () => addItineraryDay());

  /* Botão "Adicionar escalão" (preços) */
  els.addTierBtn?.addEventListener("click", () => addPriceTier());

  /* Remover (delegação: funciona para linhas criadas depois) */
  form.addEventListener("click", (e) => {
    const rmItem = e.target.closest(".dyn-item__remove");
    if (rmItem) return removeListItem(rmItem.closest(".dyn-item"));

    const rmDay = e.target.closest(".day-card__remove");
    if (rmDay) return removeItineraryDay(rmDay.closest(".day-card"));

    const rmImg = e.target.closest(".gallery-manager__remove");
    if (rmImg) return removeGalleryItem(rmImg.closest(".gallery-manager__item"));

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
    // Enter num preço → novo escalão (nunca submete o formulário)
    if (t.closest?.(".price-tier")) {
      e.preventDefault();
      if (t.classList.contains("price-tier__valor") && t.value.trim()) {
        const row = t.closest(".price-tier");
        if (!row.nextElementSibling) addPriceTier();
      }
    }
  });

  /* Limpa o erro de um campo assim que é corrigido */
  form.addEventListener("input", (e) => {
    if (e.target.classList?.contains("is-invalid") && e.target.value.trim()) {
      e.target.classList.remove("is-invalid");
    }
  });

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
  if (!els.priceTiers?.children.length) addPriceTier({ pax: 1 }, { focus: false });
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
   PREÇOS POR NÚMERO DE PESSOAS
   Guardados no programa como precos: [{ pax: "2 Pax", valor: "760.000 Kz" }]
   (o mesmo formato dos programas antigos, lido pela página e pelo carrinho)
   ───────────────────────────────────────── */
const toNumber = (v) => {
  if (typeof v === "number") return isFinite(v) ? Math.round(v) : 0;
  const d = String(v ?? "").replace(/[^\d]/g, "");
  return d ? parseInt(d, 10) : 0;
};
export const formatKz = (n) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " Kz";

export function addPriceTier(data = {}, opts = {}) {
  if (!els?.priceTiers || !els.tplTier) return null;
  const { focus = true } = opts;
  const li = els.tplTier.content.firstElementChild.cloneNode(true);
  const pax = li.querySelector(".price-tier__pax");
  const valor = li.querySelector(".price-tier__valor");

  // Novo escalão: sugere o nº de pessoas a seguir ao último
  const rows = getTierRows();
  const lastPax = rows.length ? toNumber(rows[rows.length - 1].pax.value) : 0;
  pax.value = data.pax ?? (rows.length ? lastPax + 1 || "" : 1);
  valor.value = data.valor ? formatKz(data.valor).replace(" Kz", "") : "";
  // Também como valor "por defeito": um form.reset() a seguir não os apaga
  pax.defaultValue = pax.value;
  valor.defaultValue = valor.value;

  els.priceTiers.appendChild(li);
  if (focus) valor.focus();
  return li;
}

function getTierRows() {
  if (!els?.priceTiers) return [];
  return Array.from(els.priceTiers.querySelectorAll(".price-tier")).map((li) => ({
    li,
    pax: li.querySelector(".price-tier__pax"),
    valor: li.querySelector(".price-tier__valor"),
  }));
}

/** Escalões válidos, por ordem de nº de pessoas: [{ pax: 2, valor: 760000 }] */
export function getPriceTiers() {
  const seen = new Set();
  return getTierRows()
    .map((r) => ({ pax: toNumber(r.pax.value), valor: toNumber(r.valor.value) }))
    .filter((t) => t.pax > 0 && t.valor > 0 && !seen.has(t.pax) && seen.add(t.pax))
    .sort((a, b) => a.pax - b.pax);
}

/** Texto automático para os cartões ("A partir de 685.000 Kz") */
function autoPriceText(tiers) {
  if (!tiers.length) return "";
  const min = Math.min(...tiers.map((t) => t.valor));
  return tiers.length === 1 ? `${formatKz(min)} / pessoa` : `A partir de ${formatKz(min)}`;
}

/** Lê os escalões guardados (formato antigo "2 Pax" / "760.000 Kz" ou números) */
function parseStoredTiers(program) {
  const list = Array.isArray(program.precos) ? program.precos : [];
  const tiers = list
    .map((x) => ({ pax: toNumber(x?.pax) || 1, valor: toNumber(x?.valor) }))
    .filter((t) => t.valor > 0);
  if (tiers.length) return tiers;
  // Programa antigo só com "Preço" → vira um escalão de 1 pessoa
  const unico = toNumber(program.preco);
  return unico ? [{ pax: 1, valor: unico }] : [];
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

  els.includeList?.replaceChildren();
  els.excludeList?.replaceChildren();
  els.itinerary?.replaceChildren();
  els.priceTiers?.replaceChildren();
  addPriceTier({ pax: 1 }, { focus: false }); // formulário limpo começa com 1 escalão

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
  // Preços: escalões + texto dos cartões (só fica no campo se não for o automático)
  const tiers = parseStoredTiers(program);
  els.priceTiers?.replaceChildren();
  tiers.forEach((t) => addPriceTier(t, { focus: false }));
  if (!tiers.length) addPriceTier({ pax: 1 }, { focus: false });
  const autoText = autoPriceText(tiers);
  set("progPrice", program.preco && program.preco !== autoText ? program.preco : "");
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
    // Preços: escalões + texto para os cartões (automático se vazio)
    precos: getPriceTiers().map((t) => ({ pax: `${t.pax} Pax`, valor: formatKz(t.valor) })),
    preco: val("progPrice") || autoPriceText(getPriceTiers()),
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
    ["progStartPoint", "Ponto de partida"],
    ["progDesc", "Descrição"],
  ].forEach(([id, label]) => {
    const el = $(id);
    if (el && !el.value.trim()) mark(el, `${label} é obrigatório.`);
  });

  // Preços: pelo menos um escalão completo; linhas a meio ficam marcadas
  getTierRows().forEach((r, i) => {
    const hasPax = toNumber(r.pax.value) > 0;
    const hasValor = toNumber(r.valor.value) > 0;
    if (hasPax !== hasValor || (!hasPax && getTierRows().length === 1)) {
      if (!hasPax) mark(r.pax, `Escalão ${i + 1}: indique o número de pessoas.`);
      if (!hasValor) mark(r.valor, `Escalão ${i + 1}: indique o preço por pessoa.`);
    }
  });
  if (!getPriceTiers().length && !errors.some((m) => m.startsWith("Escalão"))) {
    mark(els.addTierBtn, "Indique pelo menos um preço (escalão).");
  }

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