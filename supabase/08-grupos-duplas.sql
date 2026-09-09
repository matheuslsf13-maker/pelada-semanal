-- ============================================================
--  Pelada Semanal — formato "grupos + duplas"
--  Rode no SQL Editor do Supabase (depois dos scripts 01 a 07).
--
--  Fase 1: grupos EQUILIBRADOS entre si (mesma força média), todos com
--  todos dentro do grupo.
--  Fase 2: dupla FIXA por colocação — 1º com 1º de outro grupo, 2º com 2º,
--  e assim por diante. As duplas viram chaves e jogam só dentro da chave.
--  O pódio do dia sai apenas da fase 2.
-- ============================================================

alter table public.sessions
  drop constraint if exists sessions_format_check;

alter table public.sessions
  add constraint sessions_format_check
    check (format in ('todos', 'grupos', 'grupos-duplas'));

-- As duplas fixas da fase 2, na ordem de força. Nulo enquanto a fase 1 roda.
alter table public.sessions
  add column if not exists duos jsonb;

-- Quantas duplas cabem em cada chave da fase 2.
alter table public.sessions
  add column if not exists por_chave int;

-- 1 = fase de grupos, 2 = fase das duplas. Nulo/1 para os outros formatos.
alter table public.matches
  add column if not exists fase int not null default 1;

comment on column public.sessions.duos is
  'formato grupos-duplas: as duplas fixas da fase 2, na ordem de forca';
comment on column public.matches.fase is
  '1 = fase de grupos, 2 = fase das duplas fixas';
