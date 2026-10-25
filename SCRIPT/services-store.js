/* =====================================================
   O MOCHILÃO — services-store.js  (ES module)
   Camada de dados da secção "Serviços".
   Usado pelo site (services-public.js) e pelo admin (services-admin.js).

   Coleção: services/{id}
     nome      : "Transfer"
     slug      : "transfer"   → página futura: PAGES/servico.html?s=transfer
     descricao : texto curto do card (até ~180 caracteres)
     icone     : chave de SERVICE_ICONS (services-icons.js)
     link      : opcional — se preenchido, substitui o link automático
     ordem     : 0, 1, 2…
     ativo     : true | false
     criadoEm / atualizadoEm
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
import { SERVICE_ICONS, DEFAULT_ICON } from "./services-icons.js";

export const SERVICES_COLLECTION = "services";
export const DESC_MAX = 180;

// Serviços que estão escritos no index.html (botão "Importar" do admin)
export const DEFAULT_SERVICES = [
  {
    nome: "Transfer",
    slug: "transfer",
    icone: "transfer",
    descricao:
      "Recolha no aeroporto, no hotel ou onde precisar, com motoristas de confiança e viaturas confortáveis em Luanda e nas províncias.",
  },
  {
    nome: "Hotéis",
    slug: "hoteis",
    icone: "hotel",
    descricao:
      "Reservamos o alojamento certo para a sua viagem, de hotéis e resorts a pousadas e lodges, sempre ao melhor preço.",
  },
  {
    nome: "Aluguer de Autocarro",
    slug: "aluguer-autocarro",
    icone: "autocarro",
    descricao:
      "Autocarros com motorista para grupos, empresas, eventos e excursões, com rotas planeadas à sua medida.",
  },
  {
    nome: "City Tour Tuk-Tuk",
    slug: "city-tour-tuk-tuk",
    icone: "tuktuk",
    descricao:
      "Descubra Luanda de uma forma diferente: um passeio de tuk-tuk pelos pontos mais emblemáticos da cidade, com guia local.",
  },
];

/* ─────────────────────────────────────────
   UTILITÁRIOS
   ───────────────────────────────────────── */
export function slugify(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Link do card. `base` é o caminho até à raiz do site
 * ("" no index.html, "../" dentro de PAGES/).
 */
export function serviceHref(s, base = "") {
  let custom = String(s.link || "").trim();
  // Link para a própria página do serviço escrito sem a pasta
  // ("servico.html?s=…" ou "/servico.html?s=…") → corrige para PAGES/
  const internal = custom.match(/^(?:\.{0,2}\/)*(?:PAGES\/)?servico\.html(\?.*)?$/i);
  if (internal) custom = "";
  if (custom) return custom;
  return `${base}PAGES/servico.html?s=${encodeURIComponent(s.slug || s.id || "")}`;
}

function appError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/* ─────────────────────────────────────────
   LEITURA
   ───────────────────────────────────────── */
export async function listServices(db, { onlyActive = false } = {}) {
  const snap = await getDocs(collection(db, SERVICES_COLLECTION));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((s) => !onlyActive || s.ativo !== false)
    .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999));
}

/* ─────────────────────────────────────────
   VALIDAÇÃO
   ───────────────────────────────────────── */
export function validateService(data, others = []) {
  const errors = [];
  const nome = String(data.nome || "").trim();
  const slug = slugify(data.slug || nome);
  const descricao = String(data.descricao || "").trim();
  const link = String(data.link || "").trim();

  if (!nome) errors.push("Indique o nome do serviço.");
  if (!descricao) errors.push("Escreva uma descrição curta.");
  if (descricao.length > DESC_MAX) errors.push(`A descrição tem de ter até ${DESC_MAX} caracteres.`);
  if (!slug) errors.push("O endereço (slug) não pode ficar vazio.");
  if (others.some((o) => o.slug === slug)) {
    errors.push(`Já existe um serviço com o endereço "${slug}".`);
  }
  if (link && !/^(https?:\/\/|\/|\.\.?\/|#|[\w-]+\.html)/i.test(link)) {
    errors.push("O link personalizado não é válido.");
  }
  return errors;
}

/* ─────────────────────────────────────────
   CRIAR / EDITAR
   ───────────────────────────────────────── */
export async function saveService(db, { id = "", data }) {
  const all = await listServices(db);
  const others = all.filter((s) => s.id !== id);
  const errors = validateService(data, others);
  if (errors.length) throw appError("services/invalid", errors.join(" "));

  const isNew = !id;
  const ref = isNew ? doc(collection(db, SERVICES_COLLECTION)) : doc(db, SERVICES_COLLECTION, id);

  const payload = {
    nome: data.nome.trim(),
    slug: slugify(data.slug || data.nome),
    descricao: data.descricao.trim(),
    icone: SERVICE_ICONS[data.icone] ? data.icone : DEFAULT_ICON,
    link: String(data.link || "").trim(),
    ativo: data.ativo !== false,
    atualizadoEm: serverTimestamp(),
  };

  if (isNew) {
    payload.ordem = typeof data.ordem === "number" ? data.ordem : all.length;
    payload.criadoEm = serverTimestamp();
    await setDoc(ref, payload);
  } else {
    await updateDoc(ref, payload);
  }
  return ref.id;
}

/* ─────────────────────────────────────────
   ELIMINAR / REORDENAR / MOSTRAR-ESCONDER
   ───────────────────────────────────────── */
export async function deleteService(db, id) {
  await deleteDoc(doc(db, SERVICES_COLLECTION, id));
}

export async function reorderServices(db, orderedIds) {
  const batch = writeBatch(db);
  orderedIds.forEach((id, i) => batch.update(doc(db, SERVICES_COLLECTION, id), { ordem: i }));
  await batch.commit();
}

export async function setServiceActive(db, id, ativo) {
  await updateDoc(doc(db, SERVICES_COLLECTION, id), {
    ativo: Boolean(ativo),
    atualizadoEm: serverTimestamp(),
  });
}

/** Cria os 4 serviços iniciais (só se a coleção estiver vazia). */
export async function importDefaultServices(db) {
  const existing = await listServices(db);
  if (existing.length) return 0;
  const batch = writeBatch(db);
  DEFAULT_SERVICES.forEach((s, i) => {
    batch.set(doc(collection(db, SERVICES_COLLECTION)), {
      ...s,
      link: "",
      ativo: true,
      ordem: i,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
  });
  await batch.commit();
  return DEFAULT_SERVICES.length;
}