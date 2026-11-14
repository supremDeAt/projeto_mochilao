/* =====================================================
   O MOCHILÃO — servidor de pagamentos (Cloudflare Worker)

   Rotas:
     GET  /saude                  → verificação simples
     POST /pagamentos             → { reservaId, metodo: "multicaixa"|"ekwanza", telefone }
                                    inicia o pagamento de uma reserva
     GET  /pagamentos/:id         → estado do pagamento (pergunta ao gateway se estiver pendente)
     POST /pagamentos/notificacao → aviso do Pay4All quando o pagamento muda

   Regras de ouro:
   • O VALOR é sempre calculado aqui, a partir dos preços do Firestore —
     nunca a partir do que o browser envia.
   • A reserva só passa a paga quando o GATEWAY confirma (nunca pela palavra do browser).
   • Credenciais só como segredos do Worker.
   ===================================================== */

import { getDoc, setDoc, updateDoc } from "./firestore.js";
import { gateway, GatewayError } from "./pay4all.js";

const ESTADO_INICIAL = "Aguardando Pagamento";
const METODOS = ["multicaixa", "ekwanza"];

/* ── HTTP ── */
function cors(env, request) {
  const origin = request.headers.get("origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const h = { vary: "origin" };
  if (allowed.includes(origin)) {
    h["access-control-allow-origin"] = origin;
    h["access-control-allow-methods"] = "GET, POST, OPTIONS";
    h["access-control-allow-headers"] = "content-type";
    h["access-control-max-age"] = "86400";
  }
  return h;
}
const json = (data, status, headers) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* ── Preço calculado no servidor ── */
export async function calcularTotal(env, reserva) {
  const itens = Array.isArray(reserva.itens) ? reserva.itens : [];
  if (!itens.length) throw new HttpError(422, "A reserva não tem viagens.");
  const cache = {};
  let total = 0;
  for (const it of itens) {
    const id = String(it.programId || "");
    if (!id) throw new HttpError(422, `"${it.nome}" não pode ser paga online. Contacte-nos.`);
    cache[id] ??= await getDoc(env, `programs/${encodeURIComponent(id)}`);
    const p = cache[id];
    const pacotes = Array.isArray(p?.pacotes) ? p.pacotes : [];
    const pk =
      pacotes.find((x) => String(x.tipo || "") === String(it.pacoteId || "")) ||
      pacotes.find((x) => String(x.nome || "").toLowerCase() === String(it.pacote || "").toLowerCase());
    const valor = Math.round(Number(pk?.valor) || 0);
    const qtd = Math.max(1, Math.min(20, parseInt(it.qtd, 10) || 1));
    if (!p || !pk || valor <= 0) throw new HttpError(422, `O preço de "${it.nome}" mudou ou já não existe. Contacte-nos.`);
    total += valor * qtd;
  }
  return total;
}

export function valorAPagar(env, total) {
  const pct = Math.min(100, Math.max(1, parseInt(env.PERCENTAGEM_ONLINE, 10) || 100));
  return Math.round((total * pct) / 100);
}

function telefoneAngola(t) {
  let d = String(t || "").replace(/\D/g, "");
  if (d.startsWith("244")) d = d.slice(3);
  return /^9\d{8}$/.test(d) ? d : "";
}

const novoId = () => crypto.randomUUID().replace(/-/g, "");

/* ── Atualizar reserva quando o pagamento muda ── */
async function aplicarEstado(env, pagamentoId, pag, novo) {
  if (pag.estado === novo.estado) return pag;
  const agora = new Date();
  const atualizado = { ...pag, estado: novo.estado, detalhe: novo.detalhe || "", atualizadoEm: agora };
  await updateDoc(env, `pagamentos/${pagamentoId}`, { estado: novo.estado, detalhe: novo.detalhe || "", atualizadoEm: agora });

  const reserva = await getDoc(env, `reservations/${pag.reservaId}`);
  if (!reserva) return atualizado;
  const resumo = { id: pagamentoId, estado: novo.estado, metodo: pag.metodo, valor: pag.valor, total: pag.total, referencia: pag.referencia || "", atualizadoEm: agora };
  const patch = { pagamento: resumo };
  if (novo.estado === "pago" && reserva.status === ESTADO_INICIAL) {
    const pagoTudo = pag.valor >= pag.total;
    patch.status = pagoTudo ? "Confirmada" : "Em análise";
    patch.historico = [
      ...(Array.isArray(reserva.historico) ? reserva.historico : []),
      {
        de: reserva.status,
        para: patch.status,
        por: `Pagamento online (${pag.metodo})`,
        em: agora,
        nota: pagoTudo ? "Pago na totalidade" : `Sinal pago: ${pag.valor} Kz de ${pag.total} Kz`,
      },
    ];
  }
  await updateDoc(env, `reservations/${pag.reservaId}`, patch);
  return atualizado;
}

/* ── Rotas ── */
async function iniciar(env, request) {
  const body = await request.json().catch(() => null);
  const reservaId = String(body?.reservaId || "");
  const metodo = String(body?.metodo || "");
  const telefone = telefoneAngola(body?.telefone);
  if (!/^[A-Za-z0-9]{10,40}$/.test(reservaId)) throw new HttpError(400, "Reserva inválida.");
  if (!METODOS.includes(metodo)) throw new HttpError(400, "Método de pagamento inválido.");
  if (!telefone) throw new HttpError(400, "Indique um número angolano válido (9XX XXX XXX).");

  const reserva = await getDoc(env, `reservations/${reservaId}`);
  if (!reserva) throw new HttpError(404, "Reserva não encontrada.");
  if (reserva.status !== ESTADO_INICIAL) throw new HttpError(409, "Esta reserva já não está à espera de pagamento.");
  if (reserva.pagamento?.estado === "pago") throw new HttpError(409, "Esta reserva já está paga.");

  const total = await calcularTotal(env, reserva);
  const valor = valorAPagar(env, total);
  const pagamentoId = novoId();
  const criadoEm = new Date();
  const ref = "MCH-" + reservaId.slice(0, 6).toUpperCase();

  const g = gateway(env);
  const r = await g.criar({ env, valor, metodo, telefone, pagamentoId, descricao: `O Mochilão · Reserva ${ref}` });

  const pag = { reservaId, metodo, telefone, valor, total, referencia: r.referencia, estado: r.estado || "pendente", criadoEm, atualizadoEm: criadoEm };
  await setDoc(env, `pagamentos/${pagamentoId}`, pag);
  await updateDoc(env, `reservations/${reservaId}`, {
    pagamento: { id: pagamentoId, estado: pag.estado, metodo, valor, total, referencia: pag.referencia, atualizadoEm: criadoEm },
  });
  return json({ pagamentoId, estado: pag.estado, valor, total, referencia: pag.referencia }, 201);
}

async function consultar(env, pagamentoId) {
  if (!/^[a-f0-9]{32}$/.test(pagamentoId)) throw new HttpError(400, "Pagamento inválido.");
  let pag = await getDoc(env, `pagamentos/${pagamentoId}`);
  if (!pag) throw new HttpError(404, "Pagamento não encontrado.");
  if (pag.estado === "pendente") {
    const r = await gateway(env).consultar({ env, ...pag });
    pag = await aplicarEstado(env, pagamentoId, pag, r);
  }
  return json({ pagamentoId, estado: pag.estado, valor: pag.valor, total: pag.total, detalhe: pag.detalhe || "" }, 200);
}

async function notificacao(env, request) {
  const corpo = await request.json().catch(() => null);
  const aviso = await gateway(env).validarNotificacao({ env, request, corpo });
  if (!aviso) return json({ ok: false }, 400);
  // Mesmo com um aviso, confirmamos o estado junto do gateway antes de mexer na reserva.
  // TODO(Pay4All): encontrar o pagamento pela referência (guardar referencia → id quando criar).
  return json({ ok: true }, 200);
}

export default {
  async fetch(request, env) {
    const headers = cors(env, request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const url = new URL(request.url);
    try {
      if (url.pathname === "/saude" && request.method === "GET") {
        return json({ ok: true, modo: String(env.MODO_PAGAMENTO || "desligado") }, 200, headers);
      }
      if (url.pathname === "/pagamentos" && request.method === "POST") {
        return withHeaders(await iniciar(env, request), headers);
      }
      if (url.pathname === "/pagamentos/notificacao" && request.method === "POST") {
        return withHeaders(await notificacao(env, request), headers);
      }
      const m = url.pathname.match(/^\/pagamentos\/([a-f0-9]{32})$/);
      if (m && request.method === "GET") return withHeaders(await consultar(env, m[1]), headers);
      return json({ erro: "Não encontrado." }, 404, headers);
    } catch (err) {
      const status = err instanceof HttpError || err instanceof GatewayError ? err.status : 500;
      if (status === 500) console.error("[pagamentos]", err);
      return json({ erro: status === 500 ? "Erro interno. Tente de novo." : err.message }, status, headers);
    }
  },
};

function withHeaders(res, headers) {
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}
