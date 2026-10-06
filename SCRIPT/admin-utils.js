/* =====================================================
   O MOCHILÃO — admin-utils.js  (ES module)
   Utilitários partilhados pelos ecrãs do painel admin.
   ===================================================== */

export function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Timestamp do Firestore, Date, número ou texto → Date (ou null). */
export function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return isNaN(value) ? null : value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "object" && typeof value.seconds === "number") {
    return new Date(value.seconds * 1000);
  }
  // "2026-10-20" → meia-noite local (evita o dia anterior por fuso horário)
  const s = String(value);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

export function formatDate(value, withTime = false) {
  const d = toDate(value);
  if (!d) return "–";
  const opts = { day: "2-digit", month: "short", year: "numeric" };
  if (withTime) Object.assign(opts, { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("pt-PT", opts).replace(/\./g, "");
}

/** "há 5 min", "há 3 h", "ontem", "12 out 2026" */
export function timeAgo(value) {
  const d = toDate(value);
  if (!d) return "–";
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "agora mesmo";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return "ontem";
  if (diff < 7 * 86400) return `há ${Math.floor(diff / 86400)} dias`;
  return formatDate(d);
}

export function formatKz(n) {
  const v = Math.round(Number(n) || 0);
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " Kz";
}

/** Valor compacto para o dashboard: 1.250.000 → "1,25 M Kz" */
export function formatKzShort(n) {
  const v = Number(n) || 0;
  if (v >= 1e6) return (v / 1e6).toFixed(v >= 1e7 ? 1 : 2).replace(".", ",") + " M Kz";
  if (v >= 1e4) return Math.round(v / 1e3) + " mil Kz";
  return formatKz(v);
}

export function toNumber(value) {
  if (typeof value === "number") return isFinite(value) ? value : 0;
  const digits = String(value || "").replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

/** Link de WhatsApp (números angolanos de 9 dígitos ganham o 244). */
export function waLink(phone, text = "") {
  let digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 9 && digits.startsWith("9")) digits = "244" + digits;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function slugClass(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Normaliza texto para pesquisa (sem acentos, minúsculas). */
export function searchable(...parts) {
  return parts
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/* ─────────────────────────────────────────
   TOAST (avisos discretos no canto do ecrã)
   ───────────────────────────────────────── */
let toastStack = null;

export function toast(message, type = "success") {
  if (!toastStack) {
    toastStack = document.createElement("div");
    toastStack.className = "toast-stack";
    toastStack.setAttribute("role", "status");
    toastStack.setAttribute("aria-live", "polite");
    document.body.appendChild(toastStack);
  }
  const icons = {
    success: "fa-circle-check",
    error: "fa-circle-exclamation",
    info: "fa-circle-info",
  };
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  el.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${esc(message)}</span>`;
  toastStack.appendChild(el);
  requestAnimationFrame(() => el.classList.add("is-visible"));
  setTimeout(() => {
    el.classList.remove("is-visible");
    setTimeout(() => el.remove(), 300);
  }, type === "error" ? 6000 : 3200);
}

/* ─────────────────────────────────────────
   EXPORTAR CSV (abre no Excel com acentos corretos)
   ───────────────────────────────────────── */
export function downloadCSV(filename, rows) {
  const cell = (v) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(cell).join(";")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Mostra um contador num link do menu lateral (0 → esconde). */
export function setNavBadge(view, count) {
  const link = document.querySelector(`.admin-nav__link[data-view="${view}"]`);
  if (!link) return;
  let badge = link.querySelector(".admin-nav__badge");
  if (!count) {
    badge?.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "admin-nav__badge";
    link.appendChild(badge);
  }
  badge.textContent = count > 99 ? "99+" : String(count);
}