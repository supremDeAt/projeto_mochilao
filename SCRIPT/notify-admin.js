/* =====================================================
   O MOCHILÃO — notify-admin.js  (ES module)
   Avisa a equipa por email (EmailJS) quando chega
   uma nova MENSAGEM ou uma nova RESERVA no site.

   Uso:
     import { notifyNewMessage, notifyNewReservation } from "./notify-admin.js";
     notifyNewMessage({ nome, email, telefone, assunto, mensagem });
     notifyNewReservation({ ref, clienteInfo, itens, total });

   • Nunca bloqueia o cliente: se o EmailJS falhar, a mensagem/
     reserva já está gravada no Firestore e só fica um aviso na consola.
   • Os destinatários (emails da equipa) definem-se no painel do
     EmailJS → template → "To Email", não aqui.
   ===================================================== */

import emailjs from "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/+esm";

/* ─────────────────────────────────────────
   CONFIGURAÇÃO — copiar do painel do EmailJS
   ───────────────────────────────────────── */
const EMAILJS = {
  publicKey: "R5Femg5uCIC-Lh0RW", // Account → General → Public Key
  serviceId: "service_8fq9usa", // Email Services → (ex.: service_xxxxx)
  templateId: "template_stk1ler", // Email Templates → (ex.: template_xxxxx)
};

// login.html fica em PAGES/, este ficheiro em SCRIPT/ → funciona em qualquer página
const LOGIN_URL = new URL("../PAGES/login.html", import.meta.url).href;

const TIMEOUT_MS = 10000;

/* ─────────────────────────────────────────
   UTILITÁRIOS
   ───────────────────────────────────────── */
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatKz(n) {
  const v = Math.round(Number(n) || 0);
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " Kz";
}

function formatDate(value) {
  if (!value) return "–";
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(value);
  return isNaN(d) ? String(value) : d.toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" });
}

