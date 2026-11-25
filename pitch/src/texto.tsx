import React from 'react';
import {AbsoluteFill, staticFile} from 'remotion';
import {MOMENTOS_FORTES} from './cenas';
import {FONTE_CORPO, FONTE_TITULO, FPS, round2} from './config';
import tempos from './tempos.json';
import type {Cena, Tempos} from './types';

const TEMPOS: Tempos = tempos;

const COR_TEXTO = '#172B35';
const COR_DESTAQUE = '#145B49';
const COR_APAGADA = '#475B66';
const COR_LOGO_SOBRE_VERDE = '#FFFFFF';
const COR_FORTE_SOBRE_VERDE = '#EAF3EF';
const PALAVRA_LOGO = 'VISITÁRIO';

/** Registra as duas variáveis usadas nos títulos e no corpo. */
const ESTILO_FONTES = `
@font-face {
  font-family: '${FONTE_TITULO}';
  src: url('${staticFile('fonts/bricolage-grotesque-latin-wght-normal.woff2')}') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: block;
}
@font-face {
  font-family: '${FONTE_CORPO}';
  src: url('${staticFile('fonts/inter-latin-wght-normal.woff2')}') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: block;
}
`;

/** Quebras controladas: nenhuma linha passa dos 880 px de largura. */
const LINHAS_TITULO: Record<number, readonly string[]> = {
  1: ['No papel'],
  2: ['Reescreve', 'a evolução'],
  3: ['No celular'],
  4: ['SOAP para', 'revisão'],
  5: ['Texto para', 'cópia'],
  6: ['Fica no', 'aparelho'],
};

type Trecho = {texto: string; realce: boolean};

const normalizar = (valor: string): string => valor.toLocaleLowerCase('pt-BR');

const quadroDe = (segundos: number): number => Math.round(segundos * FPS);

const dividirLinha = (linha: string, destaque: string): Trecho[] => {
  const indice = normalizar(linha).indexOf(normalizar(destaque));
  if (destaque.length === 0 || indice < 0) {
    return [{texto: linha, realce: false}];
  }
  return [
    {texto: linha.slice(0, indice), realce: false},
    {texto: linha.slice(indice, indice + destaque.length), realce: true},
    {texto: linha.slice(indice + destaque.length), realce: false},
  ].filter((trecho) => trecho.texto.length > 0);
};

/** Intervalo falado da palavra em destaque, já em frames. */
const intervaloDestaque = (cena: Cena): {inicio: number; fim: number} | null => {
  const palavra = TEMPOS.words.find(
    (item) =>
      item.scene === cena.id &&
      normalizar(item.word) === normalizar(cena.destaque),
  );
  if (!palavra) {
    return null;
  }
  return {inicio: quadroDe(palavra.start), fim: quadroDe(palavra.end)};
};

/** 1 → 1+amplitude → 1 dentro do intervalo; 1 fora dele. */
const pulso = (
  quadro: number,
  inicio: number,
  fim: number,
  amplitude: number,
): number => {
  if (quadro < inicio || quadro >= fim) {
    return 1;
  }
  const fracao = (quadro - inicio) / Math.max(1, fim - inicio);
  return 1 + amplitude * Math.sin(Math.PI * fracao);
};

const MOMENTOS = MOMENTOS_FORTES.map((momento) => ({
  palavra: momento.palavra.toLocaleUpperCase('pt-BR'),
  inicio: quadroDe(momento.start),
  fim: quadroDe(momento.end),
}));

const estiloBloco: React.CSSProperties = {
  position: 'absolute',
  top: 170,
  left: 100,
  width: 880,
  maxWidth: 880,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  color: COR_TEXTO,
  fontFamily: FONTE_TITULO,
  fontWeight: 800,
  fontSize: 92,
  lineHeight: 1.02,
  letterSpacing: -3,
  textWrap: 'balance',
};

/**
 * Título da cena. A palavra em destaque só ganha cor cheia e escala enquanto
 * é falada; as palavras fortes da cena 7 obedecem aos momentos de narração.
 */
export const TituloCena: React.FC<{cena: Cena; frameLocal: number}> = ({
  cena,
  frameLocal,
}) => {
  const quadro = quadroDe(cena.start) + frameLocal;
  const fimCena = quadroDe(cena.end);

  if (quadro > fimCena) {
    return null;
  }

  if (cena.id === 7) {
    const momento = MOMENTOS.find(
      (item) => quadro >= item.inicio && quadro < item.fim,
    );
    const palavra = momento?.palavra ?? PALAVRA_LOGO;
    const escala = momento
      ? pulso(quadro, momento.inicio, momento.fim, 0.06)
      : 1;

    return (
      <>
        <style>{ESTILO_FONTES}</style>
        <AbsoluteFill style={{pointerEvents: 'none'}}>
          <div
            style={{
              ...estiloBloco,
              height: 450,
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                fontSize: palavra === PALAVRA_LOGO ? 118 : 104,
                letterSpacing: palavra === PALAVRA_LOGO ? -2 : -1,
                color:
                  palavra === PALAVRA_LOGO
                    ? COR_LOGO_SOBRE_VERDE
                    : COR_FORTE_SOBRE_VERDE,
                transform: `scale(${round2(escala)})`,
                transformOrigin: 'center center',
                whiteSpace: 'nowrap',
                textWrap: 'balance',
              }}
            >
              {palavra}
            </div>
          </div>
        </AbsoluteFill>
      </>
    );
  }

  const linhas = LINHAS_TITULO[cena.id] ?? [];
  const intervalo = intervaloDestaque(cena);
  const ativo =
    intervalo !== null && quadro >= intervalo.inicio && quadro < intervalo.fim;
  const escala = intervalo
    ? pulso(quadro, intervalo.inicio, intervalo.fim, 0.08)
    : 1;

  return (
    <>
      <style>{ESTILO_FONTES}</style>
      <AbsoluteFill style={{pointerEvents: 'none'}}>
        <div style={estiloBloco}>
          {linhas.map((linha, indiceLinha) => (
            <div
              key={`${cena.id}-${indiceLinha}`}
              style={{
                maxWidth: '100%',
                whiteSpace: 'pre-wrap',
                textWrap: 'balance',
              }}
            >
              {dividirLinha(linha, cena.destaque).map((trecho, indiceTrecho) => (
                <span
                  key={`${indiceLinha}-${indiceTrecho}`}
                  style={{
                    display: 'inline-block',
                    fontSize: trecho.realce ? 98 : 92,
                    color: trecho.realce
                      ? ativo
                        ? COR_DESTAQUE
                        : COR_APAGADA
                      : COR_TEXTO,
                    transform: `scale(${round2(trecho.realce ? escala : 1)})`,
                    transformOrigin: 'center center',
                  }}
                >
                  {trecho.texto}
                </span>
              ))}
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </>
  );
};
