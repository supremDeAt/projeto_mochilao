/* =====================================================
   Admin Panel - Image Management
   Painel de administração para upload e gestão de imagens
   ===================================================== */

(function () {
  "use strict";

  const { auth, db, storage, CONFIG, uploadImage, deleteImage, listImages } =
    window.FirebaseApp;

  let currentSection = "packages";
  let currentUser = null;

  /* ─────────────────────────────────────────
     1. AUTENTICAÇÃO
     ───────────────────────────────────────── */

  // Verificar se utilizador está logado
  auth.onAuthStateChanged((user) => {
    if (!user) {
      // Redirecionar para login se não logado
      window.location.href = "login.html";
      return;
    }
    currentUser = user;
    document.getElementById("user-email").textContent = user.email;
  });

  // Logout
  document.querySelector(".admin-logout").addEventListener("click", () => {
    auth.signOut().then(() => {
      window.location.href = "login.html";
    });
  });

  /* ─────────────────────────────────────────
     2. NAVEGAÇÃO DE SEÇÕES
     ───────────────────────────────────────── */

  const sectionButtons = document.querySelectorAll("[data-section]");
  const sectionTitles = {
    packages: "Gerenciar Pacotes",
    gallery: "Gerenciar Galeria",
    team: "Gerenciar Equipa",
  };

  const folderMapping = {
    packages: CONFIG.STORAGE_PATHS.PACKAGES,
    gallery: CONFIG.STORAGE_PATHS.GALLERY,
    team: CONFIG.STORAGE_PATHS.TEAM,
  };

  sectionButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentSection = btn.dataset.section;

      // Atualizar UI
      sectionButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      document.getElementById("section-title").textContent =
        sectionTitles[currentSection];
      document.getElementById("image-category").value = currentSection;
      document.getElementById("gallery-title").textContent = `Imagens de ${
        currentSection.charAt(0).toUpperCase() + currentSection.slice(1)
      }`;

      // Carregar imagens da seção
      loadImages(currentSection);
    });
  });

  /* ─────────────────────────────────────────
     3. TOAST / NOTIFICAÇÕES
     ───────────────────────────────────────── */

  function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = "slideIn 0.3s ease-out reverse";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /* ─────────────────────────────────────────
     4. UPLOAD DE IMAGENS
     ───────────────────────────────────────── */

  const uploadForm = document.getElementById("upload-form");
  const uploadBtn = document.getElementById("upload-btn");
  const imageFile = document.getElementById("image-file");

  // Drag and drop
  const fileLabel = document.querySelector(".file-input-label");

  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    fileLabel.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ["dragenter", "dragover"].forEach((eventName) => {
    fileLabel.addEventListener(eventName, () => {
      fileLabel.style.background = "rgba(201, 150, 42, 0.2)";
      fileLabel.style.borderColor = "var(--clr-gold-light)";
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    fileLabel.addEventListener(eventName, () => {
      fileLabel.style.background = "rgba(201, 150, 42, 0.1)";
      fileLabel.style.borderColor = "var(--clr-gold)";
    });
  });

  fileLabel.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    imageFile.files = files;
  });

  // Submit form
  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!currentUser) {
      showToast("Deve estar logado para carregar imagens.", "error");
      return;
    }

    const file = imageFile.files[0];
    const imageName = document.getElementById("image-name").value.trim();
    const category = document.getElementById("image-category").value;

    if (!file || !imageName || !category) {
      showToast("Preencha todos os campos.", "error");
      return;
    }

    // Desabilitar botão e mostrar loading
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span class="loading"></span> Carregando...';

    try {
      const destinationPath = folderMapping[category];
      const result = await uploadImage(file, destinationPath);

      // Salvar metadata no Firestore
      await db.collection(CONFIG.COLLECTIONS[category.toUpperCase()]).add({
        name: imageName,
        path: result.path,
        url: result.url,
        category: category,
        uploadedAt: new Date(),
        uploadedBy: currentUser.email,
      });

      showToast("Imagem carregada com sucesso!", "success");
      uploadForm.reset();

      // Recarregar galeria
      loadImages(currentSection);
    } catch (error) {
      console.error("Erro no upload:", error);
      showToast(`Erro: ${error.message}`, "error");
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = "📤 Carregar Imagem";
    }
  });

  /* ─────────────────────────────────────────
     5. CARREGAR E EXIBIR IMAGENS
     ───────────────────────────────────────── */

  async function loadImages(category) {
    const grid = document.getElementById("images-grid");
    grid.innerHTML =
      '<p style="grid-column: 1 / -1; color: rgba(255, 255, 255, 0.5);"><span class="loading"></span> Carregando...</p>';

    try {
      const folderPath = folderMapping[category];
      const images = await listImages(folderPath);

      if (images.length === 0) {
        grid.innerHTML =
          '<p style="grid-column: 1 / -1; color: rgba(255, 255, 255, 0.5);">Nenhuma imagem carregada ainda.</p>';
        return;
      }

      grid.innerHTML = images
        .map(
          (img) => `
        <div class="image-card">
          <img src="${img.url}" alt="${img.name}" class="image-card-img" loading="lazy" />
          <div class="image-card-info">
            <div class="image-card-name" title="${img.name}">${img.name}</div>
            <div class="image-card-actions">
              <button class="btn-copy" onclick="copyToClipboard('${img.url}')">
                📋 Copiar URL
              </button>
              <button class="btn-delete" onclick="deleteImageHandler('${img.path}')">
                🗑️ Deletar
              </button>
            </div>
          </div>
        </div>
      `
        )
        .join("");
    } catch (error) {
      console.error("Erro ao carregar imagens:", error);
      grid.innerHTML =
        '<p style="grid-column: 1 / -1; color: var(--clr-danger);">Erro ao carregar imagens.</p>';
    }
  }

  /* ─────────────────────────────────────────
     6. COPIAR E DELETAR
     ───────────────────────────────────────── */

  window.copyToClipboard = function (text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast("URL copiada!", "success");
    });
  };

  window.deleteImageHandler = async function (imagePath) {
    if (!confirm("Tem a certeza que deseja deletar esta imagem?")) {
      return;
    }

    try {
      await deleteImage(imagePath);
      showToast("Imagem deletada com sucesso!", "success");
      loadImages(currentSection);
    } catch (error) {
      console.error("Erro ao deletar:", error);
      showToast(`Erro: ${error.message}`, "error");
    }
  };

  /* ─────────────────────────────────────────
     7. INICIALIZAR
     ───────────────────────────────────────── */

  // Carregar imagens iniciais
  loadImages("packages");
})();
