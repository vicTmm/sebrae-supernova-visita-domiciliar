import * as React from 'react';
import {staticFile} from 'remotion';
import {FONTE_CORPO, FPS, round2} from './config';
import {entradaRapida} from './movimento';
import type {Cena} from './types';

const VERDE = '#145B49';
const TEXTO = '#172B35';
const APOIO = '#245A81';
const FUNDO = '#F5F7F8';

const FONTE_CSS = `
@font-face {
  font-family: '${FONTE_CORPO}';
  src: url('${staticFile('fonts/inter-latin-wght-normal.woff2')}') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: block;
}
`;

type NomeIcone =
	| 'papel'
	| 'tecla'
	| 'sinalOff'
	| 'copia'
	| 'check'
	| 'sync'
	| 'logo'
	| 'bolha'
	| 'pulso'
	| 'seta'
	| 'relogio'
	| 'lapis'
	| 'nuvem'
	| 'casa'
	| 'lista'
	| 'wifi'
	| 'bateria';

const DESENHOS: Record<NomeIcone, React.ReactNode> = {
	papel: (
		<>
			<path d="M7 3.5h7l4 4v13H7z" />
			<path d="M14 3.5v4h4" />
			<path d="M9.5 12h5.5M9.5 15.5h5.5" />
		</>
	),
	tecla: (
		<>
			<rect x="3" y="6" width="18" height="12" rx="3" />
			<path d="M7 10h.01M11 10h.01M15 10h.01M7.5 14h9" />
		</>
	),
	sinalOff: (
		<>
			<path d="M4 18h1.5M8.5 14.5V18M13 11v7M17.5 7.5V18" />
			<path d="M3 3l18 18" />
		</>
	),
	copia: (
		<>
			<rect x="8" y="8" width="12" height="12" rx="2" />
			<path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
		</>
	),
	check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
	sync: (
		<>
			<path d="M20 9a8 8 0 0 0-14.5-2.5" />
			<path d="M4 15a8 8 0 0 0 14.5 2.5" />
			<path d="M17.5 3.5v4h-4M6.5 20.5v-4h4" />
		</>
	),
	logo: (
		<>
			<path d="M4 6l8 13 8-13" />
			<path d="M12 19c-4.5-2-6.5-5-6-9 4.5.2 7.2 2.3 8 6.2" />
		</>
	),
	bolha: (
		<>
			<path d="M20 12a8 8 0 0 1-8 8H7l-3 2 1-5a8 8 0 1 1 15-5z" />
			<path d="M9 11h7M9 14h4" />
		</>
	),
	pulso: <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />,
	seta: (
		<>
			<path d="M4 12h15" />
			<path d="M14 7l5 5-5 5" />
		</>
	),
	relogio: (
		<>
			<circle cx="12" cy="12" r="9" />
			<path d="M12 7v5l3.5 2" />
		</>
	),
	lapis: (
		<>
			<path d="M4 20l4.5-1 11-11-3.5-3.5-11 11z" />
			<path d="M14.5 5.5l3.5 3.5" />
		</>
	),
	nuvem: <path d="M7 18h10a4 4 0 0 0 .3-8A5.5 5.5 0 0 0 6.6 10.5 3.8 3.8 0 0 0 7 18z" />,
	casa: (
		<>
			<path d="M4 11l8-6 8 6" />
			<path d="M6 10v9h12v-9" />
			<path d="M10 19v-5h4v5" />
		</>
	),
	lista: (
		<>
			<path d="M9 6h11M9 12h11M9 18h11" />
			<path d="M4 6h.01M4 12h.01M4 18h.01" />
		</>
	),
	wifi: (
		<>
			<path d="M3 9a14 14 0 0 1 18 0M6.5 12.5a9 9 0 0 1 11 0M10 16a4 4 0 0 1 4 0" />
			<circle cx="12" cy="19" r="0.9" fill="currentColor" stroke="none" />
		</>
	),
	bateria: (
		<>
			<rect x="3" y="8" width="16" height="8" rx="2" />
			<path d="M21 10.5v3" />
		</>
	),
};

