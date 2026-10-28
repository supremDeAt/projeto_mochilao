/* =====================================================
   O MOCHILÃO — admin-galeria.js  (ES module)
   Admin → Site Web → Galeria
   As 5 fotos da secção "Galeria de Aventuras" do index.
   Aceita fotos em qualquer formato: no site aparecem inteiras,
   em mosaico, e abrem em grande ao clicar.
   ===================================================== */

import {
  doc,
  onSnapshot,
  setDoc,
  deleteField,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { compressToDataURL } from "./image-store.js";
import { GALLERY_SLOTS, slotDocId } from "./home-gallery.js";
import { esc, toast } from "./admin-utils.js";

// Tamanho máximo: o documento do Firestore aceita até 1 MB
const PHOTO = { maxPx: 1600, maxChars: 750000 };

export function initGalleryAdmin({ db, canEdit = false }) {
  const grid = document.getElementById("homeGalleryGrid");
  if (!grid) return;

  const state = {}; // key → dados do Firestore

  // Texto de ajuda por cima das fotos
  const help = grid.parentElement?.querySelector(".content-help");
  if (help) {
    help.innerHTML =
      'As 5 fotos da secção <strong>"Galeria de Aventuras"</strong> da página inicial, pela ordem em que aparecem. ' +
      "Pode usar fotos <strong>verticais, horizontais ou quadradas</strong>: no site aparecem inteiras, sem cortes, " +
      "e abrem em grande ao clicar. Cada foto é publicada assim que a escolher.";
  }

  grid.innerHTML = GALLERY_SLOTS.map(
    (s) => `
    <article class="hg-slot hg-slot--${s.key}" data-slot="${s.key}">
      <div class="hg-slot__media">
        <div class="hg-slot__ph"><i class="fa-regular fa-image"></i><span>Sem foto</span></div>
        <img class="hg-slot__img" alt="" hidden />
        <span class="hg-slot__busy" hidden><i class="fa-solid fa-spinner fa-spin"></i> A otimizar…</span>
        ${
          canEdit
            ? `<div class="hg-slot__actions">
                <label class="hg-slot__btn" title="Escolher foto">
                  <i class="fa-solid fa-camera"></i> <span>Escolher foto</span>
                  <input type="file" accept="image/*" class="visually-hidden" data-file />
                </label>
                <button type="button" class="hg-slot__btn hg-slot__btn--danger" data-remove hidden title="Remover foto">
                  <i class="fa-regular fa-trash-can"></i>
                </button>
              </div>`
            : ""
        }
      </div>
      <div class="hg-slot__body">
        <strong class="hg-slot__label">${esc(s.label)}</strong>
        <label class="hg-slot__field">
          <span>Descrição da foto</span>
          <input type="text" maxlength="120" data-alt placeholder="Ex: Pôr do sol em Cabo Ledo" ${canEdit ? "" : "disabled"} />
        </label>
      </div>
    </article>`,
  ).join("");

  const slotEl = (key) => grid.querySelector(`[data-slot="${key}"]`);
  const ref = (key) => doc(db, "siteConfig", slotDocId(key));

  function render(key) {
    const el = slotEl(key);
    const d = state[key] || {};
    const img = el.querySelector(".hg-slot__img");
    const has = Boolean(d.data);
    img.hidden = !has;
    if (has) img.src = d.data;
    else img.removeAttribute("src");
    el.querySelector(".hg-slot__ph").hidden = has;
    el.querySelector("[data-remove]")?.toggleAttribute("hidden", !has);
    const label = el.querySelector(".hg-slot__btn span");
    if (label) label.textContent = has ? "Trocar foto" : "Escolher foto";
    // Não apagar o que está a ser escrito
    const alt = el.querySelector("[data-alt]");
    if (document.activeElement !== alt) alt.value = d.alt || "";
  }

  GALLERY_SLOTS.forEach((s) => {
    onSnapshot(ref(s.key), (snap) => {
      state[s.key] = snap.exists() ? snap.data() : {};
      render(s.key);
    });
  });

  if (!canEdit) return;

  async function save(key, data, msg) {
    try {
      await setDoc(ref(key), { ...data, atualizadoEm: serverTimestamp() }, { merge: true });
      if (msg) toast(msg);
      return true;
    } catch (err) {
      console.error("[galeria]", err);
      toast(err?.code === "permission-denied" ? "Sem permissão para alterar o site." : err?.message || "Erro ao guardar.", "error");
      return false;
    }
  }

  // Escolher / trocar foto → otimiza e publica logo
  grid.addEventListener("change", async (e) => {
    const input = e.target.closest("[data-file]");
    if (!input) return;
    const key = input.closest("[data-slot]").dataset.slot;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    const el = slotEl(key);
    const busy = el.querySelector(".hg-slot__busy");
    busy.hidden = false;
    try {
      const data = await compressToDataURL(file, PHOTO);
      await save(key, { data }, "Foto publicada na galeria.");
    } catch (err) {
      console.error("[galeria]", err);
      toast(err?.message || "Não foi possível usar esta imagem.", "error");
    } finally {
      busy.hidden = true;
    }
  });

  // Descrição → guarda ao sair do campo (aparece por baixo da foto em grande)
  grid.addEventListener(
    "blur",
    (e) => {
      const input = e.target.closest("[data-alt]");
      if (!input) return;
      const key = input.closest("[data-slot]").dataset.slot;
      const value = input.value.trim();
      if ((state[key]?.alt || "") === value) return;
      save(key, { alt: value }, "Descrição guardada.");
    },
    true,
  );

  grid.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-remove]");
    if (!btn) return;
    const key = btn.closest("[data-slot]").dataset.slot;
    if (!confirm("Remover esta foto da galeria do site?")) return;
    await save(key, { data: deleteField() }, "Foto removida.");
  });
}
