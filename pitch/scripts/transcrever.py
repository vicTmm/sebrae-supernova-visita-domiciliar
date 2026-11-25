#!/usr/bin/env python3
"""Gera pitch/src/tempos.json a partir da narração e do texto canônico.

Uso (a partir de qualquer diretório):
    pitch/.venv/bin/python pitch/scripts/transcrever.py

O Whisper fornece os TEMPOS. As palavras e as frases vêm de roteiro.txt.
A narração Rocko é lenta e com eco: o reconhecimento (ASR) erra palavras,
então os tempos são obtidos com o alinhamento forçado do texto canônico
(contra o áudio) pelo próprio modelo Whisper. O ASR continua sendo usado
para localizar as frases e como reserva. Nenhuma aleatoriedade é usada.
"""

from __future__ import annotations

import json
import math
import re
import sys
import unicodedata
import wave
from difflib import SequenceMatcher
from pathlib import Path

# faster-whisper 1.2.1 chama av.open(..., metadata_errors="ignore"), argumento
# removido no PyAV 19. O shim abaixo apenas descarta esse argumento.
import av

_av_open = av.open


def _av_open_compat(*args, **kwargs):
    kwargs.pop("metadata_errors", None)
    return _av_open(*args, **kwargs)


av.open = _av_open_compat

from faster_whisper import WhisperModel  # noqa: E402
from faster_whisper.audio import decode_audio  # noqa: E402
from faster_whisper.tokenizer import Tokenizer  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
ROTEIRO = ROOT / "roteiro.txt"
AUDIO = ROOT / "narracao.wav"
SAIDA = ROOT / "src" / "tempos.json"
DURACAO = 35.29  # nominal; substituída pela duração real do WAV se divergir

ALIASES = {
    "soap": {"soap", "sulape", "ousulape"},
    "vitacare": {"vitacare", "vitaquer"},
}

REQUERIDOS = {
    1: {"papel"},
    2: {"reescreve"},
    3: {"celular"},
    4: {"SOAP"},
    5: {"cópia"},
    6: {"aparelho"},
    7: {"Visitário", "clareza", "registro", "cuidado"},
}

PALAVRA_RE = re.compile(r"[^\W\d_]+", re.UNICODE)
PONTUACAO_RE = re.compile(r"[^\w\s]", re.UNICODE)


def round2(value: float) -> float:
    """Arredondamento half-up determinístico para 2 casas decimais."""
    return math.floor(value * 100.0 + 0.5) / 100.0


def duracao_wav() -> float:
    with wave.open(str(AUDIO), "rb") as wav:
        return round2(wav.getnframes() / wav.getframerate())


def norm(texto: str) -> str:
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    return PONTUACAO_RE.sub("", texto).strip().lower()


def palavras_canonicas(linha: str) -> list[str]:
    # Palavras sem pontuação: é assim que os destaques são identificados.
    return PALAVRA_RE.findall(linha)