const Icone: React.FC<{nome: NomeIcone; tamanho?: number; cor?: string}> = ({
	nome,
	tamanho = 24,
	cor = 'currentColor',
}) => (
	<svg
		width={tamanho}
		height={tamanho}
		viewBox="0 0 24 24"
		fill="none"
		stroke={cor}
		strokeWidth={1.8}
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		{DESENHOS[nome]}
	</svg>
);

const IconeRedondo: React.FC<{
	nome: NomeIcone;
	cor: string;
	fundo: string;
	tamanho?: number;
}> = ({nome, cor, fundo, tamanho = 64}) => (
	<div
		style={{
			width: tamanho,
			height: tamanho,
			flexShrink: 0,
			borderRadius: tamanho / 2,
			background: fundo,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
		}}
	>
		<Icone nome={nome} tamanho={round2(tamanho * 0.55)} cor={cor} />
	</div>
);

const Rotulo: React.FC<{
	texto: string;
	cor?: string;
	fundo?: string;
}> = ({texto, cor = VERDE, fundo = '#E7F3EE'}) => (
	<span
		style={{
			display: 'inline-block',
			borderRadius: 999,
			padding: '4px 12px',
			background: fundo,
			color: cor,
			fontSize: 13,
			fontWeight: 800,
			letterSpacing: 0.7,
			textTransform: 'uppercase',
		}}
	>
		{texto}
	</span>
);

const TituloTela: React.FC<{children: React.ReactNode}> = ({children}) => (
	<div style={{fontSize: 23, fontWeight: 750, color: TEXTO, lineHeight: 1.2}}>
		{children}
	</div>
);

const Cartao: React.FC<{
	children: React.ReactNode;
	destaque?: boolean;
}> = ({children, destaque = false}) => (
	<div
		style={{
			background: destaque ? '#EAF5F0' : '#FFFFFF',
			border: `1px solid ${destaque ? '#BCDCD0' : '#E1E9EC'}`,
			borderRadius: 18,
			padding: '13px 15px',
			boxShadow: '0 4px 14px rgba(23,43,53,0.05)',
		}}
	>
		{children}
	</div>
);

const LinhaInfo: React.FC<{
	icone: NomeIcone;
	children: React.ReactNode;
	cor?: string;
}> = ({icone, children, cor = VERDE}) => (
	<div style={{display: 'flex', alignItems: 'center', gap: 9, marginTop: 7}}>
		<Icone nome={icone} tamanho={18} cor={cor} />
		<span style={{fontSize: 16, color: '#3C5661', lineHeight: 1.35}}>{children}</span>
	</div>
);

type TelaApp =
	| 'papel'
	| 'reescrita'
	| 'offline'
	| 'soap'
	| 'copia'
	| 'sincroniza'
	| 'inicio';

const TELA_DA_CENA: Record<number, TelaApp> = {
	1: 'papel',
	2: 'reescrita',
	3: 'offline',
	4: 'soap',
	5: 'copia',
	6: 'sincroniza',
	7: 'inicio',
};

