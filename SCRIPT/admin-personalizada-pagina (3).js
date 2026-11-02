/* =====================================================
   O MOCHILÃO — admin-personalizada-pagina.js  (ES module)
   Admin → Site Web → "Pág. Personalizada"
   Textos e fotos da página PAGES/personalizada.html, com
   pré-visualização da página real ao lado.

   O separador e o painel são criados por este ficheiro.
   Arranca sozinho: basta esta linha no fim do admin.html
     <script type="module" src="../SCRIPT/admin-personalizada-pagina.js"></script>
   (depois do login, lê o nível do administrador para saber se pode editar).
   Também pode ser chamado pelo admin.js — nunca cria o separador duas vezes:
     initCustomPageAdmin({ db, canEdit: perms.canEditContent });

   Dados: ver personalizada-content.js
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
import {
  PC_DOC,
  PC_PHOTOS,
  PC_SECTIONS,
  PC_DEFAULTS,
  PC_MAX_PROGRAMS,
  pcPhotoDoc,
  applyPersonalizada,
} from "./personalizada-content.js";
import { esc, toast } from "./admin-utils.js";

const PHOTO = { maxPx: 1800, maxChars: 750000 };
const TAB = "personalizada";
const clone = (o) => JSON.parse(JSON.stringify(o || {}));

/* Rascunho vazio (campo vazio = texto original) */
function emptyDraft() {
  const d = {};
  PC_SECTIONS.forEach((s) => {
    d[s.key] = {};
    s.fields.forEach(([k]) => (d[s.key][k] = ""));
    (s.toggles || []).forEach(([k]) => (d[s.key][k] = true));
  });
  d.destinos.programas = [];
  return d;
}

function fromFirestore(data) {
  const d = emptyDraft();
  PC_SECTIONS.forEach((s) =>
    s.fields.forEach(([k]) => {
      const v = data?.[s.key]?.[k];
      if (typeof v === "string") d[s.key][k] = v;
    }),
  );
  PC_SECTIONS.forEach((s) => (s.toggles || []).forEach(([k]) => (d[s.key][k] = data?.[s.key]?.[k] !== false)));
  const progs = data?.destinos?.programas;
  if (Array.isArray(progs)) d.destinos.programas = progs.filter((x) => typeof x === "string").slice(0, PC_MAX_PROGRAMS);
  return d;
}

