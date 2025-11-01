import { db } from "../server/db.js";
import { teams, rooms, teamSolvedQuestions } from "../server/schema.js";
import { eq, sql } from "drizzle-orm";

export default async (req, res) => {
  console.log('Leaderboard base route called with query:', req.query);
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
  const roomCode = req.query.room;
  console.log(`Leaderboard request for room: ${roomCode}`);
  
  if (!roomCode) {
    return res.status(400).json({ error: "Room code required" });
  }

  try {
    const code = roomCode.toUpperCase();

    // Get teams for this room with solved question counts
    const teamsWithSolvedCount = await db
      .select({
        team: teams,
        solvedQuestionsCount: sql`COUNT(${teamSolvedQuestions.questionId})`.as("solved_count"),
      })
      .from(teams)
      .leftJoin(teamSolvedQuestions, eq(teams.teamId, teamSolvedQuestions.teamId))
      .where(eq(teams.roomCode, code))
      .groupBy(teams.teamId);

    console.log(`Found ${teamsWithSolvedCount.length} teams for room ${code}`);

    // Get solved question timestamps for all teams in this room
    const allSolvedQuestions = await db
      .select()
      .from(teamSolvedQuestions)
      .where(
        eq(
          teamSolvedQuestions.teamId,
          sql`ANY(SELECT ${teams.teamId} FROM ${teams} WHERE ${teams.roomCode} = ${code})`
        )
      );

    console.log(`Found ${allSolvedQuestions.length} solved questions across all teams`);

    // Build leaderboard rows
    const rows = teamsWithSolvedCount.map(({ team, solvedQuestionsCount }) => {
      const count = Number(solvedQuestionsCount) || 0;

      // Calculate time taken for this team (if they have an end time)
      let timeTakenMs = null;
      if (team.endTime && team.startTime) {
        timeTakenMs = team.endTime.getTime() - team.startTime.getTime();
      }

      return {
        team: {
          id: team.teamId,
          name: team.teamName,
          score: team.linesCompleted * 10,
          completedAt: team.endTime?.toISOString() || null,
          isWinner: team.linesCompleted >= 5,
          team_id: team.teamId,
          team_name: team.teamName,
          lines_completed: team.linesCompleted,
          start_time: team.startTime?.toISOString() || null,
          end_time: team.endTime?.toISOString() || null,
          time_taken_ms: timeTakenMs,
          solved_questions_count: count,
        },
        rank: 0, // Will be calculated below
      };
    });

    // Sort by: 1) lines completed (desc), 2) time taken (asc), 3) solved count (desc)
    rows.sort((a, b) => {
      const linesA = a.team.lines_completed || 0;
      const linesB = b.team.lines_completed || 0;
      if (linesB !== linesA) return linesB - linesA;

      const timeA = a.team.time_taken_ms || Infinity;
      const timeB = b.team.time_taken_ms || Infinity;
      if (timeA !== timeB) return timeA - timeB;

      const countA = a.team.solved_questions_count || 0;
      const countB = b.team.solved_questions_count || 0;
      return countB - countA;
    });

    // Assign ranks
    rows.forEach((row, index) => {
      row.rank = index + 1;
    });

    console.log(`Returning ${rows.length} rows for leaderboard`);
    res.json({ rows });
  } catch (error) {
    console.error("Leaderboard error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
