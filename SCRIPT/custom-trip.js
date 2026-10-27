/* =====================================================
   O MOCHILÃO — custom-trip.js  (ES module)
   Secção "Viagens Personalizadas" do index.

   Botão "Planear no WhatsApp" → janela curta (nome, telefone,
   destino, pessoas, quando) → abre o WhatsApp com a mensagem
   já escrita e regista o pedido no painel admin.

   Coleção: customTrips/{id}
     nome, telefone, destino, pessoas, quando,
     status: "Novo", lido: false, origem: "site", criadoEm
   ===================================================== */

const DEFAULT_WA = "244926509821";

const modal = document.getElementById("customModal");
const form = document.getElementById("customForm");
const errorEl = document.getElementById("customError");
let waNumber = DEFAULT_WA;
let lastFocus = null;

/* Firebase só é carregado quando é preciso (a página não fica mais lenta) */
let fb = null;
function firebase() {
  fb ??= Promise.all([
    import("./firebase-config.js"),
    import("https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js"),
  ]).then(([{ db }, fs]) => ({ db, ...fs }));
  return fb;
}

/* Número de WhatsApp definido no painel (Site Web → Contactos) */
firebase()
  .then(async ({ db, doc, getDoc }) => {
    const snap = await getDoc(doc(db, "siteConfig", "contactos"));
    let n = String((snap.exists() && snap.data().whatsapp) || "").replace(/\D/g, "");
    if (n.length === 9) n = "244" + n;
    if (n.length >= 9) waNumber = n;
  })
  .catch(() => {});

const waUrl = (text) => `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;

function openWhatsApp(text) {
  const url = waUrl(text);
  // Tem de abrir já (no clique), senão o navegador bloqueia a janela
  // (sem "noopener" no 3.º argumento: com ele o window.open devolve sempre null)
  const win = window.open(url, "_blank");
  if (win) win.opener = null;
  else window.location.href = url;
}

/* ─────────────────────────────────────────
   JANELA
   ───────────────────────────────────────── */
function open() {
  if (!modal) return openWhatsApp("Olá O Mochilão! Gostaria de planear uma viagem personalizada.");
  lastFocus = document.activeElement;
  modal.hidden = false;
  document.body.classList.add("custom-modal-open");
  errorEl.hidden = true;
  form.querySelector("input")?.focus();
}

function close() {
  modal.hidden = true;
  document.body.classList.remove("custom-modal-open");
  lastFocus?.focus?.();
}

document.querySelectorAll("[data-custom-open]").forEach((b) => b.addEventListener("click", open));
modal?.querySelector("[data-custom-close]")?.addEventListener("click", close);
modal?.addEventListener("click", (e) => {
  if (e.target === modal) close();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal && !modal.hidden) close();
});

modal?.querySelector("[data-custom-skip]")?.addEventListener("click", (e) => {
  e.preventDefault();
  openWhatsApp("Olá O Mochilão! Gostaria de planear uma viagem personalizada.");
  close();
});

/* ─────────────────────────────────────────
   ENVIO
   ───────────────────────────────────────── */
function showError(msg, field) {
  errorEl.textContent = msg;
  errorEl.hidden = false;
  if (field) {
    field.classList.add("is-invalid");
    field.focus();
  }
}

form?.addEventListener("input", (e) => e.target.classList?.remove("is-invalid"));

form?.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = form.elements;
  const data = {
    nome: f.nome.value.trim().slice(0, 80),
    telefone: f.telefone.value.trim().slice(0, 20),
    destino: f.destino.value.trim().slice(0, 120),
    pessoas: Math.max(0, Math.min(500, parseInt(f.pessoas.value, 10) || 0)),
    quando: f.quando.value.trim().slice(0, 60),
  };

  if (!data.nome) return showError("Indique o seu nome.", f.nome);
  if (data.telefone.replace(/\D/g, "").length < 9) return showError("Indique um telefone válido.", f.telefone);

  const detalhes = [
    `Nome: ${data.nome}`,
    data.destino && `Destino: ${data.destino}`,
    data.pessoas && `Pessoas: ${data.pessoas}`,
    data.quando && `Quando: ${data.quando}`,
  ].filter(Boolean);

  // 1. WhatsApp abre logo
  openWhatsApp(["Olá O Mochilão! Gostaria de planear uma viagem personalizada.", "", ...detalhes].join("\n"));

  // 2. O pedido fica registado no painel (em segundo plano)
  firebase()
    .then(({ db, collection, addDoc, serverTimestamp }) =>
      addDoc(collection(db, "customTrips"), {
        ...data,
        status: "Novo",
        lido: false,
        origem: "site",
        criadoEm: serverTimestamp(),
      }),
    )
    .then(() =>
      // 3. Aviso por email à equipa (se o EmailJS estiver configurado)
      import("./notify-admin.js")
        .then((m) =>
          m.notifyNewMessage?.({
            nome: data.nome,
            telefone: data.telefone,
            assunto: `Viagem personalizada${data.destino ? ": " + data.destino : ""}`,
            mensagem: [
              data.destino && `Destino: ${data.destino}`,
              data.pessoas && `Pessoas: ${data.pessoas}`,
              data.quando && `Quando: ${data.quando}`,
              "Pedido feito na secção Viagens Personalizadas. Veja no painel → Personalizadas.",
            ]
              .filter(Boolean)
              .join("\n"),
          }),
        )
        .catch(() => {}),
    )
    .catch((err) => console.warn("[personalizadas] Pedido não registado no painel:", err));

  form.reset();
  close();
});
