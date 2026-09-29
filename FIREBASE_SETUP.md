# O Mochilão - Setup Firebase

## 🚀 Inicialização do Firestore

### Pré-requisitos

- Node.js instalado (versão 16+)
- Acesso a https://console.firebase.google.com/project/omochilao

### Passo 1: Obtenha a Chave de Serviço

1. Aceda a https://console.firebase.google.com/project/omochilao/settings/serviceaccounts/adminsdk
2. Na aba **"SDK do Admin"**, clique em **"Gerar nova chave privada"**
3. Guarde o arquivo JSON descarregado **como `serviceAccountKey.json`** na raiz do projeto

**⚠️ Importante:** Nunca commit o arquivo `serviceAccountKey.json` para o repositório!

### Passo 2: Instale as Dependências

Na pasta do projeto, execute:

```bash
npm install
```

### Passo 3: Execute o Script de Inicialização

```bash
npm run init-firestore
```

Este script irá:

- ✅ Criar um utilizador admin no Firebase Authentication
- ✅ Criar 5 coleções no Firestore com documentos de exemplo
- ✅ Exibir as credenciais do primeiro admin

### Credenciais Padrão (Após Execução)

Após executar o script, guarde as credenciais exibidas:

```
Email: admin@omochilao.ao
Senha: Omochilao2024!
```

**⚠️ IMPORTANTE:** Mude a senha após o primeiro login!

## 📊 Estrutura das Coleções Criadas

### 1. `admins`

Armazena os utilizadores administrativos.

```
Documento: {uid do utilizador}
├── email: string
├── nome: string
├── role: string ("Super Admin", "Gestor de Conteúdo", "Atendente", "Visualizador")
├── criadoEm: timestamp
├── ativo: boolean
├── telefone: string
└── permissoes: array
```

### 2. `programs`

Armazena os programas/experiências de viagem.

```
Documento: {ID automático}
├── nome: string
├── slogan: string
├── preco: string
├── duracao: string
├── categoria: string
├── descricao: string
├── imagem: string (URL)
├── ativo: boolean
├── criadoEm: timestamp
└── criadoPor: string (UID do admin)
```

### 3. `messages`

Armazena as mensagens de contacto dos clientes.

```
Documento: {ID automático}
├── nome: string
├── email: string
├── assunto: string
├── mensagem: string
├── data: timestamp
├── status: string ("Pendente", "Respondido", "Arquivado")
├── lido: boolean
└── respondidoEm: timestamp (opcional)
```

### 4. `reservations`

Armazena as reservas de clientes.

```
Documento: {ID automático}
├── nome: string
├── email: string
├── destino: string
├── data: timestamp
├── pessoas: number
├── status: string ("Pendente", "Em análise", "Confirmada", "Cancelada")
├── telefone: string
├── notas: string
└── criadoEm: timestamp
```

### 5. `siteConfig`

Armazena configurações do site (hero, etc).

```
Documento: "hero"
├── heroTitle: string
├── heroSubtitle: string
├── featureLabel: string
├── heroImageUrl: string (opcional)
├── heroImagePath: string (opcional)
├── ultimaAtualizacao: timestamp
└── atualizadoPor: string (UID do admin)
```

## 🔐 Regras de Segurança Recomendadas

Vá a https://console.firebase.google.com/project/omochilao/firestore/rules e copie o conteúdo do arquivo [firestore.rules](firestore.rules).

O arquivo oficial aplica as permissões por role e limita as atualizações de `messages` e `reservations` ao campo `status`.

Para permitir a alteração da foto de fundo do Hero, aceda a https://console.firebase.google.com/project/omochilao/storage e publique também as regras do arquivo [storage.rules](storage.rules). Os uploads ficam em `site-content/` e só podem ser alterados por Super Admin ou Gestor de Conteúdo.

## 📱 Próximos Passos

1. **Configure as regras do Firestore e do Storage** (ver acima)
2. **Teste o login** com as credenciais do primeiro admin
3. **Implemente os CRUDs** no painel administrativo
4. **Configure o EmailJS** para notificações

## 🆘 Troubleshooting

### Erro: "serviceAccountKey.json not found"

- Verifique se o arquivo está na raiz do projeto
- Certifique-se de que o nome está correto

### Erro: "Email already exists"

- O email já foi usado. O script vai atualizar o documento do admin no Firestore
- Se quiser criar um novo admin, mude o email no script

### Problema: Coleções não aparecem no Firebase Console

- Aguarde alguns segundos para o Firestore sincronizar
- Recarregue a página do console

## 📞 Contato

Para dúvidas, contacte o desenvolvimento.
