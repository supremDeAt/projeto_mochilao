// Testes do servidor de pagamentos: node --test test/
// Firestore e Google OAuth são simulados em memória (nada sai para a internet).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import worker from "../src/index.js";
import { toFields, fromFields, _resetTokenCache } from "../src/firestore.js";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const SA = JSON.stringify({ client_email: "teste@omochilao.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) });

let db;
let calls;
const env = (extra = {}) => ({
  FIREBASE_PROJECT_ID: "omochilao",
  FIREBASE_SERVICE_ACCOUNT: SA,
  ALLOWED_ORIGINS: "https://omochilao.ao",
  PERCENTAGEM_ONLINE: "100",
  MODO_PAGAMENTO: "simulado",
  ...extra,
});

beforeEach(() => {
  _resetTokenCache();
  calls = [];
  db = {
    "programs/p1": { nome: "Malanje", pacotes: [{ tipo: "individual", nome: "Particular", pessoas: 1, valor: 380000 }, { tipo: "casal", nome: "Casal", pessoas: 2, valor: 600000 }] },
    "reservations/RES0000000001": {
      clienteInfo: { nome: "Ana", email: "a@b.ao", telefone: "923456789" },
      // total adulterado pelo browser: 1 Kz
      itens: [{ programId: "p1", nome: "Malanje", pacote: "Casal", pacoteId: "casal", qtd: 2 }],
      total: 1,
      status: "Aguardando Pagamento",
      historico: [{ de: "–", para: "Aguardando Pagamento", em: new Date("2026-11-01T10:00:00Z") }],
    },
  };
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    calls.push(url);
    if (url === "https://oauth2.googleapis.com/token") {
      const assertion = new URLSearchParams(init.body).get("assertion");
      assert.equal(assertion.split(".").length, 3, "JWT assinado");
      return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
    }
    const m = url.match(/documents\/([^?]+)/);
    assert.ok(m, "pedido ao Firestore: " + url);
    assert.equal(init.headers.authorization, "Bearer tok");
    const path = decodeURIComponent(m[1]);
    if (!init.method || init.method === "GET") {
      if (!db[path]) return new Response("{}", { status: 404 });
      return new Response(JSON.stringify({ fields: toFields(db[path]) }), { status: 200 });
    }
    if (init.method === "PATCH") {
      const fields = fromFields(JSON.parse(init.body).fields);
      const mask = [...new URL(url).searchParams.getAll("updateMask.fieldPaths")];
      db[path] = mask.length ? { ...(db[path] || {}), ...fields } : fields;
      return new Response(JSON.stringify({}), { status: 200 });
    }
    throw new Error("pedido inesperado " + init.method + " " + url);
  };
});

const req = (method, path, body, origin = "https://omochilao.ao") =>
  new Request("https://api.omochilao.ao" + path, {
    method,
    headers: { "content-type": "application/json", origin },
    body: body ? JSON.stringify(body) : undefined,
  });

test("saúde + CORS só para o site", async () => {
  const ok = await worker.fetch(req("GET", "/saude"), env());
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("access-control-allow-origin"), "https://omochilao.ao");
  const outro = await worker.fetch(req("GET", "/saude", null, "https://site-malicioso.com"), env());
  assert.equal(outro.headers.get("access-control-allow-origin"), null);
});

test("o valor é calculado no servidor (ignora o total do browser)", async () => {
  const r = await worker.fetch(req("POST", "/pagamentos", { reservaId: "RES0000000001", metodo: "multicaixa", telefone: "+244 923 456 789" }), env());
  const j = await r.json();
  assert.equal(r.status, 201, JSON.stringify(j));
  assert.equal(j.total, 1200000); // 2 × Casal 600.000
  assert.equal(j.valor, 1200000);
  assert.equal(db["reservations/RES0000000001"].pagamento.estado, "pendente");
  assert.equal(db["reservations/RES0000000001"].status, "Aguardando Pagamento");
});

