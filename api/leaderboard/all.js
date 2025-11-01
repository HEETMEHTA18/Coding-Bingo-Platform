import { db } from "../../server/db.js";
import { teams, rooms } from "../../server/schema.js";
import { sql } from "drizzle-orm";

export default async (req, res) => {
  try {
    console.log('Leaderboard ALL endpoint called');
    
    // Get all rooms
    const allRooms = await db.select().from(rooms);
    
    const result = {};
    
    // For each room, get the teams
    for (const room of allRooms) {
      const roomTeams = await db
        .select()
        .from(teams)
        .where(sql`${teams.roomCode} = ${room.code}`);
      
      const rows = roomTeams.map((team, index) => ({
        team: {
          id: team.teamId,
          name: team.teamName,
          score: team.linesCompleted * 10,
          completedAt: team.endTime?.toISOString() || null,
          isWinner: team.linesCompleted >= 5,
          lines_completed: team.linesCompleted,
        },
        rank: index + 1,
      }));
      
      // Sort by lines completed
      rows.sort((a, b) => b.team.lines_completed - a.team.lines_completed);
      
      // Reassign ranks after sorting
      rows.forEach((row, index) => {
        row.rank = index + 1;
      });
      
      result[room.code] = { rows };
    }
    
    res.json(result);
  } catch (error) {
    console.error("Leaderboard ALL error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