const conteudoDaTela = (tela: TelaApp, frameLocal: number): React.ReactNode => {
	switch (tela) {
		case 'papel':
			return (
				<>
					<Rotulo texto="Anotação em papel" cor="#8A5A21" fundo="#FFF1D8" />
					<TituloTela>Visita da Sra. Maria</TituloTela>
					<Cartao>
						<div style={{fontSize: 16, fontWeight: 700, color: TEXTO}}>
							Registro feito na visita
						</div>
						<LinhaInfo icone="papel">Queixa e contexto anotados à mão</LinhaInfo>
						<LinhaInfo icone="lapis" cor="#8A5A21">
							1 evolução para digitar de novo
						</LinhaInfo>
					</Cartao>
					<Cartao>
						<div style={{fontSize: 15, color: '#4B626D'}}>
							Horário: 09:30 · Agente de saúde: Ana (demo)
						</div>
					</Cartao>
				</>
			);
		case 'reescrita':
			return (
				<>
					<Rotulo texto="Rascunho capturado" />
					<TituloTela>Evolução em um só lugar</TituloTela>
					<Cartao>
						<div style={{fontSize: 16, fontWeight: 700, color: VERDE}}>S · Subjetivo</div>
						<div style={{fontSize: 15, color: '#3C5661', marginTop: 3}}>
							“Dor no joelho ao caminhar.”
						</div>
						<div style={{fontSize: 16, fontWeight: 700, color: VERDE, marginTop: 9}}>
							O · Objetivo
						</div>
						<div style={{fontSize: 15, color: '#3C5661', marginTop: 3}}>
							Edema leve, sem febre.
						</div>
					</Cartao>
					<Cartao destaque>
						<LinhaInfo icone="check">
							Digitado na visita, sem reescrever depois
						</LinhaInfo>
					</Cartao>
				</>
			);
		case 'offline':
			return (
				<>
					<Rotulo texto="Sem sinal" cor="#8A5A21" fundo="#FFF1D8" />
					<TituloTela>Visita organizada</TituloTela>
					<Cartao>
						<LinhaInfo icone="nuvem">
							Caderno de campo disponível offline
						</LinhaInfo>
						<LinhaInfo icone="check">3 itens salvos no aparelho</LinhaInfo>
					</Cartao>
					<Cartao>
						<div style={{fontSize: 15, fontWeight: 700, color: TEXTO}}>
							Checklist da visita
						</div>
						<LinhaInfo icone="pulso">Sinais registrados</LinhaInfo>
						<LinhaInfo icone="bolha">Queixa da paciente</LinhaInfo>
						<LinhaInfo icone="casa">Contexto da moradia</LinhaInfo>
					</Cartao>
				</>
			);
		case 'soap':
			return (
				<>
					<Rotulo texto="Evolução SOAP · prévia" />
					<TituloTela>Pronta para revisão</TituloTela>
					<Cartao>
						{[
							['S', 'Dor no joelho ao caminhar'],
							['O', 'Edema leve, sem febre'],
							['A', 'Mobilidade reduzida'],
							['P', 'Reavaliar em 7 dias'],
						].map(([letra, texto]) => (
							<div
								key={letra}
								style={{display: 'flex', gap: 9, alignItems: 'flex-start', marginTop: 6}}
							>
								<span
									style={{
										minWidth: 24,
										height: 24,
										borderRadius: 7,
										background: '#E7F3EE',
										color: VERDE,
										fontSize: 14,
										fontWeight: 800,
										textAlign: 'center',
										lineHeight: '24px',
									}}
								>
									{letra}
								</span>
								<span style={{fontSize: 15, color: '#3C5661', lineHeight: 1.35}}>
									{texto}
								</span>
							</div>
						))}
					</Cartao>
					<Cartao destaque>
						<LinhaInfo icone="lapis">Prévia gerada — conferir antes de salvar</LinhaInfo>
					</Cartao>
				</>
			);
		case 'copia':
			return (
				<>
					<Rotulo texto="Texto em blocos" />
					<TituloTela>Evolução para copiar</TituloTela>
					<Cartao>
						<div style={{fontSize: 15, color: TEXTO, lineHeight: 1.45}}>
							S: dor no joelho ao caminhar.
							<br />
							O: edema leve, sem febre.
							<br />
							A: mobilidade reduzida.
							<br />
							P: reavaliar em 7 dias.
						</div>
					</Cartao>
					<Cartao destaque>
						<div
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: 8,
								background: VERDE,
								borderRadius: 12,
								padding: '9px 12px',
								color: '#FFFFFF',
								fontSize: 15,
								fontWeight: 700,
							}}
						>
							<Icone nome="copia" tamanho={18} cor="#FFFFFF" />
							Copiar para o VitaCare
						</div>
						<LinhaInfo icone="check">Copiado para a área de transferência</LinhaInfo>
					</Cartao>
				</>
			);
		case 'sincroniza': {
			const sincronizada = frameLocal > 132;
			return (
				<>
					<Rotulo
						texto={sincronizada ? 'Sincronizada' : 'Rascunho local'}
						cor={sincronizada ? VERDE : '#8A5A21'}
						fundo={sincronizada ? '#E7F3EE' : '#FFF1D8'}
					/>
					<TituloTela>Sem sinal, sem perda</TituloTela>
					<Cartao>
						<LinhaInfo icone="nuvem">
							Rascunho guardado no aparelho
						</LinhaInfo>
						<LinhaInfo icone="relogio">
							Sincronização quando o sinal voltar
						</LinhaInfo>
					</Cartao>
					<Cartao destaque>
						<LinhaInfo icone={sincronizada ? 'check' : 'sync'}>
							{sincronizada
								? 'Evolução sincronizada agora'
								: 'Aguardando conexão — nada foi perdido'}
						</LinhaInfo>
					</Cartao>
				</>
			);
		}
		case 'inicio':
			return (
				<>
					<Rotulo texto="Agenda de hoje" />
					<TituloTela>Visita domiciliar</TituloTela>
					<Cartao>
						<div style={{fontSize: 16, fontWeight: 700, color: TEXTO}}>
							Sra. Maria · 09:30
						</div>
						<LinhaInfo icone="check">Evolução revisada e salva</LinhaInfo>
					</Cartao>
					<Cartao>
						<div style={{fontSize: 16, fontWeight: 700, color: TEXTO}}>
							Sr. João · 11:00
						</div>
						<LinhaInfo icone="papel">Rascunho pronto para revisão</LinhaInfo>
					</Cartao>
				</>
			);
	}
};

