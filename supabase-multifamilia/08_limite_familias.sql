-- ============================================================
-- Limite do plano GRÁTIS: 1 família por usuário. Premium libera participar
-- de várias. Redefine criar_familia e entrar_com_convite com a checagem
-- (é a trava de verdade — o app também esconde os botões, mas isto vale no banco).
-- Rode DEPOIS de 05_assinaturas.sql. Idempotente (create or replace).
-- ============================================================

-- Pode entrar/criar mais uma família?  Sim se ainda não tem nenhuma,
-- ou se já participa de alguma família Premium (dentro da validade).
create or replace function pode_add_familia()
returns boolean
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from membros where user_id = auth.uid()) = 0
    or exists (
      select 1 from membros m
      join familias f on f.id = m.familia_id
      where m.user_id = auth.uid()
        and f.plano = 'premium'
        and (f.plano_ate is null or f.plano_ate > now())
    );
$$;

create or replace function criar_familia(p_nome text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'informe um nome'; end if;
  if not pode_add_familia() then
    raise exception 'O plano grátis permite apenas uma família. Assine o Premium para ter mais.';
  end if;
  insert into familias (nome, owner_id) values (trim(p_nome), auth.uid())
    returning id into fid;
  insert into membros (familia_id, user_id, papel) values (fid, auth.uid(), 'dono');
  return fid;
end $$;

create or replace function entrar_com_convite(p_codigo text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare c convites;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  if not pode_add_familia() then
    raise exception 'O plano grátis permite apenas uma família. Assine o Premium para ter mais.';
  end if;
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

grant execute on function pode_add_familia() to authenticated;
