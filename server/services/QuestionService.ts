
// server/services/QuestionService.ts
import { QuestionModel } from "../models/Question";
import type { Question, QuestionID, RoomCode } from "@shared/api";

export class QuestionService {
  static generateDemoQuestions(): Question[] {
    const questions: Question[] = [];
    const gridPositions = this.getGridPositions();

    // Generate 25 real questions mapped to grid
    const expressions = [
      [2, 3, 4], [5, 6, 2], [7, 8, 3], [9, 4, 5], [11, 2, 6],
      [13, 5, 2], [15, 3, 4], [17, 2, 8], [19, 1, 9], [21, 2, 10],
      [3, 7, 5], [6, 9, 2], [8, 5, 3], [12, 4, 2], [14, 3, 7],
      [16, 2, 5], [18, 3, 6], [20, 4, 3], [22, 5, 2], [24, 6, 1],
      [26, 2, 2], [28, 3, 3], [30, 4, 4], [32, 5, 5], [34, 6, 6],
    ];

    expressions.forEach(([a, b, c], idx) => {
      const value = a + b * c;
      questions.push({
        question_id: idx + 1,
        question_text: `What is the output? C code: printf("%d", ${a} + ${b} * ${c});`,
        is_real: true,
        correct_answer: String(value),
        assigned_grid_pos: gridPositions[idx],
      });
    });

    // Generate 10 fake questions
    for (let i = 0; i < 10; i++) {
      questions.push({
        question_id: 26 + i,
        question_text: `Fake Question ${i + 1}: What is printed by printf("%s", "C");`,
        is_real: false,
        correct_answer: "C",
        assigned_grid_pos: null,
      });
    }

    return questions;
  }

  static getGridPositions(): string[] {
    const letters = ["A", "B", "C", "D", "E"];
    const positions: string[] = [];
    
    for (let r = 0; r < 5; r++) {
      for (let c = 1; c <= 5; c++) {
        positions.push(`${letters[r]}${c}`);
      }
    }
    
    return positions;
  }

  static async addQuestion(
    roomCode: string,
    questionText: string,
    correctAnswer: string,
    isReal: boolean
  ): Promise<Question> {
    const code = roomCode.toUpperCase() as RoomCode;
    const questionId = await QuestionModel.getNextId(code);

    const question: Question = {
      question_id: questionId,
      question_text: questionText.trim(),
      is_real: isReal,
      correct_answer: correctAnswer.trim(),
      assigned_grid_pos: null,
    };

    return await QuestionModel.create(code, question);
  }

  static async getQuestionsByRoom(roomCode: string): Promise<Question[]> {
    return await QuestionModel.getByRoom(roomCode.toUpperCase() as RoomCode);
  }

  static async getQuestionById(roomCode: string, questionId: QuestionID): Promise<Question | null> {
    return await QuestionModel.findById(roomCode.toUpperCase() as RoomCode, questionId);
  }

  static async deleteQuestion(roomCode: string, questionId: QuestionID): Promise<boolean> {
    return await QuestionModel.delete(roomCode.toUpperCase() as RoomCode, questionId);
  }
}