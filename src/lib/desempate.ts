/**
 * COMO A PARTIDA FECHA QUANDO EMPATA NO FIM
 *
 * A partida vai ate `alvo` games. O que fazer quando as duas duplas chegam em
 * `alvo-1` -- o 3x3 de uma partida de 4 -- e escolha do play, e sao tres:
 *
 *   alvo           quem chegar ao alvo primeiro leva: 3x3 vira 4x3.
 *   vantagem       "vai a 2": segue jogando ate abrir DOIS games, sem teto.
 *                  4x0, 4x1, 4x2, 5x3, 6x4, 7x5, e por ai.
 *   vantagem-tie   vai a 2 ate o `alvo` x `alvo`; dali um tie decide. Numa
 *                  partida de 6: 5x5 vai a 2 e fecha em 7x5, 6x6 vai para o
 *                  tie e fecha em 7x6. Este e o unico modo com TETO -- o
 *                  "vai a 2" puro pode se arrastar e travar a quadra.
 *
 * O TIE SEMPRE VAI A 2 (7x5 vale, 7x6 nao). Nao existe escolha para isso:
 * e assim que o grupo joga, e uma opcao a menos e uma tela mais simples.
 * O que da para escolher e o tamanho: 7 pontos ou o super tie de 10.
 *
 * O QUE ISSO MUDA NO APP. So a vantagem mexe no placar que da para lancar,
 * porque e a unica em que o vencedor passa do alvo. O tie decide o game que
 * fecha, entao ele nunca aparece no placar em games -- muda a regra que a
 * organizacao combina com a quadra, nao o que se digita.
 */

/** O que acontece no `alvo-1` x `alvo-1`. */
export type Modo = 'alvo' | 'vantagem' | 'vantagem-tie'
/** Tamanho do tie que decide, quando existe. */
export type Tie = 7 | 10

export type Regra = {
  modo: Modo
  tie: Tie
  /**
   * Formato antigo, mantido so para os plays ja gravados: o tie caia direto
   * no `alvo-1` x `alvo-1`, sem passar pelo "vai a 2". Nao aparece mais na
   * tela, mas um play gravado assim continua sendo lido e explicado certo.
   */
  tieDireto?: boolean
}

export const REGRA_PADRAO: Regra = { modo: 'alvo', tie: 7 }

/* -------------------------------------------------------------------------
   O texto guardado no banco -- um campo so, para caber tambem no seletor de
   cada fase do grupos+duplas.
   ------------------------------------------------------------------------- */

export function lerRegra(v?: string | null): Regra {
  if (!v || v === 'nenhum') return { ...REGRA_PADRAO }
  // o sufixo `v2` era a escolha de "o tie vai a 2"; hoje isso e sempre verdade
  const limpo = v.endsWith('v2') ? v.slice(0, -2) : v
  if (limpo === 'vantagem') return { modo: 'vantagem', tie: 7 }
  if (limpo === 'vantagem-tie7') return { modo: 'vantagem-tie', tie: 7 }
  if (limpo === 'vantagem-tie10') return { modo: 'vantagem-tie', tie: 10 }
  // plays gravados antes, com o tie caindo direto no empate
  if (limpo === 'tie7') return { modo: 'vantagem-tie', tie: 7, tieDireto: true }
  if (limpo === 'tie10') return { modo: 'vantagem-tie', tie: 10, tieDireto: true }
  return { ...REGRA_PADRAO }
}

export function escreverRegra(r: Regra): string {
  if (r.modo === 'alvo') return 'nenhum'
  if (r.modo === 'vantagem') return 'vantagem'
  return `vantagem-tie${r.tie}`
}

/** A partida tem teto, ou o "vai a 2" pode se arrastar? */
export function temTeto(r: Regra): boolean {
  return r.modo === 'vantagem-tie'
}

/* -------------------------------------------------------------------------
   Os placares possiveis
   ------------------------------------------------------------------------- */

/**
 * Quantos games o VENCEDOR fez, dado quanto o perdedor fez.
 *
 * Com o tie direto (formato antigo) o vencedor e sempre o alvo, porque o tie
 * decide o game que fecha. Nos outros, empatar em `alvo-1` nao encerra:
 *   - sem teto, segue ate abrir dois: 3 do perdedor viram 5x3, 4 viram 6x4;
 *   - com teto, a partida acaba em `alvo+1`: numa de 6, 5x5 vira 7x5 e o
 *     6x6, decidido no tie, vira 7x6.
 */
