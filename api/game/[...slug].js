import { db } from "../../server/db.js";
import {
  rooms,
  questions as questionsTable,
  teams,
  teamSolvedQuestions,
  teamQuestionMapping,
  teamSolvedPositions,
} from "../../server/schema.js";
import { eq, and, sql } from "drizzle-orm";

// Seeded random shuffle function for consistent randomization
function seededShuffle(array, seed) {
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
async function generateQuestionMapping(teamId, roomCode) {
  // Get all room questions
  const roomQuestions = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.roomCode, roomCode));

  if (roomQuestions.length === 0) {
    console.log(`No questions found for room ${roomCode}`);
    return;
  }

  // Build grid positions (25 positions: A1-E5)
  const letters = ["A", "B", "C", "D", "E"];
  const gridPositions = [];
  for (const L of letters)
    for (let c = 1; c <= 5; c++) gridPositions.push(`${L}${c}`);

  // Take up to 25 questions, shuffle them randomly
  const questionsToMap = roomQuestions.slice(0, 25);
  const shuffledQuestions = seededShuffle(questionsToMap, teamId);
  const shuffledPositions = seededShuffle(gridPositions, teamId + "-grid");

  // Map questions to positions
  const mappings = [];
  for (let i = 0; i < Math.min(shuffledQuestions.length, shuffledPositions.length); i++) {
    mappings.push({
      teamId,
      questionId: shuffledQuestions[i].questionId,
      gridPosition: shuffledPositions[i],
    });
  }

  if (mappings.length > 0) {
    console.log(`Pre-mapping ${mappings.length} questions to grid positions for team ${teamId}`);
    await db.insert(teamQuestionMapping).values(mappings);
  }
}

// Ensure up to 25 questions are mapped for the team by assigning unmapped questions to unused cells.
async function ensureMappingsFilled(teamId, roomCode) {
  // Build grid positions
  const letters = ["A", "B", "C", "D", "E"];
  const gridPositions = [];
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
  // Filter questions that are not mapped yet
  let unmapped = roomQuestions.filter((q) => !mappedQids.has(q.questionId));

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
  for (let i = 0; i < toMap; i++) {
    const q = unmapped[i];
    const pos = available[i];
    if (!q || q.questionId === undefined || !pos) {
      console.debug(
        `ensureMappingsFilled: skipping mapping at i=${i} q=${JSON.stringify(q)} pos=${pos}`,
      );
      continue;
    }
    try {
      await db
        .insert(teamQuestionMapping)
        .values({ teamId, questionId: q.questionId, gridPosition: pos });
    } catch (err) {
      console.error("ensureMappingsFilled: failed to insert mapping", {
        teamId,
        questionId: q.questionId,
        pos,
        err,
      });
    }
  }
}

