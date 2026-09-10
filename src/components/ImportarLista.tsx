import { useMemo, useState } from 'react'
import { CATEGORIAS, type Categoria } from '../lib/mensalidade'
import { conciliar, normalizar, parseRoster, precisaConferir, type ItemDaLista } from '../lib/roster'
import { useStore } from '../lib/store'
import { uid, type Player } from '../lib/types'
import { Avatar, Modal } from './ui'

type Resultado = {
  criados: string[]
  apelidos: { playerId: string; alias: string }[]
  /** Quantos a tela de destino aceitou, quando ela filtra (o portao do play). */
  entraram?: number
}

/**
 * Cola a lista do grupo, casa os nomes com a base, deixa a organizacao
 * conferir os duvidosos e cria quem ainda nao existe.
 *
 * Serve as duas telas porque a parte dificil -- reconhecer que "Tete" e a
 * mesma pessoa de "Tete 12" -- e a mesma nas duas. So muda o fim:
 *
 *   play      marca presenca no play que esta sendo montado.
 *   cadastro  so cadastra quem falta, na aba Jogadores, sem tocar em play.
 */
export default function ImportarLista({
  onAplicar,
  onClose,
  onToast,
  modo = 'play',
}: {
  /**
   * Recebe quem a lista escolheu, e os que acabaram de ser criados -- estes
   * ainda nao chegaram no `data` da tela de destino, entao vao junto para ela
   * conseguir julgar o cadastro deles. Se devolver um numero, e quantos ela
   * realmente aceitou.
   */
  onAplicar?: (playerIds: string[], criados: Player[]) => number | void
  onClose: () => void
  onToast: (m: string) => void
  modo?: 'play' | 'cadastro'
}) {
  const { data, savePlayer, deletePlayer } = useStore()
  const [texto, setTexto] = useState('')
  const [itens, setItens] = useState<ItemDaLista[] | null>(null)
  const [feito, setFeito] = useState<Resultado | null>(null)

  const ordenadas = useMemo(
    () => [...data.players].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [data.players],
  )

  function conferir() {
    const nomes = parseRoster(texto)
    if (nomes.length === 0) {
      onToast('Não encontrei nomes nessa lista')
      return
    }
    setItens(conciliar(nomes, data.players))
  }

  /** Padrao do lote: vale para todo mundo que nao foi ajustado a mao. */
  const [categoriaNovos, setCategoriaNovos] = useState<Categoria>('convidado')
  /**
   * Ajustes individuais, guardados pelo NOME normalizado.
   *
   * Por posicao na lista, "o 2o e avulso" continuaria valendo depois de voltar
   * e colar outra lista -- em cima de outra pessoa.
   */
  const [catPorNome, setCatPorNome] = useState<Record<string, Categoria>>({})

  /** Como ESTE atleta vai pagar: o ajuste dele, ou o padrao do lote. */
  function categoriaDoItem(texto: string): Categoria {
    return catPorNome[normalizar(texto)] ?? categoriaNovos
  }

  function ajustar(texto: string, c: Categoria) {
    setCatPorNome((m) => ({ ...m, [normalizar(texto)]: c }))
  }

  /** Trocar o padrao recomeca do zero: some com os ajustes individuais. */
  function trocarPadrao(c: Categoria) {
    setCategoriaNovos(c)
    setCatPorNome({})
  }

  function trocar(idx: number, valor: string) {
    setItens((atual) =>
      (atual ?? []).map((it, i) => (i === idx ? { ...it, vincularA: valor === 'nova' ? null : valor } : it)),
    )
  }

  function aplicar() {
    if (!itens) return
    const escolhidas: string[] = []
    const criados: string[] = []
    const novos: Player[] = []
    const apelidos: { playerId: string; alias: string }[] = []

    for (const it of itens) {
      if (it.vincularA) {
        escolhidas.push(it.vincularA)
        // guarda a grafia da lista, para a proxima importacao reconhecer sozinho
        const p = data.players.find((x) => x.id === it.vincularA)
        if (p && p.name.toLowerCase() !== it.texto.toLowerCase() && !(p.aliases ?? []).includes(it.texto)) {
          savePlayer({ ...p, aliases: [...(p.aliases ?? []), it.texto] })
          apelidos.push({ playerId: p.id, alias: it.texto })
        }
      } else {
        const nova: Player = {
          id: uid(),
          name: it.texto,
          photo_url: null,
          active: true,
          created_at: new Date().toISOString(),
          aliases: [],
          categoria: categoriaDoItem(it.texto),
          pago_mes: null,
          pago_avulso: false,
        }
        savePlayer(nova)
        novos.push(nova)
        escolhidas.push(nova.id)
        criados.push(nova.id)
      }
    }
    const entraram = onAplicar?.(escolhidas, novos)
    setFeito({ criados, apelidos, entraram: typeof entraram === 'number' ? entraram : undefined })
  }

  function desfazer() {
    if (!feito) return
    for (const id of feito.criados) deletePlayer(id)
    for (const { playerId, alias } of feito.apelidos) {
      const p = data.players.find((x) => x.id === playerId)
      if (p) savePlayer({ ...p, aliases: (p.aliases ?? []).filter((a) => a !== alias) })
    }
    onAplicar?.([], [])
    setFeito(null)
    setItens(null)
    onToast('Importação desfeita')
  }

  /* ---------------------------------------------------- depois de aplicar */
  if (feito) {
    return (
      <Modal title="Lista importada" onClose={onClose}>
        <div className="banner info" style={{ marginTop: 0 }}>
          {modo === 'play' ? (
            <>
              ✅ <strong>{feito.entraram ?? (itens ?? []).length} jogadores</strong> marcados para
              este play.
            </>
          ) : (
            <>✅ Conferi <strong>{(itens ?? []).length} nomes</strong> da lista.</>
          )}
          {feito.criados.length > 0 && (
            <> {feito.criados.length} {feito.criados.length === 1 ? 'foi criado' : 'foram criados'} agora.</>
          )}
          {modo === 'cadastro' && feito.criados.length === 0 && <> Todos já estavam cadastrados.</>}
          {modo === 'play' && feito.entraram !== undefined && feito.entraram < (itens ?? []).length && (
            <>
              {' '}
              <strong>
                {(itens ?? []).length - feito.entraram} ficaram de fora por causa do cadastro
              </strong>{' '}
              — o aviso amarelo na tela resolve.
            </>
          )}
          {feito.apelidos.length > 0 && <> {feito.apelidos.length === 1 ? 'uma grafia guardada' : `${feito.apelidos.length} grafias guardadas`} para a próxima vez.</>}
        </div>
        {feito.criados.length > 0 && (
          <>
            <div className="section-title">➕ Criados nesta importação</div>
            <div className="stack">
              {feito.criados.map((id) => {
                const p = data.players.find((x) => x.id === id)
                return (
                  <div className="row" key={id}>
                    <Avatar player={p} size={30} />
                    <span className="grow ellipsis">{p?.name ?? '—'}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
        <button className="btn ghost block" style={{ marginTop: 12 }} onClick={desfazer}>
          ↩️ Desfazer esta importação
        </button>
        <button className="btn marca block" style={{ marginTop: 8 }} onClick={onClose}>
          Pronto
        </button>
        <p className="tiny muted" style={{ marginBottom: 0 }}>
          Se depois perceber que criou um atleta repetido, dá para juntar os dois
          {modo === 'cadastro' ? ' aqui mesmo' : <> na aba <strong>Jogadores</strong></>} — os
          pontos e a sequência dos dois se somam no que ficar.
        </p>
      </Modal>
    )
  }

  /* ------------------------------------------------------- conferir nomes */
  if (itens) {
    const conferir = itens.filter(precisaConferir).length
    const novas = itens.filter((i) => !i.vincularA).length
    return (
      <Modal title="Confira a lista" onClose={onClose}>
        <div className={`banner ${conferir ? 'warn' : 'info'}`} style={{ marginTop: 0 }}>
          {conferir === 0 ? (
            <>Reconheci todos os {itens.length} jogadores. Confira e aplique.</>
          ) : (
            <>
              Reconheci <strong>{itens.length - conferir}</strong> de {itens.length}.
              Nos <strong>{conferir}</strong> destacados abaixo eu não tenho certeza — diga se é
              alguém que já joga ou se é atleta novo.
            </>
          )}
        </div>

        {novas > 0 && (
          <div className="card" style={{ marginTop: 0, marginBottom: 12 }}>
            <div className="section-title" style={{ fontSize: 13 }}>
              {novas === 1 ? 'O novo atleta paga como' : 'Os novos atletas pagam como'}
            </div>
            <div className="chips-scroll">
              {CATEGORIAS.map((c) => (
                <button
                  key={c.valor}
                  className={`chip ${categoriaNovos === c.valor ? 'on' : 'off'}`}
                  style={{ flex: 'none' }}
                  onClick={() => trocarPadrao(c.valor)}
                >
                  {c.rotulo}
                </button>
              ))}
            </div>
            <p className="tiny muted" style={{ marginTop: 6, marginBottom: 0 }}>
              {CATEGORIAS.find((c) => c.valor === categoriaNovos)?.explica}. Isso vale para todos
              os novos — quem for exceção dá para trocar na linha dele, ali embaixo. Quem já
              está cadastrado mantém a categoria dele.
            </p>
          </div>
        )}

        <div className="stack">
          {itens.map((it, idx) => {
            const atencao = precisaConferir(it)
            const resto = ordenadas.filter((p) => !it.sugestoes.some((s) => s.player.id === p.id))
            return (
              <div key={idx} className={`import-row${atencao ? ' atencao' : ''}`}>
                <div className="row" style={{ gap: 8 }}>
                  <strong className="grow ellipsis">{it.texto}</strong>
                  <span className="tiny nowrap" style={{ fontWeight: 800, color: atencao ? 'var(--bronze)' : 'var(--verde)' }}>
                    {it.origem === 'exata' && 'já cadastrado'}
                    {it.origem === 'apelido' && 'apelido conhecido'}
                    {it.origem === 'parecida' && !atencao && 'reconhecido'}
                    {atencao && (it.vincularA ? 'confira' : 'novo?')}
                  </span>
                </div>
                <select
                  className="select"
                  style={{ marginTop: 6 }}
                  value={it.vincularA ?? 'nova'}
                  onChange={(e) => trocar(idx, e.target.value)}
                >
                  <option value="nova">➕ Criar "{it.texto}" como atleta novo</option>
                  {it.sugestoes.length > 0 && (
                    <optgroup label="Parece com">
                      {it.sugestoes.map((s) => (
                        <option key={s.player.id} value={s.player.id}>
                          É o {s.player.name} ({Math.round(s.score * 100)}%)
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Outros jogadores">
                    {resto.map((p) => (
                      <option key={p.id} value={p.id}>É o {p.name}</option>
                    ))}
                  </optgroup>
                </select>

                {!it.vincularA && (
                  <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    <span className="tiny muted nowrap">paga como</span>
                    {CATEGORIAS.map((c) => (
                      <button
                        key={c.valor}
                        className={`chip ${categoriaDoItem(it.texto) === c.valor ? 'on' : 'off'}`}
                        style={{ flex: 'none', padding: '2px 8px', fontSize: 12 }}
                        onClick={() => ajustar(it.texto, c.valor)}
                      >
                        {c.rotulo}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="row" style={{ gap: 8, marginTop: 14 }}>
          <button className="btn ghost grow" onClick={() => setItens(null)}>← Voltar</button>
          <button className="btn marca grow" onClick={aplicar}>
            {modo === 'play'
              ? `Confirmar ${itens.length}${novas > 0 ? ` (${novas} novo${novas > 1 ? 's' : ''})` : ''}`
              : novas > 0
                ? `Cadastrar ${novas} novo${novas > 1 ? 's' : ''}`
                : 'Confirmar'}
          </button>
        </div>
      </Modal>
    )
  }

  /* --------------------------------------------------------- colar a lista */
  return (
    <Modal
      title={modo === 'play' ? 'Colar lista do grupo' : 'Cadastrar vários de uma vez'}
      onClose={onClose}
    >
      <p className="small muted" style={{ marginTop: 0 }}>
        {modo === 'play' ? (
          <>
            Cole aqui a lista de confirmação do WhatsApp, do jeito que veio. Eu tiro a numeração e
            procuro cada nome na base de jogadores.
          </>
        ) : (
          <>
            Cole a lista do grupo do jeito que veio. Eu tiro a numeração, reconheço quem já está
            cadastrado e crio só quem falta — ninguém é marcado para play nenhum.
          </>
        )}
      </p>
      <textarea
        className="input"
        rows={9}
        placeholder={'1- Ingryd\n2- Pamella\n3- Ana Christo\n4- Tete\n…'}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        style={{ resize: 'vertical', fontFamily: 'inherit' }}
      />
      <button className="btn marca block" style={{ marginTop: 12 }} disabled={!texto.trim()} onClick={conferir}>
        🔎 Conferir nomes
      </button>
    </Modal>
  )
}
