/* =====================================================
   Ligação ao gateway de pagamentos

   MODO_PAGAMENTO (wrangler.toml):
     "desligado" → recusa pagamentos (até haver credenciais)
     "simulado"  → finge o gateway: o pagamento fica "pago" ~8 s depois.
                   SÓ para testar o site; nunca em produção.
     "pay4all"   → Pay4All real.  ⚠️ Por completar quando o Pay4All enviar
                   a documentação da API: ver os TODO em baixo.

   Todas as funções devolvem { referencia, estado, detalhe? }
   estado: "pendente" | "pago" | "falhou" | "expirado"
   ===================================================== */

export class GatewayError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

/* ── Simulação (testes) ── */
const simulado = {
  async criar({ pagamentoId }) {
    return { referencia: `SIM-${pagamentoId.slice(0, 8).toUpperCase()}`, estado: "pendente" };
  },
  async consultar({ criadoEm, telefone }) {
    // Número terminado em 0 → simula um pagamento recusado
    if (String(telefone || "").endsWith("0")) return { estado: "falhou", detalhe: "Recusado (simulação)" };
    const passou = Date.now() - new Date(criadoEm).getTime();
    return { estado: passou > 8000 ? "pago" : "pendente" };
  },
  async validarNotificacao() {
    return null; // a simulação não envia notificações
  },
};

/* ── Pay4All (por completar com a documentação oficial) ── */
const pay4all = {
  async criar({ env, valor, metodo, telefone, pagamentoId, descricao }) {
    if (!env.PAY4ALL_BASE_URL || !env.PAY4ALL_API_KEY) {
      throw new GatewayError("Pay4All ainda não configurado (faltam PAY4ALL_BASE_URL / PAY4ALL_API_KEY).", 503);
    }
    // Endpoints conhecidos publicamente (módulo Odoo do Pay4All):
    //   Multicaixa Express → /payment/appy/request/plugin
    //   e-Kwanza           → /payment/ekwanza/request/plugin
    // TODO(Pay4All): confirmar caminhos, autenticação, campos e formato da resposta.
    const caminho = metodo === "ekwanza" ? "/payment/ekwanza/request/plugin" : "/payment/appy/request/plugin";
    const res = await fetch(env.PAY4ALL_BASE_URL.replace(/\/$/, "") + caminho, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // TODO(Pay4All): cabeçalho de autenticação correto
        authorization: `Bearer ${env.PAY4ALL_API_KEY}`,
      },
      body: JSON.stringify({
        // TODO(Pay4All): nomes dos campos
        amount: valor,
        phone: telefone,
        reference: pagamentoId,
        description: descricao,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new GatewayError(`Pay4All recusou o pedido (${res.status}).`);
    // TODO(Pay4All): ler a referência/id e o estado da resposta
    return { referencia: String(json.reference || json.id || pagamentoId), estado: "pendente" };
  },

  async consultar({ env, referencia }) {
    // TODO(Pay4All): confirmar endpoint de estado e valores possíveis
    const res = await fetch(`${env.PAY4ALL_BASE_URL.replace(/\/$/, "")}/payment/status?reference=${encodeURIComponent(referencia)}`, {
      headers: { authorization: `Bearer ${env.PAY4ALL_API_KEY}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new GatewayError(`Pay4All não respondeu ao estado (${res.status}).`);
    const s = String(json.status || "").toLowerCase();
    // TODO(Pay4All): mapear os estados reais
    const estado = /paid|success|conclu|aprov/.test(s) ? "pago" : /fail|recus|cancel|erro/.test(s) ? "falhou" : /expir/.test(s) ? "expirado" : "pendente";
    return { estado, detalhe: json.status || "" };
  },

  /** Notificação enviada pelo Pay4All: devolve { referencia, estado } se for autêntica */
  async validarNotificacao({ env, request, corpo }) {
    // TODO(Pay4All): validar a assinatura (ex.: HMAC com PAY4ALL_API_SECRET num cabeçalho).
    // Enquanto não houver forma de validar, a notificação NÃO é aceite como prova de pagamento:
    // o servidor volta a perguntar o estado ao Pay4All (consultar) antes de confirmar.
    if (!corpo || !(corpo.reference || corpo.referencia)) return null;
    return { referencia: String(corpo.reference || corpo.referencia), confiavel: false };
  },
};

const desligado = {
  async criar() {
    throw new GatewayError("Os pagamentos online ainda não estão ativos.", 503);
  },
  async consultar() {
    return { estado: "pendente" };
  },
  async validarNotificacao() {
    return null;
  },
};

export function gateway(env) {
  const modo = String(env.MODO_PAGAMENTO || "desligado").toLowerCase();
  if (modo === "pay4all") return pay4all;
  if (modo === "simulado") return simulado;
  return desligado;
}
