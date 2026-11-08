/* =====================================================
   O MOCHILÃO — checkout-firestore.js  (ES module)
   Liga a página de checkout ao Firestore.

   1. Lê localStorage("mochilao-cart") e preenche o resumo
      (carrinho vazio → volta para index.html)
      Cada viagem tem − / + para escolher a QUANTIDADE do pacote
      (Individual, Casal, Kamba… — preço fechado por pacote).
      Viagens antigas sem pacote: − / + muda o nº de pessoas
      (preço por pessoa da tabela "precos").
   2. Valida Nome / Email / Telefone / Nacionalidade do cliente
      e os ACOMPANHANTES: por cada pessoa a mais na reserva aparece um
      bloco (Nome, Telefone, Nacionalidade, Email opcional). Ex.: 1 Casal
      = 2 pessoas → 1 acompanhante; 2 Casal = 4 pessoas → 3 acompanhantes.
   3. Confirma no Firestore, numa só transação:
        • o preço de cada pacote (igual ao do programa no painel)
        • as vagas da data (programs/{id}.vagas vs ocupacao/{id}__{data})
      e só então grava em "reservations" e soma os lugares em "ocupacao"
   4. Limpa o carrinho e mostra o modal de sucesso
   ===================================================== */

import { db } from "./firebase-config.js";
import { PAIS_PADRAO, paisValido, garantirDatalist } from "./paises.js";

// ⚠️ A versão (12.x.x) TEM de ser igual à usada no firebase-config.js,
//    senão o Firestore dá erro "Type does not match the expected instance".
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

/* ─────────────────────────────────────────
   1. CONFIGURAÇÃO
   ───────────────────────────────────────── */
const STORAGE_KEY = "mochilao-cart";
const COLLECTION = "reservations";
const STATUS_INICIAL = "Aguardando Pagamento";
const IBAN = "AO06.XXXXXXXX"; // ← substituir pelo IBAN real
const WHATSAPP = "244926509821";
const HOME_URL = "../index.html";
const PAX_MIN = 1;
const PAX_MAX = 20;

/* ─────────────────────────────────────────
   2. DOM
   ───────────────────────────────────────── */
const els = {
  intro: document.querySelector(".checkout__intro"),
  grid: document.querySelector(".checkout__grid"),
  form: document.getElementById("checkoutForm"),
  nome: document.getElementById("clienteNome"),
  email: document.getElementById("clienteEmail"),
  telefone: document.getElementById("clienteTelefone"),
  nacionalidade: document.getElementById("clienteNacionalidade"),
  companions: document.getElementById("checkoutCompanions"),
  items: document.getElementById("checkoutItems"),
  subtotal: document.getElementById("checkoutSubtotal"),
  total: document.getElementById("checkoutTotal"),
  submit: document.getElementById("checkoutSubmitBtn"),
  submitText: document.querySelector(".checkout-summary__submit-text"),
  success: document.getElementById("checkoutSuccess"),
  successTotal: document.getElementById("successTotal"),
  successIban: document.getElementById("successIban"),
  successRef: document.getElementById("successRef"),
  successWpp: document.getElementById("successWhatsapp"),
  successHome: document.getElementById("successHomeBtn"),
  copyIban: document.getElementById("copyIbanBtn"),
};

/* ─────────────────────────────────────────
   3. UTILITÁRIOS
   ───────────────────────────────────────── */
function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

function formatKz(n) {
  return (
    Math.round(Number(n) || 0)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " Kz"
  );
}

