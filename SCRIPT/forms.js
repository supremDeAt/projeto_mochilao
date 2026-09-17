/**
 * forms.js — O Mochilão
 * Gere os formulários do site principal:
 *   - Formulário de Contacto  → coleção "messages"
 *   - Formulário de Reserva   → coleção "reservations"
 */

import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

/* ─────────────────────────────────────────
   Utilitário: feedback de botão
   ───────────────────────────────────────── */
function setButtonState(btn, state, originalHTML) {
  if (state === "loading") {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A enviar…';
  } else if (state === "success") {
    btn.disabled = false;
    btn.innerHTML = originalHTML;
  } else {
    btn.disabled = false;
    btn.innerHTML = originalHTML;
  }
}

/* ─────────────────────────────────────────
   FORMULÁRIO DE CONTACTO
   Grava em Firestore: coleção "messages"
   Campos: nome, email, telefone, assunto, mensagem, data, status
   ───────────────────────────────────────── */
(function initContactForm() {
  const form = document.getElementById("contactForm");
  const successMsg = document.getElementById("contactSuccessMsg");
  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const btn = document.getElementById("contactSubmitBtn");
    const originalHTML = btn.innerHTML;
    setButtonState(btn, "loading");

    const nome     = document.getElementById("contactNome").value.trim();
    const email    = document.getElementById("contactEmail").value.trim();
    const telefone = document.getElementById("contactPhone").value.trim();
    const assunto  = document.getElementById("contactAssunto").value.trim();
    const mensagem = document.getElementById("contactMensagem").value.trim();

    try {
      await addDoc(collection(db, "messages"), {
        nome,
        email,
        telefone,
        assunto,
        mensagem,
        data: serverTimestamp(),
        status: "Pendente",
        lido: false,
      });

      // Mostrar mensagem de sucesso + limpar form
      form.reset();
      if (successMsg) {
        successMsg.style.display = "block";
        setTimeout(() => { successMsg.style.display = "none"; }, 6000);
      }
      setButtonState(btn, "success", originalHTML);
    } catch (err) {
      console.error("[forms.js] Erro ao enviar mensagem:", err);
      alert("Ocorreu um erro ao enviar a mensagem. Por favor, tente novamente.");
      setButtonState(btn, "error", originalHTML);
    }
  });
})();

/* ─────────────────────────────────────────
   FORMULÁRIO DE RESERVA
   Grava em Firestore: coleção "reservations"
   Campos: nome, destino, data, pessoas, telefone, status
   ───────────────────────────────────────── */
(function initReserveForm() {
  const form = document.getElementById("reserveForm");
  const successMsg = document.getElementById("reserveSuccessMsg");
  if (!form) return;

  // Definir data mínima = hoje
  const dataInput = document.getElementById("reserveData");
  if (dataInput) {
    const today = new Date().toISOString().split("T")[0];
    dataInput.setAttribute("min", today);
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const btn = document.getElementById("reserveSubmitBtn");
    const originalHTML = btn.innerHTML;
    setButtonState(btn, "loading");

    const nome     = document.getElementById("reserveNome").value.trim();
    const destino  = document.getElementById("reserveDestino").value;
    const data     = document.getElementById("reserveData").value;
    const pessoas  = parseInt(document.getElementById("reservePessoas").value, 10);
    const telefone = document.getElementById("reserveTelefone").value.trim();

    try {
      await addDoc(collection(db, "reservations"), {
        nome,
        destino,
        data,           // string ISO "YYYY-MM-DD"
        pessoas,
        telefone,
        status: "Pendente",
        criadoEm: serverTimestamp(),
      });

      // Mostrar mensagem de sucesso + limpar form
      form.reset();
      if (successMsg) {
        successMsg.style.display = "block";
        setTimeout(() => { successMsg.style.display = "none"; }, 6000);
      }
      setButtonState(btn, "success", originalHTML);
    } catch (err) {
      console.error("[forms.js] Erro ao gravar reserva:", err);
      alert("Ocorreu um erro ao enviar o pedido. Por favor, tente novamente.");
      setButtonState(btn, "error", originalHTML);
    }
  });
})();

