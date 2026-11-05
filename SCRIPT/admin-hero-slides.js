/* =====================================================
   O MOCHILÃO — admin-hero-slides.js  (ES module)
   Admin → Site Web → Hero → "Fotos do fundo (slide)"

   Fotos que passam suavemente no fundo do hero da página inicial.
   O bloco é acrescentado ao separador "Hero" por este ficheiro.
   Arranca sozinho: basta esta linha no fim do admin.html
     <script type="module" src="../SCRIPT/admin-hero-slides.js"></script>

   Dados: siteConfig/hero-slides = { slides: [{ id, url }], intervalo }
   ===================================================== */

import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { compressToDataURL } from "./image-store.js";
import { esc, toast } from "./admin-utils.js";
import { HS_DOC, HS_DEFAULT_INTERVAL, startHeroSlides } from "./hero-slides.js";

const MAX_SLIDES = 8;
// Com o Cloudinary fica só o link; sem ele, a foto vai reduzida para caber no Firestore
const PHOTO = { maxPx: 1920, maxChars: 110000 };
const MAX_DOC_CHARS = 900000;
const newId = () => "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function initHeroSlidesAdmin({ db, canEdit = false }) {
  const pane = document.querySelector('#conteudo [data-content-pane="hero"]');
  if (!pane || pane.querySelector(".hs-admin")) return;

  for (const href of ["../STYLES/admin-hero-slides.css", "../STYLES/hero-slides.css"]) {
    if (!document.querySelector(`link[href="${href}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    }
  }

  const dis = canEdit ? "" : "disabled";
  const box = document.createElement("section");
  box.className = "hs-admin";
  box.innerHTML = `
    <div class="hs-admin__head">
      <div>
        <h3 class="hs-admin__title">Fotos do fundo (slide)</h3>
        <p class="hs-admin__help">
          As fotos passam suavemente no fundo do topo da página inicial, umas atrás das outras.
          Sem fotos aqui, fica a “Foto de fundo” acima. Até ${MAX_SLIDES} fotos, pela ordem desta lista.
          Prefira fotos horizontais (1920×1080).
        </p>
      </div>
      <label class="hs-admin__interval">
        <span>Cada foto fica</span>
        <select data-hs-interval ${dis}>
          ${[4, 5, 6, 7, 8, 10, 12, 15].map((s) => `<option value="${s}">${s} segundos</option>`).join("")}
        </select>
      </label>
    </div>

    <div class="hs-admin__body">
      <ol class="hs-admin__list" data-hs-list></ol>
      <div class="hs-admin__preview">
        <span class="hs-admin__preview-label">Pré-visualização</span>
        <div class="hs-admin__stage" data-hs-stage>
          <span class="hs-admin__stage-empty" data-hs-empty>Sem fotos: fica a foto de fundo normal.</span>
        </div>
      </div>
    </div>

    ${
      canEdit
        ? `<label class="dyn-add hs-admin__add" data-hs-add>
            <i class="fa-solid fa-plus"></i> Adicionar fotos
            <input type="file" accept="image/*" multiple class="visually-hidden" data-hs-file />
          </label>`
        : ""
    }
    <p class="hs-admin__busy" data-hs-busy hidden><i class="fa-solid fa-spinner fa-spin"></i> <span>A preparar as fotos…</span></p>

    <div class="content-actions">
      <button type="button" class="btn btn--primary" data-hs-publish ${dis}>Publicar slide <i class="fa-solid fa-check"></i></button>
      <button type="button" class="btn btn--outline" data-hs-discard ${dis}>Descartar</button>
      <span class="content-dirty" data-hs-dirty hidden><i class="fa-solid fa-circle"></i> Alterações por publicar</span>
    </div>`;
  pane.appendChild(box);

  const $ = (sel) => box.querySelector(sel);
  const list = $("[data-hs-list]");
  const stage = $("[data-hs-stage]");

  let published = { slides: [], intervalo: HS_DEFAULT_INTERVAL };
  let draft = structuredClone(published);
  let dirty = false;
  let stopPreview = () => {};

  const setDirty = (v) => {
    dirty = v;
    $("[data-hs-dirty]").hidden = !v;
  };

  function renderList() {
    list.innerHTML = draft.slides
      .map(
        (s, i) => `
        <li class="hs-item" data-i="${i}">
          <img src="${esc(s.url)}" alt="" loading="lazy" />
          <span class="hs-item__num">${i + 1}</span>
          ${
            canEdit
              ? `<div class="hs-item__tools">
                  <button type="button" data-hs-move="-1" title="Mais cedo" ${i === 0 ? "disabled" : ""}><i class="fa-solid fa-arrow-left"></i></button>
                  <button type="button" data-hs-move="1" title="Mais tarde" ${i === draft.slides.length - 1 ? "disabled" : ""}><i class="fa-solid fa-arrow-right"></i></button>
                  <button type="button" class="is-danger" data-hs-remove title="Remover"><i class="fa-regular fa-trash-can"></i></button>
                </div>`
              : ""
          }
        </li>`,
      )
      .join("");
    const add = $("[data-hs-add]");
    if (add) add.classList.toggle("is-disabled", draft.slides.length >= MAX_SLIDES);
  }

  function renderPreview() {
    stopPreview();
    $("[data-hs-empty]").hidden = draft.slides.length > 0;
    stopPreview = startHeroSlides(stage, draft);
  }

  const renderAll = () => {
    $("[data-hs-interval]").value = String(draft.intervalo);
    renderList();
    renderPreview();
  };

  onSnapshot(doc(db, "siteConfig", HS_DOC), (snap) => {
    const d = snap.exists() ? snap.data() : {};
    published = {
      slides: (Array.isArray(d.slides) ? d.slides : [])
        .filter((s) => s && s.url)
        .map((s) => ({ id: String(s.id || newId()), url: String(s.url) })),
      intervalo: parseInt(d.intervalo, 10) || HS_DEFAULT_INTERVAL,
    };
    if (!dirty) {
      draft = structuredClone(published);
      renderAll();
    }
  });

  /* ── Edição ── */
  $("[data-hs-interval]").addEventListener("change", (e) => {
    draft.intervalo = parseInt(e.target.value, 10) || HS_DEFAULT_INTERVAL;
    setDirty(true);
    renderPreview();
  });

  $("[data-hs-file]")?.addEventListener("change", async (e) => {
    const files = [...(e.target.files || [])].filter((f) => f.type.startsWith("image/"));
    e.target.value = "";
    if (!files.length) return;
    const free = MAX_SLIDES - draft.slides.length;
    if (free <= 0) return toast(`O slide tem no máximo ${MAX_SLIDES} fotos.`, "error");
    if (files.length > free) toast(`Só cabem mais ${free} foto(s); as restantes foram ignoradas.`, "error");
    const busy = $("[data-hs-busy]");
    busy.hidden = false;
    let added = 0;
    for (const [n, file] of files.slice(0, free).entries()) {
      busy.querySelector("span").textContent = `A preparar as fotos… ${n + 1}/${Math.min(files.length, free)}`;
      try {
        draft.slides.push({ id: newId(), url: await compressToDataURL(file, PHOTO) });
        added++;
      } catch (err) {
        toast(err?.message || `Não foi possível usar "${file.name}".`, "error");
      }
    }
    busy.hidden = true;
    if (added) {
      setDirty(true);
      renderList();
      renderPreview();
    }
  });

  list.addEventListener("click", (e) => {
    const item = e.target.closest("[data-i]");
    if (!item) return;
    const i = +item.dataset.i;
    const mv = e.target.closest("[data-hs-move]");
    if (mv) {
      const j = i + Number(mv.dataset.hsMove);
      if (j < 0 || j >= draft.slides.length) return;
      [draft.slides[i], draft.slides[j]] = [draft.slides[j], draft.slides[i]];
    } else if (e.target.closest("[data-hs-remove]")) {
      if (!confirm("Remover esta foto do slide?")) return;
      draft.slides.splice(i, 1);
    } else return;
    setDirty(true);
    renderList();
    renderPreview();
  });

  $("[data-hs-discard]")?.addEventListener("click", () => {
    draft = structuredClone(published);
    setDirty(false);
    renderAll();
  });

  $("[data-hs-publish]")?.addEventListener("click", async (e) => {
    const data = { slides: draft.slides.map((s) => ({ id: s.id, url: s.url })), intervalo: draft.intervalo };
    if (JSON.stringify(data).length > MAX_DOC_CHARS) {
      return toast("As fotos ocupam demasiado espaço. Use menos fotos (ou ative o Cloudinary).", "error");
    }
    const btn = e.currentTarget;
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A publicar…';
    try {
      await setDoc(doc(db, "siteConfig", HS_DOC), { ...data, atualizadoEm: serverTimestamp() });
      setDirty(false);
      toast(data.slides.length ? "Slide do hero atualizado." : "Slide desligado: fica a foto de fundo normal.");
    } catch (err) {
      console.error("[hero slide]", err);
      toast(err?.code === "permission-denied" ? "Sem permissão para alterar o site." : err?.message || "Erro ao publicar.", "error");
    } finally {
      btn.disabled = !canEdit;
      btn.innerHTML = original;
    }
  });

  window.addEventListener("beforeunload", (e) => {
    if (dirty) e.preventDefault();
  });

  renderAll();
}

/* ─────────────────────────────────────────
   ARRANQUE AUTOMÁTICO (sem mexer no admin.js)
   ───────────────────────────────────────── */
const EDIT_ROLES = ["Super Admin", "Gestor de Conteúdo"];

async function autoStart() {
  try {
    const [{ auth, db }, { onAuthStateChanged }, { getDoc }] = await Promise.all([
      import("./firebase-config.js"),
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js"),
    ]);
    onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      let canEdit = false;
      try {
        const snap = await getDoc(doc(db, "admins", user.uid));
        const a = snap.exists() ? snap.data() : {};
        canEdit = a.ativo !== false && EDIT_ROLES.includes(a.role);
      } catch (err) {
        console.warn("[hero slide] Não foi possível ler o nível de acesso:", err);
      }
      const tryInit = (n = 0) => {
        if (document.querySelector('#conteudo [data-content-pane="hero"]')) initHeroSlidesAdmin({ db, canEdit });
        else if (n < 50) setTimeout(() => tryInit(n + 1), 200);
      };
      tryInit();
    });
  } catch (err) {
    console.error("[hero slide] Erro ao arrancar:", err);
  }
}

if (document.querySelector(".admin-page")) autoStart();