function formatDate(iso) {
  if (!iso) return "Data a definir";
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return String(iso);
  return new Date(y, m - 1, d).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* "20 – 22 dez 2026" (partida e regresso) */
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function formatRange(inicio, fim) {
  const p = (iso) => String(iso || "").split("-").map(Number);
  const [ay, am, ad] = p(inicio);
  const [by, bm, bd] = p(fim);
  if (!ay || !am || !ad) return formatDate(inicio);
  const one = (y, m, d, year) => `${d} ${MESES[m - 1]}${year ? " " + y : ""}`;
  if (!by || !bm || !bd || fim === inicio) return one(ay, am, ad, true);
  if (ay !== by) return `${one(ay, am, ad, true)} – ${one(by, bm, bd, true)}`;
  if (am !== bm) return `${one(ay, am, ad, false)} – ${one(by, bm, bd, true)}`;
  return `${ad} – ${one(by, bm, bd, true)}`;
}
const itemDate = (item) => (item.dataFim ? formatRange(item.data, item.dataFim) : formatDate(item.data));

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const clampPax = (n) => Math.min(PAX_MAX, Math.max(PAX_MIN, parseInt(n, 10) || PAX_MIN));

/* Preço por pessoa para N pessoas: escalão com o maior nº de pessoas ≤ N
   (grupos maiores pagam o preço do último escalão). Sem tabela → preço guardado. */
function unitPrice(item, pax) {
  const tiers = (Array.isArray(item.precos) ? item.precos : [])
    .map((t) => ({ pax: parseInt(t.pax, 10) || 1, valor: toNumber(t.valor) }))
    .filter((t) => t.valor > 0)
    .sort((a, b) => a.pax - b.pax);
  if (!tiers.length) return toNumber(item.precoUnitario ?? item.precoUnit);
  let chosen = tiers[0];
  tiers.forEach((t) => {
    if (t.pax <= pax) chosen = t;
  });
  return chosen.valor;
}

// Viagem com pacote (preço fechado por pacote)
const isPackage = (item) => !!item?.pacote;

/* Quantidade que o − / + controla, preço de cada unidade e total da linha */
function lineInfo(item) {
  if (isPackage(item)) {
    const qtd = clampPax(item.qtd);
    const porPacote = parseInt(item.pessoasPorPacote, 10) || 1;
    const unit = toNumber(item.precoUnitario);
    return { count: qtd, unit, total: unit * qtd, pessoas: qtd * porPacote, porPacote };
  }
  const pax = clampPax(item.pax);
  const unit = unitPrice(item, pax);
  return { count: pax, unit, total: unit * pax, pessoas: pax, porPacote: 1 };
}

function lineTotal(item) {
  return lineInfo(item).total;
}

// O checkout está em /PAGES/ → imagens precisam de "../"
function imagePath(src) {
  if (!src) return "";
  if (/^(https?:|data:|\/)/.test(src)) return src;
  return "../" + String(src).replace(/^(\.\.\/)+/, "");
}

/* ─────────────────────────────────────────
   4. CARRINHO
   ───────────────────────────────────────── */
function getCart() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Firestore não aceita "undefined" → normaliza cada item
function sanitizeItems(cart) {
  return cart.map((item) => {
    const info = lineInfo(item);
    const base = {
      id: String(item.id ?? ""),
      programId: String(item.programId ?? item.programaId ?? ""),
      nome: String(item.nome ?? ""),
      imagem: String(item.imagem ?? item.img ?? ""),
      data: String(item.data ?? ""), // partida
      dataFim: String(item.dataFim ?? item.data ?? ""), // regresso
      pax: info.pessoas, // total de pessoas da linha
      precoUnitario: info.unit,
      total: info.total,
    };
    if (isPackage(item)) {
      base.pacote = String(item.pacote);
      base.pacoteId = String(item.pacoteId ?? "");
      base.pessoasPorPacote = info.porPacote;
      base.qtd = info.count;
    }
    return base;
  });
}

/* Muda o nº de pessoas de uma viagem e grava na mochila */
function setPax(id, pax) {
  const cart = getCart();
  const item = cart.find((i) => i.id === id);
  if (!item) return;
  if (isPackage(item)) {
    item.qtd = clampPax(pax);
    const info = lineInfo(item);
    item.pax = info.pessoas;
    item.total = info.total;
  } else {
    item.pax = clampPax(pax);
    item.precoUnitario = unitPrice(item, item.pax);
    item.total = item.precoUnitario * item.pax;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event("cartUpdated"));
  renderSummary(cart);
  // Leitores de ecrã: mantém o foco no botão carregado
  els.items.querySelector(`[data-id="${CSS.escape(id)}"][data-pax="${lastAction}"]`)?.focus();
}
let lastAction = "";

function getTotal(cart) {
  return cart.reduce((sum, item) => sum + lineTotal(item), 0);
}

/* ─────────────────────────────────────────
   5. RENDER DO RESUMO
   ───────────────────────────────────────── */
function renderSummary(cart) {
  els.items.innerHTML = cart
    .map((item) => {
      const { count, unit, total: valor, pessoas, porPacote } = lineInfo(item);
      const pack = isPackage(item);
      const pessoasTxt = `${pessoas} ${pessoas === 1 ? "pessoa" : "pessoas"}`;
      const countTxt = pack ? `${count} × ${escapeHtml(item.pacote)}` : pessoasTxt;
      const unitTxt =
        unit > 0
          ? pack
            ? ` · ${escapeHtml(item.pacote)} ${formatKz(unit)}${porPacote > 1 ? ` (${porPacote} pessoas)` : ""}`
            : ` · ${formatKz(unit)} / pessoa`
          : "";
      const what = pack ? "pacote" : "pessoa";
      const src = imagePath(item.imagem ?? item.img);
      const id = escapeHtml(item.id);
      const media = src
        ? `<img src="${escapeHtml(src)}" alt="" class="checkout-item__img" loading="lazy">`
        : `<span class="checkout-item__ph"><i class="fa-solid fa-mountain-sun"></i></span>`;

      return `
        <li class="checkout-item">
          <div class="checkout-item__media">
            ${media}
            <span class="checkout-item__qty" title="${pessoasTxt}">${pessoas}</span>
          </div>
          <div class="checkout-item__info">
            <span class="checkout-item__title">${escapeHtml(item.nome)}</span>
            <span class="checkout-item__meta">
              ${escapeHtml(itemDate(item))}${unitTxt}
            </span>
            <div class="checkout-pax" role="group" aria-label="${pack ? "Quantidade de pacotes" : "Número de pessoas"} — ${escapeHtml(item.nome)}">
              <button type="button" class="checkout-pax__btn" data-id="${id}" data-pax="dec"
                aria-label="Menos um ${what}" ${count <= PAX_MIN ? "disabled" : ""}><i class="fa-solid fa-minus"></i></button>
              <span class="checkout-pax__value" aria-live="polite">${countTxt}</span>
              <button type="button" class="checkout-pax__btn" data-id="${id}" data-pax="inc"
                aria-label="Mais um ${what}" ${count >= PAX_MAX ? "disabled" : ""}><i class="fa-solid fa-plus"></i></button>
            </div>
            ${pack && pessoas > 1 ? `<span class="checkout-item__people">${pessoasTxt} no total</span>` : ""}
          </div>
          <span class="checkout-item__price">${valor > 0 ? formatKz(valor) : "A consultar"}</span>
        </li>`;
    })
    .join("");

  const total = getTotal(cart);
  els.subtotal.textContent = formatKz(total);
  els.total.textContent = formatKz(total);
  renderCompanions(cart);
}

/* ─────────────────────────────────────────
   5b. ACOMPANHANTES
   Um bloco por cada pessoa a mais em cada viagem. O que já foi escrito
   fica guardado em memória: ao mudar a quantidade, nada se perde.
   ───────────────────────────────────────── */
const companionData = {}; // "itemId#n" → { nome, telefone, email, nacionalidade }
const COMP_FIELDS = ["nome", "telefone", "email", "nacionalidade"];

/** Acompanhantes pedidos: [{ key, item, n }] */
function companionSlots(cart) {
  const slots = [];
  cart.forEach((item) => {
    const extra = Math.max(0, lineInfo(item).pessoas - 1);
    for (let n = 1; n <= extra; n++) slots.push({ key: `${item.id}#${n}`, item, n });
  });
  return slots;
}

function saveCompanionInputs() {
  els.companions?.querySelectorAll("[data-comp]").forEach((input) => {
    const key = input.dataset.comp;
    companionData[key] ||= {};
    companionData[key][input.dataset.field] = input.value;
  });
}

function renderCompanions(cart) {
  if (!els.companions) return;
  saveCompanionInputs();
  const slots = companionSlots(cart);
  if (!slots.length) {
    els.companions.hidden = true;
    els.companions.innerHTML = "";
    return;
  }
  const multiTrip = new Set(slots.map((s) => s.item.id)).size > 1;
  let lastTrip = null;
  let count = 0;
  const html = slots
    .map(({ key, item, n }) => {
      const d = companionData[key] || {};
      const uid = "comp" + ++count;
      const val = (f, fallback = "") => escapeHtml(d[f] ?? fallback);
      const head =
        multiTrip && lastTrip !== item.id
          ? `<p class="checkout-companions__trip"><i class="fa-solid fa-route"></i> ${escapeHtml(item.nome)} · ${escapeHtml(itemDate(item))}</p>`
          : "";
      lastTrip = item.id;
      const field = (f, label, type, extra = "", req = true) => `
          <div class="checkout-form__field">
            <label for="${uid}-${f}" class="checkout-form__label">
              ${label} ${req ? '<span class="checkout-form__req">*</span>' : '<span class="checkout-companion__opt">(opcional)</span>'}
            </label>
            <input type="${type}" id="${uid}-${f}" class="checkout-form__input" data-comp="${escapeHtml(key)}" data-field="${f}" ${extra} />
            <span class="checkout-form__error" data-error-for="${uid}-${f}"></span>
          </div>`;
      return `${head}
        <div class="checkout-companion" data-slot="${escapeHtml(key)}">
          <p class="checkout-companion__title"><span class="checkout-companion__num">${n}</span> Acompanhante ${n}</p>
          ${field("nome", "Nome completo", "text", `value="${val("nome")}" placeholder="Nome completo do acompanhante" autocomplete="off"`)}
          <div class="checkout-form__row">
            ${field("telefone", "Telefone / WhatsApp", "tel", `value="${val("telefone")}" placeholder="+244 9XX XXX XXX" inputmode="tel" autocomplete="off"`)}
            ${field("nacionalidade", "Nacionalidade", "text", `value="${val("nacionalidade", PAIS_PADRAO)}" list="listaPaises" placeholder="Escreva para procurar o país" autocomplete="off"`)}
          </div>
          ${field("email", "Email", "email", `value="${val("email")}" placeholder="exemplo@gmail.com" autocomplete="off"`, false)}
        </div>`;
    })
    .join("");
  const total = slots.length;
  els.companions.innerHTML = `
    <p class="checkout-companions__intro">
      <i class="fa-solid fa-user-group"></i>
      ${total === 1 ? "A reserva inclui mais 1 pessoa." : `A reserva inclui mais ${total} pessoas.`}
      Indique os dados de ${total === 1 ? "quem vai consigo" : "cada pessoa que vai consigo"}.
    </p>${html}`;
  els.companions.hidden = false;
}

/** Valida e devolve os acompanhantes, ou null (com o 1.º campo errado focado) */
function validateCompanions(cart, firstInvalidRef) {
  saveCompanionInputs();
  const list = [];
  companionSlots(cart).forEach(({ key, item, n }) => {
    const box = els.companions.querySelector(`[data-slot="${CSS.escape(key)}"]`);
    const input = (f) => box?.querySelector(`[data-field="${f}"]`);
    const d = companionData[key] || {};
    const nome = String(d.nome || "").trim().replace(/\s+/g, " ");
    const telefone = String(d.telefone || "").trim();
    const email = String(d.email || "").trim().toLowerCase();
    const nacionalidade = paisValido(d.nacionalidade);
    const tel = telefone.replace(/\D/g, "");
    const checks = [
      ["nome", nome.length < 3 ? "Indique o nome completo." : ""],
      ["telefone", tel.length < 9 || tel.length > 15 ? "Indique um telefone válido." : ""],
      ["nacionalidade", !nacionalidade ? "Escolha um país da lista." : ""],
      ["email", email && !EMAIL_RE.test(email) ? "Email inválido (ou deixe em branco)." : ""],
    ];
    checks.forEach(([f, msg]) => {
      const el = input(f);
      if (!el) return;
      setFieldError(el, msg);
      if (msg && !firstInvalidRef.el) firstInvalidRef.el = el;
    });
    if (nacionalidade && input("nacionalidade")) input("nacionalidade").value = nacionalidade;
    list.push({
      programId: String(item.programId ?? ""),
      programa: String(item.nome ?? ""),
      data: String(item.data ?? ""),
      numero: n,
      nome,
      telefone,
      email,
      nacionalidade,
    });
  });
  return list;
}

// Nacionalidade: ao entrar no campo, seleciona o texto → basta escrever para procurar
document.addEventListener("focusin", (e) => {
  const input = e.target;
  if (input instanceof HTMLInputElement && input.getAttribute("list") === "listaPaises") {
    setTimeout(() => input.select(), 0);
  }
});

// Limpa o erro de um acompanhante assim que o campo é corrigido
els.companions?.addEventListener("input", (e) => {
  const input = e.target.closest("[data-comp]");
  if (!input) return;
  companionData[input.dataset.comp] ||= {};
  companionData[input.dataset.comp][input.dataset.field] = input.value;
  if (input.classList.contains("is-invalid")) setFieldError(input, "");
});

/* ─────────────────────────────────────────
   6. VALIDAÇÃO
   ───────────────────────────────────────── */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function setFieldError(input, msg) {
  const errEl = document.querySelector(`[data-error-for="${input.id}"]`);
  if (errEl) errEl.textContent = msg || "";
  input.classList.toggle("is-invalid", !!msg);
  input.setAttribute("aria-invalid", msg ? "true" : "false");
}

function validate() {
  const nome = els.nome.value.trim().replace(/\s+/g, " ");
  const nacionalidade = paisValido(els.nacionalidade?.value);
  const email = els.email.value.trim().toLowerCase();
  const telefone = els.telefone.value.trim();
  const telDigits = telefone.replace(/\D/g, "");

  const errors = [
    [els.nome, nome.length < 3 ? "Indique o seu nome completo." : ""],
    [els.email, !EMAIL_RE.test(email) ? "Indique um email válido." : ""],
    [
      els.telefone,
      telDigits.length < 9 || telDigits.length > 15
        ? "Indique um número de telefone válido."
        : "",
    ],
  ];
  if (els.nacionalidade) {
    errors.push([els.nacionalidade, !nacionalidade ? "Escolha o seu país na lista." : ""]);
  }

  let firstInvalid = null;
  errors.forEach(([input, msg]) => {
    setFieldError(input, msg);
    if (msg && !firstInvalid) firstInvalid = input;
  });

  const ref = { el: firstInvalid };
  const acompanhantes = validateCompanions(getCart(), ref);

  if (ref.el) {
    ref.el.focus();
    ref.el.scrollIntoView({ behavior: "smooth", block: "center" });
    return null;
  }
  if (els.nacionalidade) els.nacionalidade.value = nacionalidade;
  return { clienteInfo: { nome, email, telefone, nacionalidade }, acompanhantes };
}

// − / + do número de pessoas em cada viagem
els.items.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-pax]");
  if (!btn || btn.disabled || submitting) return;
  const id = btn.dataset.id;
  const item = getCart().find((i) => i.id === id);
  if (!item) return;
  lastAction = btn.dataset.pax;
  setPax(id, lineInfo(item).count + (lastAction === "inc" ? 1 : -1));
});

