/* =====================================================
   O MOCHILÃO — checkout-firestore.js  (ES module)
   Liga a página de checkout ao Firestore.

   1. Lê localStorage("mochilao-cart") e preenche o resumo
      (carrinho vazio → volta para index.html)
   2. Valida Nome / Email / Telefone
   3. Grava em Firestore → colecção "reservations"
   4. Limpa o carrinho e mostra o modal de sucesso
   ===================================================== */

import { db } from "./firebase-config.js";

// ⚠️ A versão (12.x.x) TEM de ser igual à usada no firebase-config.js,
//    senão o Firestore dá erro "Type does not match the expected instance".
import {
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

/* ─────────────────────────────────────────
   1. CONFIGURAÇÃO
   ───────────────────────────────────────── */
const STORAGE_KEY = "mochilao-cart";
const COLLECTION = "reservations";
const STATUS_INICIAL = "Aguardando Pagamento";
const IBAN = "AO06.XXXXXXXX"; // ← substituir pelo IBAN real
const WHATSAPP = "244926509821";
const HOME_URL = "../index.html";

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

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function lineTotal(item) {
  const total = toNumber(item.total);
  if (total > 0) return total;
  return toNumber(item.precoUnitario) * (parseInt(item.pax, 10) || 0);
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
    const pax = parseInt(item.pax, 10) || 1;
    const precoUnitario = toNumber(item.precoUnitario);
    return {
      id: String(item.id ?? ""),
      programId: String(item.programId ?? ""),
      nome: String(item.nome ?? ""),
      imagem: String(item.imagem ?? ""),
      data: String(item.data ?? ""),
      pax,
      precoUnitario,
      total: lineTotal({ ...item, pax, precoUnitario }),
    };
  });
}

function getTotal(cart) {
  return cart.reduce((sum, item) => sum + lineTotal(item), 0);
}

/* ─────────────────────────────────────────
   5. RENDER DO RESUMO
   ───────────────────────────────────────── */
function renderSummary(cart) {
  els.items.innerHTML = cart
    .map((item) => {
      const pax = parseInt(item.pax, 10) || 1;
      const valor = lineTotal(item);
      const src = imagePath(item.imagem);
      const media = src
        ? `<img src="${escapeHtml(src)}" alt="" class="checkout-item__img" loading="lazy">`
        : `<span class="checkout-item__ph"><i class="fa-solid fa-mountain-sun"></i></span>`;

      return `
        <li class="checkout-item">
          <div class="checkout-item__media">
            ${media}
            <span class="checkout-item__qty" title="${pax} ${pax === 1 ? "pessoa" : "pessoas"}">${pax}</span>
          </div>
          <div class="checkout-item__info">
            <span class="checkout-item__title">${escapeHtml(item.nome)}</span>
            <span class="checkout-item__meta">
              ${escapeHtml(formatDate(item.data))} · ${pax} ${pax === 1 ? "pessoa" : "pessoas"}
            </span>
          </div>
          <span class="checkout-item__price">${valor > 0 ? formatKz(valor) : "A consultar"}</span>
        </li>`;
    })
    .join("");

  const total = getTotal(cart);
  els.subtotal.textContent = formatKz(total);
  els.total.textContent = formatKz(total);
}

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

  let firstInvalid = null;
  errors.forEach(([input, msg]) => {
    setFieldError(input, msg);
    if (msg && !firstInvalid) firstInvalid = input;
  });

  if (firstInvalid) {
    firstInvalid.focus();
    return null;
  }
  return { nome, email, telefone };
}

// Limpa o erro assim que o utilizador corrige o campo
[els.nome, els.email, els.telefone].forEach((input) =>
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

  const clienteInfo = validate();
  if (!clienteInfo) return;

  const cart = getCart();
  if (!cart.length) {
    window.location.replace(HOME_URL);
    return;
  }

  const itens = sanitizeItems(cart);
  const total = getTotal(itens);

  setLoading(true);

  try {
    const docRef = await addDoc(collection(db, COLLECTION), {
      clienteInfo,
      itens,
      total,
      status: STATUS_INICIAL,
      dataPedido: serverTimestamp(),
    });

    // Limpa o carrinho e avisa o resto do site
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("cartUpdated"));

    const ref = "MCH-" + docRef.id.slice(0, 6).toUpperCase();
    showSuccess({ total, ref, nome: clienteInfo.nome });
  } catch (err) {
    console.error("[checkout] Erro ao gravar reserva:", err);
    setLoading(false);
    showGeneralError(
      err?.code === "permission-denied"
        ? "Não foi possível registar a reserva (permissões). Contacte-nos pelo WhatsApp."
        : "Ocorreu um erro de ligação. Verifique a internet e tente novamente.",
    );
  }
});

/* ─────────────────────────────────────────
   10. INIT
   ───────────────────────────────────────── */
(function init() {
  const cart = getCart();
  if (!cart.length) {
    window.location.replace(HOME_URL);
    return;
  }
  renderSummary(cart);
})();