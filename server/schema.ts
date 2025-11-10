import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const rooms = pgTable("rooms", {
  code: text("code").primaryKey(),
  title: text("title").notNull(),
  gameType: text("game_type").notNull().default("bingo"), // 'bingo', 'sudoku', 'connect4', 'memory', 'race', 'crossword'
  roundEndAt: timestamp("round_end_at"),
  isDeleted: boolean("is_deleted")
    .default(false)
    .notNull(),
});

export const teams = pgTable("teams", {
  teamId: text("team_id").primaryKey(),
  teamName: text("team_name").notNull(),
  roomCode: text("room_code")
    .notNull()
    .references(() => rooms.code),
  startTime: timestamp("start_time").notNull(),
  linesCompleted: integer("lines_completed").default(0).notNull(),
  endTime: timestamp("end_time"),
  isDeleted: boolean("is_deleted")
    .default(false)
    .notNull(),
});

export const questions = pgTable("questions", {
  questionId: integer("question_id").primaryKey().generatedAlwaysAsIdentity(),
  roomCode: text("room_code")
    .notNull()
    .references(() => rooms.code),
  questionText: text("question_text").notNull(),
  isReal: boolean("is_real").notNull(),
  correctAnswer: text("correct_answer").notNull(),
  isDeleted: boolean("is_deleted")
    .default(false)
    .notNull(),
});

export const teamSolvedQuestions = pgTable("team_solved_questions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.teamId),
  questionId: integer("question_id")
    .notNull()
    .references(() => questions.questionId),
  solvedAt: timestamp("solved_at").notNull(),
  isDeleted: boolean("is_deleted")
    .default(false)
    .notNull(),
});

export const teamSolvedPositions = pgTable("team_solved_positions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.teamId),
  position: text("position").notNull(),
  isDeleted: boolean("is_deleted")
    .default(false)
    .notNull(),
});

// Store each team's unique question-to-grid mapping
export const teamQuestionMapping = pgTable("team_question_mapping", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.teamId),
  questionId: integer("question_id")
    .notNull()
    .references(() => questions.questionId),
  gridPosition: text("grid_position").notNull(), // A1, A2, etc.
  isDeleted: boolean("is_deleted")
    .default(false)
    .notNull(),
});

export const wipeAudits = pgTable("wipe_audits", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  initiatedBy: text("initiated_by"),
  initiatedAt: timestamp("initiated_at").notNull(),
  options: text("options"),
  deletedCounts: text("deleted_counts"),
});

// Store all submission attempts (correct and incorrect)
export const submissionAttempts = pgTable("submission_attempts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.teamId),
  questionId: integer("question_id")
    .notNull()
    .references(() => questions.questionId),
  roomCode: text("room_code")
    .notNull()
    .references(() => rooms.code),
  submittedAnswer: text("submitted_answer").notNull(),
  isCorrect: boolean("is_correct").notNull(),
  position: text("position"), // Grid position if correct
  attemptedAt: timestamp("attempted_at").notNull().defaultNow(),
  isDeleted: boolean("is_deleted")
    .default(false)
    .notNull(),
});

// Store game board states for all game types
export const gameBoards = pgTable("game_boards", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  roomCode: text("room_code")
    .notNull()
    .references(() => rooms.code),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.teamId),
  gameType: text("game_type").notNull(), // 'sudoku', 'connect4', 'memory', etc.
  boardState: text("board_state").notNull(), // JSON encoded game state
  progress: integer("progress").default(0).notNull(), // % completion or score
  isCompleted: boolean("is_completed").default(false).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  isDeleted: boolean("is_deleted")
    .default(false)
    .notNull(),
});

// Store turn-based game moves (for Connect4, etc.)
export const gameMoves = pgTable("game_moves", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  gameBoardId: integer("game_board_id")
    .notNull()
    .references(() => gameBoards.id),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.teamId),
  moveData: text("move_data").notNull(), // JSON: position, action, etc.
  moveNumber: integer("move_number").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  isDeleted: boolean("is_deleted")
    .default(false)
    .notNull(),
});
