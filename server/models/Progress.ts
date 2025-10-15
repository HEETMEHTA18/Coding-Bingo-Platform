// server/models/Progress.ts
import { db } from "../db";
import { teamSolvedPositions, teamSolvedQuestions } from "../schema";
import { eq, and, inArray } from "drizzle-orm";
import type { TeamID, QuestionID } from "@shared/api";

export class ProgressModel {
  static async initializeTeam(teamId: TeamID): Promise<void> {
    // No need to initialize, as we insert when needed
  }

  static async getSolvedPositions(teamId: TeamID): Promise<string[]> {
    const result = await db.select().from(teamSolvedPositions).where(eq(teamSolvedPositions.teamId, teamId));
    return result.map(row => row.position);
  }

  static async addSolvedPosition(teamId: TeamID, position: string): Promise<void> {
    await db.insert(teamSolvedPositions).values({
      teamId,
      position,
    });
  }

  static async hasPosition(teamId: TeamID, position: string): Promise<boolean> {
    const result = await db.select().from(teamSolvedPositions).where(and(eq(teamSolvedPositions.teamId, teamId), eq(teamSolvedPositions.position, position))).limit(1);
    return result.length > 0;
  }

  static async hasSolvedQuestion(teamId: TeamID, questionId: QuestionID): Promise<boolean> {
    const result = await db.select().from(teamSolvedQuestions).where(and(eq(teamSolvedQuestions.teamId, teamId), eq(teamSolvedQuestions.questionId, questionId))).limit(1);
    return result.length > 0;
  }

  static async markQuestionSolved(teamId: TeamID, questionId: QuestionID): Promise<void> {
    await db.insert(teamSolvedQuestions).values({
      teamId,
      questionId,
    });
  }

  static async getAvailablePositions(teamId: TeamID): Promise<string[]> {
    const letters = ["A", "B", "C", "D", "E"];
    const positions: string[] = [];

    for (let r = 0; r < 5; r++) {
      for (let c = 1; c <= 5; c++) {
        positions.push(`${letters[r]}${c}`);
      }
    }

    const solved = await this.getSolvedPositions(teamId);
    const solvedSet = new Set(solved);

    return positions.filter(p => !solvedSet.has(p));
  }

  static async calculateLines(teamId: TeamID): Promise<number> {
    const positions = await this.getSolvedPositions(teamId);
    const set = new Set(positions);
    const letters = ["A", "B", "C", "D", "E"];
    let lines = 0;

    // Check rows
    for (const letter of letters) {
      let complete = true;
      for (let c = 1; c <= 5; c++) {
        if (!set.has(`${letter}${c}`)) {
          complete = false;
          break;
        }
      }
      if (complete) lines++;
    }

    // Check columns
    for (let c = 1; c <= 5; c++) {
      let complete = true;
      for (let r = 0; r < 5; r++) {
        if (!set.has(`${letters[r]}${c}`)) {
          complete = false;
          break;
        }
      }
      if (complete) lines++;
    }

    // Check diagonals
    const diag1 = ["A1", "B2", "C3", "D4", "E5"];
    const diag2 = ["A5", "B4", "C3", "D2", "E1"];

    if (diag1.every(p => set.has(p))) lines++;
    if (diag2.every(p => set.has(p))) lines++;

    return lines;
  }
}
