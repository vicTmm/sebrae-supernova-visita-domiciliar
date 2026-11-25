import {round2} from './config';

/**
 * Arredonda para 2 casas e canonicaliza o zero, evitando `-0` nas extremidades
 * (seno/cosseno de π e 2π não são exatamente zero em ponto flutuante).
 * Todo número devolvido pelas funções abaixo passa por aqui — e por `round2`.
 */
const arredondar = (valor: number): number =>
	round2(Math.abs(valor) < 0.005 ? 0 : valor);

const limitar = (valor: number): number => Math.min(1, Math.max(0, valor));

/** Progresso 0..1 de uma duração dada em frames a 60 fps. */
const progresso = (frameLocal: number, frames60: number, fps: number): number => {
	const duracao = (frames60 * Math.max(fps, 1)) / 60;
	return limitar(frameLocal / duracao);
};

/**
 * Entrada rápida (12 frames a 60 fps), com leve quique: overshoot controlado
 * que decai até a estabilização. Vai de opacity 0 / scale 0.86 / y 40 a 1 / 1 / 0.
 */
export const entradaRapida = (
	frameLocal: number,
	fps: number,
): {opacity: number; scale: number; y: number} => {
	const t = progresso(frameLocal, 12, fps);
	const restante = 1 - t;
	const avanco = 1 - restante ** 3;
	const oscilacao = Math.sin(t * Math.PI * 2) * 0.12 * restante;
	return {
		opacity: arredondar(avanco),
		scale: arredondar(0.86 + 0.14 * avanco + oscilacao),
		y: arredondar(
			40 * restante ** 3 + Math.sin(t * Math.PI * 2) * 2 * restante,
		),
	};
};

/**
 * Quique do personagem (18 frames a 60 fps): queda acelerada, compressão no
 * toque do solo (`scale` já carrega o achatamento do scaleY), pequeno salto e
 * estabilização. Rotação mantida abaixo de 4 graus.
 */
export const quique = (
	frameLocal: number,
	fps: number,
): {y: number; scale: number; rotate: number} => {
	const t = progresso(frameLocal, 18, fps);

	if (t < 0.55) {
		const u = t / 0.55;
		return {
			y: arredondar(-260 * (1 - u ** 2)),
			scale: arredondar(1 + 0.03 * Math.sin(u * Math.PI)),
			rotate: arredondar(-3.5 * u ** 2),
		};
	}

	if (t < 0.68) {
		const u = (t - 0.55) / 0.13;
		return {
			y: arredondar(8 * Math.sin(u * Math.PI)),
			scale: arredondar(1 - 0.14 * Math.sin(u * Math.PI)),
			rotate: arredondar(-3.5 * (1 - u) ** 2),
		};
	}

	const u = limitar((t - 0.68) / 0.32);
	return {
		y: arredondar(-22 * Math.sin(u * Math.PI) * (1 - u * 0.35)),
		scale: arredondar(1 + 0.05 * Math.sin(u * Math.PI)),
		rotate: arredondar(4 * Math.sin(u * Math.PI * 2) * (1 - u)),
	};
};

/** Aperto lento e monotônico da câmera ao longo da cena: 1.00 → 1.06. */
export const apertoCamera = (
	frameLocal: number,
	duracaoFrames: number,
): number => {
	const t = duracaoFrames > 0 ? limitar(frameLocal / duracaoFrames) : 1;
	const suave = t * t * (3 - 2 * t);
	return arredondar(1 + 0.06 * suave);
};

/**
 * Whip horizontal nos 8 frames (a 60 fps) ao redor da fronteira: `x` varre
 * -160 → +160, `blur` chega a ~18 px no meio e `opacidade` cai no meio.
 * Fora da janela, nada é aplicado.
 */
export const whip = (
	frameGlobal: number,
	fronteiraFrame: number,
	fps: number,
): {x: number; blur: number; opacidade: number} => {
	const janela = Math.max(2, (8 * Math.max(fps, 1)) / 60);
	const delta = frameGlobal - fronteiraFrame;
	const inicio = -janela / 2;

	if (delta < inicio || delta >= inicio + janela) {
		return {x: arredondar(0), blur: arredondar(0), opacidade: arredondar(1)};
	}

	const t = limitar((delta - inicio) / (janela - 1));
	const meio = Math.sin(t * Math.PI);
	return {
		x: arredondar(-160 + 320 * t),
		blur: arredondar(18 * meio),
		opacidade: arredondar(1 - 0.65 * meio),
	};
};
