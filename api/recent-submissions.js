import { db } from "../server/db.js";
import { teams, teamSolvedQuestions, teamQuestionMapping } from "../server/schema.js";
import { eq, and } from "drizzle-orm";

export default async (req, res) => {
  const roomCode = req.query.room;
  if (!roomCode) return res.status(400).json({ error: "Room code required" });

  try {
    const code = String(roomCode).toUpperCase();

    // Recent solved events across all teams in this room
    const rows = await db
      .select({
        teamId: teamSolvedQuestions.teamId,
        questionId: teamSolvedQuestions.questionId,
        solvedAt: teamSolvedQuestions.solvedAt,
      })
      .from(teamSolvedQuestions)
      .innerJoin(teams, eq(teamSolvedQuestions.teamId, teams.teamId))
      .where(eq(teams.roomCode, code))
      .orderBy(teamSolvedQuestions.solvedAt.desc)
      .limit(30);

    // Fetch positions for these events (if mapping exists)
    const enriched = await Promise.all(
      rows.map(async (r) => {
        const mapping = await db
          .select({ gridPosition: teamQuestionMapping.gridPosition })
          .from(teamQuestionMapping)
          .where(
            and(
              eq(teamQuestionMapping.teamId, r.teamId),
              eq(teamQuestionMapping.questionId, r.questionId),
            ),
          )
          .limit(1);

        return {
          teamId: r.teamId,
          questionId: r.questionId,
          solvedAt: r.solvedAt,
          position: mapping[0]?.gridPosition || null,
        };
      }),
    );

    res.json({ rows: enriched });
  } catch (err) {
    console.error("recent-submissions error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
