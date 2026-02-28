import { RequestHandler } from "express";
import { db } from "../db.js";
import { rooms, teams, gameBoards } from "../schema.js";
import { eq, and } from "drizzle-orm";

export const handleMasterState: RequestHandler = async (req, res) => {
  try {
    const allRooms = await db.select().from(rooms).where(eq(rooms.isDeleted, false));

    const masterData = await Promise.all(allRooms.map(async (room) => {
      const roomTeams = await db.select().from(teams).where(eq(teams.roomCode, room.code));

      let boardData = null;
      if (room.gameType === 'tictactoe') {
        const boards = await db.select().from(gameBoards).where(and(eq(gameBoards.roomCode, room.code), eq(gameBoards.gameType, 'tictactoe')));
        if (boards.length > 0) {
          boardData = JSON.parse(boards[0].boardState);
        }
      }

      return {
        room,
        teams: roomTeams,
        board: boardData
      };
    }));

    res.json({ rooms: masterData });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch master state" });
  }
};
