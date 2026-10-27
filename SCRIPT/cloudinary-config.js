/* =====================================================
   O MOCHILÃO — cloudinary-config.js
   Onde as fotos enviadas pelo painel admin ficam guardadas.

   Preencher com os dados do Cloudinary (ver instruções):
     cloudName    → Dashboard do Cloudinary ("Cloud name")
     uploadPreset → Settings → Upload → Upload presets
                    (preset do tipo "Unsigned")

   ⚠️ Aqui só vão estes dois nomes. A "API Key" e o
      "API Secret" NUNCA se escrevem no código do site.

   Enquanto estiver "SEU_…", o painel continua a guardar
   as fotos como antes (Base64 no Firestore).
   ===================================================== */

export const CLOUDINARY = {
  cloudName: "met3sq1u",
  uploadPreset: "omochilao",
  folder: "mochilao", // pasta onde as fotos ficam no Cloudinary
};
