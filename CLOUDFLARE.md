# O Mochilão — Cloudflare (site + servidor de pagamentos)

Guia passo a passo. As partes marcadas com 👤 são feitas por si na sua conta;
o código já está pronto neste repositório.

```
omochilao.ao          → site (Cloudflare Pages, pasta dist/ gerada pelo cloudflare/build.sh)
api.omochilao.ao      → servidor de pagamentos (Cloudflare Worker, pasta servidor-pagamentos/)
Firebase (Firestore)  → dados: programas, reservas, pagamentos…  (sem mudanças)
```

---

## 1. 👤 Conta e domínio

1. Criar conta grátis em <https://dash.cloudflare.com/sign-up>.
2. **Add a site** → `omochilao.ao` → plano **Free**.
3. O Cloudflare mostra **2 nameservers**. No registo do domínio .ao, trocar os nameservers por esses dois.
   (Pode demorar algumas horas; o Cloudflare envia um email quando o domínio fica ativo.)

> Até o domínio estar ativo, o site atual no GitHub Pages continua a funcionar normalmente.

## 2. 👤 Site no Cloudflare Pages

1. **Workers & Pages → Create → Pages → Connect to Git** → autorizar o GitHub → escolher `projeto_mochilao`.
2. Configuração do build:
   | Campo | Valor |
   |---|---|
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | `bash cloudflare/build.sh` |
   | Build output directory | `dist` |
3. **Save and Deploy**. O site fica num endereço provisório `https://omochilao.pages.dev` (ou parecido) — testar tudo aí.
4. **Custom domains → Set up a domain** → `omochilao.ao` e depois `www.omochilao.ao`.

O `build.sh` só publica os ficheiros do site: ficam de fora os scripts de configuração,
notas, regras, o servidor de pagamentos e ficheiros que não sejam imagens/fontes.
Cada envio para o GitHub atualiza o site sozinho.

## 3. 👤 Firebase (obrigatório no dia da mudança)

- **Authentication → Settings → Authorized domains → Add domain**:
  `omochilao.ao`, `www.omochilao.ao` e o endereço `….pages.dev`.
  **Sem isto o login do painel não funciona no domínio novo.**
- **Firestore → Regras**: colar o `firestore.rules` deste repositório e **Publicar**
  (inclui a coleção `pagamentos`).
- Se a chave da API tiver restrição por site (Google Cloud → Credentials), acrescentar o domínio novo.
- **EmailJS** (se configurou domínios permitidos): acrescentar o domínio novo.

## 4. 👤 Tornar o repositório privado (só depois do passo 2 a funcionar)

GitHub → Settings → General → Danger Zone → **Change visibility → Private**.
Depois: Settings → Pages → desligar o GitHub Pages.
O Cloudflare continua a receber as atualizações (a ligação ao GitHub mantém-se).

## 5. Servidor de pagamentos (Worker)

### 5.1 👤 Conta de serviço do Firebase
Firebase → ⚙️ Definições do projeto → **Contas de serviço** → **Gerar nova chave privada**.
Descarrega um ficheiro JSON. **Este ficheiro dá acesso total à base de dados:**
nunca o envie por email/WhatsApp nem o coloque no repositório.

### 5.2 👤 Publicar o Worker (uma vez, no computador)
Precisa do Node.js instalado. Na pasta `servidor-pagamentos`:

```bash
npm install
npx wrangler login                                   # abre o browser para entrar no Cloudflare
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT     # colar o conteúdo TODO do ficheiro JSON
npx wrangler deploy
```

Depois, no Cloudflare: **Workers → omochilao-pagamentos → Settings → Domains & Routes → Add custom domain** → `api.omochilao.ao`.

Teste: abrir `https://api.omochilao.ao/saude` → deve mostrar `{"ok":true,"modo":"desligado"}`.

### 5.3 Modos (em `servidor-pagamentos/wrangler.toml`)
| `MODO_PAGAMENTO` | Para quê |
|---|---|
| `desligado` | Estado atual: recusa pagamentos até haver credenciais |
| `simulado` | Testes do site: o pagamento fica "pago" ~8 s depois (número terminado em 0 = recusado). **Nunca em produção.** |
| `pay4all` | Produção, depois de ligar a API do Pay4All |

`PERCENTAGEM_ONLINE`: `100` = paga o total · `30` = paga só o sinal.

### 5.4 Quando o Pay4All enviar as credenciais
```bash
npx wrangler secret put PAY4ALL_API_KEY
npx wrangler secret put PAY4ALL_API_SECRET
```
e completar os pontos marcados `TODO(Pay4All)` em `servidor-pagamentos/src/pay4all.js`
(endereços, autenticação, campos, estados, validação das notificações).

**Perguntas para o Pay4All**
1. Documentação da API e ambiente de testes (sandbox).
2. Autenticação: como se enviam as credenciais?
3. Avisam o nosso servidor quando o pagamento muda (webhook)? Como se valida que o aviso é vosso?
4. É preciso IP fixo / lista de IPs autorizados? (O Cloudflare Workers não tem IP fixo.)
5. Que domínio registar como site do comerciante? (`omochilao.ao`)
6. Taxas, prazos de liquidação e reembolsos.

## Segurança — o que garante o servidor
- O **valor é calculado no servidor** a partir dos preços do Firestore (o total enviado pelo browser é ignorado).
- A reserva só passa a **Confirmada** quando o gateway confirma o pagamento.
- Só os sites da lista `ALLOWED_ORIGINS` podem chamar o servidor a partir do browser.
- Credenciais só como segredos do Cloudflare; o site não as vê.
- Testes automáticos: `cd servidor-pagamentos && npm test`.
