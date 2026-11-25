import React from 'react';
import {Img, staticFile} from 'remotion';
import {FPS, round2} from './config';
import {quique} from './movimento';
import type {Cena} from './types';

/** Região do personagem: topo livre para o título e direita livre para o celular. */
const CENTRO_X = 420;
const CENTRO_Y = 1190;
const LARGURA_MAX = 480;
const ALTURA_MAX = 620;
const QUADROS_ENTRADA = 28;

/** Proporção original de cada render 3D (largura / altura). */
const PROPORCOES: Record<Cena['personagem'], number> = {
	'visita.png': 1536 / 1024,
	'registro.png': 1217 / 1293,
	'conexao.png': 1536 / 1024,
};

const DESCRICOES: Record<Cena['personagem'], string> = {
	'visita.png': 'Casa ilustrada',
	'registro.png': 'Prancheta ilustrada',
	'conexao.png': 'Elo ilustrado',
};

type Medida = {esquerda: number; topo: number; largura: number; altura: number};

const medidaDoPersonagem = (personagem: Cena['personagem']): Medida => {
	const proporcao = PROPORCOES[personagem];
	const largura = Math.min(LARGURA_MAX, ALTURA_MAX * proporcao);
	const altura = largura / proporcao;
	return {
		esquerda: round2(CENTRO_X - largura / 2),
		topo: round2(CENTRO_Y - altura / 2),
		largura: round2(largura),
		altura: round2(altura),
	};
};

/** Transição suave entre o quique da entrada e a flutuação permanente. */
const misturar = (salto: number, flutuacao: number, pesoFlutuacao: number): number =>
	round2(
		round2(salto) * (1 - pesoFlutuacao) + round2(flutuacao) * pesoFlutuacao,
	);

export const PersonagemCena: React.FC<{cena: Cena; frameLocal: number}> = ({
	cena,
	frameLocal,
}) => {
	const quadro = Math.max(0, frameLocal);
	const progresso = Math.min(1, quadro / QUADROS_ENTRADA);
	const pesoFlutuacao = round2(progresso * progresso * (3 - 2 * progresso));
	const seno = Math.sin(frameLocal / 18);
	const salto = quique(quadro, FPS);

	const y = misturar(salto.y, -16 * seno, pesoFlutuacao);
	const escala = misturar(salto.scale, 1 + 0.012 * seno, pesoFlutuacao);
	const rotacao = misturar(salto.rotate, 0.6 * seno, pesoFlutuacao);

	const medida = medidaDoPersonagem(cena.personagem);
	const sombraLargura = round2(medida.largura * 0.62);
	const sombraAltura = round2(Math.min(64, medida.largura * 0.13));
	const sombraEsquerda = round2(CENTRO_X - sombraLargura / 2);
	const sombraTopo = round2(
		medida.topo + medida.altura - Math.min(28, medida.altura * 0.06),
	);
	const sombraY = round2(4 * seno + 18 * (1 - pesoFlutuacao));
	const sombraEscala = round2(
		(1 - 0.05 * seno) * (0.82 + 0.18 * pesoFlutuacao),
	);

	return (
		<React.Fragment>
			<div
				style={{
					position: 'absolute',
					left: sombraEsquerda,
					top: sombraTopo,
					width: sombraLargura,
					height: sombraAltura,
					borderRadius: '50%',
					backgroundColor: 'rgba(17, 40, 50, 0.22)',
					opacity: round2(0.8 + 0.06 * seno),
					filter: 'blur(24px)',
					transform: `translateY(${sombraY}px) scale(${sombraEscala})`,
					pointerEvents: 'none',
				}}
			/>
			<Img
				src={staticFile('personagens/' + cena.personagem)}
				alt={DESCRICOES[cena.personagem]}
				style={{
					position: 'absolute',
					left: medida.esquerda,
					top: medida.topo,
					width: medida.largura,
					height: medida.altura,
					objectFit: 'contain',
					transform: `translateY(${y}px) scale(${escala}) rotate(${rotacao}deg)`,
					transformOrigin: '50% 88%',
				}}
			/>
		</React.Fragment>
	);
};
