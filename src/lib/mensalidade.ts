import type { AppData, Player } from './types'
import { monthOf, todayISO } from './types'

/**
 * QUEM PODE ENTRAR NO PLAY
 *
 * Os atletas pagam para jogar, e cada um paga de um jeito:
 *
 *   mensalista  paga por mes. Fica liberado enquanto o mes gravado em
 *               `pago_mes` for o mes de hoje -- entao na virada do mes ele
 *               volta a dever SOZINHO, sem ninguem precisar rodar nada.
 *   avulso      paga por play. `pago_avulso` e um credito de uma participacao:
 *               vale para o proximo play e some quando aquele play e
 *               finalizado.
 *   convidado   nao paga. So que convidado e para ser eventual, entao dois
 *               plays seguidos acendem um alerta -- sem travar nada, porque
 *               quem decide isso e a organizacao, nao o app.
 *
 * A regra do mensalista e DERIVADA do calendario em vez de gravada: nao existe
 * "virar o mes" para dar errado, esquecer de rodar ou rodar duas vezes.
 */

export type Categoria = 'mensalista' | 'avulso' | 'convidado' | 'isento'

export const CATEGORIAS: { valor: Categoria; rotulo: string; explica: string }[] = [
  {
    valor: 'mensalista',
    rotulo: '📅 Mensalista',
    explica: 'paga por mês; na virada do mês volta a aparecer como devendo',
  },
  {
    valor: 'avulso',
    rotulo: '🎟️ Avulso',
    explica: 'paga por play; a confirmação vale para um play só',
  },
  {
    valor: 'convidado',
    rotulo: '🤝 Convidado',
    explica: 'não paga; dois plays seguidos acendem um alerta',
  },
  {
    valor: 'isento',
    rotulo: '🎫 Isento',
    explica: 'não paga e nunca alerta — para quem tem acordo, e para grupo que não cobra',
  },
]

export function categoriaDe(p: Player): Categoria {
  return (p.categoria as Categoria) ?? 'mensalista'
}

export function rotuloDaCategoria(c: Categoria): string {
  return CATEGORIAS.find((x) => x.valor === c)?.rotulo ?? c
}

export type Situacao = {
  /** Pode ser escalado para um play? */
  liberado: boolean
  cor: 'ok' | 'devendo' | 'atencao'
  /** Frase curta para a lista de atletas. */
  rotulo: string
  /** O que fazer para liberar, quando esta devendo. */
  comoResolver?: string
  /** Aviso que nao impede de jogar (convidado em sequencia). */
  alerta?: string
}

/**
 * Em quantos plays seguidos, contando do mais recente, este atleta jogou.
 *
 * Conta a partir do ultimo play do campeonato: se ele nao esteve no mais
 * recente, a sequencia e zero. Serve so para o alerta do convidado.
 */
export function playsSeguidos(data: AppData, playerId: string): number {
  const plays = data.sessions
    .filter((s) => s.status === 'finished' && s.ranked !== false)
    .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
  let n = 0
  for (const s of plays) {
    if (!s.player_ids.includes(playerId)) break
    n++
  }
  return n
}

export function situacaoDoAtleta(p: Player, data: AppData, hoje = todayISO()): Situacao {
  const categoria = categoriaDe(p)
  const mes = monthOf(hoje)

  // isento nao paga e nao vira alerta: o acordo e permanente, entao contar
  // plays seguidos so encheria a tela de aviso que ninguem vai resolver
  if (categoria === 'isento') {
    return { liberado: true, cor: 'ok', rotulo: 'Isento' }
  }

  if (categoria === 'convidado') {
    const seguidos = playsSeguidos(data, p.id)
    return {
      liberado: true,
      cor: seguidos >= 2 ? 'atencao' : 'ok',
      rotulo: 'Convidado',
      alerta:
        seguidos >= 2
          ? `Já jogou ${seguidos} plays seguidos como convidado — vale conversar sobre virar mensalista.`
          : undefined,
    }
  }

  if (categoria === 'avulso') {
    return p.pago_avulso
      ? { liberado: true, cor: 'ok', rotulo: 'Avulso pago (vale 1 play)' }
      : {
          liberado: false,
          cor: 'devendo',
          rotulo: 'Avulso a pagar',
          comoResolver: 'Confirme o pagamento deste play para liberar.',
        }
  }

  // mensalista
  return p.pago_mes === mes
    ? { liberado: true, cor: 'ok', rotulo: 'Mensalidade em dia' }
    : {
        liberado: false,
        cor: 'devendo',
        rotulo: p.pago_mes ? `Mensalidade paga até ${p.pago_mes}` : 'Mensalidade a pagar',
        comoResolver: 'Confirme a mensalidade do mês para liberar.',
      }
}

/** Marca o pagamento conforme a categoria, devolvendo o atleta atualizado. */
export function confirmarPagamento(p: Player, hoje = todayISO()): Player {
  const categoria = categoriaDe(p)
  if (categoria === 'avulso') return { ...p, pago_avulso: true }
  if (categoria === 'mensalista') return { ...p, pago_mes: monthOf(hoje) }
  return p
}

/** Desfaz a confirmacao -- para quando alguem marca por engano. */
export function desfazerPagamento(p: Player): Player {
  const categoria = categoriaDe(p)
  if (categoria === 'avulso') return { ...p, pago_avulso: false }
  if (categoria === 'mensalista') return { ...p, pago_mes: null }
  return p
}

/**
 * Depois de finalizar um play, o credito dos avulsos que jogaram acaba.
 * Devolve so quem mudou, para o app nao gravar atleta a toa.
 */
export function consumirAvulsos(jogaram: string[], data: AppData): Player[] {
  return data.players.filter(
    (p) => jogaram.includes(p.id) && categoriaDe(p) === 'avulso' && p.pago_avulso,
  ).map((p) => ({ ...p, pago_avulso: false }))
}
