/**
 * COMO A PARTIDA FECHA QUANDO EMPATA NO FIM
 *
 * A partida vai ate `alvo` games. O que fazer quando as duas duplas chegam
 * juntas no fim e escolha do play, e cada grupo joga de um jeito. Sao duas
 * perguntas encadeadas:
 *
 *   1) No `alvo-1` x `alvo-1` (o 3x3 de uma partida de 4):
 *        alvo       quem chegar ao alvo primeiro leva -- 4x3 e vitoria
 *        vantagem   "vai a 2": segue jogando ate abrir DOIS games
 *        tie7       sai um tie de 7 pontos corridos
 *        tie10      sai um super tie de 10 pontos corridos
 *
 *   2) So quando a primeira e `vantagem`, o jogo pode chegar a `alvo` x `alvo`
 *      (o 6x6 de uma partida de 6). Ai:
 *        sem        nada muda, segue ate abrir dois -- a partida nao tem teto
 *        tie7       um tie de 7 decide
 *        tie10      um super tie de 10 decide
 *
 * E o `tieVai2` diz que o proprio TIE so fecha com dois pontos de diferenca
 * (7x5 sim, 7x6 nao).
 *
 * O QUE ISSO MUDA NO APP. So a `vantagem` mexe no placar que da para lancar,
 * porque e a unica em que o vencedor passa do alvo. O tie decide o game que
 * fecha, entao com tie o placar continua sendo `alvo` x `alvo-1` (ou, com
 * vantagem + teto, `alvo+1` x `alvo`). Nas outras a configuracao so muda a
 * regra anunciada na tela -- o que ja e util, porque e o que a organizacao
 * combina com a quadra antes de comecar.
 */

/** No `alvo-1` x `alvo-1`. */
export type NoEmpate = 'alvo' | 'vantagem' | 'tie7' | 'tie10'
/** No `alvo` x `alvo`, quando a primeira escolha foi `vantagem`. */
export type NoTeto = 'sem' | 'tie7' | 'tie10'

export type Regra = {
  no1: NoEmpate
  teto: NoTeto
  tieVai2: boolean
}

export const REGRA_PADRAO: Regra = { no1: 'alvo', teto: 'sem', tieVai2: false }

/* -------------------------------------------------------------------------
   O texto guardado no banco.

   Um campo so, para caber tambem num `<select>` por fase. O formato aceita o
   que as versoes anteriores gravaram (`nenhum`, `vantagem`, `tie7`, `tie7v2`,
   `tie10`, `tie10v2`), entao nenhum play antigo precisa ser migrado.
   ------------------------------------------------------------------------- */

export function lerRegra(v?: string | null): Regra {
  if (!v || v === 'nenhum') return { ...REGRA_PADRAO }
  const tieVai2 = v.endsWith('v2')
  const limpo = tieVai2 ? v.slice(0, -2) : v
  if (limpo === 'vantagem') return { no1: 'vantagem', teto: 'sem', tieVai2: false }
  if (limpo === 'tie7' || limpo === 'tie10') return { no1: limpo, teto: 'sem', tieVai2 }
  if (limpo === 'vantagem-tie7') return { no1: 'vantagem', teto: 'tie7', tieVai2 }
  if (limpo === 'vantagem-tie10') return { no1: 'vantagem', teto: 'tie10', tieVai2 }
  return { ...REGRA_PADRAO }
}

export function escreverRegra(r: Regra): string {
  const sufixo = r.tieVai2 && temTie(r) ? 'v2' : ''
  if (r.no1 === 'alvo') return 'nenhum'
  if (r.no1 === 'vantagem') {
    return r.teto === 'sem' ? 'vantagem' : `vantagem-${r.teto}${sufixo}`
  }
  return `${r.no1}${sufixo}`
}

/** A regra usa tie em algum momento? */
export function temTie(r: Regra): boolean {
  return r.no1 === 'tie7' || r.no1 === 'tie10' || r.teto === 'tie7' || r.teto === 'tie10'
}

/** Quantos pontos tem o tie que decide; 0 quando a regra nao usa tie. */
export function pontosDoTie(r: Regra): number {
  const qual = r.no1 === 'tie7' || r.no1 === 'tie10' ? r.no1 : r.teto
  return qual === 'tie7' ? 7 : qual === 'tie10' ? 10 : 0
}

/** A vantagem tem teto (um tie que encerra), ou pode se arrastar? */
export function temTeto(r: Regra): boolean {
  return r.no1 === 'vantagem' && r.teto !== 'sem'
}

/* -------------------------------------------------------------------------
   Os placares possiveis
   ------------------------------------------------------------------------- */

/**
 * Quantos games o VENCEDOR fez, dado quanto o perdedor fez.
 *
 * Sem vantagem o vencedor e sempre o alvo. Com vantagem, empatar em `alvo-1`
 * nao encerra -- e ai:
 *   - sem teto, segue ate abrir dois: 3 do perdedor viram 5x3, 4 viram 6x4;
 *   - com teto, a partida acaba em `alvo+1`: numa de 6, o 5x5 vira 7x5 e o
 *     6x6 (decidido no tie) vira 7x6.
 */
export function gamesDoVencedor(alvo: number, r: Regra, doPerdedor: number): number {
  if (r.no1 !== 'vantagem') return alvo
  if (doPerdedor <= alvo - 2) return alvo
  return temTeto(r) ? alvo + 1 : doPerdedor + 2
}

