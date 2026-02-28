import { RequestHandler, Request, Response } from "express";
import type {
  GameStateResponse,
  LoginRequest,
  LoginResponse,
  SubmitRequest,
  SubmissionResult,
  GameType,
} from "../../shared/api.js";
import { db, withRetry } from "../db.js";

// ─── SSE: real-time board push ───────────────────────────────────────────────
// Map of roomCode → Set of SSE response objects
const sseRooms = new Map<string, Set<Response>>();

/** Push a JSON message to every SSE client listening in a room. */
function broadcastRoom(roomCode: string, payload: object) {
  const clients = sseRooms.get(roomCode);
  if (!clients || clients.size === 0) return;
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  clients.forEach((res) => {
    try { res.write(msg); } catch { clients.delete(res); }
  });
}

/** SSE endpoint: GET /api/tictactoe/stream?room=XXX */
export const handleTicTacToeStream: RequestHandler = (req, res) => {
  const roomCode = (req.query.room as string)?.toUpperCase().slice(0, 10);
  if (!roomCode) return res.status(400).json({ error: "Room code required" });

  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no", // nginx: disable proxy buffering
  });
  res.write("data: {\"type\":\"connected\"}\n\n");

  // Keep-alive ping every 25s so proxies don't close the connection
  const ping = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { clearInterval(ping); }
  }, 25000);

  // Register this client
  if (!sseRooms.has(roomCode)) sseRooms.set(roomCode, new Set());
  sseRooms.get(roomCode)!.add(res);

  req.on("close", () => {
    clearInterval(ping);
    sseRooms.get(roomCode)?.delete(res);
  });
};

// ─── SSE: bingo game board push ──────────────────────────────────────────────
// Separate channel from TicTacToe — only fires on bingo board changes
const bingoRooms = new Map<string, Set<Response>>();

function broadcastBingoRoom(roomCode: string, payload: object) {
  const clients = bingoRooms.get(roomCode);
  if (!clients || clients.size === 0) return;
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  clients.forEach((r) => {
    try { r.write(msg); } catch { clients.delete(r); }
  });
}

/** SSE endpoint: GET /api/game/stream?room=XXX — streams board_update events */
export const handleGameStream: RequestHandler = (req, res) => {
  const roomCode = (req.query.room as string)?.toUpperCase().slice(0, 10);
  if (!roomCode) return res.status(400).json({ error: "Room code required" });

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no", // nginx: disable proxy buffering
  });
  res.write("data: {\"type\":\"connected\"}\n\n");

  // Keep-alive ping every 25s so proxies don't close idle connections
  const ping = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { clearInterval(ping); }
  }, 25000);

  if (!bingoRooms.has(roomCode)) bingoRooms.set(roomCode, new Set());
  bingoRooms.get(roomCode)!.add(res);

  req.on("close", () => {
    clearInterval(ping);
    bingoRooms.get(roomCode)?.delete(res);
  });
};
// ─────────────────────────────────────────────────────────────────────────────
import {
  rooms,
  questions as questionsTable,
  teams,
  teamSolvedQuestions,
  teamQuestionMapping,
  teamSolvedPositions,
  submissionAttempts,
  gameBoards,
} from "../schema.js";
import { eq, and, sql } from "drizzle-orm";
import { cache, TTL } from "../cache.js";

// Seeded random shuffle function for consistent randomization
function seededShuffle<T>(array: T[], seed: string): T[] {
  const arr = [...array];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash = hash & hash;
  }

  for (let i = arr.length - 1; i > 0; i--) {
    hash = (hash * 9301 + 49297) % 233280;
    const j = Math.floor((hash / 233280) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Generate sequential question-to-grid mapping for a team
async function generateQuestionMapping(
  teamId: string,
  roomCode: string,
): Promise<void> {
  // Get all room questions
  const roomQuestions = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.roomCode, roomCode));

  if (roomQuestions.length === 0) {
    console.log(`No questions found for room ${roomCode}`);
    return;
  }

  console.log(`Found ${roomQuestions.length} total questions for room ${roomCode}`);

  // Build grid positions (25 positions: A1-E5)
  const letters = ["A", "B", "C", "D", "E"];
  const gridPositions: string[] = [];
  for (const L of letters)
    for (let c = 1; c <= 5; c++) gridPositions.push(`${L}${c}`);

  // Take up to 25 questions, shuffle them randomly
  const questionsToMap = roomQuestions.slice(0, Math.min(25, roomQuestions.length));
  console.log(`Mapping ${questionsToMap.length} questions for team ${teamId}`);

  const shuffledQuestions = seededShuffle(questionsToMap, teamId);
  const shuffledPositions = seededShuffle(gridPositions.slice(0, questionsToMap.length), teamId + "-grid");

  // Map questions to positions - only create mappings for questions that have positions
  const mappings = [];
  const limit = Math.min(shuffledQuestions.length, shuffledPositions.length, 25);

  console.log(`Creating ${limit} mappings`);

  for (let i = 0; i < limit; i++) {
    if (shuffledQuestions[i] && shuffledPositions[i]) {
      mappings.push({
        teamId,
        questionId: shuffledQuestions[i].questionId,
        gridPosition: shuffledPositions[i],
        isDeleted: false,
      });
    }
  }

  if (mappings.length > 0) {
    console.log(`Inserting ${mappings.length} question mappings for team ${teamId}`);
    try {
      await db.insert(teamQuestionMapping).values(mappings).onConflictDoNothing();
      console.log(`Successfully mapped ${mappings.length} questions`);
    } catch (error) {
      console.error(`Error inserting mappings:`, error);
    }
  }
}