def similaridade(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


# ---------------------------------------------------------------------------
# Reserva: alinhamento monotônico ASR -> roteiro (usado se o alinhamento
# forçado falhar por alguma razão).
# ---------------------------------------------------------------------------

def custo_grupo(canonica: str, grupo: list[dict]) -> float:
    if not grupo:
        return 1.50
    alvo = norm(canonica)
    alvo_texto = "".join(norm(w["palavra"]) for w in grupo) if len(grupo) > 1 \
        else norm(grupo[0]["palavra"])
    melhor = similaridade(alvo, alvo_texto)
    if alvo in ALIASES and alvo_texto in ALIASES[alvo]:
        melhor = max(melhor, 0.99)
    return (1.0 - melhor) + 0.20 * (len(grupo) - 1)


def custo_pausa(fim_anterior: float, inicio_atual: float) -> float:
    return min(max(0.0, inicio_atual - fim_anterior), 1.0) * 0.15


def alinhar(canonicas: list[str], audio: list[dict]) -> list[list[dict]]:
    n, m = len(canonicas), len(audio)
    infinito = 1e9
    dp = [[infinito] * (m + 1) for _ in range(n + 1)]
    volta: list[list[tuple[int, int] | None]] = [[None] * (m + 1) for _ in range(n + 1)]
    dp[0][0] = 0.0
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            melhor, escolha = infinito, None
            for k in range(max(0, j - 3), j):
                if dp[i - 1][k] >= infinito:
                    continue
                grupo = audio[k:j]
                custo = dp[i - 1][k] + custo_grupo(canonicas[i - 1], grupo)
                if i > 1:
                    custo += custo_pausa(audio[k - 1]["end"], grupo[0]["start"])
                if custo < melhor:
                    melhor, escolha = custo, (i - 1, k)
            if dp[i][j - 1] + 0.80 < melhor:
                melhor, escolha = dp[i][j - 1] + 0.80, (i, j - 1)
            if dp[i - 1][j] + 1.50 < melhor:
                melhor, escolha = dp[i - 1][j] + 1.50, (i - 1, j)
            dp[i][j], volta[i][j] = melhor, escolha
    if dp[n][m] >= infinito:
        raise RuntimeError("Não foi possível alinhar o roteiro com a transcrição")
    grupos: list[list[dict]] = [[] for _ in range(n)]
    i, j = n, m
    while i > 0 or j > 0:
        anterior = volta[i][j]
        if anterior is None:
            raise RuntimeError("Alinhamento incompleto")
        pi, pj = anterior
        if i == pi + 1 and j > pj:
            grupos[i - 1] = audio[pj:j]
        i, j = pi, pj
    return grupos


def tempos_por_asr(frases: list[str], asr: list[dict]) -> list[list[dict]]:
    resultado: list[list[dict]] = []
    ponteiro = 0
    for indice, frase in enumerate(frases):
        canonicas = palavras_canonicas(frase)
        n = len(canonicas)
        melhor = None
        for fim in range(ponteiro + 1, min(ponteiro + n + 4, len(asr)) + 1):
            janela = asr[ponteiro:fim]
            grupos = alinhar(canonicas, janela)
            custo = sum(custo_grupo(c, g) for c, g in zip(canonicas, grupos))
            custo += 0.25 * abs(len(janela) - n)
            if melhor is None or custo < melhor[0]:
                melhor = (custo, fim, grupos)
        if melhor is None:
            raise RuntimeError(f"Sem áudio para a frase {indice + 1}")
        _, ponteiro, grupos = melhor
        cena: list[dict] = []
        for canonical, grupo in zip(canonicas, grupos):
            if grupo:
                ini, fim_w = grupo[0]["start"], grupo[-1]["end"]
            else:
                ini = cena[-1]["end"] if cena else 0.0
                fim_w = min(ini + 0.08, DURACAO)
            cena.append({"word": canonical, "start": ini, "end": fim_w,
                         "scene": indice + 1})
        resultado.append(cena)
    return resultado


# ---------------------------------------------------------------------------
# Transcrição, segmentação e alinhamento forçado.
# ---------------------------------------------------------------------------

def carregar_modelo() -> tuple[WhisperModel, str]:
    for nome in ("small", "base"):
        try:
            return WhisperModel(nome, device="cpu", compute_type="int8"), nome
        except Exception as exc:  # queda de rede no download do modelo
            print(f"modelo '{nome}' indisponível: {exc}", file=sys.stderr)
    raise RuntimeError("Nenhum modelo do Whisper pôde ser carregado")


def transcrever(modelo: WhisperModel) -> tuple[list, list[dict], object]:
    segmentos, _ = modelo.transcribe(
        str(AUDIO),
        language="pt",
        word_timestamps=True,
        beam_size=5,
        vad_filter=False,
        temperature=0.0,
    )
    segmentos = list(segmentos)
    asr: list[dict] = []
    for segmento in segmentos:
        for palavra in (segmento.words or []):
            texto = str(palavra.word).strip()
            if texto:
                asr.append({"palavra": texto, "start": float(palavra.start),
                            "end": float(palavra.end)})
    taxa = modelo.feature_extractor.sampling_rate
    audio = decode_audio(str(AUDIO), sampling_rate=taxa)
    return segmentos, asr, audio


def spans_frases(segmentos: list, asr: list[dict], quantidade: int = 7) -> list[list[float]]:
    """Ajusta os segmentos do ASR para exatamente `quantidade` frases."""
    spans = [[float(s.start), float(s.end)] for s in segmentos]
    while len(spans) < quantidade:
        candidatos = []
        for indice, (ini, fim) in enumerate(spans):
            dentro = [w for w in asr if w["start"] >= ini - 0.01 and w["end"] <= fim + 0.01]
            for k in range(1, len(dentro)):
                pausa = dentro[k]["start"] - dentro[k - 1]["end"]
                if pausa > 0.30:
                    candidatos.append((pausa, indice, dentro[k - 1]["end"],
                                       dentro[k]["start"]))
        if not candidatos:
            raise RuntimeError("Não há pausas para separar as frases")
        _, indice, fim_parte, ini_parte = max(candidatos, key=lambda c: (c[0], -c[1]))
        spans[indice:indice + 1] = [[spans[indice][0], fim_parte],
                                    [ini_parte, spans[indice][1]]]
    while len(spans) > quantidade:
        pausas = [(spans[i + 1][0] - spans[i][1], i) for i in range(len(spans) - 1)]
        _, indice = min(pausas, key=lambda c: (c[0], c[1]))
        spans[indice:indice + 2] = [[spans[indice][0], spans[indice + 1][1]]]
    return spans


def alinhar_forcado(modelo: WhisperModel, frases: list[str],
                    spans: list[list[float]], audio) -> list[list[dict]] | None:
    """Alinha o texto canônico ao áudio com a cabeça de alinhamento do Whisper."""
    taxa = modelo.feature_extractor.sampling_rate
    limite = len(audio) / taxa
    tokenizador = Tokenizer(modelo.hf_tokenizer, modelo.model.is_multilingual,
                            task="transcribe", language="pt")
    resultado: list[list[dict]] = []
    for indice, (frase, (ini, fim)) in enumerate(zip(frases, spans)):
        inicio = max(0.0, ini - 0.05)
        final = min(limite, fim + 0.35)
        mel = modelo.feature_extractor(audio[int(inicio * taxa):int(final * taxa)])
        tokens_ids = tokenizador.encode(frase)
        alinhamento = modelo.find_alignment(
            tokenizador, [tokens_ids], modelo.encode(mel), mel.shape[-1]
        )[0]
        intervalos: list[tuple[float, float]] = []
        j = 0
        while j < len(alinhamento):
            texto = alinhamento[j]["word"].strip()
            if not PALAVRA_RE.search(texto):
                j += 1  # pontuação é ignorada
                continue
            começo = float(alinhamento[j]["start"])
            termino = float(alinhamento[j]["end"])
            j += 1
            # Pontuação anexa (vírgula/ponto) entra no fim da palavra anterior.
            while j < len(alinhamento) and not PALAVRA_RE.search(alinhamento[j]["word"]):
                termino = max(termino, float(alinhamento[j]["end"]))
                j += 1
            intervalos.append((começo, termino))
        canonicas = palavras_canonicas(frase)
        if len(intervalos) != len(canonicas):
            print(f"alinhamento forçado divergente na frase {indice + 1}: "
                  f"{len(intervalos)} tempos para {len(canonicas)} palavras",
                  file=sys.stderr)
            return None
        cena = []
        for canonical, (começo, termino) in zip(canonicas, intervalos):
            cena.append({"word": canonical, "start": inicio + começo,
                         "end": inicio + termino, "scene": indice + 1})
        resultado.append(cena)
    return resultado


def construir_tempos(frases: list[str], por_cena: list[list[dict]]) -> dict:
    todas: list[dict] = []
    sentences: list[dict] = []
    for indice, (frase, cena) in enumerate(zip(frases, por_cena)):
        inicio_frase: float | None = None
        fim_frase = 0.0
        for palavra in cena:
            inicio = round2(palavra["start"])
            fim = round2(palavra["end"])
            if todas:
                inicio = max(inicio, todas[-1]["end"])
            if fim <= inicio:
                fim = round2(inicio + 0.01)
            item = {"word": palavra["word"], "start": inicio, "end": fim,
                    "scene": indice + 1}
            todas.append(item)
            if inicio_frase is None:
                inicio_frase = inicio
            fim_frase = fim
        if indice == 0:
            inicio_frase = 0.0
        if indice == len(frases) - 1:
            fim_frase = DURACAO
        sentences.append({"index": indice + 1, "text": frase,
                          "start": inicio_frase, "end": fim_frase,
                          "words": [w for w in todas if w["scene"] == indice + 1]})
    return {"duration": DURACAO, "words": todas, "sentences": sentences}


# ---------------------------------------------------------------------------
# Validação.
# ---------------------------------------------------------------------------

def validar(tempos: dict, frases: list[str]) -> None:
    assert tempos["duration"] == DURACAO
    assert len(tempos["sentences"]) == len(frases) == 7
    anterior = 0.0
    for frase, sentence in zip(frases, tempos["sentences"]):
        assert sentence["text"] == frase
        assert 1 <= sentence["index"] <= 7
        assert sentence["start"] >= anterior
        assert sentence["start"] < sentence["end"] <= DURACAO
        anterior = sentence["end"]
        for palavra in sentence["words"]:
            assert palavra["word"].strip()
            assert 1 <= palavra["scene"] == sentence["index"] <= 7
            assert 0.0 <= palavra["start"] < palavra["end"] <= DURACAO
            assert round(palavra["start"], 2) == palavra["start"]
            assert round(palavra["end"], 2) == palavra["end"]
        presentes = {w["word"] for w in sentence["words"]}
        assert REQUERIDOS[sentence["index"]] <= presentes, sentence["index"]
        assert sentence["start"] == sentence["words"][0]["start"]
        assert sentence["end"] >= sentence["words"][-1]["end"]
    anterior = 0.0
    for palavra in tempos["words"]:
        assert palavra["start"] >= anterior
        assert palavra["start"] < palavra["end"] <= DURACAO
        anterior = palavra["end"]
    assert tempos["words"][0]["start"] == 0.0
    assert tempos["sentences"][-1]["end"] == DURACAO


def main() -> None:
    global DURACAO
    real = duracao_wav()
    if real != DURACAO:
        DURACAO = real
    frases = [linha.strip() for linha in ROTEIRO.read_text(encoding="utf-8").splitlines()
              if linha.strip()]
    modelo, nome = carregar_modelo()
    segmentos, asr, audio = transcrever(modelo)
    spans = spans_frases(segmentos, asr, len(frases))
    por_cena = alinhar_forcado(modelo, frases, spans, audio)
    metodo = "alinhamento forçado"
    if por_cena is None:
        por_cena = tempos_por_asr(frases, asr)
        metodo = "ASR + DP (reserva)"
    tempos = construir_tempos(frases, por_cena)
    validar(tempos, frases)
    SAIDA.write_text(
        json.dumps(tempos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"modelo={nome}  método={metodo}  palavras={len(tempos['words'])}  "
          f"duração={tempos['duration']:.2f}s")
    for frase in tempos["sentences"]:
        print(f"  cena {frase['index']}: {frase['start']:5.2f}-{frase['end']:5.2f}s "
              f"({frase['end'] - frase['start']:4.2f}s, "
              f"{len(frase['words'])} palavras)")
    print(f"escrito em {SAIDA}")


if __name__ == "__main__":
    main()
