import { buildHistory, pairKey, type History } from './stats'
import type { Match } from './types'
import { uid } from './types'

/**
 * COMO O DIA E MONTADO
 *
 * O play nao tem mais rodadas. As quadras nunca terminam juntas -- uma partida
 * acaba enquanto a outra ainda esta rolando -- entao esperar a rodada inteira
 * so deixava quadra parada. Em vez disso o app gera uma FILA de partidas e, a
 * cada quadra que vaga, escolhe da fila a partida cujos jogadores estao livres
 * e estao fora ha mais tempo (ver `proximasDasQuadras`).
 *
 * A fila cobre o rodizio completo: cada jogador faz dupla com cada um dos
 * outras exatamente uma vez. No modo em grupos, esse mesmo rodizio acontece
 * dentro de cada grupo -- os pontos continuam individuais e o ranking do dia
 * e unico.
 *
 * QUEM ENFRENTA QUEM tambem e escolhido, nao e sobra do sorteio. Nao da para
 * "nunca se enfrentar": num grupo de 8 sao 28 duplas, 14 partidas e 56
 * confrontos individuais para so 28 pares possiveis -- na media cada par se
 * cruza duas vezes. Entao o alvo e espalhar por igual, e a adversaria
 * escolhida e sempre a dupla que MENOS se enfrentou com essa ate agora
 * (`custoDoConfronto`).
 */

export type PlannedMatch = {
  team_a: [string, string]
  team_b: [string, string]
  /** Indice do grupo (0 = grupo 1). Fora do modo em grupos e sempre 0. */
  grupo: number
  /** 1 = fase de grupos, 2 = fase das duplas fixas. Ausente conta como 1. */
  fase?: number
  /**
   * Dupla que joga uma segunda vez porque sobrou uma dupla sem adversaria.
   * Acontece so quando o total de combinacoes do grupo e impar.
   */
  repetida?: boolean
}

type Duo = [string, string]

const W_BALANCE = 30 // por ponto de diferenca de forca entre as duas duplas
const W_OPP_DIA = 50 // por vez que essas duas ja se enfrentaram HOJE
const W_OPP_HIST = 12 // por vez que ja se enfrentaram em plays anteriores
const W_REPETIDA = 400 // dupla que precisou jogar duas vezes

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function jogadoresDaPartida(m: { team_a: Duo; team_b: Duo }): string[] {
  return [m.team_a[0], m.team_a[1], m.team_b[0], m.team_b[1]]
}

function disjuntas(a: Duo, b: Duo): boolean {
  return a[0] !== b[0] && a[0] !== b[1] && a[1] !== b[0] && a[1] !== b[1]
}

/* ------------------------------------------------------------------
   Grupos por nivel

   O grupo 1 leva as mais bem pontuadas do historico, o 2 as seguintes, e
   assim por diante -- os jogos ficam mais parelhos dentro de cada grupo.
   ------------------------------------------------------------------ */

/** Quantos grupos cabem, dado o tamanho pedido. Cada grupo precisa de 4+. */
export function numeroDeGrupos(jogadores: number, tamanho: number): number {
  if (jogadores < 8 || tamanho < 4) return 1
  const alvo = Math.max(1, Math.round(jogadores / tamanho))
  return Math.max(1, Math.min(alvo, Math.floor(jogadores / 4)))
}

/** Tamanho de cada grupo, o mais parecido possivel entre eles. */
export function tamanhosDosGrupos(jogadores: number, grupos: number): number[] {
  const base = Math.floor(jogadores / grupos)
  const resto = jogadores % grupos
  // a sobra vai para os primeiros grupos, que sao os de nivel mais alto
  return Array.from({ length: grupos }, (_, i) => base + (i < resto ? 1 : 0))
}

/**
 * Grupos EQUILIBRADOS entre si, para o formato `grupos-duplas`.
 *
 * Diferente do `formarGrupos`, onde o grupo 1 leva os melhores de proposito.
 * Aqui os grupos precisam ter a mesma forca media, senao a fase 2 nao e justa:
 * "1o com 1o" so faz sentido se ser 1o custar o mesmo em qualquer grupo.
 *
 * A distribuicao e em serpentina -- com a lista ordenada por forca, entrega
 * 1-2-3-4, depois 4-3-2-1, depois 1-2-3-4. Assim cada grupo recebe um de cada
 * faixa e as medias saem praticamente iguais.
 */
export function gruposEquilibrados(
  playerIds: string[],
  ratings: Map<string, number>,
  tamanho: number,
): string[][] {
  const grupos = numeroDeGrupos(playerIds.length, tamanho)
  if (grupos <= 1) return [playerIds.slice()]
  const ordenados = [...playerIds].sort((a, b) => (ratings.get(b) ?? 2) - (ratings.get(a) ?? 2))
  const out: string[][] = Array.from({ length: grupos }, () => [])
  ordenados.forEach((id, i) => {
    const volta = Math.floor(i / grupos)
    const pos = i % grupos
    out[volta % 2 === 0 ? pos : grupos - 1 - pos].push(id)
  })
  return out
}

/** Como um jogador terminou a fase de grupos. */
export type Colocacao = {
  id: string
  /** Indice do grupo (0 = grupo 1). */
  grupo: number
  /** 1 = primeiro do grupo. */
  posicao: number
  pontos: number
  saldo: number
}

