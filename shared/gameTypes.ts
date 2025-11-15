// Shared game type definitions for all games

export type GameType = 'bingo' | 'sudoku' | 'connect4' | 'memory' | 'race' | 'crossword' | 'quiz' | 'puzzlehunt';

export interface GameConfig {
  id: GameType;
  name: string;
  description: string;
  icon: string;
  minPlayers: number;
  maxPlayers: number;
  estimatedDuration: number; // minutes
  difficulty: 'easy' | 'medium' | 'hard';
  category: 'puzzle' | 'strategy' | 'speed' | 'memory';
}

export const GAME_CONFIGS: Record<GameType, GameConfig> = {
  bingo: {
    id: 'bingo',
    name: 'Code Bingo',
    description: 'Complete lines by solving C programming questions',
    icon: '🎯',
    minPlayers: 1,
    maxPlayers: 50,
    estimatedDuration: 30,
    difficulty: 'medium',
    category: 'puzzle',
  },
  sudoku: {
    id: 'sudoku',
    name: 'Code Sudoku',
    description: 'Fill the grid with programming keywords following Sudoku rules',
    icon: '📊',
    minPlayers: 1,
    maxPlayers: 20,
    estimatedDuration: 20,
    difficulty: 'medium',
    category: 'puzzle',
  },
  connect4: {
    id: 'connect4',
    name: 'Code Connect-4',
    description: 'Connect 4 cells by answering code questions correctly',
    icon: '🔴',
    minPlayers: 2,
    maxPlayers: 10,
    estimatedDuration: 15,
    difficulty: 'easy',
    category: 'strategy',
  },
  memory: {
    id: 'memory',
    name: 'Code Memory Match',
    description: 'Match code snippets with their outputs',
    icon: '🧠',
    minPlayers: 1,
    maxPlayers: 20,
    estimatedDuration: 10,
    difficulty: 'easy',
    category: 'memory',
  },
  race: {
    id: 'race',
    name: 'Code Race (Debug)',
    description: 'Find and fix bugs faster than other teams',
    icon: '🏁',
    minPlayers: 1,
    maxPlayers: 30,
    estimatedDuration: 15,
    difficulty: 'hard',
    category: 'speed',
  },
  crossword: {
    id: 'crossword',
    name: 'Code Crossword',
    description: 'Solve programming terminology crossword puzzle',
    icon: '📝',
    minPlayers: 1,
    maxPlayers: 20,
    estimatedDuration: 25,
    difficulty: 'medium',
    category: 'puzzle',
  },
  quiz: {
    id: 'quiz',
    name: 'Code Quiz Master',
    description: 'Answer multiple-choice programming questions to score points',
    icon: '❓',
    minPlayers: 1,
    maxPlayers: 50,
    estimatedDuration: 15,
    difficulty: 'easy',
    category: 'speed',
  },
  puzzlehunt: {
    id: 'puzzlehunt',
    name: 'Code Puzzle Hunt',
    description: 'Solve coding riddles and find hidden patterns in code',
    icon: '🔍',
    minPlayers: 1,
    maxPlayers: 30,
    estimatedDuration: 30,
    difficulty: 'hard',
    category: 'puzzle',
  },
};

// Base interface for all game states
export interface BaseGameState {
  gameType: GameType;
  roomCode: string;
  teamId: string;
  startedAt: Date;
  updatedAt: Date;
  isCompleted: boolean;
  progress: number; // 0-100
  score?: number;
}

// Sudoku specific types
export interface SudokuCell {
  value: string | null;
  isFixed: boolean; // pre-filled cells
  isCorrect?: boolean;
}

export interface SudokuGameState extends BaseGameState {
  gameType: 'sudoku';
  gridSize: 6 | 9;
  grid: SudokuCell[][];
  symbols: string[]; // Keywords to fill (e.g., ['if', 'else', 'for', 'while', 'return', 'break'])
  mistakes: number;
}

// Connect4 specific types
export interface Connect4Cell {
  value: string | null; // teamId who claimed it
  questionId: number | null;
  answeredCorrectly: boolean;
}

export interface Connect4GameState extends BaseGameState {
  gameType: 'connect4';
  grid: Connect4Cell[][]; // 7x6 grid
  currentTurn: string; // teamId
  turnOrder: string[]; // list of teamIds
  winner: string | null;
}

// Memory game specific types
export interface MemoryCard {
  id: string;
  type: 'code' | 'output';
  content: string;
  pairId: string; // cards with same pairId match
  isRevealed: boolean;
  isMatched: boolean;
  claimedBy: string | null; // teamId
}

export interface MemoryGameState extends BaseGameState {
  gameType: 'memory';
  cards: MemoryCard[];
  gridSize: { rows: number; cols: number };
  revealedCards: string[]; // current revealed card IDs
  matchedPairs: number;
  totalPairs: number;
}

// Race (Debug) specific types
export interface BuggyCode {
  id: number;
  code: string;
  bugs: Array<{
    line: number;
    type: 'syntax' | 'logic' | 'runtime';
    description: string;
  }>;
  correctCode: string;
}

export interface RaceGameState extends BaseGameState {
  gameType: 'race';
  currentRound: number;
  totalRounds: number;
  buggyCode: BuggyCode;
  submissions: Array<{
    teamId: string;
    code: string;
    submittedAt: Date;
    isCorrect: boolean;
    bugsFixed: number;
  }>;
}

// Crossword specific types
export interface CrosswordClue {
  number: number;
  direction: 'across' | 'down';
  clue: string;
  answer: string;
  startRow: number;
  startCol: number;
  length: number;
}

export interface CrosswordCell {
  letter: string | null;
  isBlocked: boolean;
  clueNumber: number | null;
  isCorrect?: boolean;
}

export interface CrosswordGameState extends BaseGameState {
  gameType: 'crossword';
  grid: CrosswordCell[][];
  clues: CrosswordClue[];
  filledCells: number;
  totalCells: number;
}

// Union type for all game states
export type GameState =
  | BaseGameState
  | SudokuGameState
  | Connect4GameState
  | MemoryGameState
  | RaceGameState
  | CrosswordGameState;

// Game response types for API
export interface GameStateResponse {
  gameType: GameType;
  room: {
    code: string;
    title: string;
    gameType: GameType;
    roundEndAt: string | null;
  };
  team: {
    teamId: string;
    teamName: string;
    score: number;
    rank: number;
  };
  gameState: GameState;
  questions: Array<{
    questionId: number;
    questionText: string;
    gridPosition?: string | null;
  }>;
  leaderboard: Array<{
    teamId: string;
    teamName: string;
    score: number;
    progress: number;
  }>;
}
