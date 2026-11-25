import React from 'react';
import {Audio, Sequence, staticFile} from 'remotion';
import type {Cena} from './types';

/** Narração completa, iniciada no frame 0, sem ganho adicional. */
export const Narracao: React.FC = () => {
	return <Audio src={staticFile('narracao.wav')} />;
};

/** Um único efeito curto por peça de interface na entrada da cena. */
const SFX_POR_PECA: Record<Cena['peca'], string> = {
	notificacao: 'notificacao.wav',
	numero: 'notificacao.wav',
	tecla: 'tecla.wav',
	clique: 'clique.wav',
	conversa: 'pop.wav',
	logo: 'whoosh.wav',
};

/** A cena 1 pede `pop` no plano, embora sua peça seja uma notificação. */
const arquivoSfx = (cena: Cena): string =>
	cena.id === 1 ? 'pop.wav' : SFX_POR_PECA[cena.peca];

export const SomEntrada: React.FC<{cena: Cena; frameEntrada: number}> = ({
	cena,
	frameEntrada,
}) => {
	const arquivo = arquivoSfx(cena);
	// O whoosh dura 0,28 s (~16,8 frames); 18 frames evitam corte.
	const duracaoEmFrames = arquivo === 'whoosh.wav' ? 18 : 16;

	return (
		<Sequence from={frameEntrada} durationInFrames={duracaoEmFrames}>
			<Audio src={staticFile(`sfx/${arquivo}`)} volume={0.25} />
		</Sequence>
	);
};
