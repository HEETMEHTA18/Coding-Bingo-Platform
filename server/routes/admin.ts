import { RequestHandler } from "express";
import multer from "multer";
import type {
  AdminStateResponse,
  AdminCreateRoomRequest,
  AdminAddQuestionRequest,
  AdminDeleteQuestionRequest,
  Question,
} from "@shared/api";
import { db } from "../db.js";
import {
  rooms,
  questions as questionsTable,
  teams,
  teamSolvedQuestions,
  teamSolvedPositions,
  teamQuestionMapping,
  wipeAudits,
} from "../schema.js";
import { eq } from "drizzle-orm";

const upload = multer();

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) { out.push(cur.trim()); cur = ""; } else { cur += ch; }
  }
  out.push(cur.trim());
  return out;
}

export const handleAdminState: RequestHandler = async (req, res) => {
  const roomCode = (req.query.room as string) || (req.body?.room as string);
  if (!roomCode) return res.status(400).json({ error: "Room code required" });
  try {
    const code = roomCode.toUpperCase();
    const [room] = await db.select().from(rooms).where(eq(rooms.code, code));
    const questionsResult = await db.select().from(questionsTable).where(eq(questionsTable.roomCode, code));
    const teamsResult = await db.select().from(teams).where(eq(teams.roomCode, code));
    const response: AdminStateResponse = {
      room: room ? { code: room.code, title: room.title, roundEndAt: room.roundEndAt?.toISOString() || null } : null,
      questions: questionsResult.map((q: any) => ({ id: String(q.questionId), text: q.questionText, is_real: q.isReal })) as any,
      teams: teamsResult.map((t: any) => ({ id: t.teamId, name: t.teamName, lines_completed: t.linesCompleted })) as any,
      currentQuestionIndex: 0,
      gameStarted: false,
      gameEnded: false,
      timeRemaining: 0,
    };
    res.json(response);
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
};

export const handleCreateRoom: RequestHandler = async (req, res) => {
  const body: AdminCreateRoomRequest = req.body;
  if (!body?.code) return res.status(400).json({ error: "code required" });
  const code = body.code.toUpperCase();
  try {
    const existing = await db.select().from(rooms).where(eq(rooms.code, code));
    if (existing.length > 0) return res.status(400).json({ error: "Room already exists" });
    await db.insert(rooms).values({ code, title: body.title ?? null, roundEndAt: body.durationMinutes ? new Date(Date.now() + body.durationMinutes * 60 * 1000) : null });
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
};

export const handleStartGame: RequestHandler = async (req, res) => {
  const { minutes } = req.body;
  const roomCode = (req.body?.room as string) || (req.query.room as string);
  if (!roomCode || !minutes || typeof minutes !== 'number' || minutes <= 0) return res.status(400).json({ error: "room and valid minutes required" });
  try {
    const code = roomCode.toUpperCase();
    const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
    if (roomResult.length === 0) return res.status(404).json({ error: "Room not found" });
    const endTime = new Date(Date.now() + minutes * 60 * 1000);
    await db.update(rooms).set({ roundEndAt: endTime }).where(eq(rooms.code, code));
    res.json({ success: true, endTime: endTime.toISOString() });
  } catch (err) { console.error("handleStartGame", err); res.status(500).json({ error: "Internal server error" }); }
};

export const handleExtendTimer: RequestHandler = async (req, res) => {
  const { minutes } = req.body;
  const roomCode = (req.body?.room as string) || (req.query.room as string);
  if (!roomCode || !minutes || typeof minutes !== 'number' || minutes <= 0) return res.status(400).json({ error: "room and valid minutes required" });
  try {
    const code = roomCode.toUpperCase();
    const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
    if (roomResult.length === 0) return res.status(404).json({ error: "Room not found" });
    const currentRoom = roomResult[0];
    let newEndTime: Date;
    if (currentRoom.roundEndAt && currentRoom.roundEndAt > new Date()) newEndTime = new Date(currentRoom.roundEndAt.getTime() + minutes * 60 * 1000); else newEndTime = new Date(Date.now() + minutes * 60 * 1000);
    await db.update(rooms).set({ roundEndAt: newEndTime }).where(eq(rooms.code, code));
    res.json({ success: true, endTime: newEndTime.toISOString() });
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
};

export const handleForceEnd: RequestHandler = async (req, res) => {
  const roomCode = (req.body?.room as string) || (req.query.room as string);
  if (!roomCode) return res.status(400).json({ error: "room required" });
  try {
    const code = roomCode.toUpperCase();
    const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
    if (roomResult.length === 0) return res.status(404).json({ error: "Room not found" });
    const endTime = new Date();
    await db.update(rooms).set({ roundEndAt: endTime }).where(eq(rooms.code, code));
    res.json({ success: true, endTime: endTime.toISOString() });
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
};

export const handleAddQuestion: RequestHandler = async (req, res) => {
  const body: AdminAddQuestionRequest = req.body;
  if (!body?.room || !body?.question) return res.status(400).json({ error: "room and question required" });
  try {
    const code = body.room.toUpperCase();
    const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
    if (roomResult.length === 0) return res.status(404).json({ error: "Room not found" });
    const result = await db.insert(questionsTable).values({ roomCode: code, questionText: body.question.text, isReal: true, correctAnswer: String(body.question.correctAnswer) }).returning();
    const newQuestion: Question = { id: String(result[0].questionId), text: body.question.text, options: body.question.options ?? [], correctAnswer: body.question.correctAnswer, points: body.question.points ?? 0 } as any;
    res.json({ success: true, question: newQuestion });
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
};

export const handleDeleteQuestion: RequestHandler = async (req, res) => {
  const body: AdminDeleteQuestionRequest = req.body;
  if (!body || !body.questionId) return res.status(400).json({ error: "questionId required" });
  const questionIdInt = parseInt(String(body.questionId), 10);
  if (Number.isNaN(questionIdInt)) return res.status(400).json({ error: "Invalid questionId" });
  try { await db.delete(questionsTable).where(eq(questionsTable.questionId, questionIdInt)); res.json({ success: true }); } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
};

export const handleUploadQuestions = [upload.single('file'), async (req: any, res: any) => {
  try {
    const room = req.body.room as string;
    const file = req.file;
    if (!room) return res.status(400).json({ error: "Room code required" });
    if (!file || !file.buffer) return res.status(400).json({ error: "File is required" });
    const code = room.toUpperCase();
    const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
    if (roomResult.length === 0) return res.status(404).json({ error: "Room not found" });
    const csvData = file.buffer.toString('utf-8');
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) return res.status(400).json({ error: "CSV must have at least a header row and one data row" });
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
    const questionTextIndex = headers.indexOf('question_text') !== -1 ? headers.indexOf('question_text') : headers.indexOf('code') !== -1 ? headers.indexOf('code') : -1;
    const correctAnswerIndex = headers.indexOf('correct_answer') !== -1 ? headers.indexOf('correct_answer') : headers.indexOf('answer') !== -1 ? headers.indexOf('answer') : -1;
    if (questionTextIndex === -1 || correctAnswerIndex === -1) return res.status(400).json({ error: "CSV missing columns" });
    const questionsToInsert: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length <= Math.max(questionTextIndex, correctAnswerIndex)) continue;
      const questionText = values[questionTextIndex].replace(/^"|"$/g, '');
      const correctAnswer = values[correctAnswerIndex].replace(/^"|"$/g, '');
      if (questionText && correctAnswer) questionsToInsert.push({ roomCode: code, questionText, isReal: true, correctAnswer });
    }
    if (questionsToInsert.length === 0) return res.status(400).json({ error: "No valid questions found in CSV" });
    await db.insert(questionsTable).values(questionsToInsert);
    res.json({ success: true, importedCount: questionsToInsert.length });
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
}];

export const handleWipeUserData: RequestHandler = async (req, res) => {
  try {
    const body = (req.body || {}) as any;
    const confirm = String(body.confirm || "").trim();
    const adminSecretHeader = String(req.header("x-admin-secret") || "");
    const envSecret = process.env.ADMIN_SECRET || "";
    if (confirm !== "WIPE" || (!envSecret && process.env.NODE_ENV !== "development" && !adminSecretHeader)) {
      return res.status(400).json({ error: "Confirmation 'WIPE' and admin secret required" });
    }
    if (envSecret && adminSecretHeader !== envSecret) return res.status(403).json({ error: "Invalid admin secret" });

    const preserveRooms: string[] = Array.isArray(body.preserveRooms) ? body.preserveRooms.map(String) : [];
    const purgeRooms = !!body.purgeRooms;
    const purgeQuestions = !!body.purgeQuestions;
    const softDelete = !!body.softDelete;
    const initiatedBy = String(body.initiatedBy || req.header("x-initiated-by") || "admin");

    const deleted: Record<string, number> = {};
    const auditOptions = { preserveRooms, purgeRooms, purgeQuestions, softDelete };

    await db.transaction(async tx => {
      if (softDelete) {
        const r1 = await tx.update(teamSolvedPositions).set({ isDeleted: true }).execute() as any;
        deleted.team_solved_positions = typeof r1 === 'number' ? r1 : (r1?.rowCount ?? r1?.length ?? 0);
        const r2 = await tx.update(teamSolvedQuestions).set({ isDeleted: true }).execute() as any;
        deleted.team_solved_questions = typeof r2 === 'number' ? r2 : (r2?.rowCount ?? r2?.length ?? 0);
        const r3 = await tx.update(teamQuestionMapping).set({ isDeleted: true }).execute() as any;
        deleted.team_question_mapping = typeof r3 === 'number' ? r3 : (r3?.rowCount ?? r3?.length ?? 0);
        if (preserveRooms.length > 0) {
          const teamsAll = await tx.select().from(teams).execute();
          const teamIdsToMark = teamsAll.filter((t: any) => !preserveRooms.map((r: string) => r.toUpperCase()).includes(String(t.roomCode).toUpperCase())).map((t: any) => t.teamId);
          if (teamIdsToMark.length > 0) { const r4 = await tx.update(teams).set({ isDeleted: true }).where((teams.teamId as any).in(teamIdsToMark)).execute() as any; deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0); } else deleted.teams = 0;
        } else { const r4 = await tx.update(teams).set({ isDeleted: true }).execute() as any; deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0); }
      } else {
        if (!purgeQuestions) {
          const r1 = await tx.delete(teamSolvedPositions).execute() as any; deleted.team_solved_positions = typeof r1 === 'number' ? r1 : (r1?.rowCount ?? r1?.length ?? 0);
          const r2 = await tx.delete(teamSolvedQuestions).execute() as any; deleted.team_solved_questions = typeof r2 === 'number' ? r2 : (r2?.rowCount ?? r2?.length ?? 0);
          const r3 = await tx.delete(teamQuestionMapping).execute() as any; deleted.team_question_mapping = typeof r3 === 'number' ? r3 : (r3?.rowCount ?? r3?.length ?? 0);
          if (preserveRooms.length > 0) {
            const teamsAll = await tx.select().from(teams).execute();
            const toDelete = teamsAll.filter((t: any) => !preserveRooms.map((r: string) => r.toUpperCase()).includes(String(t.roomCode).toUpperCase())).map((t: any) => t.teamId);
            if (toDelete.length > 0) { const r4 = await tx.delete(teams).where((teams.teamId as any).in(toDelete)).execute() as any; deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0); } else deleted.teams = 0;
          } else { const r4 = await tx.delete(teams).execute() as any; deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0); }
        } else {
          const r1 = await tx.delete(teamSolvedPositions).execute() as any; deleted.team_solved_positions = typeof r1 === 'number' ? r1 : (r1?.rowCount ?? r1?.length ?? 0);
          const r2 = await tx.delete(teamSolvedQuestions).execute() as any; deleted.team_solved_questions = typeof r2 === 'number' ? r2 : (r2?.rowCount ?? r2?.length ?? 0);
          const r3 = await tx.delete(teamQuestionMapping).execute() as any; deleted.team_question_mapping = typeof r3 === 'number' ? r3 : (r3?.rowCount ?? r3?.length ?? 0);
          const r4 = await tx.delete(teams).execute() as any; deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0);
          const r5 = await tx.delete(questionsTable).execute() as any; deleted.questions = typeof r5 === 'number' ? r5 : (r5?.rowCount ?? r5?.length ?? 0);
          if (purgeRooms) { const r6 = await tx.delete(rooms).execute() as any; deleted.rooms = typeof r6 === 'number' ? r6 : (r6?.rowCount ?? r6?.length ?? 0); }
        }
      }
      try { await tx.insert(wipeAudits).values({ initiatedBy, initiatedAt: new Date(), options: JSON.stringify(auditOptions), deletedCounts: JSON.stringify(deleted) }).execute(); } catch (err) { console.error("Failed to insert wipe audit", err); }
    });

    res.json({ success: true, deleted });
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
};
import { RequestHandler } from "express";
import { db } from "../db.js";
import { rooms, questions as questionsTable, teams, teamSolvedQuestions, teamSolvedPositions, teamQuestionMapping, wipeAudits } from "../schema.js";