export function initCustomPageAdmin({ db, canEdit = false }) {
  const root = document.getElementById("conteudo");
  const tabsBar = root?.querySelector(".content-tabs");
  if (!root || !tabsBar || root.querySelector(`[data-content-tab="${TAB}"]`)) return;

  // Estilo próprio deste separador
  if (!document.getElementById("pcAdminCss")) {
    const link = document.createElement("link");
    link.id = "pcAdminCss";
    link.rel = "stylesheet";
    link.href = "../STYLES/admin-personalizada-pagina.css";
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
  tab.innerHTML = '<i class="fa-solid fa-route"></i> Pág. Personalizada';
  tabsBar.appendChild(tab);

  const panes = root.querySelectorAll("[data-content-pane]");
  const pane = document.createElement("div");
  pane.className = "content-pane pc-admin";
  pane.dataset.contentPane = TAB;
  pane.hidden = true;
  (panes[panes.length - 1] || tabsBar).after(pane);

  // Troca de separador (funciona com ou sem o admin-conteudo.js)
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
  const photoCard = (key) => {
    const p = PC_PHOTOS.find((x) => x.key === key);
    return `
      <article class="hg-slot pc-photo" data-pc-photo="${key}">
        <div class="hg-slot__media">
          <img class="hg-slot__img" alt="" data-pc-photo-img />
          <span class="hg-slot__busy" hidden><i class="fa-solid fa-spinner fa-spin"></i> A otimizar…</span>
          ${
            canEdit
              ? `<div class="hg-slot__actions">
                  <label class="hg-slot__btn"><i class="fa-solid fa-camera"></i> <span>Trocar foto</span>
                    <input type="file" accept="image/*" class="visually-hidden" data-pc-file /></label>
                  <button type="button" class="hg-slot__btn hg-slot__btn--danger" data-pc-photo-reset hidden title="Repor a foto original">
                    <i class="fa-solid fa-rotate-left"></i></button>
                </div>`
              : ""
          }
        </div>
        <div class="hg-slot__body">
          <strong class="hg-slot__label">${esc(p.label)}</strong>
          <small class="ab-small">${esc(p.hint)} <span data-pc-photo-state>Foto original</span></small>
        </div>
      </article>`;
  };

  const field = (sec, [k, label, max, rows]) => {
    const ph = esc(PC_DEFAULTS[sec][k]);
    const attrs = `data-pc-field="${sec}.${k}" maxlength="${max}" placeholder="${ph}" ${dis}`;
    return `
      <label class="ab-field">
        <span>${esc(label)}</span>
        ${rows > 1 ? `<textarea rows="${rows}" ${attrs}></textarea>` : `<input type="text" ${attrs} />`}
      </label>`;
  };

  pane.innerHTML = `
    <div class="ab-form">
      <p class="content-help">
        Textos e fotos da página <strong>Viagens Personalizadas</strong>.
        Campo vazio = fica o texto original (o que aparece a cinzento).
        Enter num campo grande = nova linha. As fotos são publicadas assim que as escolhe;
        os textos só quando carregar em <strong>Publicar no site</strong>.
        <a href="personalizada.html" target="_blank" rel="noopener">Abrir a página <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
      </p>

      ${PC_SECTIONS.map(
        (s) => `
        <fieldset class="ap-group pc-admin__group" data-pc-section="${s.key}">
          <legend class="ap-group__title">${esc(s.title)}</legend>
          ${s.photos.length ? `<div class="pc-admin__photos">${s.photos.map(photoCard).join("")}</div>` : ""}
          ${(s.toggles || [])
            .map(
              ([k, label]) => `<label class="pc-admin__toggle">
                <input type="checkbox" data-pc-toggle="${s.key}.${k}" ${dis} />
                <span class="pc-admin__switch" aria-hidden="true"></span>
                <span>${esc(label)}</span>
              </label>`,
            )
            .join("")}
          <div class="pc-admin__fields">${s.fields.map((f) => field(s.key, f)).join("")}</div>
          ${
            s.programs
              ? `<div class="pc-admin__programs">
                  <span class="pc-admin__programs-title">Programas mostrados <small>(até ${PC_MAX_PROGRAMS}, pela ordem em que os marca; nenhum marcado = os primeiros ${PC_MAX_PROGRAMS})</small></span>
                  <div data-pc-programs><small class="ab-small">A carregar os programas…</small></div>
                  ${
                    canEdit
                      ? `<button type="button" class="dyn-add pc-admin__new-prog" data-pc-new-program>
                          <i class="fa-solid fa-plus"></i> Criar programa só para esta página
                        </button>
                        <small class="ab-small">Funciona como os outros programas (página própria, pacotes, mochila),
                          mas só se encontra aqui. Depois de o guardar, marque-o nesta lista.</small>`
                      : ""
                  }
                </div>`
              : ""
          }
        </fieldset>`,
      ).join("")}

      <div class="content-actions ap-actions">
        <button type="button" class="btn btn--primary" data-pc-publish ${dis}>Publicar no site <i class="fa-solid fa-check"></i></button>
        <button type="button" class="btn btn--outline" data-pc-discard ${dis}>Descartar</button>
        <span class="content-dirty" data-pc-dirty hidden><i class="fa-solid fa-circle"></i> Alterações por publicar</span>
      </div>
    </div>

    <div class="ap-live">
      <div class="ap-live__bar">
        <span>Pré-visualização</span>
        <div class="ap-live__devices" role="group" aria-label="Ecrã">
          <button type="button" class="is-active" data-pc-device="desktop" title="Computador"><i class="fa-solid fa-desktop"></i></button>
          <button type="button" data-pc-device="mobile" title="Telemóvel"><i class="fa-solid fa-mobile-screen"></i></button>
        </div>
      </div>
      <div class="ap-live__frame" data-pc-frame>
        <iframe title="Pré-visualização da página Viagens Personalizadas" data-pc-iframe></iframe>
        <span class="ap-live__loading" data-pc-loading><i class="fa-solid fa-spinner fa-spin"></i> A carregar a página…</span>
      </div>
    </div>`;

  const $ = (sel) => pane.querySelector(sel);
  const $$ = (sel) => pane.querySelectorAll(sel);

  /* ─────────────────────────────────────────
     ESTADO
     ───────────────────────────────────────── */
  let published = emptyDraft();
  let draft = emptyDraft();
  let dirty = false;
  const photos = {}; // key → url publicada
  let contactos = {};
  let programs = [];

  const setDirty = (v) => {
    dirty = v;
    $("[data-pc-dirty]").hidden = !v;
  };

  function fillFields() {
    $$("[data-pc-field]").forEach((el) => {
      if (document.activeElement === el) return;
      const [sec, k] = el.dataset.pcField.split(".");
      el.value = draft[sec][k] || "";
    });
    $$("[data-pc-toggle]").forEach((el) => {
      const [sec, k] = el.dataset.pcToggle.split(".");
      el.checked = draft[sec][k] !== false;
      // Destaques escondidos → os campos deles ficam esbatidos
      if (k === "mostrarFactos") {
        pane.querySelectorAll('[data-pc-field^="medida.f"]').forEach((f) =>
          f.closest(".ab-field").classList.toggle("is-off", !el.checked),
        );
      }
    });
    renderPrograms();
  }

  function renderPhoto(key) {
    const card = pane.querySelector(`[data-pc-photo="${key}"]`);
    if (!card) return;
    const def = PC_PHOTOS.find((p) => p.key === key).def;
    const url = photos[key] || "";
    card.querySelector("[data-pc-photo-img]").src = url || def;
    card.querySelector("[data-pc-photo-state]").textContent = url ? "Foto do painel" : "Foto original";
    card.querySelector("[data-pc-photo-reset]")?.toggleAttribute("hidden", !url);
  }

  function renderPrograms() {
    const box = $("[data-pc-programs]");
    if (!box) return;
    if (!programs.length) {
      box.innerHTML = '<small class="ab-small">Ainda não há programas criados no painel. Aparecem os programas de exemplo da página.</small>';
      return;
    }
    const chosen = draft.destinos.programas;
    const full = chosen.length >= PC_MAX_PROGRAMS;
    // Primeiro os criados só para esta página
    const sorted = [...programs].sort((a, b) => Number(!!b.soPersonalizada) - Number(!!a.soPersonalizada));
    box.innerHTML = sorted
      .map((p) => {
        const on = chosen.includes(p.id);
        return `<label class="pc-admin__prog${on ? " is-on" : ""}">
          <input type="checkbox" value="${esc(p.id)}" ${on ? "checked" : ""} ${!on && full ? "disabled" : ""} ${dis} />
          ${p.imagemURL ? `<img src="${esc(p.imagemURL)}" alt="" />` : '<i class="fa-solid fa-map-location-dot"></i>'}
          <span>${esc(p.nome || "Programa")}${p.soPersonalizada ? '<small class="pc-admin__prog-tag">Só desta página</small>' : ""}</span>
          ${on ? `<em>${chosen.indexOf(p.id) + 1}</em>` : ""}
        </label>`;
      })
      .join("");
  }

  /* ─────────────────────────────────────────
     FIRESTORE
     ───────────────────────────────────────── */
  onSnapshot(doc(db, "siteConfig", PC_DOC), (snap) => {
    published = fromFirestore(snap.exists() ? snap.data() : {});
    if (!dirty) {
      draft = clone(published);
      fillFields();
      paintFrame();
    }
  });

  PC_PHOTOS.forEach(({ key }) =>
    onSnapshot(doc(db, "siteConfig", pcPhotoDoc(key)), (snap) => {
      photos[key] = (snap.exists() && snap.data().data) || "";
      renderPhoto(key);
      paintFrame();
    }),
  );

  onSnapshot(doc(db, "siteConfig", "contactos"), (snap) => {
    contactos = snap.exists() ? snap.data() : {};
    paintFrame();
  });

  onSnapshot(
    collection(db, "programs"),
    (snap) => {
      programs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => p.ativo !== false)
        .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt"));
      renderPrograms();
      markExclusiveRows();
      paintFrame();
    },
    () => renderPrograms(),
  );

  /* Lista "Programas": etiqueta nos que só aparecem nesta página */
  function markExclusiveRows() {
    const tbody = document.getElementById("programList");
    if (!tbody) return;
    const only = new Set(programs.filter((p) => p.soPersonalizada).map((p) => p.id));
    tbody.querySelectorAll(".btn-edit-program[data-id]").forEach((btn) => {
      const cell = btn.closest("tr")?.querySelector("td");
      if (!cell) return;
      const has = cell.querySelector(".prog-badge-custom");
      if (only.has(btn.dataset.id) && !has) {
        cell.insertAdjacentHTML("beforeend", '<span class="prog-badge-custom" title="Só aparece na página Viagens Personalizadas">Só Pág. Personalizada</span>');
      } else if (!only.has(btn.dataset.id) && has) has.remove();
    });
  }
  const programList = document.getElementById("programList");
  if (programList) new MutationObserver(markExclusiveRows).observe(programList, { childList: true });

  /* ─────────────────────────────────────────
     EDIÇÃO
     ───────────────────────────────────────── */
  pane.addEventListener("input", (e) => {
    const el = e.target.closest("[data-pc-field]");
    if (!el) return;
    const [sec, k] = el.dataset.pcField.split(".");
    draft[sec][k] = el.value;
    setDirty(true);
    paintFrame();
  });

  pane.addEventListener("change", async (e) => {
    // Interruptores (mostrar / esconder)
    const tg = e.target.closest("[data-pc-toggle]");
    if (tg) {
      const [sec, k] = tg.dataset.pcToggle.split(".");
      draft[sec][k] = tg.checked;
      setDirty(true);
      fillFields();
      paintFrame();
      return;
    }

    // Programas
    const box = e.target.closest("[data-pc-programs]");
    if (box && e.target.type === "checkbox") {
      const id = e.target.value;
      const list = draft.destinos.programas.filter((x) => x !== id);
      if (e.target.checked && list.length < PC_MAX_PROGRAMS) list.push(id);
      draft.destinos.programas = list;
      setDirty(true);
      renderPrograms();
      paintFrame();
      return;
    }

    // Fotos → otimiza e publica logo
    const input = e.target.closest("[data-pc-file]");
    if (!input) return;
    const card = input.closest("[data-pc-photo]");
    const key = card.dataset.pcPhoto;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    const busy = card.querySelector(".hg-slot__busy");
    busy.hidden = false;
    try {
      const data = await compressToDataURL(file, PHOTO);
      await setDoc(doc(db, "siteConfig", pcPhotoDoc(key)), { data, atualizadoEm: serverTimestamp() });
      toast("Foto publicada na página.");
    } catch (err) {
      console.error("[pág. personalizada] foto:", err);
      toast(err?.code === "permission-denied" ? "Sem permissão para alterar o site." : err?.message || "Não foi possível usar esta imagem.", "error");
    } finally {
      busy.hidden = true;
    }
  });

  pane.addEventListener("click", async (e) => {
    const reset = e.target.closest("[data-pc-photo-reset]");
    if (reset) {
      const key = reset.closest("[data-pc-photo]").dataset.pcPhoto;
      if (!confirm("Voltar a usar a foto original nesta posição?")) return;
      try {
        await deleteDoc(doc(db, "siteConfig", pcPhotoDoc(key)));
        toast("Foto original reposta.");
      } catch (err) {
        toast(err?.message || "Erro ao repor a foto.", "error");
      }
      return;
    }

    // "Criar programa só para esta página" → abre o formulário de programas com o interruptor ligado
    if (e.target.closest("[data-pc-new-program]")) {
      document.querySelector('.admin-nav__link[data-view="programas"]')?.click();
      const add = document.getElementById("addProgramBtn");
      if (add) {
        add.click();
        const only = document.getElementById("progSoPersonalizada");
        if (only) only.checked = true;
      } else {
        toast("Abra Programas → Adicionar Novo e ligue “Só na página Viagens Personalizadas”.");
      }
      return;
    }

    const dev = e.target.closest("[data-pc-device]");
    if (dev) {
      device = dev.dataset.pcDevice;
      $$("[data-pc-device]").forEach((b) => b.classList.toggle("is-active", b === dev));
      fitFrame();
    }
  });

  $("[data-pc-discard]")?.addEventListener("click", () => {
    draft = clone(published);
    setDirty(false);
    fillFields();
    paintFrame();
  });

  $("[data-pc-publish]")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A publicar…';
    const data = clone(draft);
    PC_SECTIONS.forEach((s) => s.fields.forEach(([k]) => (data[s.key][k] = String(data[s.key][k] || "").trim())));
    try {
      await setDoc(doc(db, "siteConfig", PC_DOC), { ...data, atualizadoEm: serverTimestamp() });
      setDirty(false);
      toast("Página Viagens Personalizadas atualizada.");
    } catch (err) {
      console.error("[pág. personalizada]", err);
      toast(err?.code === "permission-denied" ? "Sem permissão para alterar o site." : err?.message || "Erro ao publicar.", "error");
    } finally {
      btn.disabled = !canEdit;
      btn.innerHTML = original;
    }
  });

  window.addEventListener("beforeunload", (e) => {
    if (dirty) e.preventDefault();
  });

  /* ─────────────────────────────────────────
     PRÉ-VISUALIZAÇÃO DA PÁGINA REAL
     ───────────────────────────────────────── */
  const iframe = $("[data-pc-iframe]");
  const frameBox = $("[data-pc-frame]");
  const VIEW_W = { desktop: 1280, mobile: 390 };
  let device = "desktop";

  function fitFrame() {
    const w = VIEW_W[device];
    const boxW = frameBox.clientWidth || 600;
    const scale = Math.min(1, boxW / w);
    iframe.style.width = `${w}px`;
    iframe.style.height = `${Math.round(frameBox.clientHeight / scale)}px`;
    iframe.style.transform = `scale(${scale})`;
    iframe.style.left = device === "mobile" ? `${Math.max(0, (boxW - w * scale) / 2)}px` : "0px";
    frameBox.classList.toggle("is-mobile", device === "mobile");
  }

  function paintFrame() {
    let d = null;
    try {
      d = iframe.contentDocument;
    } catch {
      return;
    }
    if (!d?.querySelector(".pc-page")) return;
    applyPersonalizada(d, draft, photos, { contactos, programs });
  }

  iframe.addEventListener("load", () => {
    $("[data-pc-loading]").hidden = true;
    const d = iframe.contentDocument;
    if (!d) return;
    const st = d.createElement("style");
    st.textContent = ".reveal-up,.reveal-left,.reveal-right,.reveal-fade{opacity:1!important;transform:none!important;}";
    d.head.appendChild(st);
    // A página aplica a versão publicada quando o Firestore responde → o rascunho volta por cima
    [0, 600, 1500, 3000].forEach((ms) => setTimeout(paintFrame, ms));
  });

  // Só carrega a página quando o separador é aberto
  let started = false;
  const start = () => {
    if (started || pane.hidden) return;
    started = true;
    fitFrame();
    iframe.src = "personalizada.html";
  };
  new MutationObserver(start).observe(pane, { attributes: true, attributeFilter: ["hidden"] });
  window.addEventListener("resize", () => started && fitFrame());

  fillFields();
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
        console.warn("[pág. personalizada] Não foi possível ler o nível de acesso:", err);
      }
      // Espera que o painel tenha os separadores do "Site Web"
      const tryInit = (n = 0) => {
        if (document.querySelector("#conteudo .content-tabs")) initCustomPageAdmin({ db, canEdit });
        else if (n < 50) setTimeout(() => tryInit(n + 1), 200);
      };
      tryInit();
    });
  } catch (err) {
    console.error("[pág. personalizada] Erro ao arrancar:", err);
  }
}

if (document.querySelector(".admin-page")) autoStart();
