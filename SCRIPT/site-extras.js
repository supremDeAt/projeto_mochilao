/* =====================================================
   O MOCHILÃO — site-extras.js  (ES module)
   Aplica ao index.html o que se edita no admin → "Site Web":
   • siteConfig/sobre     → números da secção "Sobre"
   • siteConfig/contactos → telefone, email, WhatsApp e redes sociais
   Se o Firestore não responder, fica tudo como está no HTML.
   ===================================================== */

import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

/* ── Números (Viagens, Clientes, Satisfação) ── */
async function applyCounters() {
  const snap = await getDoc(doc(db, "siteConfig", "sobre"));
  const c = snap.exists() ? snap.data().contadores : null;
  if (!c) return;
  const values = [c.viagens, c.clientes, c.satisfacao];
  document.querySelectorAll("#counters .counter__num").forEach((el, i) => {
    const v = parseInt(values[i], 10);
    if (!Number.isFinite(v)) return;
    el.dataset.target = String(v);
    // Se a animação já correu, mostra logo o valor novo
    if (el.textContent.trim() !== "0") el.textContent = String(v);
  });
}

/* ── Contactos e redes ── */
const SOCIAL = {
  instagram: 'a[href*="instagram.com"]',
  tiktok: 'a[href*="tiktok.com"]',
  facebook: 'a[href*="facebook.com"]',
  whatsapp: 'a[href*="whatsapp.com"], a[href*="wa.me"]',
};

function links(selector) {
  // Os links de Instagram dos cards da equipa são pessoais → não mexer
  return [...document.querySelectorAll(selector)].filter((a) => !a.closest(".team-card"));
}

async function applyContacts() {
  const snap = await getDoc(doc(db, "siteConfig", "contactos"));
  if (!snap.exists()) return;
  const d = snap.data();

  if (d.telefone) {
    const tel = "tel:+" + d.telefone.replace(/\D/g, "").replace(/^(?!244)(9\d{8})$/, "244$1");
    links('a[href^="tel:"]').forEach((a) => {
      a.href = tel;
      if (/\d/.test(a.textContent)) a.textContent = d.telefone;
    });
  }

  if (d.email) {
    links('a[href^="mailto:"]').forEach((a) => {
      a.href = "mailto:" + d.email;
      if (a.textContent.includes("@")) a.textContent = d.email;
    });
  }

  if (d.whatsapp) {
    let digits = d.whatsapp.replace(/\D/g, "");
    if (digits.length === 9) digits = "244" + digits;
    links(SOCIAL.whatsapp).forEach((a) => (a.href = "https://wa.me/" + digits));
  }

  ["instagram", "tiktok", "facebook"].forEach((k) => {
    if (d[k] && /^https?:\/\//i.test(d[k])) links(SOCIAL[k]).forEach((a) => (a.href = d[k]));
  });
}

applyCounters().catch((err) => console.warn("[site] números:", err));
applyContacts().catch((err) => console.warn("[site] contactos:", err));