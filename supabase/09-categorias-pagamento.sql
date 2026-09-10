-- ============================================================
--  Pelada Semanal — como cada atleta paga
--  Rode no SQL Editor do Supabase (depois dos scripts 01 a 08).
--
--  Sao tres categorias, e a regra de cada uma mora em
--  `src/lib/mensalidade.ts`:
--
--    mensalista  paga por mes. Fica liberado enquanto `pago_mes` for o mes
--                de hoje, entao na VIRADA DO MES ele volta a aparecer
--                devendo sozinho -- nao existe rotina para rodar, esquecer
--                de rodar ou rodar duas vezes.
--    avulso      paga por play. `pago_avulso` e um credito de UMA
--                participacao, gasto quando aquele play e finalizado.
--    convidado   nao paga. Dois plays seguidos so acendem um alerta; nao
--                travam nada, porque quem decide isso e a organizacao.
-- ============================================================

alter table public.players
  add column if not exists categoria text not null default 'mensalista';

alter table public.players
  drop constraint if exists players_categoria_check;

alter table public.players
  add constraint players_categoria_check
    check (categoria in ('mensalista', 'avulso', 'convidado', 'isento'));

-- Mensalista: ate que mes esta pago, no formato AAAA-MM.
alter table public.players
  add column if not exists pago_mes text;

-- Avulso: credito de uma participacao.
alter table public.players
  add column if not exists pago_avulso boolean not null default false;

comment on column public.players.categoria is
  'como o atleta paga: mensalista, avulso, convidado (nao paga) ou isento (nao paga e nao alerta)';
comment on column public.players.pago_mes is
  'mensalista: ate que mes esta pago (AAAA-MM). Comparado com o mes de hoje';
comment on column public.players.pago_avulso is
  'avulso: credito de UMA participacao, gasto ao finalizar o play';

-- ------------------------------------------------------------
--  Quarta categoria: isento.
--  Nao paga e nunca vira alerta -- para quem tem acordo permanente, e para
--  o grupo que simplesmente nao cobra (todo mundo isento, portao desligado).
--  Rode de novo mesmo se ja rodou: o `drop constraint if exists` acima cuida.
-- ------------------------------------------------------------
