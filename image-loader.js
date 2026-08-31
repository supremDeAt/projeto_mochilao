/* =====================================================
   Image Loader — Carregar imagens do Firebase no site
   Integra automaticamente as imagens uploaded no admin
   ===================================================== */

(function () {
  "use strict";

  // Aguardar que Firebase esteja pronto
  if (!window.FirebaseApp) {
    console.error("Firebase não está inicializado. Carregue firebase-config.js primeiro.");
    return;
  }

  const { storage, CONFIG } = window.FirebaseApp;

  /* ─────────────────────────────────────────
     1. CARREGAR IMAGENS DOS PACOTES
     ───────────────────────────────────────── */

  async function loadPackageImages() {
    const folderPath = CONFIG.STORAGE_PATHS.PACKAGES;

    try {
      const result = await storage.ref(folderPath).listAll();

      const imageMap = {};
      for (const item of result.items) {
        const url = await item.getDownloadURL();
        // Extrair destination do nome do ficheiro (ex: "cabo-ledo", "quicama")
        const destination = item.name.split("_")[1]?.split(".")[0] || item.name;
        if (!imageMap[destination]) {
          imageMap[destination] = url;
        }
      }

      // Atualizar tour-cards no hero
      document.querySelectorAll(".tour-card").forEach((card) => {
        const destination = card.getAttribute("data-destination");
        if (imageMap[destination]) {
          const currentBg = window
            .getComputedStyle(card)
            .backgroundImage;
          const gradientPart = currentBg.split(",").slice(0, -1).join(",");
          card.style.backgroundImage = `${gradientPart}, url('${imageMap[destination]}')`;
          card.style.backgroundSize = "cover";
          card.style.backgroundPosition = "center";
        }
      });

      console.log("✅ Imagens dos pacotes carregadas", imageMap);
    } catch (error) {
      console.error("Erro ao carregar imagens dos pacotes:", error);
    }
  }

  /* ─────────────────────────────────────────
     2. CARREGAR IMAGENS DA GALERIA
     ───────────────────────────────────────── */

  async function loadGalleryImages() {
    const folderPath = CONFIG.STORAGE_PATHS.GALLERY;

    try {
      const result = await storage.ref(folderPath).listAll();
      const urls = [];

      for (const item of result.items) {
        const url = await item.getDownloadURL();
        urls.push(url);
      }

      // Atualizar gallery items
      const galleryItems = document.querySelectorAll(".gallery__item");
      galleryItems.forEach((item, index) => {
        if (urls[index]) {
          item.style.backgroundImage = `url('${urls[index]}')`;
          item.style.backgroundSize = "cover";
          item.style.backgroundPosition = "center";

          // Remover placeholder icon
          const ph = item.querySelector(".gallery__ph");
          if (ph) ph.style.display = "none";
        }
      });

      console.log("✅ Imagens da galeria carregadas:", urls.length);
    } catch (error) {
      console.error("Erro ao carregar imagens da galeria:", error);
    }
  }

  /* ─────────────────────────────────────────
     3. CARREGAR IMAGENS DA EQUIPA
     ───────────────────────────────────────── */

  async function loadTeamImages() {
    const folderPath = CONFIG.STORAGE_PATHS.TEAM;

    try {
      const result = await storage.ref(folderPath).listAll();
      const imageMap = {};

      for (const item of result.items) {
        const url = await item.getDownloadURL();
        // Extrair member name do ficheiro (ex: "perpetuo", "matias", "funeno")
        const memberName = item.name.split("_")[1]?.split(".")[0] || item.name;
        if (!imageMap[memberName]) {
          imageMap[memberName] = url;
        }
      }

      // Atualizar team cards
      document.querySelectorAll(".team-card").forEach((card) => {
        const member = card.getAttribute("data-member");
        if (imageMap[member]) {
          card.style.backgroundImage = `url('${imageMap[member]}')`;
          card.style.backgroundSize = "cover";
          card.style.backgroundPosition = "center";
        }
      });

      console.log("✅ Imagens da equipa carregadas", imageMap);
    } catch (error) {
      console.error("Erro ao carregar imagens da equipa:", error);
    }
  }

  /* ─────────────────────────────────────────
     4. CARREGAR IMAGENS DO ABOUT
     ───────────────────────────────────────── */

  async function loadAboutImage() {
    // Se existir uma imagem específica para about, adicione-a aqui
    // Por enquanto, usa apenas a imagem de fundo definida no CSS
    console.log("ℹ️ About image usa CSS background (customizar conforme necessário)");
  }

  /* ─────────────────────────────────────────
     5. INICIALIZAR TUDO
     ───────────────────────────────────────── */

  async function initializeImages() {
    console.log("🔄 Iniciando carregamento de imagens do Firebase...");

    try {
      await Promise.all([
        loadPackageImages(),
        loadGalleryImages(),
        loadTeamImages(),
        loadAboutImage(),
      ]);

      console.log("✅ Todas as imagens carregadas com sucesso!");
    } catch (error) {
      console.error("❌ Erro ao inicializar imagens:", error);
    }
  }

  // Executar quando o DOM estiver pronto
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeImages);
  } else {
    initializeImages();
  }

  // Exportar funções para reload manual se necessário
  window.ImageLoader = {
    reloadPackages: loadPackageImages,
    reloadGallery: loadGalleryImages,
    reloadTeam: loadTeamImages,
    reloadAll: initializeImages,
  };
})();
