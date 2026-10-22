/* =====================================================
   O MOCHILÃO — admin-aparencia.js  (ES module)
   Admin → Site Web → Aparência
   Tamanho dos ícones, botões e títulos do site, com
   pré-visualização do site real ao lado.

   Guarda em siteConfig/aparencia → { valores: { chave: número } }
   A lista de ajustes vem do site-appearance.js (SETTINGS).
   ===================================================== */

import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { SETTINGS, APPEARANCE_DOC, buildAppearanceCSS } from "./site-appearance.js";
import { esc, toast } from "./admin-utils.js";

/* Onde cada ajuste aparece no site (para a pré-visualização) */
const WHERE = {
  tipsIcon: { page: "index", target: "#tips" },
  serviceIcon: { page: "index", target: "#services" },
  programDetailIcon: { page: "programa", target: ".pkg-detail__icon" },
  programListIcon: { page: "programa", target: ".pkg-inclui__list" },
  socialBtn: { page: "index", target: ".social-btn" },
  footerSocial: { page: "index", target: ".footer__socials" },
  floatBtn: { page: "index", target: null },
  heroTitle: { page: "index", target: ".hero__title" },
  sectionTitle: { page: "index", target: ".section-title" },
};

const PAGES = {
  index: { label: "Página inicial", url: "../index.html" },
  programa: { label: "Página do programa", url: "../PAGES/programa.html?d=cabo-ledo" },
  faq: { label: "Perguntas frequentes", url: "../PAGES/faq.html" },
};

const SERVICE_SVG = `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="14" width="48" height="32" rx="6"/><path d="M8 32h48M18 46v6M46 46v6M16 22h12M36 22h12"/><circle cx="18" cy="39" r="2"/><circle cx="46" cy="39" r="2"/></svg>`;

function previewHTML(s) {
  const p = s.preview || {};
  const fam = p.brand ? "fa-brands" : "fa-solid";
  switch (p.type) {
    case "circle":
      return `<span class="ap-prev ap-prev--circle${p.filled ? " is-filled" : ""}"><i class="${fam} ${p.icon}"></i></span>`;
    case "icon":
      return `<span class="ap-prev ap-prev--icon"><i class="${fam} ${p.icon}"></i></span>`;
    case "svg":
      return `<span class="ap-prev ap-prev--svg">${SERVICE_SVG}</span>`;
    case "text":
      return `<span class="ap-prev ap-prev--text" title="${esc(p.text || "")}">Aa</span>`;
    default:
      return "";
  }
}

/* Tamanho aplicado à miniatura */
function sizePreview(el, s, v) {
  const p = s.preview || {};
  const box = el.querySelector(".ap-prev");
  if (!box) return;
  if (p.type === "circle") {
    box.style.width = box.style.height = `${v}px`;
    box.style.fontSize = `${Math.round(v * 0.37)}px`;
  } else if (p.type === "icon") {
    box.style.fontSize = `${v}px`;
  } else if (p.type === "svg") {
    box.style.width = box.style.height = `${v}px`;
  } else if (p.type === "text") {
    // Reduzido para caber na caixa; a proporção entre valores mantém-se
    box.style.fontSize = `${Math.round(v * 0.5)}px`;
  }
}

