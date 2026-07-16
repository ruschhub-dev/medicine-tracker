-- ============================================================
-- Recursos Premium com reforço no banco.
-- Bloco 1 (lembretes de dose): só famílias PREMIUM criam tratamentos.
-- Ver/alterar/apagar os já existentes continua liberado para os membros
-- (não perde dados se a assinatura vencer). Rode DEPOIS de 05_assinaturas.sql.
-- Idempotente.
-- ============================================================

drop policy if exists tratamentos_all on tratamentos;

drop policy if exists tratamentos_select on tratamentos;
create policy tratamentos_select on tratamentos for select to authenticated
  using (is_member(familia_id));

drop policy if exists tratamentos_insert on tratamentos;
create policy tratamentos_insert on tratamentos for insert to authenticated
  with check (is_member(familia_id) and is_premium(familia_id));

drop policy if exists tratamentos_update on tratamentos;
create policy tratamentos_update on tratamentos for update to authenticated
  using (is_member(familia_id)) with check (is_member(familia_id));

drop policy if exists tratamentos_delete on tratamentos;
create policy tratamentos_delete on tratamentos for delete to authenticated
  using (is_member(familia_id));

-- Observação: as demais travas (relatório de aderência, export CSV, e-mail de
-- lembrete) são de exibição/entrega e ficam no app/servidor — não precisam de RLS.
