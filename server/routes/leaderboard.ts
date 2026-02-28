import { RequestHandler } from "express";
import type { LeaderboardResponse } from "../../shared/api.js";
import { db } from "../db.js";
import { teams, rooms, teamSolvedQuestions, gameBoards } from "../schema.js";
import { eq, sql } from "drizzle-orm";
import { cache, TTL } from "../cache.js";

/** Fetch TTT board state (teamX, teamO, winner, cells) for a room, or null if not TTT */
async function getTTTState(roomCode: string): Promise<{ teamX: string | null; teamO: string | null; winner: string | null; draw: boolean; cells: (string | null)[] } | null> {
  try {
    const boards = await db.select().from(gameBoards)
      .where(eq(gameBoards.roomCode, roomCode))
      .limit(1);
    if (!boards[0]) return null;
    const state = JSON.parse(boards[0].boardState || '{}');
    const winner = state.winner || null; // 'X' or 'O'
    const cells: (string | null)[] = state.cells || [];
    const draw = !winner && cells.every((c: string | null) => c !== null);
    return {
      teamX: state.teamX || null,
      teamO: state.teamO || null,
      winner,
      draw,
      cells,
    };
  } catch { return null; }
}


export const handleLeaderboard: RequestHandler = async (req, res) => {
  const roomCode = req.query.room as string;
  if (!roomCode) return res.status(400).json({ error: "Room code required" });

  const code = roomCode.toUpperCase();
  const cacheKey = `lb:${code}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    // Get room info to check gameType
    const roomResult = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
    const roomData = roomResult[0];
    const isTTT = roomData?.gameType === 'tictactoe';

    // Fetch TTT board state if needed
    const tttState = isTTT ? await getTTTState(code) : null;

    // Get teams for this room with solved question counts
    const teamsWithSolvedCount = await db
      .select({
        team: teams,
        solvedQuestionsCount: sql<number>`COUNT(${teamSolvedQuestions.questionId})`.as("solved_count"),
      })
      .from(teams)
      .leftJoin(teamSolvedQuestions, eq(teams.teamId, teamSolvedQuestions.teamId))
      .where(eq(teams.roomCode, code))
      .groupBy(teams.teamId);

    // Calculate leaderboard with proper time calculations
    const sortedTeams = teamsWithSolvedCount
      .map((item) => {
        let timeTakenMs = 0;
        const startTime = item.team.startTime;

        if (startTime && startTime.getTime() > 0) {
          const isCompleted = (item.team.endTime && item.team.endTime.getTime() > 0) || item.team.linesCompleted >= 5;
          if (isCompleted) {
            const endTime = item.team.endTime && item.team.endTime.getTime() > 0
              ? item.team.endTime
              : new Date();
            timeTakenMs = endTime.getTime() - startTime.getTime();
          } else {
            timeTakenMs = Date.now() - startTime.getTime();
          }
        }

        // TTT-specific role & result
        let tttRole: 'X' | 'O' | 'spectator' | null = null;
        let tttWinner = false;
        let tttDraw = false;
        let tttCells = 0; // how many board cells this team owns
        if (isTTT && tttState) {
          if (tttState.teamX === item.team.teamId) { tttRole = 'X'; }
          else if (tttState.teamO === item.team.teamId) { tttRole = 'O'; }
          else { tttRole = 'spectator'; }
          if (tttRole !== 'spectator' && tttState.winner) {
            tttWinner = tttState.winner === tttRole;
          }
          if (tttRole && tttRole !== 'spectator') {
            tttCells = (tttState.cells || []).filter((c: string | null) => c === tttRole).length;
          }
          tttDraw = tttState.draw;
        }

        return {
          team: {
            id: item.team.teamId,
            name: item.team.teamName,
            score: item.team.linesCompleted * 10,
            completedAt: item.team.endTime && item.team.endTime.getTime() > 0 ? item.team.endTime.toISOString() : null,
            isWinner: isTTT ? tttWinner : item.team.linesCompleted >= 5,
            team_id: item.team.teamId,
            team_name: item.team.teamName,
            lines_completed: item.team.linesCompleted,
            start_time: item.team.startTime && item.team.startTime.getTime() > 0 ? item.team.startTime.toISOString() : null,
            end_time: item.team.endTime && item.team.endTime.getTime() > 0 ? item.team.endTime.toISOString() : null,
            time_taken_ms: timeTakenMs,
            solved_questions_count: item.solvedQuestionsCount,
            // TTT extras (null for non-TTT rooms)
            ttt_role: tttRole,
            ttt_winner: tttWinner,
            ttt_draw: tttDraw,
          },
          linesCompleted: item.team.linesCompleted,
          solved_questions_count: item.solvedQuestionsCount,
          isTTTSpectator: tttRole === 'spectator',
          tttWinner,
          tttCells, // used for ranking active TTT matches
        };
      })
      .sort((a, b) => {
        // Spectators always last
        if (a.isTTTSpectator !== b.isTTTSpectator) return a.isTTTSpectator ? 1 : -1;
        // TTT winner first
        if (a.tttWinner !== b.tttWinner) return a.tttWinner ? -1 : 1;
        // Active TTT: team owning more board cells ranks higher (shows correct LEADER)
        if (isTTT && a.tttCells !== b.tttCells) return b.tttCells - a.tttCells;
        // Bingo: lines descending
        if (b.linesCompleted !== a.linesCompleted) return b.linesCompleted - a.linesCompleted;
        // Faster time wins
        return a.team.time_taken_ms - b.team.time_taken_ms;
      })
      .map((item, index) => ({
        team: item.team,
        rank: item.isTTTSpectator ? 999 : index + 1,
      }));

    const response: LeaderboardResponse = { rows: sortedTeams };
    cache.set(cacheKey, response, TTL.LEADERBOARD);
    res.json(response);
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleLeaderboardAll: RequestHandler = async (req, res) => {
  const cAllKey = `lb:all`;
  const cachedAll = cache.get(cAllKey);
  if (cachedAll) return res.json(cachedAll);

  try {
    // Get all rooms
    const allRooms = await db.select().from(rooms);

    const result: Record<string, any> = {};

    for (const room of allRooms) {
      const code = room.code;

      // Get teams for this room with solved question counts
      const teamsWithSolvedCount = await db
        .select({
          team: teams,
          solvedQuestionsCount: sql<number>`COUNT(${teamSolvedQuestions.questionId})`.as("solved_count"),
        })
        .from(teams)
        .leftJoin(teamSolvedQuestions, eq(teams.teamId, teamSolvedQuestions.teamId))
        .where(eq(teams.roomCode, code))
        .groupBy(teams.teamId);

      // Calculate leaderboard with proper time calculations
      const sortedTeams = teamsWithSolvedCount
        .map((item) => {
          let timeTakenMs = 0;
          const startTime = item.team.startTime;

          if (startTime && startTime.getTime() > 0) {
            const isCompleted = (item.team.endTime && item.team.endTime.getTime() > 0) || item.team.linesCompleted >= 5;
            if (isCompleted) {
              const endTime = item.team.endTime && item.team.endTime.getTime() > 0
                ? item.team.endTime
                : new Date();
              timeTakenMs = endTime.getTime() - startTime.getTime();
            } else {
              timeTakenMs = Date.now() - startTime.getTime();
            }
          }

          return {
            team: {
              id: item.team.teamId,
              name: item.team.teamName,
              score: item.team.linesCompleted * 10,
              completedAt: item.team.endTime && item.team.endTime.getTime() > 0
                ? item.team.endTime.toISOString()
                : null,
              isWinner: item.team.linesCompleted >= 5,
              team_id: item.team.teamId,
              team_name: item.team.teamName,
              lines_completed: item.team.linesCompleted,
              start_time: item.team.startTime && item.team.startTime.getTime() > 0
                ? item.team.startTime.toISOString()
                : null,
              end_time: item.team.endTime && item.team.endTime.getTime() > 0
                ? item.team.endTime.toISOString()
                : null,
              time_taken_ms: timeTakenMs,
              solved_questions_count: item.solvedQuestionsCount,
            },
            linesCompleted: item.team.linesCompleted,
            solved_questions_count: item.solvedQuestionsCount,
          };
        });

      // TTT-aware enrichment for TicTacToe rooms
      const isTTT = room.gameType === 'tictactoe';
      const tttState = isTTT ? await getTTTState(code) : null;

      const enriched = sortedTeams.map(item => {
        let tttWinner = false;
        let tttCells = 0;
        let isTTTSpectator = false;
        if (isTTT && tttState) {
          const symbol = tttState.teamX === item.team.id ? 'X'
                       : tttState.teamO === item.team.id ? 'O'
                       : null;
          if (!symbol) { isTTTSpectator = true; }
          else {
            tttCells = tttState.cells.filter((c: string | null) => c === symbol).length;
            tttWinner = !!(tttState.winner && tttState.winner === symbol);
          }
        }
        return { ...item, tttWinner, tttCells, isTTTSpectator };
      });

      const ranked = enriched
        .sort((a, b) => {
          if (isTTT) {
            // Spectators always last
            if (a.isTTTSpectator !== b.isTTTSpectator) return a.isTTTSpectator ? 1 : -1;
            // Winner first
            if (a.tttWinner !== b.tttWinner) return a.tttWinner ? -1 : 1;
            // More cells on board = better rank
            if (b.tttCells !== a.tttCells) return b.tttCells - a.tttCells;
            // Faster time as tiebreaker
            return a.team.time_taken_ms - b.team.time_taken_ms;
          }
          if (b.linesCompleted !== a.linesCompleted) return b.linesCompleted - a.linesCompleted;
          return a.team.time_taken_ms - b.team.time_taken_ms;
        })
        .map((item, index) => ({
          team: { ...item.team, ttt_winner: item.tttWinner },
          rank: item.isTTTSpectator ? 999 : index + 1,
          tttWinner: item.tttWinner,
        }));

      // Find the winner
      const winner = isTTT
        ? ranked.find(t => t.tttWinner)
        : ranked.find(t => t.team.lines_completed >= 5);

      result[code] = {
        room: {
          code: room.code,
          title: room.title || room.code,
          gameType: room.gameType || 'bingo',
          roundEndAt: room.roundEndAt?.toISOString() || null,
        },
        rows: ranked,
        winner: winner ? winner.team : null,
        teamCount: ranked.length,
        hasWinner: !!winner,
      };
    }

    cache.set(cAllKey, result, TTL.LEADERBOARD);
    res.json(result);
  } catch (error) {
    console.error('LeaderboardAll error:', error);
    res.status(500).json({ error: "Internal server error" });
  }
};
