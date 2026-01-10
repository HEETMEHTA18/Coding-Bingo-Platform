w// Shared types used by both client & server

export type GameType = 'bingo' | 'sudoku' | 'connect4' | 'memory' | 'race' | 'crossword' | 'quiz' | 'puzzlehunt' | 'codecanvas';

export interface DemoResponse {
  message: string;
}

// Room types
export interface Room {
  code: string;
  title: string;
  gameType?: GameType;
  roundEndAt: string | null;
}

// Team types
export interface Team {
  id: string;
  name: string;
  score: number;
  completedAt: string | null;
  isWinner: boolean;
  team_id?: string;
  team_name?: string;
  lines_completed?: number;
  start_time?: string;
  end_time?: string;
  time_taken_ms?: number;
  solved_questions_count?: number;
}

// Question types
export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer?: number | string;
  points: number;
  grid_position?: string | null;
  question_id?: number;
  question_text?: string;
  correct_answer?: string;
  is_real?: boolean;
}

// Game state
export interface GameStateResponse {
  room: Room;
  team: Team;
  questions: Question[];
  solved_positions?: string[];
  currentQuestionIndex: number;
  gameStarted: boolean;
  gameEnded: boolean;
  timeRemaining: number;
}

// Leaderboard
export interface LeaderboardResponse {
  rows: Array<{
    team: Team;
    rank: number;
  }>;
}

export interface LeaderboardAllResponse {
  [roomCode: string]: LeaderboardResponse;
}

// Admin types
export interface AdminStateResponse {
  room: Room | null;
  questions: Question[];
  teams: Team[];
  currentQuestionIndex: number;
  gameStarted: boolean;
  gameEnded: boolean;
  timeRemaining: number;
}

export interface AdminCreateRoomRequest {
  code: string;
  title: string;
  gameType?: GameType;
  durationMinutes: number | null;
}

export interface AdminAddQuestionRequest {
  room: string;
  question: {
    text: string;
    options: string[];
    correctAnswer: number;
    points: number;
    isReal?: boolean;
  };
}

export interface AdminDeleteQuestionRequest {
  room: string;
  questionId: string | number;
}

// Login
export interface LoginRequest {
  team_name: string;
  room_code: string;
}

export interface LoginResponse {
  team: Team;
  room: Room;
}

// Submit answer
export interface SubmitRequest {
  room: string;
  teamId: string;
  questionId: string;
  answer: string;
}

export interface SubmissionResult {
  correct: boolean;
  points: number;
  newScore: number;
  achievement?: Achievement;
  status?: string;
  solved_positions?: string[];
  lines_completed?: number;
  win?: boolean;
}

// Achievement (from achievements.ts)
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
}

// Error response
export interface ErrorResponse {
  error: string;
}
// Auth Login
export interface AuthLoginRequest {
  username?: string;
  password?: string;
}

export interface AuthLoginResponse {
  success: boolean;
  admin?: {
    id: number;
    username: string;
    role: string;
    createdBy?: number | null;
  };
  sessionToken?: string;
  error?: string;
}

// Super Admin types
export interface AdminUser {
  id: number;
  username: string;
  role: 'superadmin' | 'admin';
  createdAt: string;
  createdBy: number | null;
  createdByUsername?: string;
}

export interface ActivityLog {
  id: number;
  userId: number;
  username: string;
  action: string;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceInfo: object | null;
  timestamp: string;
}

export interface AdminSession {
  id: number;
  userId: number;
  username?: string;
  sessionToken: string;
  ipAddress: string | null;
  userAgent: string | null;
  deviceInfo: object | null;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  isActive: boolean;
}

export interface WebsiteStats {
  totalRooms: number;
  activeRooms: number;
  totalTeams: number;
  totalQuestions: number;
  totalAdmins: number;
  recentActivity: ActivityLog[];
}