// Single clean handler for wiping user/team data. Keep minimal to avoid duplication issues.
export const handleWipeUserData: RequestHandler = async (req, res) => {
  try {
    const body = req.body || {};
    const confirm = String(body.confirm || "").trim();
    const adminSecretHeader = String(req.header("x-admin-secret") || "");
    const envSecret = process.env.ADMIN_SECRET || "";
    if (confirm !== "WIPE" || (!envSecret && process.env.NODE_ENV !== "development" && !adminSecretHeader)) {
      return res.status(400).json({ error: "Confirmation 'WIPE' and admin secret required" });
    }
    if (envSecret && adminSecretHeader !== envSecret) return res.status(403).json({ error: "Invalid admin secret" });

    const preserveRooms: string[] = Array.isArray(body.preserveRooms) ? body.preserveRooms.map(String) : [];
    const purgeRooms = !!body.purgeRooms;
    const purgeQuestions = !!body.purgeQuestions;
    const softDelete = !!body.softDelete;
    const initiatedBy = String(body.initiatedBy || req.header("x-initiated-by") || "admin");

    const deleted: Record<string, number> = {};
    const auditOptions = { preserveRooms, purgeRooms, purgeQuestions, softDelete };

    await db.transaction(async tx => {
      if (softDelete) {
        await tx.update(teamSolvedPositions).set({ isDeleted: true }).execute();
        await tx.update(teamSolvedQuestions).set({ isDeleted: true }).execute();
        await tx.update(teamQuestionMapping).set({ isDeleted: true }).execute();
        await tx.update(teams).set({ isDeleted: true }).execute();
      } else {
        await tx.delete(teamSolvedPositions).execute();
        await tx.delete(teamSolvedQuestions).execute();
        await tx.delete(teamQuestionMapping).execute();
        await tx.delete(teams).execute();
        if (purgeQuestions) await tx.delete(questionsTable).execute();
        if (purgeRooms) await tx.delete(rooms).execute();
      }
      try {
        await tx.insert(wipeAudits).values({ initiatedBy, initiatedAt: new Date(), options: JSON.stringify(auditOptions), deletedCounts: JSON.stringify(deleted) }).execute();
      } catch (err) { console.error("Failed to insert wipe audit", err); }
    });

    res.json({ success: true, deleted });
  } catch (err) {
    console.error("handleWipeUserData", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
import { RequestHandler } from "express";
import { db } from "../db.js";
import { rooms, questions as questionsTable, teams, teamSolvedQuestions, teamSolvedPositions, teamQuestionMapping, wipeAudits } from "../schema.js";
import { eq } from "drizzle-orm";

// WARNING: destructive endpoint. Requires explicit confirm string and ADMIN_SECRET header.
export const handleWipeUserData: RequestHandler = async (req, res) => {
  try {
    const body = (req.body || {}) as any;
    const confirm = String(body.confirm || "").trim();
    const adminSecretHeader = String(req.header("x-admin-secret") || "");
    const envSecret = process.env.ADMIN_SECRET || "";
    if (confirm !== "WIPE" || (!envSecret && process.env.NODE_ENV !== "development" && !adminSecretHeader)) {
      return res.status(400).json({ error: "Confirmation 'WIPE' and admin secret required" });
    }
    if (envSecret && adminSecretHeader !== envSecret) return res.status(403).json({ error: "Invalid admin secret" });

    const preserveRooms: string[] = Array.isArray(body.preserveRooms) ? body.preserveRooms.map(String) : [];
    const purgeRooms = !!body.purgeRooms;
    const purgeQuestions = !!body.purgeQuestions;
    const softDelete = !!body.softDelete;
    const initiatedBy = String(body.initiatedBy || req.header("x-initiated-by") || "admin");

    const deleted: Record<string, number> = {};
    const auditOptions = { preserveRooms, purgeRooms, purgeQuestions, softDelete };

    await db.transaction(async tx => {
      if (softDelete) {
        const r1 = await tx.update(teamSolvedPositions).set({ isDeleted: true }).execute() as any;
        deleted.team_solved_positions = typeof r1 === 'number' ? r1 : (r1?.rowCount ?? r1?.length ?? 0);
        const r2 = await tx.update(teamSolvedQuestions).set({ isDeleted: true }).execute() as any;
        deleted.team_solved_questions = typeof r2 === 'number' ? r2 : (r2?.rowCount ?? r2?.length ?? 0);
        const r3 = await tx.update(teamQuestionMapping).set({ isDeleted: true }).execute() as any;
        deleted.team_question_mapping = typeof r3 === 'number' ? r3 : (r3?.rowCount ?? r3?.length ?? 0);
        if (preserveRooms.length > 0) {
          const teamsAll = await tx.select().from(teams).execute();
          const teamIdsToMark = teamsAll.filter((t: any) => !preserveRooms.map((r: string) => r.toUpperCase()).includes(String(t.roomCode).toUpperCase())).map((t: any) => t.teamId);
          if (teamIdsToMark.length > 0) { const r4 = await tx.update(teams).set({ isDeleted: true }).where((teams.teamId as any).in(teamIdsToMark)).execute() as any; deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0); } else deleted.teams = 0;
        } else { const r4 = await tx.update(teams).set({ isDeleted: true }).execute() as any; deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0); }
      } else {
        if (!purgeQuestions) {
          const r1 = await tx.delete(teamSolvedPositions).execute() as any; deleted.team_solved_positions = typeof r1 === 'number' ? r1 : (r1?.rowCount ?? r1?.length ?? 0);
          const r2 = await tx.delete(teamSolvedQuestions).execute() as any; deleted.team_solved_questions = typeof r2 === 'number' ? r2 : (r2?.rowCount ?? r2?.length ?? 0);
          const r3 = await tx.delete(teamQuestionMapping).execute() as any; deleted.team_question_mapping = typeof r3 === 'number' ? r3 : (r3?.rowCount ?? r3?.length ?? 0);
          if (preserveRooms.length > 0) {
            const teamsAll = await tx.select().from(teams).execute();
            const toDelete = teamsAll.filter((t: any) => !preserveRooms.map((r: string) => r.toUpperCase()).includes(String(t.roomCode).toUpperCase())).map((t: any) => t.teamId);
            if (toDelete.length > 0) { const r4 = await tx.delete(teams).where((teams.teamId as any).in(toDelete)).execute() as any; deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0); } else deleted.teams = 0;
          } else { const r4 = await tx.delete(teams).execute() as any; deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0); }
        } else {
          const r1 = await tx.delete(teamSolvedPositions).execute() as any; deleted.team_solved_positions = typeof r1 === 'number' ? r1 : (r1?.rowCount ?? r1?.length ?? 0);
          const r2 = await tx.delete(teamSolvedQuestions).execute() as any; deleted.team_solved_questions = typeof r2 === 'number' ? r2 : (r2?.rowCount ?? r2?.length ?? 0);
          const r3 = await tx.delete(teamQuestionMapping).execute() as any; deleted.team_question_mapping = typeof r3 === 'number' ? r3 : (r3?.rowCount ?? r3?.length ?? 0);
          const r4 = await tx.delete(teams).execute() as any; deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0);
          const r5 = await tx.delete(questionsTable).execute() as any; deleted.questions = typeof r5 === 'number' ? r5 : (r5?.rowCount ?? r5?.length ?? 0);
          if (purgeRooms) { const r6 = await tx.delete(rooms).execute() as any; deleted.rooms = typeof r6 === 'number' ? r6 : (r6?.rowCount ?? r6?.length ?? 0); }
        }
      }
      try { await tx.insert(wipeAudits).values({ initiatedBy, initiatedAt: new Date(), options: JSON.stringify(auditOptions), deletedCounts: JSON.stringify(deleted) }).execute(); } catch (err) { console.error("Failed to insert wipe audit", err); }
    });
    res.json({ success: true, deleted });
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
};

import { RequestHandler } from "express";
import multer from "multer";
import type {
  AdminStateResponse,
  AdminCreateRoomRequest,
  AdminAddQuestionRequest,
  AdminDeleteQuestionRequest,
  Question,
} from "@shared/api";
import { db } from "../db.js";
import {
  rooms,
  questions as questionsTable,
  teams,
  teamSolvedQuestions,
  teamSolvedPositions,
  teamQuestionMapping,
  wipeAudits,
} from "../schema.js";
import { eq } from "drizzle-orm";

