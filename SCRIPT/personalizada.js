/* =====================================================
   O MOCHILÃO — personalizada.js  (ES module)
   Página PAGES/personalizada.html.

   Lê do Firestore o conteúdo editado no painel
   (Site Web → Pág. Personalizada) e aplica-o à página:
     siteConfig/personalizada            → textos + programas escolhidos
     siteConfig/personalizada-foto-<key> → fotos
     siteConfig/contactos                → número de WhatsApp e email
     programs                            → cartões "Conheça alguns destinos"

   Sem ligação ao Firestore → fica o conteúdo original do HTML.
   ===================================================== */

import { PC_DOC, PC_PHOTOS, pcPhotoDoc, applyPersonalizada } from "./personalizada-content.js";

async function load() {
  // Botões já funcionam com o número/email por defeito
  applyPersonalizada(document);

  try {
    const [{ db }, fs] = await Promise.all([
      import("./firebase-config.js"),
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js"),
    ]);
    const { doc, getDoc, collection, getDocs } = fs;
    const get = (id) =>
      getDoc(doc(db, "siteConfig", id))
        .then((s) => (s.exists() ? s.data() : {}))
        .catch(() => ({}));

    const [data, contactos, programsSnap, ...photoDocs] = await Promise.all([
      get(PC_DOC),
      get("contactos"),
      getDocs(collection(db, "programs")).catch(() => null),
      ...PC_PHOTOS.map((p) => get(pcPhotoDoc(p.key))),
    ]);

    const photos = {};
    PC_PHOTOS.forEach((p, i) => (photos[p.key] = photoDocs[i]?.data || ""));

    const programs = programsSnap
      ? programsSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.ativo !== false)
      : null;

    applyPersonalizada(document, data, photos, { contactos, programs });
  } catch (err) {
    console.warn("[personalizada] A usar o conteúdo do HTML:", err);
  }
}

load();
