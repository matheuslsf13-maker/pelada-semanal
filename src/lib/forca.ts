import { ratings } from './stats'
import type { AppData } from './types'

/**
 * A FORCA: o nivel de verdade de cada atleta, agora visivel.
 *
 * O app sempre teve essa conta -- e ela que monta os grupos equilibrados e
 * escolhe as duplas --, so que rodava por baixo do pano. Aqui ela ganha um
 * numero e um nivel para aparecer na tela.
 *
 * NAO e o ranking do mes. O ranking soma pontos e zera todo mes; a forca e um
 * Elo que atravessa o ano inteiro e mede COM QUEM voce ganhou, nao quanto
 * jogou. Ganhar de quem esta melhor rende muito mais do que ganhar de quem
 * esta pior, e ganhar apertado rende pouco dos dois lados.
 *
 * A escala mostrada e a classica do Elo, com 1500 no meio. Isso nao e enfeite:
 * o Elo e SOMA ZERO -- o que um ganha o outro perde --, entao a media do grupo
 * fica sempre em 1500 e as faixas abaixo continuam querendo dizer a mesma coisa
 * no ano que vem. Medido numa temporada simulada de 12 noites com 16 atletas,
 * o grupo se espalhou de -107 a +91, e e dai que saem os limites.
 */

/** Como `ratings()` devolve (0 a 4, com 2 no meio) vira a escala do Elo. */
export const FORCA_MEDIA = 1500
const ESCALA = 110

export function notaDeForca(forca: number): number {
  return Math.round(FORCA_MEDIA + (forca - 2) * ESCALA)
}

export type NivelDeForca = {
  /** Diferenca minima para o meio do grupo. */
  de: number
  emoji: string
  titulo: string
  /** Nome do token de cor, para a etiqueta. */
  cor: string
}

export const NIVEIS_DE_FORCA: NivelDeForca[] = [
  { de: 75, emoji: '🚀', titulo: 'Topo do grupo', cor: 'var(--marca)' },
  { de: 25, emoji: '📈', titulo: 'Acima da média', cor: 'var(--verde)' },
  { de: -25, emoji: '⚖️', titulo: 'No pelotão', cor: 'var(--muted)' },
  { de: -75, emoji: '🎯', titulo: 'Em evolução', cor: 'var(--apoio)' },
  { de: -Infinity, emoji: '🌱', titulo: 'Começando', cor: 'var(--bronze)' },
]

export function nivelDeForca(nota: number): NivelDeForca {
  const dif = nota - FORCA_MEDIA
  return NIVEIS_DE_FORCA.find((n) => dif >= n.de) as NivelDeForca
}

/**
 * Abaixo disto o numero ainda e chute: poucas partidas, e uma noite ruim
 * mexe demais. A tela marca como provisoria em vez de esconder, porque
 * esconder faria parecer que o atleta nao conta para o equilibrio -- e conta.
 */
export const JOGOS_PARA_FIRMAR = 12

export type LinhaDeForca = {
  player_id: string
  nota: number
  jogos: number
  nivel: NivelDeForca
  provisoria: boolean
}

/**
 * Todo mundo por forca, do mais forte para o mais fraco.
 *
 * Quem nunca jogou fica de fora: a nota dele e exatamente a media, mas por
 * falta de informacao e nao por equilibrio -- lista-lo no meio do grupo seria
 * inventar um dado.
 */
export function rankingDeForca(
  data: AppData,
  nameOf: (id: string) => string,
  ate?: string,
): LinhaDeForca[] {
  const forcas = ratings(data, ate)
  const jogos = new Map<string, number>()
  for (const m of data.matches) {
    if (m.score_a === null || m.score_b === null) continue
    for (const id of [...m.team_a, ...m.team_b]) jogos.set(id, (jogos.get(id) ?? 0) + 1)
  }
  return data.players
    .filter((p) => (jogos.get(p.id) ?? 0) > 0)
    .map((p) => {
      const nota = notaDeForca(forcas.get(p.id) ?? 2)
      const n = jogos.get(p.id) ?? 0
      return {
        player_id: p.id,
        nota,
        jogos: n,
        nivel: nivelDeForca(nota),
        provisoria: n < JOGOS_PARA_FIRMAR,
      }
    })
    .sort((a, b) => b.nota - a.nota || nameOf(a.player_id).localeCompare(nameOf(b.player_id), 'pt-BR'))
}
