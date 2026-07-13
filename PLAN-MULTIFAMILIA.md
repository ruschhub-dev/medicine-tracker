# 📋 Plano — Multi-família (multi-tenant)

Transformar o "Remédios da Família" em um app que **várias famílias** usam ao mesmo
tempo, cada uma com seus dados e notificações **isolados**. O app atual continua
rodando em paralelo, intocado — este é um **projeto Supabase novo, do zero**.

## Decisões travadas

| Tema | Escolha |
|---|---|
| Infra | **Projeto Supabase novo e separado** (nova URL/anon key, novo bucket). Sem migração. App atual segue em paralelo. |
| Deploy | **Novo deploy na Vercel, em outro domínio** (não mexe no atual). |
| Catálogo de remédios | **Compartilhado com moderação**: catálogo global curado pelo admin; usuários **propõem** remédios (usáveis na hora) e o admin **aprova** o que entra no catálogo. |
| Cadastro | **Aberto a qualquer um** (self-signup) + CAPTCHA contra abuso. |
| Multi-família | **Um usuário pode pertencer a várias famílias** (família "ativa" + seletor no topo). |
| Monetização | **Freemium com anúncios**: grátis (com anúncios + limites) **e** Premium por mensalidade (remove anúncios e libera tudo). Cobrança **por família**. |
| Pagamento | **Mercado Pago** (assinatura recorrente + Pix), checkout hospedado. O app **nunca** toca no cartão. |
| Idioma | Português (pt-BR) |

## O que muda em relação ao app de hoje

Hoje o app é **single-tenant**: a regra de segurança é `using (true)` — todo usuário
autenticado vê **tudo**. O isolamento vem só de convidar manualmente os e-mails certos.

No multi-tenant, **cada linha pertence a uma família (`familia_id`)** e as regras de
segurança (RLS) e as **notificações** respeitam esse limite. O maior risco hoje são as
notificações: as funções `api/enviar-lembretes` e `api/enviar-doses` leem com
`service_role` (ignoram o RLS) e mandam push/e-mail para **todos** — precisam passar a
agrupar por família.

## Modelo de dados

### Tabelas novas
| Tabela | Papel |
|---|---|
| `familias` | A "casa"/tenant: `id`, `nome`, `owner_id`, `created_at` |
| `membros` | Liga `auth.users` ↔ `familias` (**vários por usuário**): `familia_id`, `user_id`, `papel` (dono/membro) |
| `convites` | Código para entrar numa família: `codigo`, `familia_id`, `expira_em`, `usos_max`, `usos` |
| `admins` | Quem pode moderar o catálogo: `user_id` (você) |

### Coluna `familia_id`
Adicionada em `perfis`, `estoque`, `consumo`, `tratamentos`, `doses`
(desnormalizada em `consumo`/`doses` para o RLS e as notificações ficarem simples e rápidos).

### Catálogo (`medicamentos`) — compartilhado com moderação
Ganha:
- `status text` — `'pendente'` · `'aprovado'` · `'rejeitado'`
- `familia_id uuid null` — `null` = global (aprovado); preenchido = proposta daquela família
- `criado_por uuid` — quem propôs

Fluxo:
- Usuário cria remédio que não existe → entra como **`pendente`**, `familia_id` = família ativa.
  **Já pode ser usado no estoque na hora.**
- Admin **aprova** → vira `aprovado`, `familia_id = null` → aparece pra todos.
- Admin **rejeita** → vira `rejeitado`, continua **privado** daquela família (o estoque dela
  não quebra), mas some da fila e nunca vira global.
- Índice único **parcial** garante que o catálogo global não duplica código de barras:
  `unique(codigo_barras) where status = 'aprovado'`.

`push_subscriptions` fica ligada ao **`user_id`** (um aparelho pode servir várias famílias);
quem resolve as famílias no envio é o servidor, via `membros`.

## Segurança (RLS)

- Helpers `security definer`: `is_member(fid)` (é membro daquela família?) e `is_admin()`.
- Tabelas de dados da família: `using (is_member(familia_id)) with check (is_member(familia_id))`.
- `medicamentos` (leitura): `status = 'aprovado'  OR  is_member(familia_id)  OR  is_admin()`.
  (todos veem o catálogo aprovado + as próprias propostas; o admin vê as pendentes de todos).
- Onboarding e moderação por **RPCs `security definer`** (evita recursão do RLS):
  `criar_familia`, `gerar_convite`, `entrar_com_convite`, `sair_da_familia`,
  `aprovar_medicamento`, `rejeitar_medicamento`.
- Admin **não** recebe acesso aos dados de saúde das famílias — só modera o catálogo.

## Família "ativa" (multi-família)

Como um usuário pode estar em várias famílias:
- O cliente guarda a **família ativa** (localStorage) e mostra um **seletor no topo** (Layout).
- `supabaseRepo.ts` passa a **filtrar todo select** por `.eq('familia_id', ativa)` e **incluir
  `familia_id` da ativa** em todo insert (o RLS `with check` garante que só escreve em famílias suas).
- `medicamentos` é exceção: o select traz aprovados + propostas da família ativa.

## Notificações — por família

- `api/enviar-lembretes` e `api/enviar-doses`: em vez de um lote global, **agrupam por
  `familia_id`**. Para cada família: acham os **membros** → acham as **inscrições push** e os
  **e-mails** desses membros → enviam só pra eles.
- E-mail deixa de usar `auth.admin.listUsers()` (que pega todos) e passa a usar os membros
  daquela família.

## Onboarding e login (cliente)

- Ativar **signup** no Supabase Auth + aba "Criar conta" no `Login.tsx` (tirar o aviso
  "contas criadas pelo admin").
