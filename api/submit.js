import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and } from "drizzle-orm";
import { teams, questions, teamSolvedQuestions, teamQuestionMapping, teamSolvedPositions } from "../server/schema.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(connectionString, {
  ssl: 'require',
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
});
const db = drizzle(client);

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body;
  const rawQuestionId = body.questionId || body.question_id;

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
      .from(questions)
      .where(eq(questions.questionId, questionIdNum));
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
        console.log(
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

    console.log(
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
    console.error("Error in /api/submit:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
