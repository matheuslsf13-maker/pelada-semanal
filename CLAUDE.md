# Pelada Semanal — guia rápido do projeto

Clone do app de campeonato de **beach tennis**, para o grupo masculino.
O original (feminino) e outro repositorio e outro banco: **nao compartilham
nada**.

App do campeonato de **beach tennis** feminino do grupo, jogado toda
**segunda às 20h**. Monta duplas equilibradas, lança placares, fecha o dia e o
mês, e mostra rankings e estatísticas. Tudo é operado principalmente **pelo
celular**.

**Antes de mudar regra do campeonato, algoritmo de duplas ou o "quem está em
quadra", leia [`DECISOES.md`](DECISOES.md)** — ele guarda o que já foi medido e
descartado, para não refazer discussão encerrada.

## Stack

React 18 + TypeScript + Vite 5. Sem router (o estado das abas fica no `App.tsx`).
PWA (manifest + service worker). Português do Brasil em toda a interface.

## Comandos

```bash
npm run dev      # servidor local em http://localhost:5173
npm run build    # tsc -b + vite build (use antes de commitar)
npx tsc --noEmit # só a checagem de tipos
```

## Mapa do código

```
src/pages/       telas: Play.tsx (a maior), Ranking.tsx, Stats.tsx, Players.tsx
src/lib/         regras: pairing (fila de partidas e grupos), scoring,
                 streaks (status 🔥), stats, mensalidade (quem pode entrar),
                 roster (importar lista), emQuadra (horários locais), store
src/data/        armazenamento: localRepo (navegador) e supabaseRepo, com fila
                 de escrita otimista que sobrevive a refresh (queue.ts)
src/config.ts    URL e chave pública do Supabase (NUNCA a secret/service_role)
supabase/*.sql   migrações, rodadas na ordem numérica no SQL Editor
```

⚠️ Duas colunas do banco têm nome enganoso, mantido para não migrar dados:
`matches.round` é a **posição na fila** (não existe mais rodada) e
`sessions.rounds` é o **total de partidas do dia**.

`hasSupabase` decide qual driver é usado. Escrita exige login; leitura é pública.

## Regras do campeonato (não invente, elas são específicas)

- Partida até 4 games. Pontos = games do vencedor − do perdedor (mínimo 1).
  Quem perde não pontua.
- **O empate no fim é configurável** (`sessions.desempate`, `src/lib/desempate.ts`).
  São **três modos**, e o que muda é o que acontece no `alvo-1`x`alvo-1` (o 3x3):
  - `alvo` — quem chegar ao alvo primeiro leva; 3x3 vira 4x3.
  - `vantagem` — “só vai a 2”: segue até abrir dois games, **sem teto**.
  - `vantagem-tie7` / `vantagem-tie10` — vai a 2 até o `alvo`x`alvo`, e dali um
    tie decide. Numa partida de 6: 5x5 fecha em 7x5, 6x6 vai ao tie e fica 7x6.
    É o **único modo com teto** — o “vai a 2” puro pode se arrastar e travar a
    quadra.
  **O tie sempre vai a 2** (7x5 vale, 7x6 não). Não existe opção para isso: é como
  o grupo joga, e é uma pergunta a menos na tela. O que se escolhe é o tamanho,
  7 ou 10. `lerRegra` ainda entende os valores que versões anteriores gravaram
  (`tie7`, `tie7v2`, `vantagem-tie10v2`…), então nenhum play migra; um play
  gravado com o tie caindo **direto** no 3x3 continua sendo lido e explicado
  certo (`tieDireto`), só não dá mais para escolher isso.
  **Só a vantagem muda o que dá para lançar**, porque é a única em que o vencedor
  passa do alvo; os botões do placar passam a mostrar o placar inteiro (5x3,
  7x5, 7x6). O tie decide o game que fecha, então nunca aparece no placar.
  **No `grupos-duplas` a regra é por fase** (`sessions.desempates`, mesma conta
  do `alvos`): o seletor fica embaixo dos games de cada fase, então os grupos
  podem fechar no 4 seco e a final ir a 2.
- **Cada grupo tem uma cor** (`--g1`…`--g8`, `classeDoGrupo`), na etiqueta, na
  caixa do grupo, na linha da fila e na borda do cartão da partida. São cores
  escolhidas para se distinguirem **entre si** na beira da quadra, e por isso
  não saem da paleta da marca.
- **Não há rodadas.** O play é uma **fila de partidas**; cada quadra que vaga
  puxa da fila a partida cujas quatro jogadores estão livres, dando preferência a
  quem está fora há mais tempo (`proximasDasQuadras`).