/**
 * FASE 2 -- as duplas fixas.
 *
 * Ordena todos por colocacao no grupo (os 1os primeiro, depois os 2os...) e,
 * dentro da mesma colocacao, por desempenho. Depois junta os VIZINHOS dessa
 * fila: melhor com melhor, medio com medio, ultimo com ultimo.
 *
 * Emparelhar vizinhos, e nao "1o com 1o" ao pe da letra, e o que faz a conta
 * fechar quando o numero de grupos e impar: o 1o que sobra vira dupla com o
 * melhor dos 2os -- que e o vizinho dele na fila, e nao alguem de outro nivel.
 *
 * A restricao e nao repetir grupo: quem ja jogou junto a fase 1 inteira nao
 * deve virar dupla agora. Quando os vizinhos sao do mesmo grupo, o proximo da
 * fila entra no lugar.
 */
export function duplasDaFase2(colocacoes: Colocacao[], maxDuplas?: number): Duo[] {
  const ordenados = [...colocacoes].sort(
    (a, b) => a.posicao - b.posicao || b.pontos - a.pontos || b.saldo - a.saldo,
  )
  // sobrando gente para o tamanho do mata-mata, os ultimos da fila ficam de
  // fora: com 20 atletas e alvo de 8 duplas, saem 4 e ficam 16 para as quartas
  const fila = maxDuplas ? ordenados.slice(0, maxDuplas * 2) : ordenados
  const duos: Duo[] = []
  const usados = new Set<string>()
  for (let i = 0; i < fila.length; i++) {
    const a = fila[i]
    if (usados.has(a.id)) continue
    let escolhido = -1
    let reserva = -1
    for (let k = i + 1; k < fila.length; k++) {
      if (usados.has(fila[k].id)) continue
      if (fila[k].grupo !== a.grupo) { escolhido = k; break }
      if (reserva === -1) reserva = k
    }
    const j = escolhido >= 0 ? escolhido : reserva
    if (j === -1) break // numero impar de jogadores: o ultimo fica de fora
    usados.add(a.id)
    usados.add(fila[j].id)
    duos.push([a.id, fila[j].id])
  }
  return duos
}

/** A menor potencia de 2 que comporta `n`. */
function tamanhoDaChave(n: number): number {
  let t = 1
  while (t < n) t *= 2
  return t
}

/**
 * Uma rodada do mata-mata das duplas.
 *
 * `duos` chega na ordem de forca -- o indice 0 e a dupla mais bem classificada
 * na fase de grupos. Quem passa de BYE sao as primeiras: ir bem no grupo vale
 * um atalho. As demais se cruzam pelas pontas (a melhor pega a pior, a segunda
 * pega a penultima), para as favoritas so se encontrarem no fim.
 *
 * O bye so aparece na primeira rodada: dali em diante o numero de duplas ja e
 * potencia de dois e a conta fecha sozinha.
 */
export function rodadaDoMataMata(duos: Duo[]): { byes: Duo[]; jogos: [Duo, Duo][] } {
  if (duos.length <= 1) return { byes: duos, jogos: [] }
  const byes = tamanhoDaChave(duos.length) - duos.length
  const passam = duos.slice(0, byes)
  const jogam = duos.slice(byes)
  const jogos: [Duo, Duo][] = []
  for (let i = 0; i < jogam.length / 2; i++) {
    jogos.push([jogam[i], jogam[jogam.length - 1 - i]])
  }
  return { byes: passam, jogos }
}

/**
 * O nome da rodada, pelo tanto de duplas que SOBRAM depois dela.
 *
 * Nomear pelas que entram erraria: com 10 duplas, a primeira rodada tem 6 byes
 * e so 2 jogos -- ela nao e uma "oitavas", e uma preliminar que corta de 10
 * para 8.
 */
export function nomeDaRodada(entram: number): string {
  const sobram = tamanhoDaChave(entram) / 2
  if (entram <= 2) return 'Final'
  if (sobram === 1) return 'Final'
  if (sobram === 2) return 'Semifinal'
  if (sobram === 4) return 'Quartas de final'
  if (sobram === 8) return 'Oitavas de final'
  return `Rodada de ${entram} duplas`
}

/** As duplas que ainda estao vivas: as que nunca perderam, na ordem de forca. */
export function duplasVivas(duos: Duo[], jogos: Match[]): Duo[] {
  const chave = (d: readonly string[]) => [...d].sort().join('|')
  const eliminadas = new Set<string>()
  for (const m of jogos) {
    if (m.score_a === null || m.score_b === null) continue
    eliminadas.add(chave(m.score_a > m.score_b ? m.team_b : m.team_a))
  }
  return duos.filter((d) => !eliminadas.has(chave(d)))
}

export function formarGrupos(
  playerIds: string[],
  ratings: Map<string, number>,
  tamanho: number,
): string[][] {
  const grupos = numeroDeGrupos(playerIds.length, tamanho)
  if (grupos <= 1) return [playerIds.slice()]
  const ordenadas = [...playerIds].sort((a, b) => (ratings.get(b) ?? 2) - (ratings.get(a) ?? 2))
  const out: string[][] = []
  let i = 0
  for (const t of tamanhosDosGrupos(playerIds.length, grupos)) {
    out.push(ordenadas.slice(i, i + t))
    i += t
  }
  return out
}

