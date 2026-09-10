# O que este app ganhou, e o que dá para levar para o feminino

Este repositório nasceu como **cópia do Play de Todas** (o campeonato feminino
da V3 Arena). Depois da cópia, ele andou bastante — e quase tudo o que andou é
regra de campeonato ou de tela, não identidade. Ou seja: **dá para levar de
volta**.

Este arquivo é a lista, na ordem de importância, com o que muda em cada lado.
Serve de roteiro para portar; o *porquê* de cada decisão está em
[`DECISOES.md`](DECISOES.md) e em [`CLAUDE.md`](CLAUDE.md).

---

## 1. Um terceiro formato de play: **grupos + duplas**

O maior. Antes existiam dois formatos (`todos` e `grupos`); agora há um
terceiro, com **duas fases**:

**Fase 1 — grupos equilibrados.** Diferente do modo `grupos`, onde o grupo 1
leva as melhores de propósito, aqui os grupos têm a **mesma força média**
(distribuição em serpentina). Isso é obrigatório: ser 1º precisa custar o mesmo
em qualquer grupo, senão a fase 2 já nasce injusta. Dentro do grupo, o rodízio
de sempre.

**Fase 2 — dupla fixa por colocação.** Ordena todo mundo por posição no grupo
(os 1º primeiro, depois os 2º…) e junta os **vizinhos** dessa fila. Assim melhor
com melhor, e com número ímpar de grupos a sobra cai no vizinho de cima em vez
de num nível diferente. Parceiro **nunca é do mesmo grupo**.

**Mata-mata.** As duplas viram chave, quem perde sai, e as melhores da fase de
grupos passam de **bye** quando o total não é potência de 2.

- `sessions.duplas_mm` define **quantas duplas entram** (padrão 8 = 16 atletas =
  quartas). Sobrando gente, os piores colocados ficam de fora: com 20 atletas
  saem 4. Faltando, todos entram e os melhores pegam bye.
- `sessions.alvos` guarda os **games de cada fase**: `[grupos, duplas, semi,
  final]`. A final pode ser mais longa que os grupos.
- **Só a fase 2 vale pontos** no pódio do dia, e o pódio é um só, no fim.
- Desempate da colocação no grupo: pontos → diferença de games → vitórias →
  **confronto direto** → nome.
- O botão da próxima fase fica **no rodapé**, junto do "finalizar o play", e
  encerrar antes do mata-mata pede confirmação — a fase 1 não pontua, então
  encerrar ali apaga a noite.
- O ranking do dia mostra **as duplas**, ordenadas por até onde chegaram (a
  maior fase que jogaram) e só depois por vitórias. Com bye, quem foi direto à
  semi tem uma vitória a menos que quem ganhou as quartas — e as duas caíram na
  mesma altura.

> **Conferido:** 3.375 combinações (8 a 32 atletas × grupos de 4 a 12 × alvo de
> 2 a 16). Os três casos que o organizador descreveu batem exatos: 16 atletas →
> 8 duplas, quartas; 12 → 6 duplas, 2 byes; 20 → 8 duplas, 4 cortados.
>
> **Um caso conhecido:** com número **ímpar** de grupos e um grupo maior (16
> atletas em grupos de 5 → 5+5+6), a última dupla acaba sendo dois do mesmo
> grupo — são os dois últimos que sobraram, não existe mais ninguém. Sempre
> exatamente 1 dupla, sempre a mais fraca. Com grupos de 4 nunca acontece.

**No feminino:** entra igual. Só o vocabulário muda (jogadora, colocada).

---

## 2. Desempate configurável

Antes a partida ia até 4 e quem chegasse primeiro levava, ponto. Agora o play
escolhe **o que acontece no 3x3**:

| escolha | o que é | placares possíveis (partida de 4) |
|---|---|---|
| Quem chegar leva | como era | 4x0 … 4x3 |
| Só vai a 2 | segue até abrir dois games, **sem teto** | 4x0 4x1 4x2 5x3 6x4 7x5… |
| Vai a 2 e depois tie | vai a 2 até o 4x4; dali o tie decide | 4x0 4x1 4x2 5x3 5x4 |

