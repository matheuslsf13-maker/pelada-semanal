/**
 * Dados do projeto Supabase.
 *
 * Este e o projeto PROPRIO da Pelada Semanal (`hmbankpjvkmlcyzwgtbl`), separado
 * do campeonato feminino de proposito.
 *
 * Compartilhar um banco entre dois campeonatos parece inofensivo -- "sao pessoas
 * diferentes" -- mas o app nao sabe o que e campeonato: ele assume um banco =
 * um campeonato. Juntar os dois misturaria o ranking do mes, a lista de
 * jogadores e a lista de plays, e cada play de um zeraria as sequencias 🔥 do
 * outro, porque quem nao sobe ao podio perde o status.
 *
 * Deixando as duas constantes em branco, o app volta para o MODO LOCAL: tudo
 * guardado so no navegador de quem abriu.
 *
 * Onde achar: painel do Supabase -> Project Settings -> API
 *   SUPABASE_URL      = "Project URL"        (https://xxxx.supabase.co)
 *   SUPABASE_ANON_KEY = chave "publishable"  (sb_publishable_... ou anon eyJ...)
 *
 * Pode commitar sem medo: a chave publicavel e publica por natureza -- ela vai
 * dentro do JavaScript do site publicado de qualquer jeito. Quem protege os
 * dados sao as politicas de RLS criadas por supabase/schema.sql: qualquer
 * pessoa com o link LE o ranking, mas so quem tem login ESCREVE.
 *
 * NUNCA coloque aqui a chave "secret" / "service_role": ela ignora todas as
 * regras de permissao do banco e nao pode ir para o site.
 *
 * As variaveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY tem
 * prioridade sobre estes valores.
 */
export const SUPABASE_URL = 'https://hmbankpjvkmlcyzwgtbl.supabase.co'
export const SUPABASE_ANON_KEY = 'sb_publishable_A2E5WE7OP_y_Iir_Tm6_yA_8Izx5uhL'