const ITENS_NAV: Array<{rotulo: string; icone: NomeIcone}> = [
	{rotulo: 'Visitas', icone: 'casa'},
	{rotulo: 'Rascunhos', icone: 'lista'},
	{rotulo: 'Textos', icone: 'copia'},
];

const Celular: React.FC<{cena: Cena; frameLocal: number}> = ({cena, frameLocal}) => {
	const entrada = entradaRapida(Math.max(0, frameLocal - 2), FPS);
	const tela = TELA_DA_CENA[cena.id] ?? 'inicio';
	const navAtiva = tela === 'offline' || tela === 'sincroniza' ? 1 : 0;

	return (
		<div
			style={{
				position: 'absolute',
				left: 668,
				top: 716,
				width: 342,
				height: 780,
				boxSizing: 'border-box',
				padding: 10,
				borderRadius: 46,
				background: '#14242C',
				boxShadow:
					'0 30px 64px rgba(23,43,53,0.28), 0 6px 14px rgba(23,43,53,0.16), inset 0 0 0 2px rgba(255,255,255,0.12)',
				opacity: round2(entrada.opacity),
				transform: `translateY(${round2(entrada.y)}px) scale(${round2(entrada.scale)})`,
				transformOrigin: '50% 50%',
			}}
		>
			<div
				style={{
					position: 'relative',
					width: '100%',
					height: '100%',
					boxSizing: 'border-box',
					borderRadius: 36,
					background: '#FAFCFC',
					overflow: 'hidden',
					display: 'flex',
					flexDirection: 'column',
					fontFamily: FONTE_CORPO,
				}}
			>
				<div
					style={{
						position: 'absolute',
						top: 8,
						left: 121,
						width: 80,
						height: 22,
						borderRadius: 11,
						background: '#12202A',
					}}
				/>
				<div
					style={{
						height: 42,
						flexShrink: 0,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						padding: '8px 20px 0',
						color: TEXTO,
						fontSize: 15,
						fontWeight: 700,
					}}
				>
					<span>09:41</span>
					<span style={{display: 'flex', alignItems: 'center', gap: 5}}>
						<Icone nome="wifi" tamanho={14} cor={TEXTO} />
						<Icone nome="bateria" tamanho={17} cor={TEXTO} />
					</span>
				</div>
				<div
					style={{
						height: 86,
						flexShrink: 0,
						background: VERDE,
						display: 'flex',
						alignItems: 'center',
						gap: 11,
						padding: '0 18px',
					}}
				>
					<div
						style={{
							width: 44,
							height: 44,
							flexShrink: 0,
							borderRadius: 14,
							background: 'rgba(255,255,255,0.16)',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
						}}
					>
						<Icone nome="logo" tamanho={27} cor="#FFFFFF" />
					</div>
					<div>
						<div style={{fontSize: 24, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.1}}>
							Visitário
						</div>
						<div style={{fontSize: 13, color: '#CDE6DC', marginTop: 3}}>
							Registro de visita domiciliar
						</div>
					</div>
				</div>
				<div
					style={{
						flex: 1,
						minHeight: 0,
						display: 'flex',
						flexDirection: 'column',
						gap: 11,
						padding: '16px 16px 6px',
					}}
				>
					{conteudoDaTela(tela, frameLocal)}
					<div
						style={{
							marginTop: 'auto',
							textAlign: 'center',
							fontSize: 11,
							color: '#84979F',
							letterSpacing: 0.3,
						}}
					>
						Demonstração · dados fictícios
					</div>
				</div>
				<div
					style={{
						height: 58,
						flexShrink: 0,
						borderTop: '1px solid #E3EAEC',
						background: '#FFFFFF',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-around',
					}}
				>
					{ITENS_NAV.map((item, indice) => (
						<div
							key={item.rotulo}
							style={{
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								gap: 2,
								color: navAtiva === indice ? VERDE : '#82959D',
								fontSize: 11,
								fontWeight: navAtiva === indice ? 800 : 600,
							}}
						>
							<Icone nome={item.icone} tamanho={19} />
							{item.rotulo}
						</div>
					))}
				</div>
			</div>
		</div>
	);
};

