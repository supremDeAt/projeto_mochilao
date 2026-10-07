/* =====================================================
   O MOCHILÃO — program-save.js  (ES module)
   Gravação completa de Programas — imagens em Base64 no Firestore

   • Capa: miniatura (~60 KB) no documento do programa
           + versão grande (≤ ~700 KB) na subcoleção "imagens"
   • Galeria: 1 documento por foto na subcoleção "imagens"
   • Capa nova → a anterior é APAGADA
   • Foto removida da galeria → APAGADA
     (só depois de gravar com sucesso; se cancelar, nada se perde)
   • Falha a meio → as imagens novas já gravadas são apagadas
   • Eliminar programa → imagens + documento
   ===================================================== */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import {
  compressToDataURL,
  addImage,
  deleteImages,
  deleteAllImages,
  withTimeout,
} from "./image-store.js";
import {
  getProgramFormData,
  getCoverFile,
  getGalleryChanges,
  validateProgramForm,
} from "./program-form-ui.js";

const COLLECTION = "programs";

// Tamanhos (a string Base64 tem de caber em 1 MB por documento)
const COVER_FULL = { maxPx: 1600, maxChars: 700000 }; // hero da página
const COVER_THUMB = { maxPx: 640, maxChars: 90000 }; // cards + admin
const GALLERY = { maxPx: 1280, maxChars: 450000 };

/* ─────────────────────────────────────────
   GRAVAR (criar / editar)
   ───────────────────────────────────────── */
/**
 * @returns {{ok:false, errors:string[]} | {ok:true, id:string, cleanupFailures:number}}
 */
export async function saveProgram({ db, id = "", existing = null, onStatus = () => {} }) {
  const isNew = !id;

  /* 1. Validar */
  const errors = validateProgramForm({ isNew });
  if (errors.length) return { ok: false, errors };

  /* 2. Ler formulário */
  const data = getProgramFormData();
  const coverFile = getCoverFile();
  const gallery = getGalleryChanges(); // keep/toDelete: { url, publicId = id da imagem }

  const docRef = isNew ? doc(collection(db, COLLECTION)) : doc(db, COLLECTION, id);
  const programId = docRef.id;
  const written = []; // ids gravados nesta operação (para rollback)

  let thumb = null;
  let coverId = null;
  const newGallery = [];

  try {
    /* 3. Capa */
    if (coverFile) {
      onStatus("A otimizar a capa...");
      const full = await compressToDataURL(coverFile, COVER_FULL);
      thumb = await compressToDataURL(coverFile, COVER_THUMB);

      onStatus("A guardar a capa...");
      const { id: imgId } = await addImage(db, programId, { tipo: "capa", data: full });
      written.push(imgId);
      coverId = imgId;
    }

    /* 4. Galeria (uma de cada vez — cada uma é um documento) */
    const total = gallery.toUpload.length;
    for (let i = 0; i < total; i++) {
      onStatus(`A guardar fotos... ${i + 1}/${total}`);
      const dataUrl = await compressToDataURL(gallery.toUpload[i], GALLERY);
      const { id: imgId } = await addImage(db, programId, { tipo: "galeria", data: dataUrl });
      written.push(imgId);
      newGallery.push({ id: imgId });
    }

    /* 5. Documento do programa */
    onStatus("A gravar o programa...");
    const payload = {
      ...data,
      imagemURL: thumb ?? existing?.imagemURL ?? "",
      capaId: coverId ?? existing?.capaId ?? "",
      galeria: [
        ...gallery.keep.map((g) => ({ id: g.publicId })).filter((g) => g.id),
        ...newGallery,
      ],
      atualizadoEm: serverTimestamp(),
    };
    if (isNew) payload.criadoEm = serverTimestamp();

    await withTimeout(
      isNew ? setDoc(docRef, payload) : updateDoc(docRef, payload),
      20000,
      "app/firestore-timeout",
      "O Firestore não respondeu a tempo.",
    );
  } catch (err) {
    // Timeout: a escrita pode ainda concluir sozinha → não apagar
    if (written.length && err.code !== "app/firestore-timeout") {
      onStatus("A reverter...");
      await deleteImages(db, programId, written);
    }
    throw err;
  }

  /* 6. Apagar imagens substituídas / removidas */
  const obsolete = [];
  if (coverId && existing?.capaId && existing.capaId !== coverId) {
    obsolete.push(existing.capaId);
  }
  gallery.toDelete.forEach((g) => obsolete.push(g.publicId));

  let cleanupFailures = 0;
  if (obsolete.filter(Boolean).length) {
    onStatus("A limpar imagens antigas...");
    cleanupFailures = (await deleteImages(db, programId, obsolete)).failed;
  }

  return { ok: true, id: programId, cleanupFailures };
}

/* ─────────────────────────────────────────
   ELIMINAR PROGRAMA (imagens + documento)
   ───────────────────────────────────────── */
export async function deleteProgramFully({ db, program }) {
  // Imagens primeiro: se algo falhar, o programa continua visível
  // no painel e pode tentar eliminar de novo.
  const res = await deleteAllImages(db, program.id);
  await deleteDoc(doc(db, COLLECTION, program.id));
  return { deleted: res.deleted, failed: res.failed };
}

/* ─────────────────────────────────────────
   MENSAGENS DE ERRO LEGÍVEIS
   ───────────────────────────────────────── */
export function describeError(err) {
  const code = err?.code || "";
  const map = {
    "image/invalid": err?.message,
    "image/too-large": err?.message,
    "app/firestore-timeout":
      "O Firestore demorou a responder. Verifique a internet e atualize a lista antes de tentar de novo.",
    "permission-denied":
      "Sem permissão no Firestore. Verifique as Regras (incluindo programs/{id}/imagens).",
    "resource-exhausted":
      "A quota diária gratuita do Firestore foi atingida. Tente novamente amanhã.",
    "invalid-argument":
      "Uma imagem ficou grande demais para o Firestore. Use uma foto mais pequena.",
    unavailable: "Sem ligação ao Firebase. Verifique a internet.",
  };
  return map[code] || err?.message || "Operação não concluída.";
} 