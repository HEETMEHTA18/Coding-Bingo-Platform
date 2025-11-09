import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const rooms = pgTable("rooms", {
  code: text("code").primaryKey(),
  title: text("title").notNull(),
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