function nowLabel() {
  return new Date().toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ── Blocos HTML do email (estilos inline: obrigatório em email) ── */
const FONT = "font-family:Arial, Helvetica, sans-serif;";

function detailsTable(rows) {
  const body = rows
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(
      ([label, value], i) => `
      <tr>
        <td class="detail-label" width="34%" style="${FONT} padding:11px 14px; ${i ? "border-top:1px solid #ece4d8;" : ""} font-size:11px; font-weight:bold; letter-spacing:1px; text-transform:uppercase; color:#7a6552; vertical-align:top;">${esc(label)}</td>
        <td class="detail-value" style="${FONT} padding:11px 14px; ${i ? "border-top:1px solid #ece4d8;" : ""} font-size:14px; line-height:21px; color:#1a1208; vertical-align:top;">${value}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #ece4d8; border-radius:12px; border-collapse:separate; background:#faf8f4; margin:0 0 20px;">${body}</table>`;
}

function quoteBlock(title, text) {
  if (!text) return "";
  return `
    <p style="${FONT} margin:0 0 8px; font-size:11px; font-weight:bold; letter-spacing:1px; text-transform:uppercase; color:#7a6552;">${esc(title)}</p>
    <div style="${FONT} margin:0 0 20px; padding:16px 18px; border-left:3px solid #c9962a; background:#fbf6ea; border-radius:0 10px 10px 0; font-size:14px; line-height:22px; color:#1a1208;">
      ${esc(text).replace(/\n/g, "<br>")}
    </div>`;
}

function itemsTable(itens) {
  const rows = itens
    .map((i, n) => {
      const line = n ? "border-top:1px solid #ece4d8; " : "";
      return `
      <tr>
        <td style="${FONT} padding:12px 14px; ${line}font-size:14px; color:#1a1208;">
          <strong>${esc(i.nome || "Programa")}</strong><br>
          <span style="font-size:12px; color:#7a6552;">${esc(formatDate(i.data))} · ${esc(i.pax || 1)} pessoa${Number(i.pax) === 1 ? "" : "s"}</span>
        </td>
        <td align="right" style="${FONT} padding:12px 14px; ${line}font-size:14px; font-weight:bold; color:#1a1208; white-space:nowrap;">${i.total ? esc(formatKz(i.total)) : "–"}</td>
      </tr>`;
    })
    .join("");
  return `
    <p style="${FONT} margin:0 0 8px; font-size:11px; font-weight:bold; letter-spacing:1px; text-transform:uppercase; color:#7a6552;">Programas reservados</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #ece4d8; border-radius:12px; border-collapse:separate; margin:0 0 20px;">
      ${rows}
    </table>`;
}

const link = (href, text) => `<a href="${esc(href)}" style="color:#4d351e; font-weight:bold;">${esc(text)}</a>`;

function contactLinks({ email, telefone }) {
  const tel = String(telefone || "").replace(/\D/g, "");
  const wa = tel ? (tel.length === 9 ? "244" + tel : tel) : "";
  return {
    email: email ? link(`mailto:${email}`, email) : "",
    telefone: telefone
      ? `${esc(telefone)}${wa ? ` &nbsp;·&nbsp; ${link(`https://wa.me/${wa}`, "WhatsApp")}` : ""}`
      : "",
  };
}

/* ─────────────────────────────────────────
   ENVIO
   ───────────────────────────────────────── */
async function send(params) {
  if (EMAILJS.publicKey.startsWith("SUA_")) {
    console.warn("[notify] EmailJS ainda não configurado (notify-admin.js).");
    return false;
  }
  try {
    await Promise.race([
      emailjs.send(
        EMAILJS.serviceId,
        EMAILJS.templateId,
        { login_url: LOGIN_URL, botao_texto: "Abrir o painel", data_hora: nowLabel(), ...params },
        { publicKey: EMAILJS.publicKey },
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)),
    ]);
    return true;
  } catch (err) {
    // Não incomoda o cliente: o registo já está no Firestore
    console.warn("[notify] Email para a equipa não enviado:", err?.text || err?.message || err);
    return false;
  }
}

/** Nova mensagem do formulário de contacto. */
export function notifyNewMessage({ nome, email, telefone, assunto, mensagem }) {
  const c = contactLinks({ email, telefone });
  const conteudo =
    detailsTable([
      ["Cliente", esc(nome || "Sem nome")],
      ["Email", c.email],
      ["Telefone", c.telefone],
      ["Assunto", esc(assunto || "Sem assunto")],
    ]) + quoteBlock("Mensagem", mensagem);

  return send({
    assunto_email: `✉️ Nova mensagem: ${assunto || "contacto pelo site"} — ${nome || "cliente"}`,
    preheader: `${nome || "Um cliente"} escreveu: ${String(mensagem || "").slice(0, 90)}`,
    tipo_label: "Nova mensagem",
    tipo_cor: "#3a5f8a",
    titulo: "Chegou uma nova mensagem",
    intro: `${nome || "Um cliente"} enviou uma mensagem pelo formulário de contacto do site. Responda a partir do painel, separador “Mensagens”.`,
    conteudo_html: conteudo,
    reply_to: email || "",
    nome_cliente: nome || "",
  });
}

/** Nova reserva do checkout (carrinho). */
export function notifyNewReservation({
  ref,
  clienteInfo = {},
  itens = [],
  total = 0,
  estado = "Aguardando pagamento",
  intro = "",
}) {
  const c = contactLinks(clienteInfo);
  const pax = itens.reduce((s, i) => s + (Number(i.pax) || 0), 0);
  const conteudo =
    detailsTable([
      ["Referência", `<strong style="font-family:'Courier New', monospace; letter-spacing:1px;">${esc(ref || "–")}</strong>`],
      ["Cliente", esc(clienteInfo.nome || "Sem nome")],
      ["Email", c.email],
      ["Telefone", c.telefone],
      ["Pessoas", esc(pax || "–")],
      ["Total", total ? `<strong style="font-size:17px; color:#4d351e;">${esc(formatKz(total))}</strong>` : "A definir"],
      ["Estado", `<span style="display:inline-block; padding:3px 10px; border-radius:999px; background:#f6ead0; color:#8c6717; font-size:12px; font-weight:bold;">${esc(estado)}</span>`],
    ]) + (itens.length ? itemsTable(itens) : "");

  const programas = itens.map((i) => i.nome).filter(Boolean).join(", ");
  return send({
    assunto_email: `🧭 Nova reserva ${ref || ""} — ${clienteInfo.nome || "cliente"}${total ? " · " + formatKz(total) : ""}`,
    preheader: `${programas || "Nova reserva"} · ${pax} pessoa${pax === 1 ? "" : "s"}${total ? " · " + formatKz(total) : ""}`,
    tipo_label: "Nova reserva",
    tipo_cor: "#2e7d5b",
    titulo: `Nova reserva ${ref || ""}`.trim(),
    intro:
      intro ||
      `${clienteInfo.nome || "Um cliente"} fez uma reserva no site e vai pagar por transferência. Confirme o pagamento e atualize o estado no painel, separador “Reservas”.`,
    conteudo_html: conteudo,
    reply_to: clienteInfo.email || "",
    nome_cliente: clienteInfo.nome || "",
  });
}