/**
 * Quantas quadras dao para encher ao mesmo tempo, dados os tamanhos dos grupos.
 *
 * Cada partida precisa de quatro jogadores do MESMO grupo, entao um grupo de 6 so
 * alimenta uma quadra por vez: 12 jogadores em dois grupos de 6 enchem duas
 * quadras, nao tres. Sem grupos, passe `[total]` e a conta vira o total / 4.
 */
export function quadrasSimultaneas(tamanhos: number[]): number {
  return Math.max(1, tamanhos.reduce((t, n) => t + Math.floor(n / 4), 0))
}

/**
 * Quantas duplas cada jogador precisa REPETIR para todos jogarem o mesmo
 * tanto.
 *
 * Todos com todos uma vez da n(n-1)/2 duplas, e cada partida gasta duas delas.
 * Quando n e 6, 7, 10, 11... essa conta nao fecha em partidas inteiras com
 * todo mundo jogando igual: num grupo de 6 sao 15 duplas, sobra uma, e a saida
 * antiga (uma dupla ja formada joga de novo) dava um jogo a mais para exatamente
 * DUAS jogadores do grupo.
 *
 * A saida certa e repetir a mesma quantidade de duplas para cada um:
 * - n % 4 == 0 ou 1 -> fecha sozinho, ninguem repete
 * - n % 4 == 2      -> cada um repete 1 parceiro (as repetidas formam pares)
 * - n % 4 == 3      -> cada um repete 2 (as repetidas formam um ciclo)
 */
export function repeticoesPorJogador(jogadores: number): number {
  const r = jogadores % 4
  return r === 2 ? 1 : r === 3 ? 2 : 0
}

/** Quantas partidas o rodizio de um grupo desse tamanho gera. */
export function partidasDoRodizio(jogadores: number): number {
  if (jogadores < 4) return 0
  return (jogadores * (jogadores - 1 + repeticoesPorJogador(jogadores))) / 4
}

/** Quantos jogos cada um faz -- igual para todos do grupo. */
export function jogosDoRodizio(jogadores: number): number {
  if (jogadores < 4) return 0
  return jogadores - 1 + repeticoesPorJogador(jogadores)
}

/** Com quantos parceiros diferentes cada um joga. */
export function parceirosDoRodizio(jogadores: number): number {
  return Math.max(0, jogadores - 1)
}

/* ------------------------------------------------------------------
   Escolha da adversaria

   Entre duas duplas validas (que nao dividem jogador), a melhor partida e a
   das quatro que menos se enfrentaram -- primeiro olhando o proprio dia,
   depois os plays anteriores. Somar quantas vezes cada par ja se cruzou faz
   o custo crescer a cada repeticao, entao o resultado se espalha sozinho em
   vez de castigar sempre as mesmas.
   ------------------------------------------------------------------ */

type Confrontos = Map<string, number>

type Contexto = {
  ratings: Map<string, number>
  /**
   * Quanto cada dupla rende ALEM da media dos dois, pelo historico dela
   * (`pairKey` -> ajuste na mesma escala do `ratings`). Vazio quando a dupla
   * ainda nao jogou junto o bastante.
   */
  entrosamento?: Map<string, number>
  /** Quantas vezes cada par ja se enfrentou hoje. */
  dia: Confrontos
  /** O mesmo, em plays anteriores, ja com o peso do historico. */
  antes: Confrontos
}

/**
 * A forca de uma dupla, para comparar com a do outro lado.
 *
 * E a SOMA das duas notas mais o entrosamento -- duas pessoas medianas que
 * se acham em quadra valem mais do que a soma diz, e e isso que faz o
 * confronto sair parelho de verdade. O ajuste entra dobrado porque esta
 * medido por jogador e aqui a conta e de dupla.
 */
function forcaDuo(d: Duo, ctx: Contexto): number {
  const base = (ctx.ratings.get(d[0]) ?? 2) + (ctx.ratings.get(d[1]) ?? 2)
  return base + 2 * (ctx.entrosamento?.get(pairKey(d[0], d[1])) ?? 0)
}

function custoDoConfronto(a: Duo, b: Duo, ctx: Contexto): number {
  let c = W_BALANCE * Math.abs(forcaDuo(a, ctx) - forcaDuo(b, ctx))
  for (const x of a) {
    for (const y of b) {
      const k = pairKey(x, y)
      c += W_OPP_DIA * (ctx.dia.get(k) ?? 0)
      c += W_OPP_HIST * (ctx.antes.get(k) ?? 0)
    }
  }
  return c
}

function marcarConfronto(a: Duo, b: Duo, dia: Confrontos) {
  for (const x of a) {
    for (const y of b) {
      const k = pairKey(x, y)
      dia.set(k, (dia.get(k) ?? 0) + 1)
    }
  }
}

function desmarcarConfronto(a: Duo, b: Duo, dia: Confrontos) {
  for (const x of a) {
    for (const y of b) {
      const k = pairKey(x, y)
      dia.set(k, Math.max(0, (dia.get(k) ?? 0) - 1))
    }
  }
}

type Partida = {
  team_a: Duo
  team_b: Duo
  repetida?: boolean
  /**
   * De qual ronda do metodo do circulo a partida saiu (-1 para as montadas
   * com as duplas que sobraram). As partidas de uma mesma ronda cobrem o
   * grupo inteiro, e e isso que permite as quadras rodarem todas ao mesmo
   * tempo -- por isso duplas so trocam de partida DENTRO da ronda.
   */
  ronda?: number
}

type Emparelhamento = { partidas: Partida[]; orfas: Duo[]; custo: number }

