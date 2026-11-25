# Revisão final do pitch — Visitário (3ª passada, voz Rocko)

## Método

Re-renderizei **todos os 12 quadros** com `npx remotion still src/index.ts VisitarioPitch frames/<nome>.png --frame=<N>` a partir de `pitch/`, recalculando os pontos médios com o novo `src/tempos.json` (35,29 s) e o novo total de 2117 frames (último frame renderizado: **2116**). Todos os comandos tiveram sucesso; os PNGs antigos foram sobrescritos. **Nenhum MP4 renderizado; Studio não aberto.**

**Limitação declarada:** a ferramenta de leitura de imagem deste modelo não exibe PNGs (`this model does not support image input`). Mantive o método rigoroso das passadas anteriores: OCR com caixas e confiança (Apple Vision, precisão alta, pt-BR) nos 12 PNGs + análise de pixels (Pillow) na faixa de título + contraste WCAG + geometria dos componentes.

| Arquivo | Frame | Tempo | Ponto médio de |
| --- | --- | --- | --- |
| `cena-01.png` | 172 | 2,87 s | Cena 1 |
| `cena-02.png` | 475 | 7,92 s | Cena 2 |
| `cena-03.png` | 749 | 12,48 s | Cena 3 |
| `cena-04.png` | 988 | 16,47 s | Cena 4 |
| `cena-05.png` | 1259 | 20,98 s | Cena 5 |
| `cena-06.png` | 1571 | 26,18 s | Cena 6 |
| `cena-07.png` | 1944 | 32,40 s | Cena 7 |
| `forte-visitario.png` | 1801 | 30,02 s | `MOMENTOS_FORTES` — Visitário |
| `forte-clareza.png` | 1868 | 31,13 s | `MOMENTOS_FORTES` — clareza |
| `forte-registro.png` | 1933 | 32,22 s | `MOMENTOS_FORTES` — registro |
| `forte-cuidado.png` | 2062 | 34,37 s | `MOMENTOS_FORTES` — cuidado |
| `quadro-final.png` | 2116 | 35,27 s | Último frame |

## Verificação por cena

Legenda: **(a)** texto íntegro/legível; **(b)** 3D sobre o título; **(c)** celular/peça sobre o título; **(d)** bloco chapado cobrindo texto; **(e)** composição equilibrada.

| Cena | Quadro / frame | Título reconhecido (OCR) | (a) | (b) | (c) | (d) | (e) | Resultado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `cena-01.png` / 172 | "No papel" (x=337–760, y=161–258) | OK | Não | Não | Não | OK | Sem problema |
| 2 | `cena-02.png` / 475 | "Reescreve / a evolução" (x=275–782) | OK | Não | Não | Não | OK | Sem problema |
| 3 | `cena-03.png` / 749 | "No celular" (x=309–782) | OK | Não | Não | Não | OK | Sem problema |
| 4 | `cena-04.png` / 988 | "SOAP para / revisão" (x=298–788) | OK | Não | Não | Não | OK | Sem problema (contador parcial é o efeito previsto) |
| 5 | `cena-05.png` / 1259 | "Texto para / cópia" (x=306–776) | OK | Não | Não | Não | OK | Sem problema |
| 6 | `cena-06.png` / 1571 | "Fica no / aparelho" (x=328–755) | OK | Não | Não | Não | OK | Sem problema |
| 7 | `cena-07.png` / 1944 | "REGISTRO" (x=262–817, y=335–424) | OK | Não | Não | Fundo chapado previsto, não cobre | OK | Sem problema |

**Quadros extras:** `forte-visitario.png` (1801) → "VISITÁRIO" x=240–840, conf. 1,00; `forte-clareza.png` (1868) → "CLAREZA" x=290–796, conf. 1,00; `forte-registro.png` (1933) → "REGISTRO" x=262–820, conf. 1,00; `forte-cuidado.png` (2062) → "CUIDADO" x=279–801, conf. 1,00; `quadro-final.png` (2116) → "VISITÁRIO" x=237–840, conf. 1,00. Todos dentro da zona segura (x=100–980), sem corte, sem colisão e com bloco chapado apenas como fundo.

