-- ============================================================
--  Forca inicial escolhida no cadastro
--  Rode no SQL Editor do Supabase (depois dos scripts anteriores).
--
--  De onde o Elo parte para cada pessoa, na escala de 1500. Vazio = 1500,
--  o meio da escala. Quem organiza pode dar um ponto de partida diferente
--  quando ja conhece o nivel de quem esta chegando -- sem isso toda
--  estreante entra empatada com todas as outras e os grupos saem no
--  sorteio, nao no nivel.
-- ============================================================

alter table public.players
  add column if not exists forca_inicial int;

alter table public.players
  drop constraint if exists players_forca_inicial_check;

alter table public.players
  add constraint players_forca_inicial_check
    check (forca_inicial is null or forca_inicial between 1200 and 1800);

comment on column public.players.forca_inicial is
  'ponto de partida do Elo (escala de 1500); vazio = 1500';
