/* =====================================================
   O MOCHILÃO — admin-hero-cards.js  (ES module)
   Admin → Site Web → "Cards do Hero"
   Os 3 cards na base do hero do index.html: para onde
   levam (programa), título, local e foto.

   O separador e o painel são criados por este ficheiro.
   Arranca sozinho: basta esta linha no fim do admin.html
     <script type="module" src="../SCRIPT/admin-hero-cards.js"></script>

   Dados: ver hero-cards.js
   ===================================================== */

import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { compressToDataURL } from "./image-store.js";
import { HC_DOC, HC_COUNT, HC_CUSTOM, hcPhotoDoc, resolveCard } from "./hero-cards.js";
import { esc, toast } from "./admin-utils.js";

const PHOTO = { maxPx: 900, maxChars: 300000 }; // card ≈ 400px de largura
const TAB = "herocards";

// Como está hoje no index.html (para a pré-visualização sem nada escolhido)
const HTML_CARDS = [
  { titulo: "Sobre Rodas", local: "Luanda", img: "../imagens/fundo_sereias.jpeg" },
  { titulo: "Safari", local: "Luanda", img: "../imagens/elefante.webp" },
  { titulo: "Kifuka Camping", local: "Bengo", img: "../imagens/fundo_kifuka.jpeg" },
];

const emptyCards = () => Array.from({ length: HC_COUNT }, () => ({ programa: "", titulo: "", local: "" }));

function fromFirestore(data) {
  const list = Array.isArray(data?.cards) ? data.cards : [];
  return emptyCards().map((c, i) => ({
    programa: String(list[i]?.programa || ""),
    titulo: String(list[i]?.titulo || ""),
    local: String(list[i]?.local || ""),
  }));
}