/**
 * Junta duplas em partidas. Comeca sempre pela dupla com MENOS adversarias
 * possiveis -- deixar a mais presa para o fim e o que faz sobrar dupla sem
 * ninguem para enfrentar. Entre as adversarias que cabem, pega a que menos
 * ja se enfrentou com ela.
 */
function emparelharUmaVez(duos: Duo[], ctx: Contexto, ronda: number): Emparelhamento {
  const livres = duos.slice()
  const partidas: Partida[] = []
  const orfas: Duo[] = []
  let custo = 0
  while (livres.length > 0) {
    const graus = livres.map((d, i) =>
      livres.reduce((n, o, j) => (j !== i && disjuntas(d, o) ? n + 1 : n), 0),
    )
    const menor = Math.min(...graus)
    const i = graus.indexOf(menor)
    if (menor === 0) {
      orfas.push(livres.splice(i, 1)[0]) // nao combina com nenhuma das que restam
      continue
    }
    const a = livres[i]
    let mj = -1
    let melhorC = Infinity
    for (let j = 0; j < livres.length; j++) {
      if (j === i || !disjuntas(a, livres[j])) continue
      const c = custoDoConfronto(a, livres[j], ctx)
      if (c < melhorC) {
        melhorC = c
        mj = j
      }
    }
    const b = livres[mj]
    livres.splice(Math.max(i, mj), 1)
    livres.splice(Math.min(i, mj), 1)
    partidas.push({ team_a: a, team_b: b, ronda })
    marcarConfronto(a, b, ctx.dia)
    custo += melhorC
  }
  return { partidas, orfas, custo }
}

/** Melhor de varias tentativas: primeiro menos duplas sobrando, depois custo. */
function emparelhar(duos: Duo[], ctx: Contexto, ronda = -1): Emparelhamento {
  const base = new Map(ctx.dia)
  let melhor: Emparelhamento | null = null
  const tentativas = duos.length > 40 ? 3 : 8 // a busca e cubica no tamanho
  for (let t = 0; t < tentativas; t++) {
    const tentativa = emparelharUmaVez(
      t === 0 ? duos : shuffle(duos),
      { ...ctx, dia: new Map(base) },
      ronda,
    )
    const ganhou =
      !melhor ||
      tentativa.orfas.length < melhor.orfas.length ||
      (tentativa.orfas.length === melhor.orfas.length && tentativa.custo < melhor.custo)
    if (ganhou) melhor = tentativa
    if ((melhor as Emparelhamento).orfas.length <= 1 && t >= 2) break
  }
  const escolhido = melhor as Emparelhamento
  for (const p of escolhido.partidas) marcarConfronto(p.team_a, p.team_b, ctx.dia)
  return escolhido
}

/**
 * Passada final: troca as adversarias entre duas partidas quando isso espalha
 * melhor os confrontos (ou deixa os jogos mais parelhos). So troca duplas
 * inteiras de lugar, entao o rodizio de parceiros continua intacto.
 */
function melhorarConfrontos(partidas: Partida[], ctx: Contexto) {
  const troca = partidas.filter((m) => !m.repetida)
  let mudou = true
  let voltas = 0
  while (mudou && voltas++ < 6) {
    mudou = false
    for (let i = 0; i < troca.length; i++) {
      for (let j = i + 1; j < troca.length; j++) {
        const m1 = troca[i]
        const m2 = troca[j]
        // trocar entre rondas diferentes quebraria a cobertura do grupo
        if (m1.ronda !== m2.ronda) continue
        desmarcarConfronto(m1.team_a, m1.team_b, ctx.dia)
        desmarcarConfronto(m2.team_a, m2.team_b, ctx.dia)
        const opcoes: [Duo, Duo, Duo, Duo][] = [
          [m1.team_a, m1.team_b, m2.team_a, m2.team_b], // como esta hoje
          [m1.team_a, m2.team_a, m1.team_b, m2.team_b],
          [m1.team_a, m2.team_b, m1.team_b, m2.team_a],
        ]
        let escolha = 0
        let melhorC = Infinity
        opcoes.forEach((o, k) => {
          if (!disjuntas(o[0], o[1]) || !disjuntas(o[2], o[3])) return
          const c1 = custoDoConfronto(o[0], o[1], ctx)
          marcarConfronto(o[0], o[1], ctx.dia) // a segunda partida ja sente a primeira
          const c2 = custoDoConfronto(o[2], o[3], ctx)
          desmarcarConfronto(o[0], o[1], ctx.dia)
          if (c1 + c2 < melhorC - 1e-9) {
            melhorC = c1 + c2
            escolha = k
          }
        })
        const o = opcoes[escolha]
        m1.team_a = o[0]
        m1.team_b = o[1]
        m2.team_a = o[2]
        m2.team_b = o[3]
        marcarConfronto(m1.team_a, m1.team_b, ctx.dia)
        marcarConfronto(m2.team_a, m2.team_b, ctx.dia)
        if (escolha !== 0) mudou = true
      }
    }
  }
}

/* ------------------------------------------------------------------
   Rodizio de um grupo

   Metodo do circulo (1-fatoracao do grafo completo): fixa um jogador e gira
   os outros, gerando conjuntos ("rondas") de duplas em que ninguem se repete
   dentro do conjunto e toda combinacao aparece uma unica vez. Como as duplas
   de uma ronda nao dividem jogador, qualquer par delas forma uma partida
   valida -- e ai da para escolher a adversaria pelo criterio acima.
   ------------------------------------------------------------------ */