// Helper to compute completed lines from an array of positions like ["A1","B2",...]
function computeLinesFromPositions(positions) {
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

const handleLogin = async (req, res) => {
  const body = req.body;

  if (!body.room_code || !body.team_name) {
    return res.status(400).json({ error: "Room and team name required" });
  }

  try {
    console.log('handleLogin - DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
    console.log('handleLogin - room_code:', body.room_code, 'team_name:', body.team_name);
    
    // Enforce max length 10 for room code
    const code = body.room_code.toUpperCase().slice(0, 10);

    // Check if room exists
    const roomResult = await db
      .select()
      .from(rooms)
      .where(eq(rooms.code, code));
    if (roomResult.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }
    const room = roomResult[0];

    // Check if team name already exists
    const existingTeam = await db
      .select()
      .from(teams)
      .where(and(eq(teams.roomCode, code), eq(teams.teamName, body.team_name)));
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

        const response = {
          team: newTeam,
          room: {
            code: room.code,
            title: room.title,
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

        const response = {
          team: activeTeam,
          room: {
            code: room.code,
            title: room.title,
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

    const response = {
      team,
      room: {
        code: room.code,
        title: room.title,
        roundEndAt: room.roundEndAt?.toISOString() || null,
      },
    };

    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const handleGameState = async (req, res) => {
  const roomCode = req.query.room;
  const teamId = req.query.team;

  if (!roomCode || !teamId) {
    return res.status(400).json({ error: "Room code and team ID required" });
  }

  try {
    // Enforce max length 10 for room code
    const code = roomCode.toUpperCase().slice(0, 10);

    // Get room
    const roomResult = await db
      .select()
      .from(rooms)
      .where(eq(rooms.code, code));
    if (roomResult.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }
    const room = roomResult[0];

    // Get team
    const teamResult = await db
      .select()
      .from(teams)
      .where(eq(teams.teamId, teamId));
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
      options: [], // kept empty for now to minimize payload
      // omit correctAnswer from game-state response to reduce payload and avoid leaking answers
      points: 10,
      grid_position: mappingByQid[q.questionId] || null,
    }));

    // Get solved positions for this team
    const solvedPositionsResult = await db
      .select()
      .from(teamSolvedPositions)
      .where(eq(teamSolvedPositions.teamId, teamId));
    const solvedPositions = solvedPositionsResult.map((sp) => sp.position);

    // Show all questions (both mapped and unmapped)
    const questionsToShow = roomQuestions;

    const timeRemaining = room.roundEndAt
      ? Math.max(0, Math.floor((room.roundEndAt.getTime() - Date.now()) / 1000))
      : 0;

    const response = {
      room: {
        code: room.code,
        title: room.title,
        roundEndAt:
          room.roundEndAt && room.roundEndAt.getTime() > 0
            ? room.roundEndAt.toISOString()
            : null,
      },
      team,
      questions: questionsToShow,
      solved_positions: solvedPositions,
      currentQuestionIndex: 0, // TODO
      gameStarted: true, // TODO
      gameEnded: room.roundEndAt ? room.roundEndAt < new Date() : false,
      timeRemaining,
    };

    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const handleSubmit = async (req, res) => {
  const body = req.body;

  const rawQuestionId = body.questionId ?? body.question_id;
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

    // Get current team data
    const currentTeamResult = await db
      .select()
      .from(teams)
      .where(eq(teams.teamId, body.teamId));
    const currentTeamData = currentTeamResult[0];

    // Allow submissions even after completing lines - no winner restriction

    // Update team score (lines completed)
    let updatedTeamRow = null;
    if (correct) {
      // Fetch existing mapping for this question (should already exist from pre-mapping)
      const mappingResult = await db
        .select()
        .from(teamQuestionMapping)
        .where(
          and(
            eq(teamQuestionMapping.teamId, body.teamId),
            eq(teamQuestionMapping.questionId, questionIdNum)
          )
        );

      // Now do the transaction using Drizzle ORM
      updatedTeamRow = await db.transaction(async (tx) => {
        const t0 = Date.now();

        // Insert solved question
        await tx.insert(teamSolvedQuestions).values({
          teamId: body.teamId,
          questionId: questionIdNum,
          solvedAt: new Date(),
        });

        // If question is mapped to a grid position, mark it as solved
        if (mappingResult.length > 0) {
          const position = mappingResult[0].gridPosition;

          // Check if already solved (prevent duplicates)
          const existingSolved = await tx
            .select()
            .from(teamSolvedPositions)
            .where(
              and(
                eq(teamSolvedPositions.teamId, body.teamId),
                eq(teamSolvedPositions.position, position)
              )
            )
            .limit(1);

          if (existingSolved.length === 0) {
            await tx.insert(teamSolvedPositions).values({
              teamId: body.teamId,
              position: position,
            });
          }
        }

        // Recompute linesCompleted from solved positions
        const solvedPositionsResult = await tx
          .select({ position: teamSolvedPositions.position })
          .from(teamSolvedPositions)
          .where(eq(teamSolvedPositions.teamId, body.teamId));

        const solvedPositions = solvedPositionsResult.map(
          (row) => row.position,
        );
        const linesNow = computeLinesFromPositions(solvedPositions);

        // Update team
        const updateData = { linesCompleted: linesNow };
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
    }

    // If not correct, fetch current team once (cheap single select)
    if (!correct) {
      const teamRes = await db
        .select()
        .from(teams)
        .where(eq(teams.teamId, body.teamId));
      updatedTeamRow = teamRes[0] || null;
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

    const result = {
      correct,
      points: correct ? 10 : 0, // Points for correct answer
      newScore: (updatedTeamRow?.linesCompleted || 0) * 10, // Score based on lines completed
      achievement:
        correct && (updatedTeamRow?.linesCompleted || 0) >= 5
          ? {
              id: "bingo-master",
              title: "Bingo Master",
              description: "Completed 5 lines!",
              icon: "🏆",
            }
          : undefined,
    };

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export default async (req, res) => {
  const { slug } = req.query;
  const path = Array.isArray(slug) ? slug[0] : slug || "";

  console.log("Game API request:", req.method, req.url, "slug:", slug, "path:", path);
  console.log("Environment check:", {
    DATABASE_URL: process.env.DATABASE_URL ? "SET" : "NOT SET",
    NODE_ENV: process.env.NODE_ENV
  });

  try {
    switch (path) {
      case "login":
        await handleLogin(req, res);
        break;
      case "game-state":
        await handleGameState(req, res);
        break;
      case "submit":
        await handleSubmit(req, res);
        break;
      default:
        console.log("Unknown game path:", path);
        res.status(404).json({ error: "Game endpoint not found" });
    }
  } catch (error) {
    console.error("Game API error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal server error",
        message: error.message
      });
    }
  }
};