export function initHeroCardsAdmin({ db, canEdit = false }) {
  const root = document.getElementById("conteudo");
  const tabsBar = root?.querySelector(".content-tabs");
  if (!root || !tabsBar || root.querySelector(`[data-content-tab="${TAB}"]`)) return;

  if (!document.getElementById("hcAdminCss")) {
    const link = document.createElement("link");
    link.id = "hcAdminCss";
    link.rel = "stylesheet";
    link.href = "../STYLES/admin-hero-cards.css";
    document.head.appendChild(link);
  }

  /* ─────────────────────────────────────────
     SEPARADOR + PAINEL (logo a seguir ao "Hero")
     ───────────────────────────────────────── */
  const tab = document.createElement("button");
  tab.type = "button";
  tab.className = "content-tab";
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-selected", "false");
  tab.dataset.contentTab = TAB;
  tab.innerHTML = '<i class="fa-solid fa-table-columns"></i> Cards do Hero';
  const heroTab = tabsBar.querySelector('[data-content-tab="hero"]');
  heroTab ? heroTab.after(tab) : tabsBar.appendChild(tab);

  const pane = document.createElement("div");
  pane.className = "content-pane hc-admin";
  pane.dataset.contentPane = TAB;
  pane.hidden = true;
  const heroPane = root.querySelector('[data-content-pane="hero"]');
  const panes = root.querySelectorAll("[data-content-pane]");
  (heroPane || panes[panes.length - 1] || tabsBar).after(pane);

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
      Os 3 cards que aparecem na base da foto principal da página inicial.
      Escolha para onde cada card leva — o título e a foto vêm do programa,
      mas pode trocá-los. As fotos são publicadas assim que as escolhe;
      o resto só quando carregar em <strong>Publicar no site</strong>.
      <a href="../index.html" target="_blank" rel="noopener">Abrir a página inicial <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
    </p>

    <div class="hc-grid">
      ${Array.from(
        { length: HC_COUNT },
        (_, i) => `
        <article class="hc-card" data-hc="${i}">
          <div class="hc-preview" data-hc-preview>
            <span class="hc-preview__num">${i + 1}</span>
            <span class="hc-preview__badge" data-hc-p-title></span>
            <span class="hc-preview__btn">Saber Mais</span>
            <span class="hc-preview__busy" hidden><i class="fa-solid fa-spinner fa-spin"></i> A otimizar…</span>
          </div>

          <div class="hc-card__body">
            <label class="ab-field">
              <span>Leva para</span>
              <select data-hc-field="programa" ${dis}></select>
            </label>
            <label class="ab-field">
              <span>Título <small>(vazio = nome do programa)</small></span>
              <input type="text" maxlength="40" data-hc-field="titulo" ${dis} />
            </label>
            <label class="ab-field">
              <span>Local <small>(ex.: Luanda)</small></span>
              <input type="text" maxlength="30" data-hc-field="local" ${dis} />
            </label>

            ${
              canEdit
                ? `<div class="hc-photo">
                    <label class="btn btn--outline btn--sm"><i class="fa-solid fa-camera"></i> Trocar foto
                      <input type="file" accept="image/*" class="visually-hidden" data-hc-file /></label>
                    <button type="button" class="btn-link-danger" data-hc-photo-reset hidden>Usar a capa do programa</button>
                  </div>`
                : ""
            }
            <small class="ab-small" data-hc-state></small>
          </div>
        </article>`,
      ).join("")}
    </div>

    <div class="content-actions">
      <button type="button" class="btn btn--primary" data-hc-publish ${dis}>Publicar no site <i class="fa-solid fa-check"></i></button>
      <button type="button" class="btn btn--outline" data-hc-discard ${dis}>Descartar</button>
      <span class="content-dirty" data-hc-dirty hidden><i class="fa-solid fa-circle"></i> Alterações por publicar</span>
    </div>`;

  const $ = (sel) => pane.querySelector(sel);
  const cardEl = (i) => pane.querySelector(`[data-hc="${i}"]`);

  /* ─────────────────────────────────────────
     ESTADO
     ───────────────────────────────────────── */
  let published = emptyCards();
  let draft = emptyCards();
  let dirty = false;
  const photos = Array(HC_COUNT).fill("");
  let programs = [];
  let byId = new Map();

  const setDirty = (v) => {
    dirty = v;
    $("[data-hc-dirty]").hidden = !v;
  };

  function renderSelects() {
    pane.querySelectorAll('[data-hc-field="programa"]').forEach((sel) => {
      const i = +sel.closest("[data-hc]").dataset.hc;
      const cur = draft[i].programa;
      const opts = programs.map((p) => `<option value="${esc(p.id)}">${esc(p.nome || "Programa")}</option>`);
      // Programa escolhido que já não existe / está desativado
      if (cur && cur !== HC_CUSTOM && !byId.has(cur)) opts.unshift(`<option value="${esc(cur)}">⚠ Programa removido ou inativo</option>`);
      sel.innerHTML =
        `<option value="">— Fica como está no site —</option>` +
        `<optgroup label="Programas">${opts.join("") || '<option disabled>(ainda não há programas)</option>'}</optgroup>` +
        `<optgroup label="Outras páginas"><option value="${HC_CUSTOM}">Viagens Personalizadas</option></optgroup>`;
      sel.value = cur;
    });
  }

  function renderCard(i) {
    const el = cardEl(i);
    const c = draft[i];
    const p = byId.get(c.programa);
    const r = resolveCard(c, p, photos[i], "../");
    const view = r && !r.missing ? r : { ...HTML_CARDS[i], img: HTML_CARDS[i].img };
    const img = (r && !r.missing && r.img) || (!r || r.missing ? HTML_CARDS[i].img : "");

    // Campos (não mexe no que está a ser escrito)
    el.querySelectorAll("input[data-hc-field]").forEach((inp) => {
      if (document.activeElement !== inp) inp.value = c[inp.dataset.hcField] || "";
    });
    const tIn = el.querySelector('[data-hc-field="titulo"]');
    tIn.placeholder = c.programa === HC_CUSTOM ? "Viagem Personalizada" : p?.nome || HTML_CARDS[i].titulo;

    // Pré-visualização
    const prev = el.querySelector("[data-hc-preview]");
    prev.style.backgroundImage = img ? `url("${img.replace(/"/g, "%22")}")` : "";
    prev.classList.toggle("is-empty", !img);
    el.querySelector("[data-hc-p-title]").innerHTML =
      esc(view.titulo) + (view.local ? `<small>${esc(view.local)}</small>` : "");

    // Estado
    const state = el.querySelector("[data-hc-state]");
    if (!c.programa) state.textContent = "Sem destino escolhido: o site mostra o card original.";
    else if (r?.missing) state.textContent = "⚠ Este programa foi removido ou desativado — o site mostra o card original.";
    else state.textContent = `Leva para: ${c.programa === HC_CUSTOM ? "Viagens Personalizadas" : p?.nome || ""} · Foto: ${photos[i] ? "do painel" : "capa do programa"}`;
    el.classList.toggle("is-warn", !!r?.missing);
    el.querySelector("[data-hc-photo-reset]")?.toggleAttribute("hidden", !photos[i]);
  }

  const renderAll = () => {
    renderSelects();
    for (let i = 0; i < HC_COUNT; i++) renderCard(i);
  };

  /* ─────────────────────────────────────────
     FIRESTORE
     ───────────────────────────────────────── */
  onSnapshot(doc(db, "siteConfig", HC_DOC), (snap) => {
    published = fromFirestore(snap.exists() ? snap.data() : {});
    if (!dirty) {
      draft = JSON.parse(JSON.stringify(published));
      renderAll();
    }
  });

  for (let i = 0; i < HC_COUNT; i++) {
    onSnapshot(doc(db, "siteConfig", hcPhotoDoc(i)), (snap) => {
      photos[i] = (snap.exists() && snap.data().data) || "";
      renderCard(i);
    });
  }

  onSnapshot(
    collection(db, "programs"),
    (snap) => {
      programs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => p.ativo !== false)
        .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt"));
      byId = new Map(programs.map((p) => [p.id, p]));
      renderAll();
    },
    () => renderAll(),
  );

  /* ─────────────────────────────────────────
     EDIÇÃO
     ───────────────────────────────────────── */
  pane.addEventListener("input", (e) => {
    const el = e.target.closest("input[data-hc-field]");
    if (!el) return;
    const i = +el.closest("[data-hc]").dataset.hc;
    draft[i][el.dataset.hcField] = el.value;
    setDirty(true);
    renderCard(i);
  });

  pane.addEventListener("change", async (e) => {
    const sel = e.target.closest('select[data-hc-field="programa"]');
    if (sel) {
      const i = +sel.closest("[data-hc]").dataset.hc;
      draft[i].programa = sel.value;
      setDirty(true);
      renderCard(i);
      return;
    }

    const input = e.target.closest("[data-hc-file]");
    if (!input) return;
    const i = +input.closest("[data-hc]").dataset.hc;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    const busy = cardEl(i).querySelector(".hc-preview__busy");
    busy.hidden = false;
    try {
      const data = await compressToDataURL(file, PHOTO);
      await setDoc(doc(db, "siteConfig", hcPhotoDoc(i)), { data, atualizadoEm: serverTimestamp() });
      toast(`Foto do card ${i + 1} publicada.`);
    } catch (err) {
      console.error("[cards do hero] foto:", err);
      toast(err?.code === "permission-denied" ? "Sem permissão para alterar o site." : err?.message || "Não foi possível usar esta imagem.", "error");
    } finally {
      busy.hidden = true;
    }
  });

  pane.addEventListener("click", async (e) => {
    const reset = e.target.closest("[data-hc-photo-reset]");
    if (!reset) return;
    const i = +reset.closest("[data-hc]").dataset.hc;
    if (!confirm(`Card ${i + 1}: voltar a usar a capa do programa?`)) return;
    try {
      await deleteDoc(doc(db, "siteConfig", hcPhotoDoc(i)));
      toast("A usar a capa do programa.");
    } catch (err) {
      toast(err?.message || "Erro ao repor a foto.", "error");
    }
  });

  $("[data-hc-discard]")?.addEventListener("click", () => {
    draft = JSON.parse(JSON.stringify(published));
    setDirty(false);
    renderAll();
  });

  $("[data-hc-publish]")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A publicar…';
    const cards = draft.map((c) => ({
      programa: c.programa,
      titulo: c.titulo.trim(),
      local: c.local.trim(),
    }));
    try {
      await setDoc(doc(db, "siteConfig", HC_DOC), { cards, atualizadoEm: serverTimestamp() });
      setDirty(false);
      toast("Cards do hero atualizados.");
    } catch (err) {
      console.error("[cards do hero]", err);
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
        console.warn("[cards do hero] Não foi possível ler o nível de acesso:", err);
      }
      const tryInit = (n = 0) => {
        if (document.querySelector("#conteudo .content-tabs")) initHeroCardsAdmin({ db, canEdit });
        else if (n < 50) setTimeout(() => tryInit(n + 1), 200);
      };
      tryInit();
    });
  } catch (err) {
    console.error("[cards do hero] Erro ao arrancar:", err);
  }
}

if (document.querySelector(".admin-page")) autoStart();
