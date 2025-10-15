import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
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

// In-memory data store (for demo / first pass)
const rooms = new Map<RoomCode, Room>();
const roomQuestions = new Map<RoomCode, Question[]>();
const teamsByRoom = new Map<RoomCode, Map<TeamID, Team>>();
const teamSolvedPositions = new Map<TeamID, Set<string>>(); // e.g., A1..E5 per team
const teamSolvedQuestions = new Map<TeamID, Set<QuestionID>>(); // solved question ids per team

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

function ensureDemoRoom() {
  const code = "DEMO" as RoomCode;
  if (rooms.has(code)) return;

  const roundEndAt = null; // starts when first team logs in
  const room: Room = { code, title: "Demo Coding Bingo", roundEndAt };
  rooms.set(code, room);

  const qs: Question[] = generateDemoQuestions();
  roomQuestions.set(code, qs);
  teamsByRoom.set(code, new Map());
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

export function createServer() {
  ensureDemoRoom();

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
  app.get("/api/rooms/:code", (req, res) => {
    const code = req.params.code.toUpperCase();
    const room = rooms.get(code);
    if (!room)
      return res
        .status(404)
        .json({
          ok: false,
          error: "Invalid room code",
        } satisfies ErrorResponse);
    res.json(room);
  });

  // Login
  app.post("/api/login", (req, res) => {
    const { team_name, room_code } = (req.body || {}) as LoginRequest;
    if (!team_name || !team_name.trim())
      return res
        .status(400)
        .json({
          ok: false,
          error: "Team name is required",
        } satisfies ErrorResponse);
    if (!room_code || !room_code.trim())
      return res
        .status(400)
        .json({
          ok: false,
          error: "Room code is required",
        } satisfies ErrorResponse);

    const code = room_code.toUpperCase();
    const room = rooms.get(code);
    if (!room)
      return res
        .status(400)
        .json({
          ok: false,
          error: "Invalid room code",
        } satisfies ErrorResponse);

    const teamMap = teamsByRoom.get(code)!;
    // No duplicates in same room
    for (const t of teamMap.values()) {
      if (t.team_name.toLowerCase() === team_name.trim().toLowerCase()) {
        return res
          .status(400)
          .json({
            ok: false,
            error: "This team name already exists",
          } satisfies ErrorResponse);
      }
    }

    const id: TeamID = randomId("team");
    const now = Date.now();

    // Initialize room timer if not started
    if (!room.roundEndAt) {
      // default 30 min round
      room.roundEndAt = now + 30 * 60 * 1000;
      rooms.set(code, room);
    }

    const team: Team = {
      team_id: id,
      team_name: team_name.trim(),
      room_code: code,
      start_time: now,
      lines_completed: 0,
      end_time: null,
    };
    teamMap.set(id, team);
    teamSolvedPositions.set(id, new Set());
    teamSolvedQuestions.set(id, new Set());

    const resp: LoginResponse = { ok: true, team, room };
    res.json(resp);
  });

  // Game state for a team
  app.get("/api/game-state", (req, res) => {
    const teamId = String(req.query.teamId || "");
    if (!teamId)
      return res
        .status(400)
        .json({ ok: false, error: "Missing teamId" } satisfies ErrorResponse);

    const team = findTeamById(teamId);
    if (!team)
      return res
        .status(404)
        .json({ ok: false, error: "Team not found" } satisfies ErrorResponse);

    const room = rooms.get(team.room_code)!;
    const questions = roomQuestions.get(team.room_code)!;
    const solved = Array.from(teamSolvedPositions.get(teamId) ?? []);

    const payload: GameStateResponse = {
      team,
      room,
      questions: questions.map((q) => ({
        question_id: q.question_id,
        question_text: q.question_text,
        is_real: q.is_real,
      })),
      solved_positions: solved,
    };
    res.json(payload);
  });

  // Submit answer
  app.post("/api/submit", (req, res) => {
    const teamId = String(req.body.teamId || "");
    const questionId = Number(req.body.questionId);
    const answerRaw = String(req.body.answer ?? "");

    if (!teamId)
      return res
        .status(400)
        .json({ ok: false, error: "Missing teamId" } satisfies ErrorResponse);
    if (!questionId)
      return res
        .status(400)
        .json({
          ok: false,
          error: "Missing questionId",
        } satisfies ErrorResponse);

    const team = findTeamById(teamId);
    if (!team)
      return res
        .status(404)
        .json({ ok: false, error: "Team not found" } satisfies ErrorResponse);
    const room = rooms.get(team.room_code)!;

    // Timer validation
    const now = Date.now();
    if (room.roundEndAt && now > room.roundEndAt) {
      const disabled: SubmissionResult = {
        status: "disabled",
        is_real: false,
        filled_cell: null,
        lines_completed: team.lines_completed,
        win: Boolean(team.end_time),
        solved_positions: Array.from(teamSolvedPositions.get(teamId) ?? []),
      };
      return res.json(disabled);
    }

    if (!answerRaw.trim()) {
      const empty: SubmissionResult = {
        status: "empty",
        is_real: false,
        filled_cell: null,
        lines_completed: team.lines_completed,
        win: Boolean(team.end_time),
        solved_positions: Array.from(teamSolvedPositions.get(teamId) ?? []),
      };
      return res.json(empty);
    }

    const questions = roomQuestions.get(team.room_code)!;
    const q = questions.find((x) => x.question_id === questionId);
    if (!q)
      return res
        .status(400)
        .json({ ok: false, error: "Invalid question" } satisfies ErrorResponse);

    const solvedSet = teamSolvedPositions.get(teamId)!;
    const solvedQs = teamSolvedQuestions.get(teamId)!;

    if (solvedQs.has(questionId)) {
      const resp: SubmissionResult = {
        status: "already_solved",
        is_real: q.is_real,
        filled_cell: null,
        lines_completed: team.lines_completed,
        win: Boolean(team.end_time),
        solved_positions: Array.from(solvedSet),
      };
      return res.json(resp);
    }

    // Fake question
    if (!q.is_real) {
      const resp: SubmissionResult = {
        status: "fake",
        is_real: false,
        filled_cell: null,
        lines_completed: team.lines_completed,
        win: Boolean(team.end_time),
        solved_positions: Array.from(solvedSet),
      };
      return res.json(resp);
    }

    // Real question: check correctness
    const given = answerRaw.trim();
    const expected = q.correct_answer.trim();
    const correct = given.toLowerCase() === expected.toLowerCase();

    if (!correct) {
      const resp: SubmissionResult = {
        status: "incorrect",
        is_real: true,
        filled_cell: null,
        lines_completed: team.lines_completed,
        win: Boolean(team.end_time),
        solved_positions: Array.from(solvedSet),
      };
      return res.json(resp);
    }

    // Correct real answer → fill a random unused bingo cell for this team
    const available = GRID_POSITIONS.filter((p) => !solvedSet.has(p));
    let chosen: string | null = null;
    if (available.length > 0) {
      chosen = available[Math.floor(Math.random() * available.length)];
      solvedSet.add(chosen);
      teamSolvedQuestions.get(teamId)!.add(questionId);
    }

    const positions = Array.from(solvedSet);
    const lines = getLinesCompletedFromPositions(positions);
    team.lines_completed = lines;

    let win = false;
    if (lines >= 5 && !team.end_time) {
      team.end_time = Date.now();
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
  app.get("/api/leaderboard", (req, res) => {
    const code = String(req.query.room || "").toUpperCase();
    const room = rooms.get(code);
    if (!room)
      return res
        .status(400)
        .json({
          ok: false,
          error: "Invalid room code",
        } satisfies ErrorResponse);

    const tmap = teamsByRoom.get(code)!;
    const rows = Array.from(tmap.values())
      .map((t) => ({
        team_name: t.team_name,
        lines_completed: t.lines_completed,
        time_taken_ms: (t.end_time ?? Date.now()) - t.start_time,
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
  app.get("/api/leaderboard-all", (_req, res) => {
    const rows = Array.from(teamsByRoom.entries())
      .flatMap(([code, tmap]) =>
        Array.from(tmap.values()).map((t) => ({
          team_name: t.team_name,
          lines_completed: t.lines_completed,
          time_taken_ms: (t.end_time ?? Date.now()) - t.start_time,
          room_code: code,
        })),
      )
      .sort((a, b) => {
        if (b.lines_completed !== a.lines_completed) return b.lines_completed - a.lines_completed;
        return a.time_taken_ms - b.time_taken_ms;
      })
      .map((r, idx) => ({ ...r, rank: idx + 1 }));

    res.json({ rows, updated_at: Date.now() });
  });

  // Extend timer (admin)
  app.post("/api/extend-timer", (req, res) => {
    const code = String(req.body.room || "").toUpperCase();
    const minutes = Number(req.body.minutes || 0);
    const room = rooms.get(code);
    if (!room)
      return res
        .status(400)
        .json({
          ok: false,
          error: "Invalid room code",
        } satisfies ErrorResponse);
    if (!minutes || minutes <= 0)
      return res
        .status(400)
        .json({ ok: false, error: "Invalid minutes" } satisfies ErrorResponse);

    const now = Date.now();
    const base =
      room.roundEndAt && room.roundEndAt > now ? room.roundEndAt : now;
    room.roundEndAt = base + minutes * 60 * 1000;
    rooms.set(code, room);
    res.json(room);
  });

  // --- Admin endpoints ---
  app.post("/api/admin/create-room", (req, res) => {
    const { code, title, durationMinutes } = (req.body ||
      {}) as AdminCreateRoomRequest;
    if (!code || !title)
      return res
        .status(400)
        .json({
          ok: false,
          error: "Missing code/title",
        } satisfies ErrorResponse);
    const c = code.toUpperCase();
    const now = Date.now();
    const room: Room = {
      code: c,
      title: title.trim(),
      roundEndAt: durationMinutes ? now + durationMinutes * 60 * 1000 : null,
    };
    rooms.set(c, room);
    roomQuestions.set(c, []);
    teamsByRoom.set(c, new Map());
    return res.json(room);
  });

  app.post("/api/admin/seed-demo", (req, res) => {
    const code = String(req.body.room || "").toUpperCase();
    if (!code)
      return res
        .status(400)
        .json({ ok: false, error: "Missing room" } satisfies ErrorResponse);
    if (!rooms.get(code))
      rooms.set(code, { code, title: `${code} Room`, roundEndAt: null });
    roomQuestions.set(code, generateDemoQuestions());
    if (!teamsByRoom.get(code)) teamsByRoom.set(code, new Map());
    res.json({ ok: true });
  });

  app.get("/api/admin/state", (req, res) => {
    const code = String(req.query.room || "").toUpperCase();
    const room = rooms.get(code);
    if (!room)
      return res
        .status(404)
        .json({
          ok: false,
          error: "Invalid room code",
        } satisfies ErrorResponse);
    const questions = roomQuestions.get(code) ?? [];
    const teams = Array.from(teamsByRoom.get(code)?.values() ?? []);
    const payload: AdminStateResponse = { room, questions, teams };
    res.json(payload);
  });

  app.post("/api/admin/add-question", (req, res) => {
    const { room, question_text, correct_answer, is_real } = (req.body ||
      {}) as AdminAddQuestionRequest;
    const code = String(room || "").toUpperCase();
    if (!rooms.get(code))
      return res
        .status(404)
        .json({ ok: false, error: "Invalid room" } satisfies ErrorResponse);
    const list = roomQuestions.get(code) ?? [];
    const nextId = (list.at(-1)?.question_id ?? 0) + 1;
    const q: Question = {
      question_id: nextId,
      question_text: question_text.trim(),
      is_real: Boolean(is_real),
      correct_answer: String(correct_answer),
      assigned_grid_pos: null,
    };
    list.push(q);
    roomQuestions.set(code, list);
    res.json(q);
  });

  app.post("/api/admin/delete-question", (req, res) => {
    const { room, question_id } = (req.body ||
      {}) as AdminDeleteQuestionRequest;
    const code = String(room || "").toUpperCase();
    const list = roomQuestions.get(code);
    if (!list)
      return res
        .status(404)
        .json({ ok: false, error: "Invalid room" } satisfies ErrorResponse);
    const idx = list.findIndex((x) => x.question_id === Number(question_id));
    if (idx >= 0) list.splice(idx, 1);
    roomQuestions.set(code, list);
    res.json({ ok: true });
  });

  app.post("/api/admin/start", (req, res) => {
    const { room, minutes } = (req.body || {}) as AdminStartRequest;
    const code = String(room || "").toUpperCase();
    const r = rooms.get(code);
    if (!r)
      return res
        .status(404)
        .json({ ok: false, error: "Invalid room" } satisfies ErrorResponse);
    r.roundEndAt = Date.now() + Number(minutes || 0) * 60 * 1000;
    rooms.set(code, r);
    res.json(r);
  });

  app.post("/api/admin/force-end", (req, res) => {
    const { room } = (req.body || {}) as AdminForceEndRequest;
    const code = String(room || "").toUpperCase();
    const r = rooms.get(code);
    if (!r)
      return res
        .status(404)
        .json({ ok: false, error: "Invalid room" } satisfies ErrorResponse);
    const now = Date.now();
    r.roundEndAt = now;
    const tmap = teamsByRoom.get(code) ?? new Map();
    for (const t of tmap.values()) if (!t.end_time) t.end_time = now;
    rooms.set(code, r);
    res.json(r);
  });

  return app;
}

function findTeamById(teamId: TeamID): Team | null {
  for (const [code, map] of teamsByRoom) {
    const t = map.get(teamId);
    if (t) return t;
  }
  return null;
}