const upload = multer();

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  import { } from "express";
}
  import multer from "multer";
  import type {
    AdminStateResponse,
    AdminCreateRoomRequest,
    AdminAddQuestionRequest,
    AdminDeleteQuestionRequest,
    Question,
  } from "@shared/api";
  import { db } from "../db.js";
  import {
    rooms,
    questions as questionsTable,
    teams,
    teamSolvedQuestions,
    teamSolvedPositions,
    teamQuestionMapping,
    wipeAudits,
  } from "../schema.js";
  import { eq } from "drizzle-orm";

  const upload = multer();

  // Small, single-file admin route implementations. Kept intentionally compact.

  function parseCSVLine(line: string): string[] {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) { out.push(cur.trim()); cur = ""; } else { cur += ch; }
    }
    out.push(cur.trim());
    return out;
  }

  export const handleAdminState: RequestHandler = async (req, res) => {
    const roomCode = (req.query.room as string) || (req.body?.room as string);
    if (!roomCode) return res.status(400).json({ error: "Room code required" });
    try {
      const code = roomCode.toUpperCase();
      const [room] = await db.select().from(rooms).where(eq(rooms.code, code));
      const questionsResult = await db.select().from(questionsTable).where(eq(questionsTable.roomCode, code));
      const teamsResult = await db.select().from(teams).where(eq(teams.roomCode, code));
      const response: AdminStateResponse = {
        room: room ? { code: room.code, title: room.title, roundEndAt: room.roundEndAt?.toISOString() || null } : null,
        questions: questionsResult.map((q: any) => ({ id: String(q.questionId), text: q.questionText, is_real: q.isReal })) as any,
        teams: teamsResult.map((t: any) => ({ id: t.teamId, name: t.teamName, lines_completed: t.linesCompleted })) as any,
        currentQuestionIndex: 0,
        gameStarted: false,
        gameEnded: false,
        timeRemaining: 0,
      };
      res.json(response);
    } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
  };

  export const handleCreateRoom: RequestHandler = async (req, res) => {
    const body: AdminCreateRoomRequest = req.body;
    if (!body?.code) return res.status(400).json({ error: "code required" });
    const code = body.code.toUpperCase();
    try {
      const existing = await db.select().from(rooms).where(eq(rooms.code, code));
      if (existing.length > 0) return res.status(400).json({ error: "Room already exists" });
      await db.insert(rooms).values({ code, title: body.title ?? null, roundEndAt: body.durationMinutes ? new Date(Date.now() + body.durationMinutes * 60 * 1000) : null });
      res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
  };

  export const handleStartGame: RequestHandler = async (req, res) => {
    const { minutes } = req.body;
    const roomCode = (req.body?.room as string) || (req.query.room as string);
    if (!roomCode || !minutes || typeof minutes !== 'number' || minutes <= 0) return res.status(400).json({ error: "room and valid minutes required" });
    try {
      const code = roomCode.toUpperCase();
      const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
      if (roomResult.length === 0) return res.status(404).json({ error: "Room not found" });
      const endTime = new Date(Date.now() + minutes * 60 * 1000);
      await db.update(rooms).set({ roundEndAt: endTime }).where(eq(rooms.code, code));
      res.json({ success: true, endTime: endTime.toISOString() });
    } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
  };

  export const handleExtendTimer: RequestHandler = async (req, res) => {
    const { minutes } = req.body;
    const roomCode = (req.body?.room as string) || (req.query.room as string);
    if (!roomCode || !minutes || typeof minutes !== 'number' || minutes <= 0) return res.status(400).json({ error: "room and valid minutes required" });
    try {
      const code = roomCode.toUpperCase();
      const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
      if (roomResult.length === 0) return res.status(404).json({ error: "Room not found" });
      const currentRoom = roomResult[0];
      let newEndTime: Date;
      if (currentRoom.roundEndAt && currentRoom.roundEndAt > new Date()) newEndTime = new Date(currentRoom.roundEndAt.getTime() + minutes * 60 * 1000); else newEndTime = new Date(Date.now() + minutes * 60 * 1000);
      await db.update(rooms).set({ roundEndAt: newEndTime }).where(eq(rooms.code, code));
      res.json({ success: true, endTime: newEndTime.toISOString() });
    } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
  };

  export const handleForceEnd: RequestHandler = async (req, res) => {
    const roomCode = (req.body?.room as string) || (req.query.room as string);
    if (!roomCode) return res.status(400).json({ error: "room required" });
    try {
      const code = roomCode.toUpperCase();
      const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
      if (roomResult.length === 0) return res.status(404).json({ error: "Room not found" });
      const endTime = new Date();
      await db.update(rooms).set({ roundEndAt: endTime }).where(eq(rooms.code, code));
      res.json({ success: true, endTime: endTime.toISOString() });
    } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
  };

  export const handleAddQuestion: RequestHandler = async (req, res) => {
    const body: AdminAddQuestionRequest = req.body;
    if (!body?.room || !body?.question) return res.status(400).json({ error: "room and question required" });
    try {
      const code = body.room.toUpperCase();
      const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
      if (roomResult.length === 0) return res.status(404).json({ error: "Room not found" });
      const result = await db.insert(questionsTable).values({ roomCode: code, questionText: body.question.text, isReal: true, correctAnswer: String(body.question.correctAnswer) }).returning();
      const newQuestion: Question = { id: String(result[0].questionId), text: body.question.text, options: body.question.options ?? [], correctAnswer: body.question.correctAnswer, points: body.question.points ?? 0 } as any;
      res.json({ success: true, question: newQuestion });
    } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
  };

  export const handleDeleteQuestion: RequestHandler = async (req, res) => {
    const body: AdminDeleteQuestionRequest = req.body;
    if (!body || !body.questionId) return res.status(400).json({ error: "questionId required" });
    const questionIdInt = parseInt(String(body.questionId), 10);
    if (Number.isNaN(questionIdInt)) return res.status(400).json({ error: "Invalid questionId" });
    try { await db.delete(questionsTable).where(eq(questionsTable.questionId, questionIdInt)); res.json({ success: true }); } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
  };

  export const handleUploadQuestions = [upload.single('file'), async (req: any, res: any) => {
    try {
      const room = req.body.room as string;
      const file = req.file;
      if (!room) return res.status(400).json({ error: "Room code required" });
      if (!file || !file.buffer) return res.status(400).json({ error: "File is required" });
      const code = room.toUpperCase();
      const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
      if (roomResult.length === 0) return res.status(404).json({ error: "Room not found" });
      const csvData = file.buffer.toString('utf-8');
      const lines = csvData.trim().split('\n');
      if (lines.length < 2) return res.status(400).json({ error: "CSV must have at least a header row and one data row" });
      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
      const questionTextIndex = headers.indexOf('question_text') !== -1 ? headers.indexOf('question_text') : headers.indexOf('code') !== -1 ? headers.indexOf('code') : -1;
      const correctAnswerIndex = headers.indexOf('correct_answer') !== -1 ? headers.indexOf('correct_answer') : headers.indexOf('answer') !== -1 ? headers.indexOf('answer') : -1;
      if (questionTextIndex === -1 || correctAnswerIndex === -1) return res.status(400).json({ error: "CSV missing columns" });
      const questionsToInsert: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length <= Math.max(questionTextIndex, correctAnswerIndex)) continue;
        const questionText = values[questionTextIndex].replace(/^"|"$/g, '');
        const correctAnswer = values[correctAnswerIndex].replace(/^"|"$/g, '');
        if (questionText && correctAnswer) questionsToInsert.push({ roomCode: code, questionText, isReal: true, correctAnswer });
      }
      if (questionsToInsert.length === 0) return res.status(400).json({ error: "No valid questions found in CSV" });
      await db.insert(questionsTable).values(questionsToInsert);
      res.json({ success: true, importedCount: questionsToInsert.length });
    } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
  }];

  export const handleWipeUserData: RequestHandler = async (req, res) => {
    try {
      const body = (req.body || {}) as any;
      const confirm = String(body.confirm || "").trim();
      const adminSecretHeader = String(req.header("x-admin-secret") || "");
      const envSecret = process.env.ADMIN_SECRET || "";
      if (confirm !== "WIPE" || (!envSecret && process.env.NODE_ENV !== "development" && !adminSecretHeader)) return res.status(400).json({ error: "Confirmation 'WIPE' and admin secret required" });
      if (envSecret && adminSecretHeader !== envSecret) return res.status(403).json({ error: "Invalid admin secret" });

      const preserveRooms: string[] = Array.isArray(body.preserveRooms) ? body.preserveRooms.map(String) : [];
      const purgeRooms = !!body.purgeRooms;
      const purgeQuestions = !!body.purgeQuestions;
      const softDelete = !!body.softDelete;
      const initiatedBy = String(body.initiatedBy || req.header("x-initiated-by") || "admin");

      const deleted: Record<string, number> = {};
      const auditOptions = { preserveRooms, purgeRooms, purgeQuestions, softDelete };

      await db.transaction(async tx => {
        if (softDelete) {
          const r1 = await tx.update(teamSolvedPositions).set({ isDeleted: true }).execute() as any;
          deleted.team_solved_positions = typeof r1 === 'number' ? r1 : (r1?.rowCount ?? r1?.length ?? 0);
          const r2 = await tx.update(teamSolvedQuestions).set({ isDeleted: true }).execute() as any;
          deleted.team_solved_questions = typeof r2 === 'number' ? r2 : (r2?.rowCount ?? r2?.length ?? 0);
          const r3 = await tx.update(teamQuestionMapping).set({ isDeleted: true }).execute() as any;
          deleted.team_question_mapping = typeof r3 === 'number' ? r3 : (r3?.rowCount ?? r3?.length ?? 0);
          if (preserveRooms.length > 0) {
            const teamsAll = await tx.select().from(teams).execute();
            const teamIdsToMark = teamsAll.filter((t: any) => !preserveRooms.map((r: string) => r.toUpperCase()).includes(String(t.roomCode).toUpperCase())).map((t: any) => t.teamId);
            if (teamIdsToMark.length > 0) { const r4 = await tx.update(teams).set({ isDeleted: true }).where((teams.teamId as any).in(teamIdsToMark)).execute() as any; deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0); } else deleted.teams = 0;
          } else { const r4 = await tx.update(teams).set({ isDeleted: true }).execute() as any; deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0); }
        } else {
          if (!purgeQuestions) {
            const r1 = await tx.delete(teamSolvedPositions).execute() as any; deleted.team_solved_positions = typeof r1 === 'number' ? r1 : (r1?.rowCount ?? r1?.length ?? 0);
            const r2 = await tx.delete(teamSolvedQuestions).execute() as any; deleted.team_solved_questions = typeof r2 === 'number' ? r2 : (r2?.rowCount ?? r2?.length ?? 0);
            const r3 = await tx.delete(teamQuestionMapping).execute() as any; deleted.team_question_mapping = typeof r3 === 'number' ? r3 : (r3?.rowCount ?? r3?.length ?? 0);
            if (preserveRooms.length > 0) {
              const teamsAll = await tx.select().from(teams).execute();
              const toDelete = teamsAll.filter((t: any) => !preserveRooms.map((r: string) => r.toUpperCase()).includes(String(t.roomCode).toUpperCase())).map((t: any) => t.teamId);
              if (toDelete.length > 0) { const r4 = await tx.delete(teams).where((teams.teamId as any).in(toDelete)).execute() as any; deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0); } else deleted.teams = 0;
            } else { const r4 = await tx.delete(teams).execute() as any; deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0); }
          } else {
            const r1 = await tx.delete(teamSolvedPositions).execute() as any; deleted.team_solved_positions = typeof r1 === 'number' ? r1 : (r1?.rowCount ?? r1?.length ?? 0);
            const r2 = await tx.delete(teamSolvedQuestions).execute() as any; deleted.team_solved_questions = typeof r2 === 'number' ? r2 : (r2?.rowCount ?? r2?.length ?? 0);
            const r3 = await tx.delete(teamQuestionMapping).execute() as any; deleted.team_question_mapping = typeof r3 === 'number' ? r3 : (r3?.rowCount ?? r3?.length ?? 0);
            const r4 = await tx.delete(teams).execute() as any; deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0);
            const r5 = await tx.delete(questionsTable).execute() as any; deleted.questions = typeof r5 === 'number' ? r5 : (r5?.rowCount ?? r5?.length ?? 0);
            if (purgeRooms) { const r6 = await tx.delete(rooms).execute() as any; deleted.rooms = typeof r6 === 'number' ? r6 : (r6?.rowCount ?? r6?.length ?? 0); }
          }
        }
        try { await tx.insert(wipeAudits).values({ initiatedBy, initiatedAt: new Date(), options: JSON.stringify(auditOptions), deletedCounts: JSON.stringify(deleted) }).execute(); } catch (err) { console.error("Failed to insert wipe audit", err); }
      });
      res.json({ success: true, deleted });
    } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
  };

