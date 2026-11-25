import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {CENAS, MOMENTOS_FORTES, cenaAtiva} from './cenas';
import {FPS, round2} from './config';
import {CORES, FundoCena} from './cor';
import {apertoCamera, whip} from './movimento';
import {PersonagemCena} from './personagens';
import {PecasCena} from './pecas';
import {Narracao, SomEntrada} from './som';
import {TituloCena} from './texto';
import type {Cena} from './types';

type EfeitoWhip = {x: number; blur: number; opacidade: number};

const NEUTRO: EfeitoWhip = {x: 0, blur: 0, opacidade: 1};

/** Última cena iniciada: cobre as pequenas pausas entre frases da narração. */
const cenaNoFrame = (frame: number): Cena => {
	const ativa = cenaAtiva(frame);
	if (ativa !== null) {
		return ativa;
	}
	const tempo = frame / FPS;
	for (let indice = CENAS.length - 1; indice >= 0; indice -= 1) {
		const cena = CENAS[indice];
		if (cena.start <= tempo) {
			return cena;
		}
	}
	return CENAS[0];
};

/** Ponto médio entre o fim de uma frase e o começo da seguinte. */
const FRONTEIRAS_WHIP: number[] = CENAS.slice(0, -1).map((cena, indice) => {
	const proxima = CENAS[indice + 1];
	return Math.round(((cena.end + proxima.start) / 2) * FPS);
});

/**
 * WHIP_FRAMES (8 frames a 60 fps) é apenas referência documental: `whip()`
 * já calcula a janela a partir do FPS.
 */
const efeitoWhipNoFrame = (frame: number): EfeitoWhip => {
	const ativo = FRONTEIRAS_WHIP.map((fronteira) =>
		whip(frame, fronteira, FPS),
	).find(
		(efeito) =>
			efeito.x !== 0 || efeito.blur !== 0 || efeito.opacidade !== 1,
	);
	const efeito = ativo ?? NEUTRO;
	return {
		x: round2(efeito.x),
		blur: round2(efeito.blur),
		opacidade: round2(efeito.opacidade),
	};
};

const FIM_BLOCOS_FORTES = MOMENTOS_FORTES.reduce(
	(fim, momento) => Math.max(fim, momento.end),
	0,
);

/** Cor de segurança nas bordas durante o deslocamento do whip. */
const corDasBordas = (frame: number): string => {
	const tempo = frame / FPS;
	const blocoForte = MOMENTOS_FORTES.some(
		(momento) => tempo >= momento.start && tempo <= momento.end,
	);
	return blocoForte || tempo >= FIM_BLOCOS_FORTES
		? CORES.marca
		: CORES.fundo;
};

export const Video: React.FC = () => {
	const frame = useCurrentFrame();
	const cena = cenaNoFrame(frame);
	const frameLocal = frame - Math.round(cena.start * FPS);
	const duracaoFrames = Math.max(1, Math.round((cena.end - cena.start) * FPS));
	const efeito = efeitoWhipNoFrame(frame);

	return (
		<AbsoluteFill style={{backgroundColor: corDasBordas(frame), overflow: 'hidden'}}>
			{/* Camada de whip envolve todo o conteúdo visual; áudio fica fora. */}
			<AbsoluteFill
				style={{
					transform: `translateX(${round2(efeito.x)}px)`,
					filter: `blur(${round2(efeito.blur)}px)`,
					opacity: round2(efeito.opacidade),
				}}
			>
				<FundoCena cena={cena} frame={frame} />
				<AbsoluteFill
					style={{transform: `scale(${round2(apertoCamera(frameLocal, duracaoFrames))})`}}
				>
					<PersonagemCena cena={cena} frameLocal={frameLocal} />
					<PecasCena cena={cena} frameLocal={frameLocal} />
					<TituloCena cena={cena} frameLocal={frameLocal} />
				</AbsoluteFill>
			</AbsoluteFill>
			<Narracao />
			<SomEntrada cena={cena} frameEntrada={Math.round(cena.start * FPS)} />
		</AbsoluteFill>
	);
};