export function gamesDoVencedor(alvo: number, r: Regra, doPerdedor: number): number {
  if (r.modo === 'alvo' || r.tieDireto) return alvo
  if (doPerdedor <= alvo - 2) return alvo
  return temTeto(r) ? alvo + 1 : doPerdedor + 2
}

/**
 * Os games que o perdedor pode ter feito, para os botoes do placar.
 *
 * Com teto a lista para em `alvo` -- alem dali a partida nao existe. Sem teto
 * o limite de `alvo + 3` e pratico: uma partida de 4 que chega a 7x5 ja e
 * longa demais para uma noite de rodizio, e se acontecer o modal de corrigir
 * o placar aceita qualquer numero.
 */
export function gamesDoPerdedor(alvo: number, r: Regra): number[] {
  if (r.modo === 'alvo' || r.tieDireto) return faixa(alvo - 1)
  return faixa(temTeto(r) ? alvo : alvo + 3)
}

function faixa(ate: number): number[] {
  return Array.from({ length: Math.max(1, ate + 1) }, (_, n) => n)
}

/* -------------------------------------------------------------------------
   As opcoes da tela
   ------------------------------------------------------------------------- */

export const MODOS: { valor: Modo; rotulo: string }[] = [
  { valor: 'alvo', rotulo: '🎾 Quem chegar leva' },
  { valor: 'vantagem', rotulo: '➕ Só vai a 2' },
  { valor: 'vantagem-tie', rotulo: '➕🎯 Vai a 2 e depois tie' },
]

export const TIES: { valor: Tie; rotulo: string }[] = [
  { valor: 7, rotulo: '7️⃣ Tie de 7' },
  { valor: 10, rotulo: '🔟 Super tie de 10' },
]

/** A lista achatada, para o seletor de UMA linha de cada fase. */
export const OPCOES_DE_FASE: { valor: string; rotulo: string }[] = [
  { valor: 'nenhum', rotulo: '🎾 Quem chegar leva' },
  { valor: 'vantagem', rotulo: '➕ Só vai a 2, sem teto' },
  { valor: 'vantagem-tie7', rotulo: '➕7️⃣ Vai a 2 e, no limite, tie de 7' },
  { valor: 'vantagem-tie10', rotulo: '➕🔟 Vai a 2 e, no limite, super tie' },
]

/* -------------------------------------------------------------------------
   Como contar isso para quem esta na quadra
   ------------------------------------------------------------------------- */

/** A regra inteira, em uma frase. */
export function explicarRegra(alvo: number, r: Regra): string {
  const empate = `${alvo - 1}x${alvo - 1}`
  const inicio = `Partida até ${alvo} games`
  const nome = r.tie === 10 ? 'super tie' : 'tie'

  if (r.modo === 'alvo') return `${inicio}, sem empate: quem chegar a ${alvo} primeiro leva.`

  if (r.tieDireto) {
    return (
      `${inicio}. No ${empate} sai um ${nome} de ${r.tie} pontos, que só fecha com dois ` +
      `de diferença. Quem vence o tie fecha em ${alvo}x${alvo - 1}.`
    )
  }

  if (r.modo === 'vantagem') {
    return (
      `${inicio}. No ${empate} ninguém fecha: segue jogando até abrir dois games — ` +
      `${alvo + 1}x${alvo - 1}, ${alvo + 2}x${alvo}, e por aí.`
    )
  }

  return (
    `${inicio}. No ${empate} segue até abrir dois games, então ${alvo + 1}x${alvo - 1} fecha. ` +
    `Se chegar a ${alvo}x${alvo}, um ${nome} de ${r.tie} pontos decide — também com dois de ` +
    `diferença — e a partida fica ${alvo + 1}x${alvo}.`
  )
}

/** Uma linha curta, para o `hint` embaixo do seletor de cada fase. */
export function resumoDaFase(alvo: number, valor: string): string {
  const r = lerRegra(valor)
  const empate = `${alvo - 1}x${alvo - 1}`
  if (r.modo === 'alvo') return `até ${alvo}, quem chegar primeiro leva`
  if (r.tieDireto) return `até ${alvo}, e no ${empate} sai um tie de ${r.tie}`
  if (r.modo === 'vantagem') return `até ${alvo}, e no ${empate} segue até abrir 2`
  return `até ${alvo}, vai a 2 e, no ${alvo}x${alvo}, tie de ${r.tie}`
}
