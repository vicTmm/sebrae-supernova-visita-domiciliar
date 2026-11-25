#!/usr/bin/env python3
"""Gera os efeitos sonoros curtos do pitch do Visitário.

Python puro (stdlib), determinístico: nenhum uso de ``random``.
Saída: ``public/sfx/*.wav`` em 48 kHz, mono, PCM 16 bits.
"""

import math
import struct
import wave
from pathlib import Path

SAMPLE_RATE = 48_000
SAIDA = Path(__file__).resolve().parent.parent / "public" / "sfx"
PI2 = 2.0 * math.pi


def envelope(t: float, dur: float, ataque: float) -> float:
    """Ataque em cosseno suave e decaimento exponencial até zero."""
    if t <= 0.0 or t >= dur:
        return 0.0
    if t < ataque:
        return 0.5 - 0.5 * math.cos(math.pi * t / ataque)
    x = (t - ataque) / (dur - ataque)
    return math.exp(-2.5 * x) * (1.0 - x) ** 1.5


def fase_sweep(t: float, dur: float, f0: float, razao: float) -> float:
    """Fase de uma senoide com frequência exponencial de f0 até f0 * razao."""
    a = math.log(razao) / dur
    return PI2 * f0 * (math.exp(a * t) - 1.0) / a


def converter(amostras: list[float], pico: float) -> list[int]:
    """Normaliza para o pico desejado e converte para PCM 16 bits."""
    maior = max((abs(s) for s in amostras), default=0.0)
    fator = 0.0 if maior == 0.0 else pico / maior
    return [int(max(-1.0, min(1.0, s * fator)) * 32767) for s in amostras]


def renderizar(dur: float, gerador, pico: float) -> list[int]:
    total = round(dur * SAMPLE_RATE)
    return converter([gerador(i / SAMPLE_RATE, dur) for i in range(total)], pico)


def gerar_pop() -> list[int]:
    """Sweep ascendente curto, usado em notificações e conversas."""

    def amostra(t: float, dur: float) -> float:
        return math.sin(fase_sweep(t, dur, 430.0, 3.4)) * envelope(t, dur, 0.004)

    return renderizar(0.10, amostra, 0.70)


def gerar_whoosh() -> list[int]:
    """Ruído determinístico: senoides de frequências fixas com leve queda."""
    frequencias = (97, 149, 211, 293, 397, 541, 719, 947, 1229, 1597, 2011)

    def amostra(t: float, dur: float) -> float:
        x = t / dur
        env = envelope(t, dur, 0.05) * (0.55 + 0.45 * math.sin(math.pi * x) ** 2)
        soma = 0.0
        for indice, freq in enumerate(frequencias):
            deslize = freq * (1.0 - 0.22 * x)
            soma += math.sin(PI2 * deslize * t + indice * 0.71) / (1.0 + indice * 0.12)
        return soma / len(frequencias) * env

    return renderizar(0.28, amostra, 0.55)


def gerar_notificacao() -> list[int]:
    """Dois tons curtos e distintos, em sequência."""
    tons = ((0.0, 0.075, 880.0), (0.080, 0.175, 1174.66))

    def amostra(t: float, dur: float) -> float:
        valor = 0.0
        for inicio, fim, freq in tons:
            if inicio <= t < fim:
                local = t - inicio
                valor += math.sin(PI2 * freq * local) * envelope(local, fim - inicio, 0.006)
        return valor

    return renderizar(0.18, amostra, 0.62)


def gerar_tecla() -> list[int]:
    """Toque seco de teclado, com um harmonicado breve."""

    def amostra(t: float, dur: float) -> float:
        env = envelope(t, dur, 0.002)
        return (
            0.75 * math.sin(PI2 * 1180.0 * t)
            + 0.25 * math.sin(PI2 * 2360.0 * t)
        ) * env

    return renderizar(0.05, amostra, 0.48)


def gerar_clique() -> list[int]:
    """Clique de toque na tela, com queda rápida de frequência."""

    def amostra(t: float, dur: float) -> float:
        env = envelope(t, dur, 0.0015)
        return (
            0.75 * math.sin(fase_sweep(t, dur, 900.0, 0.5))
            + 0.25 * math.sin(PI2 * 360.0 * t)
        ) * env

    return renderizar(0.04, amostra, 0.45)


def gravar(nome: str, amostras: list[int]) -> None:
    caminho = SAIDA / nome
    with wave.open(str(caminho), "wb") as arquivo:
        arquivo.setnchannels(1)
        arquivo.setsampwidth(2)
        arquivo.setframerate(SAMPLE_RATE)
        arquivo.writeframes(struct.pack(f"<{len(amostras)}h", *amostras))
    print(f"{caminho} ({len(amostras)} amostras)")


def main() -> None:
    SAIDA.mkdir(parents=True, exist_ok=True)
    for nome, gerador in (
        ("pop.wav", gerar_pop),
        ("whoosh.wav", gerar_whoosh),
        ("notificacao.wav", gerar_notificacao),
        ("tecla.wav", gerar_tecla),
        ("clique.wav", gerar_clique),
    ):
        gravar(nome, gerador())


if __name__ == "__main__":
    main()
