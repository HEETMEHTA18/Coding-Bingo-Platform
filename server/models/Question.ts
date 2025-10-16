// server/models/Question.ts
import { db } from "../db";
import { questions } from "../schema";
import { eq, and } from "drizzle-orm";
import type { Question as QuestionType, QuestionID, RoomCode } from "@shared/api";

export class QuestionModel {
  static async createBatch(roomCode: RoomCode, questionsList: QuestionType[]): Promise<void> {
    const values = questionsList.map(q => ({
      roomCode,
      questionText: q.question_text,
      isReal: q.is_real,
      correctAnswer: q.correct_answer,
    }));
    await db.insert(questions).values(values).onConflictDoNothing();
  }

  static async create(roomCode: RoomCode, question: QuestionType): Promise<QuestionType> {
    const result = await db.insert(questions).values({
      // Don't include questionId - let it auto-generate
      roomCode,
      questionText: question.question_text,
      isReal: question.is_real,
      correctAnswer: question.correct_answer,
    }).returning();
    const inserted = result[0];
    return {
      question_id: inserted.questionId,
      question_text: inserted.questionText,
      is_real: inserted.isReal,
      correct_answer: inserted.correctAnswer,
      assigned_grid_pos: null,
    };
  }

  static async createBatchWithIds(roomCode: RoomCode, questionsList: QuestionType[]): Promise<void> {
    const values = questionsList.map(q => ({
      questionId: q.question_id,
      roomCode,
      questionText: q.question_text,
      isReal: q.is_real,
      correctAnswer: q.correct_answer,
    }));
    await db.insert(questions).values(values).onConflictDoNothing();
  }

  static async createWithId(roomCode: RoomCode, question: QuestionType): Promise<QuestionType> {
    const result = await db.insert(questions).values({
      questionId: question.question_id,
      roomCode,
      questionText: question.question_text,
      isReal: question.is_real,
      correctAnswer: question.correct_answer,
    }).returning();
    const inserted = result[0];
    return {
      question_id: inserted.questionId,
      question_text: inserted.questionText,
      is_real: inserted.isReal,
      correct_answer: inserted.correctAnswer,
      assigned_grid_pos: null,
    };
  }

  static async getByRoom(roomCode: RoomCode): Promise<QuestionType[]> {
    const result = await db.select().from(questions).where(eq(questions.roomCode, roomCode));
    return result.map(row => ({
      question_id: row.questionId,
      question_text: row.questionText,
      is_real: row.isReal,
      correct_answer: row.correctAnswer,
      assigned_grid_pos: null,
    }));
  }

  static async findById(roomCode: RoomCode, questionId: QuestionID): Promise<QuestionType | null> {
    const result = await db.select().from(questions).where(and(eq(questions.roomCode, roomCode), eq(questions.questionId, questionId))).limit(1);
    if (result.length === 0) return null;
    const row = result[0];
    return {
      question_id: row.questionId,
      question_text: row.questionText,
      is_real: row.isReal,
      correct_answer: row.correctAnswer,
      assigned_grid_pos: null,
    };
  }

  static async delete(questionId: QuestionID): Promise<boolean> {
    await db.delete(questions).where(eq(questions.questionId, questionId));
    return true;
  }

  static async getNextId(roomCode: RoomCode): Promise<number> {
    const result = await db.select({ maxId: questions.questionId }).from(questions).where(eq(questions.roomCode, roomCode));
    const maxId = result.length > 0 ? Math.max(...result.map(r => r.maxId || 0)) : 0;
    return maxId + 1;
  }

  static async initialize(roomCode: RoomCode): Promise<void> {
    // No need to initialize, as we insert when needed
  }

  static async deleteAllForRoom(roomCode: RoomCode): Promise<void> {
    await db.delete(questions).where(eq(questions.roomCode, roomCode));
  }
}
