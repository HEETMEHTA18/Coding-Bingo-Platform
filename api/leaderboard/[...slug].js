import { db } from "../../server/db.js";
import { teams, rooms, teamSolvedQuestions } from "../../server/schema.js";
import { eq, sql } from "drizzle-orm";

const handleLeaderboard = async (req, res) => {
  console.log('handleLeaderboard called with query:', req.query);
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
    const solvedQuestionsByTeam = {};
    for (const sq of allSolvedQuestions) {
      if (!solvedQuestionsByTeam[sq.teamId]) {
        solvedQuestionsByTeam[sq.teamId] = [];
      }

      // Handle timestamp conversion - database stores milliseconds but schema expects seconds
      let timestamp;
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
        let timeTakenMs = 0;
        const teamSolvedQuestions = solvedQuestionsByTeam[item.team.teamId] || [];

        if (teamSolvedQuestions.length > 0) {
          // Filter out invalid dates
          const validQuestions = teamSolvedQuestions.filter(q => q && !isNaN(q.getTime()));

          if (validQuestions.length > 0) {
            const firstSolve = validQuestions[0];
            const lastSolve = validQuestions[validQuestions.length - 1];

            // If team has completed (has endTime or is a winner), use time from first to last question
            // If team is still playing, use time from first question to now
            const isCompleted = (item.team.endTime && item.team.endTime.getTime() > 0) || item.team.linesCompleted >= 5;
            if (isCompleted) {
              timeTakenMs = lastSolve.getTime() - firstSolve.getTime();
            } else {
              // Team is still active, show time from first question to now
              timeTakenMs = Date.now() - firstSolve.getTime();
            }
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

    const response = {
      rows: sortedTeams,
    };

    console.log(`Returning leaderboard with ${sortedTeams.length} teams`);
    res.json(response);
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const handleLeaderboardAll = async (req, res) => {
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

export default async (req, res) => {
  const { slug } = req.query;
  const path = Array.isArray(slug) ? slug[0] : slug || "";

  console.log("Leaderboard API request:", req.method, req.url, "slug:", slug, "path:", path);
  console.log("Environment check:", {
    DATABASE_URL: process.env.DATABASE_URL ? "SET" : "NOT SET",
    NODE_ENV: process.env.NODE_ENV
  });

  try {
    switch (path) {
      case "":
        await handleLeaderboard(req, res);
        break;
      case "all":
        await handleLeaderboardAll(req, res);
        break;
      default:
        console.log("Unknown leaderboard path:", path);
        res.status(404).json({ error: "Leaderboard endpoint not found" });
    }
  } catch (error) {
    console.error("Leaderboard API error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal server error",
        message: error.message
      });
    }
  }
};