/* =====================================================
   O MOCHILÃO — image-store.js  (ES module)
   Imagens das fotos enviadas pelo painel admin.

   ► COM o Cloudinary configurado (cloudinary-config.js):
     a foto original é enviada para o Cloudinary, em qualidade
     total, e no Firestore fica só o link (https://res.cloudinary.com/…).
     O link já pede ao Cloudinary o tamanho certo, em WebP/AVIF
     automático → fotos nítidas e páginas rápidas.

   ► SEM configuração: comportamento antigo (Base64 no Firestore,
     com redução de qualidade para caber em 1 MB).

   Todo o painel chama compressToDataURL(file, { maxPx }) →
   devolve o texto a guardar (link do Cloudinary ou Base64).

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
import { CLOUDINARY } from "./cloudinary-config.js";

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
async function compressToBase64(file, { maxPx = 1600, maxChars = 600000 } = {}) {
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
   CLOUDINARY
   ───────────────────────────────────────── */
export const cloudinaryEnabled = () =>
  Boolean(CLOUDINARY?.cloudName && CLOUDINARY?.uploadPreset && !/^SEU_/.test(CLOUDINARY.cloudName + CLOUDINARY.uploadPreset));

const MAX_UPLOAD_BYTES = 9.5 * 1024 * 1024; // plano gratuito: 10 MB por imagem
const UPLOAD_TIMEOUT_MS = 120000;
const uploads = new WeakMap(); // o mesmo ficheiro só sobe uma vez (capa + miniatura)

export const isCloudinaryUrl = (u) => /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(u || "");

/**
 * Link do Cloudinary no tamanho pedido (lado maior ≤ px), formato e
 * qualidade automáticos. Nunca aumenta a foto além do original.
 */
export function cldResize(url, px) {
  if (!isCloudinaryUrl(url)) return url;
  const [base, rest] = url.split("/image/upload/");
  // tira uma transformação anterior (se houver) e mantém "v123/pasta/id.ext"
  const path = rest.replace(/^(?:[a-z]{1,3}_[^/]+\/)+/, "");
  return `${base}/image/upload/f_auto,q_auto:good,c_limit,w_${px},h_${px}/${path}`;
}

/* Tamanho entregue: os valores antigos (maxPx) eram pequenos por causa do
   limite de 1 MB do Firestore. Agora pedimos o dobro (ecrãs retina),
   até 2560 px — o Cloudinary guarda sempre o original. */
const deliverPx = (maxPx = 1600) => Math.min(2560, Math.max(800, Math.round(maxPx * 2)));

/* Fotos enormes (> 10 MB) ou em formatos que o Cloudinary recusa → JPEG grande */
async function prepareForUpload(file) {
  if (file.size <= MAX_UPLOAD_BYTES) return file;
  const source = await loadBitmap(file);
  const w = source.width || source.naturalWidth;
  const h = source.height || source.naturalHeight;
  try {
    for (const px of [6000, 4800, 3800]) {
      const scale = Math.min(1, px / Math.max(w, h));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.92));
      if (blob && blob.size <= MAX_UPLOAD_BYTES) return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
    }
  } finally {
    source.close?.();
  }
  throw appError("image/too-large", `"${file.name}" é demasiado grande. Use uma foto com menos de 10 MB.`);
}

async function uploadToCloudinary(file) {
  const ready = await prepareForUpload(file);
  const body = new FormData();
  body.append("file", ready);
  body.append("upload_preset", CLOUDINARY.uploadPreset);
  if (CLOUDINARY.folder) body.append("folder", CLOUDINARY.folder);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPLOAD_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUDINARY.cloudName)}/image/upload`, {
      method: "POST",
      body,
      signal: ctrl.signal,
    });
  } catch (err) {
    throw appError(
      "image/upload-failed",
      err?.name === "AbortError"
        ? `O envio de "${file.name}" demorou demasiado. Verifique a internet e tente de novo.`
        : `Não foi possível enviar "${file.name}". Verifique a internet.`,
    );
  } finally {
    clearTimeout(timer);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.secure_url) {
    const msg = json?.error?.message || `erro ${res.status}`;
    console.error("[cloudinary]", msg, json);
    throw appError(
      "image/upload-failed",
      /preset/i.test(msg)
        ? 'O Cloudinary recusou o envio: confirme o "upload preset" (tem de ser Unsigned) em cloudinary-config.js.'
        : `O Cloudinary recusou "${file.name}": ${msg}`,
    );
  }
  return json.secure_url;
}

/**
 * Prepara uma foto para guardar no Firestore.
 * @param {File} file
 * @param {{maxPx?: number, maxChars?: number}} opts
 * @returns {Promise<string>} link do Cloudinary (ou data URL Base64, sem Cloudinary)
 */
export async function compressToDataURL(file, opts = {}) {
  if (!file || !file.type?.startsWith("image/")) {
    throw appError("image/invalid", `"${file?.name || "ficheiro"}" não é uma imagem.`);
  }
  if (!cloudinaryEnabled()) return compressToBase64(file, opts);

  if (!uploads.has(file)) {
    const p = uploadToCloudinary(file);
    uploads.set(file, p);
    p.catch(() => uploads.delete(file)); // se falhar, pode tentar de novo
  }
  const url = await uploads.get(file);
  return cldResize(url, deliverPx(opts.maxPx));
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