/**
 * Os games que o perdedor pode ter feito, para os botoes do placar.
 *
 * Com teto a lista para em `alvo` -- alem dali a partida nao existe. Sem teto
 * o limite de `alvo + 3` e pratico: uma partida de 4 que chega a 7x5 ja e longa
 * demais para uma noite de rodizio, e se acontecer o botao de corrigir o placar
 * aceita qualquer numero.
 */
export function gamesDoPerdedor(alvo: number, r: Regra): number[] {
  if (r.no1 !== 'vantagem') return faixa(alvo - 1)
  return faixa(temTeto(r) ? alvo : alvo + 3)
}

function faixa(ate: number): number[] {
  return Array.from({ length: Math.max(1, ate + 1) }, (_, n) => n)
}

/* -------------------------------------------------------------------------
   As opcoes da tela
   ------------------------------------------------------------------------- */

export const OPCOES_NO_EMPATE: { valor: NoEmpate; rotulo: string }[] = [
  { valor: 'alvo', rotulo: '🎾 Quem chegar leva' },
  { valor: 'vantagem', rotulo: '➕ Vai a 2' },
  { valor: 'tie7', rotulo: '7️⃣ Tie de 7' },
  { valor: 'tie10', rotulo: '🔟 Super tie' },
]

export const OPCOES_NO_TETO: { valor: NoTeto; rotulo: string }[] = [
  { valor: 'sem', rotulo: '➕ Segue até abrir 2' },
  { valor: 'tie7', rotulo: '7️⃣ Tie de 7' },
  { valor: 'tie10', rotulo: '🔟 Super tie de 10' },
]

/** A lista achatada, para o seletor de UMA linha de cada fase. */
export const OPCOES_DE_FASE: { valor: string; rotulo: string }[] = [
  { valor: 'nenhum', rotulo: '🎾 Quem chegar leva' },
  { valor: 'vantagem', rotulo: '➕ Vai a 2, sem teto' },
  { valor: 'tie7', rotulo: '7️⃣ Tie de 7' },
  { valor: 'tie7v2', rotulo: '7️⃣ Tie de 7, indo a 2' },
  { valor: 'tie10', rotulo: '🔟 Super tie de 10' },
  { valor: 'tie10v2', rotulo: '🔟 Super tie, indo a 2' },
  { valor: 'vantagem-tie7', rotulo: '➕7️⃣ Vai a 2 e, no limite, tie de 7' },
  { valor: 'vantagem-tie7v2', rotulo: '➕7️⃣ Vai a 2 e tie de 7 indo a 2' },
  { valor: 'vantagem-tie10', rotulo: '➕🔟 Vai a 2 e, no limite, super tie' },
  { valor: 'vantagem-tie10v2', rotulo: '➕🔟 Vai a 2 e super tie indo a 2' },
]

/* -------------------------------------------------------------------------
   Como contar isso para quem esta na quadra
   ------------------------------------------------------------------------- */

/** A regra inteira, em uma frase. */
export function explicarRegra(alvo: number, r: Regra): string {
  const empate = `${alvo - 1}x${alvo - 1}`
  const inicio = `Partida até ${alvo} games`

  if (r.no1 === 'alvo') return `${inicio}, sem empate: quem chegar a ${alvo} primeiro leva.`

  if (r.no1 === 'tie7' || r.no1 === 'tie10') {
    return (
      `${inicio}. No ${empate} sai um ${nomeDoTie(r)} de ${pontosDoTie(r)} pontos corridos` +
      (r.tieVai2
        ? ', que também só fecha com dois pontos de diferença'
        : ` — quem chegar a ${pontosDoTie(r)} leva`) +
      `. Quem vence o tie fecha em ${alvo}x${alvo - 1}.`
    )
  }

  // vantagem
  if (r.teto === 'sem') {
    return (
      `${inicio}. No ${empate} ninguém fecha: segue jogando até abrir dois games — ` +
      `${alvo + 1}x${alvo - 1}, ${alvo + 2}x${alvo}, e por aí.`
    )
  }
  return (
    `${inicio}. No ${empate} segue até abrir dois games, então ${alvo + 1}x${alvo - 1} fecha. ` +
    `Se chegar a ${alvo}x${alvo}, um ${nomeDoTie(r)} de ${pontosDoTie(r)} pontos decide` +
    (r.tieVai2 ? ', também com dois pontos de diferença,' : '') +
    ` e a partida fica ${alvo + 1}x${alvo}.`
  )
}

function nomeDoTie(r: Regra): string {
  return pontosDoTie(r) === 10 ? 'super tie' : 'tie'
}

/** Uma linha curta, para o `hint` embaixo do seletor de cada fase. */
export function resumoDaFase(alvo: number, valor: string): string {
  const r = lerRegra(valor)
  if (r.no1 === 'alvo') return `até ${alvo}, quem chegar primeiro leva`
  if (r.no1 === 'vantagem' && r.teto === 'sem') {
    return `até ${alvo}, e no ${alvo - 1}x${alvo - 1} segue até abrir 2`
  }
  if (r.no1 === 'vantagem') {
    return `até ${alvo}, vai a 2 e, no ${alvo}x${alvo}, tie de ${pontosDoTie(r)}${r.tieVai2 ? ' indo a 2' : ''}`
  }
  return `até ${alvo}, e no ${alvo - 1}x${alvo - 1} sai um tie de ${pontosDoTie(r)}${r.tieVai2 ? ' indo a 2' : ''}`
}
