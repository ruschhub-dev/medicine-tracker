-- ============================================================
-- Monetização: plano por família + assinatura (Mercado Pago).
-- Rode DEPOIS de 04_seed_catalogo.sql.
-- Regra: o app NUNCA toca no cartão. Quem escreve aqui é o WEBHOOK
-- do Mercado Pago (função serverless com service role, que ignora o RLS).
-- ============================================================

-- Plano vigente denormalizado na família (gating vira uma leitura simples).
alter table familias
  add column if not exists plano text not null default 'gratis'
    check (plano in ('gratis','premium')),
  add column if not exists plano_ate timestamptz;   -- null = sem validade/paga em dia

-- Assinaturas (uma linha por família paga; histórico/vínculo com o provedor).
create table if not exists assinaturas (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references familias(id) on delete cascade,
  provider text not null default 'mercadopago',
  preapproval_id text unique,        -- id da assinatura no Mercado Pago
  payer_email text,
  plano text not null default 'premium',
  status text not null default 'pendente'
    check (status in ('pendente','ativa','pausada','cancelada','vencida')),
  current_period_end timestamptz,    -- fim do ciclo pago atual
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_assinaturas_familia on assinaturas(familia_id);

alter table assinaturas enable row level security;

-- Membros podem VER a assinatura da própria família (mostrar status no app).
drop policy if exists assin_select on assinaturas;
create policy assin_select on assinaturas for select to authenticated
  using (is_member(familia_id));
-- INSERT/UPDATE: só o webhook (service role) — sem policy para 'authenticated'.

-- É Premium? (plano premium e dentro da validade). Usado no gating.
create or replace function is_premium(fid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from familias f
    where f.id = fid
      and f.plano = 'premium'
      and (f.plano_ate is null or f.plano_ate > now())
  );
$$;

grant execute on function is_premium(uuid) to authenticated;

-- Observação: os LIMITES do plano grátis (nº de membros/remédios, nº de famílias)
-- podem ser aplicados no cliente (UX) e/ou reforçados por trigger/policy aqui,
-- conforme decidirmos na Fase E.
