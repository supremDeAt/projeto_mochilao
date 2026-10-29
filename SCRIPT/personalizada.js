/* =====================================================
   O MOCHILÃO — personalizada.js  (ES module)
   Página PAGES/personalizada.html — pedido de viagem à medida.

   Enviar → o pedido fica registado no painel admin
   (ecrã "Personalizadas") e aparece a confirmação, com um
   botão para continuar a conversa no WhatsApp.

   Coleção: customTrips/{id}
     nome, telefone, email, destino, pessoas, quando, duracao,
     tipo, interesses[], alojamento, orcamento, mensagem,
     status: "Novo", lido: false, origem: "pagina", criadoEm
   ===================================================== */

const DEFAULT_WA = "244926509821";
const SAUDACAO = "Olá O Mochilão! Gostaria de planear uma viagem personalizada.";

const form = document.getElementById("pcForm");
const errorEl = document.getElementById("pcError");
const submitBtn = document.getElementById("pcSubmit");
const doneEl = document.getElementById("pcDone");
const doneWpp = document.getElementById("pcDoneWpp");
const directWpp = document.getElementById("pcWppDirect");

let waNumber = DEFAULT_WA;
const waUrl = (text) => `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;

/* Firebase só é carregado quando é preciso */
let fb = null;
function firebase() {
  fb ??= Promise.all([
    import("./firebase-config.js"),
    import("https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js"),
  ]).then(([{ db }, fs]) => ({ db, ...fs }));
  return fb;
}

/* Número de WhatsApp definido no painel (Site Web → Contactos) */
if (directWpp) directWpp.href = waUrl(SAUDACAO);
firebase()
  .then(async ({ db, doc, getDoc }) => {
    const snap = await getDoc(doc(db, "siteConfig", "contactos"));
    let n = String((snap.exists() && snap.data().whatsapp) || "").replace(/\D/g, "");
    if (n.length === 9) n = "244" + n;
    if (n.length >= 9) waNumber = n;
    if (directWpp) directWpp.href = waUrl(SAUDACAO);
  })
  .catch(() => {});

/* ─────────────────────────────────────────
   LER O FORMULÁRIO
   ───────────────────────────────────────── */
const clip = (v, max) => String(v || "").trim().slice(0, max);

function readForm() {
  const f = form.elements;
  const radio = (name) => form.querySelector(`input[name="${name}"]:checked`)?.value || "";
  return {
    nome: clip(f.nome.value, 80),
    telefone: clip(f.telefone.value, 20),
    email: clip(f.email.value, 120),
    destino: clip(f.destino.value, 120),
    pessoas: Math.max(0, Math.min(500, parseInt(f.pessoas.value, 10) || 0)),
    quando: clip(f.quando.value, 60),
    duracao: clip(f.duracao.value, 40),
    tipo: clip(radio("tipo"), 40),
    interesses: Array.from(form.querySelectorAll('input[name="interesses"]:checked'))
      .map((i) => clip(i.value, 30))
      .slice(0, 12),
    alojamento: clip(radio("alojamento"), 40),
    orcamento: clip(f.orcamento.value, 40),
    mensagem: clip(f.mensagem.value, 1500),
  };
}

/** Resumo em texto (mensagem do WhatsApp e aviso por email) */
function summary(d) {
  return [
    `Nome: ${d.nome}`,
    d.destino && `Destino: ${d.destino}`,
    d.quando && `Quando: ${d.quando}`,
    d.duracao && `Duração: ${d.duracao}`,
    d.pessoas && `Pessoas: ${d.pessoas}`,
    d.tipo && `Grupo: ${d.tipo}`,
    d.interesses.length && `Interesses: ${d.interesses.join(", ")}`,
    d.alojamento && `Alojamento: ${d.alojamento}`,
    d.orcamento && `Orçamento por pessoa: ${d.orcamento}`,
    d.mensagem && `Mensagem: ${d.mensagem}`,
  ].filter(Boolean);
}

/* ─────────────────────────────────────────
   ERROS
   ───────────────────────────────────────── */
function showError(msg, field) {
  errorEl.textContent = msg;
  errorEl.hidden = false;
  if (field) {
    field.classList.add("is-invalid");
    field.focus();
  }
}
form?.addEventListener("input", (e) => {
  e.target.classList?.remove("is-invalid");
  errorEl.hidden = true;
});

/* ─────────────────────────────────────────
   ENVIAR
   ───────────────────────────────────────── */
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = form.elements;
  const data = readForm();

  if (!data.nome) return showError("Indique o seu nome.", f.nome);
  if (data.telefone.replace(/\D/g, "").length < 9) return showError("Indique um telefone válido.", f.telefone);
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return showError("O email não parece correto.", f.email);
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A enviar…';

  try {
    const { db, collection, addDoc, serverTimestamp } = await firebase();
    await addDoc(collection(db, "customTrips"), {
      ...data,
      status: "Novo",
      lido: false,
      origem: "pagina",
      criadoEm: serverTimestamp(),
    });
  } catch (err) {
    console.error("[personalizada] Pedido não registado:", err);
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Enviar pedido <i class="fa-solid fa-paper-plane"></i>';
    const wa = waUrl([SAUDACAO, "", ...summary(data)].join("\n"));
    errorEl.innerHTML =
      `Não foi possível enviar o pedido agora. ` +
      `<a href="${wa}" target="_blank" rel="noopener">Envie-o pelo WhatsApp</a> — os seus dados já vão escritos.`;
    errorEl.hidden = false;
    return;
  }

  // Aviso por email à equipa (se o EmailJS estiver configurado)
  import("./notify-admin.js")
    .then((m) =>
      m.notifyNewMessage?.({
        nome: data.nome,
        telefone: data.telefone,
        email: data.email,
        assunto: `Viagem personalizada${data.destino ? ": " + data.destino : ""}`,
        mensagem: [...summary(data).slice(1), "", "Veja no painel → Personalizadas."].join("\n"),
      }),
    )
    .catch(() => {});

  // Confirmação
  const primeiro = data.nome.split(" ")[0];
  document.getElementById("pcDoneText").textContent =
    `Obrigado, ${primeiro}! A nossa equipa vai preparar a proposta e contactá-lo em breve pelo ${data.telefone}.`;
  doneWpp.href = waUrl([SAUDACAO, "Acabei de enviar o pedido pelo site.", "", ...summary(data)].join("\n"));
  form.hidden = true;
  doneEl.hidden = false;
  doneEl.focus({ preventScroll: true });
  doneEl.scrollIntoView({ behavior: "smooth", block: "center" });
});
