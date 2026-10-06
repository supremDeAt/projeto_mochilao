/* =====================================================
   O MOCHILÃO — image-store.js  (ES module)
   Imagens em Base64 guardadas no próprio Firestore
   (solução temporária enquanto o projeto está no plano Spark)

   Estrutura:
     programs/{id}                    → documento do programa (leve)
        imagemURL : miniatura da capa (data URL ~60 KB) → cards / admin
        capaId    : id da capa em tamanho grande
        galeria   : [{ id }] → ordem das fotos
     programs/{id}/imagens/{imgId}    → 1 documento por imagem
        { tipo: "capa" | "galeria", data: "data:image/webp;base64,..." }

   Porquê assim: o Firestore aceita no máximo 1 MB por documento.
   Separar as imagens mantém o documento do programa pequeno, para que
   o index (que lista todos os programas) não descarregue as galerias.
   ===================================================== */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const WRITE_TIMEOUT_MS = 30000;

/* ─────────────────────────────────────────
   UTILITÁRIOS
   ───────────────────────────────────────── */
export function appError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

export function withTimeout(promise, ms, code, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(appError(code, message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const imagesCol = (db, programId) =>
  collection(db, "programs", programId, "imagens");

/* ─────────────────────────────────────────
   COMPRESSÃO → DATA URL (Base64)
   Reduz qualidade e, se preciso, dimensões, até caber em maxChars.
   ───────────────────────────────────────── */
async function loadBitmap(file) {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      try {
        return await createImageBitmap(file);
      } catch {
        /* cai para o método antigo */
      }
    }
  }
  // Fallback para browsers antigos
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * @param {File} file
 * @param {{maxPx?: number, maxChars?: number}} opts
 *   maxPx    → lado maior máximo (px)
 *   maxChars → tamanho máximo da string Base64
 * @returns {Promise<string>} data URL (WebP, ou JPEG se o browser não suportar WebP)
 */
export async function compressToDataURL(file, { maxPx = 1600, maxChars = 600000 } = {}) {
  if (!file || !file.type.startsWith("image/")) {
    throw appError("image/invalid", `"${file?.name || "ficheiro"}" não é uma imagem.`);
  }

  const source = await loadBitmap(file);
  const srcW = source.width || source.naturalWidth;
  const srcH = source.height || source.naturalHeight;
  let px = maxPx;

  try {
    for (let attempt = 0; attempt < 6; attempt++) {
      const scale = Math.min(1, px / Math.max(srcW, srcH));
      const w = Math.max(1, Math.round(srcW * scale));
      const h = Math.max(1, Math.round(srcH * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff"; // fundo branco para PNG transparente
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(source, 0, 0, w, h);

      for (const q of [0.82, 0.72, 0.62, 0.52]) {
        let url = canvas.toDataURL("image/webp", q);
        if (!url.startsWith("data:image/webp")) {
          url = canvas.toDataURL("image/jpeg", q); // Safari antigo
        }
        if (url.length <= maxChars) return url;
      }
      px = Math.round(px * 0.75); // ainda grande → reduz dimensões
    }
  } finally {
    source.close?.();
  }

  throw appError(
    "image/too-large",
    `Não foi possível reduzir "${file.name}" o suficiente. Use uma imagem mais pequena.`,
  );
}

/* ─────────────────────────────────────────
   LEITURA / ESCRITA NA SUBCOLEÇÃO
   ───────────────────────────────────────── */

/** Grava uma imagem e devolve { id }. */
export async function addImage(db, programId, { tipo, data }) {
  const ref = doc(imagesCol(db, programId));
  await withTimeout(
    setDoc(ref, { tipo, data, criadoEm: serverTimestamp() }),
    WRITE_TIMEOUT_MS,
    "app/firestore-timeout",
    "O Firestore demorou demasiado a guardar uma imagem.",
  );
  return { id: ref.id };
}

/** Apaga imagens por id. Nunca lança erro: devolve quantas falharam. */
export async function deleteImages(db, programId, ids = []) {
  const unique = [...new Set(ids.filter(Boolean))];
  const results = await Promise.allSettled(
    unique.map((id) => deleteDoc(doc(db, "programs", programId, "imagens", id))),
  );
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed) console.warn(`[imagens] ${failed} imagem(ns) não apagada(s).`);
  return { deleted: unique.length - failed, failed };
}

/** Lê todas as imagens de um programa → { [id]: { tipo, data } } */
export async function loadProgramImages(db, programId) {
  const snap = await getDocs(imagesCol(db, programId));
  const map = {};
  snap.forEach((d) => {
    map[d.id] = d.data();
  });
  return map;
}

/** Apaga TODAS as imagens de um programa. */
export async function deleteAllImages(db, programId) {
  const snap = await getDocs(imagesCol(db, programId));
  return deleteImages(
    db,
    programId,
    snap.docs.map((d) => d.id),
  );
}

/* ─────────────────────────────────────────
   PARA AS PÁGINAS PÚBLICAS
   ───────────────────────────────────────── */
/**
 * Devolve as imagens de um programa já prontas para usar em <img src>.
 * @returns {Promise<{capa: string, galeria: string[]}>}
 */
export async function getProgramMedia(db, program) {
  const imgs = await loadProgramImages(db, program.id);
  return {
    capa: imgs[program.capaId]?.data || program.imagemURL || "",
    galeria: (program.galeria || [])
      .map((g) => imgs[g.id]?.data)
      .filter(Boolean),
  };
}