O tie é de **7** ou o **super tie de 10**, e **sempre vai a 2** (7x5 vale, 7x6
não) — isso é regra fixa, não pergunta.

O terceiro modo é o único com **teto**: o "vai a 2" puro pode se arrastar e
travar a quadra. Numa partida de 6: 5x5 fecha em 7x5, e 6x6 vai ao tie e fica
7x6.

**Só o "vai a 2" muda o que dá para lançar** — é o único em que o vencedor passa
do alvo, e os botões do placar passam a mostrar o placar inteiro. Com tie, o
placar em games não muda (o tie decide o game que fecha), então ali a
configuração só muda a regra anunciada na tela — o que já vale, porque é o que a
organização combina com a quadra antes de começar.

**No `grupos + duplas` a regra é por fase**, num seletor embaixo dos games de
cada fase: os grupos podem fechar no 4 seco e a final ir a 2.

**No feminino:** entra igual, sem mudança nenhuma de regra.

---

## 3. A força ficou visível, e a dupla ganhou a dela

O Elo sempre existiu nos dois apps — é ele que monta os grupos equilibrados e
escolhe as duplas —, mas rodava por baixo do pano.

**Força do atleta.** Agora tem número e nível, numa aba própria em Stats, na
ficha do atleta e na linha dele em Jogadores. A escala é a clássica, **1500 no
meio**, e isso importa: o Elo é **soma zero**, então a média do grupo não se move
e as faixas continuam querendo dizer a mesma coisa no ano que vem.

As faixas (±25 e ±75) não são chute — saíram de uma temporada simulada de 12
noites com 16 atletas, que espalhou o grupo de −107 a +91. Abaixo de 12 partidas
a nota sai marcada como **provisória**, e quem nunca jogou fica fora da lista.

**Força da dupla.** Duas pessoas medianas podem render mais juntas do que a soma
das notas diz, e isso não aparecia na nota individual de ninguém. A força da
dupla **parte da média dos dois** (que já carrega tudo o que o app sabe sobre
cada um) e, dali, cada partida **daquela dupla** move a nota pela fórmula do
Elo. A diferença entre a nota e a média é o **entrosamento**.

**E isso volta para o balanceamento.** O `forcaDuo` — a função que decide quem
enfrenta quem — passou a somar o entrosamento. Antes ele comparava só a média
individual dos quatro, então uma dupla que rende acima disso pegava adversária
fraca demais. Só entram duplas com **6+ jogos juntas**: com duas ou três
partidas o número é ruído, e ruído no confronto piora o equilíbrio.

**No feminino:** entra igual. É a mudança que mais melhora o jogo sem mudar
regra nenhuma.

---

## 4. Quem paga define quem entra

*(Este é o único item que talvez não sirva ao feminino — depende de como o grupo
cobra. O resto é neutro.)*

Três categorias, escolhidas ao cadastrar, ao importar a lista ou no editar
perfil:

- **📅 Mensalista** — liberado enquanto `pago_mes` for o mês de hoje. A regra é
  **derivada do calendário**: na virada do mês ele volta a aparecer devendo
  sozinho, sem rotina para rodar, esquecer ou rodar duas vezes.
- **🎟️ Avulso** — crédito de **uma** participação, gasto quando o play é
  finalizado.
- **🤝 Convidado** — não paga e nunca é bloqueado. Dois plays seguidos acendem um
  **alerta**, porque quem decide se aquilo virou mensalista é a organização.

Trocar de categoria **zera o pagamento** — senão mudar a categoria seria um jeito
de ficar verde de graça.

Na hora de escalar, tocar em quem está devendo **não bloqueia e pronto**: abre um
alerta que confirma o pagamento ou corrige a categoria ali e já escala. Quase
todo bloqueio é cadastro errado, não inadimplência, e mandar a pessoa até
Jogadores perderia a lista montada. O botão "Todos" e a **lista colada** também
respeitam o portão.

