import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { db } from "./db";
import { rooms, questions, teams, teamSolvedPositions, teamSolvedQuestions } from "./schema";
import { eq, and, inArray, desc, asc } from "drizzle-orm";
import type {
  AdminAddQuestionRequest,
  AdminCreateRoomRequest,
  AdminDeleteQuestionRequest,
  AdminForceEndRequest,
  AdminStartRequest,
  AdminStateResponse,
  ErrorResponse,
  GameStateResponse,
  LeaderboardResponse,
  LoginRequest,
  LoginResponse,
  Question,
  QuestionID,
  Room,
  RoomCode,
  SubmissionResult,
  Team,
  TeamID,
} from "@shared/api";

const GRID_POSITIONS = (() => {
  const letters = ["A", "B", "C", "D", "E"];
  const positions: string[] = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 1; c <= 5; c++) positions.push(`${letters[r]}${c}`);
  }
  return positions;
})();

function randomId(prefix: string = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

async function ensureDemoRoom() {
  const code = "DEMO" as RoomCode;
  const existing = await db.select().from(rooms).where(eq(rooms.code, code));
  if (existing.length > 0) return;

  const roundEndAt = null; // starts when first team logs in
  await db.insert(rooms).values({
    code,
    title: "Demo Coding Bingo",
    roundEndAt,
  });

  const qs = generateDemoQuestions();
  await db.insert(questions).values(qs.map(q => ({
    questionId: q.question_id,
    roomCode: code,
    questionText: q.question_text,
    isReal: q.is_real,
    correctAnswer: q.correct_answer,
    assignedGridPos: q.assigned_grid_pos,
  })));
}

function generateDemoQuestions(): Question[] {
  // Programmatically create 35 C output-only questions; 25 real mapped to grid, 10 fake
  const questions: Question[] = [];
  // Simple arithmetic printf questions (real)
  const exprs = [
    [2, 3, 4],
    [5, 6, 2],
    [7, 8, 3],
    [9, 4, 5],
    [11, 2, 6],
    [13, 5, 2],
    [15, 3, 4],
    [17, 2, 8],
    [19, 1, 9],
    [21, 2, 10],
    [3, 7, 5],
    [6, 9, 2],
    [8, 5, 3],
    [12, 4, 2],
    [14, 3, 7],
    [16, 2, 5],
    [18, 3, 6],
    [20, 4, 3],
    [22, 5, 2],
    [24, 6, 1],
    [26, 2, 2],
    [28, 3, 3],
    [30, 4, 4],
    [32, 5, 5],
    [34, 6, 6],
  ];
  const real: Question[] = exprs.map((triple, idx) => {
    const [a, b, c] = triple;
    const value = a + b * c; // matches printf("%d", a + b * c)
    const pos = GRID_POSITIONS[idx];
    return {
      question_id: idx + 1,
      question_text: `What is the output? C code: printf("%d", ${a} + ${b} * ${c});`,
      is_real: true,
      correct_answer: String(value),
      assigned_grid_pos: pos,
    };
  });

  // Fake questions (no bingo mapping)
  const fakes: Question[] = Array.from({ length: 10 }).map((_, i) => {
    return {
      question_id: real.length + i + 1,
      question_text: `Fake Question: What is printed by printf("%s", "C");`,
      is_real: false,
      correct_answer: "C",
      assigned_grid_pos: null,
    };
  });

  return [...real, ...fakes];
}

function getLinesCompletedFromPositions(posList: string[]): number {
  const set = new Set(posList);
  const letters = ["A", "B", "C", "D", "E"];
  let lines = 0;
  // Rows (A1..A5 etc)
  for (const L of letters) {
    let ok = true;
    for (let c = 1; c <= 5; c++) if (!set.has(`${L}${c}`)) ok = false;
    if (ok) lines++;
  }
  // Columns (A1..E1 etc)
  for (let c = 1; c <= 5; c++) {
    let ok = true;
    for (let r = 0; r < 5; r++) if (!set.has(`${letters[r]}${c}`)) ok = false;
    if (ok) lines++;
  }
  // Diagonals
  const diag1 = ["A1", "B2", "C3", "D4", "E5"]; // top-left to bottom-right
  const diag2 = ["A5", "B4", "C3", "D2", "E1"]; // top-right to bottom-left
  if (diag1.every((p) => set.has(p))) lines++;
  if (diag2.every((p) => set.has(p))) lines++;
  return lines;
}

export async function createServer() {
  await ensureDemoRoom();

  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health and demo
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });
  app.get("/api/demo", handleDemo);

  // Rooms
  app.get("/api/rooms/:code", async (req, res) => {
    const code = req.params.code.toUpperCase();
    const room = await db.select().from(rooms).where(eq(rooms.code, code));
    if (room.length === 0)
      return res.status(404).json({
        ok: false,
        error: "Invalid room code",
      } satisfies ErrorResponse);
    res.json(room[0]);
  });

  // Login
  app.post("/api/login", async (req, res) => {
    const { team_name, room_code } = (req.body || {}) as LoginRequest;
    if (!team_name || !team_name.trim())
      return res.status(400).json({
        ok: false,
        error: "Team name is required",
      } satisfies ErrorResponse);
    if (!room_code || !room_code.trim())
      return res.status(400).json({
        ok: false,
        error: "Room code is required",
      } satisfies ErrorResponse);

    const code = room_code.toUpperCase();
    const room = await db.select().from(rooms).where(eq(rooms.code, code));
    if (room.length === 0)
      return res.status(400).json({
        ok: false,
        error: "Invalid room code",
      } satisfies ErrorResponse);

    const existingTeams = await db.select().from(teams).where(eq(teams.roomCode, code));
    // No duplicates in same room
    for (const t of existingTeams) {
      if (t.teamName.toLowerCase() === team_name.trim().toLowerCase()) {
        return res.status(400).json({
          ok: false,
          error: "This team name already exists",
        } satisfies ErrorResponse);
      }
    }

    const id: TeamID = randomId("team");
    const now = Date.now();

    // Initialize room timer if not started
    if (!room[0].roundEndAt) {
      // default 30 min round
      await db.update(rooms).set({ roundEndAt: now + 30 * 60 * 1000 }).where(eq(rooms.code, code));
    }

    const team: Team = {
      team_id: id,
      team_name: team_name.trim(),
      room_code: code,
      start_time: now,
      lines_completed: 0,
      end_time: null,
    };
    await db.insert(teams).values({
      teamId: id,
      teamName: team_name.trim(),
      roomCode: code,
      startTime: new Date(now),
      linesCompleted: 0,
      endTime: null,
    });

    const resp: LoginResponse = { ok: true, team, room: room[0] };
    res.json(resp);
  });

  // Game state for a team
  app.get("/api/game-state", async (req, res) => {
    const teamId = String(req.query.teamId || "");
    if (!teamId)
      return res
        .status(400)
        .json({ ok: false, error: "Missing teamId" } satisfies ErrorResponse);

    const team = await db.select().from(teams).where(eq(teams.teamId, teamId));
    if (team.length === 0)
      return res
        .status(404)
        .json({ ok: false, error: "Team not found" } satisfies ErrorResponse);

    const room = await db.select().from(rooms).where(eq(rooms.code, team[0].roomCode));
    const questionsList = await db.select().from(questions).where(eq(questions.roomCode, team[0].roomCode));
    const solvedPositions = await db.select().from(teamSolvedPositions).where(eq(teamSolvedPositions.teamId, teamId));

    const solved = solvedPositions.map(p => p.position);

    const payload: GameStateResponse = {
      team: {
        team_id: team[0].teamId,
        team_name: team[0].teamName,
        room_code: team[0].roomCode,
        start_time: team[0].startTime.getTime(),
        lines_completed: team[0].linesCompleted,
        end_time: team[0].endTime?.getTime() || null,
      },
      room: {
        code: room[0].code,
        title: room[0].title,
        roundEndAt: room[0].roundEndAt?.getTime() || null,
      },
      questions: questionsList.map((q) => ({
        question_id: q.questionId,
        question_text: q.questionText,
        is_real: q.isReal,
      })),
      solved_positions: solved,
    };
    res.json(payload);
  });

  // Submit answer
  app.post("/api/submit", async (req, res) => {
    const teamId = String(req.body.teamId || "");
    const questionId = Number(req.body.questionId);
    const answerRaw = String(req.body.answer ?? "");

    if (!teamId)
      return res
        .status(400)
        .json({ ok: false, error: "Missing teamId" } satisfies ErrorResponse);
    if (!questionId)
      return res.status(400).json({
        ok: false,
        error: "Missing questionId",
      } satisfies ErrorResponse);

    const team = await db.select().from(teams).where(eq(teams.teamId, teamId));
    if (team.length === 0)
      return res
        .status(404)
        .json({ ok: false, error: "Team not found" } satisfies ErrorResponse);
    const room = await db.select().from(rooms).where(eq(rooms.code, team[0].roomCode));

    // Timer validation
    const now = Date.now();
    if (room[0].roundEndAt && now > room[0].roundEndAt.getTime()) {
      const solvedPositions = await db.select().from(teamSolvedPositions).where(eq(teamSolvedPositions.teamId, teamId));
      const disabled: SubmissionResult = {
        status: "disabled",
        is_real: false,
        filled_cell: null,
        lines_completed: team[0].linesCompleted,
        win: Boolean(team[0].endTime),
        solved_positions: solvedPositions.map(p => p.position),
      };
      return res.json(disabled);
    }

    if (!answerRaw.trim()) {
      const solvedPositions = await db.select().from(teamSolvedPositions).where(eq(teamSolvedPositions.teamId, teamId));
      const empty: SubmissionResult = {
        status: "empty",
        is_real: false,
        filled_cell: null,
        lines_completed: team[0].linesCompleted,
        win: Boolean(team[0].endTime),
        solved_positions: solvedPositions.map(p => p.position),
      };
      return res.json(empty);
    }

    const questionsList = await db.select().from(questions).where(eq(questions.roomCode, team[0].roomCode));
    const q = questionsList.find((x) => x.questionId === questionId);
    if (!q)
      return res
        .status(400)
        .json({ ok: false, error: "Invalid question" } satisfies ErrorResponse);

    const solvedQs = await db.select().from(teamSolvedQuestions).where(and(eq(teamSolvedQuestions.teamId, teamId), eq(teamSolvedQuestions.questionId, questionId)));

    if (solvedQs.length > 0) {
      const solvedPositions = await db.select().from(teamSolvedPositions).where(eq(teamSolvedPositions.teamId, teamId));
      const resp: SubmissionResult = {
        status: "already_solved",
        is_real: q.isReal,
        filled_cell: null,
        lines_completed: team[0].linesCompleted,
        win: Boolean(team[0].endTime),
        solved_positions: solvedPositions.map(p => p.position),
      };
      return res.json(resp);
    }

    // Fake question: check correctness first
    if (!q.isReal) {
      const given = answerRaw.trim();
      const expected = q.correctAnswer.trim();
      const correct = given.toLowerCase() === expected.toLowerCase();

      if (!correct) {
        const solvedPositions = await db.select().from(teamSolvedPositions).where(eq(teamSolvedPositions.teamId, teamId));
        const resp: SubmissionResult = {
          status: "incorrect",
          is_real: false,
          filled_cell: null,
          lines_completed: team[0].linesCompleted,
          win: Boolean(team[0].endTime),
          solved_positions: solvedPositions.map(p => p.position),
        };
        return res.json(resp);
      }

      // Correct fake answer → reveal as fake, no bingo point
      await db.insert(teamSolvedQuestions).values({ teamId, questionId });
      const solvedPositions = await db.select().from(teamSolvedPositions).where(eq(teamSolvedPositions.teamId, teamId));
      const resp: SubmissionResult = {
        status: "fake",
        is_real: false,
        filled_cell: null,
        lines_completed: team[0].linesCompleted,
        win: Boolean(team[0].endTime),
        solved_positions: solvedPositions.map(p => p.position),
      };
      return res.json(resp);
    }

    // Real question: check correctness
    const given = answerRaw.trim();
    const expected = q.correctAnswer.trim();
    const correct = given.toLowerCase() === expected.toLowerCase();

    if (!correct) {
      const solvedPositions = await db.select().from(teamSolvedPositions).where(eq(teamSolvedPositions.teamId, teamId));
      const resp: SubmissionResult = {
        status: "incorrect",
        is_real: true,
        filled_cell: null,
        lines_completed: team[0].linesCompleted,
        win: Boolean(team[0].endTime),
        solved_positions: solvedPositions.map(p => p.position),
      };
      return res.json(resp);
    }

    // Correct real answer → fill a random unused bingo cell for this team
    const solvedPositions = await db.select().from(teamSolvedPositions).where(eq(teamSolvedPositions.teamId, teamId));
    const solvedSet = new Set(solvedPositions.map(p => p.position));
    const available = GRID_POSITIONS.filter((p) => !solvedSet.has(p));
    let chosen: string | null = null;
    if (available.length > 0) {
      chosen = available[Math.floor(Math.random() * available.length)];
      await db.insert(teamSolvedPositions).values({ teamId, position: chosen });
      await db.insert(teamSolvedQuestions).values({ teamId, questionId });
    }

    const positions = [...solvedSet, chosen].filter(Boolean);
    const lines = getLinesCompletedFromPositions(positions);
    await db.update(teams).set({ linesCompleted: lines }).where(eq(teams.teamId, teamId));

    let win = false;
    if (lines >= 5 && !team[0].endTime) {
      const endTime = new Date();
      await db.update(teams).set({ endTime }).where(eq(teams.teamId, teamId));
      win = true;
    }

    const resp: SubmissionResult = {
      status: "correct",
      is_real: true,
      filled_cell: chosen,
      lines_completed: lines,
      win,
      solved_positions: positions,
    };
    return res.json(resp);
  });

  // Leaderboard
  app.get("/api/leaderboard", async (req, res) => {
    const code = String(req.query.room || "").toUpperCase();
    const room = await db.select().from(rooms).where(eq(rooms.code, code));
    if (room.length === 0)
      return res.status(400).json({
        ok: false,
        error: "Invalid room code",
      } satisfies ErrorResponse);

    const teamsList = await db.select().from(teams).where(eq(teams.roomCode, code));
    const rows = teamsList
      .map((t) => ({
        team_name: t.teamName,
        lines_completed: t.linesCompleted,
        time_taken_ms: (t.endTime?.getTime() ?? Date.now()) - t.startTime.getTime(),
      }))
      .sort((a, b) => {
        if (b.lines_completed !== a.lines_completed)
          return b.lines_completed - a.lines_completed;
        return a.time_taken_ms - b.time_taken_ms;
      })
      .map((r, idx) => ({ ...r, rank: idx + 1 }));

    const payload: LeaderboardResponse = {
      room_code: code,
      rows,
      updated_at: Date.now(),
    };
    res.json(payload);
  });

  // Overall leaderboard across all rooms
  app.get("/api/leaderboard-all", async (_req, res) => {
    const teamsList = await db.select().from(teams);
    const rows = teamsList
      .map((t) => ({
        team_name: t.teamName,
        lines_completed: t.linesCompleted,
        time_taken_ms: (t.endTime?.getTime() ?? Date.now()) - t.startTime.getTime(),
        room_code: t.roomCode,
      }))
      .sort((a, b) => {
        if (b.lines_completed !== a.lines_completed)
          return b.lines_completed - a.lines_completed;
        return a.time_taken_ms - b.time_taken_ms;
      })
      .map((r, idx) => ({ ...r, rank: idx + 1 }));

    res.json({ rows, updated_at: Date.now() });
  });

  // Extend timer (admin)
  app.post("/api/extend-timer", async (req, res) => {
    const code = String(req.body.room || "").toUpperCase();
    const minutes = Number(req.body.minutes || 0);
    const room = await db.select().from(rooms).where(eq(rooms.code, code));
    if (room.length === 0)
      return res.status(400).json({
        ok: false,
        error: "Invalid room code",
      } satisfies ErrorResponse);
    if (!minutes || minutes <= 0)
      return res
        .status(400)
        .json({ ok: false, error: "Invalid minutes" } satisfies ErrorResponse);

    const now = Date.now();
    const base =
      room[0].roundEndAt && room[0].roundEndAt.getTime() > now ? room[0].roundEndAt.getTime() : now;
    await db.update(rooms).set({ roundEndAt: new Date(base + minutes * 60 * 1000) }).where(eq(rooms.code, code));
    const updated = await db.select().from(rooms).where(eq(rooms.code, code));
    res.json(updated[0]);
  });

  // --- Admin endpoints ---
  app.post("/api/admin/create-room", async (req, res) => {
    const { code, title, durationMinutes } = (req.body ||
      {}) as AdminCreateRoomRequest;
    if (!code || !title)
      return res.status(400).json({
        ok: false,
        error: "Missing code/title",
      } satisfies ErrorResponse);
    const c = code.toUpperCase();
    const now = Date.now();
    const roomData = {
      code: c,
      title: title.trim(),
      roundEndAt: durationMinutes ? new Date(now + durationMinutes * 60 * 1000) : null,
    };
    await db.insert(rooms).values(roomData);
    return res.json(roomData);
  });

  app.post("/api/admin/seed-demo", async (req, res) => {
    const code = String(req.body.room || "").toUpperCase();
    if (!code)
      return res
        .status(400)
        .json({ ok: false, error: "Missing room" } satisfies ErrorResponse);
    const existing = await db.select().from(rooms).where(eq(rooms.code, code));
    if (existing.length === 0) {
      await db.insert(rooms).values({
        code,
        title: `${code} Room`,
        roundEndAt: null,
      });
    }
    const qs = generateDemoQuestions();
    await db.insert(questions).values(qs.map(q => ({
      questionId: q.question_id,
      roomCode: code,
      questionText: q.question_text,
      isReal: q.is_real,
      correctAnswer: q.correct_answer,
      assignedGridPos: q.assigned_grid_pos,
    })));
    res.json({ ok: true });
  });

  app.get("/api/admin/state", async (req, res) => {
    const code = String(req.query.room || "").toUpperCase();
    const room = await db.select().from(rooms).where(eq(rooms.code, code));
    if (room.length === 0)
      return res.status(404).json({
        ok: false,
        error: "Invalid room code",
      } satisfies ErrorResponse);
    const questionsList = await db.select().from(questions).where(eq(questions.roomCode, code));
    const teamsList = await db.select().from(teams).where(eq(teams.roomCode, code));
    const payload: AdminStateResponse = {
      room: {
        code: room[0].code,
        title: room[0].title,
        roundEndAt: room[0].roundEndAt?.getTime() || null,
      },
      questions: questionsList.map(q => ({
        question_id: q.questionId,
        question_text: q.questionText,
        is_real: q.isReal,
        correct_answer: q.correctAnswer,
        assigned_grid_pos: q.assignedGridPos,
      })),
      teams: teamsList.map(t => ({
        team_id: t.teamId,
        team_name: t.teamName,
        room_code: t.roomCode,
        start_time: t.startTime.getTime(),
        lines_completed: t.linesCompleted,
        end_time: t.endTime?.getTime() || null,
      })),
    };
    res.json(payload);
  });

  app.post("/api/admin/add-question", async (req, res) => {
    const { room, question_text, correct_answer, is_real } = (req.body ||
      {}) as AdminAddQuestionRequest;
    const code = String(room || "").toUpperCase();
    const roomExists = await db.select().from(rooms).where(eq(rooms.code, code));
    if (roomExists.length === 0)
      return res
        .status(404)
        .json({ ok: false, error: "Invalid room" } satisfies ErrorResponse);
    const list = await db.select().from(questions).where(eq(questions.roomCode, code));
    const nextId = (list.at(-1)?.questionId ?? 0) + 1;
    const q = {
      questionId: nextId,
      roomCode: code,
      questionText: question_text.trim(),
      isReal: Boolean(is_real),
      correctAnswer: String(correct_answer),
      assignedGridPos: null,
    };
    await db.insert(questions).values(q);
    res.json({
      question_id: nextId,
      question_text: question_text.trim(),
      is_real: Boolean(is_real),
      correct_answer: String(correct_answer),
      assigned_grid_pos: null,
    });
  });

  app.post("/api/admin/delete-question", async (req, res) => {
    const { room, question_id } = (req.body ||
      {}) as AdminDeleteQuestionRequest;
    const code = String(room || "").toUpperCase();
    const roomExists = await db.select().from(rooms).where(eq(rooms.code, code));
    if (roomExists.length === 0)
      return res
        .status(404)
        .json({ ok: false, error: "Invalid room" } satisfies ErrorResponse);
    await db.delete(questions).where(and(eq(questions.roomCode, code), eq(questions.questionId, Number(question_id))));
    res.json({ ok: true });
  });

  app.post("/api/admin/start", async (req, res) => {
    const { room, minutes } = (req.body || {}) as AdminStartRequest;
    const code = String(room || "").toUpperCase();
    const r = await db.select().from(rooms).where(eq(rooms.code, code));
    if (r.length === 0)
      return res
        .status(404)
        .json({ ok: false, error: "Invalid room" } satisfies ErrorResponse);
    await db.update(rooms).set({ roundEndAt: new Date(Date.now() + Number(minutes || 0) * 60 * 1000) }).where(eq(rooms.code, code));
    const updated = await db.select().from(rooms).where(eq(rooms.code, code));
    res.json(updated[0]);
  });

  app.post("/api/admin/force-end", async (req, res) => {
    const { room } = (req.body || {}) as AdminForceEndRequest;
    const code = String(room || "").toUpperCase();
    const r = await db.select().from(rooms).where(eq(rooms.code, code));
    if (r.length === 0)
      return res
        .status(404)
        .json({ ok: false, error: "Invalid room" } satisfies ErrorResponse);
    const now = new Date();
    await db.update(rooms).set({ roundEndAt: now }).where(eq(rooms.code, code));
    await db.update(teams).set({ endTime: now }).where(and(eq(teams.roomCode, code), eq(teams.endTime, null)));
    const updated = await db.select().from(rooms).where(eq(rooms.code, code));
    res.json(updated[0]);
  });

  return app;
}
