import { pgTable, text, integer, boolean, timestamp, serial, varchar } from "drizzle-orm/pg-core";

export const rooms = pgTable("rooms", {
  code: varchar("code", { length: 10 }).primaryKey(),
  title: text("title").notNull(),
  roundEndAt: timestamp("round_end_at"),
});

export const questions = pgTable("questions", {
  questionId: serial("question_id").primaryKey(),
  roomCode: varchar("room_code", { length: 10 }).references(() => rooms.code).notNull(),
  questionText: text("question_text").notNull(),
  isReal: boolean("is_real").notNull(),
  correctAnswer: text("correct_answer").notNull(),
});

export const teams = pgTable("teams", {
  teamId: varchar("team_id", { length: 50 }).primaryKey(),
  teamName: text("team_name").notNull(),
  roomCode: varchar("room_code", { length: 10 }).references(() => rooms.code).notNull(),
  startTime: timestamp("start_time").notNull(),
  linesCompleted: integer("lines_completed").notNull().default(0),
  endTime: timestamp("end_time"),
});

export const teamSolvedPositions = pgTable("team_solved_positions", {
  id: serial("id").primaryKey(),
  teamId: varchar("team_id", { length: 50 }).references(() => teams.teamId).notNull(),
  position: varchar("position", { length: 5 }).notNull(),
});

export const teamSolvedQuestions = pgTable("team_solved_questions", {
  id: serial("id").primaryKey(),
  teamId: varchar("team_id", { length: 50 }).references(() => teams.teamId).notNull(),
  questionId: integer("question_id").references(() => questions.questionId).notNull(),
});
