/* =====================================================
   O MOCHILÃO — admin-parceiros-logos.js  (ES module)
   Admin → Site Web → "Logos de parceiros"

   Faixa de logótipos no index (depois do "Fale Connosco"):
   cada logótipo abre a página do parceiro.
   (É diferente da área "Parceiros" do painel.)

   O separador e o painel são criados por este ficheiro.
   Arranca sozinho: basta esta linha no fim do admin.html
     <script type="module" src="../SCRIPT/admin-parceiros-logos.js"></script>

   Dados: siteConfig/parceiros-logos = { titulo, itens: [{ id, nome, url, logo }] }
   ===================================================== */

import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { compressToDataURL } from "./image-store.js";
import { esc, toast } from "./admin-utils.js";
import { PL_DOC, PL_DEFAULT_TITLE, renderPartnerLogos } from "./parceiros-logos.js";

const TAB = "parceiroslogos";
const MAX_LOGOS = 12;
const LOGO = { maxPx: 400, maxChars: 60000 };
const newId = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** "www.site.ao" → "https://www.site.ao" */
function normalizeUrl(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

export function initPartnerLogosAdmin({ db, canEdit = false }) {
  const root = document.getElementById("conteudo");
  const tabsBar = root?.querySelector(".content-tabs");
  if (!root || !tabsBar || root.querySelector(`[data-content-tab="${TAB}"]`)) return;

  if (!document.getElementById("plAdminCss")) {
    for (const href of ["../STYLES/admin-parceiros-logos.css", "../STYLES/parceiros-logos.css"]) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      if (href.includes("admin-")) link.id = "plAdminCss";
      document.head.appendChild(link);
    }
  }

  /* ─────────────────────────────────────────
     SEPARADOR + PAINEL
     ───────────────────────────────────────── */
  const tab = document.createElement("button");
  tab.type = "button";
  tab.className = "content-tab";
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-selected", "false");
  tab.dataset.contentTab = TAB;
  tab.innerHTML = '<i class="fa-regular fa-handshake"></i> Logos de parceiros';
  tabsBar.appendChild(tab);

  const pane = document.createElement("div");
  pane.className = "content-pane pl-admin";
  pane.dataset.contentPane = TAB;
  pane.hidden = true;
  const panes = root.querySelectorAll("[data-content-pane]");
  (panes[panes.length - 1] || tabsBar).after(pane);

  const showOnly = (name) => {
    root.querySelectorAll("[data-content-tab]").forEach((t) => {
      const on = t.dataset.contentTab === name;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", String(on));
    });
    root.querySelectorAll("[data-content-pane]").forEach((p) => (p.hidden = p.dataset.contentPane !== name));
  };
  tabsBar.addEventListener("click", (e) => {
    const t = e.target.closest("[data-content-tab]");
    if (t) showOnly(t.dataset.contentTab);
  });

  const dis = canEdit ? "" : "disabled";
  pane.innerHTML = `
    <p class="content-help">
      Faixa de logótipos que aparece no início do site, depois do “Fale Connosco”.
      Cada logótipo abre a página do parceiro. Até ${MAX_LOGOS} logótipos, pela ordem desta lista.
      Prefira logótipos em PNG com fundo transparente ou branco.
    </p>

    <label class="ab-field pl-admin__title">
      <span>Texto por cima dos logótipos <small>(vazio = sem texto)</small></span>
      <input type="text" maxlength="60" data-pl-title-input placeholder="${esc(PL_DEFAULT_TITLE)}" ${dis} />
    </label>

    <ol class="pl-admin__list" data-pl-rows></ol>
    <button type="button" class="dyn-add" data-pl-add ${dis}><i class="fa-solid fa-plus"></i> Adicionar parceiro</button>

    <div class="content-actions">
      <button type="button" class="btn btn--primary" data-pl-publish ${dis}>Publicar no site <i class="fa-solid fa-check"></i></button>
      <button type="button" class="btn btn--outline" data-pl-discard ${dis}>Descartar</button>
      <span class="content-dirty" data-pl-dirty hidden><i class="fa-solid fa-circle"></i> Alterações por publicar</span>
    </div>

    <div class="pl-admin__preview">
      <span class="pl-admin__preview-label">Pré-visualização</span>
      <section class="partner-logos" data-pl-preview>
        <p class="partner-logos__label" data-pl-title></p>
        <ul class="partner-logos__list" data-pl-list></ul>
      </section>
      <p class="pl-admin__preview-empty" data-pl-preview-empty>Sem logótipos — a secção não aparece no site.</p>
    </div>`;

  const $ = (sel) => pane.querySelector(sel);
  const rows = $("[data-pl-rows]");

  /* ─────────────────────────────────────────
     ESTADO
     ───────────────────────────────────────── */
  let published = { titulo: PL_DEFAULT_TITLE, itens: [] };
  let draft = structuredClone(published);
  let dirty = false;

  const setDirty = (v) => {
    dirty = v;
    $("[data-pl-dirty]").hidden = !v;
  };

  function renderRows() {
    rows.innerHTML = draft.itens
      .map(
        (p, i) => `
        <li class="pl-row" data-i="${i}">
          <label class="pl-row__logo${p.logo ? "" : " is-empty"}" title="${canEdit ? "Escolher logótipo" : ""}">
            ${p.logo ? `<img src="${esc(p.logo)}" alt="" />` : '<i class="fa-regular fa-image"></i><small>Logótipo</small>'}
            ${canEdit ? '<input type="file" accept="image/*" class="visually-hidden" data-pl-file />' : ""}
            <span class="pl-row__busy" hidden><i class="fa-solid fa-spinner fa-spin"></i></span>
          </label>
          <div class="pl-row__fields">
            <label class="ab-field"><span>Nome</span>
              <input type="text" maxlength="60" data-f="nome" value="${esc(p.nome)}" placeholder="Ex.: Ministério do Turismo" ${dis} /></label>
            <label class="ab-field"><span>Link da página</span>
              <input type="text" inputmode="url" maxlength="300" data-f="url" value="${esc(p.url)}" placeholder="https://…" ${dis} /></label>
          </div>
          ${
            canEdit
              ? `<div class="pl-row__tools">
                  <button type="button" data-pl-move="-1" title="Subir" ${i === 0 ? "disabled" : ""}><i class="fa-solid fa-arrow-up"></i></button>
                  <button type="button" data-pl-move="1" title="Descer" ${i === draft.itens.length - 1 ? "disabled" : ""}><i class="fa-solid fa-arrow-down"></i></button>
                  <button type="button" class="is-danger" data-pl-remove title="Remover"><i class="fa-regular fa-trash-can"></i></button>
                </div>`
              : ""
          }
        </li>`,
      )
      .join("");
    const add = $("[data-pl-add]");
    if (add) add.disabled = !canEdit || draft.itens.length >= MAX_LOGOS;
  }

  function renderPreview() {
    const data = { titulo: draft.titulo, itens: draft.itens.map((p) => ({ ...p, url: normalizeUrl(p.url) })) };
    renderPartnerLogos($("[data-pl-preview]"), data);
    $("[data-pl-preview-empty]").hidden = !$("[data-pl-preview]").hidden;
    // na pré-visualização os links não abrem
    $("[data-pl-preview]").querySelectorAll("a").forEach((a) => a.addEventListener("click", (e) => e.preventDefault()));
  }

  const renderAll = () => {
    const t = $("[data-pl-title-input]");
    if (document.activeElement !== t) t.value = draft.titulo;
    renderRows();
    renderPreview();
  };

  /* ─────────────────────────────────────────
     FIRESTORE
     ───────────────────────────────────────── */
  onSnapshot(doc(db, "siteConfig", PL_DOC), (snap) => {
    const d = snap.exists() ? snap.data() : {};
    published = {
      titulo: typeof d.titulo === "string" ? d.titulo : PL_DEFAULT_TITLE,
      itens: (Array.isArray(d.itens) ? d.itens : []).map((p) => ({
        id: String(p.id || newId()),
        nome: String(p.nome || ""),
        url: String(p.url || ""),
        logo: String(p.logo || ""),
      })),
    };
    if (!dirty) {
      draft = structuredClone(published);
      renderAll();
    }
  });

  /* ─────────────────────────────────────────
     EDIÇÃO
     ───────────────────────────────────────── */
  pane.addEventListener("input", (e) => {
    const t = e.target;
    if (t.matches("[data-pl-title-input]")) draft.titulo = t.value;
    else if (t.dataset.f) {
      draft.itens[+t.closest("[data-i]").dataset.i][t.dataset.f] = t.value;
      t.classList.remove("is-invalid");
    } else return;
    setDirty(true);
    renderPreview();
  });

  pane.addEventListener("focusout", (e) => {
    const t = e.target;
    if (t.dataset?.f === "url" && t.value.trim()) {
      t.value = normalizeUrl(t.value);
      draft.itens[+t.closest("[data-i]").dataset.i].url = t.value;
    }
  });

  pane.addEventListener("change", async (e) => {
    const input = e.target.closest("[data-pl-file]");
    if (!input) return;
    const row = input.closest("[data-i]");
    const i = +row.dataset.i;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    const busy = row.querySelector(".pl-row__busy");
    busy.hidden = false;
    try {
      draft.itens[i].logo = await compressToDataURL(file, LOGO);
      if (!draft.itens[i].nome) draft.itens[i].nome = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
      setDirty(true);
      renderRows();
      renderPreview();
    } catch (err) {
      toast(err?.message || "Não foi possível usar esta imagem.", "error");
    } finally {
      busy.hidden = true;
    }
  });

  pane.addEventListener("click", (e) => {
    if (e.target.closest("[data-pl-add]")) {
      draft.itens.push({ id: newId(), nome: "", url: "", logo: "" });
      setDirty(true);
      renderRows();
      rows.lastElementChild?.querySelector(".pl-row__logo")?.focus();
      return;
    }
    const mv = e.target.closest("[data-pl-move]");
    if (mv) {
      const i = +mv.closest("[data-i]").dataset.i;
      const j = i + Number(mv.dataset.plMove);
      if (j < 0 || j >= draft.itens.length) return;
      [draft.itens[i], draft.itens[j]] = [draft.itens[j], draft.itens[i]];
      setDirty(true);
      renderRows();
      renderPreview();
      return;
    }
    const rm = e.target.closest("[data-pl-remove]");
    if (rm) {
      const i = +rm.closest("[data-i]").dataset.i;
      const p = draft.itens[i];
      if ((p.logo || p.nome) && !confirm(`Remover ${p.nome || "este parceiro"} da faixa de logótipos?`)) return;
      draft.itens.splice(i, 1);
      setDirty(true);
      renderRows();
      renderPreview();
    }
  });

  $("[data-pl-discard]")?.addEventListener("click", () => {
    draft = structuredClone(published);
    setDirty(false);
    renderAll();
  });

  $("[data-pl-publish]")?.addEventListener("click", async (e) => {
    // Cada parceiro precisa de logótipo; o link é opcional, mas tem de ser válido
    let bad = null;
    draft.itens.forEach((p, i) => {
      const row = rows.querySelector(`[data-i="${i}"]`);
      const noLogo = !p.logo;
      row.querySelector(".pl-row__logo").classList.toggle("is-invalid", noLogo);
      const url = normalizeUrl(p.url);
      let badUrl = false;
      if (url) {
        try {
          new URL(url);
        } catch {
          badUrl = true;
        }
      }
      row.querySelector('[data-f="url"]').classList.toggle("is-invalid", badUrl);
      if (!bad && (noLogo || badUrl)) bad = noLogo ? "Falta o logótipo de um parceiro." : "Há um link inválido.";
    });
    if (bad) return toast(bad, "error");

    const btn = e.currentTarget;
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A publicar…';
    const data = {
      titulo: draft.titulo.trim(),
      itens: draft.itens.map((p) => ({ id: p.id, nome: p.nome.trim(), url: normalizeUrl(p.url), logo: p.logo })),
    };
    try {
      await setDoc(doc(db, "siteConfig", PL_DOC), { ...data, atualizadoEm: serverTimestamp() });
      setDirty(false);
      toast("Logos de parceiros atualizados.");
    } catch (err) {
      console.error("[logos parceiros]", err);
      toast(
        err?.code === "permission-denied"
          ? "Sem permissão para alterar o site."
          : /size|bytes|exceeds/i.test(err?.message || "")
            ? "Os logótipos ocupam demasiado espaço. Use imagens mais leves ou menos logótipos."
            : err?.message || "Erro ao publicar.",
        "error",
      );
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
        console.warn("[logos parceiros] Não foi possível ler o nível de acesso:", err);
      }
      const tryInit = (n = 0) => {
        if (document.querySelector("#conteudo .content-tabs")) initPartnerLogosAdmin({ db, canEdit });
        else if (n < 50) setTimeout(() => tryInit(n + 1), 200);
      };
      tryInit();
    });
  } catch (err) {
    console.error("[logos parceiros] Erro ao arrancar:", err);
  }
}

if (document.querySelector(".admin-page")) autoStart();
