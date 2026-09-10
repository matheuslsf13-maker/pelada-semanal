import { avisosDoBanco } from '../data/supabaseRepo'
import { hasSupabase } from '../lib/supabase'
import { useStore } from '../lib/store'

/**
 * O QUE O BANCO NAO ACEITOU
 *
 * Quando uma migracao ainda nao rodou, o app grava o que cabe e segue -- se
 * travasse tudo, uma coluna nova impediria de lancar placar numa sexta a noite.
 * O problema e que isso, calado, vira mistério: confirmar pagamento nao gruda,
 * um play de "grupos + duplas" abre como "todos com todos", e nada explica.
 *
 * Este aviso e a outra metade daquela escolha: o app segue funcionando, e diz
 * o que ficou de fora.
 */
export function AvisoDoBanco() {
  const { data } = useStore()

  // detecta antes mesmo de tentar gravar: com atletas carregados e nenhum
  // trazendo `categoria`, a coluna nao existe la (quando existe, vem do default)
  const semPagamento =
    hasSupabase && data.players.length > 0 && data.players.every((p) => p.categoria === undefined)

  const colunas = [...avisosDoBanco.colunas]
  if (semPagamento && colunas.length === 0) colunas.push('players.categoria')
  if (colunas.length === 0) return null

  return (
    <div className="banner warn">
      ⚠️ <strong>O banco ainda não tem {colunas.length === 1 ? 'esta coluna' : 'estas colunas'}:</strong>{' '}
      {colunas.map((c) => <code key={c}>{c}</code>).reduce((a, b) => (
        <>
          {a}, {b}
        </>
      ))}
      . O app continua funcionando, mas <strong>o que depende delas não fica guardado</strong> —
      rode os scripts que faltam da pasta <code>supabase/</code>, na ordem numérica, e crie o play
      de novo.
    </div>
  )
}