// Limpa o erro assim que o utilizador corrige o campo
[els.nome, els.email, els.telefone, els.nacionalidade].filter(Boolean).forEach((input) =>
  input.addEventListener("input", () => {
    if (input.classList.contains("is-invalid")) setFieldError(input, "");
  }),
);

/* ─────────────────────────────────────────
   7. ESTADO DO BOTÃO + ERRO GERAL
   ───────────────────────────────────────── */
let submitting = false;
let generalError = null;

function setLoading(on) {
  submitting = on;
  els.submit.disabled = on;
  els.submitText.textContent = on ? "A processar..." : "Confirmar Reserva";
  const icon = els.submit.querySelector("i");
  if (icon) icon.className = on ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-arrow-right";
}

function showGeneralError(msg) {
  if (!generalError) {
    generalError = document.createElement("p");
    generalError.className = "checkout-form__error";
    generalError.setAttribute("role", "alert");
    generalError.style.textAlign = "center";
    els.submit.insertAdjacentElement("afterend", generalError);
  }
  generalError.textContent = msg || "";
}

/* ─────────────────────────────────────────
   8. SUCESSO
   ───────────────────────────────────────── */
function showSuccess({ total, ref, nome }) {
  // Esconde o formulário e o resumo
  if (els.intro) els.intro.hidden = true;
  if (els.grid) els.grid.hidden = true;

  els.successTotal.textContent = formatKz(total);
  els.successIban.textContent = IBAN;
  els.successRef.textContent = ref;

  const msg =
    `Olá! Sou ${nome}. Acabei de fazer a reserva ${ref} no site ` +
    `(total: ${formatKz(total)}). Segue o comprovativo da transferência.`;
  els.successWpp.href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;

  els.success.hidden = false;
  document.body.style.overflow = "hidden";
  els.successHome.focus();
}

