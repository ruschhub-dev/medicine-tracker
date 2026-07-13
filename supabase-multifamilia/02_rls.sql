-- ============================================================
-- RLS (Row Level Security) — isolamento por família
-- Rode DEPOIS de 01_schema.sql.
-- ============================================================

-- ---------- Helpers (security definer: não sofrem RLS, evitam recursão) ----------

create or replace function is_member(fid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from membros m
    where m.familia_id = fid and m.user_id = auth.uid()
  );
$$;

create or replace function is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins a where a.user_id = auth.uid());
$$;

-- ---------- Habilita RLS ----------

alter table familias           enable row level security;
alter table membros            enable row level security;
alter table convites           enable row level security;
alter table admins             enable row level security;
alter table medicamentos       enable row level security;
alter table perfis             enable row level security;
alter table estoque            enable row level security;
alter table consumo            enable row level security;
alter table tratamentos        enable row level security;
alter table doses              enable row level security;
alter table push_subscriptions enable row level security;

-- ---------- familias ----------
drop policy if exists fam_select on familias;
create policy fam_select on familias for select to authenticated
  using (is_member(id));
drop policy if exists fam_update on familias;
create policy fam_update on familias for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists fam_delete on familias;
create policy fam_delete on familias for delete to authenticated
  using (owner_id = auth.uid());
-- INSERT em familias: só via RPC criar_familia() (security definer).

-- ---------- membros ----------
drop policy if exists mem_select on membros;
create policy mem_select on membros for select to authenticated
  using (is_member(familia_id));
drop policy if exists mem_delete on membros;
create policy mem_delete on membros for delete to authenticated
  using (user_id = auth.uid());   -- sair da própria conta
-- INSERT em membros: só via RPC criar_familia()/entrar_com_convite().

-- ---------- convites ----------
drop policy if exists conv_select on convites;
create policy conv_select on convites for select to authenticated
  using (is_member(familia_id));
-- INSERT/consumo de convite: via RPC gerar_convite()/entrar_com_convite().

-- ---------- admins ----------
drop policy if exists adm_select on admins;
create policy adm_select on admins for select to authenticated
  using (is_admin());
-- INSERT: manualmente pelo SQL Editor (você se torna admin uma vez).

-- ---------- medicamentos (catálogo compartilhado com moderação) ----------
drop policy if exists med_select on medicamentos;
create policy med_select on medicamentos for select to authenticated
  using (status = 'aprovado' or is_member(familia_id) or is_admin());

drop policy if exists med_insert on medicamentos;
create policy med_insert on medicamentos for insert to authenticated
  with check (is_admin() or (status = 'pendente' and is_member(familia_id)));

drop policy if exists med_update on medicamentos;
create policy med_update on medicamentos for update to authenticated
  using (is_admin() or (is_member(familia_id) and status = 'pendente'))
  with check (is_admin() or (is_member(familia_id) and status = 'pendente'));

drop policy if exists med_delete on medicamentos;
create policy med_delete on medicamentos for delete to authenticated
  using (is_admin() or (is_member(familia_id) and status = 'pendente'));

-- ---------- Tabelas de dados por família ----------
do $$
declare t text;
begin
  foreach t in array array['perfis','estoque','consumo','tratamentos','doses'] loop
    execute format('drop policy if exists %I on %I;', t || '_all', t);
    execute format(
      'create policy %I on %I for all to authenticated '
      || 'using (is_member(familia_id)) with check (is_member(familia_id));',
      t || '_all', t
    );
  end loop;
end $$;

-- ---------- push_subscriptions (por usuário) ----------
drop policy if exists push_all on push_subscriptions;
create policy push_all on push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
