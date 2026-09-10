-- ============================================================
--  A disputa de 3o lugar do mata-mata
--  Rode no SQL Editor do Supabase (depois dos scripts anteriores).
--
--  As duas duplas que perdem a semifinal jogam entre si. A partida fica na
--  MESMA fase da final e roda em paralelo com ela, na quadra ao lado --
--  por isso nao alonga a noite.
--
--  Ela precisa de marca propria: o app conta quantas partidas tem a fase
--  para saber que rodada e (1 jogo = final, 2 = semifinal). Sem a marca, a
--  fase da final teria duas partidas e viraria "semifinal" para o app.
-- ============================================================

alter table public.matches
  add column if not exists disputa_3o boolean not null default false;

comment on column public.matches.disputa_3o is
  'disputa de 3o lugar: fica na fase da final, mas nao conta como rodada da chave';
