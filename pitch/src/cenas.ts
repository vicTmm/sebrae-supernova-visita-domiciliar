import tempos from './tempos.json';
import {FPS} from './config';
import type {Cena} from './types';

const round2 = (valor: number): number => Number(valor.toFixed(2));

type MetadadoCena = Pick<Cena, 'destaque' | 'personagem' | 'peca' | 'forte'>;

const METADADOS: MetadadoCena[] = [
	{
		destaque: 'papel',
		personagem: 'visita.png',
		peca: 'notificacao',
		forte: false,
	},
	{
		destaque: 'reescreve',
		personagem: 'registro.png',
		peca: 'tecla',
		forte: false,
	},
	{
		destaque: 'celular',
		personagem: 'conexao.png',
		peca: 'clique',
		forte: false,
	},
	{
		destaque: 'SOAP',
		personagem: 'registro.png',
		peca: 'numero',
		forte: false,
	},
	{
		destaque: 'cópia',
		personagem: 'conexao.png',
		peca: 'conversa',
		forte: false,
	},
	{
		destaque: 'aparelho',
		personagem: 'visita.png',
		peca: 'notificacao',
		forte: false,
	},
	{
		// As demais palavras em destaque desta fala estão em MOMENTOS_FORTES.
		destaque: 'Visitário',
		personagem: 'conexao.png',
		peca: 'logo',
		forte: true,
	},
];

export const CENAS: Cena[] = tempos.sentences.map((frase, indice) => {
	const metadado = METADADOS[indice];
	if (!metadado) {
		throw new Error(`Metadado ausente para a cena ${indice + 1}`);
	}
	return {
		id: indice + 1,
		frase: frase.text,
		start: round2(frase.start),
		end: round2(frase.end),
		...metadado,
	};
});

/** Duração da transição de whip em frames (8 frames a 60 fps). */
export const WHIP_FRAMES = 8;

export type MomentoForte = {palavra: string; start: number; end: number};

const momentoDaCena7 = (palavra: string): MomentoForte => {
	const encontrada = tempos.words.find(
		(item) => item.word === palavra && item.scene === 7,
	);
	if (!encontrada) {
		throw new Error(`Palavra "${palavra}" não encontrada na cena 7`);
	}
	return {
		palavra: encontrada.word,
		start: round2(encontrada.start),
		end: round2(encontrada.end),
	};
};

export const MOMENTOS_FORTES: MomentoForte[] = [
	momentoDaCena7('Visitário'),
	momentoDaCena7('clareza'),
	momentoDaCena7('registro'),
	momentoDaCena7('cuidado'),
];

export const cenaAtiva = (frame: number): Cena | null => {
	const t = frame / FPS;
	for (let i = 0; i < CENAS.length; i += 1) {
		const cena = CENAS[i];
		const ultima = i === CENAS.length - 1;
		if (t >= cena.start && (ultima ? t <= cena.end : t < cena.end)) {
			return cena;
		}
	}
	return null;
};
