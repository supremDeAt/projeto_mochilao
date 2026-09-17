#!/usr/bin/env node

/**
 * Script para inicializar coleções no Firestore
 *
 * SETUP:
 * 1. Na pasta do projeto, execute: npm init -y && npm install firebase-admin
 * 2. Vá a https://console.firebase.google.com/project/omochilao/settings/serviceaccounts/adminsdk
 * 3. Na aba "SDK do Admin", clique "Gerar nova chave privada" e descarregue o JSON
 * 4. Coloque o arquivo na pasta do projeto com nome: serviceAccountKey.json
 * 5. Execute: node SCRIPT/init-firestore.js
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// Carregar chave de serviço
const serviceAccountPath = path.join(__dirname, "../serviceAccountKey.json");

if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ Arquivo serviceAccountKey.json não encontrado!");
  console.error(
    "   Siga os passos em SCRIPT/init-firestore.js para obter o arquivo.",
  );
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

/**
 * Criar primeiro admin com email e senha
 */
async function createFirstAdmin() {
  const email = "admin@omochilao.ao";
  const password = "Omochilao2024!"; // MUDAR EM PRODUÇÃO!

  try {
    console.log(`\n📝 Criando admin: ${email}`);

    // Criar utilizador no Firebase Auth
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: "Perpétuo de Assis",
    });

    console.log(`✓ Utilizador criado no Auth com UID: ${userRecord.uid}`);

    // Criar documento no Firestore
    await db
      .collection("admins")
      .doc(userRecord.uid)
      .set({
        email: email,
        nome: "Perpétuo de Assis",
        role: "Super Admin",
        criadoEm: admin.firestore.Timestamp.now(),
        ativo: true,
        telefone: "+244 926 509 821",
        permissoes: [
          "gerenciar_admins",
          "gerenciar_programas",
          "gerenciar_mensagens",
          "gerenciar_reservas",
        ],
      });

    console.log(`✓ Documento admin criado no Firestore`);
    console.log(`\n🔐 Credenciais do primeiro admin:`);
    console.log(`   Email: ${email}`);
    console.log(`   Senha: ${password}`);
    console.log(`   ⚠️  GUARDE ESTAS CREDENCIAIS EM SEGURANÇA!`);

    return userRecord.uid;
  } catch (error) {
    if (error.code === "auth/email-already-exists") {
      console.log(
        `⚠️  Email já existe. Obtendo UID do utilizador existente...`,
      );
      const userRecord = await auth.getUserByEmail(email);

      // Atualizar documento no Firestore
      await db
        .collection("admins")
        .doc(userRecord.uid)
        .set(
          {
            email: email,
            nome: "Perpétuo de Assis",
            role: "Super Admin",
            criadoEm: admin.firestore.Timestamp.now(),
            ativo: true,
            telefone: "+244 926 509 821",
            permissoes: [
              "gerenciar_admins",
              "gerenciar_programas",
              "gerenciar_mensagens",
              "gerenciar_reservas",
            ],
          },
          { merge: true },
        );

      console.log(`✓ Documento admin atualizado no Firestore`);
      return userRecord.uid;
    }
    throw error;
  }
}

