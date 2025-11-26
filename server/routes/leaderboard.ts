import { RequestHandler } from "express";
import type { LeaderboardResponse } from "../../shared/api.js";
import { db } from "../db.js";
import { teams, rooms, teamSolvedQuestions } from "../schema.js";
import { eq, sql } from "drizzle-orm";

export const handleLeaderboard: RequestHandler = async (req, res) => {
  console.log('handleLeaderboard called with query:', req.query);
  const roomCode = req.query.room as string;
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
        solvedQuestionsCount: sql<number>`COUNT(${teamSolvedQuestions.questionId})`.as("solved_count"),
      })
      .from(teams)
      .leftJoin(teamSolvedQuestions, eq(teams.teamId, teamSolvedQuestions.teamId))
      .where(eq(teams.roomCode, code))
      .groupBy(teams.teamId);

    console.log(`Found ${teamsWithSolvedCount.length} teams for room ${code}`);

    // Get solved question timestamps for all teams in this room
    const allSolvedQuestions = await db
      .select({
        teamId: teamSolvedQuestions.teamId,
        solvedAt: teamSolvedQuestions.solvedAt,
      })
      .from(teamSolvedQuestions)
      .innerJoin(teams, eq(teamSolvedQuestions.teamId, teams.teamId))
      .where(eq(teams.roomCode, code))
      .orderBy(teamSolvedQuestions.teamId, teamSolvedQuestions.solvedAt);

    console.log(`Found ${allSolvedQuestions.length} solved questions for room ${code}`);

    // Group solved questions by team and convert timestamps properly
    const solvedQuestionsByTeam: Record<string, Date[]> = {};
    for (const sq of allSolvedQuestions) {
      if (!solvedQuestionsByTeam[sq.teamId]) {
        solvedQuestionsByTeam[sq.teamId] = [];
      }

      // Handle timestamp conversion - database stores milliseconds but schema expects seconds
      let timestamp: Date;
      if (sq.solvedAt instanceof Date) {
        // Check if the Date object looks reasonable (not in far future)
        const timestampMs = sq.solvedAt.getTime();
        if (timestampMs > Date.now() + 365 * 24 * 60 * 60 * 1000) { // More than 1 year in future
          // Probably stored as milliseconds, convert to seconds first
          timestamp = new Date(timestampMs / 1000);
        } else {
          timestamp = sq.solvedAt;
        }
      } else if (typeof sq.solvedAt === 'number') {
        // If it's a large number, it's probably milliseconds
        if (sq.solvedAt > 1e12) { // Milliseconds timestamp
          timestamp = new Date(sq.solvedAt);
        } else { // Seconds timestamp
          timestamp = new Date(sq.solvedAt * 1000);
        }
      } else {
        console.warn(`Invalid solvedAt format for team ${sq.teamId}:`, sq.solvedAt);
        continue;
      }

      if (!isNaN(timestamp.getTime())) {
        solvedQuestionsByTeam[sq.teamId].push(timestamp);
      }
    }

    // Calculate leaderboard with proper time calculations
    const sortedTeams = teamsWithSolvedCount
      .map((item) => {
        // Calculate time based on first and last solved questions
        // Calculate time based on team start time
        let timeTakenMs = 0;
        const startTime = item.team.startTime;

        if (startTime && startTime.getTime() > 0) {
          const isCompleted = (item.team.endTime && item.team.endTime.getTime() > 0) || item.team.linesCompleted >= 5;
          if (isCompleted) {
            // If team has completed, use time from start to end
            const endTime = item.team.endTime && item.team.endTime.getTime() > 0
              ? item.team.endTime
              : new Date(); // Fallback if endTime missing but lines >= 5
            timeTakenMs = endTime.getTime() - startTime.getTime();
          } else {
            // Team is still active, show time from start to now
            timeTakenMs = Date.now() - startTime.getTime();
          }
        }

        return {
          team: {
            id: item.team.teamId,
            name: item.team.teamName,
            score: item.team.linesCompleted * 10, // points = lines * 10
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
      })
      .sort((a, b) => {
        // Sort by lines completed descending (higher score = better rank)
        if (b.linesCompleted !== a.linesCompleted) {
          return b.linesCompleted - a.linesCompleted;
        }
        // If same score, sort by time taken ascending (faster = better rank)
        return a.team.time_taken_ms - b.team.time_taken_ms;
      })
      .map((item, index) => ({
        team: item.team,
        rank: index + 1,
      }));

    const response: LeaderboardResponse = {
      rows: sortedTeams,
    };

    console.log(`Returning leaderboard with ${sortedTeams.length} teams`);
    res.json(response);
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleLeaderboardAll: RequestHandler = async (req, res) => {
  try {
    // Temporary simple response to test if route works
    res.json({
      DEMO: {
        rows: []
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};
