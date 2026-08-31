<!-- Firebase Setup Instructions -->
# 🔥 Firebase Integration - O Mochilão Aventuras

## 📋 Índice
1. [Setup Inicial do Firebase](#setup-inicial)
2. [Configurar Credenciais](#configurar-credenciais)
3. [Usar o Painel Admin](#painel-admin)
4. [Integrar no Website](#integrar-website)
5. [Troubleshooting](#troubleshooting)

---

## Setup Inicial

### Passo 1: Criar Projeto Firebase

1. Aceda a [Firebase Console](https://console.firebase.google.com/)
2. Clique em **"Criar Projeto"** ou **"Add Project"**
3. Nome do projeto: `mochilao-aventuras`
4. Aceite os termos e crie o projeto
5. Aguarde alguns minutos até estar pronto

### Passo 2: Adicionar Web App

1. No painel do projeto, clique no ícone **</> (Web)**
2. Registe o app com nome: `Mochilão Website`
3. Copie as credenciais (verá um objeto `firebaseConfig`)
4. **NÃO faça commit destas credenciais no Git** (sensíveis!)

### Passo 3: Ativar Autenticação

1. No menu esquerdo, vá a **Authentication** → **Get Started**
2. Clique em **Email/Password**
3. Ative o método de autenticação
4. Vá a **Users** → **Add User**
5. Crie um utilizador admin:
   - Email: `admin@omochilao.ao`
   - Password: (use uma password forte)
6. **Guarde estas credenciais com segurança**

### Passo 4: Ativar Cloud Storage

1. No menu esquerdo, vá a **Storage** → **Get Started**
2. Aceite as regras padrão (ou customize se necessário)
3. Clique em **Done**

### Passo 5: Criar Estrutura de Pastas

No Firebase Storage, crie manualmente estas pastas:
```
images/
├── packages/     (imagens dos pacotes: cabo-ledo, quicama, huambo)
├── gallery/      (imagens da galeria)
└── team/         (imagens da equipa: perpetuo, matias, funeno)
```

---

## Configurar Credenciais

### Atualizar `firebase-config.js`

1. Abra o ficheiro `firebase-config.js` no seu projeto
2. Substitua os valores `YOUR_*` pelas suas credenciais do Firebase:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyD...", // Copie do Firebase Console
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123...",
};
```

### Onde Encontrar as Credenciais?

1. Firebase Console → Seu Projeto
2. Engrenagem (⚙️) → **Project Settings**
3. Abra o separador **"Your Apps"**
4. Procure a web app e clique em **"Config"**
5. Copie toda a secção `firebaseConfig`

### ⚠️ Segurança

**IMPORTANTE**: 
- Nunca commit `firebase-config.js` com credenciais reais no Git público
- Solução: use variáveis de ambiente ou `.env`
- Alternativa simples: adicione a `.gitignore`:
  ```
  firebase-config.js
  ```

---

## Painel Admin

### Aceder ao Admin

1. Aceda a `https://seu-site.com/login.html`
2. Login com:
   - Email: `admin@omochilao.ao`
   - Password: (a que criou no Firebase)
3. Será redirecionado para `admin.html`

### Upload de Imagens

#### Pacotes (Cabo Ledo, Quiçama, Huambo)

1. No painel, clique em **📦 Pacotes**
2. Preencha o formulário:
   - **Nome**: Ex. `Cabo Ledo - Dunas`
   - **Categoria**: `packages`
   - **Ficheiro**: seleccione imagem
3. Clique em **📤 Carregar Imagem**
4. A imagem aparece em tempo real na galeria

#### Nomeação de Ficheiros (Importante!)

Para que o sistema reconheça automaticamente a imagem, use este padrão:

```
[destination]_[nome-descritivo].jpg
```

Exemplos:
- `cabo-ledo_praia.jpg` → vai aparecer no card "Cabo Ledo"
- `quicama_elefante.jpg` → vai aparecer no card "Quiçama"
- `huambo_acampamento.jpg` → vai aparecer no card "Kifuka Camping"

Para equipa:
- `perpetuo_founder.jpg`
- `matias_coordinator.jpg`
- `funeno_guide.jpg`

#### Galeria

1. Clique em **🖼️ Galeria**
2. Carregue imagens livremente
3. Aparecem automaticamente na galeria do site

#### Equipa

1. Clique em **👥 Equipa**
2. Use os nomes: `perpetuo`, `matias`, `funeno`
3. As imagens substituem as backgrounds dos cards

---

## Integrar no Website

### Adicionar Firebase ao HTML

No seu `index.html`, adicione **antes do `</body>`**:

```html
<!-- Firebase -->
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js"></script>

<!-- Config & Image Loader -->
<script src="firebase-config.js"></script>
<script src="image-loader.js"></script>
<script src="script.js"></script>
```

### Remover Imagens Placeholder

Substitua as linhas com `<div class="package-card__ph">` por `<img>` simples:

**Antes:**
```html
<div class="package-card__ph">
  <i class="fa-solid fa-mountain-sun"></i>
</div>
```

**Depois:**
```html
<div class="package-card__media">
  <img src="" alt="Cabo Ledo" class="package-card__img" />
</div>
```

O `image-loader.js` preencherá automaticamente os `src` com URLs do Firebase.

### Verificar Console

Após carregar o site, abra a consola do browser (F12) e procure:
- ✅ `✅ Imagens dos pacotes carregadas`
- ✅ `✅ Imagens da galeria carregadas`
- ✅ `✅ Imagens da equipa carregadas`

---

## Troubleshooting

### Erro: "Firebase não está inicializado"

**Causa**: `firebase-config.js` não foi carregado ou tem valores inválidos

**Solução**:
1. Verifique que o ficheiro existe no mesmo diretório
2. Verifique as credenciais no `firebaseConfig`
3. Abra a consola (F12) e procure erros

### Imagens não aparecem no site

**Causa**: URLs do Firebase não foram obtidas corretamente

**Solução**:
1. Verifique se as imagens estão realmente no Firebase Storage
2. Confirme que as regras de segurança permitem leitura pública
3. Na consola, execute: `ImageLoader.reloadAll()` para forçar reload

### Erro 403 (Permission Denied)

**Causa**: Regras de segurança do Firebase Storage muito restritivas

**Solução**: No Firebase Console → Storage → Rules, substitua por:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /images/{allPaths=**} {
      allow read: if true; // Leitura pública
      allow write: if request.auth != null; // Apenas utilizadores autenticados
    }
  }
}
```

### Imagens muito lentas

**Solução**: Otimize imagens antes de carregar
- Compressão: use [TinyPNG](https://tinypng.com/) ou [ImageOptim](https://imageoptim.com/)
- Formato: use WebP para melhor compressão
- Tamanho: 1920x1280 é suficiente para site

### Problema: Imagens não aparecem após logout/login

**Solução**: Limpe cache do browser (Ctrl+Shift+Del) e recarregue

---

## Scripts Úteis

### Recarregar Imagens Manualmente (Console)

```javascript
// Recarregar apenas pacotes
ImageLoader.reloadPackages();

// Recarregar apenas galeria
ImageLoader.reloadGallery();

// Recarregar tudo
ImageLoader.reloadAll();
```

### Deletar Imagem (via Admin)

1. Aceda ao admin (`admin.html`)
2. Seleccione a categoria
3. Clique no botão 🗑️ **Deletar** na imagem
4. Confirme

### Listar todas as imagens (Console)

```javascript
// Ver URLs de todas as imagens do Firebase
const { storage, CONFIG } = window.FirebaseApp;

async function listAll() {
  const result = await storage.ref(CONFIG.STORAGE_PATHS.PACKAGES).listAll();
  result.items.forEach(item => {
    item.getDownloadURL().then(url => console.log(item.name, url));
  });
}

listAll();
```

---

## Segurança & Best Practices

### ✅ Checklist

- [ ] Credenciais Firebase armazenadas em `.env` (não no Git)
- [ ] Regras de Storage configuradas corretamente
- [ ] Apenas admins podem fazer login e upload
- [ ] Imagens comprimidas antes de carregar
- [ ] HTTPS ativado no site (essencial para Firebase)
- [ ] Backup das imagens localmente

### Proteger Credenciais

Se acidentalmente commitar credenciais:

```bash
# 1. Remover do histórico
git filter-branch --tree-filter 'rm -f firebase-config.js' HEAD

# 2. Regenerar credenciais no Firebase Console

# 3. Force push
git push origin --force
```

---

## Contacto & Suporte

- Email: `geral@omochilao.ao`
- WhatsApp: `+244 926 509 821`
- Docs Firebase: https://firebase.google.com/docs

---

**Última atualização**: 2026-08-31
**Versão**: 1.0