---

## 5. Colar a lista do grupo ficou muito melhor

- **Serve duas telas**: na hora do play (marca presença) e na aba **Jogadores**
  (só cadastra quem falta). Antes era preciso abrir um play só para cadastrar o
  grupo — justamente o que se faz uma vez, antes da primeira noite.
- **Ignora os ícones** que o povo põe na lista: emoji, ✅, joinha com tom de
  pele, coração com seletor de variação, ⭐ ⚽ ▪. Saem **antes** da numeração,
  senão um `✅ 3 - Bruno` esconde o "3 -".
- **Categoria por atleta** na tela de conferência, com um padrão para o lote.
- O ajuste individual é guardado **pelo nome**, não pela posição: por índice,
  voltar e colar outra lista jogava "o 2º é avulso" em cima de outra pessoa.

---

## 6. Cor por grupo

Oito cores, escolhidas para se distinguirem **entre si** na beira da quadra (por
isso não saem da paleta da marca). Vão na etiqueta, na caixa do grupo, na linha
da fila e **na borda do cartão da partida** — dá para achar de qual grupo é a
quadra de longe, sem ler o número.

---

## 7. A tela é um celular na beira da quadra

Um monte de coisa pequena que junta:

- **A ordem de criar o play** é quem joga → **formato** → detalhes. O formato é a
  escolha que muda tudo o que vem depois. Ele é uma **lista vertical**, não um
  segmentado: três nomes longos lado a lado quebram no meio das palavras a 375px.
- `.field > span` vale para `label` **e** `div`. Enquanto só `label.field > span`
  tinha estilo, metade do formulário saía com rótulo pequeno em caixa alta e a
  outra metade com texto corrido do corpo.
- **Rótulo em cima, controle embaixo.** O `.stepper` tem `input { flex: 1 }`,
  então ao lado de um texto ele cobre o texto.
- A data dividia a linha inteira para mostrar 10 caracteres — foi para o lado das
  quadras.
- A lista de atletas era pílula de largura variável num `wrap`, com as bordas
  nunca alinhando. Virou **grade de colunas iguais**.
- A linha do atleta em Jogadores: avatar + três botões comiam quase 280px dos
  375. A informação passou a ocupar a largura toda, com as ações numa linha
  própria embaixo.
- **Separador entre links é desenhado (`::before`), não digitado**: como texto, o
  `·` conta como palavra e vai parar sozinho no fim da linha.
- **Nome de pessoa não quebra no meio**: cada nome é `nowrap` e carrega o `+` da
  frente, então a linha só parte entre os dois nomes da dupla.
- **Nada de `(s)`**: existe um `plural()` em `src/lib/types.ts`.

---

## O que NÃO vem junto

- **A identidade.** Este repositório removeu as artes de fechamento, o logo e as
  cores do feminino de propósito. O feminino mantém as dele.
- **O vocabulário.** Aqui tudo virou masculino. Ao portar, é o caminho inverso —
  e atenção: `partida`, `dupla`, `quadra`, `rodada`, `chave` e `foto` são
  femininas nos **dois** apps, e **a campeã** também, porque quem vence o
  mata-mata é a dupla.
- **As migrações.** Os scripts `08` a `10` daqui precisam rodar no Supabase do
  feminino (são todos `add column if not exists`).

## Ordem sugerida para portar

1. **Força visível + força da dupla + entrosamento no balanceamento** — melhora
   o jogo sem mudar regra nenhuma, e não precisa de conversa com o grupo.
2. **Desempate configurável** — regra nova, mas opcional: quem não mexer fica
   com o comportamento de hoje.
3. **Arrumações de tela e texto** — invisíveis como decisão, sentidas no uso.
4. **Colar a lista na aba Jogadores + ignorar ícones** — ganho imediato.
5. **Grupos + duplas** — o maior, e o que precisa de conversa com a organização
   antes.
6. **Categorias de pagamento** — só se o grupo cobrar.
