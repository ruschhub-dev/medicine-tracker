-- ============================================================
-- Agendadores das notificações. Rode DEPOIS de 03_rpc.sql.
--
-- LEMBRETES DE VALIDADE: agendados pela VERCEL CRON (ver vercel.json,
--   "/api/enviar-lembretes" 1x/dia) — NÃO precisa de SQL.
--
-- LEMBRETES DE DOSE: a cada 15 min, via pg_cron + pg_net chamando a função
--   serverless. Configure abaixo. As duas funções agrupam por família sozinhas.
--
-- ANTES: no painel do Supabase, Database -> Extensions, ative "pg_cron" e "pg_net".
-- Depois troque SUA_URL_VERCEL e SEU_CRON_SECRET pelos valores do deploy NOVO.
-- ============================================================

select cron.schedule(
  'lembrete-doses',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := 'https://SUA_URL_VERCEL/api/enviar-doses',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SEU_CRON_SECRET'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Conferir:   select * from cron.job;
-- Remover:    select cron.unschedule('lembrete-doses');
