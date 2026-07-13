# 💊 Controle de Remédios da Família

App web (PWA) para consultar os remédios guardados em casa e acompanhar a validade.
Feito para funcionar bem no celular e ser acessível para toda a família.

Veja o plano completo em [PLAN.md](PLAN.md).

## Rodar localmente (desenvolvimento)

Pré-requisitos: Node 18+ (recomendado 20+).

```bash
npm install
npm run dev
```

Abra o endereço mostrado no terminal (ex.: `http://localhost:5173`).

> Sem configurar o Supabase, o app roda em **modo local**: os dados ficam salvos apenas
> no navegador daquele dispositivo. É ótimo para testar. Para compartilhar entre a
> família, configure o Supabase abaixo.

## Publicar na nuvem (compartilhado entre a família)

### 1. Criar o projeto no Supabase (banco de dados + login)
1. Crie uma conta grátis em <https://supabase.com> e clique em **New project**.
2. Dê um nome (ex.: `remedios-familia`), escolha uma senha forte para o banco e a região
   mais próxima (ex.: `South America (São Paulo)`).
3. Quando o projeto subir, vá em **SQL Editor** → cole o conteúdo de
   [`supabase/schema.sql`](supabase/schema.sql) → **Run**. Isso cria as tabelas.
4. Vá em **Project Settings → API** e copie:
   - **Project URL**
   - **anon public** key
5. Em **Authentication → Providers**, deixe **Email** habilitado (permite tanto senha
   quanto link mágico). Em **Authentication → Users**, você poderá convidar os e-mails
   da família.

### 2. Conectar o app ao Supabase
Crie um arquivo `.env.local` na raiz (copie de `.env.example`) e preencha:

```
VITE_SUPABASE_URL=...        # Project URL
VITE_SUPABASE_ANON_KEY=...   # anon public key
```

Rode `npm run dev` de novo — o app passa a usar o banco na nuvem.

### 3. Publicar o site na Vercel
1. Crie uma conta grátis em <https://vercel.com> (dá para entrar com o GitHub).
2. Suba este projeto para um repositório no GitHub e importe na Vercel (**Add New → Project**).
3. Em **Environment Variables**, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. **Deploy**. A Vercel gera um endereço `https://...vercel.app` que a família acessa de
   qualquer lugar e pode instalar como app no celular.

> Precisa de ajuda em qualquer passo? É só me chamar que eu te guio.

## Scripts
- `npm run dev` — servidor de desenvolvimento
- `npm run build` — build de produção
- `npm run preview` — pré-visualiza o build

## Estrutura
```
src/
  lib/       tipos, cálculos de validade, acesso a dados (repositório)
  components/ layout, navegação e leitor de código de barras
  pages/     Painel, Cadastro, Consulta, Consumo, Estoque
supabase/
  schema.sql  esquema do banco (rodar no Supabase)
```
