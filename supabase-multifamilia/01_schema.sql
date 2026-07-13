-- ============================================================
-- Remédios da Família — MULTI-FAMÍLIA (multi-tenant)
-- Projeto Supabase NOVO e separado. Rode os arquivos em ordem:
--   01_schema.sql → 02_rls.sql → 03_rpc.sql → 04_seed_catalogo.sql
-- Este arquivo cria só as tabelas, índices e constraints.
-- ============================================================

-- ---------- Tenancy ----------

-- A "casa" / família (tenant)
create table if not exists familias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Vínculo usuário ↔ família (um usuário pode estar em VÁRIAS famílias)
create table if not exists membros (
  familia_id uuid not null references familias(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  papel text not null default 'membro' check (papel in ('dono','membro')),
  created_at timestamptz not null default now(),
  primary key (familia_id, user_id)
);

-- Convites para entrar numa família existente
create table if not exists convites (
  codigo text primary key,
  familia_id uuid not null references familias(id) on delete cascade,
  criado_por uuid references auth.users(id) on delete set null,
  expira_em timestamptz,
  usos_max integer,                       -- null = ilimitado
  usos integer not null default 0,
  created_at timestamptz not null default now()
);

-- Moderadores do catálogo (adicione o seu user_id aqui — ver 03_rpc.sql / README)
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------- Catálogo compartilhado com moderação ----------

create table if not exists medicamentos (
  id uuid primary key default gen_random_uuid(),
  codigo_barras text,
  nome text not null,
  principio_ativo text,
  concentracao text,
  forma text check (forma in (
    'comprimido','capsula','xarope','suspensao','spray','pomada','creme',
    'gotas','colirio','injetavel','supositorio','outro'
  )),
  unidade text not null default 'unidade' check (unidade in (
    'comprimidos','capsulas','ml','doses','gotas','g','aplicacoes','unidade'
  )),
  tarja text not null default 'sem_tarja' check (tarja in ('sem_tarja','vermelha','preta')),
  requer_receita boolean not null default false,
  indicacao text,
  bula_url text,
  foto_url text,
  -- Moderação:
  status text not null default 'pendente' check (status in ('pendente','aprovado','rejeitado')),
  familia_id uuid references familias(id) on delete cascade,  -- null = global (aprovado)
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- O catálogo GLOBAL (aprovado) não duplica código de barras; propostas podem coexistir.
create unique index if not exists uq_med_codigo_aprovado
  on medicamentos (codigo_barras)
  where status = 'aprovado' and codigo_barras is not null;

create index if not exists idx_med_status on medicamentos(status);
create index if not exists idx_med_familia on medicamentos(familia_id);

-- ---------- Dados por família ----------

create table if not exists perfis (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references familias(id) on delete cascade,
  nome text not null,
  tipo text not null default 'adulto' check (tipo in ('adulto','crianca')),
  data_nascimento date,
  cor text,
  created_at timestamptz not null default now()
);

create table if not exists estoque (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references familias(id) on delete cascade,
  medicamento_id uuid not null references medicamentos(id) on delete restrict,
  quantidade_atual numeric not null default 0,
  quantidade_inicial numeric,
  lote text,
  data_validade date not null,
  data_abertura date,
  validade_apos_aberto_dias integer,
  local text,
  estoque_minimo numeric,
  observacao text,
  status text not null default 'ativo' check (status in ('ativo','esgotado','descartado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists consumo (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references familias(id) on delete cascade,
  estoque_id uuid not null references estoque(id) on delete cascade,
  perfil_id uuid references perfis(id) on delete set null,
  quantidade numeric not null,
  datahora timestamptz not null default now(),
  observacao text
);

create table if not exists tratamentos (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references familias(id) on delete cascade,
  perfil_id uuid references perfis(id) on delete set null,
  medicamento_id uuid not null references medicamentos(id) on delete restrict,
  dose numeric not null,
  horarios text[] not null default '{}',      -- ex.: {'08:00','20:00'} (hora de Brasília)
  dias_semana integer[],                       -- 0=domingo..6=sábado; null = todos os dias
  data_inicio date not null default current_date,
  data_fim date,                               -- null = contínuo
  ativo boolean not null default true,
  observacao text,
  created_at timestamptz not null default now()
);

create table if not exists doses (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references familias(id) on delete cascade,
  tratamento_id uuid not null references tratamentos(id) on delete cascade,
  data date not null,
  horario text not null,
  prevista_em timestamptz not null,
  status text not null default 'pendente' check (status in ('pendente','tomado','pulado')),
  tomada_em timestamptz,
  notificada_em timestamptz,
  created_at timestamptz not null default now(),
  unique (tratamento_id, prevista_em)
);

-- Inscrições de notificação (Web Push): por USUÁRIO (o servidor resolve as famílias)
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_estoque_familia on estoque(familia_id);
create index if not exists idx_estoque_medicamento on estoque(medicamento_id);
create index if not exists idx_estoque_validade on estoque(data_validade);
create index if not exists idx_consumo_familia on consumo(familia_id);
create index if not exists idx_consumo_estoque on consumo(estoque_id);
create index if not exists idx_tratamentos_familia on tratamentos(familia_id);
create index if not exists idx_doses_familia on doses(familia_id);
create index if not exists idx_doses_prevista on doses(prevista_em);
create index if not exists idx_doses_data on doses(data);
create index if not exists idx_membros_user on membros(user_id);