const VALORES_MEDICAO = [128, 122, 116, 110, 104, 98, 92, 86, 82];
const ALTURA_LINHA_NUMERO = 54;
const TEXTO_DIGITADO = 'S: dor no joelho ao caminhar';

const conteudoDaPeca = (cena: Cena, frameLocal: number): React.ReactNode => {
	const duracaoFrames = Math.max(1, (cena.end - cena.start) * FPS);

	switch (cena.peca) {
		case 'notificacao': {
			if (cena.id === 6) {
				const sincronizada = frameLocal > duracaoFrames * 0.55;
				const progresso = Math.min(1, frameLocal / duracaoFrames);
				return (
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 17,
							width: '100%',
							boxSizing: 'border-box',
						}}
					>
						<IconeRedondo
							nome={sincronizada ? 'check' : 'sync'}
							cor={sincronizada ? VERDE : '#8A5A21'}
							fundo={sincronizada ? '#E7F3EE' : '#FFF1D8'}
						/>
						<div style={{flex: 1, minWidth: 0}}>
							<div style={{fontSize: 16, fontWeight: 800, letterSpacing: 1, color: APOIO}}>
								SINCRONIZAÇÃO
							</div>
							<div style={{fontSize: 29, fontWeight: 750, color: TEXTO, marginTop: 3}}>
								Pendente <span style={{color: '#8AA0A9'}}>→</span> Sincronizada
							</div>
							<div
								style={{
									marginTop: 10,
									height: 6,
									borderRadius: 3,
									background: '#E4ECEE',
									overflow: 'hidden',
								}}
							>
								<div
									style={{
										width: `${round2(progresso * 100)}%`,
										height: '100%',
										borderRadius: 3,
										background: VERDE,
									}}
								/>
							</div>
						</div>
					</div>
				);
			}
			return (
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: 17,
						width: '100%',
						boxSizing: 'border-box',
					}}
				>
					<IconeRedondo nome="papel" cor="#8A5A21" fundo="#FFF1D8" />
					<div style={{flex: 1, minWidth: 0}}>
						<div style={{fontSize: 16, fontWeight: 800, letterSpacing: 1, color: APOIO}}>
							LEMBRETE DA VISITA
						</div>
						<div style={{fontSize: 29, fontWeight: 750, color: TEXTO, marginTop: 3}}>
							Registro no papel
						</div>
						<div style={{fontSize: 19, color: '#4B626D', marginTop: 3}}>
							Anotado na visita, digitado depois
						</div>
					</div>
					<div
						style={{
							flexShrink: 0,
							borderRadius: 14,
							padding: '8px 13px',
							background: '#FFF1D8',
							color: '#8A5A21',
							fontSize: 26,
							fontWeight: 800,
						}}
					>
						2×
					</div>
				</div>
			);
		}
		case 'tecla': {
			const visiveis = Math.min(
				TEXTO_DIGITADO.length,
				Math.floor(frameLocal / 3),
			);
			const caretVisivel = Math.floor(frameLocal / 16) % 2 === 0;
			return (
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: 17,
						width: '100%',
						boxSizing: 'border-box',
					}}
				>
					<IconeRedondo nome="tecla" cor={VERDE} fundo="#E7F3EE" />
					<div style={{flex: 1, minWidth: 0}}>
						<div style={{fontSize: 16, fontWeight: 800, letterSpacing: 1, color: APOIO}}>
							EVOLUÇÃO · CAMPO DE TEXTO
						</div>
						<div
							style={{
								marginTop: 7,
								minHeight: 54,
								display: 'flex',
								alignItems: 'center',
								border: '1px solid #CFDDD9',
								borderRadius: 14,
								background: '#F7FAF9',
								padding: '8px 12px',
								fontSize: 21,
								color: TEXTO,
								whiteSpace: 'nowrap',
								overflow: 'hidden',
							}}
						>
							<span>{TEXTO_DIGITADO.slice(0, visiveis)}</span>
							{caretVisivel ? (
								<span
									style={{
										width: 3,
										height: 25,
										flexShrink: 0,
										marginLeft: 2,
										borderRadius: 2,
										background: VERDE,
									}}
								/>
							) : null}
						</div>
					</div>
				</div>
			);
		}
		case 'clique': {
			const progresso = Math.min(1, frameLocal / 96);
			const pulso = 1 + 0.28 * ((frameLocal % 48) / 48);
			return (
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: 17,
						width: '100%',
						boxSizing: 'border-box',
					}}
				>
					<IconeRedondo nome="sinalOff" cor="#8A5A21" fundo="#FFF1D8" />
					<div style={{flex: 1, minWidth: 0}}>
						<div style={{fontSize: 16, fontWeight: 800, letterSpacing: 1, color: APOIO}}>
							REGISTRO LOCAL
						</div>
						<div style={{fontSize: 29, fontWeight: 750, color: TEXTO, marginTop: 3}}>
							Sem sinal · salvando
						</div>
						<div
							style={{
								marginTop: 10,
								height: 6,
								borderRadius: 3,
								background: '#E4ECEE',
								overflow: 'hidden',
							}}
						>
							<div
								style={{
									width: `${round2(progresso * 100)}%`,
									height: '100%',
									borderRadius: 3,
									background: VERDE,
								}}
							/>
						</div>
					</div>
					<div style={{position: 'relative', width: 62, height: 62, flexShrink: 0}}>
						<div
							style={{
								position: 'absolute',
								top: 0,
								left: 0,
								width: 62,
								height: 62,
								borderRadius: 31,
								border: '2px solid rgba(20,91,73,0.45)',
								transform: `scale(${round2(pulso)})`,
								transformOrigin: '50% 50%',
							}}
						/>
						<div
							style={{
								position: 'absolute',
								top: 11,
								left: 11,
								width: 40,
								height: 40,
								borderRadius: 20,
								background: VERDE,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
							}}
						>
							<Icone nome="check" tamanho={22} cor="#FFFFFF" />
						</div>
					</div>
				</div>
			);
		}
		case 'numero': {
			const passo = Math.max(6, duracaoFrames / VALORES_MEDICAO.length);
			const posicao = Math.min(VALORES_MEDICAO.length - 1, frameLocal / passo);
			const deslocamento = round2(posicao * ALTURA_LINHA_NUMERO);
			const yNumero = deslocamento === 0 ? 0 : -deslocamento;
			return (
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: 17,
						width: '100%',
						boxSizing: 'border-box',
					}}
				>
					<IconeRedondo nome="pulso" cor={VERDE} fundo="#E7F3EE" />
					<div style={{flex: 1, minWidth: 0}}>
						<div style={{fontSize: 16, fontWeight: 800, letterSpacing: 1, color: APOIO}}>
							SINAL · MEDIÇÃO FICTÍCIA
						</div>
						<div style={{display: 'flex', alignItems: 'center', gap: 10, marginTop: 2}}>
							<div
								style={{
									height: ALTURA_LINHA_NUMERO,
									overflow: 'hidden',
								}}
							>
								<div
									style={{
										transform: `translateY(${round2(yNumero)}px)`,
									}}
								>
									{VALORES_MEDICAO.map((valor) => (
										<div
											key={valor}
											style={{
												height: ALTURA_LINHA_NUMERO,
												lineHeight: `${ALTURA_LINHA_NUMERO}px`,
												fontSize: 46,
												fontWeight: 800,
												color: VERDE,
												letterSpacing: -1,
											}}
										>
											{valor}
										</div>
									))}
								</div>
							</div>
							<div style={{fontSize: 21, fontWeight: 700, color: '#5B7079'}}>bpm</div>
						</div>
					</div>
					<div
						style={{
							flexShrink: 0,
							fontSize: 19,
							fontWeight: 750,
							color: APOIO,
							background: '#EAF1F7',
							borderRadius: 14,
							padding: '8px 13px',
						}}
					>
						128 → 82
					</div>
				</div>
			);
		}
		case 'conversa': {
			const copiado = frameLocal > 42;
			return (
				<div
					style={{
						display: 'flex',
						alignItems: 'flex-start',
						gap: 17,
						width: '100%',
						boxSizing: 'border-box',
					}}
				>
					<IconeRedondo nome="bolha" cor={VERDE} fundo="#E7F3EE" />
					<div style={{flex: 1, minWidth: 0}}>
						<div style={{fontSize: 16, fontWeight: 800, letterSpacing: 1, color: APOIO}}>
							CONVERSA · DEMONSTRAÇÃO
						</div>
						<div
							style={{
								marginTop: 8,
								display: 'inline-block',
								maxWidth: '100%',
								borderRadius: '16px 16px 16px 4px',
								background: '#EAF5F0',
								padding: '9px 14px',
								fontSize: 20,
								color: TEXTO,
							}}
						>
							Evolução pronta para revisão
						</div>
						<div style={{marginTop: 6, fontSize: 18, color: APOIO, fontWeight: 650}}>
							Copiar para o VitaCare
						</div>
					</div>
					<div
						style={{
							flexShrink: 0,
							display: 'flex',
							alignItems: 'center',
							gap: 7,
							borderRadius: 14,
							padding: '10px 13px',
							background: copiado ? VERDE : '#DCE7E4',
							color: '#FFFFFF',
							fontSize: 18,
							fontWeight: 750,
							opacity: copiado ? 1 : 0.7,
						}}
					>
						<Icone nome="check" tamanho={19} cor="#FFFFFF" />
						Texto copiado
					</div>
				</div>
			);
		}
		case 'logo':
			return (
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: 17,
						width: '100%',
						boxSizing: 'border-box',
					}}
				>
					<div
						style={{
							width: 64,
							height: 64,
							flexShrink: 0,
							borderRadius: 20,
							background: '#FFFFFF',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
						}}
					>
						<Icone nome="logo" tamanho={39} cor={VERDE} />
					</div>
					<div>
						<div style={{fontSize: 39, fontWeight: 800, color: '#FFFFFF', letterSpacing: -1}}>
							Visitário
						</div>
						<div style={{fontSize: 18, color: '#CDE6DC', marginTop: 2}}>
							Mais clareza no registro, continuidade no cuidado
						</div>
					</div>
				</div>
			);
	}
};