const BYE = '__folga__'

function circleMethod(ids: string[]): Duo[][] {
  const list = ids.slice()
  if (list.length % 2 === 1) list.push(BYE)
  const n = list.length
  const fixed = list[0]
  let rot = list.slice(1)
  const out: Duo[][] = []
  for (let r = 0; r < n - 1; r++) {
    const pairs: Duo[] = []
    if (fixed !== BYE && rot[0] !== BYE) pairs.push([fixed, rot[0]])
    for (let i = 1; i < n / 2; i++) {
      const x = rot[i]
      const y = rot[rot.length - i]
      if (x !== BYE && y !== BYE) pairs.push([x, y])
    }
    out.push(pairs)
    rot = [rot[rot.length - 1], ...rot.slice(0, rot.length - 1)]
  }
  return out
}

function umRodizio(ids: string[], ctx: Contexto): Partida[] {
  const partidas: Partida[] = []
  const sobras: Duo[] = []

  circleMethod(shuffle(ids)).forEach((ronda, r) => {
    const pares = ronda.slice()
    if (pares.length % 2 === 1) {
      // Sobra uma dupla desta ronda. A escolhida e a que menos repete
      // jogadores ja presentes nos outros sobras: se todas as sobras caem em
      // cima do mesmo jogador elas nao conseguem se enfrentar depois e viram
      // duplas sem adversaria.
      sobras.push(...pares.splice(menosRepetida(pares, sobras), 1))
    }
    const { partidas: ps, orfas } = emparelhar(pares, ctx, r)
    partidas.push(...ps)
    sobras.push(...orfas)
  })

  // As duplas que repetem entram AQUI, junto das sobras, e nao como remendo no
  // fim: escolhidas assim, cada jogador repete a mesma quantidade de vezes e
  // o grupo inteiro termina com o mesmo numero de jogos.
  sobras.push(...duplasQueRepetem(ids, repeticoesPorJogador(ids.length)))

  // as sobras vem de rondas diferentes, entao podem dividir jogador
  const { partidas: extras, orfas } = emparelhar(sobras, ctx)
  partidas.push(...extras)

  // Sobrou dupla sem adversaria (o total de combinacoes do grupo e impar):
  // uma dupla ja formada joga uma segunda vez, so para ela ter contra quem
  // jogar. O app marca a partida como repetida em vez de esconder isso.
  for (const orfa of orfas) {
    const rival = escolherRival(partidas, orfa, ctx)
    if (!rival) continue
    partidas.push({ team_a: orfa, team_b: rival, repetida: true })
    marcarConfronto(orfa, rival, ctx.dia)
  }

  melhorarConfrontos(partidas, ctx)
  return partidas
}

/**
 * As duplas que vao jogar duas vezes, escolhidas para cair igualmente sobre
 * todas os jogadores do grupo.
 *
 * `k = 1` (grupo par): pares soltos -- cada um aparece exatamente uma vez.
 * `k = 2` (grupo impar): um ciclo passando por todas -- cada um aparece duas.
 * A ordem e sorteada, entao nao e sempre a mesma dupla que repete.
 */
function duplasQueRepetem(ids: string[], k: number): Duo[] {
  if (k <= 0 || ids.length < 4) return []
  const v = shuffle(ids)
  if (k === 1) {
    const out: Duo[] = []
    for (let i = 0; i + 1 < v.length; i += 2) out.push([v[i], v[i + 1]])
    return out
  }
  return v.map((id, i) => [id, v[(i + 1) % v.length]] as Duo)
}

/** Indice da dupla cujas jogadores menos aparecem nas sobras ate agora. */
function menosRepetida(pares: Duo[], sobras: Duo[]): number {
  const usos = new Map<string, number>()
  for (const s of sobras) for (const id of s) usos.set(id, (usos.get(id) ?? 0) + 1)
  let escolhido = 0
  let menor = Infinity
  pares.forEach((p, i) => {
    const u = (usos.get(p[0]) ?? 0) + (usos.get(p[1]) ?? 0)
    if (u < menor) {
      menor = u
      escolhido = i
    }
  })
  return escolhido
}

/** Dupla ja formada, que nao divide jogador com a orfa e menos a enfrentou. */
function escolherRival(partidas: Partida[], orfa: Duo, ctx: Contexto): Duo | null {
  let melhor: Duo | null = null
  let melhorCusto = Infinity
  for (const p of partidas) {
    for (const d of [p.team_a, p.team_b]) {
      if (!disjuntas(d, orfa)) continue
      const c = custoDoConfronto(d, orfa, ctx)
      if (c < melhorCusto) {
        melhorCusto = c
        melhor = d
      }
    }
  }
  return melhor
}

/**
 * Nota de um rodizio inteiro, para escolher a melhor de varias tentativas.
 * Refaz a contagem do zero: o custo de cada confronto e quantas vezes aquele
 * par ja tinha se cruzado, entao repetir a quarta vez pesa mais que a segunda.
 */