// Ensure up to 25 questions are mapped for the team by assigning unmapped questions to unused cells.
async function ensureMappingsFilled(teamId: string, roomCode: string) {
  try {
    // Build grid positions
    const letters = ["A", "B", "C", "D", "E"];
    const gridPositions: string[] = [];
    for (const L of letters)
      for (let c = 1; c <= 5; c++) gridPositions.push(`${L}${c}`);

    // Load existing mappings for team
    const existingMappings = await db
      .select()
      .from(teamQuestionMapping)
      .where(eq(teamQuestionMapping.teamId, teamId));
    const mappedQids = new Set(existingMappings.map((m) => m.questionId));
    const mappedPositions = new Set(existingMappings.map((m) => m.gridPosition));

    // Load solved positions to avoid collisions
    const solvedRes = await db
      .select()
      .from(teamSolvedPositions)
      .where(eq(teamSolvedPositions.teamId, teamId));
    for (const s of solvedRes) mappedPositions.add(s.position);

    // Get all room questions
    const roomQuestions = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.roomCode, roomCode));

    // Filter valid questions only
    const validQuestions = roomQuestions.filter(q => q && q.questionId !== undefined && q.questionId !== null);

    // Filter questions that are not mapped yet
    let unmapped = validQuestions.filter((q) => !mappedQids.has(q.questionId));

    // Available positions
    let available = gridPositions.filter((p) => !mappedPositions.has(p));

    // Shuffle both pools so mapping is random instead of deterministic
    // Use a simple seed based on teamId so mapped boards are reproducible per team (but appear random)
    unmapped = seededShuffle(unmapped, teamId);
    available = seededShuffle(available, teamId + "-pos");

    // Map as many as possible (up to available slots)
    const toMap = Math.min(available.length, unmapped.length);
    if (toMap > 0) {
      console.debug(
        `ensureMappingsFilled: team=${teamId} room=${roomCode} toMap=${toMap} unmapped=${unmapped.length} available=${available.length} existingMappings=${existingMappings.length} solvedRes=${solvedRes.length}`,
      );
      // log a sample of unmapped ids/positions
      console.debug(
        "ensureMappingsFilled: sampleUnmapped=",
        unmapped.slice(0, 5).map((u) => ({ id: u?.questionId })),
        "sampleAvailable=",
        available.slice(0, 5),
      );
    }

    // Only map valid questions
    const validMappings = [];
    for (let i = 0; i < toMap; i++) {
      const q = unmapped[i];
      const pos = available[i];
      if (!q || q.questionId === undefined || q.questionId === null || !pos) {
        console.debug(
          `ensureMappingsFilled: skipping mapping at i=${i} q=${q ? 'invalid' : 'undefined'} pos=${pos}`,
        );
        continue;
      }
      validMappings.push({ teamId, questionId: q.questionId, gridPosition: pos });
    }

    // Batch insert all valid mappings
    if (validMappings.length > 0) {
      try {
        await db.insert(teamQuestionMapping).values(validMappings);
        console.debug(`Successfully mapped ${validMappings.length} questions for team ${teamId}`);
      } catch (err) {
        console.error("ensureMappingsFilled: failed to insert mappings", {
          teamId,
          count: validMappings.length,
          err,
        });
      }
    }
  } catch (err) {
    console.error('ensureMappingsFilled: error', { teamId, roomCode, err });
    throw err;
  }
}

// Helper to compute completed lines from an array of positions like ["A1","B2",...]
function computeLinesFromPositions(positions: string[]) {
  const set = new Set(positions);
  const letters = ["A", "B", "C", "D", "E"];
  let lines = 0;
  // rows
  for (const L of letters) {
    let ok = true;
    for (let c = 1; c <= 5; c++) if (!set.has(`${L}${c}`)) ok = false;
    if (ok) lines++;
  }
  // cols
  for (let c = 1; c <= 5; c++) {
    let ok = true;
    for (let r = 0; r < 5; r++) if (!set.has(`${letters[r]}${c}`)) ok = false;
    if (ok) lines++;
  }
  const diag1 = ["A1", "B2", "C3", "D4", "E5"];
  const diag2 = ["A5", "B4", "C3", "D2", "E1"];
  if (diag1.every((p) => set.has(p))) lines++;
  if (diag2.every((p) => set.has(p))) lines++;
  return lines;
}

