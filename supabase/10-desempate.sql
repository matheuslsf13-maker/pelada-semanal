-- ============================================================
--  Pelada Semanal — como a partida fecha quando empata no fim
--  Rode no SQL Editor do Supabase (depois dos scripts 01 a 09).
--
--  A partida vai ate `target` games. O que acontece no 3x3 e escolha do
--  play, porque cada grupo joga de um jeito:
--
--    nenhum     quem chegar no alvo primeiro leva (era o unico jeito ate aqui)
--    vantagem   "vai a 2": segue ate abrir dois games -- 5x3, 6x4, 7x5
--    tie7       tie de 7 pontos corridos decide o game que fecha (4x3)
--    tie10      super tie de 10 pontos corridos (4x3)
--
--  `desempate_vai2` vale so para tie7/tie10: o proprio tie so fecha com dois
--  pontos de diferenca. Isso muda como se joga, nao o placar em games.
-- ============================================================

alter table public.sessions
  add column if not exists desempate text not null default 'nenhum';

alter table public.sessions
  drop constraint if exists sessions_desempate_check;

alter table public.sessions
  add constraint sessions_desempate_check
    check (desempate in ('nenhum', 'vantagem', 'tie7', 'tie10'));

alter table public.sessions
  add column if not exists desempate_vai2 boolean not null default false;

comment on column public.sessions.desempate is
  'o que fazer no empate em target-1: nenhum, vantagem (vai a 2), tie7 ou tie10';
comment on column public.sessions.desempate_vai2 is
  'tie7/tie10: o proprio tie tambem so fecha com 2 pontos de diferenca';

-- ------------------------------------------------------------
--  Um desempate por FASE, no formato grupos + duplas.
--  Mesma logica do `alvos`: [grupos, duplas fixas, semifinal, final].
--  Nulo = usa `desempate` em todas as fases, como nos outros formatos.
--  Aqui o "o tie tambem vai a 2" entra no proprio valor (tie7v2, tie10v2),
--  para cada fase caber num seletor so na tela.
-- ------------------------------------------------------------
alter table public.sessions
  add column if not exists desempates jsonb;

comment on column public.sessions.desempates is
  'grupos-duplas: desempate de cada fase [grupos, duplas, semi, final]; nulo = usa desempate';
