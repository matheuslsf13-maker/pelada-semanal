/**
 * Nomes das chaves guardadas no navegador de quem usa o app.
 *
 * Ficam todas aqui porque, se um dia o campeonato mudar de nome e as chaves
 * mudarem junto, quem ja usava o app perderia o cache offline e -- pior -- a
 * FILA DE LANCAMENTOS feitos sem sinal. Trocar o prefixo exige renomear as
 * chaves antigas na primeira abertura, e este e o lugar de fazer isso.
 */

export const CHAVE = {
  /** Dados completos, no modo local (sem Supabase). */
  dados: 'pelada-semanal:v1',
  /** Escritas pendentes, que sobrevivem a refresh e a celular sem sinal. */
  fila: 'pelada-semanal:queue',
  /** Ultimo estado conhecido, para o app abrir offline. */
  cache: 'pelada-semanal:cache',
  /** Quais partidas entraram em quadra e quando. */
  emQuadra: 'pelada-semanal:em-quadra',
  /** Quando cada partida terminou (alimenta o "fora ha mais tempo"). */
  fimDasPartidas: 'pelada-semanal:fim-das-partidas',
  /** Modo diurno ou noturno escolhido por quem usa. */
  tema: 'pelada-semanal:tema',
} as const