// Copiar IBAN
els.copyIban?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(IBAN);
  } catch {
    // Fallback para browsers sem Clipboard API
    const tmp = document.createElement("textarea");
    tmp.value = IBAN;
    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand("copy");
    tmp.remove();
  }
  els.copyIban.classList.add("is-copied");
  els.copyIban.innerHTML = '<i class="fa-solid fa-check"></i>';
  setTimeout(() => {
    els.copyIban.classList.remove("is-copied");
    els.copyIban.innerHTML = '<i class="fa-regular fa-copy"></i>';
  }, 1800);
});

// "Voltar ao Início"
els.successHome?.addEventListener("click", (e) => {
  e.preventDefault();
  window.location.href = HOME_URL;
});

/* ─────────────────────────────────────────
   9. SUBMISSÃO → FIRESTORE
   ───────────────────────────────────────── */
els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (submitting) return; // evita duplo clique
  showGeneralError("");

  const dados = validate();
  if (!dados) return;
  const { clienteInfo, acompanhantes } = dados;

  const cart = getCart();
  if (!cart.length) {
    window.location.replace(HOME_URL);
    return;
  }

  setLoading(true);

  try {
    const { id, total } = await reserve(clienteInfo, cart, acompanhantes);

    // Limpa o carrinho e avisa o resto do site
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("cartUpdated"));

    const ref = "MCH-" + id.slice(0, 6).toUpperCase();
    showSuccess({ total, ref, nome: clienteInfo.nome });
  } catch (err) {
    setLoading(false);
    if (err instanceof CheckoutError) {
      if (err.kind === "price") applyNewPrices(err.changes);
      showGeneralError(err.message);
      return;
    }
    console.error("[checkout] Erro ao gravar reserva:", err);
    showGeneralError(
      err?.code === "permission-denied"
        ? "Não foi possível registar a reserva (permissões). Contacte-nos pelo WhatsApp."
        : "Ocorreu um erro de ligação. Verifique a internet e tente novamente.",
    );
  }
});