function custoDoRodizio(partidas: Partida[], ctx: Contexto): number {
  const dia: Confrontos = new Map(ctx.dia)
  let c = 0
  for (const m of partidas) {
    c += W_BALANCE * Math.abs(forcaDuo(m.team_a, ctx) - forcaDuo(m.team_b, ctx))
    for (const x of m.team_a) {
      for (const y of m.team_b) {
        const k = pairKey(x, y)
        c += W_OPP_DIA * (dia.get(k) ?? 0) + W_OPP_HIST * (ctx.antes.get(k) ?? 0)
        dia.set(k, (dia.get(k) ?? 0) + 1)
      }
    }
    if (m.repetida) c += W_REPETIDA
  }
  return c
}

function rodizioDoGrupo(
  ids: string[],
  ratings: Map<string, number>,
  antes: Confrontos,
  diaAteAgora: Confrontos,
  entrosamento?: Map<string, number>,
): Partida[] {
  if (ids.length < 4) return []
  let melhor: Partida[] = []
  let melhorCusto = Infinity
  for (let t = 0; t < 24; t++) {
    // cada tentativa comeca do mesmo ponto: os confrontos ja marcados fora
    const ctx: Contexto = { ratings, entrosamento, antes, dia: new Map(diaAteAgora) }
    const cand = umRodizio(ids, ctx)
    // ninguem jogar a mais que a outra vale mais que qualquer ajuste fino de
    // confronto: uma partida a mais para dois jogadores e injustica visivel
    const custo =
      desigualdadeDeJogos(cand, ids) * 1e6 +
      custoDoRodizio(cand, { ratings, entrosamento, antes, dia: diaAteAgora })
    if (custo < melhorCusto) {
      melhorCusto = custo
      melhor = cand
    }
  }
  return melhor
}

/** Diferenca entre quem mais joga e quem menos joga no grupo. */
function desigualdadeDeJogos(partidas: Partida[], ids: string[]): number {
  const jogos = new Map(ids.map((id) => [id, 0]))
  for (const p of partidas) {
    for (const id of jogadoresDaPartida(p)) jogos.set(id, (jogos.get(id) ?? 0) + 1)
  }
  const v = [...jogos.values()]
  return Math.max(...v) - Math.min(...v)
}

/* ------------------------------------------------------------------
   Ordem da fila

   A fila e so uma sugestao de ordem -- na quadra quem manda e quem esta livre
   -- mas ela ja sai espalhada: a proxima partida e sempre a que pega os
   jogadores que estao ha mais tempo sem jogar, para ninguem emendar dois
   jogos cansado enquanto outro espera sentado.
   ------------------------------------------------------------------ */

function ordenarFila(partidas: PlannedMatch[]): PlannedMatch[] {
  const restantes = shuffle(partidas)
  const ultima = new Map<string, number>()
  const out: PlannedMatch[] = []
  while (restantes.length > 0) {
    let escolhida = 0
    let melhor = -Infinity
    for (let i = 0; i < restantes.length; i++) {
      const esperas = jogadoresDaPartida(restantes[i]).map(
        (id) => out.length - (ultima.get(id) ?? -50), // quem nao jogou ainda vem antes
      )
      // manda quem descansou menos: e o que decide se a partida pode entrar ja
      const nota = Math.min(...esperas) * 1000 + esperas.reduce((a, b) => a + b, 0)
      if (nota > melhor) {
        melhor = nota
        escolhida = i
      }
    }
    const m = restantes.splice(escolhida, 1)[0]
    for (const id of jogadoresDaPartida(m)) ultima.set(id, out.length)
    out.push(m)
  }
  return out
}

export type ScheduleOptions = {
  playerIds: string[]
  ratings: Map<string, number>
  /** Entrosamento de cada dupla (`pairKey` -> ajuste), de `ajusteDeEntrosamento`. */
  entrosamento?: Map<string, number>
  /** Historico de partidas anteriores (outros dias), para variar as duplas. */
  history?: History
  /** Peso do historico antigo em relacao ao do proprio dia (0 a 1). */
  historyWeight?: number
  /** No modo em grupos, os grupos ja formados. Sem isso, um grupo so. */
  groups?: string[][]
}

/** Monta a fila de partidas do dia. */
export function gerarFila(opts: ScheduleOptions): PlannedMatch[] {
  const hw = opts.historyWeight ?? 0.45
  const antes: Confrontos = new Map()
  if (opts.history) {
    for (const [k, v] of opts.history.opponent) antes.set(k, v * hw)
  }

  const dia: Confrontos = new Map()
  const grupos = opts.groups?.length ? opts.groups : [opts.playerIds]
  const todas: PlannedMatch[] = []
  grupos.forEach((ids, i) => {
    for (const m of rodizioDoGrupo(ids, opts.ratings, antes, dia, opts.entrosamento)) {
      todas.push({ ...m, grupo: i })
      marcarConfronto(m.team_a, m.team_b, dia)
    }
  })
  return ordenarFila(todas)
}

export type RefazerOptions = ScheduleOptions & {
  /** Partidas do dia que ja tem placar. Elas ficam como estao. */
  jogadas: Match[]
}

/**
 * Remonta so o que ainda falta: junta as duplas que ainda nao se formaram e
 * monta as partidas em cima do que ja aconteceu hoje. Serve para quando o dia
 * sai do roteiro -- trocas na mao, quadra travada, play que comecou no papel.
 */