- Rodízio completo: cada um faz dupla com cada um dos outros exatamente uma
  vez. **Todos jogam o mesmo número de partidas.** Quando a conta não fecha
  (grupos de 6, 7, 10, 11), algumas duplas repetem — escolhidas para que cada
  jogador repita a mesma quantidade (`repeticoesPorJogador`). **Quem enfrenta quem também é escolhido**, sempre pela dupla que menos
  se enfrentou até ali — o alvo é espalhar, não zerar (é impossível zerar).
- **Três formatos**, escolhidos ao criar o play. O terceiro,
  **`grupos-duplas`**, tem duas fases:
  - *Fase 1*: grupos **equilibrados entre si** (`gruposEquilibrados`, serpentina)
    — não é a divisão por nível dos outros formatos. Ser 1º precisa custar o
    mesmo em qualquer grupo, senão a fase 2 fica injusta. Dentro do grupo, o
    rodízio de sempre.
  - *Fase 2*: **dupla fixa por colocação**. Ordena todos por posição no grupo
    (os 1º primeiro, depois os 2º…) e junta os **vizinhos** dessa fila — assim
    melhor com melhor, e com número ímpar de grupos a sobra cai no vizinho de
    cima em vez de num nível diferente. Parceiro nunca é do mesmo grupo. As
    duplas viram **chaves** e jogam só dentro da chave.
  - A fase 2 **só nasce quando a fase 1 inteira tem placar** (botão "Montar as duplas e a chave"), porque depende da colocação final.
  - **Só a fase 2 vale pontos**, e o **pódio é das DUPLAS**: 🥇 campeã, 🥈 vice e
    🥉 a melhor semifinalista. Quem decide o dia é a dupla, e os grupos já se
    misturaram no mata-mata — não há pódio por grupo aqui. **O 🔥 segue esse mesmo
    pódio** (`rankDuplasDoDia`, compartilhado com a tela): são 6 de 16 num play típico,
    menos generoso que o modo em grupos, onde 4 grupos de 4 já levam 8 ao pódio.
    ⚠️ `computeStreaks` **descarta a fase 1** neste formato: ela não pontua, então não
    pode decidir quem segura a sequência.
  - **O mata-mata tem tamanho alvo em duplas** (`sessions.duplas_mm`, padrão 8 =
    16 atletas = quartas). Sobrando gente, os **piores colocados da fase de
    grupos ficam de fora**: com 20 atletas saem 4 e ficam 16. Faltando, todos
    entram e os melhores passam de bye (12 atletas = 6 duplas, 2 byes).
  - *Fase 2 em diante*: **mata-mata**. As duplas se cruzam pelas pontas (a
    melhor pega a pior) e quem perde sai. As melhores passam de **bye** quando o
    total não é potência de 2 — com 12 atletas, as duas primeiras duplas vão
    direto à semifinal. `matches.fase` cresce a cada rodada; o nome (quartas,
    semi, final) sai de quantas duplas sobram, não do número da fase.
  - **Pontos por fase**: `sessions.alvos` guarda `[grupos, duplas, semi, final]`,
    então a final pode ser mais longa que os grupos.
  - Desempate da colocação no grupo: pontos → diferença de games → vitórias →
    **confronto direto** → nome. Nunca há empate real: a colocação sai por
    posição na lista ordenada.
  - `matches.fase` (1 a 4) separa as fases; `sessions.duos` guarda as duplas.
  - **Não existe “Vai até” nem desempate único neste formato**: cada fase tem os seus games
    (`sessions.alvos`), então o campo some da tela de criar. O padrão de
    jogadores por grupo também muda para **4** ao escolher o formato, que é
    como o grupo joga.
  - **O botão da próxima fase fica embaixo**, num cartão próprio logo antes do
    “Finalizar o play”, e enquanto falta fase o finalizar vira `ghost` e pede
    confirmação. Ele ficava no meio dos botões do topo e quem rolava até o fim
    encontrava primeiro o botão que encerra tudo — encerrar antes do mata-mata
    deixa o play **sem pódio**, porque a fase 1 não pontua.
  - **O ranking do dia mostra as DUPLAS** (`DuplasDoDia`), antes do individual.
    No mata-mata os dois de uma dupla ganham e perdem as mesmas partidas, então
    empatam em tudo — nenhum critério os separa, e não é falta de desempate. A
    ordem das duplas é **até onde chegaram** (a maior `fase` que jogaram), e só
    depois vitórias/pontos/saldo: com bye, quem foi direto à semi tem uma
    vitória a menos que quem ganhou as quartas, e as duas caíram na mesma altura.
