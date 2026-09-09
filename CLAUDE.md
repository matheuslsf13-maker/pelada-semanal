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
                 streaks (status 🔥), stats,
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

- Partida até 4 pontos, sem empate. Pontos = games do vencedor − do perdedor
  (mínimo 1). Quem perde não pontua.
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
  - A fase 2 **só nasce quando a fase 1 inteira tem placar** (botão "Sortear a
    fase 2"), porque depende da colocação final.
  - **Só a fase 2 vale pontos** no pódio do dia, e o pódio é **por chave**.
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
- **O ranking zera todo mês, o histórico não.** A força que equilibra as duplas e
  divide os grupos sai de `ratings()`, que é um **Elo**: cada partida move a nota
  conforme quem estava do outro lado, então **vencer quem está melhor rende muito
  mais** do que vencer quem está pior. Não é o ranking do mês (senão o primeiro
  play do mês sairia desequilibrado) e não é média de pontos, que não sabe de quem
  você ganhou — e por isso quebrava no modo em grupos.
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

## Convenções

- Comentários e nomes em português, sem acento em identificadores.
- Código sem dependências novas sempre que der; o bundle é servido para
  celulares em quadra.
- Rodar `npm run build` antes de commitar; o push na `main` publica o site.