export const handleStartGame: RequestHandler = async (req, res) => {
  const { minutes } = req.body;
  const roomCode = (req.body?.room as string) || (req.query.room as string);
  if (!roomCode || !minutes || typeof minutes !== 'number' || minutes <= 0) return res.status(400).json({ error: "room and valid minutes required" });
  try {
    const code = roomCode.toUpperCase();
    const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
    if (roomResult.length === 0) return res.status(404).json({ error: "Room not found" });
    const endTime = new Date(Date.now() + minutes * 60 * 1000);
    await db.update(rooms).set({ roundEndAt: endTime }).where(eq(rooms.code, code));
    res.json({ success: true, endTime: endTime.toISOString() });
  } catch (err) {
    console.error("handleStartGame", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleExtendTimer: RequestHandler = async (req, res) => {
  const { minutes } = req.body;
  const roomCode = (req.body?.room as string) || (req.query.room as string);
  if (!roomCode || !minutes || typeof minutes !== 'number' || minutes <= 0) return res.status(400).json({ error: "room and valid minutes required" });
  try {
    const code = roomCode.toUpperCase();
    const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
    if (roomResult.length === 0) return res.status(404).json({ error: "Room not found" });
    const currentRoom = roomResult[0];
    let newEndTime: Date;
    if (currentRoom.roundEndAt && currentRoom.roundEndAt > new Date()) newEndTime = new Date(currentRoom.roundEndAt.getTime() + minutes * 60 * 1000); else newEndTime = new Date(Date.now() + minutes * 60 * 1000);
    await db.update(rooms).set({ roundEndAt: newEndTime }).where(eq(rooms.code, code));
    res.json({ success: true, endTime: newEndTime.toISOString() });
  } catch (err) {
    console.error("handleExtendTimer", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleForceEnd: RequestHandler = async (req, res) => {
  const roomCode = (req.body?.room as string) || (req.query.room as string);
  if (!roomCode) return res.status(400).json({ error: "room required" });
  try {
    const code = roomCode.toUpperCase();
    const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
    if (roomResult.length === 0) return res.status(404).json({ error: "Room not found" });
    const endTime = new Date();
    await db.update(rooms).set({ roundEndAt: endTime }).where(eq(rooms.code, code));
    res.json({ success: true, endTime: endTime.toISOString() });
  } catch (err) {
    console.error("handleForceEnd", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleAddQuestion: RequestHandler = async (req, res) => {
  const body: AdminAddQuestionRequest = req.body;
  if (!body?.room || !body?.question) return res.status(400).json({ error: "room and question required" });
  try {
    const code = body.room.toUpperCase();
    const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
    if (roomResult.length === 0) return res.status(404).json({ error: "Room not found" });
    const result = await db.insert(questionsTable).values({ roomCode: code, questionText: body.question.text, isReal: true, correctAnswer: String(body.question.correctAnswer) }).returning();
    const newQuestion: Question = { id: String(result[0].questionId), text: body.question.text, options: body.question.options ?? [], correctAnswer: body.question.correctAnswer, points: body.question.points ?? 0 } as any;
    res.json({ success: true, question: newQuestion });
  } catch (err) {
    console.error("handleAddQuestion", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleDeleteQuestion: RequestHandler = async (req, res) => {
  const body: AdminDeleteQuestionRequest = req.body;
  if (!body || !body.questionId) return res.status(400).json({ error: "questionId required" });
  const questionIdInt = parseInt(String(body.questionId), 10);
  if (Number.isNaN(questionIdInt)) return res.status(400).json({ error: "Invalid questionId" });
  try { await db.delete(questionsTable).where(eq(questionsTable.questionId, questionIdInt)); res.json({ success: true }); } catch (err) { console.error("handleDeleteQuestion", err); res.status(500).json({ error: "Internal server error" }); }
};

export const handleUploadQuestions = [upload.single('file'), async (req: any, res: any) => {
  try {
    const room = req.body.room as string;
    const file = req.file;
    if (!room) return res.status(400).json({ error: "Room code required" });
    if (!file || !file.buffer) return res.status(400).json({ error: "File is required" });
    const code = room.toUpperCase();
    const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
    if (roomResult.length === 0) return res.status(404).json({ error: "Room not found" });
    const csvData = file.buffer.toString('utf-8');
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) return res.status(400).json({ error: "CSV must have at least a header row and one data row" });
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
    const questionTextIndex = headers.indexOf('question_text') !== -1 ? headers.indexOf('question_text') : headers.indexOf('code') !== -1 ? headers.indexOf('code') : -1;
    const correctAnswerIndex = headers.indexOf('correct_answer') !== -1 ? headers.indexOf('correct_answer') : headers.indexOf('answer') !== -1 ? headers.indexOf('answer') : -1;
    if (questionTextIndex === -1 || correctAnswerIndex === -1) return res.status(400).json({ error: "CSV missing columns" });
    const questionsToInsert: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length <= Math.max(questionTextIndex, correctAnswerIndex)) continue;
      const questionText = values[questionTextIndex].replace(/^"|"$/g, '');
      const correctAnswer = values[correctAnswerIndex].replace(/^"|"$/g, '');
      if (questionText && correctAnswer) questionsToInsert.push({ roomCode: code, questionText, isReal: true, correctAnswer });
    }
    if (questionsToInsert.length === 0) return res.status(400).json({ error: "No valid questions found in CSV" });
    await db.insert(questionsTable).values(questionsToInsert);
    res.json({ success: true, importedCount: questionsToInsert.length });
  } catch (err) { console.error("handleUploadQuestions", err); res.status(500).json({ error: "Internal server error" }); }
}];

// Wipe handler with soft-delete, preserve, purge and audit
export const handleWipeUserData: RequestHandler = async (req, res) => {
  try {
    const body = (req.body || {}) as any;
    const confirm = String(body.confirm || "").trim();
    const adminSecretHeader = String(req.header("x-admin-secret") || "");
    const envSecret = process.env.ADMIN_SECRET || "";
    if (confirm !== "WIPE" || (!envSecret && process.env.NODE_ENV !== "development" && !adminSecretHeader)) return res.status(400).json({ error: "Confirmation 'WIPE' and admin secret required" });
    if (envSecret && adminSecretHeader !== envSecret) return res.status(403).json({ error: "Invalid admin secret" });

    const preserveRooms: string[] = Array.isArray(body.preserveRooms) ? body.preserveRooms.map(String) : [];
    const purgeRooms = !!body.purgeRooms;
    const purgeQuestions = !!body.purgeQuestions;
    const softDelete = !!body.softDelete;
    const initiatedBy = String(body.initiatedBy || req.header("x-initiated-by") || "admin");

    const deleted: Record<string, number> = {};
    const auditOptions = { preserveRooms, purgeRooms, purgeQuestions, softDelete };

    await db.transaction(async tx => {
      // Soft-delete mode: set isDeleted = true on relevant tables
      if (softDelete) {
        const r1 = await tx.update(teamSolvedPositions).set({ isDeleted: true }).execute() as any;
        deleted.team_solved_positions = typeof r1 === 'number' ? r1 : (r1?.rowCount ?? r1?.length ?? 0);
        const r2 = await tx.update(teamSolvedQuestions).set({ isDeleted: true }).execute() as any;
        deleted.team_solved_questions = typeof r2 === 'number' ? r2 : (r2?.rowCount ?? r2?.length ?? 0);
        const r3 = await tx.update(teamQuestionMapping).set({ isDeleted: true }).execute() as any;
        deleted.team_question_mapping = typeof r3 === 'number' ? r3 : (r3?.rowCount ?? r3?.length ?? 0);
        if (preserveRooms.length > 0) {
          const teamsAll = await tx.select().from(teams).execute();
          const teamIdsToMark = teamsAll.filter((t: any) => !preserveRooms.map((r: string) => r.toUpperCase()).includes(String(t.roomCode).toUpperCase())).map((t: any) => t.teamId);
          if (teamIdsToMark.length > 0) {
            const r4 = await tx.update(teams).set({ isDeleted: true }).where((teams.teamId as any).in(teamIdsToMark)).execute() as any;
            deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0);
          } else deleted.teams = 0;
        } else {
          const r4 = await tx.update(teams).set({ isDeleted: true }).execute() as any;
          deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0);
        }
      } else {
        // Hard-delete paths
        if (!purgeQuestions) {
          const r1 = await tx.delete(teamSolvedPositions).execute() as any;
          deleted.team_solved_positions = typeof r1 === 'number' ? r1 : (r1?.rowCount ?? r1?.length ?? 0);
          const r2 = await tx.delete(teamSolvedQuestions).execute() as any;
          deleted.team_solved_questions = typeof r2 === 'number' ? r2 : (r2?.rowCount ?? r2?.length ?? 0);
          const r3 = await tx.delete(teamQuestionMapping).execute() as any;
          deleted.team_question_mapping = typeof r3 === 'number' ? r3 : (r3?.rowCount ?? r3?.length ?? 0);
          if (preserveRooms.length > 0) {
            const teamsAll = await tx.select().from(teams).execute();
            const toDelete = teamsAll.filter((t: any) => !preserveRooms.map((r: string) => r.toUpperCase()).includes(String(t.roomCode).toUpperCase())).map((t: any) => t.teamId);
            if (toDelete.length > 0) { const r4 = await tx.delete(teams).where((teams.teamId as any).in(toDelete)).execute() as any; deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0); } else deleted.teams = 0;
          } else { const r4 = await tx.delete(teams).execute() as any; deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0); }
        } else {
          const r1 = await tx.delete(teamSolvedPositions).execute() as any; deleted.team_solved_positions = typeof r1 === 'number' ? r1 : (r1?.rowCount ?? r1?.length ?? 0);
          const r2 = await tx.delete(teamSolvedQuestions).execute() as any; deleted.team_solved_questions = typeof r2 === 'number' ? r2 : (r2?.rowCount ?? r2?.length ?? 0);
          const r3 = await tx.delete(teamQuestionMapping).execute() as any; deleted.team_question_mapping = typeof r3 === 'number' ? r3 : (r3?.rowCount ?? r3?.length ?? 0);
          const r4 = await tx.delete(teams).execute() as any; deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0);
          const r5 = await tx.delete(questionsTable).execute() as any; deleted.questions = typeof r5 === 'number' ? r5 : (r5?.rowCount ?? r5?.length ?? 0);
          if (purgeRooms) { const r6 = await tx.delete(rooms).execute() as any; deleted.rooms = typeof r6 === 'number' ? r6 : (r6?.rowCount ?? r6?.length ?? 0); }
        }
      }

      // Write audit (best-effort)
      try { await tx.insert(wipeAudits).values({ initiatedBy, initiatedAt: new Date(), options: JSON.stringify(auditOptions), deletedCounts: JSON.stringify(deleted) }).execute(); } catch (err) { console.error("Failed to insert wipe audit", err); }
    });

    res.json({ success: true, deleted });
  } catch (err) {
    console.error("handleWipeUserData", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// export default is not used; individual handlers are imported where needed


import { RequestHandler } from "express";
import multer from "multer";
import type {
  AdminStateResponse,
  AdminCreateRoomRequest,
  AdminAddQuestionRequest,
  AdminDeleteQuestionRequest,
  Room,
  Question,
} from "@shared/api";
import { db } from "../db.js";
import {
  rooms,
  questions as questionsTable,
  teams,
  teamSolvedQuestions,
  teamSolvedPositions,
  teamQuestionMapping,
  wipeAudits,
} from "../schema.js";
import { eq } from "drizzle-orm";

// Clean single-file implementation
export const handleAdminState: RequestHandler = async (req, res) => {
  const roomCode = req.query.room as string;
  if (!roomCode) return res.status(400).json({ error: "Room code required" });
  try {
    const code = roomCode.toUpperCase();
    const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
    const room = roomResult[0];
    const questionsResult = await db.select().from(questionsTable).where(eq(questionsTable.roomCode, code));
    const roomQuestions = questionsResult.map(q => ({ id: String(q.questionId), text: q.questionText, is_real: q.isReal }));
    const teamsResult = await db.select().from(teams).where(eq(teams.roomCode, code));
    const roomTeams = teamsResult.map(t => ({ id: t.teamId, name: t.teamName, lines_completed: t.linesCompleted }));
    const response: AdminStateResponse = { room: room ? { code: room.code, title: room.title, roundEndAt: room.roundEndAt?.toISOString() || null } : null, questions: roomQuestions as any, teams: roomTeams as any, currentQuestionIndex: 0, gameStarted: false, gameEnded: false, timeRemaining: 0 };
    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleCreateRoom: RequestHandler = async (req, res) => {
  const body: AdminCreateRoomRequest = req.body;
  const code = body.code.toUpperCase();
  try {
    const existing = await db.select().from(rooms).where(eq(rooms.code, code));
    if (existing.length > 0) return res.status(400).json({ error: "Room already exists" });
    await db.insert(rooms).values({ code, title: body.title, roundEndAt: body.durationMinutes ? new Date(Date.now() + body.durationMinutes * 60 * 1000) : null });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleStartGame: RequestHandler = async (req, res) => {
  const { minutes, room } = req.body;
  if (!minutes || typeof minutes !== 'number' || minutes <= 0) return res.status(400).json({ error: "Valid minutes required" });
  const roomCode = room || req.query.room as string;
  if (!roomCode) return res.status(400).json({ error: "Room code required" });
  try {
    const code = roomCode.toUpperCase();
    const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
    if (roomResult.length === 0) return res.status(404).json({ error: "Room not found" });
    const endTime = new Date(Date.now() + minutes * 60 * 1000);
    await db.update(rooms).set({ roundEndAt: endTime }).where(eq(rooms.code, code));
    res.json({ success: true, endTime: endTime.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleExtendTimer: RequestHandler = async (req, res) => {
  const { minutes, room } = req.body;
  if (!minutes || typeof minutes !== 'number' || minutes <= 0) return res.status(400).json({ error: "Valid minutes required" });
  const roomCode = room || req.query.room as string;
  if (!roomCode) return res.status(400).json({ error: "Room code required" });
  try {
    const code = roomCode.toUpperCase();
    const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
    if (roomResult.length === 0) return res.status(404).json({ error: "Room not found" });
    const currentRoom = roomResult[0];
    let newEndTime: Date;
    if (currentRoom.roundEndAt && currentRoom.roundEndAt > new Date()) newEndTime = new Date(currentRoom.roundEndAt.getTime() + minutes * 60 * 1000); else newEndTime = new Date(Date.now() + minutes * 60 * 1000);
    await db.update(rooms).set({ roundEndAt: newEndTime }).where(eq(rooms.code, code));
    res.json({ success: true, endTime: newEndTime.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleForceEnd: RequestHandler = async (req, res) => {
  const { room } = req.body;
  const roomCode = room || req.query.room as string;
  if (!roomCode) return res.status(400).json({ error: "Room code required" });
  try {
    const code = roomCode.toUpperCase();
    const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
    if (roomResult.length === 0) return res.status(404).json({ error: "Room not found" });
    const endTime = new Date();
    await db.update(rooms).set({ roundEndAt: endTime }).where(eq(rooms.code, code));
    res.json({ success: true, endTime: endTime.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleAddQuestion: RequestHandler = async (req, res) => {
  const body: AdminAddQuestionRequest = req.body;
  const code = body.room.toUpperCase();
  try {
    const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
    if (roomResult.length === 0) return res.status(404).json({ error: "Room not found" });
    const result = await db.insert(questionsTable).values({ roomCode: code, questionText: body.question.text, isReal: true, correctAnswer: body.question.correctAnswer.toString() }).returning();
    const newQuestion: Question = { id: result[0].questionId.toString(), text: body.question.text, options: body.question.options, correctAnswer: body.question.correctAnswer, points: body.question.points };
    res.json({ success: true, question: newQuestion });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleDeleteQuestion: RequestHandler = async (req, res) => {
  const body: AdminDeleteQuestionRequest = req.body;
  if (!body || !body.questionId) return res.status(400).json({ error: "questionId required" });
  const questionIdInt = parseInt(String(body.questionId), 10);
  if (Number.isNaN(questionIdInt)) return res.status(400).json({ error: "Invalid questionId" });
  try {
    await db.delete(questionsTable).where(eq(questionsTable.questionId, questionIdInt));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Wipe handler with options + audit
export const handleWipeUserData: RequestHandler = async (req, res) => {
  try {
    const body = (req.body || {}) as any;
    const confirm = String(body.confirm || "").trim();
    const adminSecretHeader = String(req.header("x-admin-secret") || "");
    const envSecret = process.env.ADMIN_SECRET || "";
    if (confirm !== "WIPE" || (!envSecret && process.env.NODE_ENV !== "development" && !adminSecretHeader)) return res.status(400).json({ error: "Confirmation 'WIPE' and admin secret required" });
    if (envSecret && adminSecretHeader !== envSecret) return res.status(403).json({ error: "Invalid admin secret" });

    const preserveRooms: string[] = Array.isArray(body.preserveRooms) ? body.preserveRooms.map(String) : [];
    const purgeRooms = !!body.purgeRooms;
    const purgeQuestions = !!body.purgeQuestions;
    const softDelete = !!body.softDelete;
    const initiatedBy = String(body.initiatedBy || req.header("x-initiated-by") || "admin");

    const deleted: Record<string, number> = {};
    const auditOptions = { preserveRooms, purgeRooms, purgeQuestions, softDelete };

    await db.transaction(async tx => {
      if (softDelete) {
        const r1 = await tx.update(teamSolvedPositions).set({ isDeleted: true }).execute() as any;
        deleted.team_solved_positions = typeof r1 === 'number' ? r1 : (r1?.rowCount ?? r1?.length ?? 0);

        const r2 = await tx.update(teamSolvedQuestions).set({ isDeleted: true }).execute() as any;
        deleted.team_solved_questions = typeof r2 === 'number' ? r2 : (r2?.rowCount ?? r2?.length ?? 0);

        const r3 = await tx.update(teamQuestionMapping).set({ isDeleted: true }).execute() as any;
        deleted.team_question_mapping = typeof r3 === 'number' ? r3 : (r3?.rowCount ?? r3?.length ?? 0);

        if (preserveRooms.length > 0) {
          const teamsToMark = await tx.select().from(teams).execute();
          const teamIdsToMark = teamsToMark.filter((t: any) => !preserveRooms.map((r: string) => r.toUpperCase()).includes(String(t.roomCode).toUpperCase())).map((t: any) => t.teamId);
          if (teamIdsToMark.length > 0) {
            const r4 = await tx.update(teams).set({ isDeleted: true }).where((teams.teamId as any).in(teamIdsToMark)).execute() as any;
            deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0);
          } else deleted.teams = 0;
        } else {
          const r4 = await tx.update(teams).set({ isDeleted: true }).execute() as any;
          deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0);
        }
      } else {
        if (!purgeQuestions) {
          const r1 = await tx.delete(teamSolvedPositions).execute() as any;
          deleted.team_solved_positions = typeof r1 === 'number' ? r1 : (r1?.rowCount ?? r1?.length ?? 0);

          const r2 = await tx.delete(teamSolvedQuestions).execute() as any;
          deleted.team_solved_questions = typeof r2 === 'number' ? r2 : (r2?.rowCount ?? r2?.length ?? 0);

          const r3 = await tx.delete(teamQuestionMapping).execute() as any;
          deleted.team_question_mapping = typeof r3 === 'number' ? r3 : (r3?.rowCount ?? r3?.length ?? 0);

          if (preserveRooms.length > 0) {
            const teamsAll = await tx.select().from(teams).execute();
            const toDelete = teamsAll.filter((t: any) => !preserveRooms.map((r: string) => r.toUpperCase()).includes(String(t.roomCode).toUpperCase())).map((t: any) => t.teamId);
            if (toDelete.length > 0) {
              const r4 = await tx.delete(teams).where((teams.teamId as any).in(toDelete)).execute() as any;
              deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0);
            } else deleted.teams = 0;
          } else {
            const r4 = await tx.delete(teams).execute() as any;
            deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0);
          }
        } else {
          const r1 = await tx.delete(teamSolvedPositions).execute() as any;
          deleted.team_solved_positions = typeof r1 === 'number' ? r1 : (r1?.rowCount ?? r1?.length ?? 0);

          const r2 = await tx.delete(teamSolvedQuestions).execute() as any;
          deleted.team_solved_questions = typeof r2 === 'number' ? r2 : (r2?.rowCount ?? r2?.length ?? 0);

          const r3 = await tx.delete(teamQuestionMapping).execute() as any;
          deleted.team_question_mapping = typeof r3 === 'number' ? r3 : (r3?.rowCount ?? r3?.length ?? 0);

          const r4 = await tx.delete(teams).execute() as any;
          deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0);

          const r5 = await tx.delete(questionsTable).execute() as any;
          deleted.questions = typeof r5 === 'number' ? r5 : (r5?.rowCount ?? r5?.length ?? 0);

          if (purgeRooms) {
            const r6 = await tx.delete(rooms).execute() as any;
            deleted.rooms = typeof r6 === 'number' ? r6 : (r6?.rowCount ?? r6?.length ?? 0);
          }
        }
      }

      try {
        await tx.insert(wipeAudits).values({ initiatedBy, initiatedAt: new Date(), options: JSON.stringify(auditOptions), deletedCounts: JSON.stringify(deleted) }).execute();
      } catch (err) { console.error("Failed to insert wipe audit", err); }
    });

    res.json({ success: true, deleted });
  } catch (err) { console.error("handleWipeUserData", err); res.status(500).json({ error: "Internal server error" }); }
};

export const handleUploadQuestions: RequestHandler = async (req, res) => {
  try {
    const room = req.body.room as string;
    const file = req.file;
    if (!room) return res.status(400).json({ error: "Room code required" });
    if (!file) return res.status(400).json({ error: "File is required" });
    const code = room.toUpperCase();
    const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
    if (roomResult.length === 0) return res.status(404).json({ error: "Room not found" });
    const csvData = file.buffer.toString('utf-8');
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) return res.status(400).json({ error: "CSV must have at least a header row and one data row" });
    const parseCSVLine = (line: string): string[] => { const result: string[] = []; let current = ''; let inQuotes = false; let i = 0; while (i < line.length) { const char = line[i]; if (char === '"') { if (inQuotes && line[i + 1] === '"') { current += '"'; i += 2; } else { inQuotes = !inQuotes; i++; } } else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; i++; } else { current += char; i++; } } result.push(current.trim()); return result; };
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
    const questionTextIndex = headers.indexOf('question_text') !== -1 ? headers.indexOf('question_text') : headers.indexOf('code') !== -1 ? headers.indexOf('code') : -1;
    const correctAnswerIndex = headers.indexOf('correct_answer') !== -1 ? headers.indexOf('correct_answer') : headers.indexOf('answer') !== -1 ? headers.indexOf('answer') : -1;
    const isRealIndex = headers.indexOf('is_real') !== -1 ? headers.indexOf('is_real') : headers.indexOf('difficulty') !== -1 ? headers.indexOf('difficulty') : -1;
    if (questionTextIndex === -1 || correctAnswerIndex === -1) return res.status(400).json({ error: "CSV missing columns" });
    const questionsToInsert: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length <= Math.max(questionTextIndex, correctAnswerIndex)) continue;
      const questionText = values[questionTextIndex].replace(/^"|"$/g, '');
      const correctAnswer = values[correctAnswerIndex].replace(/^"|"$/g, '');
      const isReal = isRealIndex !== -1 ? values[isRealIndex].toLowerCase() === 'true' || values[isRealIndex] === '1' : true;
      if (questionText && correctAnswer) questionsToInsert.push({ roomCode: code, questionText, isReal, correctAnswer });
    }
    if (questionsToInsert.length === 0) return res.status(400).json({ error: "No valid questions found in CSV" });
    await db.insert(questionsTable).values(questionsToInsert);
    res.json({ success: true, importedCount: questionsToInsert.length });
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
};
import { RequestHandler } from "express";
import multer from "multer";
import type {
  AdminStateResponse,
  AdminCreateRoomRequest,
  AdminAddQuestionRequest,
  AdminDeleteQuestionRequest,
  Room,
  Question,
  Team,
} from "@shared/api";
import { db } from "../db.js";
import {
  rooms,
  questions as questionsTable,
  teams,
  teamSolvedQuestions,
  teamSolvedPositions,
  teamQuestionMapping,
  wipeAudits,
} from "../schema.js";
import { eq } from "drizzle-orm";

export const handleAdminState: RequestHandler = async (req, res) => {
  const roomCode = req.query.room as string;
  if (!roomCode) {
    return res.status(400).json({ error: "Room code required" });
  }

  try {
    const code = roomCode.toUpperCase();

    // Get room
    const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
    const room = roomResult[0];

    // Get questions
    const questionsResult = await db.select().from(questionsTable).where(eq(questionsTable.roomCode, code));
    const roomQuestions = questionsResult.map(q => ({
      id: q.questionId.toString(),
      text: q.questionText,
      options: [], // TODO: add options if needed
      correctAnswer: 0, // TODO: parse correct answer
      points: 10, // default points
      question_id: q.questionId,
      question_text: q.questionText,
      correct_answer: q.correctAnswer,
      is_real: q.isReal,
    }));

    // Get teams
    const teamsResult = await db.select().from(teams).where(eq(teams.roomCode, code));
    const roomTeams = teamsResult.map(t => ({
      id: t.teamId,
      name: t.teamName,
      score: t.linesCompleted * 10, // approximate score
      completedAt: t.endTime?.toISOString() || null,
      isWinner: false, // TODO: determine winner
      team_id: t.teamId,
      team_name: t.teamName,
      lines_completed: t.linesCompleted,
      start_time: t.startTime.toISOString(),
      end_time: t.endTime?.toISOString() || null,
    }));

    const response: AdminStateResponse = {
      room: room ? {
        code: room.code,
        title: room.title,
        roundEndAt: room.roundEndAt?.toISOString() || null,
      } : null,
      questions: roomQuestions,
      teams: roomTeams,
      currentQuestionIndex: 0, // TODO: track current question
      gameStarted: false, // TODO: track game state
      gameEnded: false,
      timeRemaining: 0,
    };

    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleCreateRoom: RequestHandler = async (req, res) => {
  const body: AdminCreateRoomRequest = req.body;
  const code = body.code.toUpperCase();

  try {
    // Check if room exists
    const existing = await db.select().from(rooms).where(eq(rooms.code, code));
    if (existing.length > 0) {
      return res.status(400).json({ error: "Room already exists" });
    }

    await db.insert(rooms).values({
      code,
      title: body.title,
      roundEndAt: body.durationMinutes ? new Date(Date.now() + body.durationMinutes * 60 * 1000) : null,
    });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleStartGame: RequestHandler = async (req, res) => {
  const { minutes, room } = req.body;
  if (!minutes || typeof minutes !== 'number' || minutes <= 0) {
    return res.status(400).json({ error: "Valid minutes required" });
  }

  const roomCode = room || req.query.room as string;
  if (!roomCode) {
    return res.status(400).json({ error: "Room code required" });
  }

  try {
    const code = roomCode.toUpperCase();

    // Check if room exists
    const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
    if (roomResult.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    // Calculate end time
    const endTime = new Date(Date.now() + minutes * 60 * 1000);

    // Update room with timer
    await db.update(rooms)
      .set({ roundEndAt: endTime })
      .where(eq(rooms.code, code));

    res.json({ success: true, endTime: endTime.toISOString() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleExtendTimer: RequestHandler = async (req, res) => {
  const { minutes, room } = req.body;
  if (!minutes || typeof minutes !== 'number' || minutes <= 0) {
    return res.status(400).json({ error: "Valid minutes required" });
  }

  const roomCode = room || req.query.room as string;
  if (!roomCode) {
    return res.status(400).json({ error: "Room code required" });
  }

  try {
    const code = roomCode.toUpperCase();

    // Check if room exists
    const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
    if (roomResult.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    const currentRoom = roomResult[0];
    let newEndTime: Date;

    if (currentRoom.roundEndAt && currentRoom.roundEndAt > new Date()) {
      // Extend existing timer
      newEndTime = new Date(currentRoom.roundEndAt.getTime() + minutes * 60 * 1000);
    } else {
      // Start new timer
      newEndTime = new Date(Date.now() + minutes * 60 * 1000);
    }

    // Update room with extended timer
    await db.update(rooms)
      .set({ roundEndAt: newEndTime })
      .where(eq(rooms.code, code));

    res.json({ success: true, endTime: newEndTime.toISOString() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleForceEnd: RequestHandler = async (req, res) => {
  const { room } = req.body;
  const roomCode = room || req.query.room as string;
  if (!roomCode) {
    return res.status(400).json({ error: "Room code required" });
  }

  try {
    const code = roomCode.toUpperCase();

    // Check if room exists
    const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
    if (roomResult.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    // Set timer to end immediately (current time)
    const endTime = new Date();

    // Update room with immediate end time
    await db.update(rooms)
      .set({ roundEndAt: endTime })
      .where(eq(rooms.code, code));

    res.json({ success: true, endTime: endTime.toISOString() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleAddQuestion: RequestHandler = async (req, res) => {
  const body: AdminAddQuestionRequest = req.body;
  const code = body.room.toUpperCase();

  try {
    // Check if room exists
    const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
    if (roomResult.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    const result = await db.insert(questionsTable).values({
      roomCode: code,
      questionText: body.question.text,
      isReal: true, // assuming all questions are real
      correctAnswer: body.question.correctAnswer.toString(),
    }).returning();

    const newQuestion: Question = {
      id: result[0].questionId.toString(),
      text: body.question.text,
      options: body.question.options,
      correctAnswer: body.question.correctAnswer,
      points: body.question.points,
    };

    res.json({ success: true, question: newQuestion });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleDeleteQuestion: RequestHandler = async (req, res) => {
  const body: AdminDeleteQuestionRequest = req.body;
  const code = body.room?.toUpperCase?.();

  if (!body || !body.questionId) {
    return res.status(400).json({ error: "questionId required" });
  }

  const questionIdInt = parseInt(String(body.questionId), 10);
  if (Number.isNaN(questionIdInt)) {
    return res.status(400).json({ error: "Invalid questionId" });
  }

  try {
    await db.delete(questionsTable).where(eq(questionsTable.questionId, questionIdInt));
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Wipe handler (supports soft-delete, preserve rooms, purge options and auditing)
export const handleWipeUserData: RequestHandler = async (req, res) => {
  try {
    const body = (req.body || {}) as any;

    // Basic protection: require explicit confirmation string and admin secret
    const confirm = String(body.confirm || "").trim();
    const adminSecretHeader = String(req.header("x-admin-secret") || "");

    const envSecret = process.env.ADMIN_SECRET || "";

    if (confirm !== "WIPE" || (!envSecret && process.env.NODE_ENV !== "development" && !adminSecretHeader)) {
      return res.status(400).json({ error: "Confirmation 'WIPE' and admin secret required" });
    }

    if (envSecret && adminSecretHeader !== envSecret) {
      return res.status(403).json({ error: "Invalid admin secret" });
    }

    // Parse options
    const preserveRooms: string[] = Array.isArray(body.preserveRooms) ? body.preserveRooms.map(String) : [];
    const purgeRooms = !!body.purgeRooms;
    const purgeQuestions = !!body.purgeQuestions;
    const softDelete = !!body.softDelete;
    const initiatedBy = String(body.initiatedBy || req.header("x-initiated-by") || "admin");

    const deleted: Record<string, number> = {};
    const auditOptions = { preserveRooms, purgeRooms, purgeQuestions, softDelete };

    await db.transaction(async tx => {
      // Soft-delete path (mark isDeleted=true)
      if (softDelete) {
        // team_solved_positions
        const r1 = await tx.update(teamSolvedPositions).set({ isDeleted: true }).execute() as any;
        deleted.team_solved_positions = typeof r1 === 'number' ? r1 : (r1?.rowCount ?? r1?.length ?? 0);

        // team_solved_questions
        const r2 = await tx.update(teamSolvedQuestions).set({ isDeleted: true }).execute() as any;
        deleted.team_solved_questions = typeof r2 === 'number' ? r2 : (r2?.rowCount ?? r2?.length ?? 0);

        // team_question_mapping
        const r3 = await tx.update(teamQuestionMapping).set({ isDeleted: true }).execute() as any;
        deleted.team_question_mapping = typeof r3 === 'number' ? r3 : (r3?.rowCount ?? r3?.length ?? 0);

        // teams (optionally preserve rooms)
        if (preserveRooms.length > 0) {
          const teamsToMark = await tx.select().from(teams).execute();
          const teamIdsToMark = teamsToMark.filter((t: any) => !preserveRooms.map((r: string) => r.toUpperCase()).includes(String(t.roomCode).toUpperCase())).map((t: any) => t.teamId);
          if (teamIdsToMark.length > 0) {
            const r4 = await tx.update(teams).set({ isDeleted: true }).where((teams.teamId as any).in(teamIdsToMark)).execute() as any;
            deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0);
          } else {
            deleted.teams = 0;
          }
        } else {
          const r4 = await tx.update(teams).set({ isDeleted: true }).execute() as any;
          deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0);
        }
      } else {
        // Hard-delete path.
        if (!purgeQuestions) {
          const r1 = await tx.delete(teamSolvedPositions).execute() as any;
          deleted.team_solved_positions = typeof r1 === 'number' ? r1 : (r1?.rowCount ?? r1?.length ?? 0);

          const r2 = await tx.delete(teamSolvedQuestions).execute() as any;
          deleted.team_solved_questions = typeof r2 === 'number' ? r2 : (r2?.rowCount ?? r2?.length ?? 0);

          const r3 = await tx.delete(teamQuestionMapping).execute() as any;
          deleted.team_question_mapping = typeof r3 === 'number' ? r3 : (r3?.rowCount ?? r3?.length ?? 0);

          // delete teams (possible preserveRooms)
          if (preserveRooms.length > 0) {
            const teamsAll = await tx.select().from(teams).execute();
            const toDelete = teamsAll.filter((t: any) => !preserveRooms.map((r: string) => r.toUpperCase()).includes(String(t.roomCode).toUpperCase())).map((t: any) => t.teamId);
            if (toDelete.length > 0) {
              const r4 = await tx.delete(teams).where((teams.teamId as any).in(toDelete)).execute() as any;
              deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0);
            } else {
              deleted.teams = 0;
            }
          } else {
            const r4 = await tx.delete(teams).execute() as any;
            deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0);
          }
        } else {
          // purgeQuestions true: delete everything including questions and optionally rooms
          const r1 = await tx.delete(teamSolvedPositions).execute() as any;
          deleted.team_solved_positions = typeof r1 === 'number' ? r1 : (r1?.rowCount ?? r1?.length ?? 0);

          const r2 = await tx.delete(teamSolvedQuestions).execute() as any;
          deleted.team_solved_questions = typeof r2 === 'number' ? r2 : (r2?.rowCount ?? r2?.length ?? 0);

          const r3 = await tx.delete(teamQuestionMapping).execute() as any;
          deleted.team_question_mapping = typeof r3 === 'number' ? r3 : (r3?.rowCount ?? r3?.length ?? 0);

          const r4 = await tx.delete(teams).execute() as any;
          deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0);

          const r5 = await tx.delete(questionsTable).execute() as any;
          deleted.questions = typeof r5 === 'number' ? r5 : (r5?.rowCount ?? r5?.length ?? 0);

          if (purgeRooms) {
            const r6 = await tx.delete(rooms).execute() as any;
            deleted.rooms = typeof r6 === 'number' ? r6 : (r6?.rowCount ?? r6?.length ?? 0);
          }
        }
      }

      // Insert audit record (best-effort)
      try {
        await tx.insert(wipeAudits).values({
          initiatedBy,
          initiatedAt: new Date(),
          options: JSON.stringify(auditOptions),
          deletedCounts: JSON.stringify(deleted),
        }).execute();
      } catch (err) {
        console.error("Failed to insert wipe audit", err);
      }
    });

    res.json({ success: true, deleted });
  } catch (error) {
    console.error("handleWipeUserData", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleUploadQuestions: RequestHandler = async (req, res) => {
  try {
    const room = req.body.room as string;
    const file = req.file;

    if (!room) {
      return res.status(400).json({ error: "Room code required" });
    }

    if (!file) {
      return res.status(400).json({ error: "File is required" });
    }

    const code = room.toUpperCase();

    // Check if room exists
    const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
    if (roomResult.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    // Parse CSV data from uploaded file
    const csvData = file.buffer.toString('utf-8');
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      return res.status(400).json({ error: "CSV must have at least a header row and one data row" });
    }

    // Parse CSV data with proper quote handling
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      let i = 0;

      while (i < line.length) {
        const char = line[i];

        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            // Escaped quote
            current += '"';
            i += 2;
          } else {
            // Toggle quote state
            inQuotes = !inQuotes;
            i++;
          }
        } else if (char === ',' && !inQuotes) {
          // Field separator
          result.push(current.trim());
          current = '';
          i++;
        } else {
          current += char;
          i++;
        }
      }

      // Add the last field
      result.push(current.trim());
      return result;
    };

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
    const questionTextIndex = headers.indexOf('question_text') !== -1 ? headers.indexOf('question_text') :
                             headers.indexOf('code') !== -1 ? headers.indexOf('code') : -1;
    const correctAnswerIndex = headers.indexOf('correct_answer') !== -1 ? headers.indexOf('correct_answer') :
                              headers.indexOf('answer') !== -1 ? headers.indexOf('answer') : -1;
    const isRealIndex = headers.indexOf('is_real') !== -1 ? headers.indexOf('is_real') :
                       headers.indexOf('difficulty') !== -1 ? headers.indexOf('difficulty') : -1;

    if (questionTextIndex === -1 || correctAnswerIndex === -1) {
      return res.status(400).json({ error: "CSV must contain 'question_text'/'Code' and 'correct_answer'/'Answer' columns" });
    }

    const questionsToInsert = [];
    let importedCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length <= Math.max(questionTextIndex, correctAnswerIndex)) continue;

      const questionText = values[questionTextIndex].replace(/^"|"$/g, '');
      const correctAnswer = values[correctAnswerIndex].replace(/^"|"$/g, '');
      const isReal = isRealIndex !== -1 ? values[isRealIndex].toLowerCase() === 'true' ||
                                          values[isRealIndex] === '1' ||
                                          values[isRealIndex].toLowerCase() === 'easy' ||
                                          values[isRealIndex].toLowerCase() === 'moderate' : true;

      if (questionText && correctAnswer) {
        questionsToInsert.push({
          roomCode: code,
          questionText,
          isReal,
          correctAnswer,
        });
        importedCount++;
      }
    }

    if (questionsToInsert.length === 0) {
      return res.status(400).json({ error: "No valid questions found in CSV" });
    }

    // Insert questions in batch
    await db.insert(questionsTable).values(questionsToInsert);

    res.json({
      success: true,
      importedCount,
      message: `Successfully uploaded ${importedCount} questions`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};
import { RequestHandler } from "express";
import multer from "multer";
import type {
  AdminStateResponse,
  AdminCreateRoomRequest,
  AdminAddQuestionRequest,
  AdminDeleteQuestionRequest,
  Room,
  Question,
  Team,
} from "@shared/api";
import { db } from "../db.js";
import { rooms, questions as questionsTable, teams, teamSolvedQuestions, teamSolvedPositions, teamQuestionMapping } from "../schema.js";
import { eq } from "drizzle-orm";

export const handleAdminState: RequestHandler = async (req, res) => {
  const roomCode = req.query.room as string;
  if (!roomCode) {
    return res.status(400).json({ error: "Room code required" });
  }

  try {
    const code = roomCode.toUpperCase();

    // Get room
    const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
    const room = roomResult[0];

    // Get questions
    const questionsResult = await db.select().from(questionsTable).where(eq(questionsTable.roomCode, code));
    const roomQuestions = questionsResult.map(q => ({
      id: q.questionId.toString(),
      text: q.questionText,
      options: [], // TODO: add options if needed
      correctAnswer: 0, // TODO: parse correct answer
      points: 10, // default points
      question_id: q.questionId,
      question_text: q.questionText,
      correct_answer: q.correctAnswer,
      is_real: q.isReal,
    }));

    // Get teams
    const teamsResult = await db.select().from(teams).where(eq(teams.roomCode, code));
    const roomTeams = teamsResult.map(t => ({
      id: t.teamId,
      name: t.teamName,
      score: t.linesCompleted * 10, // approximate score
      completedAt: t.endTime?.toISOString() || null,
      isWinner: false, // TODO: determine winner
      team_id: t.teamId,
      team_name: t.teamName,
      lines_completed: t.linesCompleted,
      start_time: t.startTime.toISOString(),
      end_time: t.endTime?.toISOString() || null,
    }));

    const response: AdminStateResponse = {
      room: room ? {
        code: room.code,
        title: room.title,
        roundEndAt: room.roundEndAt?.toISOString() || null,
      } : null,
      questions: roomQuestions,
      teams: roomTeams,
      currentQuestionIndex: 0, // TODO: track current question
      gameStarted: false, // TODO: track game state
      gameEnded: false,
      timeRemaining: 0,
    };

    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleCreateRoom: RequestHandler = async (req, res) => {
  const body: AdminCreateRoomRequest = req.body;
  const code = body.code.toUpperCase();

  try {
    // Check if room exists
    const existing = await db.select().from(rooms).where(eq(rooms.code, code));
    if (existing.length > 0) {
      return res.status(400).json({ error: "Room already exists" });
    }

    await db.insert(rooms).values({
      code,
      title: body.title,
      roundEndAt: body.durationMinutes ? new Date(Date.now() + body.durationMinutes * 60 * 1000) : null,
    });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleStartGame: RequestHandler = async (req, res) => {
  const { minutes, room } = req.body;
  if (!minutes || typeof minutes !== 'number' || minutes <= 0) {
    return res.status(400).json({ error: "Valid minutes required" });
  }

  const roomCode = room || req.query.room as string;
  if (!roomCode) {
    return res.status(400).json({ error: "Room code required" });
  }

  try {
    const code = roomCode.toUpperCase();

    // Check if room exists
    const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
    if (roomResult.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    // Calculate end time
    const endTime = new Date(Date.now() + minutes * 60 * 1000);

    // Update room with timer
    await db.update(rooms)
      .set({ roundEndAt: endTime })
      .where(eq(rooms.code, code));

    res.json({ success: true, endTime: endTime.toISOString() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleExtendTimer: RequestHandler = async (req, res) => {
  const { minutes, room } = req.body;
  if (!minutes || typeof minutes !== 'number' || minutes <= 0) {
    return res.status(400).json({ error: "Valid minutes required" });
  }

  const roomCode = room || req.query.room as string;
  if (!roomCode) {
    return res.status(400).json({ error: "Room code required" });
  }

  try {
    const code = roomCode.toUpperCase();

    // Check if room exists
    const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
    if (roomResult.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    const currentRoom = roomResult[0];
    let newEndTime: Date;

    if (currentRoom.roundEndAt && currentRoom.roundEndAt > new Date()) {
      // Extend existing timer
      newEndTime = new Date(currentRoom.roundEndAt.getTime() + minutes * 60 * 1000);
    } else {
      // Start new timer
      newEndTime = new Date(Date.now() + minutes * 60 * 1000);
    }

    // Update room with extended timer
    await db.update(rooms)
      .set({ roundEndAt: newEndTime })
      .where(eq(rooms.code, code));

    res.json({ success: true, endTime: newEndTime.toISOString() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleForceEnd: RequestHandler = async (req, res) => {
  const { room } = req.body;
  const roomCode = room || req.query.room as string;
  if (!roomCode) {
    return res.status(400).json({ error: "Room code required" });
  }

  try {
    const code = roomCode.toUpperCase();

    // Check if room exists
    const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
    if (roomResult.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    // Set timer to end immediately (current time)
    const endTime = new Date();

    // Update room with immediate end time
    await db.update(rooms)
      .set({ roundEndAt: endTime })
      .where(eq(rooms.code, code));

    res.json({ success: true, endTime: endTime.toISOString() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleAddQuestion: RequestHandler = async (req, res) => {
  const body: AdminAddQuestionRequest = req.body;
  const code = body.room.toUpperCase();

  try {
    // Check if room exists
    const roomResult = await db.select().from(rooms).where(eq(rooms.code, code));
    if (roomResult.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    const result = await db.insert(questionsTable).values({
      roomCode: code,
      questionText: body.question.text,
      isReal: true, // assuming all questions are real
      correctAnswer: body.question.correctAnswer.toString(),
    }).returning();

    const newQuestion: Question = {
      id: result[0].questionId.toString(),
      text: body.question.text,
      options: body.question.options,
      correctAnswer: body.question.correctAnswer,
      points: body.question.points,
    };

    res.json({ success: true, question: newQuestion });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleDeleteQuestion: RequestHandler = async (req, res) => {
  const body: AdminDeleteQuestionRequest = req.body;
  const code = body.room?.toUpperCase?.();

  if (!body || !body.questionId) {
    return res.status(400).json({ error: "questionId required" });
  }

  const questionIdInt = parseInt(String(body.questionId), 10);
  if (Number.isNaN(questionIdInt)) {
    return res.status(400).json({ error: "Invalid questionId" });
  }

  try {
    await db.delete(questionsTable).where(eq(questionsTable.questionId, questionIdInt));
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleWipeUserData: RequestHandler = async (req, res) => {
  try {
    const body = (req.body || {}) as any;

    // Basic protection: require explicit confirmation string and admin secret
    const confirm = String(body.confirm || "").trim();
    const adminSecretHeader = String(req.header("x-admin-secret") || "");

    const envSecret = process.env.ADMIN_SECRET || "";

    if (confirm !== "WIPE" || (!envSecret && process.env.NODE_ENV !== "development" && !adminSecretHeader)) {
      return res.status(400).json({ error: "Confirmation 'WIPE' and admin secret required" });
    }

    if (envSecret && adminSecretHeader !== envSecret) {
      return res.status(403).json({ error: "Invalid admin secret" });
    }

    // Parse options
    const preserveRooms: string[] = Array.isArray(body.preserveRooms) ? body.preserveRooms.map(String) : [];
    const purgeRooms = !!body.purgeRooms;
    const purgeQuestions = !!body.purgeQuestions;
    const softDelete = !!body.softDelete;
    const initiatedBy = String(body.initiatedBy || req.header("x-initiated-by") || "admin");

    const deleted: Record<string, number> = {};
    const auditOptions = { preserveRooms, purgeRooms, purgeQuestions, softDelete };

    await db.transaction(async tx => {
      // Soft-delete path (mark isDeleted=true)
      if (softDelete) {
        // Only mark rows for tables we care about; respect preserveRooms if provided
        const preserveSet = new Set(preserveRooms.map(r => r.toUpperCase()));

        // team_solved_positions
        const r1 = await tx.update(teamSolvedPositions).set({ isDeleted: true }).execute() as any;
        deleted.team_solved_positions = typeof r1 === 'number' ? r1 : (r1?.rowCount ?? r1?.length ?? 0);

        // team_solved_questions
        const r2 = await tx.update(teamSolvedQuestions).set({ isDeleted: true }).execute() as any;
        deleted.team_solved_questions = typeof r2 === 'number' ? r2 : (r2?.rowCount ?? r2?.length ?? 0);

        // team_question_mapping
        const r3 = await tx.update(teamQuestionMapping).set({ isDeleted: true }).execute() as any;
        deleted.team_question_mapping = typeof r3 === 'number' ? r3 : (r3?.rowCount ?? r3?.length ?? 0);

        // teams (optionally preserve rooms)
        if (preserveRooms.length > 0) {
          // mark teams not in preserveRooms
          const teamsToMark = await tx.select().from(teams).execute();
          const teamIdsToMark = teamsToMark.filter((t: any) => !preserveSet.has(String(t.roomCode).toUpperCase())).map((t: any) => t.teamId);
          if (teamIdsToMark.length > 0) {
            const r4 = await tx.update(teams).set({ isDeleted: true }).where((teams.teamId as any).in(teamIdsToMark)).execute() as any;
            deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0);
          } else {
            deleted.teams = 0;
          }
        } else {
          const r4 = await tx.update(teams).set({ isDeleted: true }).execute() as any;
          deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0);
        }
      } else {
        // Hard-delete path. Respect preserveRooms, optional purgeRooms/purgeQuestions
        if (!purgeQuestions) {
          // remove solved/positions/mapping, but leave questions
          const r1 = await tx.delete(teamSolvedPositions).execute() as any;
          deleted.team_solved_positions = typeof r1 === 'number' ? r1 : (r1?.rowCount ?? r1?.length ?? 0);

          const r2 = await tx.delete(teamSolvedQuestions).execute() as any;
          deleted.team_solved_questions = typeof r2 === 'number' ? r2 : (r2?.rowCount ?? r2?.length ?? 0);

          const r3 = await tx.delete(teamQuestionMapping).execute() as any;
          deleted.team_question_mapping = typeof r3 === 'number' ? r3 : (r3?.rowCount ?? r3?.length ?? 0);

          // delete teams (possible preserveRooms)
          if (preserveRooms.length > 0) {
            // find teams in preserved rooms and exclude them
            const teamsAll = await tx.select().from(teams).execute();
            const toDelete = teamsAll.filter((t: any) => !preserveRooms.map((r: string) => r.toUpperCase()).includes(String(t.roomCode).toUpperCase())).map((t: any) => t.teamId);
            if (toDelete.length > 0) {
              const r4 = await tx.delete(teams).where((teams.teamId as any).in(toDelete)).execute() as any;
              deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0);
            } else {
              deleted.teams = 0;
            }
          } else {
            const r4 = await tx.delete(teams).execute() as any;
            deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0);
          }
        } else {
          // purgeQuestions true: delete everything including questions and optionally rooms
          const r1 = await tx.delete(teamSolvedPositions).execute() as any;
          deleted.team_solved_positions = typeof r1 === 'number' ? r1 : (r1?.rowCount ?? r1?.length ?? 0);

          const r2 = await tx.delete(teamSolvedQuestions).execute() as any;
          deleted.team_solved_questions = typeof r2 === 'number' ? r2 : (r2?.rowCount ?? r2?.length ?? 0);

          const r3 = await tx.delete(teamQuestionMapping).execute() as any;
          deleted.team_question_mapping = typeof r3 === 'number' ? r3 : (r3?.rowCount ?? r3?.length ?? 0);

          const r4 = await tx.delete(teams).execute() as any;
          deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0);

          const r5 = await tx.delete(questionsTable).execute() as any;
          deleted.questions = typeof r5 === 'number' ? r5 : (r5?.rowCount ?? r5?.length ?? 0);

          if (purgeRooms) {
            const r6 = await tx.delete(rooms).execute() as any;
            deleted.rooms = typeof r6 === 'number' ? r6 : (r6?.rowCount ?? r6?.length ?? 0);
          }
        }
      }

      // Insert audit record
      try {
        await tx.insert(wipeAudits).values({
          initiatedBy,
          initiatedAt: new Date(),
          options: JSON.stringify(auditOptions),
          deletedCounts: JSON.stringify(deleted),
        }).execute();
      } catch (err) {
        // non-fatal - log and continue
        console.error("Failed to insert wipe audit", err);
      }
    });

    res.json({ success: true, deleted });
  } catch (error) {
    console.error("handleWipeUserData", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
            i += 2;
          } else {
            // Toggle quote state
            inQuotes = !inQuotes;
            i++;
          }
        } else if (char === ',' && !inQuotes) {
          // Field separator
          result.push(current.trim());
          current = '';
          i++;
        } else {
          current += char;
          i++;
        }
      }

      // Add the last field
      result.push(current.trim());
      return result;
    };

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
    const questionTextIndex = headers.indexOf('question_text') !== -1 ? headers.indexOf('question_text') :
                             headers.indexOf('code') !== -1 ? headers.indexOf('code') : -1;
    const correctAnswerIndex = headers.indexOf('correct_answer') !== -1 ? headers.indexOf('correct_answer') :
                              headers.indexOf('answer') !== -1 ? headers.indexOf('answer') : -1;
    const isRealIndex = headers.indexOf('is_real') !== -1 ? headers.indexOf('is_real') :
                       headers.indexOf('difficulty') !== -1 ? headers.indexOf('difficulty') : -1;

    if (questionTextIndex === -1 || correctAnswerIndex === -1) {
      return res.status(400).json({ error: "CSV must contain 'question_text'/'Code' and 'correct_answer'/'Answer' columns" });
    }

    const questionsToInsert = [];
    let importedCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length <= Math.max(questionTextIndex, correctAnswerIndex)) continue;

      const questionText = values[questionTextIndex].replace(/^"|"$/g, '');
      const correctAnswer = values[correctAnswerIndex].replace(/^"|"$/g, '');
      const isReal = isRealIndex !== -1 ? values[isRealIndex].toLowerCase() === 'true' ||
                                          values[isRealIndex] === '1' ||
                                          values[isRealIndex].toLowerCase() === 'easy' ||
                                          values[isRealIndex].toLowerCase() === 'moderate' : true;

      if (questionText && correctAnswer) {
        questionsToInsert.push({
          roomCode: code,
          questionText,
          isReal,
          correctAnswer,
        });
        importedCount++;
      }
    }

    if (questionsToInsert.length === 0) {
      return res.status(400).json({ error: "No valid questions found in CSV" });
    }

    // Insert questions in batch
    await db.insert(questionsTable).values(questionsToInsert);

    res.json({
      success: true,
      importedCount,
      message: `Successfully uploaded ${importedCount} questions`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// WARNING: destructive. Deletes user/team data. Requires explicit confirmation and admin secret.
export const handleWipeUserData: RequestHandler = async (req, res) => {
  try {
    const body = req.body || {} as any;

    // Basic protection: require explicit confirmation string and admin secret header
    const confirm = String(body.confirm || "").trim();
    const adminSecretHeader = String(req.header("x-admin-secret") || "");

    const envSecret = process.env.ADMIN_SECRET || "";

    if (confirm !== "WIPE" || (!envSecret && process.env.NODE_ENV !== "development" && !adminSecretHeader)) {
      return res.status(400).json({ error: "Confirmation 'WIPE' and admin secret required" });
    }

    if (envSecret && adminSecretHeader !== envSecret) {
      return res.status(403).json({ error: "Invalid admin secret" });
    }

    // Perform deletions in a transaction and return counts
    const deleted: Record<string, number> = {};

    await db.transaction(async tx => {
      // Order matters due to foreign keys
  const r1 = await tx.delete(teamSolvedPositions).execute() as any;
  deleted.team_solved_positions = typeof r1 === 'number' ? r1 : (r1?.rowCount ?? r1?.length ?? 0);

  const r2 = await tx.delete(teamSolvedQuestions).execute() as any;
  deleted.team_solved_questions = typeof r2 === 'number' ? r2 : (r2?.rowCount ?? r2?.length ?? 0);

  const r3 = await tx.delete(teamQuestionMapping).execute() as any;
  deleted.team_question_mapping = typeof r3 === 'number' ? r3 : (r3?.rowCount ?? r3?.length ?? 0);

  const r4 = await tx.delete(teams).execute() as any;
  deleted.teams = typeof r4 === 'number' ? r4 : (r4?.rowCount ?? r4?.length ?? 0);
    });

    res.json({ success: true, deleted });
  } catch (error) {
    console.error("handleWipeUserData", error);
    res.status(500).json({ error: "Internal server error" });
  }
};