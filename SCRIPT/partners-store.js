/* =====================================================
   O MOCHILÃO — partners-store.js  (ES module)
   Parceiros apresentados em cada serviço (Hotéis, Transfer…).
   Só montra: fotos, nome e informações básicas.
   Usado pela página do serviço (servico.js) e pelo admin (partners-admin.js).

   Coleção: partners/{id}
     servico     : id do documento em "services"
     nome        : "Hotel Baía"
     localizacao : "Ilha de Luanda"
     descricao   : texto (Enter = nova linha)
     destaques   : ["Piscina", "Wi-Fi", …]   (até 8)
     capa        : miniatura da 1.ª foto (data URL leve) → cards
     fotos       : [ fotoId, … ]  → ordem das fotos (a 1.ª é a capa)
     ordem       : 0, 1, 2…  (dentro do serviço)
     ativo       : true | false
     criadoEm / atualizadoEm
   Subcoleção: partners/{id}/fotos/{fotoId} → { data }
   (1 documento por foto: o Firestore aceita até 1 MB por documento)
   ===================================================== */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

export const PARTNERS_COLLECTION = "partners";
export const DESC_MAX = 600;
export const HIGHLIGHTS_MAX = 8;
export const PHOTOS_MAX = 12;

export const PHOTO_SIZE = { maxPx: 1600, maxChars: 750000 }; // galeria
export const COVER_SIZE = { maxPx: 720, maxChars: 140000 }; // capa dos cards

const photosCol = (db, id) => collection(db, PARTNERS_COLLECTION, id, "fotos");

function appError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

const sortByOrder = (a, b) => (a.ordem ?? 999) - (b.ordem ?? 999);

/* ─────────────────────────────────────────
   LEITURA
   ───────────────────────────────────────── */
export async function listPartners(db, { serviceId = "", onlyActive = false } = {}) {
  const col = collection(db, PARTNERS_COLLECTION);
  const snap = await getDocs(serviceId ? query(col, where("servico", "==", serviceId)) : col);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => !onlyActive || p.ativo !== false)
    .sort(sortByOrder);
}

/** Fotos de um parceiro, já na ordem certa → [{ id, data }] */
export async function loadPartnerPhotos(db, partner) {
  const snap = await getDocs(photosCol(db, partner.id));
  const map = {};
  snap.forEach((d) => (map[d.id] = d.data().data));
  const order = Array.isArray(partner.fotos) ? partner.fotos : [];
  const ordered = order.filter((id) => map[id]).map((id) => ({ id, data: map[id] }));
  // Fotos que não estejam na lista (não devia acontecer) vão para o fim
  Object.keys(map)
    .filter((id) => !order.includes(id))
    .forEach((id) => ordered.push({ id, data: map[id] }));
  return ordered;
}

/* ─────────────────────────────────────────
   VALIDAÇÃO
   ───────────────────────────────────────── */
export function cleanHighlights(list) {
  const seen = new Set();
  return (list || [])
    .map((h) => String(h || "").trim().slice(0, 40))
    .filter((h) => h && !seen.has(h.toLowerCase()) && seen.add(h.toLowerCase()))
    .slice(0, HIGHLIGHTS_MAX);
}

export function validatePartner(data) {
  const errors = [];
  if (!String(data.servico || "").trim()) errors.push("Escolha o serviço.");
  if (!String(data.nome || "").trim()) errors.push("Indique o nome do parceiro.");
  if (String(data.descricao || "").length > DESC_MAX)
    errors.push(`A descrição tem de ter até ${DESC_MAX} caracteres.`);
  if (!data.photos?.length) errors.push("Junte pelo menos uma foto.");
  if (data.photos?.length > PHOTOS_MAX) errors.push(`No máximo ${PHOTOS_MAX} fotos por parceiro.`);
  return errors;
}

/* ─────────────────────────────────────────
   CRIAR / EDITAR
   data.photos = [{ id?: existente, data?: nova (dataURL), thumb?: capa pronta }]
   pela ordem final (a 1.ª é a capa).
   ───────────────────────────────────────── */
export async function savePartner(db, { id = "", data, makeThumb }) {
  const errors = validatePartner(data);
  if (errors.length) throw appError("partners/invalid", errors.join(" "));

  const isNew = !id;
  const ref = isNew ? doc(collection(db, PARTNERS_COLLECTION)) : doc(db, PARTNERS_COLLECTION, id);
  const before = isNew ? null : (await getDoc(ref)).data() || {};

  // 1. Fotos novas → 1 documento cada
  const finalIds = [];
  for (const p of data.photos) {
    if (p.id) {
      finalIds.push(p.id);
    } else {
      const fRef = doc(photosCol(db, ref.id));
      await setDoc(fRef, { data: p.data, criadoEm: serverTimestamp() });
      p.id = fRef.id;
      finalIds.push(fRef.id);
    }
  }

  // 2. Capa (miniatura da 1.ª foto) → só refaz se a 1.ª foto mudou
  const first = data.photos[0];
  let capa = before?.capa || "";
  if (!capa || before?.fotos?.[0] !== first.id) {
    capa = first.thumb || (await makeThumb(first));
  }

  const payload = {
    servico: data.servico,
    nome: data.nome.trim(),
    localizacao: String(data.localizacao || "").trim(),
    descricao: String(data.descricao || "").replace(/[ \t]+$/gm, "").trim(),
    destaques: cleanHighlights(data.destaques),
    capa,
    fotos: finalIds,
    ativo: data.ativo !== false,
    atualizadoEm: serverTimestamp(),
  };

  if (isNew) {
    const same = await listPartners(db, { serviceId: data.servico });
    payload.ordem = same.length;
    payload.criadoEm = serverTimestamp();
    await setDoc(ref, payload);
  } else {
    if (before.servico !== data.servico) {
      const same = await listPartners(db, { serviceId: data.servico });
      payload.ordem = same.length; // mudou de serviço → vai para o fim
    }
    await updateDoc(ref, payload);
  }

  // 3. Fotos retiradas → apagar
  const removed = (before?.fotos || []).filter((f) => !finalIds.includes(f));
  await Promise.allSettled(removed.map((f) => deleteDoc(doc(photosCol(db, ref.id), f))));

  return ref.id;
}

/* ─────────────────────────────────────────
   ELIMINAR / REORDENAR / MOSTRAR-ESCONDER
   ───────────────────────────────────────── */
export async function deletePartner(db, id) {
  const snap = await getDocs(photosCol(db, id));
  await Promise.allSettled(snap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, PARTNERS_COLLECTION, id));
}

export async function reorderPartners(db, orderedIds) {
  const batch = writeBatch(db);
  orderedIds.forEach((id, i) => batch.update(doc(db, PARTNERS_COLLECTION, id), { ordem: i }));
  await batch.commit();
}

export async function setPartnerActive(db, id, ativo) {
  await updateDoc(doc(db, PARTNERS_COLLECTION, id), {
    ativo: Boolean(ativo),
    atualizadoEm: serverTimestamp(),
  });
}
