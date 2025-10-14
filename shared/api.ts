// Shared types for Real-Time Coding Bingo Competition Platform

export type RoomCode = string;
export type TeamID = string;
export type QuestionID = number;

export interface DemoResponse {
  message: string;
}

export interface Room {
  code: RoomCode;
  title: string;
  roundEndAt: number | null; // epoch ms when round ends, null if not started
}

export interface Team {
  team_id: TeamID;
  team_name: string;
  room_code: RoomCode;
  start_time: number; // epoch ms
  lines_completed: number;
  end_time: number | null;
}

export interface Question {
  question_id: QuestionID;
  question_text: string;
  is_real: boolean;
  correct_answer: string;
  assigned_grid_pos: string | null; // e.g. "A1".."E5" when real, else null
}

export interface SubmissionResult {
  status:
    | "correct"
    | "incorrect"
    | "fake"
    | "already_solved"
    | "empty"
    | "disabled";
  is_real: boolean;
  filled_cell: string | null;
  lines_completed: number;
  win: boolean;
  solved_positions: string[]; // positions like A1..E5 solved by this team
}

export interface LeaderboardRow {
  team_name: string;
  lines_completed: number;
  time_taken_ms: number; // if ended: end-start, else now-start
  rank: number;
}

export interface LeaderboardResponse {
  room_code: RoomCode;
  rows: LeaderboardRow[];
  updated_at: number;
}

export interface LoginRequest {
  team_name: string;
  room_code: RoomCode;
}

export interface LoginResponse {
  ok: true;
  team: Team;
  room: Room;
}

export interface ErrorResponse {
  ok: false;
  error: string;
}

export interface GameStateResponse {
  team: Team;
  room: Room;
  questions: Array<Pick<Question, "question_id" | "question_text" | "is_real">>;
  solved_positions: string[]; // positions filled by this team
}

// Admin API
export interface AdminCreateRoomRequest {
  code: RoomCode;
  title: string;
  durationMinutes?: number | null; // start immediately if provided
}
export interface AdminStateResponse {
  room: Room;
  questions: Question[];
  teams: Team[];
}
export interface AdminAddQuestionRequest {
  room: RoomCode;
  question_text: string;
  correct_answer: string;
  is_real: boolean;
}
export interface AdminDeleteQuestionRequest {
  room: RoomCode;
  question_id: QuestionID;
}
export interface AdminStartRequest {
  room: RoomCode;
  minutes: number;
}
export interface AdminForceEndRequest {
  room: RoomCode;
}