export function refazerFila(opts: RefazerOptions): PlannedMatch[] {
  const hw = opts.historyWeight ?? 0.45
  const antes: Confrontos = new Map()
  if (opts.history) for (const [k, v] of opts.history.opponent) antes.set(k, v * hw)

  const dia: Confrontos = new Map()
  const feitas = new Set<string>()
  for (const m of opts.jogadas) {
    marcarConfronto(m.team_a, m.team_b, dia)
    feitas.add(pairKey(m.team_a[0], m.team_a[1]))
    feitas.add(pairKey(m.team_b[0], m.team_b[1]))
  }

  const grupos = opts.groups?.length ? opts.groups : [opts.playerIds]
  const todas: PlannedMatch[] = []
  grupos.forEach((ids, gi) => {
    const faltando: Duo[] = []
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        if (!feitas.has(pairKey(ids[i], ids[j]))) faltando.push([ids[i], ids[j]])
      }
    }
    if (faltando.length === 0) return
    const ctx: Contexto = { ratings: opts.ratings, entrosamento: opts.entrosamento, antes, dia }
    const { partidas, orfas } = emparelhar(shuffle(faltando), ctx)
    for (const orfa of orfas) {
      const rival = escolherRival(partidas, orfa, ctx)
      if (!rival) continue
      partidas.push({ team_a: orfa, team_b: rival, repetida: true })
      marcarConfronto(orfa, rival, ctx.dia)
    }
    melhorarConfrontos(partidas, ctx)
    for (const p of partidas) todas.push({ ...p, grupo: gi })
  })
  return ordenarFila(todas)
}

/** Numeros para conferir a qualidade da fila antes de gerar o play. */
export type ResumoDaFila = {
  partidas: number
  duplasDistintas: number
  duplasRepetidas: number
  /** Quantas vezes o par que mais se enfrentou vai se enfrentar. */
  maxConfrontos: number
  mediaConfrontos: number
}

export function resumoDaFila(fila: PlannedMatch[]): ResumoDaFila {
  const duplas = new Map<string, number>()
  const confrontos = new Map<string, number>()
  for (const m of fila) {
    for (const d of [m.team_a, m.team_b]) {
      const k = pairKey(d[0], d[1])
      duplas.set(k, (duplas.get(k) ?? 0) + 1)
    }
    marcarConfronto(m.team_a, m.team_b, confrontos)
  }
  const valores = [...confrontos.values()]
  const soma = valores.reduce((a, b) => a + b, 0)
  return {
    partidas: fila.length,
    duplasDistintas: duplas.size,
    duplasRepetidas: [...duplas.values()].filter((n) => n > 1).length,
    maxConfrontos: valores.length === 0 ? 0 : Math.max(...valores),
    mediaConfrontos: valores.length === 0 ? 0 : soma / valores.length,
  }
}

export function planToMatches(sessionId: string, fila: PlannedMatch[]): Match[] {
  return fila.map((m, i) => ({
    id: uid(),
    session_id: sessionId,
    round: i + 1, // posicao na fila (a coluna do banco se chama round)
    court: 0, // a quadra e definida quando a partida entra em quadra
    fase: m.fase ?? 1,
    team_a: m.team_a,
    team_b: m.team_b,
    score_a: null,
    score_b: null,
    started_at: null,
    ended_at: null,
  }))
}

export function historyFromMatches(matches: Match[]): History {
  return buildHistory(matches)
}

/* ------------------------------------------------------------------
   Quem entra na proxima

   Quando uma quadra vaga, o app olha a fila inteira e pega a primeira partida
   cujas quatro jogadores estao livres, dando preferencia para quem esta fora
   ha mais tempo -- senao acontece de o jogador terminar o jogo e ja entrar de
   novo, cansado, enquanto outro espera sentado.
   ------------------------------------------------------------------ */

/**
 * Fila de espera dos jogadores: 0 e quem esta fora ha mais tempo.
 * `fimDe` devolve quando ela terminou a ultima partida (ms), 0 quando jogou
 * mas nao se sabe a hora, e null quando ainda nao jogou hoje.
 */
export function ordemDeEspera(
  jogadores: string[],
  fimDe: (id: string) => number | null,
): Map<string, number> {
  // Quem esta na MESMA situacao recebe a MESMA posicao. Dar posicoes
  // diferentes para quem esta empatado (por exemplo, no comeco do play, quando
  // ninguem jogou ainda) inventa uma preferencia que nao existe -- e essa
  // preferencia inventada atropelava a ordem da fila, desmontando as rondas e
  // deixando quadra parada logo na primeira troca.
  const distintos = [...new Set(jogadores.map((id) => fimDe(id)))]
  distintos.sort((a, b) => {
    if (a === null && b === null) return 0
    if (a === null) return -1 // ainda nao jogou hoje: entra na frente
    if (b === null) return 1
    return a - b
  })
  const posicao = new Map<number | null, number>(distintos.map((v, i) => [v, i]))
  return new Map(jogadores.map((id) => [id, posicao.get(fimDe(id)) ?? 0]))
}

export type EscolhaOpts = {
  /** Partidas sem placar e sem inicio, na ordem da fila. */
  pendentes: Match[]
  /** Quem esta em quadra agora. */
  ocupados: Set<string>
  /** Fila de espera (0 = fora ha mais tempo). */
  espera: Map<string, number>
  /** Quantas partidas cada um ja fez hoje. */
  jogos: Map<string, number>
  /** Quadras sem partida em andamento, na ordem em que aparecem na tela. */
  quadrasLivres: number[]
}

