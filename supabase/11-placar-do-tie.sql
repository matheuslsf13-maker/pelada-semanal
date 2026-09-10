-- ============================================================
--  O placar do proprio tie
--  Rode no SQL Editor do Supabase (depois dos scripts anteriores).
--
--  O tie decide o game que fecha, entao ele nao aparece no placar em games:
--  uma partida de 4 que foi ao tie fica 5x4 e pronto. So que "ganhou no tie
--  por 10x8" e parte do que aconteceu, e isso se perdia.
--
--  Guardamos so os pontos do PERDEDOR. Os do vencedor saem da regra, que e
--  sempre a mesma: chega no alvo do tie (7 ou 10), ou abre dois.
--  Nulo = a partida nao foi decidida no tie.
-- ============================================================

alter table public.matches
  add column if not exists tie int;

comment on column public.matches.tie is
  'pontos do perdedor no tie; o vencedor sai da regra (alvo do tie ou +2). Nulo = sem tie';
