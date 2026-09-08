/**
 * Dados do projeto Supabase.
 *
 * EM BRANCO DE PROPOSITO. Enquanto estiver assim o app roda em MODO LOCAL: tudo
 * fica guardado no navegador de quem abriu, e nada e compartilhado. Da para usar
 * assim para testar sem depender de nada.
 *
 * Para o grupo inteiro enxergar o mesmo ranking, crie um projeto Supabase
 * PROPRIO deste campeonato e preencha abaixo. Nao aponte para o banco de outro
 * campeonato: os dois passariam a dividir jogadores, partidas e ranking.
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
export const SUPABASE_URL = ''
export const SUPABASE_ANON_KEY = ''