const Peca: React.FC<{cena: Cena; frameLocal: number}> = ({cena, frameLocal}) => {
	const entrada = entradaRapida(Math.max(0, frameLocal - 8), FPS);
	const fundo = cena.peca === 'logo' ? VERDE : '#FFFFFF';

	return (
		<div
			style={{
				position: 'absolute',
				left: 128,
				top: 1538,
				width: 612,
				minHeight: 132,
				boxSizing: 'border-box',
				borderRadius: 28,
				padding: '19px 22px',
				display: 'flex',
				alignItems: 'center',
				background: fundo,
				border: `1px solid ${cena.peca === 'logo' ? 'rgba(255,255,255,0.22)' : 'rgba(20,91,73,0.12)'}`,
				boxShadow:
					'0 20px 48px rgba(23,43,53,0.18), 0 3px 8px rgba(23,43,53,0.08)',
				fontFamily: FONTE_CORPO,
				opacity: round2(entrada.opacity),
				transform: `translateY(${round2(entrada.y)}px) scale(${round2(entrada.scale)})`,
				transformOrigin: '0% 50%',
			}}
		>
			{conteudoDaPeca(cena, frameLocal)}
		</div>
	);
};

export const PecasCena: React.FC<{cena: Cena; frameLocal: number}> = ({
	cena,
	frameLocal,
}) => (
	<>
		<style>{FONTE_CSS}</style>
		<Celular cena={cena} frameLocal={frameLocal} />
		<Peca cena={cena} frameLocal={frameLocal} />
	</>
);