test("só o sinal (30%) quando configurado", async () => {
  const r = await worker.fetch(req("POST", "/pagamentos", { reservaId: "RES0000000001", metodo: "ekwanza", telefone: "923456789" }), env({ PERCENTAGEM_ONLINE: "30" }));
  const j = await r.json();
  assert.equal(j.valor, 360000);
});

test("pagamento confirmado pelo gateway → reserva Confirmada com histórico", async () => {
  const r = await worker.fetch(req("POST", "/pagamentos", { reservaId: "RES0000000001", metodo: "multicaixa", telefone: "923456789" }), env());
  const { pagamentoId } = await r.json();
  // ainda pendente
  let s = await (await worker.fetch(req("GET", "/pagamentos/" + pagamentoId), env())).json();
  assert.equal(s.estado, "pendente");
  // passam 10 s na simulação
  db["pagamentos/" + pagamentoId].criadoEm = new Date(Date.now() - 10000);
  s = await (await worker.fetch(req("GET", "/pagamentos/" + pagamentoId), env())).json();
  assert.equal(s.estado, "pago");
  const res = db["reservations/RES0000000001"];
  assert.equal(res.status, "Confirmada");
  assert.equal(res.pagamento.estado, "pago");
  assert.equal(res.historico.length, 2);
  assert.ok(res.historico[0].em instanceof Date, "histórico antigo mantém as datas");
  // não volta a pagar
  const again = await worker.fetch(req("POST", "/pagamentos", { reservaId: "RES0000000001", metodo: "multicaixa", telefone: "923456789" }), env());
  assert.equal(again.status, 409);
});

test("pagamento parcial → Em análise", async () => {
  const r = await worker.fetch(req("POST", "/pagamentos", { reservaId: "RES0000000001", metodo: "multicaixa", telefone: "923456789" }), env({ PERCENTAGEM_ONLINE: "30" }));
  const { pagamentoId } = await r.json();
  db["pagamentos/" + pagamentoId].criadoEm = new Date(Date.now() - 10000);
  await worker.fetch(req("GET", "/pagamentos/" + pagamentoId), env());
  assert.equal(db["reservations/RES0000000001"].status, "Em análise");
});

test("pagamento recusado não confirma a reserva", async () => {
  const r = await worker.fetch(req("POST", "/pagamentos", { reservaId: "RES0000000001", metodo: "multicaixa", telefone: "923456780" }), env());
  const { pagamentoId } = await r.json();
  const s = await (await worker.fetch(req("GET", "/pagamentos/" + pagamentoId), env())).json();
  assert.equal(s.estado, "falhou");
  assert.equal(db["reservations/RES0000000001"].status, "Aguardando Pagamento");
});

test("validações: telefone, método, reserva, preço desaparecido, modo desligado", async () => {
  const bad = async (body, e = env()) => (await worker.fetch(req("POST", "/pagamentos", body), e)).status;
  assert.equal(await bad({ reservaId: "RES0000000001", metodo: "multicaixa", telefone: "12345" }), 400);
  assert.equal(await bad({ reservaId: "RES0000000001", metodo: "cartao", telefone: "923456789" }), 400);
  assert.equal(await bad({ reservaId: "NAOEXISTE0001", metodo: "multicaixa", telefone: "923456789" }), 404);
  db["programs/p1"].pacotes = [];
  assert.equal(await bad({ reservaId: "RES0000000001", metodo: "multicaixa", telefone: "923456789" }), 422);
  db["programs/p1"].pacotes = [{ tipo: "casal", nome: "Casal", pessoas: 2, valor: 600000 }];
  assert.equal(await bad({ reservaId: "RES0000000001", metodo: "multicaixa", telefone: "923456789" }, env({ MODO_PAGAMENTO: "desligado" })), 503);
  db["reservations/RES0000000001"].status = "Cancelada";
  assert.equal(await bad({ reservaId: "RES0000000001", metodo: "multicaixa", telefone: "923456789" }), 409);
});
