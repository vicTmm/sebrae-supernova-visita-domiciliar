import React from 'react';
import {AbsoluteFill} from 'remotion';
import {DURACAO_SEGUNDOS, FPS, round2} from './config';
import {MOMENTOS_FORTES} from './cenas';
import type {Cena} from './types';

export const CORES = {
	marca: '#145B49',
	hover: '#104838',
	apoio: '#245A81',
	fundo: '#F5F7F8',
	superficie: '#FFFFFF',
	texto: '#172B35',
	muted: '#475B66',
	borda: '#D4DDE2',
	verdeClaro: '#EAF3EF',
} as const;

/** Grão determinístico: mesma semente em todo frame, sem aleatoriedade em runtime. */
const ID_GRAO = 'fundo-cena-grao';
const OPACIDADE_GRAO = round2(0.06);
const SEMENTE_GRAO = 7;

/** Fim da última palavra forte: a partir dela, o quadro final fica chapado. */
const inicioQuadroFinal = MOMENTOS_FORTES.reduce(
	(fim, momento) => Math.max(fim, momento.end),
	0,
);

const emBlocoChapado = (tempo: number): boolean => {
	const dentroMomentoForte = MOMENTOS_FORTES.some(
		(momento) => tempo >= momento.start && tempo <= momento.end,
	);
	const noQuadroFinal = tempo >= inicioQuadroFinal && tempo <= DURACAO_SEGUNDOS;
	return dentroMomentoForte || noQuadroFinal;
};

const grao = (): React.ReactElement =>
	React.createElement(
		AbsoluteFill,
		{style: {opacity: OPACIDADE_GRAO, pointerEvents: 'none'}},
		React.createElement(
			'svg',
			{
				width: '100%',
				height: '100%',
				xmlns: 'http://www.w3.org/2000/svg',
				'aria-hidden': true,
			},
			React.createElement(
				'filter',
				{id: ID_GRAO, x: '0%', y: '0%', width: '100%', height: '100%'},
				React.createElement('feTurbulence', {
					type: 'fractalNoise',
					baseFrequency: '0.8',
					numOctaves: 3,
					seed: SEMENTE_GRAO,
					stitchTiles: 'stitch',
				}),
				React.createElement('feColorMatrix', {type: 'saturate', values: '0'}),
			),
			React.createElement('rect', {
				width: '100%',
				height: '100%',
				filter: `url(#${ID_GRAO})`,
			}),
		),
	);

export const FundoCena: React.FC<{cena: Cena; frame: number}> = ({cena, frame}) => {
	const blocoChapado = emBlocoChapado(frame / FPS);

	const estilo: React.CSSProperties = blocoChapado
		? {backgroundColor: CORES.marca}
		: {
				backgroundColor: CORES.fundo,
				backgroundImage: `linear-gradient(155deg, ${CORES.fundo} 0%, ${CORES.verdeClaro} 52%, ${CORES.fundo} 100%)`,
			};

	return React.createElement(
		AbsoluteFill,
		{style: estilo, 'aria-label': `Fundo da cena ${cena.id}`},
		blocoChapado ? null : grao(),
	);
};