async function initializeCollections() {
  try {
    console.log("\n🚀 Inicializando Firestore...\n");

    // 1. Criar primeiro admin
    const adminUid = await createFirstAdmin();

    // 2. Criar coleção "programs"
    await db.collection("programs").add({
      nome: "Cabo Ledo",
      slogan: "Dunas, mar e adrenalina a poucas horas de Luanda.",
      preco: "45.000 Kz",
      duracao: "2 Dias",
      categoria: "Praia & Natureza",
      descricao:
        "Uma experiência única nas dunas de Cabo Ledo. Desfrute de vistas espectaculares e atividades de aventura.",
      imagem: "https://via.placeholder.com/400x300?text=Cabo+Ledo",
      ativo: true,
      criadoEm: admin.firestore.Timestamp.now(),
      criadoPor: adminUid,
    });

    await db.collection("programs").add({
      nome: "Quiçama Safari",
      slogan: "Uma experiência autêntica em plena natureza angolana.",
      preco: "38.000 Kz",
      duracao: "1 Dia",
      categoria: "Safari",
      descricao:
        "Safari no Parque Nacional de Quiçama com avistamento de vida selvagem.",
      imagem: "https://via.placeholder.com/400x300?text=Quiçama",
      ativo: true,
      criadoEm: admin.firestore.Timestamp.now(),
      criadoPor: adminUid,
    });

    await db.collection("programs").add({
      nome: "Kifuka Camping",
      slogan: "Acampamento, trilhos e noites de céu aberto.",
      preco: "62.000 Kz",
      duracao: "3 Dias",
      categoria: "Camping",
      descricao:
        "Experiência de camping completa com trilhos e fogueira sob as estrelas.",
      imagem: "https://via.placeholder.com/400x300?text=Kifuka",
      ativo: true,
      criadoEm: admin.firestore.Timestamp.now(),
      criadoPor: adminUid,
    });

    console.log('✓ Coleção "programs" criada com 3 documentos');

    // 3. Criar coleção "messages"
    await db.collection("messages").add({
      nome: "Ana Maria",
      email: "ana@email.com",
      assunto: "Dúvida sobre Cabo Ledo",
      mensagem:
        "Gostaria de saber mais sobre a viagem para Cabo Ledo e disponibilidade.",
      data: admin.firestore.Timestamp.now(),
      status: "Pendente",
      lido: false,
      respondidoEm: null,
    });

    await db.collection("messages").add({
      nome: "Rui Costa",
      email: "rui@email.com",
      assunto: "Solicitação de orçamento",
      mensagem: "Preciso de um pacote personalizado para 4 pessoas.",
      data: admin.firestore.Timestamp.now(),
      status: "Respondido",
      lido: true,
      respondidoEm: admin.firestore.Timestamp.now(),
    });

    console.log('✓ Coleção "messages" criada com 2 documentos');

    // 4. Criar coleção "reservations"
    await db.collection("reservations").add({
      nome: "Fernanda",
      email: "fernanda@email.com",
      destino: "Quiçama Safari",
      data: admin.firestore.Timestamp.fromDate(new Date("2026-09-05")),
      pessoas: 2,
      status: "Em análise",
      telefone: "+244 926 123 456",
      notas: "Preferência por manhã",
      criadoEm: admin.firestore.Timestamp.now(),
    });

    await db.collection("reservations").add({
      nome: "José",
      email: "jose@email.com",
      destino: "Kifuka Camping",
      data: admin.firestore.Timestamp.fromDate(new Date("2026-09-15")),
      pessoas: 3,
      status: "Confirmada",
      telefone: "+244 912 654 321",
      notas: "Experiência anterior com camping",
      criadoEm: admin.firestore.Timestamp.now(),
    });

    console.log('✓ Coleção "reservations" criada com 2 documentos');

    // 5. Criar coleção "siteConfig"
    await db.collection("siteConfig").doc("hero").set({
      heroTitle:
        "Descubra Angola através de experiências que ficam para a vida",
      heroSubtitle:
        "Cada viagem começa com uma escolha. Faça a sua e eternize momentos únicos por Angola.",
      featureLabel: "BEM-VINDO AO MOCHILÃO",
      ultimaAtualizacao: admin.firestore.Timestamp.now(),
      atualizadoPor: adminUid,
    });

    console.log('✓ Coleção "siteConfig" criada com documento "hero"');

    console.log("\n✅ Todas as coleções foram inicializadas com sucesso!");
    console.log("\n📊 Resumo:");
    console.log("   - admins: 1 documento");
    console.log("   - programs: 3 documentos");
    console.log("   - messages: 2 documentos");
    console.log("   - reservations: 2 documentos");
    console.log("   - siteConfig: 1 documento");
    console.log("\n🔗 Próximos passos:");
    console.log("   1. Configure as regras de segurança do Firestore");
    console.log("   2. Teste o login com as credenciais do admin");
    console.log("   3. Implemente a lógica de CRUD no painel administrativo");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Erro ao inicializar coleções:", error.message);
    process.exit(1);
  }
}

initializeCollections();