- **Porta de entrada** (`App.tsx`): logou → tem família? Não → tela **Criar família** ou
  **Entrar com código**. Tem várias → escolhe a **ativa**.
- **Convites**: o dono gera um código/link na tela Família; o novo membro cola o código.
- Nova tela de **Moderação** (rota escondida, só admin): lista pendentes → Aprovar/Rejeitar.

## Telas afetadas

| Arquivo | Mudança |
|---|---|
| `pages/Login.tsx` | Aba "Criar conta"; remover aviso de admin |
| `App.tsx` | Porta de onboarding + família ativa; rota `/moderacao` (admin) |
| `components/Layout.tsx` | Seletor de família ativa no topo |
| `pages/Familia.tsx` | Nome da família, membros, gerar convite, entrar em outra, sair |
| `pages/Moderacao.tsx` (novo) | Fila de remédios propostos → Aprovar/Rejeitar |
| `lib/supabaseRepo.ts` | Filtrar/inserir por `familia_id` da ativa; catálogo com `status` |
| `lib/familia.ts` (novo) | `minhasFamilias`, `criarFamilia`, `entrarComConvite`, `gerarConvite`, `sair`, ativa |
| `lib/push.ts` | (sem `familia_id`; continua por usuário) |

## Monetização (grátis com anúncios + Premium)

A unidade de cobrança é a **`familia`** (cobra-se por família, não por pessoa). Cada família
tem um **plano**: `gratis` ou `premium`.

| Grátis (com anúncios) | Premium (mensalidade) |
|---|---|
| Estoque + validade; 1 família; limite de membros/remédios | **Sem anúncios**; membros e remédios ilimitados; **várias famílias** |
| Alertas básicos de validade | Lembretes de dose (push/e-mail), foto da embalagem, relatório de aderência, backup |

### Anúncios (só no tier grátis) — com travas
Como é um app de **saúde**, os anúncios entram com cuidado (senão viram problema de LGPD/ANVISA e de confiança):
- **Só para famílias no plano grátis.** Virar Premium **remove** os anúncios (é o principal incentivo).
- **Não-personalizados** (contextuais) para reduzir o consentimento LGPD — ou um *gate* de consentimento explícito.
- **Slot fixo e neutro** (ex.: rodapé do Painel), **fora** das telas sensíveis (Cadastro, Tomar, Hoje).
- **Categorias sensíveis bloqueadas** — não deixar propaganda de medicamento arbitrária (ANVISA).
- Ponto de partida: **AdSense** (web). Alternativa mais controlada: *house ads* (anunciar o próprio Premium) / parcerias.

### Cobrança (Mercado Pago) — o app nunca toca no cartão
1. **Checkout hospedado** do Mercado Pago (Assinaturas/preapproval): o usuário paga na página do MP.
2. **Webhook** (função serverless na Vercel) recebe o evento → grava em `assinaturas` e atualiza
   `familias.plano` / `familias.plano_ate` no Supabase (service role).
3. **Gating por plano**: helper `is_premium(familia_id)` no banco + checagem no cliente (UX).
4. **Nunca trava o acesso aos próprios dados:** assinatura vencida vira **somente-leitura** — a família
   continua vendo a lista de remédios. Bloquear dado de saúde por falta de pagamento quebra a confiança.

Schema em `supabase-multifamilia/05_assinaturas.sql` (coluna `plano` em `familias`, tabela `assinaturas`, helper `is_premium`).

### Realidades antes de cobrar (não sou advogado/contador)
- **Uso comercial:** o **Hobby da Vercel proíbe uso comercial** → provável **Vercel Pro (US$ 20/mês)**; o
  Supabase grátis (500 MB banco, 1 GB storage) estoura — **as fotos** pesam mais. A mensalidade tem que cobrir a infra.
- **Formalização:** receber recorrente pede CPF/**MEI**, possivelmente nota fiscal e impostos (confirmar com contador).
- **Termos + Privacidade + aviso médico** ("não é aconselhamento médico") passam a ser **obrigatórios** ao cobrar de terceiros.

## Fases

- **Fase A — Fundação (banco novo):** `01_schema.sql`, `02_rls.sql`, `03_rpc.sql`,
  `04_seed_catalogo.sql` em `supabase-multifamilia/`. Nada roda até você criar o projeto novo.
- **Fase B — Onboarding (cliente):** signup, criar/entrar família, convites, família ativa,
  seletor no Layout, tela de Moderação.
- **Fase C — Notificações por família:** reescrever as duas funções serverless. **Obrigatória
  antes de qualquer segunda família entrar.**
- **Fase D — Endurecimento:** CAPTCHA do Supabase, fotos por pasta de família, aviso de
  privacidade/LGPD (você passa a ser responsável por dados de saúde de terceiros).
- **Fase E — Monetização:** slot de anúncios (só grátis, com as travas acima) + assinatura
  Premium via Mercado Pago (webhook → `assinaturas`/`familias.plano`) + gating por plano.

## Passos que dependem de você (quando chegarmos lá)

1. Criar o **projeto Supabase novo** e me passar a nova URL + anon key.
2. Rodar os SQLs no SQL Editor do projeto novo (`01`→`05`, em ordem).
3. Inserir seu `user_id` em `admins` (uma linha, via SQL) para virar moderador.
4. Criar o **novo deploy na Vercel** com as env vars do projeto novo (uso comercial → provável **Vercel Pro**).
5. **Fase E:** conta no **Mercado Pago** (credenciais + criar o plano de assinatura) e conta no
   **AdSense** (se for usar rede de anúncios); formalização fiscal (MEI) e Termos/Privacidade publicados.
