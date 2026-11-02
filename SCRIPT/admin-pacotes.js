/* =====================================================
   O MOCHILÃO — admin-pacotes.js  (ES module)
   Admin → Site Web → "Pacotes"

   Os tipos de pacote que os programas podem ter
   (Individual, Casal, Kamba…) e a secção "Qual pacote
   escolher?" que aparece ao lado do card de reserva.

   O separador e o painel são criados por este ficheiro.
   Arranca sozinho: basta esta linha no fim do admin.html
     <script type="module" src="../SCRIPT/admin-pacotes.js"></script>
   (precisa do pacotes.js carregado antes, como script normal)

   Dados: siteConfig/pacotes = { titulo, intro, tipos: [{ id, nome, pessoas, descricao }] }
   ===================================================== */

import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { esc, toast } from "./admin-utils.js";

const TAB = "pacotes";
const DOC_ID = "pacotes";
const MAX_TIPOS = 12;

const P = () => window.MochilaoPacotes;
const clone = (o) => JSON.parse(JSON.stringify(o));

export function initPackagesAdmin({ db, canEdit = false }) {
  const root = document.getElementById("conteudo");
  const tabsBar = root?.querySelector(".content-tabs");
  if (!root || !tabsBar || !P() || root.querySelector(`[data-content-tab="${TAB}"]`)) return;

  if (!document.getElementById("pkAdminCss")) {
    const link = document.createElement("link");
    link.id = "pkAdminCss";
    link.rel = "stylesheet";
    link.href = "../STYLES/admin-pacotes.css";
    document.head.appendChild(link);
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
  tab.innerHTML = '<i class="fa-solid fa-ticket"></i> Pacotes';
  tabsBar.appendChild(tab);

  const pane = document.createElement("div");
  pane.className = "content-pane pk-admin";
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
  const def = P().DEFAULT_CATALOG;

  pane.innerHTML = `
    <div class="pk-form">
      <p class="content-help">
        Os <strong>tipos de pacote</strong> que pode escolher ao criar um programa (Programas → Pacotes e preços)
        e a explicação que aparece ao lado do card de reserva, na página de cada programa.
        Só aparecem no site os pacotes que o programa tem.
      </p>

      <fieldset class="ap-group">
        <legend class="ap-group__title">Secção “Qual pacote escolher?”</legend>
        <label class="ab-field">
          <span>Título</span>
          <input type="text" maxlength="60" data-pk="titulo" placeholder="${esc(def.titulo)}" ${dis} />
        </label>
        <label class="ab-field">
          <span>Texto de introdução <small>(opcional)</small></span>
          <textarea rows="2" maxlength="240" data-pk="intro" placeholder="${esc(def.intro)}" ${dis}></textarea>
        </label>
      </fieldset>

      <fieldset class="ap-group">
        <legend class="ap-group__title">Tipos de pacote</legend>
        <ol class="pk-list" data-pk-list></ol>
        <button type="button" class="dyn-add" data-pk-add ${dis}>
          <i class="fa-solid fa-plus"></i> Adicionar tipo de pacote
        </button>
      </fieldset>

      <div class="content-actions">
        <button type="button" class="btn btn--primary" data-pk-publish ${dis}>Publicar no site <i class="fa-solid fa-check"></i></button>
        <button type="button" class="btn btn--outline" data-pk-discard ${dis}>Descartar</button>
        <span class="content-dirty" data-pk-dirty hidden><i class="fa-solid fa-circle"></i> Alterações por publicar</span>
      </div>
    </div>

    <div class="pk-preview-wrap">
      <span class="pk-preview-wrap__label">Pré-visualização <small>(com todos os tipos)</small></span>
      <div class="pk-preview" data-pk-preview></div>
    </div>`;

  const $ = (sel) => pane.querySelector(sel);
  const list = $("[data-pk-list]");

  /* ─────────────────────────────────────────
     ESTADO
     ───────────────────────────────────────── */
  let published = null; // null = ainda sem documento (usa os tipos por defeito)
  let draft = toDraft(null);
  let dirty = false;

  function toDraft(data) {
    const c = P().normalizeCatalog(data);
    return {
      // Sem documento ainda → começa com os textos por defeito (os que o site mostra)
      titulo: data && typeof data.titulo === "string" ? data.titulo : P().DEFAULT_CATALOG.titulo,
      intro: data && typeof data.intro === "string" ? data.intro : P().DEFAULT_CATALOG.intro,
      tipos: c.tipos.map((t) => ({ ...t })),
    };
  }

  const setDirty = (v) => {
    dirty = v;
    $("[data-pk-dirty]").hidden = !v;
  };

  function renderList() {
    list.innerHTML = draft.tipos
      .map(
        (t, i) => `
        <li class="pk-item" data-i="${i}">
          <div class="pk-item__row">
            <label class="ab-field pk-item__nome">
              <span>Nome do pacote</span>
              <input type="text" maxlength="30" data-f="nome" value="${esc(t.nome)}" placeholder="Ex: Casal" ${dis} />
            </label>
            <label class="ab-field pk-item__pessoas">
              <span>Pessoas incluídas</span>
              <input type="number" min="1" max="50" step="1" data-f="pessoas" value="${t.pessoas}" ${dis} />
            </label>
            ${
              canEdit
                ? `<button type="button" class="pk-item__remove" data-pk-remove title="Remover este tipo" aria-label="Remover ${esc(t.nome)}">
                    <i class="fa-regular fa-trash-can"></i></button>`
                : ""
            }
          </div>
          <label class="ab-field">
            <span>Explicação no site</span>
            <textarea rows="2" maxlength="300" data-f="descricao" placeholder="O que inclui este pacote, com quem partilha o quarto…" ${dis}>${esc(t.descricao)}</textarea>
          </label>
        </li>`,
      )
      .join("");
    const add = $("[data-pk-add]");
    if (add) add.disabled = !canEdit || draft.tipos.length >= MAX_TIPOS;
  }

  function fillTexts() {
    pane.querySelectorAll("[data-pk]").forEach((el) => {
      if (document.activeElement !== el) el.value = draft[el.dataset.pk] || "";
    });
  }

  function renderPreview() {
    const tipos = draft.tipos.filter((t) => t.nome.trim());
    $("[data-pk-preview]").innerHTML = `
      <span class="pk-preview__tag">Pacotes</span>
      <h3 class="pk-preview__title">${esc(draft.titulo.trim() || def.titulo)}</h3>
      ${draft.intro.trim() ? `<p class="pk-preview__intro">${esc(draft.intro.trim())}</p>` : ""}
      <ul class="pk-preview__list">
        ${
          tipos
            .map(
              (t) => `
          <li>
            <span class="pk-preview__icon"><i class="fa-solid ${P().peopleIcon(t.pessoas)}"></i></span>
            <div>
              <strong>${esc(t.nome)}</strong>
              <em>${P().pessoasLabel(t.pessoas)}</em>
              ${t.descricao.trim() ? `<p>${esc(t.descricao)}</p>` : ""}
            </div>
          </li>`,
            )
            .join("") || "<li><p>Sem tipos de pacote.</p></li>"
        }
      </ul>`;
  }

  const renderAll = () => {
    fillTexts();
    renderList();
    renderPreview();
  };

  /* ─────────────────────────────────────────
     FIRESTORE
     ───────────────────────────────────────── */
  onSnapshot(
    doc(db, "siteConfig", DOC_ID),
    (snap) => {
      published = snap.exists() ? snap.data() : null;
      if (!dirty) {
        draft = toDraft(published);
        renderAll();
      }
    },
    (err) => console.warn("[pacotes] ", err),
  );

  /* ─────────────────────────────────────────
     EDIÇÃO
     ───────────────────────────────────────── */
  pane.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.pk) {
      draft[t.dataset.pk] = t.value;
    } else if (t.dataset.f) {
      const i = +t.closest("[data-i]").dataset.i;
      draft.tipos[i][t.dataset.f] = t.dataset.f === "pessoas" ? Math.max(1, parseInt(t.value, 10) || 1) : t.value;
      if (t.value.trim()) t.classList.remove("is-invalid");
    } else return;
    setDirty(true);
    renderPreview();
  });

  pane.addEventListener("click", (e) => {
    if (e.target.closest("[data-pk-add]")) {
      draft.tipos.push({ id: "", nome: "", pessoas: 1, descricao: "" });
      setDirty(true);
      renderList();
      renderPreview();
      list.lastElementChild?.querySelector('[data-f="nome"]')?.focus();
      return;
    }
    const rm = e.target.closest("[data-pk-remove]");
    if (rm) {
      const i = +rm.closest("[data-i]").dataset.i;
      const t = draft.tipos[i];
      if (
        t.nome.trim() &&
        !confirm(
          `Remover o tipo "${t.nome}"?\n\nOs programas que já o têm continuam a mostrá-lo com o mesmo preço, mas sem a explicação, e deixa de aparecer na lista ao criar programas.`,
        )
      )
        return;
      draft.tipos.splice(i, 1);
      setDirty(true);
      renderList();
      renderPreview();
    }
  });

  $("[data-pk-discard]")?.addEventListener("click", () => {
    draft = toDraft(published);
    setDirty(false);
    renderAll();
  });

  $("[data-pk-publish]")?.addEventListener("click", async (e) => {
    // Validação: nomes obrigatórios e sem repetir
    const seen = new Set();
    let bad = null;
    pane.querySelectorAll('[data-f="nome"]').forEach((inp) => {
      const k = inp.value.trim().toLowerCase();
      const wrong = !k || seen.has(k);
      inp.classList.toggle("is-invalid", wrong);
      if (wrong && !bad) bad = inp;
      seen.add(k);
    });
    if (bad) {
      bad.focus();
      toast(bad.value.trim() ? "Há dois pacotes com o mesmo nome." : "Indique o nome de cada pacote.", "error");
      return;
    }
    if (!draft.tipos.length) {
      toast("Tem de existir pelo menos um tipo de pacote.", "error");
      return;
    }

    // Ids estáveis: os tipos novos ganham um id a partir do nome
    const ids = new Set(draft.tipos.map((t) => t.id).filter(Boolean));
    const tipos = draft.tipos.map((t) => {
      let id = t.id;
      if (!id) {
        const base = P().slug(t.nome);
        id = base;
        for (let n = 2; ids.has(id); n++) id = `${base}-${n}`;
        ids.add(id);
      }
      return {
        id,
        nome: t.nome.trim(),
        pessoas: Math.max(1, parseInt(t.pessoas, 10) || 1),
        descricao: t.descricao.trim(),
      };
    });

    const btn = e.currentTarget;
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A publicar…';
    try {
      await setDoc(doc(db, "siteConfig", DOC_ID), {
        titulo: draft.titulo.trim(),
        intro: draft.intro.trim(),
        tipos,
        atualizadoEm: serverTimestamp(),
      });
      draft.tipos = clone(tipos);
      setDirty(false);
      renderList();
      toast("Pacotes atualizados.");
    } catch (err) {
      console.error("[pacotes]", err);
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
        console.warn("[pacotes] Não foi possível ler o nível de acesso:", err);
      }
      const tryInit = (n = 0) => {
        if (document.querySelector("#conteudo .content-tabs") && window.MochilaoPacotes) initPackagesAdmin({ db, canEdit });
        else if (n < 50) setTimeout(() => tryInit(n + 1), 200);
      };
      tryInit();
    });
  } catch (err) {
    console.error("[pacotes] Erro ao arrancar:", err);
  }
}

if (document.querySelector(".admin-page")) autoStart();