- **Dois formatos** clássicos, também escolhidos ao criar o play: `todos` (rodízio único) e
  `grupos` (o mesmo rodízio dentro de grupos formados por nível, grupo 1 com as
  mais bem pontuadas). Nos grupos os pontos continuam **individuais** e o
  ranking do dia é **um só** — mas o **pódio é um por grupo**. No fim do play a
  organizador escolhe se gera o texto e a arte de **todos os grupos ou de um
  só** (chips "Tudo / Grupo 1 / Grupo 2…" no modal do ranking do dia), e os dois
  saem carimbados com o grupo. O status de **cada** medalhista aparece no texto
  e na imagem.
- **Status 🔥**: mantido terminando o play no **pódio do dia** (top 3; nos
  grupos, o top 3 **de cada grupo**, nunca mais que metade do grupo —
  `vagasDoPodio`). Faltar zera o status, mesmo com vida. Escada em
  `src/lib/streaks.ts`, de
  🔥 *Em chamas* (2) até 👑💎🌟 **Craque da temporada** (8+). No fim do mês o jogador
  escolhe **usar** (vira pontos, zera) ou **preservar** (segue e ganha 1 vida).
- **O mês fecha na mão**, no botão "🏁 Finalizar o mês" do Ranking (dá para
  reabrir). A premiação acontece no último play do mês, antes de o calendário
  virar.
- **A força é visível** (`src/lib/forca.ts`, aba “💪 Força” em Stats, na ficha do
  atleta e na linha dele em Jogadores). É o mesmo Elo que sempre montou os grupos
  e as duplas — só que agora com um número e um nível na tela. A escala mostrada
  é a clássica, **1500 no meio**, e isso importa: o Elo é **soma zero**, então a
  média do grupo não se move e as faixas continuam querendo dizer a mesma coisa no
  ano que vem. As faixas (±25 / ±75) saem de uma temporada simulada de 12 noites
  com 16 atletas, que espalhou o grupo de −107 a +91. Abaixo de
  `JOGOS_PARA_FIRMAR` a nota sai marcada como **provisória**, e quem nunca jogou
  fica fora da lista — a nota dele seria a média por falta de informação, não por
  equilíbrio.
- **A dupla tem força própria** (`forcaDeDuplas`, aba “🤝 Dupla” em Stats). Não é a
  média dos dois — essa é só o **ponto de partida**. A partir dela, cada partida
  **daquela dupla** move a nota pela fórmula do Elo, então `nota − base` é o
  **entrosamento**: dois medianos que se acham em quadra rendem mais do que a
  soma das notas diz, e isso não aparece na nota individual de ninguém.
  Começar do zero em vez da média jogaria fora tudo o que o app já sabe sobre
  cada um e deixaria toda dupla nova sem nota.
- **O entrosamento entra no balanceamento** (`ajusteDeEntrosamento` →
  `ScheduleOptions.entrosamento` → `forcaDuo`). Escolher quem enfrenta quem
  usando só a média individual ignorava que certas duplas rendem acima disso.
  Só entram duplas com `JOGOS_PARA_ENTROSAMENTO`+ jogos juntas: com duas ou três
  partidas o número é ruído, e ruído no confronto piora o equilíbrio em vez de
  melhorar. O ajuste entra **dobrado** em `forcaDuo` porque lá a conta é a soma
  das duas notas, e o entrosamento está medido por jogador.
- **O ranking zera todo mês, o histórico não.** A força que equilibra as duplas e
  divide os grupos sai de `ratings()`, que é um **Elo**: cada partida move a nota
  conforme quem estava do outro lado, então **vencer quem está melhor rende muito
  mais** do que vencer quem está pior. Não é o ranking do mês (senão o primeiro
  play do mês sairia desequilibrado) e não é média de pontos, que não sabe de quem
  você ganhou — e por isso quebrava no modo em grupos.
- **Quem paga define quem entra** (`src/lib/mensalidade.ts`). Três categorias, e
  a organização escolhe a de cada atleta ao cadastrar, ao importar a lista ou no
  "editar perfil":
  - **📅 Mensalista** — liberado enquanto `players.pago_mes` for o mês de hoje.
    A regra é **derivada do calendário**, não gravada: na virada do mês ele volta
    a aparecer devendo **sozinho**, sem rotina para rodar, esquecer ou rodar duas
    vezes.
  - **🎟️ Avulso** — `players.pago_avulso` é um crédito de **uma** participação,
    gasto por `consumirAvulsos()` quando o play é finalizado.
  - **🤝 Convidado** — não paga e nunca é bloqueado. Dois plays seguidos só
    acendem um **alerta âmbar** (`playsSeguidos`), porque quem decide se aquilo
    virou mensalista é a organização, não o app.
  - **Trocar de categoria zera o pagamento** — um mensalista que vira avulso não
    herda o mês pago, senão ficaria verde sem ter pago.
  - Na hora de escolher quem joga, tocar em quem está devendo **não bloqueia e
    pronto**: abre o `ResolverCadastro`, que confirma o pagamento ou corrige a
    categoria ali mesmo e já escala. Quase todo bloqueio é cadastro errado, não
    inadimplência — e mandar a pessoa até Jogadores perderia a lista montada.
    O botão "Todos" e a **lista colada** também respeitam o portão: da lista, quem
    está devendo não entra escalado — vai para um aviso amarelo onde cada nome
    abre o mesmo `ResolverCadastro`. A importação devolve os recém-criados por
    `onAplicar(ids, criados)` porque o `data` do Play ainda não viu o que ela
    acabou de gravar, e sem isso um atleta criado na hora escaparia do portão.
