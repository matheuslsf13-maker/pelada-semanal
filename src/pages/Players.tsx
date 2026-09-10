import { useMemo, useRef, useState } from 'react'
import ImportarLista from '../components/ImportarLista'
import { Avatar, Empty, Modal } from '../components/ui'
import { rankingDeForca } from '../lib/forca'
import { squareThumb } from '../lib/image'
import { playedMatches } from '../lib/stats'
import {
  CATEGORIAS,
  categoriaDe,
  confirmarPagamento,
  desfazerPagamento,
  situacaoDoAtleta,
  type Categoria,
} from '../lib/mensalidade'
import { useStore } from '../lib/store'
import { jogadoresDaPartida } from '../lib/pairing'
import { plural, uid, type Player } from '../lib/types'

export default function Players({ onToast }: { onToast: (m: string) => void }) {
  const { data, savePlayer, deletePlayer, mergePlayers, canEdit, repo } = useStore()
  const [name, setName] = useState('')
  /** Categoria de quem for cadastrado agora; fica escolhida para o proximo. */
  const [novaCategoria, setNovaCategoria] = useState<Categoria>('mensalista')
  const [busy, setBusy] = useState<string | null>(null)
  const [juntando, setJuntando] = useState<Player | null>(null)
  const [editando, setEditando] = useState<Player | null>(null)
  const [importando, setImportando] = useState(false)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  /** Forca de cada atleta, para o nivel aparecer na linha dele. */
  const forcaPorId = useMemo(() => {
    const m = new Map<string, ReturnType<typeof rankingDeForca>[number]>()
    for (const l of rankingDeForca(data, (id) => data.players.find((p) => p.id === id)?.name ?? id)) {
      m.set(l.player_id, l)
    }
    return m
  }, [data])

  const sorted = [...data.players].sort(
    (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'pt-BR'),
  )

  async function add() {
    const n = name.trim()
    if (!n) return
    const p: Player = {
      id: uid(),
      name: n,
      photo_url: null,
      active: true,
      created_at: new Date().toISOString(),
      categoria: novaCategoria,
      pago_mes: null,
      pago_avulso: false,
    }
    await savePlayer(p)
    setName('')
    onToast(`${n} entrou no grupo 🎾`)
  }

  async function pickPhoto(p: Player, file: File | undefined) {
    if (!file) return
    setBusy(p.id)
    try {
      const thumb = await squareThumb(file)
      const url = await repo.uploadPhoto(p.id, thumb)
      const antiga = p.photo_url
      savePlayer({ ...p, photo_url: url })
      if (antiga) await repo.deletePhoto(antiga) // nao deixa arquivo orfao
      onToast('Foto atualizada 📸')
    } catch (e) {
      onToast('Erro ao enviar a foto')
      console.error(e)
    } finally {
      setBusy(null)
    }
  }

  async function removePhoto(p: Player) {
    if (!p.photo_url) return
    if (!confirm(`Remover a foto de ${p.name}? No lugar dela voltam as iniciais.`)) return
    setBusy(p.id)
    try {
      const antiga = p.photo_url
      savePlayer({ ...p, photo_url: null })
      await repo.deletePhoto(antiga)
      onToast('Foto removida')
    } catch (e) {
      onToast('Erro ao remover a foto')
      console.error(e)
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      {canEdit && (
        <div className="card">
          <div className="section-title">➕ Novo jogador</div>
          <div className="row">
            <input
              className="input grow"
              placeholder="Nome do jogador"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void add()}
            />
            <button className="btn marca" onClick={() => void add()} disabled={!name.trim()}>Add</button>
          </div>
          <div className="chips-scroll" style={{ marginTop: 8 }}>
            {CATEGORIAS.map((c) => (
              <button
                key={c.valor}
                className={`chip ${novaCategoria === c.valor ? 'on' : 'off'}`}
                style={{ flex: 'none' }}
                onClick={() => setNovaCategoria(c.valor)}
              >
                {c.rotulo}
              </button>
            ))}
          </div>
          <p className="tiny muted" style={{ marginTop: 6, marginBottom: 0 }}>
            {CATEGORIAS.find((c) => c.valor === novaCategoria)?.explica}
          </p>

          <button
            className="btn ghost block sm"
            style={{ marginTop: 12 }}
            onClick={() => setImportando(true)}
          >
            📋 Colar a lista do grupo e cadastrar vários
          </button>
        </div>
      )}

      {importando && (
        <ImportarLista
          modo="cadastro"
          onClose={() => setImportando(false)}
          onToast={onToast}
        />
      )}

      {editando && (
        <EditarPerfil
          jogador={editando}
          onClose={() => setEditando(null)}
          onSalvar={(p) => {
            void savePlayer(p)
            setEditando(null)
            onToast('Perfil salvo ✅')
          }}
        />
      )}

      {juntando && (
        <JuntarJogadores
          origem={juntando}
          onClose={() => setJuntando(null)}
          onJuntar={(destinoId) => {
            mergePlayers(juntando.id, destinoId)
            setJuntando(null)
            onToast('Jogadores juntadas 🔗')
          }}
        />
      )}

      <div className="card">
        <div className="section-title">👥 Jogadores ({data.players.filter((p) => p.active).length} ativos)</div>
        {sorted.length === 0 ? (
          <Empty icon="👥">Cadastre os jogadores do grupo para começar.</Empty>
        ) : (
          <div className="stack">
            {sorted.map((p) => (
              <div key={p.id} className="atleta-linha" style={{ opacity: p.active ? 1 : 0.5 }}>
                <div className="row">
                <button
                  className="avatar"
                  title="Trocar foto"
                  style={{ width: 44, height: 44, border: 0, padding: 0, cursor: canEdit ? 'pointer' : 'default' }}
                  onClick={() => canEdit && fileRefs.current[p.id]?.click()}
                >
                  <Avatar player={p} size={44} />
                </button>
                <input
                  ref={(el) => { fileRefs.current[p.id] = el }}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => void pickPhoto(p, e.target.files?.[0])}
                />
                <div className="grow">
                  <div style={{ fontWeight: 700 }} className="ellipsis">
                    {p.nickname?.trim() || p.name}
                  </div>
                  {p.nickname?.trim() && p.nickname.trim() !== p.name && (
                    <div className="tiny muted ellipsis">{p.name}</div>
                  )}
                  <SinalDePagamento jogador={p} />
                  {(() => {
                    const f = forcaPorId.get(p.id)
                    if (!f) return null
                    return (
                      <div className="tiny nowrap" style={{ marginTop: 2 }}>
                        <span style={{ color: f.nivel.cor, fontWeight: 800 }}>
                          {f.nivel.emoji} {f.nivel.titulo}
                        </span>
                        <span className="muted"> · força {f.nota}</span>
                        {f.provisoria && <span className="muted"> (provisória)</span>}
                      </div>
                    )
                  })()}
                  <div className="tiny muted acoes-atleta">
                    {busy === p.id ? (
                      'salvando foto…'
                    ) : (
                      <>
                        {!p.active && <span className="pausado">pausado</span>}
                        {canEdit && (
                          <>
                            <button className="linkish" onClick={() => setEditando(p)}>
                              editar perfil
                            </button>
                            <button className="linkish" onClick={() => fileRefs.current[p.id]?.click()}>
                              {p.photo_url ? 'trocar foto' : 'pôr foto'}
                            </button>
                            {p.photo_url && (
                              <>
                                <button className="linkish" onClick={() => void removePhoto(p)}>
                                  remover foto
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
                </div>

                {canEdit && (
                  <div className="row spread atleta-acoes">
                    <div className="row" style={{ gap: 6 }}>
                    <button className="btn ghost sm" onClick={() => void savePlayer({ ...p, active: !p.active })}>
                      {p.active ? 'Pausar' : 'Ativar'}
                    </button>
                    <button className="btn ghost sm" title="juntar com outro jogador" onClick={() => setJuntando(p)}>
                      🔗
                    </button>
                    <button
                      className="btn danger sm"
                      onClick={() => {
                        if (confirm(`Remover ${p.name}? O histórico de partidas dele continua salvo.`)) {
                          void deletePlayer(p.id)
                        }
                      }}
                    >
                      🗑
                    </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="tiny muted" style={{ marginBottom: 0 }}>
          Criou o mesmo atleta duas vezes? Toque em <strong>🔗</strong> para juntar os dois:
          partidas, pontos e sequência dos dois passam para o que ficar.{' '}
          A foto aparece no pódio do ranking mensal. Toque na foto (ou em <em>pôr/trocar foto</em>) para escolher,
          e em <em>remover foto</em> para voltar às iniciais.
          Quem está <strong>pausado</strong> não aparece na hora de montar o play, mas mantém o histórico.
        </p>
      </div>
    </>
  )
}

/** Junta um jogador duplicado em outro, preservando o historico dos dois. */
function JuntarJogadores({
  origem,
  onClose,
  onJuntar,
}: {
  origem: Player
  onClose: () => void
  onJuntar: (destinoId: string) => void
}) {
  const { data } = useStore()
  const [destino, setDestino] = useState('')
  const outras = [...data.players]
    .filter((p) => p.id !== origem.id)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const alvo = outras.find((p) => p.id === destino)
  const jogos = data.matches.filter((m) => [...m.team_a, ...m.team_b].includes(origem.id)).length

  return (
    <Modal title={`Juntar ${origem.name}`} onClose={onClose}>
      <p className="small muted" style={{ marginTop: 0 }}>
        Use quando o mesmo atleta foi cadastrado duas vezes com nomes diferentes.
        As <strong>{plural(jogos, 'partida')}</strong> de {origem.name} passam para o jogador escolhido,
        somando pontos e mantendo a sequência dele. Depois disso, <strong>{origem.name}</strong> deixa de existir.
      </p>
      <label className="field">
        <span>{origem.name} é a mesma pessoa que…</span>
        <select className="select" value={destino} onChange={(e) => setDestino(e.target.value)}>
          <option value="">escolha o jogador que fica</option>
          {outras.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>
      <button
        className="btn marca block"
        style={{ marginTop: 12 }}
        disabled={!alvo}
        onClick={() => {
          if (!alvo) return
          if (
            confirm(
              `Juntar "${origem.name}" em "${alvo.name}"?\n\n` +
                `As partidas de ${origem.name} passam para ${alvo.name} e o nome "${origem.name}" some da lista.\n\n` +
                `Essa ação não tem volta.`,
            )
          ) {
            onJuntar(alvo.id)
          }
        }}
      >
        🔗 Juntar em {alvo?.name ?? '…'}
      </button>
    </Modal>
  )
}

/**
 * Editar o perfil do jogador.
 *
 * O nome e so um ROTULO: cada jogador tem um id proprio e as partidas guardam
 * esse id, nunca o nome. Renomear nao mexe em partida, ponto nem sequencia --
 * e o modal mostra o tamanho do historico dele justamente para deixar isso
 * visivel na hora de trocar.
 *
 * Os apelidos sao os outros grafias que a lista do grupo ja usou para ela. Sao
 * eles que fazem a importacao do WhatsApp cair na pessoa certa em vez de criar
 * uma segunda cadastrada com o nome escrito de outro jeito.
 */
function EditarPerfil({
  jogador,
  onClose,
  onSalvar,
}: {
  jogador: Player
  onClose: () => void
  onSalvar: (p: Player) => void
}) {
  const { data } = useStore()
  const [nome, setNome] = useState(jogador.name)
  const [apelido, setApelido] = useState(jogador.nickname ?? '')
  const [categoria, setCategoria] = useState<Categoria>(categoriaDe(jogador))
  const [apelidos, setApelidos] = useState((jogador.aliases ?? []).join('\n'))

  const historico = useMemo(() => {
    const jogadas = playedMatches(data).filter((m) => jogadoresDaPartida(m).includes(jogador.id))
    const dias = new Set(jogadas.map((m) => m.session_id)).size
    return { partidas: jogadas.length, dias }
  }, [data, jogador.id])

  const limpo = nome.trim()
  const repetido = data.players.some(
    (p) => p.id !== jogador.id && p.name.trim().toLowerCase() === limpo.toLowerCase(),
  )

  function salvar() {
    const lista = apelidos
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean)
    // trocar de categoria zera o pagamento: um mensalista que virou avulso nao
    // herda o mes pago, e vice-versa -- senao alguem ficaria verde sem ter pago
    const mudou = categoria !== categoriaDe(jogador)
    onSalvar({
      ...jogador,
      name: limpo,
      nickname: apelido.trim() || null,
      aliases: [...new Set(lista)],
      categoria,
      pago_mes: mudou ? null : jogador.pago_mes,
      pago_avulso: mudou ? false : jogador.pago_avulso,
    })
  }

  return (
    <Modal title={`Perfil de ${jogador.name}`} onClose={onClose}>
      <label className="field">
        <span>Nome de cadastro</span>
        <input className="input" value={nome} autoFocus onChange={(e) => setNome(e.target.value)} />
      </label>
      <p className="tiny muted" style={{ marginTop: 6 }}>
        O nome completo, para conferir a lista sem confundir dois Joões. Só aparece aqui.
      </p>

      <label className="field" style={{ marginTop: 12 }}>
        <span>Apelido — como aparece na quadra</span>
        <input
          className="input"
          value={apelido}
          placeholder={nome.split(' ')[0] || 'como o grupo chama'}
          onChange={(e) => setApelido(e.target.value)}
        />
      </label>
      <p className="tiny muted" style={{ marginTop: 6 }}>
        É este que vai para o ranking, as partidas, o texto do WhatsApp e as artes. Deixe vazio
        para usar o nome de cadastro.
      </p>
      {repetido && (
        <div className="banner warn" style={{ marginTop: 8 }}>
          Já existe outro jogador com esse nome. Se for a mesma pessoa cadastrada duas vezes,
          feche aqui e use o <strong>🔗</strong> para juntar os dois.
        </div>
      )}

      <div className="field" style={{ marginTop: 12 }}>
        <span>Como ele paga</span>
        <div className="chips-scroll">
          {CATEGORIAS.map((c) => (
            <button
              key={c.valor}
              className={`chip ${categoria === c.valor ? 'on' : 'off'}`}
              style={{ flex: 'none' }}
              onClick={() => setCategoria(c.valor)}
            >
              {c.rotulo}
            </button>
          ))}
        </div>
        <em className="hint" style={{ marginTop: 6 }}>
          {CATEGORIAS.find((c) => c.valor === categoria)?.explica}
          {categoria !== categoriaDe(jogador) && ' — trocar de categoria zera o pagamento atual.'}
        </em>
      </div>

      <label className="field" style={{ marginTop: 12 }}>
        <span>Outras grafias do nome (uma por linha)</span>
        <textarea
          className="input"
          rows={3}
          value={apelidos}
          placeholder={'João\nJoãozinho\nJoão Pedro'}
          onChange={(e) => setApelidos(e.target.value)}
        />
      </label>
      <p className="tiny muted" style={{ marginTop: 6 }}>
        É por aqui que a importação da lista do grupo acerta a pessoa. Se ela aparece na lista às
        vezes como <em>João</em> e às vezes como <em>Joãozinho</em>, escreva os dois — assim o app não
        cadastra uma segunda.
      </p>

      <div className="banner info" style={{ marginTop: 12 }}>
        📚 <strong>{plural(historico.partidas, 'partida')}</strong> em{' '}
        <strong>{plural(historico.dias, 'play')}</strong> no histórico dele. Trocar o nome{' '}
        <strong>não mexe em nada disso</strong>: as partidas ficam ligadas ao cadastro, não ao nome
        escrito.
      </div>

      <button
        className="btn marca block"
        style={{ marginTop: 12 }}
        disabled={!limpo}
        onClick={salvar}
      >
        Salvar
      </button>
      <button className="btn ghost block sm" style={{ marginTop: 8 }} onClick={onClose}>
        Cancelar
      </button>
    </Modal>
  )
}


/**
 * O semaforo do pagamento, na linha do atleta.
 *
 * Verde nao quer dizer "pagou alguma vez": quer dizer "pode entrar no proximo
 * play". Por isso o mensalista fica vermelho sozinho na virada do mes e o
 * avulso volta ao vermelho depois de jogar -- a regra e derivada, ninguem
 * precisa lembrar de zerar nada.
 */
function SinalDePagamento({ jogador }: { jogador: Player }) {
  const { data, savePlayer, canEdit } = useStore()
  const categoria = categoriaDe(jogador)
  const sit = situacaoDoAtleta(jogador, data)
  const cor =
    sit.cor === 'ok' ? 'var(--verde)' : sit.cor === 'atencao' ? 'var(--ouro)' : 'var(--danger)'

  return (
    <div className="tiny" style={{ marginTop: 2 }}>
      <span className="nowrap" style={{ color: cor, fontWeight: 800 }}>
        ● {sit.rotulo}
      </span>
      {canEdit && categoria !== 'convidado' && (
        <>
          {' · '}
          <button
            className="linkish"
            onClick={() =>
              void savePlayer(
                sit.liberado ? desfazerPagamento(jogador) : confirmarPagamento(jogador),
              )
            }
          >
            {sit.liberado ? 'desfazer' : 'confirmar pagamento'}
          </button>
        </>
      )}
      {sit.alerta && (
        <div className="tiny" style={{ color: 'var(--ouro)', marginTop: 2 }}>⚠️ {sit.alerta}</div>
      )}
    </div>
  )
}
