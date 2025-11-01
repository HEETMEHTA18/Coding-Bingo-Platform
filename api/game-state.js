import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { teams, rooms, questions, teamQuestionMapping, teamSolvedPositions } from "../server/schema.js";

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

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const teamId = req.query.teamId;

  if (!teamId) {
    return res.status(400).json({ error: "Team ID required" });
  }

  try {
    // Get team
    const teamResult = await db
      .select()
      .from(teams)
      .where(eq(teams.teamId, teamId));
    if (teamResult.length === 0) {
      return res.status(404).json({ error: "Team not found" });
    }
    const teamData = teamResult[0];

    // Get room
    const roomResult = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, teamData.roomId));
    if (roomResult.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }
    const room = roomResult[0];

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

    // Get all questions for this room
    const questionsResult = await db
      .select()
      .from(questions)
      .where(eq(questions.roomId, room.id));

    // Get team question mappings if any
    let teamMappings = [];
    if (room.enableRandomQuestions) {
      teamMappings = await db
        .select()
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

    const response = {
      team,
      questions: questionsToShow,
      solvedPositions,
      room: {
        code: room.code,
        title: room.title,
        roundEndAt: room.roundEndAt?.toISOString() || null,
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Error in /api/game-state:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