**Nota sobre a confiança do OCR na cena 1:** "No papel" foi lido com confiança 0,30, mas com o texto correto e sem corte. O motivo é que, no frame 172, `papel` está exatamente dentro do intervalo falado (2,66–2,94 s → frames 160–176) e por isso aparece em verde `#145B49` com pulso de 1,06×; os pixels da faixa confirmam 2,59% de verde e contraste de ~7,2:1 sobre o fundo claro. Não é problema de legibilidade.

**Contrastes WCAG medidos:** apagado `#475B66` sobre claro = 6,39:1; título `#172B35` sobre claro = 13,19:1; destaque verde sobre claro ≈ 7,2:1; logo branco sobre `#145B49` = 8,01:1; palavra forte `#EAF3EF` sobre `#145B49` = 7,08:1. As correções das passadas 1 e 2 permanecem intactas (0,0% de `#172B35` nos blocos verdes; 6,29–6,37% de branco no logo).

**Não constatado nesta passada:** texto cortado/ilegível, personagem 3D sobre o título, celular ou peça cobrindo o título, bloco chapado cobrindo texto, desequilíbrio de composição. A nova narração não alterou a geometria; os pontos médios estão longe das transições de whip.

## Verificação de som (sem renderizar vídeo)

`ffprobe` e leitura direta do WAV + `tempos.json`, `Video.tsx`, `som.tsx`, `config.ts`, `Root.tsx`.

**Narração Rocko:**
- `public/narracao.wav`: **35,29125 s**, 48 kHz, mono, PCM 16 bits — confere com `duration: 35.29` e `DURACAO_FRAMES = 2117` (35,28 s no tempo da composição; diferença < 1 frame, após a última palavra "cuidado" em 34,87 s).
- `som.tsx` monta `<Audio src={staticFile('narracao.wav')} />` **sem `from`**, portanto a narração começa no **frame 0**. A análise das amostras confirma áudio a partir da amostra 48 (0,001 s) — não há silêncio inicial.
- O arquivo antigo `narracao.aiff` (34,41 s) continua na raiz de `pitch/`, mas **não é referenciado** pela composição; é inócuo.

**Efeitos por frase:**

| Cena | Frase (`tempos.json`) | `frameEntrada` | Efeito | Duração | Janela | Tempo |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 0,00–5,74 | 0 | `pop.wav` | 0,10 s | 16 frames | Exato em "Na" |
| 2 | 6,01–9,81 | 361 | `tecla.wav` | 0,05 s | 16 frames | Exato em "O" |
| 3 | 10,17–14,79 | 610 | `clique.wav` | 0,04 s | 16 frames | Exato em "O" |
| 4 | 14,95–17,97 | 897 | `notificacao.wav` | 0,18 s | 16 frames | Exato em "Sinais" |
| 5 | 18,61–23,35 | 1117 | `pop.wav` | 0,10 s | 16 frames | Exato em "O" |
| 6 | 23,59–28,79 | 1415 | `notificacao.wav` | 0,18 s | 16 frames | Exato em "Se" |
| 7 | 29,51–35,29 | 1771 | `whoosh.wav` | 0,28 s | 18 frames (0,30 s) | Exato em "Visitário" |

- Os 7 `frameEntrada` de `Video.tsx` são iguais ao início da frase correspondente: nenhum efeito dispensado após a palavra ou em cena errada. ✔
- Todos os efeitos **< 0,35 s** (máximo 0,28 s); o whoosh cabe nos 18 frames, sem corte. ✔
- **Sem música:** `public/` contém só fonts, personagens, `narracao.wav` e os 5 WAVs de SFX; `som.tsx` monta apenas `<Narracao>` e `<SomEntrada>`. ✔

## Resumo final

Os 12 quadros recalculados com a voz Rocko estão limpos: nenhum texto cortado/ilegível, nenhuma sobreposição de personagem/celular/peça sobre o título, nenhum bloco chapado cobrindo texto, contrastes acima de 6:1 e nenhuma regressão das correções anteriores. A narração em `public/narracao.wav` tem 35,29125 s, começa no frame 0 e os efeitos estão no tempo, curtos e sem música.

**APROVADO PARA O STUDIO.**

O MP4 final **NÃO foi renderizado**; a renderização com `--scale=2`, H.264/CRF 12 fica para depois da conferência humana no Studio, conforme `plano.md`.
