/* =====================================================
   O MOCHILÃO — services-store.js (ES module)
   Camada de dados da secção "Serviços".
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

export const SERVICES_COLLECTION = "services";
export const DESC_MAX = 180;

const DEFAULT_SERVICES = [
  {
    nome: "Transfer",
    descricao: "Transporte confortável e seguro para os seus destinos.",
    slug: "transfer",
    icone: "transfer",
  },
  {
    nome: "Hotéis",
    descricao: "Alojamento selecionado para uma estadia tranquila.",
    slug: "hoteis",
    icone: "hotel",
  },
  {
    nome: "Aluguer de Autocarro",
    descricao: "Transporte para grupos, eventos e viagens em Angola.",
    slug: "aluguer-de-autocarro",
    icone: "autocarro",
  },
  {
    nome: "City Tour Tuk-Tuk",
    descricao: "Explore a cidade numa experiência local de tuk-tuk.",
    slug: "city-tour-tuk-tuk",
    icone: "tuktuk",
  },
];

export function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function serviceHref(service, base = "") {
  if (service.link) return service.link;
  return `${base}servico.html?s=${encodeURIComponent(service.slug || "")}`;
}

export async function listServices(db, { onlyActive = false } = {}) {
  const snap = await getDocs(collection(db, SERVICES_COLLECTION));
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((service) => !onlyActive || service.ativo !== false)
    .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999));
}

export async function saveService(db, { id = "", data }) {
  const nome = String(data.nome || "").trim();
  const descricao = String(data.descricao || "").trim();
  const slug = slugify(data.slug || nome);
  if (!nome) throw new Error("Indique o nome do serviço.");
  if (!descricao || descricao.length > DESC_MAX) {
    throw new Error(`A descrição deve ter entre 1 e ${DESC_MAX} caracteres.`);
  }
  if (!slug) throw new Error("Indique um endereço válido para o serviço.");

  const isNew = !id;
  const ref = isNew
    ? doc(collection(db, SERVICES_COLLECTION))
    : doc(db, SERVICES_COLLECTION, id);
  const payload = {
    nome,
    descricao,
    slug,
    icone: data.icone || "bussola",
    link: String(data.link || "").trim(),
    ativo: data.ativo !== false,
    atualizadoEm: serverTimestamp(),
  };

  if (isNew) {
    payload.ordem = (await listServices(db)).length;
    payload.criadoEm = serverTimestamp();
    await setDoc(ref, payload);
  } else {
    await updateDoc(ref, payload);
  }
  return ref.id;
}

export async function deleteService(db, id) {
  await deleteDoc(doc(db, SERVICES_COLLECTION, id));
}

export async function reorderServices(db, orderedIds) {
  if (!orderedIds.length) return;
  const batch = writeBatch(db);
  orderedIds.forEach((id, order) => {
    batch.update(doc(db, SERVICES_COLLECTION, id), {
      ordem: order,
      atualizadoEm: serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function setServiceActive(db, id, ativo) {
  await updateDoc(doc(db, SERVICES_COLLECTION, id), {
    ativo: Boolean(ativo),
    atualizadoEm: serverTimestamp(),
  });
}

export async function importDefaultServices(db) {
  if ((await listServices(db)).length) return;
  const batch = writeBatch(db);
  DEFAULT_SERVICES.forEach((service, ordem) => {
    const ref = doc(collection(db, SERVICES_COLLECTION));
    batch.set(ref, {
      ...service,
      link: "",
      ativo: true,
      ordem,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
  });
  await batch.commit();
}
