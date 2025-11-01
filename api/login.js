import { db } from "../server/db.js";
import { rooms, teams } from "../server/schema.js";
import { eq, and } from "drizzle-orm";

// Generate random question-to-grid mapping for this team
async function generateQuestionMapping(teamId, roomCode) {
  const { teamQuestionMapping, questions: questionsTable } = await import("../server/schema.js");
  
  const letters = ["A", "B", "C", "D", "E"];
  const gridPositions = [];
  for (const L of letters) {
    for (let c = 1; c <= 5; c++) {
      gridPositions.push(`${L}${c}`);
    }
  }

  const allQuestions = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.roomCode, roomCode));

  if (allQuestions.length === 0) return;

  const shuffled = allQuestions
    .map((q) => ({ q, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ q }) => q);

  const mappings = [];
  for (let i = 0; i < Math.min(25, shuffled.length); i++) {
    mappings.push({
      teamId,
      questionId: shuffled[i].questionId,
      gridPosition: gridPositions[i],
    });
  }

  if (mappings.length > 0) {
    await db.insert(teamQuestionMapping).values(mappings);
  }
}

export default async (req, res) => {
  const body = req.body;

  if (!body.room_code || !body.team_name) {
    return res.status(400).json({ error: "Room and team name required" });
  }

  try {
    console.log('Login - DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
    console.log('Login - room_code:', body.room_code, 'team_name:', body.team_name);
    
    const code = body.room_code.toUpperCase().slice(0, 10);

    const roomResult = await db
      .select()
      .from(rooms)
      .where(eq(rooms.code, code));
      
    if (roomResult.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }
    const room = roomResult[0];

    const existingTeam = await db
      .select()
      .from(teams)
      .where(and(eq(teams.roomCode, code), eq(teams.teamName, body.team_name)));
      
    if (existingTeam.length > 0) {
      const team = existingTeam[0];
      
      if (team.endTime) {
        const teamId = Date.now().toString();
        await db.insert(teams).values({
          teamId,
          teamName: body.team_name,
          roomCode: code,
          startTime: new Date(),
          linesCompleted: 0,
        });

        await generateQuestionMapping(teamId, code);

        const newTeam = {
          id: teamId,
          team_id: teamId,
          name: body.team_name,
          score: 0,
          completedAt: null,
          isWinner: false,
        };

        return res.json({
          team: newTeam,
          room: {
            code: room.code,
            title: room.title,
            roundEndAt: room.roundEndAt?.toISOString() || null,
          },
        });
      }

      return res.json({
        team: {
          id: team.teamId,
          team_id: team.teamId,
          name: team.teamName,
          score: team.linesCompleted * 10,
          completedAt: team.endTime?.toISOString() || null,
          isWinner: team.linesCompleted >= 5,
        },
        room: {
          code: room.code,
          title: room.title,
          roundEndAt: room.roundEndAt?.toISOString() || null,
        },
      });
    }

    const teamId = Date.now().toString();
    await db.insert(teams).values({
      teamId,
      teamName: body.team_name,
      roomCode: code,
      startTime: new Date(),
      linesCompleted: 0,
    });

    await generateQuestionMapping(teamId, code);

    const newTeam = {
      id: teamId,
      team_id: teamId,
      name: body.team_name,
      score: 0,
      completedAt: null,
      isWinner: false,
    };

    res.json({
      team: newTeam,
      room: {
        code: room.code,
        title: room.title,
        roundEndAt: room.roundEndAt?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
};
