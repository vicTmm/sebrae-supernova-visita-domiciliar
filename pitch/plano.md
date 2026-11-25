# Visitário — plano do pitch (35 s, vertical)

Projeto: `pitch/`. Remotion 1080×1920, 60 fps, 35,29 s de narração (`narracao.wav`, voz Rocko pt_BR em ritmo lento com tratamento distante, gerada de `roteiro.txt` por `scripts/gerar_narracao.sh`). Render final com `--scale=2` e H.264/CRF 12, somente após o ok no Studio.

Frase por cena. Os segundos exatos vêm de `src/tempos.json` (VOZ) e são copiados para `src/cenas.ts` (CENAS), arredondados para 2 casas decimais.

| Cena | Frase da narração | Palavra em destaque | Personagem 3D | Peça de interface | Efeito |
| --- | --- | --- | --- | --- | --- |
| 1 | Na visita, o registro começa no papel e termina digitado duas vezes. | papel | `visita.png` (casa) | notificação “Registro no papel” | pop |
| 2 | O profissional anota e reescreve a evolução depois. | reescreve | `registro.png` (prancheta) | campo com cursor digitando | tecla |
| 3 | O Visitário organiza a visita no celular, sem sinal. | celular | `conexao.png` (elo) | badge “Sem sinal · salvando” | clique |
| 4 | Sinais e queixas viram SOAP para revisão. | SOAP | `registro.png` (prancheta) | número que rola (medida fictícia) | notificação |
| 5 | O texto sai em blocos e segue ao VitaCare por cópia. | cópia | `conexao.png` (elo) | conversa/toast “Texto copiado” | pop |
| 6 | Sem sinal, o rascunho fica no aparelho e sincroniza depois. | aparelho | `visita.png` (casa) | notificação “Pendente → Sincronizada” | notificação |
| 7 | Visitário. Mais clareza no registro, continuidade no cuidado. | Visitário + clareza / registro / cuidado | `conexao.png` (elo) | logo e tela do app no celular | whoosh |

Momentos de bloco chapado de cor: abertura da cena 7 (logo), as três palavras `clareza`, `registro`, `cuidado` e o quadro final.

## Contrato entre agentes

Arquivos de configuração criados antes dos agentes (não editar): `src/config.ts`, `src/types.ts`, `src/Root.tsx`, `src/index.ts`, `remotion.config.ts`, `package.json`.

Cada agente mexerá **somente** nos seus arquivos:

| Agente | Arquivos de sua posse |
| --- | --- |
| VOZ | `src/tempos.json`, `scripts/transcrever.py` |
| CENAS | `src/cenas.ts` |
| PERSONAGENS | `src/personagens.tsx` |
| TEXTO | `src/texto.tsx` |
| PEÇAS | `src/pecas.tsx` |
| MOVIMENTO | `src/movimento.ts` |
| COR | `src/cor.ts` |
| SOM | `src/som.tsx`, `scripts/gerar_sfx.py`, `public/sfx/*` |
| CÓDIGO | `src/Video.tsx` |
| REVISÃO | `revisao.md`, `frames/*` (e devolve para o agente responsável) |

Tipos compartilhados em `src/types.ts`:

```ts
type Palavra = { word: string; start: number; end: number; scene: number };
type FraseTempo = { index: number; text: string; start: number; end: number; words: Palavra[] };
type Tempos = { duration: number; words: Palavra[]; sentences: FraseTempo[] };
type Cena = {
  id: number;
  frase: string;
  start: number;
  end: number;
  destaque: string;
  personagem: 'visita.png' | 'registro.png' | 'conexao.png';
  peca: 'notificacao' | 'tecla' | 'clique' | 'numero' | 'conversa' | 'logo';
  forte: boolean;
};
```

`src/tempos.json` deve seguir `Tempos`. `src/cenas.ts` deve exportar `CENAS: Cena[]` com 7 itens em ordem, começando em `0` e terminando em `35.29` (última cena pode terminar na duração da narração). Cada `Cena` deve carregar `start`/`end` com 2 casas decimais.

## Regras comuns

- Nada de `Math.random` nem qualquer aleatoriedade em runtime. Grão e ruído devem vir de funções determinísticas (seno/índice).
- Todo valor de `transform` (escala, translação, rotação) arredondado para 2 casas decimais. Use `round2()` de `src/config.ts`.
- Fonte de título: **Bricolage Grotesque Variable** (`public/fonts/bricolage-grotesque-latin-wght-normal.woff2`). Corpo: Inter Variable.
- Cor de destaque: **verde petróleo `#145B49`**. Fundo claro `#F5F7F8`, texto `#172B35`, apoio `#245A81`.
- Fundo: gradiente suave + grão. Sem música. Áudio: só `narracao.wav` e efeitos curtos nas entradas.
- Transição entre cenas: whip horizontal com borrão de movimento; expedido por `src/movimento.ts`, aplicado pelo CÓDIGO.
- A palavra em destaque aparece no instante exato em que é falada, lido de `src/tempos.json`.
- Personagem entra quicando, flutua e tem sombra macia embaixo; fica em região separada do título para não colidir.
- Um celular com uma tela do app aparece em cada cena, resolvendo a dor daquela frase; dados sempre fictícios.
- Não renderizar o MP4 final antes da revisão humana no Studio.
