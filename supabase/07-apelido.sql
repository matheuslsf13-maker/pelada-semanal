-- Apelido: como o jogador aparece na quadra.
--
-- `name` continua sendo o nome de CADASTRO (completo), que serve para conferir
-- a lista sem confundir duas Anas. `nickname` e o nome curto que aparece nos
-- rankings, nas partidas, nos textos do WhatsApp e nas artes.
--
-- Vazio (null) quer dizer "usa o nome do cadastro", entao ninguem precisa
-- preencher: quem nao tem apelido continua exatamente como esta.

alter table public.players
  add column if not exists nickname text;