/**
 * Sugere a proxima partida de cada quadra livre.
 *
 * Escolhe o CONJUNTO de partidas de uma vez, nao uma quadra por vez: pegando
 * a melhor partida para a quadra 1 sem olhar os outros, sobra jogador
 * repetido entre duas quadras (o mesmo jogador nao pode entrar em duas ao
 * mesmo tempo). Aqui a busca preenche o maior numero de quadras possivel e,
 * entre as opcoes que preenchem o mesmo tanto, escolhe a de menor custo.
 *
 * Pode devolver menos quadras do que as livres: quando as partidas que faltam
 * so envolvem quem ja esta jogando, a tela mostra a quadra esperando e
 * oferece montar uma partida com quem esta livre.
 */
export function proximasDasQuadras(opts: EscolhaOpts): Map<number, Match> {
  const { pendentes, ocupados, espera, jogos, quadrasLivres } = opts

  const custo = (m: Match) => {
    const ids = jogadoresDaPartida(m)
    const esperou = ids.reduce((t, id) => t + (espera.get(id) ?? 0), 0)
    const feitos = ids.reduce((t, id) => t + (jogos.get(id) ?? 0), 0)
    return esperou * 1000 + feitos * 10 + m.round
  }

  const ordenadas = [...pendentes].sort((a, b) => custo(a) - custo(b))
  const LARGURA = 8 // quantas candidatas testar por quadra
  const TETO = 3000 // corta a busca em play grande
  let visitas = 0
  let melhor: Match[] = []
  let melhorNota = Infinity

  const busca = (nivel: number, tomadas: Set<string>, escolhidas: Match[], acumulado: number) => {
    // preencher mais quadras vale mais que qualquer economia de custo
    const nota = -escolhidas.length * 1e9 + acumulado
    if (nota < melhorNota) {
      melhorNota = nota
      melhor = escolhidas.slice()
    }
    if (nivel >= quadrasLivres.length || visitas > TETO) return
    const usadas = new Set(escolhidas.map((m) => m.id))
    const cabem = ordenadas.filter(
      (m) => !usadas.has(m.id) && jogadoresDaPartida(m).every((id) => !tomadas.has(id)),
    )
    for (const m of cabem.slice(0, LARGURA)) {
      visitas++
      if (visitas > TETO) return
      const t2 = new Set(tomadas)
      for (const id of jogadoresDaPartida(m)) t2.add(id)
      busca(nivel + 1, t2, [...escolhidas, m], acumulado + custo(m))
    }
  }
  busca(0, new Set(ocupados), [], 0)

  const out = new Map<number, Match>()
  melhor.forEach((m, i) => out.set(quadrasLivres[i], m))
  return out
}

/**
 * A ordem em que as partidas que faltam devem acontecer.
 *
 * Nao e a ordem em que elas foram geradas: essa e so o ponto de partida, e
 * mostra-la na tela engana, porque aparece na frente quem acabou de sair da
 * quadra. Aqui a fila e projetada rodando o mesmo criterio das quadras --
 * entra sempre a partida com os jogadores que estao ha mais tempo sem jogar --
 * e cada partida escolhida joga as suas quatro para o fim da espera.
 *
 * So muda a ORDEM: as duplas ja estao formadas, entao o rodizio continua
 * intacto (ninguem repete parceiro por causa disto).
 */
export function ordemPrevista(opts: {
  /** Partidas sem placar e sem inicio. */
  pendentes: Match[]
  /** Fila de espera atual (0 = fora ha mais tempo). */
  espera: Map<string, number>
  /** Quem esta em quadra ou ja escalada: vai para o fim da espera. */
  ocupados: Set<string>
  /** Todas os jogadores do play. */
  jogadores: string[]
}): Match[] {
  const { pendentes, espera, ocupados, jogadores } = opts
  const n = Math.max(1, jogadores.length)

  // "ha quanto tempo jogou", em passos de fila: menor = esperando ha mais tempo
  const ultima = new Map<string, number>()
  for (const id of jogadores) {
    const posicao = espera.get(id) ?? 0
    ultima.set(id, ocupados.has(id) ? n + posicao : posicao)
  }

  const restantes = pendentes.slice()
  const out: Match[] = []
  while (restantes.length > 0) {
    let escolhida = 0
    let melhor = Infinity
    restantes.forEach((m, i) => {
      const ids = jogadoresDaPartida(m)
      const soma = ids.reduce((t, id) => t + (ultima.get(id) ?? 0), 0)
      const nota = soma * 1000 + m.round // desempate pela ordem em que foi gerada
      if (nota < melhor) {
        melhor = nota
        escolhida = i
      }
    })
    const m = restantes.splice(escolhida, 1)[0]
    for (const id of jogadoresDaPartida(m)) ultima.set(id, 2 * n + out.length)
    out.push(m)
  }
  return out
}

/* ------------------------------------------------------------------
   NAO existe mais "montar partida com quem esta livre".

   Havia um `liberarPartida` que, com a quadra parada, trocava quem estava
   ocupada por quem estava livre. Ele desfazia uma dupla do rodizio e dava um
   jogo a mais para um jogador e a menos para outra -- o oposto da regra de
   todas jogarem o mesmo tanto. Medido: em modo grupos a quadra fica parada de
   0,1% a 11% do tempo e a maior espera e de uns 17 minutos, uma partida.
   Esperar sai mais barato que quebrar o rodizio. Se alguem foi embora de
   verdade, a troca continua existindo no card da partida, feita na mao.
   ------------------------------------------------------------------ */