- **Colar a lista do grupo** (`ImportarLista`) serve **duas** telas, com a
  mesma conciliação de nomes e um `modo` diferente: em `play` marca presença no
  play que está sendo montado; em `cadastro` (aba Jogadores) só cria quem falta.
  Sem o segundo modo era preciso abrir um play só para cadastrar o grupo —
  justamente o que se faz **uma** vez, antes da primeira noite. Nos dois modos a
  importação guarda a grafia da lista como apelido, para a próxima reconhecer
  sozinha, e tem **desfazer** que apaga só quem nasceu ali.
  - **Os ícones da lista do WhatsApp são descartados** (`ICONES`, em
    `roster.ts`): emoji, ✅, tom de pele, seletor de variação e o ZWJ que gruda
    dois emoji. Saem **antes** da numeração, senão um "✅ 3 - Bruno" esconde o
    "3 -" do regex. A comparação já ignorava ícone (`normalizar` só olha letra e
    número) — o que estragava era o nome **criado**.
  - **A categoria é por atleta.** Há um padrão para o lote inteiro e, em cada
    linha que vai criar alguém, chips para a exceção — numa lista real o pessoal
    fixo entra mensalista e os convidados da semana não. O ajuste é guardado
    pelo **nome normalizado**, nunca pela posição: por índice, voltar e colar
    outra lista jogava "o 2º é avulso" em cima de outra pessoa. Trocar o padrão
    limpa os ajustes de propósito.
- **Play avulso** (`sessions.ranked = false`): conta no histórico e na força,
  mas **não soma no ranking do mês nem mexe nas sequências**. Serve para o jogo
  fora de calendário que não é o campeonato.
- **Partida iniciada**: quem está em quadra agora é definido pelo botão
  "▶️ Partida iniciada"; lançar o placar encerra. Isso alimenta o aviso de
  quadra parada e a troca de jogadores.
- A lista "Próximas na fila" usa `ordemPrevista()`, não a ordem gravada: mostrar
  a ordem de geração colocava na frente quem tinha acabado de sair da quadra.
- **O placar só é lançável depois de "▶️ Partida iniciada"** (botões de "venceu"
  desabilitados). Corrigir placar é o ✏️ da lista "Já jogadas", que abre um modal
  e **preserva o `ended_at`** — não devolve a partida para a fila.

## A tela é um celular na beira da quadra

- **A ordem de criar o play** é quem joga → **formato** → detalhes. O formato é a
  escolha que muda tudo o que vem depois, então tem cartão próprio logo abaixo
  dos participantes. Ele é uma **lista vertical**, não um `segmented`: três nomes
  longos lado a lado quebram no meio das palavras a 375px.
- **Rótulo em cima, controle embaixo.** O `.stepper` tem `input { flex: 1 }`, então
  a largura natural dele é a linha inteira — ao lado de um texto, ele cobre o
  texto. Como filho direto do `.field` funciona; num `.row`, não.
- `.field > span` vale para `label` **e** `div`. Enquanto só `label.field > span`
  tinha estilo, metade do formulário saia com rótulo pequeno em caixa alta e a
  outra metade com texto corrido do corpo.
- **Separador entre links é desenhado, não digitado** (`::before`). Como texto, o
  `·` conta como palavra e vai parar sozinho no fim da linha.
- **Nome de pessoa não quebra no meio**: o `span` de cada jogador é `nowrap` e
  carrega o `+` da frente, então a linha só parte entre os dois nomes da dupla.
- **Nada de `(s)`**: use `plural()` de `src/lib/types.ts`.
- ⚠️ Este projeto é clone de um app **feminino**. Ao mexer em texto, confira a
  concordância: `partida`, `dupla`, `quadra`, `rodada`, `chave` e `foto` continuam
  femininas — e **a campeã** também, porque quem vence o mata-mata é a dupla. O
  que muda é só o que se refere a pessoa.

## Convenções

- Comentários e nomes em português, sem acento em identificadores.
- Código sem dependências novas sempre que der; o bundle é servido para
  celulares em quadra.
- Rodar `npm run build` antes de commitar; o push na `main` publica o site.