export function initAppearanceAdmin({ db, canEdit = false }) {
  const root = document.getElementById("appearanceRoot");
  if (!root) return;

  const ref = doc(db, ...APPEARANCE_DOC);
  const defaults = Object.fromEntries(SETTINGS.map((s) => [s.key, s.def]));
  let saved = { ...defaults };
  let draft = { ...defaults };
  let loaded = false;
  let currentPage = "index";
  let device = "desktop";

  /* ─────────────────────────────────────────
     ESTRUTURA
     ───────────────────────────────────────── */
  const groups = [...new Set(SETTINGS.map((s) => s.group))];
  const dis = canEdit ? "" : "disabled";

  root.innerHTML = `
    <div class="ap-controls">
      <p class="content-help">
        Aumente ou diminua ícones, botões e títulos. A pré-visualização ao lado mostra o site real
        com as suas alterações — nada muda para os visitantes até carregar em <strong>Publicar no site</strong>.
      </p>
      ${groups
        .map(
          (g) => `
        <fieldset class="ap-group">
          <legend class="ap-group__title">${esc(g)}</legend>
          ${SETTINGS.filter((s) => s.group === g)
            .map(
              (s) => `
            <div class="ap-row" data-key="${s.key}">
              <div class="ap-row__preview">${previewHTML(s)}</div>
              <div class="ap-row__main">
                <div class="ap-row__head">
                  <label class="ap-row__label" for="ap-${s.key}">${esc(s.label)}</label>
                  <span class="ap-row__value"><input type="number" class="ap-row__num" min="${s.min}" max="${s.max}" step="${s.step}" data-num ${dis} aria-label="${esc(s.label)} em píxeis" /> px</span>
                </div>
                <input type="range" id="ap-${s.key}" class="ap-row__range" min="${s.min}" max="${s.max}" step="${s.step}" data-range ${dis} />
                <div class="ap-row__foot">
                  <small>${s.hint ? esc(s.hint) + " " : ""}Padrão: ${s.def}px${s.desktopOnly ? " · no telemóvel o tamanho ajusta-se sozinho" : ""}</small>
                  <button type="button" class="ap-row__reset" data-reset ${dis} hidden>Repor</button>
                </div>
              </div>
            </div>`,
            )
            .join("")}
        </fieldset>`,
        )
        .join("")}

      <div class="content-actions ap-actions">
        <button type="button" class="btn btn--primary" data-ap-publish ${dis}>Publicar no site <i class="fa-solid fa-check"></i></button>
        <button type="button" class="btn btn--outline" data-ap-discard ${dis}>Descartar</button>
        <button type="button" class="btn-link-danger" data-ap-defaults ${dis}>Repor todos os tamanhos originais</button>
        <span class="content-dirty" data-ap-dirty hidden><i class="fa-solid fa-circle"></i> Alterações por publicar</span>
      </div>
    </div>

    <div class="ap-live">
      <div class="ap-live__bar">
        <select class="ap-live__page" data-ap-page aria-label="Página a pré-visualizar">
          ${Object.entries(PAGES).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join("")}
        </select>
        <div class="ap-live__devices" role="group" aria-label="Ecrã">
          <button type="button" class="is-active" data-ap-device="desktop" title="Computador"><i class="fa-solid fa-desktop"></i></button>
          <button type="button" data-ap-device="mobile" title="Telemóvel"><i class="fa-solid fa-mobile-screen"></i></button>
        </div>
      </div>
      <div class="ap-live__frame" data-ap-frame>
        <iframe title="Pré-visualização do site" loading="lazy" data-ap-iframe></iframe>
        <span class="ap-live__loading" data-ap-loading><i class="fa-solid fa-spinner fa-spin"></i> A carregar o site…</span>
      </div>
    </div>`;

  const rows = new Map([...root.querySelectorAll(".ap-row")].map((el) => [el.dataset.key, el]));
  const settingOf = Object.fromEntries(SETTINGS.map((s) => [s.key, s]));
  const $ = (sel) => root.querySelector(sel);
  const iframe = $("[data-ap-iframe]");
  const frameBox = $("[data-ap-frame]");

  /* ─────────────────────────────────────────
     ESTADO → ECRÃ
     ───────────────────────────────────────── */
  function renderRow(key) {
    const el = rows.get(key);
    const s = settingOf[key];
    const v = draft[key];
    el.querySelector("[data-range]").value = v;
    const num = el.querySelector("[data-num]");
    if (document.activeElement !== num) num.value = v;
    el.querySelector("[data-reset]").hidden = v === s.def;
    el.classList.toggle("is-changed", v !== saved[key]);
    sizePreview(el, s, v);
  }

  const isDirty = () => SETTINGS.some((s) => draft[s.key] !== saved[s.key]);

  function renderAll() {
    SETTINGS.forEach((s) => renderRow(s.key));
    updateState();
  }

  function updateState() {
    $("[data-ap-dirty]").hidden = !isDirty();
    if (canEdit) {
      $("[data-ap-publish]").disabled = !isDirty();
      $("[data-ap-discard]").disabled = !isDirty();
      $("[data-ap-defaults]").disabled = SETTINGS.every((s) => draft[s.key] === s.def);
    }
    paintFrame();
  }

  function setValue(key, raw) {
    const s = settingOf[key];
    let v = Number(raw);
    if (!Number.isFinite(v)) return;
    v = Math.min(s.max, Math.max(s.min, Math.round(v / s.step) * s.step));
    draft[key] = v;
    renderRow(key);
    updateState();
  }

  /* ─────────────────────────────────────────
     FIRESTORE
     ───────────────────────────────────────── */
  onSnapshot(
    ref,
    (snap) => {
      const valores = (snap.exists() && snap.data().valores) || {};
      const next = { ...defaults };
      SETTINGS.forEach((s) => {
        const v = Number(valores[s.key]);
        if (Number.isFinite(v)) next[s.key] = v;
      });
      // Só substitui o rascunho se não houver alterações por publicar
      const keepDraft = loaded && isDirty();
      saved = next;
      if (!keepDraft) draft = { ...next };
      loaded = true;
      renderAll();
    },
    (err) => {
      console.error("[aparência]", err);
      toast("Não foi possível carregar os tamanhos atuais.", "error");
      loaded = true;
      renderAll();
    },
  );

  /* ─────────────────────────────────────────
     EVENTOS
     ───────────────────────────────────────── */
  root.addEventListener("input", (e) => {
    const row = e.target.closest(".ap-row");
    if (!row) return;
    if (e.target.matches("[data-range]")) setValue(row.dataset.key, e.target.value);
  });
  root.addEventListener("change", (e) => {
    const row = e.target.closest(".ap-row");
    if (row && e.target.matches("[data-num]")) {
      setValue(row.dataset.key, e.target.value);
      e.target.value = draft[row.dataset.key];
    }
  });

  // Ao mexer num ajuste, a pré-visualização vai até ele
  root.addEventListener("focusin", (e) => {
    const row = e.target.closest(".ap-row");
    if (row) focusSetting(row.dataset.key);
  });
  root.addEventListener("pointerdown", (e) => {
    const row = e.target.closest(".ap-row");
    if (row) focusSetting(row.dataset.key);
  });

  root.addEventListener("click", async (e) => {
    const reset = e.target.closest("[data-reset]");
    if (reset) {
      const key = reset.closest(".ap-row").dataset.key;
      setValue(key, settingOf[key].def);
      return;
    }
    if (e.target.closest("[data-ap-discard]")) {
      draft = { ...saved };
      renderAll();
      return;
    }
    if (e.target.closest("[data-ap-defaults]")) {
      draft = { ...defaults };
      renderAll();
      toast("Tamanhos originais repostos. Carregue em “Publicar no site” para aplicar.", "info");
      return;
    }
    const pub = e.target.closest("[data-ap-publish]");
    if (pub) {
      pub.disabled = true;
      // Só guarda o que é diferente do padrão (o resto fica no CSS)
      const valores = {};
      SETTINGS.forEach((s) => {
        if (draft[s.key] !== s.def) valores[s.key] = draft[s.key];
      });
      try {
        await setDoc(ref, { valores, atualizadoEm: serverTimestamp() });
        toast("Tamanhos publicados no site.");
      } catch (err) {
        console.error("[aparência]", err);
        toast(err?.code === "permission-denied" ? "Sem permissão para alterar o site." : err?.message || "Erro ao publicar.", "error");
        updateState();
      }
      return;
    }
    const dev = e.target.closest("[data-ap-device]");
    if (dev) {
      device = dev.dataset.apDevice;
      root.querySelectorAll("[data-ap-device]").forEach((b) => b.classList.toggle("is-active", b === dev));
      fitFrame();
    }
  });

  $("[data-ap-page]").addEventListener("change", (e) => loadPage(e.target.value));

  /* ─────────────────────────────────────────
     PRÉ-VISUALIZAÇÃO DO SITE REAL
     ───────────────────────────────────────── */
  const VIEW_W = { desktop: 1280, mobile: 390 };
  let pendingTarget = null;

  function fitFrame() {
    const w = VIEW_W[device];
    const boxW = frameBox.clientWidth || 600;
    const scale = Math.min(1, boxW / w);
    iframe.style.width = `${w}px`;
    iframe.style.height = `${Math.round(frameBox.clientHeight / scale)}px`;
    iframe.style.transform = `scale(${scale})`;
    frameBox.classList.toggle("is-mobile", device === "mobile");
    if (device === "mobile") iframe.style.left = `${Math.max(0, (boxW - w * scale) / 2)}px`;
    else iframe.style.left = "0px";
  }

  function frameDoc() {
    try {
      return iframe.contentDocument;
    } catch {
      return null;
    }
  }

  /* As regras do rascunho têm de ganhar às já publicadas
     (que o site aplica com "html body") */
  function paintFrame() {
    const d = frameDoc();
    if (!d?.head) return;
    let style = d.getElementById("admin-draft");
    if (!style) {
      style = d.createElement("style");
      style.id = "admin-draft";
      d.head.appendChild(style);
    }
    style.textContent = buildAppearanceCSS(draftAsDiff()).replaceAll("html body ", "html:not(#_) body ");
    // Os valores iguais ao padrão também têm de ganhar ao que está publicado
    const resets = SETTINGS.filter((s) => draft[s.key] === s.def && saved[s.key] !== s.def);
    if (resets.length) {
      const nudge = Object.fromEntries(resets.map((s) => [s.key, s.def + 0.0001]));
      style.textContent += "\n" + buildAppearanceCSS(nudge).replaceAll("html body ", "html:not(#_) body ");
    }
  }

  function draftAsDiff() {
    const out = {};
    SETTINGS.forEach((s) => {
      if (draft[s.key] !== s.def) out[s.key] = draft[s.key];
    });
    return out;
  }

  function loadPage(page) {
    if (!PAGES[page]) return;
    currentPage = page;
    $("[data-ap-page]").value = page;
    $("[data-ap-loading]").hidden = false;
    iframe.src = PAGES[page].url;
  }

  iframe.addEventListener("load", () => {
    $("[data-ap-loading]").hidden = true;
    const d = frameDoc();
    if (!d) return;
    // Mostra todas as animações de entrada logo de início
    const st = d.createElement("style");
    st.textContent = `.reveal-up,.reveal-left,.reveal-right,.reveal{opacity:1!important;transform:none!important;}`;
    d.head.appendChild(st);
    paintFrame();
    if (pendingTarget) scrollFrameTo(pendingTarget);
    pendingTarget = null;
  });

  function scrollFrameTo(sel) {
    const d = frameDoc();
    const el = sel && d?.querySelector(sel);
    if (!el) return;
    const win = iframe.contentWindow;
    const top = el.getBoundingClientRect().top + win.scrollY - 120;
    win.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  let lastFocus = null;
  function focusSetting(key) {
    if (key === lastFocus) return;
    lastFocus = key;
    const w = WHERE[key];
    if (!w) return;
    if (w.page !== currentPage) {
      pendingTarget = w.target;
      loadPage(w.page);
    } else if (w.target) {
      scrollFrameTo(w.target);
    }
  }

  // Só carrega o site quando o separador "Aparência" é aberto
  let started = false;
  const pane = root.closest("[data-content-pane]");
  const start = () => {
    if (started || pane?.hidden) return;
    started = true;
    fitFrame();
    loadPage("index");
  };
  if (pane) new MutationObserver(start).observe(pane, { attributes: true, attributeFilter: ["hidden"] });
  start();
  window.addEventListener("resize", () => started && fitFrame());
}
