/* =====================================================
   Firebase Configuration & Initialization
   Configuração centralizada do Firebase para Mochilão
   ===================================================== */

// IMPORTANTE: Substitua estes valores pelas suas credenciais do Firebase Console
// https://console.firebase.google.com/
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def456",
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Referências globais
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Constantes de configuração
const CONFIG = {
  // Caminhos no Storage
  STORAGE_PATHS: {
    PACKAGES: "images/packages/",
    GALLERY: "images/gallery/",
    TEAM: "images/team/",
  },
  
  // Limites de upload
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: ["image/jpeg", "image/png", "image/webp"],
  
  // Colecções Firestore
  COLLECTIONS: {
    PACKAGES: "packages",
    GALLERY: "gallery",
    TEAM: "team",
  },
};

// Função auxiliar para validar imagem
function validateImage(file) {
  if (!file) return { valid: false, error: "Nenhum ficheiro selecionado." };
  
  if (file.size > CONFIG.MAX_FILE_SIZE) {
    return { valid: false, error: "Ficheiro muito grande (máx: 5MB)." };
  }
  
  if (!CONFIG.ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: "Formato não suportado. Use JPEG, PNG ou WebP." };
  }
  
  return { valid: true };
}

// Função para gerar URL pública de imagem (com cache buster)
async function getImageUrl(storagePath) {
  try {
    const url = await storage.ref(storagePath).getDownloadURL();
    // Adiciona timestamp para evitar cache
    return `${url}&t=${Date.now()}`;
  } catch (error) {
    console.error("Erro ao obter URL da imagem:", error);
    return null;
  }
}

// Função para fazer upload de imagem
async function uploadImage(file, destinationPath) {
  const validation = validateImage(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  const timestamp = Date.now();
  const fileName = `${timestamp}_${file.name}`;
  const fullPath = destinationPath + fileName;
  
  const ref = storage.ref(fullPath);
  const task = ref.put(file);
  
  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => {
        // Progresso do upload
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log(`Upload progress: ${progress}%`);
      },
      (error) => {
        console.error("Erro no upload:", error);
        reject(error);
      },
      async () => {
        // Upload concluído
        const url = await ref.getDownloadURL();
        resolve({ path: fullPath, url });
      }
    );
  });
}

// Função para deletar imagem
async function deleteImage(storagePath) {
  try {
    await storage.ref(storagePath).delete();
    console.log("Imagem deletada com sucesso");
  } catch (error) {
    console.error("Erro ao deletar imagem:", error);
    throw error;
  }
}

// Função para listar todas as imagens de uma pasta
async function listImages(folderPath) {
  try {
    const result = await storage.ref(folderPath).listAll();
    const urls = await Promise.all(
      result.items.map(async (item) => {
        const url = await item.getDownloadURL();
        return { name: item.name, path: item.fullPath, url };
      })
    );
    return urls;
  } catch (error) {
    console.error("Erro ao listar imagens:", error);
    return [];
  }
}

// Exportar para uso global
window.FirebaseApp = {
  auth,
  db,
  storage,
  CONFIG,
  uploadImage,
  deleteImage,
  getImageUrl,
  listImages,
  validateImage,
};