export const handleLogin: RequestHandler = async (req, res) => {
  const body: LoginRequest = req.body;

  if (!body.room_code || !body.team_name) {
    return res.status(400).json({ error: "Room and team name required" });
  }

  try {
    // Enforce max length 10 for room code
    const code = body.room_code.toUpperCase().slice(0, 10);

    // Check if room exists
    const roomResult = await withRetry(() => db
      .select()
      .from(rooms)
      .where(eq(rooms.code, code)));
    if (roomResult.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }
    const room = roomResult[0];

    // Check if team name already exists
    const existingTeam = await withRetry(() => db
      .select()
      .from(teams)
      .where(and(eq(teams.roomCode, code), eq(teams.teamName, body.team_name))));
    if (existingTeam.length > 0) {
      const team = existingTeam[0];
      // If team has ended (has endTime), allow them to create a new team with the same name
      if (team.endTime) {
        // Create new team with same name
        const teamId = Date.now().toString();
        await db.insert(teams).values({
          teamId,
          teamName: body.team_name,
          roomCode: code,
          startTime: new Date(),
          linesCompleted: 0,
        });

        // Generate random question-to-grid mapping for this team
        await generateQuestionMapping(teamId, code);

        const newTeam = {
          id: teamId,
          team_id: teamId,
          name: body.team_name,
          score: 0,
          completedAt: null,
          isWinner: false,
        };

        const response: LoginResponse = {
          team: newTeam,
          room: {
            code: room.code,
            title: room.title,
            gameType: (room.gameType || 'bingo') as GameType,
            roundEndAt: room.roundEndAt?.toISOString() || null,
          },
        };

        res.json(response);
        return;
      } else {
        // Team is still active, return existing team data
        const activeTeam = {
          id: team.teamId,
          team_id: team.teamId,
          name: team.teamName,
          score: team.linesCompleted * 10,
          completedAt: team.endTime?.toISOString() || null,
          isWinner: false, // TODO
        };

        const response: LoginResponse = {
          team: activeTeam,
          room: {
            code: room.code,
            title: room.title,
            gameType: (room.gameType || 'bingo') as GameType,
            roundEndAt: room.roundEndAt?.toISOString() || null,
          },
        };

        res.json(response);
        return;
      }
    }

    // Create new team
    const teamId = Date.now().toString();
    await db.insert(teams).values({
      teamId,
      teamName: body.team_name,
      roomCode: code,
      startTime: new Date(),
      linesCompleted: 0,
    });

    // Generate random question-to-grid mapping for this team
    // Do not pre-map; ensure some mappings exist to allow grid population
    await ensureMappingsFilled(teamId, code);

    const team = {
      id: teamId,
      team_id: teamId,
      name: body.team_name,
      score: 0,
      completedAt: null,
      isWinner: false,
    };

    const response: LoginResponse = {
      team,
      room: {
        code: room.code,
        title: room.title,
        gameType: (room.gameType || 'bingo') as GameType,
        roundEndAt: room.roundEndAt?.toISOString() || null,
      },
    };

    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleGameState: RequestHandler = async (req, res) => {
  const roomCode = req.query.room as string;
  const teamId = req.query.team as string;

  if (!roomCode || !teamId) {
    return res.status(400).json({ error: "Room code and team ID required" });
  }

  try {
    // Enforce max length 10 for room code
    const code = roomCode.toUpperCase().slice(0, 10);

    // Get room with retry logic
    const roomResult = await withRetry(
      () => db.select().from(rooms).where(eq(rooms.code, code))
    );

    if (roomResult.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }
    const room = roomResult[0];

    // Get team with retry logic
    const teamResult = await withRetry(
      () => db.select().from(teams).where(eq(teams.teamId, teamId))
    );

    if (teamResult.length === 0) {
      return res.status(404).json({ error: "Team not found" });
    }
    const teamData = teamResult[0];

    const team = {
      id: teamData.teamId,
      name: teamData.teamName,
      score: teamData.linesCompleted * 10,
      completedAt:
        teamData.endTime && teamData.endTime.getTime() > 0
          ? teamData.endTime.toISOString()
          : null,
      isWinner: teamData.linesCompleted >= 5,
    };

    // Get room questions (only fetch needed columns to reduce payload)
    const questionsResult = await db
      .select({
        questionId: questionsTable.questionId,
        questionText: questionsTable.questionText,
        isReal: questionsTable.isReal,
      })
      .from(questionsTable)
      .where(eq(questionsTable.roomCode, code));

    // Get mapping for this team (lightweight select)
    let teamMappings = await db
      .select({ questionId: teamQuestionMapping.questionId, gridPosition: teamQuestionMapping.gridPosition })
      .from(teamQuestionMapping)
      .where(eq(teamQuestionMapping.teamId, teamId));

    // If mappings are missing or incomplete, generate mappings once (avoids heavy per-request mapping)
    const needed = Math.min(25, questionsResult.length);
    if (teamMappings.length < needed) {
      // generateQuestionMapping will map up to 25 questions for the team
      await generateQuestionMapping(teamId, code);
      teamMappings = await db
        .select({ questionId: teamQuestionMapping.questionId, gridPosition: teamQuestionMapping.gridPosition })
        .from(teamQuestionMapping)
        .where(eq(teamQuestionMapping.teamId, teamId));
    }
    // Map questionId to gridPosition
    const mappingByQid = Object.fromEntries(
      teamMappings.map((m) => [m.questionId, m.gridPosition]),
    );

    const roomQuestions = questionsResult.map((q) => ({
      id: String(q.questionId),
      question_id: q.questionId,
      text: q.questionText,
      question_text: q.questionText, // Add this for frontend compatibility
      options: [], // kept empty for now to minimize payload
      // omit correctAnswer from game-state response to reduce payload and avoid leaking answers
      points: 10,
      is_real: q.isReal, // Include whether this is a real or fake question
      grid_position: mappingByQid[q.questionId] || null, // ✅ FIX: include actual grid position from team mapping
    }));

    // Get solved positions for this team
    const solvedPositionsResult = await db
      .select()
      .from(teamSolvedPositions)
      .where(eq(teamSolvedPositions.teamId, teamId));
    const solvedPositions = solvedPositionsResult.map((sp) => sp.position);

    // Get solved questions IDs for this team
    const solvedQuestionsResult = await db
      .select({ questionId: teamSolvedQuestions.questionId })
      .from(teamSolvedQuestions)
      .where(eq(teamSolvedQuestions.teamId, teamId));
    const solvedQuestionsSet = new Set(solvedQuestionsResult.map(sq => sq.questionId));

    // Show all questions (both mapped and unmapped)
    const questionsToShow = roomQuestions.map(q => ({
      ...q,
      isSolved: solvedQuestionsSet.has(q.question_id)
    }));

    const timeRemaining = room.roundEndAt
      ? Math.max(0, Math.floor((room.roundEndAt.getTime() - Date.now()) / 1000))
      : 0;

    let tictactoe = undefined;
    if (room.gameType === 'tictactoe') {
      let { state, board } = await getOrCreateTTTBoard(code, teamId);

      // Auto-assign teams if not assigned
      let updated = false;
      let secondPlayerJoined = false;
      if (!state.teamX) {
        state.teamX = teamId;
        updated = true;
      } else if (!state.teamO && state.teamX !== teamId) {
        state.teamO = teamId;
        updated = true;
        secondPlayerJoined = true;
      }

      if (updated) {
        await db.update(gameBoards).set({
          boardState: JSON.stringify(state),
          updatedAt: new Date()
        }).where(eq(gameBoards.id, board.id));
      }

      // Update isSolved for questions based on TTT state (which includes fallback ones if solved)
      const tttSolved = new Set(state.solvedByTeam?.[teamId] || []);
      questionsToShow.forEach(q => {
        if (tttSolved.has(String(q.question_id))) {
          q.isSolved = true;
        }
      });

      const isTeamX = state.teamX === teamId;
      const isTeamO = state.teamO === teamId;
      const symbol = isTeamX ? 'X' : isTeamO ? 'O' : null;

      // Fetch team names for display
      const teamIds = [state.teamX, state.teamO].filter(Boolean) as string[];
      const teamRows = teamIds.length > 0
        ? await db.select({ teamId: teams.teamId, teamName: teams.teamName }).from(teams).where(
          teamIds.length === 1
            ? eq(teams.teamId, teamIds[0])
            : sql`${teams.teamId} IN (${sql.join(teamIds.map(id => sql`${id}`), sql`, `)})`
        )
        : [];
      const teamNameMap: Record<string, string> = {};
      for (const row of teamRows) teamNameMap[row.teamId] = row.teamName;

      tictactoe = {
        board: state.cells,
        teamX: state.teamX,
        teamO: state.teamO,
        teamXName: state.teamX ? (teamNameMap[state.teamX] || 'Team X') : null,
        teamOName: state.teamO ? (teamNameMap[state.teamO] || 'Team O') : null,
        turn: state.turn,
        knivesCredits: state.knivesCredits || {},
        movesCredits: state.movesCredits || {},
        winner: state.winner,
        winByMajority: state.winByMajority ?? false,
        yourSymbol: symbol,
        canMove: symbol === state.turn && (state.movesCredits?.[teamId] || 0) > 0,
        canKnife: (state.knivesCredits?.[teamId] || 0) > 0,
        bothConnected: !!(state.teamX && state.teamO),
        bonusQuestion: state.bonusQuestion || null,  // ← include active bonus
      };

      // Broadcast battle-start when second player joins so clients show the VS animation
      if (secondPlayerJoined) {
        broadcastRoom(code, {
          type: 'battle_start',
          teamXName: tictactoe.teamXName,
          teamOName: tictactoe.teamOName,
          teamX: state.teamX,
          teamO: state.teamO,
        });
      }
    }

    const response: GameStateResponse = {
      room: {
        code: room.code,
        title: room.title,
        gameType: (room.gameType || 'bingo') as GameType,
        roundEndAt:
          room.roundEndAt && room.roundEndAt.getTime() > 0
            ? room.roundEndAt.toISOString()
            : null,
      },
      team,
      questions: questionsToShow,
      solved_positions: solvedPositions,
      currentQuestionIndex: 0,
      gameStarted: true,
      gameEnded: room.roundEndAt ? room.roundEndAt < new Date() : false,
      timeRemaining,
      tictactoe,
    };

    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleSubmit: RequestHandler = async (req, res) => {
  const body: SubmitRequest = req.body;

  const rawQuestionId = (body as any).questionId ?? (body as any).question_id;
  if (
    !body.room ||
    !body.teamId ||
    !rawQuestionId ||
    body.answer === undefined
  ) {
    return res
      .status(400)
      .json({ error: "Room, team ID, question ID, and answer required" });
  }

  try {
    const overallStart = Date.now();
    // Enforce max length 10 for room code
    const code = body.room.toUpperCase().slice(0, 10);

    // Handle fallback question IDs (f1, f2, etc.) for hackathon robustness
    if (typeof rawQuestionId === 'string' && rawQuestionId.startsWith('f')) {
      const fallbacks: Record<string, { ans: string, real: boolean }> = {
        'f1': { ans: '20', real: true },    // Print sum of 10+10 in C → expected: "20"
        'f2': { ans: 'bingo', real: true },  // JS function returns 'bingo' → expected: "bingo"
        'f3': { ans: '99', real: false },    // Stealth: Print '99' in C++ → expected: "99"
        'f4': { ans: 'code', real: true },   // Print 'CODE' using C → expected: "CODE" (lowercased for compare)
        'f5': { ans: 'true', real: false }   // Stealth: Return true in JS → expected: "true"
      };
      const f = fallbacks[rawQuestionId];
      if (!f) return res.status(404).json({ error: "Fallback question not found" });

      const correct = f.ans === body.answer.trim().toLowerCase();
      const isRealQuestion = f.real;

      if (correct) {
        // Find shared board
        const roomRes = await db.select().from(rooms).where(eq(rooms.code, code));
        if (roomRes[0]?.gameType === 'tictactoe') {
          const { board, state } = await getOrCreateTTTBoard(code, body.teamId);

          state.solvedByTeam = state.solvedByTeam || {};
          const solvedArr = state.solvedByTeam[body.teamId] || [];

          if (!solvedArr.includes(rawQuestionId)) {
            if (isRealQuestion) {
              state.movesCredits = state.movesCredits || {};
              state.movesCredits[body.teamId] = (state.movesCredits[body.teamId] || 0) + 1;
            } else {
              state.knivesCredits = state.knivesCredits || {};
              state.knivesCredits[body.teamId] = Math.min((state.knivesCredits[body.teamId] || 0) + 1, 3);
            }
            solvedArr.push(rawQuestionId);
            state.solvedByTeam[body.teamId] = solvedArr;
            await db.update(gameBoards).set({ boardState: JSON.stringify(state), updatedAt: new Date() }).where(eq(gameBoards.id, board.id));
          }
        }
      }

      return res.json({ correct, isFake: !isRealQuestion, points: correct ? 10 : 0 });
    }

    // Normalize question id (accept either questionId or question_id)
    const questionIdNum = parseInt(String(rawQuestionId));
    // Get question
    const questionResult = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.questionId, questionIdNum));
    if (questionResult.length === 0) {
      return res.status(404).json({ error: "Question not found" });
    }
    const question = questionResult[0];

    const correct =
      question.correctAnswer.trim().toLowerCase() ===
      body.answer.trim().toLowerCase();
    const points = correct ? 10 : 0;

    // Determine if this is a real question (gives bingo points)
    const isRealQuestion = question.isReal;
    let assignedPosition: string | null = null;

    // Record submission attempt (both correct and incorrect)
    await db.insert(submissionAttempts).values({
      teamId: body.teamId,
      questionId: questionIdNum,
      roomCode: code,
      submittedAnswer: body.answer.trim(),
      isCorrect: correct,
      position: null, // No pre-mapping
      attemptedAt: new Date(),
    });

    // Get current team data
    const currentTeamResult = await db
      .select()
      .from(teams)
      .where(eq(teams.teamId, body.teamId));
    const currentTeamData = currentTeamResult[0];

    // Update team score (lines completed)
    let updatedTeamRow: any = null;
    if (correct && isRealQuestion) {
      // Only real questions contribute to bingo
      // Check if question was already solved by this team
      const alreadySolved = await db
        .select()
        .from(teamSolvedQuestions)
        .where(
          and(
            eq(teamSolvedQuestions.teamId, body.teamId),
            eq(teamSolvedQuestions.questionId, questionIdNum)
          )
        );

      if (alreadySolved.length > 0) {
        // Question already solved - don't assign new grid position
        // Just return success without modifying grid
        return res.json({
          correct: true,
          points: 0, // No additional points for re-solving
          newScore: currentTeamData.linesCompleted * 10, // Keep existing score
          isFake: false,
          assignedPosition: null,
          message: "You already solved this question!",
        } as SubmissionResult & { isFake?: boolean; assignedPosition?: string | null; message?: string });
      }

      // Assign a random unfilled grid position
      updatedTeamRow = await db.transaction(async (tx) => {
        const t0 = Date.now();

        // Insert solved question
        await tx.insert(teamSolvedQuestions).values({
          teamId: body.teamId,
          questionId: questionIdNum,
          solvedAt: new Date(),
        });

        // Get all currently solved positions for this team
        const solvedPositionsResult = await tx
          .select({ position: teamSolvedPositions.position })
          .from(teamSolvedPositions)
          .where(eq(teamSolvedPositions.teamId, body.teamId));

        const solvedPositions = solvedPositionsResult.map(row => row.position);

        // ✅ FIX: Use the team's mapped grid position for this question (deterministic, not random)
        const mappingResult = await tx
          .select({ gridPosition: teamQuestionMapping.gridPosition })
          .from(teamQuestionMapping)
          .where(and(
            eq(teamQuestionMapping.teamId, body.teamId),
            eq(teamQuestionMapping.questionId, questionIdNum)
          ));

        if (mappingResult.length > 0 && !solvedPositions.includes(mappingResult[0].gridPosition)) {
          // Use the pre-assigned position for this question
          assignedPosition = mappingResult[0].gridPosition;
        } else {
          // Fallback: find any unfilled position
          const allPositions: string[] = [];
          const rows = ['A', 'B', 'C', 'D', 'E'];
          for (const row of rows) {
            for (let col = 1; col <= 5; col++) {
              allPositions.push(`${row}${col}`);
            }
          }
          const unfilledPositions = allPositions.filter(pos => !solvedPositions.includes(pos));
          if (unfilledPositions.length > 0) {
            const randomIndex = Math.floor(Math.random() * unfilledPositions.length);
            assignedPosition = unfilledPositions[randomIndex];
          }
        }

        if (assignedPosition) {
          // Mark this position as solved
          await tx.insert(teamSolvedPositions).values({
            teamId: body.teamId,
            position: assignedPosition,
          });

          // Add to solved positions for line calculation
          solvedPositions.push(assignedPosition);
        }

        // Recompute linesCompleted from solved positions
        const linesNow = computeLinesFromPositions(solvedPositions);

        // Update team
        const updateData: any = { linesCompleted: linesNow };
        // Only set end_time when bingo (5 lines) is completed
        if (linesNow >= 5) updateData.endTime = new Date();

        const updatedTeams = await tx
          .update(teams)
          .set(updateData)
          .where(eq(teams.teamId, body.teamId))
          .returning({
            teamId: teams.teamId,
            teamName: teams.teamName,
            roomCode: teams.roomCode,
            startTime: teams.startTime,
            linesCompleted: teams.linesCompleted,
            endTime: teams.endTime,
          });

        const t1 = Date.now();
        console.debug(
          `submit: transaction for team=${body.teamId} question=${questionIdNum} took ${t1 - t0}ms`,
        );
        return updatedTeams[0];
      });
    } else if (correct && !isRealQuestion) {
      // Fake question - correct but no bingo point
      const teamRes = await db
        .select()
        .from(teams)
        .where(eq(teams.teamId, body.teamId));
      updatedTeamRow = teamRes[0] || null;
    } else if (!correct) {
      // Incorrect answer
      const teamRes = await db
        .select()
        .from(teams)
        .where(eq(teams.teamId, body.teamId));
      updatedTeamRow = teamRes[0] || null;
    }

    // Add Tic Tac Toe credits if it's correct
    if (correct) {
      const roomRes = await db.select().from(rooms).where(eq(rooms.code, code));
      if (roomRes[0]?.gameType === 'tictactoe') {
        const { board, state } = await getOrCreateTTTBoard(code, (body.teamId as string));

        state.solvedByTeam = state.solvedByTeam || {};
        const solvedArr = state.solvedByTeam[body.teamId] || [];
        const qidStr = String(questionIdNum);

        if (!solvedArr.includes(qidStr)) {
          if (isRealQuestion) {
            state.movesCredits = state.movesCredits || {};
            state.movesCredits[body.teamId] = (state.movesCredits[body.teamId] || 0) + 1;
          } else {
            state.knivesCredits = state.knivesCredits || {};
            state.knivesCredits[body.teamId] = Math.min((state.knivesCredits[body.teamId] || 0) + 1, 3);
          }
          solvedArr.push(qidStr);
          state.solvedByTeam[body.teamId] = solvedArr;

          await db.update(gameBoards).set({
            boardState: JSON.stringify(state),
            updatedAt: new Date()
          }).where(eq(gameBoards.id, board.id));

          // ⚡ Push credit update instantly to all clients in this room
          broadcastRoom(code, {
            type: "credits_update",
            movesCredits: state.movesCredits,
            knivesCredits: state.knivesCredits,
          });
        } else {
          // Already solved - maybe log it or just silently skip credits
        }
      }
    }

    if (!updatedTeamRow) {
      // Fallback: select the team row if returning did not produce a row
      const teamRes = await db
        .select()
        .from(teams)
        .where(eq(teams.teamId, body.teamId));
      updatedTeamRow = teamRes[0] || null;
    }
    if (!updatedTeamRow) {
      return res.status(404).json({ error: "Team not found" });
    }

    console.debug(
      `submit: overall handler for team=${body.teamId} question=${body.questionId} completed in ${Date.now() - overallStart}ms`,
    );

    const result: SubmissionResult = {
      correct,
      points: correct && isRealQuestion ? 10 : 0, // Only real questions give points
      newScore: (updatedTeamRow?.linesCompleted || 0) * 10, // Score based on lines completed
      isFake: !isRealQuestion, // Indicate if this is a fake question
      assignedPosition: assignedPosition, // The randomly assigned grid position
      achievement:
        correct && isRealQuestion && (updatedTeamRow?.linesCompleted || 0) >= 5
          ? {
            id: "bingo-master",
            title: "Bingo Master",
            description: "Completed 5 lines!",
            icon: "🏆",
          }
          : undefined,
    } as any;

    // 🚀 Push instant board_update to all SSE subscribers in this room on correct submissions
    if (correct) {
      broadcastBingoRoom(code, { type: "board_update", teamId: body.teamId });
    }

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Handler for recent submissions
export const handleRecentSubmissions: RequestHandler = async (req, res) => {
  const roomCode = (req.query.room as string)?.toUpperCase().slice(0, 10);

  if (!roomCode) {
    return res.status(400).json({ error: "Room code required" });
  }

  try {
    // Add timeout wrapper for database query
    const queryPromise = db
      .select({
        id: submissionAttempts.id,
        teamId: submissionAttempts.teamId,
        questionId: submissionAttempts.questionId,
        submittedAnswer: submissionAttempts.submittedAnswer,
        isCorrect: submissionAttempts.isCorrect,
        position: submissionAttempts.position,
        attemptedAt: submissionAttempts.attemptedAt,
      })
      .from(submissionAttempts)
      .where(eq(submissionAttempts.roomCode, roomCode))
      .orderBy(sql`${submissionAttempts.attemptedAt} DESC`)
      .limit(20);

    // Set a 30 second timeout for the query (increased from 10s)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout after 30s')), 30000);
    });

    const recentSubmissions = await Promise.race([queryPromise, timeoutPromise]);

    // Format the response
    const rows = recentSubmissions.map(sub => ({
      teamId: sub.teamId,
      questionId: sub.questionId,
      submittedAnswer: sub.submittedAnswer,
      isCorrect: sub.isCorrect,
      position: sub.position || null,
      solvedAt: sub.attemptedAt,
    }));

    res.json({ rows });
  } catch (error) {
    console.error("Error fetching recent submissions:", error);

    // Return empty array instead of error to prevent UI from breaking
    // This is a non-critical feature (recent activity display)
    res.json({ rows: [] });
  }
};

// Tic Tac Toe Helpers
async function getOrCreateTTTBoard(roomCode: string, creatorTeamId: string) {
  const cacheKey = `ttt:${roomCode}`;

  // ⚡ Cache hit — skip DB entirely
  const cached = cache.get<{ board: any; state: any }>(cacheKey);
  if (cached) return cached;

  const existing = await db
    .select()
    .from(gameBoards)
    .where(and(eq(gameBoards.roomCode, roomCode), eq(gameBoards.gameType, 'tictactoe')));

  if (existing.length > 0) {
    const result = { board: existing[0], state: JSON.parse(existing[0].boardState) };
    cache.set(cacheKey, result, TTL.TTT_BOARD);
    return result;
  }

  const initialState = {
    cells: Array(9).fill(null),
    teamX: null,
    teamO: null,
    turn: 'X',
    movesCredits: {},
    knivesCredits: {},
    solvedByTeam: {},
    winner: null
  };

  const [newBoard] = await db.insert(gameBoards).values({
    roomCode,
    teamId: creatorTeamId,
    gameType: 'tictactoe',
    boardState: JSON.stringify(initialState),
  }).returning();

  const result = { board: newBoard, state: initialState };
  cache.set(cacheKey, result, TTL.TTT_BOARD);
  return result;
}

export const handleTicTacToeAction: RequestHandler = async (req, res) => {
  const { room, teamId, action, index } = req.body;

  try {
    const { board, state } = await getOrCreateTTTBoard(room, teamId);

    // Assign teams if not assigned
    if (!state.teamX) {
      state.teamX = teamId;
    } else if (!state.teamO && state.teamX !== teamId) {
      state.teamO = teamId;
    }

    const isTeamX = state.teamX === teamId;
    const isTeamO = state.teamO === teamId;
    const symbol = isTeamX ? 'X' : isTeamO ? 'O' : null;

    if (!symbol) return res.status(403).json({ error: "Not a player in this game" });

    if (action === 'move') {
      if ((state.movesCredits?.[teamId] || 0) <= 0) return res.status(400).json({ error: "No move credits available. Solve a question first!" });
      // REMOVED: if (state.turn !== symbol) return res.status(400).json({ error: "Not your turn" });
      if (state.cells[index]) return res.status(400).json({ error: "Cell already occupied" });

      state.cells[index] = symbol;
      // We still update the 'turn' purely as a suggestion/visual, but we won't block moves
      state.turn = symbol === 'X' ? 'O' : 'X';
      state.movesCredits[teamId] = (state.movesCredits[teamId] || 0) - 1;

      // Check winner
      const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
        [0, 4, 8], [2, 4, 6]             // diags
      ];

      for (const p of winPatterns) {
        if (state.cells[p[0]] && state.cells[p[0]] === state.cells[p[1]] && state.cells[p[0]] === state.cells[p[2]]) {
          state.winner = state.cells[p[0]];
        }
      }

      // No 3-in-a-row but board is full → winner by cell majority
      if (!state.winner && state.cells.every((c: string | null) => c !== null)) {
        const xCount = state.cells.filter((c: string | null) => c === 'X').length;
        const oCount = state.cells.filter((c: string | null) => c === 'O').length;
        if (xCount > oCount) { state.winner = 'X'; state.winByMajority = true; }
        else if (oCount > xCount) { state.winner = 'O'; state.winByMajority = true; }
        // xCount === oCount with 9 cells is impossible, but if somehow equal: no winner
      }
    } else if (action === 'knife') {
      if ((state.knivesCredits?.[teamId] || 0) <= 0) return res.status(400).json({ error: "No knife credits available. Solve a fake question first!" });
      if (!state.cells[index]) return res.status(400).json({ error: "Cell is already empty" });

      state.cells[index] = null;
      state.knivesCredits[teamId] = (state.knivesCredits[teamId] || 0) - 1;
    }

    await db.update(gameBoards).set({
      boardState: JSON.stringify(state),
      updatedAt: new Date()
    }).where(eq(gameBoards.id, board.id));

    // ⚡ Update cache immediately so next reads skip DB
    const cacheKey = `ttt:${room.toUpperCase().slice(0, 10)}`;
    cache.set(cacheKey, { board, state }, TTL.TTT_BOARD);

    // ⚡ Push instantly to all SSE clients in this room
    broadcastRoom(room.toUpperCase().slice(0, 10), {
      type: "board_update",
      board: state.cells,
      turn: state.turn,
      winner: state.winner,
      winByMajority: state.winByMajority ?? false,
      movesCredits: state.movesCredits,
      knivesCredits: state.knivesCredits,
    });

    res.json({ success: true, state });
  } catch (err) {
    res.status(500).json({ error: "Failed to perform action" });
  }
};

// ─── Admin: Push Bonus Question to TTT Room ───────────────────────────────────
export const handleAdminPushBonus: RequestHandler = async (req, res) => {
  const { room, question, answer, isReal } = req.body;
  if (!room || !question || !answer) {
    return res.status(400).json({ error: "room, question, and answer required" });
  }
  const roomCode = String(room).toUpperCase().slice(0, 10);
  try {
    const { board, state } = await getOrCreateTTTBoard(roomCode, 'admin');
    const bonusId = `bonus_${Date.now()}`;
    state.bonusQuestion = {
      id: bonusId,
      text: question,
      answer: String(answer).toLowerCase().trim(),
      isReal: isReal !== false,
      pushedAt: Date.now(),
      solvedBy: [],
    };
    await db.update(gameBoards).set({
      boardState: JSON.stringify(state),
      updatedAt: new Date(),
    }).where(eq(gameBoards.id, board.id));
    const cacheKey = `ttt:${roomCode}`;
    cache.set(cacheKey, { board, state }, TTL.TTT_BOARD);
    broadcastRoom(roomCode, {
      type: 'bonus_question',
      bonusId,
      question,
      isReal: isReal !== false,
      pushedAt: state.bonusQuestion.pushedAt,
    });
    res.json({ success: true, bonusId });
  } catch (err) {
    console.error("handleAdminPushBonus error:", err);
    res.status(500).json({ error: "Failed to push bonus question" });
  }
};

// ─── Team: Submit Bonus Question Answer ───────────────────────────────────────
export const handleTTTBonusSubmit: RequestHandler = async (req, res) => {
  const { room, teamId, bonusId, answer } = req.body;
  if (!room || !teamId || !bonusId || answer === undefined) {
    return res.status(400).json({ error: "room, teamId, bonusId, and answer required" });
  }
  const roomCode = String(room).toUpperCase().slice(0, 10);
  try {
    const { board, state } = await getOrCreateTTTBoard(roomCode, teamId);
    const bonus = state.bonusQuestion;
    if (!bonus || bonus.id !== bonusId) {
      return res.status(404).json({ error: "Bonus question not found or expired" });
    }
    if ((bonus.solvedBy || []).includes(teamId)) {
      return res.status(409).json({ error: "Already solved this bonus question", alreadySolved: true });
    }
    const correct = String(answer).toLowerCase().trim() === bonus.answer;
    if (!correct) {
      return res.json({ correct: false });
    }
    // Award DOUBLE credits for bonus
    state.movesCredits = state.movesCredits || {};
    state.knivesCredits = state.knivesCredits || {};
    if (bonus.isReal !== false) {
      state.movesCredits[teamId] = (state.movesCredits[teamId] || 0) + 2;
    } else {
      state.knivesCredits[teamId] = Math.min((state.knivesCredits[teamId] || 0) + 2, 5);
    }
    // Always bonus +1 knife on any bonus solve
    state.knivesCredits[teamId] = Math.min((state.knivesCredits[teamId] || 0) + 1, 5);
    bonus.solvedBy = [...(bonus.solvedBy || []), teamId];
    state.bonusQuestion = bonus;
    await db.update(gameBoards).set({
      boardState: JSON.stringify(state),
      updatedAt: new Date(),
    }).where(eq(gameBoards.id, board.id));
    const cacheKey = `ttt:${roomCode}`;
    cache.set(cacheKey, { board, state }, TTL.TTT_BOARD);
    broadcastRoom(roomCode, {
      type: 'credits_update',
      movesCredits: state.movesCredits,
      knivesCredits: state.knivesCredits,
    });
    res.json({
      correct: true,
      movesAwarded: bonus.isReal !== false ? 2 : 0,
      knivesAwarded: bonus.isReal !== false ? 1 : 2,
    });
  } catch (err) {
    console.error("handleTTTBonusSubmit error:", err);
    res.status(500).json({ error: "Failed to submit bonus answer" });
  }
};

// ─── Get current TTT state for admin ─────────────────────────────────────────
export const handleAdminTTTState: RequestHandler = async (req, res) => {
  const roomCode = (req.query.room as string)?.toUpperCase().slice(0, 10);
  if (!roomCode) return res.status(400).json({ error: "room required" });
  try {
    const existing = await db
      .select()
      .from(gameBoards)
      .where(and(eq(gameBoards.roomCode, roomCode), eq(gameBoards.gameType, 'tictactoe')));
    if (!existing.length) return res.json({ exists: false });
    const state = JSON.parse(existing[0].boardState);
    res.json({
      exists: true,
      bonusQuestion: state.bonusQuestion || null,
      teamX: state.teamX,
      teamO: state.teamO,
      winner: state.winner,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get TTT state" });
  }
};

// ─── Spectator endpoint: full live board state (no teamId needed) ─────────────
export const handleSpectate: RequestHandler = async (req, res) => {
  const roomCode = (req.query.room as string)?.toUpperCase().slice(0, 10);
  if (!roomCode) return res.status(400).json({ error: "room required" });
  try {
    // Load room
    const roomRows = await db.select().from(rooms).where(eq(rooms.code, roomCode));
    if (!roomRows.length) return res.status(404).json({ error: "Room not found" });
    const room = roomRows[0];

    // Load TTT board state
    const existing = await db
      .select()
      .from(gameBoards)
      .where(and(eq(gameBoards.roomCode, roomCode), eq(gameBoards.gameType, 'tictactoe')));

    if (!existing.length) {
      return res.json({
        exists: false,
        roomCode,
        gameType: room.gameType,
        roundEndAt: room.roundEndAt ?? null,
      });
    }

    const state = JSON.parse(existing[0].boardState);

    // Fetch team names
    const teamIds = [state.teamX, state.teamO].filter(Boolean) as string[];
    const teamRows = teamIds.length > 0
      ? await db.select({ teamId: teams.teamId, teamName: teams.teamName })
          .from(teams)
          .where(teamIds.length === 1
            ? eq(teams.teamId, teamIds[0])
            : sql`${teams.teamId} IN (${sql.join(teamIds.map((id: string) => sql`${id}`), sql`, `)})`)
      : [];
    const nameMap: Record<string, string> = {};
    for (const row of teamRows) nameMap[row.teamId] = row.teamName;

    return res.json({
      exists: true,
      roomCode,
      gameType: room.gameType,
      roundEndAt: room.roundEndAt ?? null,
      board: state.cells ?? Array(9).fill(null),
      turn: state.turn ?? 'X',
      teamX: state.teamX ?? null,
      teamO: state.teamO ?? null,
      teamXName: state.teamX ? (nameMap[state.teamX] || 'Team X') : null,
      teamOName: state.teamO ? (nameMap[state.teamO] || 'Team O') : null,
      movesCredits: state.movesCredits ?? {},
      knivesCredits: state.knivesCredits ?? {},
      winner: state.winner ?? null,
      winnerName: state.winner ? (nameMap[state.winner] || state.winner) : null,
      winByMajority: state.winByMajority ?? false,
      bothConnected: !!(state.teamX && state.teamO),
      bonusQuestion: state.bonusQuestion ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get spectator state" });
  }
};
