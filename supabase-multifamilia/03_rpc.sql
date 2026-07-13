-- ============================================================
-- RPCs (funções chamadas pelo app). security definer para poder
-- escrever nas tabelas de tenancy sem esbarrar no RLS.
-- Rode DEPOIS de 02_rls.sql.
-- ============================================================

-- Cria uma família e torna quem chamou o "dono" (membro).
create or replace function criar_familia(p_nome text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'informe um nome'; end if;
  insert into familias (nome, owner_id) values (trim(p_nome), auth.uid())
    returning id into fid;
  insert into membros (familia_id, user_id, papel) values (fid, auth.uid(), 'dono');
  return fid;
end $$;

-- Gera um código de convite para uma família da qual você é membro.
create or replace function gerar_convite(
  p_familia_id uuid,
  p_expira_em timestamptz default null,
  p_usos_max integer default null
)
returns text
language plpgsql security definer set search_path = public as $$
declare cod text;
begin
  if not is_member(p_familia_id) then raise exception 'sem permissão nesta família'; end if;
  cod := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into convites (codigo, familia_id, criado_por, expira_em, usos_max)
    values (cod, p_familia_id, auth.uid(), p_expira_em, p_usos_max);
  return cod;
end $$;

-- Entra numa família usando um código de convite. Retorna o familia_id.
create or replace function entrar_com_convite(p_codigo text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare c convites;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  select * into c from convites where codigo = upper(trim(p_codigo));
  if c.codigo is null then raise exception 'convite inválido'; end if;
  if c.expira_em is not null and c.expira_em < now() then raise exception 'convite expirado'; end if;
  if c.usos_max is not null and c.usos >= c.usos_max then raise exception 'convite esgotado'; end if;

  insert into membros (familia_id, user_id, papel)
    values (c.familia_id, auth.uid(), 'membro')
    on conflict (familia_id, user_id) do nothing;
  update convites set usos = usos + 1 where codigo = c.codigo;
  return c.familia_id;
end $$;

-- Sai de uma família (remove o próprio vínculo).
create or replace function sair_da_familia(p_familia_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from membros where familia_id = p_familia_id and user_id = auth.uid();
end $$;

-- Aprova uma proposta de remédio → vira global (aprovado, sem família).
create or replace function aprovar_medicamento(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'apenas moderador'; end if;
  update medicamentos set status = 'aprovado', familia_id = null where id = p_id;
end $$;

-- Rejeita uma proposta → continua privada da família que propôs (estoque não quebra).
create or replace function rejeitar_medicamento(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'apenas moderador'; end if;
  update medicamentos set status = 'rejeitado' where id = p_id;
end $$;

-- Gera (idempotente) as ocorrências de doses de um dia, já com o familia_id do
-- tratamento, convertendo o horário local de Brasília para timestamptz.
create or replace function gerar_doses(dia date)
returns void
language sql security definer set search_path = public as $$
  insert into doses (familia_id, tratamento_id, data, horario, prevista_em)
  select t.familia_id, t.id, dia, h,
         ((dia::text || ' ' || h)::timestamp) at time zone 'America/Sao_Paulo'
  from tratamentos t
  cross join unnest(t.horarios) as h
  where t.ativo
    and t.data_inicio <= dia
    and (t.data_fim is null or t.data_fim >= dia)
    and (t.dias_semana is null
         or array_length(t.dias_semana, 1) is null
         or extract(dow from dia)::int = any (t.dias_semana))
  on conflict (tratamento_id, prevista_em) do nothing;
$$;

grant execute on function
  criar_familia(text),
  gerar_convite(uuid, timestamptz, integer),
  entrar_com_convite(text),
  sair_da_familia(uuid),
  aprovar_medicamento(uuid),
  rejeitar_medicamento(uuid),
  gerar_doses(date)
to authenticated;

-- ============================================================
-- Torne-se moderador do catálogo (rode UMA vez, com você logado no
-- projeto novo — pegue o id em Authentication -> Users):
--   insert into admins (user_id) values ('SEU-USER-UUID');
-- ============================================================
