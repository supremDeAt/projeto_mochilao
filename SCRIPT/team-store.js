/* =====================================================
   O MOCHILÃO — team-store.js  (ES module)
   Camada de dados da secção "Equipa".
   Usado pelo site (team-public.js) e pelo painel admin.

   Coleção: team/{id}
     nome      : "Perpétuo de Assis"
     cargo     : "Fundador & Guia Principal"
     instagram : "https://instagram.com/..."  (opcional)
     fotoURL   : "data:image/webp;base64,..."  (Base64, ~150 KB máx.)
     ordem     : 0, 1, 2…   (posição no site, da esquerda para a direita)
     ativo     : true | false  (false = escondido no site)
     criadoEm / atualizadoEm

   A foto fica dentro do próprio documento: ao trocar a foto,
   a anterior é substituída (não ficam imagens órfãs).
   ===================================================== */

import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { compressToDataURL, appError } from "./image-store.js";

export const TEAM_COLLECTION = "team";
const PHOTO = { maxPx: 800, maxChars: 150000 };

/* ─────────────────────────────────────────
   LEITURA
   ───────────────────────────────────────── */
/**
 * Lista os membros ordenados por "ordem".
 * @param {{onlyActive?: boolean}} opts  true → só os visíveis no site
 */
export async function listTeam(db, { onlyActive = false } = {}) {
  const snap = await getDocs(collection(db, TEAM_COLLECTION));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((m) => !onlyActive || m.ativo !== false)
    .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999));
}

/* ─────────────────────────────────────────
   VALIDAÇÃO
   ───────────────────────────────────────── */
export function validateMember({ nome, cargo, instagram }) {
  const errors = [];
  if (!String(nome || "").trim()) errors.push("Indique o nome.");
  if (!String(cargo || "").trim()) errors.push("Indique o cargo / função.");
  if (instagram && !/^https?:\/\//i.test(instagram.trim())) {
    errors.push("O link do Instagram tem de começar por https://");
  }
  return errors;
}

/* ─────────────────────────────────────────
   CRIAR / EDITAR
   ───────────────────────────────────────── */
/**
 * @param {object} p
 * @param {string}  [p.id]        vazio → novo membro
 * @param {object}  p.data        { nome, cargo, instagram, ativo, ordem? }
 * @param {File}    [p.photoFile] nova foto (substitui a anterior)
 * @param {boolean} [p.removePhoto] true → apaga a foto atual
 * @returns {Promise<string>} id do membro
 */
export async function saveMember(db, { id = "", data, photoFile = null, removePhoto = false }) {
  const errors = validateMember(data);
  if (errors.length) throw appError("team/invalid", errors.join(" "));

  const isNew = !id;
  const ref = isNew ? doc(collection(db, TEAM_COLLECTION)) : doc(db, TEAM_COLLECTION, id);

  const payload = {
    nome: data.nome.trim(),
    cargo: data.cargo.trim(),
    instagram: (data.instagram || "").trim(),
    ativo: data.ativo !== false,
    atualizadoEm: serverTimestamp(),
  };
  if (typeof data.ordem === "number") payload.ordem = data.ordem;

  if (photoFile) {
    payload.fotoURL = await compressToDataURL(photoFile, PHOTO);
  } else if (removePhoto) {
    payload.fotoURL = "";
  }

  if (isNew) {
    if (typeof payload.ordem !== "number") {
      const all = await listTeam(db);
      payload.ordem = all.length; // vai para o fim
    }
    payload.fotoURL ??= "";
    payload.criadoEm = serverTimestamp();
    await setDoc(ref, payload);
  } else {
    await updateDoc(ref, payload);
  }
  return ref.id;
}

/* ─────────────────────────────────────────
   ELIMINAR (a foto vai junto com o documento)
   ───────────────────────────────────────── */
export async function deleteMember(db, id) {
  await deleteDoc(doc(db, TEAM_COLLECTION, id));
}

/* ─────────────────────────────────────────
   REORDENAR — recebe os ids pela nova ordem
   ───────────────────────────────────────── */
export async function reorderTeam(db, orderedIds) {
  const batch = writeBatch(db);
  orderedIds.forEach((id, i) => {
    batch.update(doc(db, TEAM_COLLECTION, id), { ordem: i });
  });
  await batch.commit();
}

/** Mostrar / esconder no site sem apagar. */
export async function setMemberActive(db, id, ativo) {
  await updateDoc(doc(db, TEAM_COLLECTION, id), {
    ativo: Boolean(ativo),
    atualizadoEm: serverTimestamp(),
  });
}