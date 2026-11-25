export type Palavra = {
  word: string;
  start: number;
  end: number;
  scene: number;
};

export type FraseTempo = {
  index: number;
  text: string;
  start: number;
  end: number;
  words: Palavra[];
};

export type Tempos = {
  duration: number;
  words: Palavra[];
  sentences: FraseTempo[];
};

export type Cena = {
  id: number;
  frase: string;
  start: number;
  end: number;
  destaque: string;
  personagem: 'visita.png' | 'registro.png' | 'conexao.png';
  peca: 'notificacao' | 'tecla' | 'clique' | 'numero' | 'conversa' | 'logo';
  forte: boolean;
};
