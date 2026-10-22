/* =====================================================
   O MOCHILÃO — admin-sobre.js  (ES module)
   Admin → Site Web → Sobre
   Controlo completo da secção "Sobre o Mochilão":
   foto, textos (PT/EN, com quebras de linha e parágrafos),
   botão, números e tamanhos — com pré-visualização do site real.

   Dados: siteConfig/sobre + siteConfig/sobre-foto
   (formato descrito em about-section.js)
   ===================================================== */

import {
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { compressToDataURL } from "./image-store.js";
import {
  ABOUT_DOC,
  ABOUT_PHOTO_DOC,
  ABOUT_DEFAULTS as DEF,
  SIZE_LIMITS,
  PHOTO_POSITIONS,
  applyAbout,
} from "./about-section.js";
import { esc, toast } from "./admin-utils.js";

const PHOTO = { maxPx: 1600, maxChars: 750000 };
const DEFAULT_PHOTO = "../imagens/camelo.jpeg";
const TEXT_FIELDS = [
  { key: "tag", label: "Etiqueta (por cima do título)", type: "input", max: 40 },
  { key: "titulo", label: "Título", type: "textarea", rows: 3, max: 140, hint: "Enter = nova linha no título." },
  { key: "citacao", label: "Citação (texto em destaque)", type: "textarea", rows: 4, max: 400, hint: "Enter = nova linha." },
  {
    key: "texto",
    label: "Texto",
    type: "textarea",
    rows: 8,
    max: 2000,
    hint: "Enter = nova linha · linha em branco = novo parágrafo.",
  },
  { key: "botao", label: "Texto do botão", type: "input", max: 30 },
];
const COUNTER_KEYS = ["viagens", "clientes", "satisfacao"];

const clone = (o) => JSON.parse(JSON.stringify(o));

/** Estado vazio = tudo como no site original */
function blank() {
  return {
    pt: {},
    en: {},
    contadores: { ...DEF.contadores },
    contadoresInfo: DEF.contadoresInfo.map((c) => ({ sufixo: c.sufixo, pt: "", en: "" })),
    botao: { mostrar: true, link: "" },
    tamanhos: { ...DEF.tamanhos },
    fotoPos: "center",
  };
}

/** Junta o que vem do Firestore ao estado vazio (aceita o formato antigo só com contadores) */
function normalize(raw = {}) {
  const s = blank();
  ["pt", "en"].forEach((l) => {
    TEXT_FIELDS.forEach(({ key }) => {
      const v = raw[l]?.[key];
      if (typeof v === "string") s[l][key] = v;
    });
  });
  COUNTER_KEYS.forEach((k) => {
    const v = parseInt(raw.contadores?.[k], 10);
    if (Number.isFinite(v)) s.contadores[k] = v;
  });
  (raw.contadoresInfo || []).slice(0, 3).forEach((c, i) => {
    if (typeof c?.sufixo === "string") s.contadoresInfo[i].sufixo = c.sufixo;
    if (typeof c?.pt === "string") s.contadoresInfo[i].pt = c.pt;
    if (typeof c?.en === "string") s.contadoresInfo[i].en = c.en;
  });
  if (raw.botao) {
    s.botao.mostrar = raw.botao.mostrar !== false;
    s.botao.link = raw.botao.link || "";
  }
  Object.keys(SIZE_LIMITS).forEach((k) => {
    const v = Number(raw.tamanhos?.[k]);
    if (Number.isFinite(v)) s.tamanhos[k] = v;
  });
  if (PHOTO_POSITIONS[raw.fotoPos]) s.fotoPos = raw.fotoPos;
  return s;
}

/** O que vai para o Firestore: só textos preenchidos */
function toFirestore(s) {
  const out = {
    contadores: { ...s.contadores },
    contadoresInfo: s.contadoresInfo.map((c) => ({ sufixo: c.sufixo.trim(), pt: c.pt.trim(), en: c.en.trim() })),
    botao: { mostrar: s.botao.mostrar, link: s.botao.link.trim() },
    tamanhos: { ...s.tamanhos },
    fotoPos: s.fotoPos,
    pt: {},
    en: {},
    atualizadoEm: serverTimestamp(),
  };
  ["pt", "en"].forEach((l) => {
    TEXT_FIELDS.forEach(({ key }) => {
      // Mantém as quebras de linha; tira espaços no fim de cada linha
      const v = (s[l][key] || "").replace(/[ \t]+$/gm, "").trim();
      if (v) out[l][key] = v;
    });
  });
  return out;
}

export function initAboutAdmin({ db, canEdit = false }) {
  const root = document.getElementById("aboutRoot");
  if (!root) return;

  const ref = doc(db, ...ABOUT_DOC);
  const photoRef = doc(db, ...ABOUT_PHOTO_DOC);

  let saved = blank();
  let draft = blank();
  let savedPhoto = null; // dataURL publicado (null = foto original do site)
  let draftPhoto = null; // null = original · string = nova foto
  let lang = "pt";
  let device = "desktop";
  const dis = canEdit ? "" : "disabled";

  /* ─────────────────────────────────────────
     ESTRUTURA
     ───────────────────────────────────────── */
  root.innerHTML = `
    <div class="ab-form">
      <p class="content-help">
        Tudo o que aparece na secção <strong>"Sobre o Mochilão"</strong> da página inicial.
        Campos vazios ficam com o texto original do site. Nada muda para os visitantes até carregar em
        <strong>Publicar no site</strong>.
      </p>

      <!-- FOTO -->
      <fieldset class="ap-group">
        <legend class="ap-group__title">Foto</legend>
        <div class="ab-photo">
          <div class="ab-photo__thumb" data-ab-thumb></div>
          <div class="ab-photo__side">
            <div class="content-image-actions">
              <label class="btn btn--outline btn--sm ${canEdit ? "" : "is-disabled"}">
                <i class="fa-solid fa-camera"></i> Escolher nova foto
                <input type="file" accept="image/*" class="visually-hidden" data-ab-file ${dis} />
              </label>
              <button type="button" class="btn-link-danger" data-ab-photo-reset hidden ${dis}>Repor foto original</button>
            </div>
            <small class="ab-small">Vertical, de preferência (formato 3:4). É otimizada automaticamente.</small>
            <label class="ab-field ab-field--inline">
              <span>Parte da foto a mostrar</span>
              <select data-ab="fotoPos" ${dis}>
                ${Object.entries(PHOTO_POSITIONS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}
              </select>
            </label>
          </div>
        </div>
      </fieldset>

      <!-- TEXTOS -->
      <fieldset class="ap-group">
        <legend class="ap-group__title">Textos</legend>
        <div class="ab-body">
          <div class="ab-lang" role="group" aria-label="Idioma a editar">
            <button type="button" class="is-active" data-ab-lang="pt">Português</button>
            <button type="button" data-ab-lang="en">English</button>
          </div>
          <p class="ab-small ab-lang-note" data-ab-lang-note hidden>
            Versão que aparece quando o visitante muda o site para inglês. Vazio = tradução atual do site
            (ou o texto em português, onde não há tradução).
          </p>
          ${TEXT_FIELDS.map(
            (f) => `
            <label class="ab-field">
              <span>${esc(f.label)} <small class="ab-count" data-ab-count="${f.key}"></small></span>
              ${
                f.type === "textarea"
                  ? `<textarea rows="${f.rows}" maxlength="${f.max}" data-ab-text="${f.key}" ${dis}></textarea>`
                  : `<input type="text" maxlength="${f.max}" data-ab-text="${f.key}" ${dis} />`
              }
              ${f.hint ? `<small class="ab-small">${esc(f.hint)}</small>` : ""}
            </label>`,
          ).join("")}
          <div class="ab-row-2">
            <label class="ab-check">
              <input type="checkbox" data-ab="botao.mostrar" ${dis} /> Mostrar o botão
            </label>
            <label class="ab-field">
              <span>Ao clicar no botão, ir para</span>
              <input type="text" data-ab="botao.link" placeholder="#contact  ou  https://…" ${dis} />
              <small class="ab-small">#contact (contacto), #tours (programas), #team (equipa) ou um link completo.</small>
            </label>
          </div>
        </div>
      </fieldset>

      <!-- NÚMEROS -->
      <fieldset class="ap-group">
        <legend class="ap-group__title">Números (por cima da foto)</legend>
        <div class="ab-body">
          <div class="ab-counters">
            ${COUNTER_KEYS.map(
              (k, i) => `
              <div class="ab-counter">
                <label class="ab-field"><span>Valor</span>
                  <input type="number" min="0" step="1" data-ab-count-val="${i}" ${dis} /></label>
                <label class="ab-field"><span>Símbolo</span>
                  <input type="text" maxlength="3" data-ab-count-suf="${i}" placeholder="+ ou %" ${dis} /></label>
                <label class="ab-field ab-counter__label"><span>Legenda <em data-ab-lang-tag>PT</em></span>
                  <input type="text" maxlength="24" data-ab-count-label="${i}" ${dis} /></label>
              </div>`,
            ).join("")}
          </div>
        </div>
      </fieldset>

      <!-- TAMANHOS -->
      <fieldset class="ap-group">
        <legend class="ap-group__title">Tamanhos</legend>
        ${Object.entries(SIZE_LIMITS)
          .map(
            ([k, l]) => `
          <div class="ap-row ab-size" data-ab-size="${k}">
            <div class="ap-row__main">
              <div class="ap-row__head">
                <label class="ap-row__label" for="ab-size-${k}">${esc(l.label)}</label>
                <span class="ap-row__value"><input type="number" class="ap-row__num" min="${l.min}" max="${l.max}" step="${l.step}" data-num ${dis} /> px</span>
              </div>
              <input type="range" id="ab-size-${k}" class="ap-row__range" min="${l.min}" max="${l.max}" step="${l.step}" data-range ${dis} />
              <div class="ap-row__foot">
                <small>Padrão: ${DEF.tamanhos[k]}px${k === "titulo" ? " · no telemóvel ajusta-se sozinho" : ""}</small>
                <button type="button" class="ap-row__reset" data-reset hidden ${dis}>Repor</button>
              </div>
            </div>
          </div>`,
          )
          .join("")}
      </fieldset>

      <div class="content-actions ap-actions">
        <button type="button" class="btn btn--primary" data-ab-publish ${dis}>Publicar no site <i class="fa-solid fa-check"></i></button>
        <button type="button" class="btn btn--outline" data-ab-discard ${dis}>Descartar</button>
        <span class="content-dirty" data-ab-dirty hidden><i class="fa-solid fa-circle"></i> Alterações por publicar</span>
      </div>
    </div>

    <div class="ap-live">
      <div class="ap-live__bar">
        <span class="ab-live-title">Pré-visualização · <strong data-ab-live-lang>Português</strong></span>
        <div class="ap-live__devices" role="group" aria-label="Ecrã">
          <button type="button" class="is-active" data-ab-device="desktop" title="Computador"><i class="fa-solid fa-desktop"></i></button>
          <button type="button" data-ab-device="mobile" title="Telemóvel"><i class="fa-solid fa-mobile-screen"></i></button>
        </div>
      </div>
      <div class="ap-live__frame" data-ab-frame>
        <iframe title="Pré-visualização da secção Sobre" data-ab-iframe></iframe>
        <span class="ap-live__loading" data-ab-loading><i class="fa-solid fa-spinner fa-spin"></i> A carregar o site…</span>
      </div>
    </div>`;

  const $ = (sel) => root.querySelector(sel);
  const $$ = (sel) => root.querySelectorAll(sel);
  const iframe = $("[data-ab-iframe]");
  const frameBox = $("[data-ab-frame]");

  /* ─────────────────────────────────────────
     ESTADO → FORMULÁRIO
     ───────────────────────────────────────── */
  const keep = (el) => document.activeElement === el; // não mexer no campo em edição

  function fillText() {
    TEXT_FIELDS.forEach(({ key }) => {
      const el = root.querySelector(`[data-ab-text="${key}"]`);
      if (!keep(el)) el.value = draft[lang][key] || "";
      el.placeholder = DEF[lang][key].replace(/\n/g, " ");
      updateCount(key);
    });
    draft.contadoresInfo.forEach((c, i) => {
      const el = root.querySelector(`[data-ab-count-label="${i}"]`);
      if (!keep(el)) el.value = c[lang] || "";
      el.placeholder = DEF.contadoresInfo[i][lang];
    });
    $$("[data-ab-lang-tag]").forEach((t) => (t.textContent = lang.toUpperCase()));
    $("[data-ab-lang-note]").hidden = lang !== "en";
    $("[data-ab-live-lang]").textContent = lang === "en" ? "English" : "Português";
  }

  function updateCount(key) {
    const el = root.querySelector(`[data-ab-text="${key}"]`);
    const c = root.querySelector(`[data-ab-count="${key}"]`);
    if (c) c.textContent = `${el.value.length}/${el.maxLength}`;
  }

  function fillAll() {
    fillText();
    draft.contadoresInfo.forEach((c, i) => {
      const v = root.querySelector(`[data-ab-count-val="${i}"]`);
      const s = root.querySelector(`[data-ab-count-suf="${i}"]`);
      if (!keep(v)) v.value = draft.contadores[COUNTER_KEYS[i]];
      if (!keep(s)) s.value = c.sufixo;
    });
    $('[data-ab="botao.mostrar"]').checked = draft.botao.mostrar;
    const link = $('[data-ab="botao.link"]');
    if (!keep(link)) link.value = draft.botao.link;
    $('[data-ab="fotoPos"]').value = draft.fotoPos;
    Object.keys(SIZE_LIMITS).forEach(renderSize);
    renderPhoto();
    refresh();
  }

  function renderSize(k) {
    const row = root.querySelector(`[data-ab-size="${k}"]`);
    const v = draft.tamanhos[k];
    row.querySelector("[data-range]").value = v;
    const num = row.querySelector("[data-num]");
    if (!keep(num)) num.value = v;
    row.querySelector("[data-reset]").hidden = v === DEF.tamanhos[k];
    row.classList.toggle("is-changed", v !== saved.tamanhos[k]);
  }

  function renderPhoto() {
    const src = draftPhoto || DEFAULT_PHOTO;
    const thumb = $("[data-ab-thumb]");
    thumb.style.backgroundImage = `url("${src}")`;
    thumb.style.backgroundPosition = draft.fotoPos;
    $("[data-ab-photo-reset]").hidden = !draftPhoto;
  }

  const isDirty = () => JSON.stringify(draft) !== JSON.stringify(saved) || draftPhoto !== savedPhoto;

  function refresh() {
    const dirty = isDirty();
    $("[data-ab-dirty]").hidden = !dirty;
    if (canEdit) {
      $("[data-ab-publish]").disabled = !dirty;
      $("[data-ab-discard]").disabled = !dirty;
    }
    paintFrame();
  }

  /* ─────────────────────────────────────────
     FIRESTORE
     ───────────────────────────────────────── */
  let loaded = false;
  onSnapshot(
    ref,
    (snap) => {
      const keepDraft = loaded && isDirty();
      saved = normalize(snap.exists() ? snap.data() : {});
      if (!keepDraft) draft = clone(saved);
      loaded = true;
      fillAll();
    },
    (err) => {
      console.error("[sobre]", err);
      toast("Não foi possível carregar a secção Sobre.", "error");
    },
  );
  onSnapshot(photoRef, (snap) => {
    const keepDraft = draftPhoto !== savedPhoto;
    savedPhoto = (snap.exists() && snap.data().data) || null;
    if (!keepDraft) draftPhoto = savedPhoto;
    renderPhoto();
    refresh();
  });

  /* ─────────────────────────────────────────
     EVENTOS
     ───────────────────────────────────────── */
  root.addEventListener("input", (e) => {
    const t = e.target;
    if (t.matches("[data-ab-text]")) {
      draft[lang][t.dataset.abText] = t.value;
      updateCount(t.dataset.abText);
    } else if (t.matches("[data-ab-count-val]")) {
      const v = Math.max(0, parseInt(t.value, 10) || 0);
      const i = Number(t.dataset.abCountVal);
      draft.contadores[COUNTER_KEYS[i]] = i === 2 ? Math.min(100, v) : v;
    } else if (t.matches("[data-ab-count-suf]")) {
      draft.contadoresInfo[Number(t.dataset.abCountSuf)].sufixo = t.value;
    } else if (t.matches("[data-ab-count-label]")) {
      draft.contadoresInfo[Number(t.dataset.abCountLabel)][lang] = t.value;
    } else if (t.matches('[data-ab="botao.link"]')) {
      draft.botao.link = t.value;
    } else if (t.closest("[data-ab-size]") && t.matches("[data-range]")) {
      setSize(t.closest("[data-ab-size]").dataset.abSize, t.value);
      return;
    } else return;
    refresh();
  });

  root.addEventListener("change", async (e) => {
    const t = e.target;
    if (t.matches('[data-ab="botao.mostrar"]')) {
      draft.botao.mostrar = t.checked;
      refresh();
    } else if (t.matches('[data-ab="fotoPos"]')) {
      draft.fotoPos = t.value;
      renderPhoto();
      refresh();
    } else if (t.closest("[data-ab-size]") && t.matches("[data-num]")) {
      setSize(t.closest("[data-ab-size]").dataset.abSize, t.value);
      t.value = draft.tamanhos[t.closest("[data-ab-size]").dataset.abSize];
    } else if (t.matches("[data-ab-count-val]")) {
      t.value = draft.contadores[COUNTER_KEYS[Number(t.dataset.abCountVal)]];
    } else if (t.matches("[data-ab-file]")) {
      const file = t.files?.[0];
      t.value = "";
      if (!file) return;
      const thumb = $("[data-ab-thumb]");
      thumb.classList.add("is-busy");
      try {
        draftPhoto = await compressToDataURL(file, PHOTO);
        renderPhoto();
        refresh();
      } catch (err) {
        console.error("[sobre]", err);
        toast(err?.message || "Não foi possível usar esta imagem.", "error");
      } finally {
        thumb.classList.remove("is-busy");
      }
    }
  });

  // Uma quebra de linha num campo de uma linha só não faz sentido → impede o Enter
  root.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches("input[data-ab-text]")) e.preventDefault();
  });

  function setSize(k, raw) {
    const l = SIZE_LIMITS[k];
    let v = Number(raw);
    if (!Number.isFinite(v)) return;
    v = Math.min(l.max, Math.max(l.min, Math.round(v / l.step) * l.step));
    draft.tamanhos[k] = v;
    renderSize(k);
    refresh();
  }

  root.addEventListener("click", async (e) => {
    const t = e.target;
    const langBtn = t.closest("[data-ab-lang]");
    if (langBtn) {
      lang = langBtn.dataset.abLang;
      $$("[data-ab-lang]").forEach((b) => b.classList.toggle("is-active", b === langBtn));
      fillText();
      setFrameLang();
      return;
    }
    const reset = t.closest("[data-reset]");
    if (reset) {
      const k = reset.closest("[data-ab-size]").dataset.abSize;
      setSize(k, DEF.tamanhos[k]);
      return;
    }
    if (t.closest("[data-ab-photo-reset]")) {
      draftPhoto = null;
      renderPhoto();
      refresh();
      return;
    }
    if (t.closest("[data-ab-discard]")) {
      draft = clone(saved);
      draftPhoto = savedPhoto;
      fillAll();
      return;
    }
    const dev = t.closest("[data-ab-device]");
    if (dev) {
      device = dev.dataset.abDevice;
      $$("[data-ab-device]").forEach((b) => b.classList.toggle("is-active", b === dev));
      fitFrame();
      return;
    }
    const pub = t.closest("[data-ab-publish]");
    if (pub) publish(pub);
  });

  async function publish(btn) {
    const link = draft.botao.link.trim();
    if (link && !/^(https?:\/\/|#)/i.test(link)) {
      toast("O link do botão tem de começar por # ou https://", "error");
      return;
    }
    btn.disabled = true;
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A publicar…';
    try {
      if (draftPhoto !== savedPhoto) {
        if (draftPhoto) await setDoc(photoRef, { data: draftPhoto, atualizadoEm: serverTimestamp() });
        else await deleteDoc(photoRef);
        savedPhoto = draftPhoto;
      }
      await setDoc(ref, toFirestore(draft));
      saved = clone(draft);
      toast("Secção “Sobre” publicada no site.");
    } catch (err) {
      console.error("[sobre]", err);
      toast(err?.code === "permission-denied" ? "Sem permissão para alterar o site." : err?.message || "Erro ao publicar.", "error");
    } finally {
      btn.innerHTML = original;
      fillAll();
    }
  }

  /* ─────────────────────────────────────────
     PRÉ-VISUALIZAÇÃO DO SITE REAL
     ───────────────────────────────────────── */
  const VIEW_W = { desktop: 1280, mobile: 390 };

  function fitFrame() {
    const w = VIEW_W[device];
    const boxW = frameBox.clientWidth || 600;
    const scale = Math.min(1, boxW / w);
    iframe.style.width = `${w}px`;
    iframe.style.height = `${Math.round(frameBox.clientHeight / scale)}px`;
    iframe.style.transform = `scale(${scale})`;
    iframe.style.left = device === "mobile" ? `${Math.max(0, (boxW - w * scale) / 2)}px` : "0px";
    frameBox.classList.toggle("is-mobile", device === "mobile");
    setTimeout(scrollToAbout, 50);
  }

  const frameDoc = () => {
    try {
      return iframe.contentDocument;
    } catch {
      return null;
    }
  };
  const frameLang = () => (frameDoc()?.documentElement.lang === "en" ? "en" : "pt");

  function paintFrame() {
    const d = frameDoc();
    if (!d?.getElementById("about")) return;
    // Conteúdo do rascunho; a foto original volta quando é "reposta"
    applyAbout(d, toPreview(draft), draftPhoto || "", frameLang());
  }

  // Igual ao que fica guardado (textos vazios = original do site)
  function toPreview(s) {
    const p = clone(s);
    ["pt", "en"].forEach((l) => Object.keys(p[l]).forEach((k) => (p[l][k] = (p[l][k] || "").trim())));
    return p;
  }

  // Usa o próprio botão PT/EN do site → mostra a tradução real
  function setFrameLang() {
    const d = frameDoc();
    if (!d) return;
    if (frameLang() !== lang) d.querySelector(".navbar__lang")?.click();
    setTimeout(paintFrame, 30);
  }

  function scrollToAbout() {
    const d = frameDoc();
    const sec = d?.getElementById("about");
    if (!sec) return;
    const win = iframe.contentWindow;
    win.scrollTo({ top: sec.getBoundingClientRect().top + win.scrollY - 40 });
  }

  iframe.addEventListener("load", () => {
    $("[data-ab-loading]").hidden = true;
    const d = frameDoc();
    if (!d) return;
    const st = d.createElement("style");
    st.textContent = `.reveal-up,.reveal-left,.reveal-right,.reveal{opacity:1!important;transform:none!important;}`;
    d.head.appendChild(st);
    // O site aplica a versão publicada assim que o Firestore responde → o rascunho volta por cima
    [0, 600, 1500, 3000].forEach((ms) =>
      setTimeout(() => {
        setFrameLang();
        scrollToAbout();
      }, ms),
    );
  });

  // Só carrega o site quando o separador "Sobre" é aberto
  let started = false;
  const pane = root.closest("[data-content-pane]");
  const start = () => {
    if (started || pane?.hidden) return;
    started = true;
    fitFrame();
    iframe.src = "../index.html#about";
  };
  if (pane) new MutationObserver(start).observe(pane, { attributes: true, attributeFilter: ["hidden"] });
  start();
  window.addEventListener("resize", () => started && fitFrame());
}
