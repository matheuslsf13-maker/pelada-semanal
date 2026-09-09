/**
 * COMO A PARTIDA FECHA QUANDO EMPATA NO FIM
 *
 * A partida vai ate `alvo` games (o padrao e 4). O que fazer quando as duas
 * duplas chegam em `alvo - 1` -- o famoso 3x3 -- e escolha do play, e cada
 * grupo joga de um jeito:
 *
 *   nenhum      quem chegar no alvo primeiro leva. E o que o app sempre fez:
 *               3x3 vira 4x3 no proximo game.
 *   vantagem    "vai a 2": segue jogando ate abrir DOIS games. O placar passa
 *               do alvo -- 5x3, 6x4, 7x5 -- e por isso este e o unico modo
 *               que muda o que da para lancar.
 *   tie7        no 3x3 joga um tie de 7 pontos corridos. Quem vence o tie leva
 *               o game que fecha, entao a partida fica 4x3.
 *   tie10       o super tie, de 10 pontos corridos. Mesma coisa: 4x3.
 *
 * `vai2` vale so para tie7/tie10 e diz que o TIE tambem so fecha com dois
 * pontos de diferenca (7x5 sim, 7x6 nao). Isso muda como se joga, nao o placar
 * em games -- o app so precisa avisar a regra certa na tela.
 */

export type Desempate = 'nenhum' | 'vantagem' | 'tie7' | 'tie10'

export const DESEMPATES: { valor: Desempate; rotulo: string; curto: string }[] = [
  { valor: 'nenhum', rotulo: '🎾 Sem desempate', curto: 'quem chega no alvo primeiro leva' },
  { valor: 'vantagem', rotulo: '➕ Vai a 2', curto: 'segue até abrir 2 games' },
  { valor: 'tie7', rotulo: '7️⃣ Tie de 7', curto: '7 pontos corridos decidem' },
  { valor: 'tie10', rotulo: '🔟 Super tie', curto: '10 pontos corridos decidem' },
]

export function desempateDe(v?: string | null): Desempate {
  return v === 'vantagem' || v === 'tie7' || v === 'tie10' ? v : 'nenhum'
}

/** Quantos pontos tem o tie deste modo; 0 quando o modo nao usa tie. */
export function pontosDoTie(modo: Desempate): number {
  return modo === 'tie7' ? 7 : modo === 'tie10' ? 10 : 0
}

/**
 * Os games que o perdedor pode ter feito, para os botoes do placar.
 *
 * So o "vai a 2" passa do alvo. O limite de `alvo + 3` e pratico: uma partida
 * de 4 que chega em 7x5 ja e longa demais para uma noite de rodizio, e se
 * acontecer o ✏️ de corrigir o placar aceita qualquer numero.
 */
export function gamesDoPerdedor(alvo: number, modo: Desempate): number[] {
  const ate = modo === 'vantagem' ? alvo + 3 : alvo - 1
  return Array.from({ length: Math.max(1, ate + 1) }, (_, n) => n)
}

/**
 * Quantos games o VENCEDOR fez, dado quanto o perdedor fez.
 *
 * No "vai a 2", empatar no alvo - 1 nao encerra: o jogo segue ate a diferenca
 * de dois, entao 3 games do perdedor viram 5x3.
 */
export function gamesDoVencedor(alvo: number, modo: Desempate, doPerdedor: number): number {
  if (modo !== 'vantagem') return alvo
  return doPerdedor <= alvo - 2 ? alvo : doPerdedor + 2
}

/** Um placar valido para este modo? Serve para a correcao manual. */
export function placarValido(alvo: number, modo: Desempate, a: number, b: number): boolean {
  if (a === b) return false
  const vencedor = Math.max(a, b)
  const perdedor = Math.min(a, b)
  return vencedor === gamesDoVencedor(alvo, modo, perdedor)
}

/** A regra em uma frase, para a tela de criar e o cabecalho do play. */
export function explicarDesempate(alvo: number, modo: Desempate, vai2: boolean): string {
  const empate = `${alvo - 1}x${alvo - 1}`
  if (modo === 'vantagem') {
    return (
      `Partida até ${alvo} games. No ${empate} ninguém fecha: segue jogando até abrir ` +
      `dois games — ${alvo + 1}x${alvo - 1}, ${alvo + 2}x${alvo}, e por aí.`
    )
  }
  if (modo === 'tie7' || modo === 'tie10') {
    const pontos = pontosDoTie(modo)
    const nome = modo === 'tie10' ? 'super tie' : 'tie'
    return (
      `Partida até ${alvo} games. No ${empate} sai um ${nome} de ${pontos} pontos corridos` +
      (vai2
        ? `, que também só fecha com dois pontos de diferença`
        : ` — quem chegar a ${pontos} leva`) +
      `. Quem vence o tie fecha em ${alvo}x${alvo - 1}.`
    )
  }
  return `Partida até ${alvo} games, sem empate: quem chegar a ${alvo} primeiro leva.`
}
