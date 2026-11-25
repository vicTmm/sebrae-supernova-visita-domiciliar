import React from 'react';
import {Composition} from 'remotion';
import {DURACAO_FRAMES, FPS, HEIGHT, WIDTH} from './config';
import {Video} from './Video';

export const RemotionRoot: React.FC = () => {
	return (
		<Composition
			id="VisitarioPitch"
			component={Video}
			durationInFrames={DURACAO_FRAMES}
			fps={FPS}
			width={WIDTH}
			height={HEIGHT}
		/>
	);
};