/* ─────────────────────────────────────────
   9b. CONFIRMAÇÃO NO FIRESTORE (preços + vagas)
   Tudo numa transação: se outra pessoa reservar os últimos lugares
   ao mesmo tempo, só uma das reservas passa.
   ───────────────────────────────────────── */
class CheckoutError extends Error {
  constructor(kind, message, extra = {}) {
    super(message);
    this.kind = kind;
    Object.assign(this, extra);
  }
}

const fmtDate = (iso) => formatDate(iso);

async function reserve(clienteInfo, cart, acompanhantes = []) {
  return runTransaction(db, async (tx) => {
    const itens = sanitizeItems(cart);

    // 1. Programas do painel envolvidos (os antigos, fixos no site, não estão no Firestore)
    const progs = {};
    for (const id of [...new Set(itens.map((i) => i.programId).filter(Boolean))]) {
      const snap = await tx.get(doc(db, "programs", id));
      progs[id] = snap.exists() ? snap.data() : null;
    }

    // 2. Preços: cada pacote tem de custar o mesmo que no programa
    const changes = [];
    itens.forEach((it) => {
      const p = progs[it.programId];
      if (!p) return;
      const pacotes = Array.isArray(p.pacotes) ? p.pacotes : [];
      if (!pacotes.length) return; // programa sem pacotes (formato antigo)
      if (!it.pacote) {
        throw new CheckoutError(
          "stale",
          `${it.nome} foi adicionado à mochila antes de uma atualização do site. Remova-o e adicione-o de novo na página do programa.`,
        );
      }
      const pk =
        pacotes.find((x) => String(x.tipo || "") === String(it.pacoteId || "")) ||
        pacotes.find((x) => String(x.nome || "").toLowerCase() === String(it.pacote).toLowerCase());
      if (!pk) {
        throw new CheckoutError("gone", `O pacote ${it.pacote} de ${it.nome} já não está disponível. Remova-o da mochila.`);
      }
      const valor = toNumber(pk.valor);
      if (valor !== it.precoUnitario) changes.push({ id: it.id, nome: it.nome, pacote: it.pacote, valor });
    });
    if (changes.length) {
      const c = changes[0];
      throw new CheckoutError(
        "price",
        changes.length === 1
          ? `O preço de ${c.nome} (${c.pacote}) foi atualizado para ${formatKz(c.valor)}. Confira o total e confirme de novo.`
          : "Alguns preços foram atualizados. Confira o total e confirme de novo.",
        { changes },
      );
    }

    // 3. Datas: a data tem de continuar a existir no programa
    itens.forEach((it) => {
      const p = progs[it.programId];
      if (!p || !Array.isArray(p.datas) || !p.datas.length) return;
      if (!p.datas.some((d) => d && d.inicio === it.data)) {
        throw new CheckoutError(
          "date",
          `A data ${itemDate(it)} de ${it.nome} já não está disponível. Remova-a da mochila e escolha outra data.`,
        );
      }
    });

    // 4. Vagas: soma as pessoas por programa + data
    const groups = {};
    itens.forEach((it) => {
      if (!progs[it.programId] || !it.data) return;
      const key = `${it.programId}__${it.data}`;
      groups[key] ||= { programId: it.programId, data: it.data, nome: it.nome, pessoas: 0 };
      groups[key].pessoas += it.pax;
    });
    const occ = {};
    for (const key of Object.keys(groups)) {
      const snap = await tx.get(doc(db, "ocupacao", key));
      occ[key] = snap.exists() ? parseInt(snap.data().pessoas, 10) || 0 : null;
    }
    for (const [key, g] of Object.entries(groups)) {
      const vagas = parseInt(progs[g.programId].vagas, 10) || 0;
      const ocupadas = occ[key] || 0;
      if (vagas && ocupadas + g.pessoas > vagas) {
        const restam = Math.max(0, vagas - ocupadas);
        throw new CheckoutError(
          "full",
          restam === 0
            ? `${g.nome} está esgotado em ${fmtDate(g.data)}. Remova-o da mochila ou escolha outra data.`
            : `${g.nome} em ${fmtDate(g.data)}: só ${restam === 1 ? "resta 1 lugar" : `restam ${restam} lugares`} (pediu ${g.pessoas}). Reduza a quantidade.`,
        );
      }
    }

    // 5. Tudo certo → soma os lugares e grava a reserva
    for (const [key, g] of Object.entries(groups)) {
      const ref = doc(db, "ocupacao", key);
      if (occ[key] === null) tx.set(ref, { programId: g.programId, data: g.data, pessoas: g.pessoas });
      else tx.update(ref, { pessoas: occ[key] + g.pessoas });
    }
    const total = getTotal(itens);
    const resRef = doc(collection(db, COLLECTION));
    tx.set(resRef, {
      clienteInfo,
      itens,
      acompanhantes,
      total,
      status: STATUS_INICIAL,
      dataPedido: serverTimestamp(),
    });
    return { id: resRef.id, total };
  });
}

/* Preço mudou no painel → atualiza a mochila e o resumo */
function applyNewPrices(changes = []) {
  const cart = getCart();
  changes.forEach((c) => {
    const item = cart.find((i) => i.id === c.id);
    if (!item) return;
    item.precoUnitario = c.valor;
    item.total = c.valor * clampPax(item.qtd);
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event("cartUpdated"));
  renderSummary(cart);
}

/* ─────────────────────────────────────────
   10. INIT
   ───────────────────────────────────────── */
(function init() {
  garantirDatalist();
  const cart = getCart();
  if (!cart.length) {
    window.location.replace(HOME_URL);
    return;
  }
  renderSummary(cart);
})();

// Voltou ao checkout com o botão "Voltar" (cache do browser): mostra a mochila atual
window.addEventListener("pageshow", (e) => {
  if (!e.persisted) return;
  const cart = getCart();
  if (!cart.length) window.location.replace(HOME_URL);
  else renderSummary(cart);
});
