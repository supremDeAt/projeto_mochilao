/* =====================================================
   O MOCHILÃO — testemunho-form.js  (ES module)
   Formulário "Partilhe a sua experiência"
   (PAGES/testemunhos.html#enviar)

   Grava em "testimonials" com status "pendente".
   Nada aparece no site sem ser aprovado no painel
   (Site Web → Testemunhos).
   A foto é reduzida no próprio telemóvel/computador
   (≈ 240 px) e guardada com o testemunho.
   ===================================================== */

import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const MIN_TEXT = 20;
const MAX_TEXT = 1500;
const MAX_PHOTO_MB = 15;
const WAIT_MS = 10 * 60 * 1000; // 1 envio a cada 10 minutos (por navegador)
const LAST_KEY = "mochilao-testemunho-enviado";

const form = document.getElementById("tmForm");
if (form) init();

/* ─────────────────────────────────────────
   FOTO → miniatura quadrada (data URL)
   ───────────────────────────────────────── */
export async function avatarFromFile(file, size = 240) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Não foi possível ler esta imagem."));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    canvas.getContext("2d").drawImage(img, sx, sy, side, side, 0, 0, size, size);
    for (const q of [0.82, 0.7, 0.55]) {
      let data = canvas.toDataURL("image/webp", q);
      if (!data.startsWith("data:image/webp")) data = canvas.toDataURL("image/jpeg", q);
      if (data.length <= 60000) return data;
    }
    throw new Error("A foto é demasiado pesada. Experimente outra.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function init() {
  const $ = (id) => document.getElementById(id);
  const els = {
    nome: $("tmNome"),
    local: $("tmLocal"),
    programa: $("tmPrograma"),
    texto: $("tmTexto"),
    count: $("tmTextoCount"),
    foto: $("tmFoto"),
    fotoBox: form.querySelector(".tm-photo"),
    fotoPrev: $("tmFotoPreview"),
    fotoText: $("tmFotoText"),
    fotoRemove: $("tmFotoRemove"),
    consent: $("tmConsent"),
    hp: $("tmSite"),
    submit: $("tmSubmit"),
    status: $("tmStatus"),
    thanks: $("tmThanks"),
    again: $("tmAgain"),
  };
  let fotoData = "";
  const fotoPrevHTML = els.fotoPrev.outerHTML;

  /* Programas para escolher (os do painel, ativos) */
  getDocs(collection(db, "programs"))
    .then((snap) => {
      const progs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => p.ativo !== false && p.nome)
        .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt"));
      const other = els.programa.querySelector('option[value="__outro"]');
      progs.forEach((p) => other.before(new Option(p.nome, p.id)));
      // Veio de um programa (testemunhos.html?programa=ID)
      const want = new URLSearchParams(location.search).get("programa");
      if (want && progs.some((p) => p.id === want)) els.programa.value = want;
    })
    .catch((err) => console.warn("[testemunho] programas:", err));

  /* Contador do texto */
  const updateCount = () => {
    const n = els.texto.value.trim().length;
    els.count.textContent = `${n} / ${MAX_TEXT}`;
  };
  els.texto.addEventListener("input", updateCount);
  updateCount();

  /* Foto */
  const setFoto = (data, name = "") => {
    fotoData = data;
    if (data) {
      const img = document.createElement("img");
      img.className = "tm-photo__preview";
      img.id = "tmFotoPreview";
      img.alt = "";
      img.src = data;
      $("tmFotoPreview").replaceWith(img);
      els.fotoText.innerHTML = `<strong>Foto escolhida</strong>${name ? name.replace(/[<>&]/g, "") : ""}`;
    } else {
      $("tmFotoPreview").outerHTML = fotoPrevHTML;
      els.fotoText.innerHTML = "<strong>Adicionar foto</strong>Clique ou arraste uma foto sua (opcional)";
    }
    els.fotoRemove.hidden = !data;
  };

  const handleFile = async (file) => {
    setFieldError("tmFoto", "");
    if (!file) return;
    if (!file.type.startsWith("image/")) return setFieldError("tmFoto", "Escolha um ficheiro de imagem.");
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) return setFieldError("tmFoto", `A foto tem mais de ${MAX_PHOTO_MB} MB.`);
    try {
      els.fotoText.innerHTML = "<strong>A preparar a foto…</strong>";
      setFoto(await avatarFromFile(file), file.name);
    } catch (err) {
      setFoto("");
      setFieldError("tmFoto", err.message);
    }
  };

  els.foto.addEventListener("change", () => {
    handleFile(els.foto.files?.[0]);
    els.foto.value = "";
  });
  ["dragenter", "dragover"].forEach((ev) =>
    els.fotoBox.addEventListener(ev, (e) => {
      e.preventDefault();
      els.fotoBox.classList.add("is-drag");
    }),
  );
  ["dragleave", "drop"].forEach((ev) =>
    els.fotoBox.addEventListener(ev, (e) => {
      e.preventDefault();
      els.fotoBox.classList.remove("is-drag");
      if (ev === "drop") handleFile(e.dataTransfer?.files?.[0]);
    }),
  );
  els.fotoRemove.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setFoto("");
  });

  /* Erros */
  function setFieldError(id, msg) {
    const el = $(id);
    const err = form.querySelector(`[data-error-for="${id}"]`);
    if (err) err.textContent = msg || "";
    if (el && el.classList.contains("tm-form__input")) el.classList.toggle("is-invalid", !!msg);
    return !msg;
  }
  form.addEventListener("input", (e) => {
    if (e.target.id) setFieldError(e.target.id, "");
    els.status.textContent = "";
  });

  function validate() {
    const nome = els.nome.value.trim().replace(/\s+/g, " ");
    const texto = els.texto.value.trim();
    const estrelas = parseInt(form.querySelector('input[name="estrelas"]:checked')?.value, 10) || 0;
    let first = null;
    const check = (ok, id, msg) => {
      setFieldError(id, ok ? "" : msg);
      if (!ok && !first) first = $(id) || form.querySelector(`[data-error-for="${id}"]`);
    };
    check(nome.length >= 2, "tmNome", "Indique o seu nome.");
    check(estrelas >= 1, "tmEstrelas", "Escolha de 1 a 5 estrelas.");
    check(
      texto.length >= MIN_TEXT && texto.length <= MAX_TEXT,
      "tmTexto",
      texto.length < MIN_TEXT
        ? `Conte-nos um pouco mais (mínimo ${MIN_TEXT} caracteres).`
        : `O texto tem mais de ${MAX_TEXT} caracteres.`,
    );
    check(els.consent.checked, "tmConsent", "É preciso autorizar a publicação.");
    if (first) {
      first.scrollIntoView({ block: "center", behavior: "smooth" });
      first.focus?.({ preventScroll: true });
      return null;
    }
    const sel = els.programa.selectedOptions[0];
    const prog = els.programa.value;
    return {
      nome: nome.slice(0, 60),
      local: els.local.value.trim().slice(0, 60),
      programaId: prog && prog !== "__outro" ? prog : "",
      programaNome: prog === "__outro" ? "Viagem personalizada" : prog ? sel.textContent.trim().slice(0, 100) : "",
      estrelas,
      texto,
      foto: fotoData,
    };
  }

  /* Envio */
  let sending = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending) return;
    els.status.textContent = "";

    // Campo-isco preenchido = robô → finge que correu bem
    if (els.hp.value) return showThanks();

    const data = validate();
    if (!data) return;

    let last = 0;
    try {
      last = Number(localStorage.getItem(LAST_KEY)) || 0;
    } catch {}
    if (Date.now() - last < WAIT_MS) {
      els.status.textContent = "Já recebemos um testemunho deste dispositivo há pouco. Tente de novo daqui a alguns minutos.";
      return;
    }

    sending = true;
    els.submit.disabled = true;
    const label = els.submit.innerHTML;
    els.submit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A enviar…';
    try {
      await addDoc(collection(db, "testimonials"), {
        ...data,
        status: "pendente",
        destaque: false,
        origem: "site",
        criadoEm: serverTimestamp(),
      });
      try {
        localStorage.setItem(LAST_KEY, String(Date.now()));
      } catch {}
      showThanks();
    } catch (err) {
      console.error("[testemunho]", err);
      els.status.textContent =
        err?.code === "permission-denied"
          ? "Não foi possível enviar (permissões). Contacte-nos pelo WhatsApp."
          : "Ocorreu um erro de ligação. Verifique a internet e tente novamente.";
    } finally {
      sending = false;
      els.submit.disabled = false;
      els.submit.innerHTML = label;
    }
  });

  function showThanks() {
    form.hidden = true;
    els.thanks.hidden = false;
    els.thanks.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  els.again?.addEventListener("click", () => {
    form.reset();
    setFoto("");
    updateCount();
    els.thanks.hidden = true;
    form.hidden = false;
  });
}
