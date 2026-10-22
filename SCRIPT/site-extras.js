/* =====================================================
   O MOCHILÃO — site-extras.js  (ES module)
   Aplica ao index.html o que se edita no admin → "Site Web":
   • siteConfig/contactos → telefone, email, WhatsApp e redes sociais
   Se o Firestore não responder, fica tudo como está no HTML.
   ===================================================== */

import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

/* Números e restante secção "Sobre" → about-section.js */

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

applyContacts().catch((err) => console.warn("[site] contactos:", err));
