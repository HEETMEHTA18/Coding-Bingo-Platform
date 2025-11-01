import { db } from "../../server/db.ts";
import {
  rooms,
  questions as questionsTable,
  teams,
  teamSolvedQuestions,
  teamSolvedPositions,
  teamQuestionMapping,
  wipeAudits,
} from "../../server/schema.ts";
import { eq, inArray, sql } from "drizzle-orm";
import multer from "multer";

const upload = multer();

function parseCSVLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseCSV(csvData) {
  const lines = [];
  const rows = csvData.split("\n");
  let currentRow = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    for (let j = 0; j < row.length; j++) {
      const ch = row[j];

      if (ch === '"') {
        if (inQuotes && row[j + 1] === '"') {
          // Escaped quote
          currentField += '"';
          j++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        // Field separator
        currentRow.push(currentField.trim());
        currentField = "";
      } else {
        currentField += ch;
      }
    }

    // Check if we're still in quotes (multiline field)
    if (inQuotes) {
      // Continue to next row, don't finish the current row yet
      continue;
    } else {
      // Finish current row
      currentRow.push(currentField.trim());
      currentField = "";
      if (currentRow.length > 0) {
        lines.push(currentRow);
      }
      currentRow = [];
    }
  }

  // Handle any remaining field if file ends with quoted field
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.length > 0) {
      lines.push(currentRow);
    }
  }

  return lines;
}

const handleAdminState = async (req, res) => {
  const roomCode = req.query.room || req.body?.room;
  if (!roomCode) return res.status(400).json({ error: "Room code required" });
  try {
    console.log('handleAdminState - fetching room:', roomCode, 'DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
    const code = roomCode.toUpperCase();
    const [room] = await db.select().from(rooms).where(eq(rooms.code, code));

    // Optimize queries by selecting only needed columns to reduce payload and query time
    const questionsResult = await db
      .select({
        questionId: questionsTable.questionId,
        questionText: questionsTable.questionText,
        isReal: questionsTable.isReal,
      })
      .from(questionsTable)
      .where(eq(questionsTable.roomCode, code));

    const teamsResult = await db
      .select({
        teamId: teams.teamId,
        teamName: teams.teamName,
        linesCompleted: teams.linesCompleted,
      })
      .from(teams)
      .where(eq(teams.roomCode, code));

    const response = {
      room: room
        ? {
            code: room.code,
            title: room.title,
            roundEndAt: room.roundEndAt?.toISOString() || null,
          }
        : null,
      questions: questionsResult.map((q) => ({
        id: String(q.questionId),
        text: q.questionText,
        is_real: q.isReal,
      })),
      teams: teamsResult.map((t) => ({
        id: t.teamId,
        name: t.teamName,
        lines_completed: t.linesCompleted,
      })),
      currentQuestionIndex: 0,
      gameStarted: false,
      gameEnded: false,
      timeRemaining: 0,
    };
    res.json(response);
  } catch (err) {
    console.error('handleAdminState error:', {
      error: err,
      message: err?.message,
      code: err?.code,
      roomCode
    });
    res.status(500).json({ error: "Internal server error", details: err?.message });
  }
};

const handleCreateRoom = async (req, res) => {
  const body = req.body;
  if (!body?.code) return res.status(400).json({ error: "code required" });
  const code = body.code.toUpperCase();
  try {
    const existing = await db.select().from(rooms).where(eq(rooms.code, code));
    if (existing.length > 0)
      return res.status(400).json({ error: "Room already exists" });
    await db.insert(rooms).values({
      code,
      title: body.title ?? null,
      roundEndAt: body.durationMinutes
        ? new Date(Date.now() + body.durationMinutes * 60 * 1000)
        : null,
    });
    res.json({ success: true });
  } catch (err) {
    console.error('handleCreateRoom error:', {
      error: err,
      message: err?.message,
      code: err?.code,
      body
    });
    res.status(500).json({ error: "Internal server error", details: err?.message });
  }
};

const handleStartGame = async (req, res) => {
  const { minutes } = req.body;
  const roomCode = req.body?.room || req.query.room;
  if (!roomCode || !minutes || typeof minutes !== "number" || minutes <= 0)
    return res.status(400).json({ error: "room and valid minutes required" });
  try {
    const code = roomCode.toUpperCase();
    const roomResult = await db
      .select()
      .from(rooms)
      .where(eq(rooms.code, code));
    if (roomResult.length === 0)
      return res.status(404).json({ error: "Room not found" });
    const endTime = new Date(Date.now() + minutes * 60 * 1000);
    await db
      .update(rooms)
      .set({ roundEndAt: endTime })
      .where(eq(rooms.code, code));
    res.json({ success: true, endTime: endTime.toISOString() });
  } catch (err) {
    console.error("handleStartGame", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

const handleExtendTimer = async (req, res) => {
  const { minutes } = req.body;
  const roomCode = req.body?.room || req.query.room;
  if (!roomCode || !minutes || typeof minutes !== "number" || minutes <= 0)
    return res.status(400).json({ error: "room and valid minutes required" });
  try {
    const code = roomCode.toUpperCase();
    const roomResult = await db
      .select()
      .from(rooms)
      .where(eq(rooms.code, code));
    if (roomResult.length === 0)
      return res.status(404).json({ error: "Room not found" });
    const currentRoom = roomResult[0];
    let newEndTime;
    if (currentRoom.roundEndAt && currentRoom.roundEndAt > new Date())
      newEndTime = new Date(
        currentRoom.roundEndAt.getTime() + minutes * 60 * 1000,
      );
    else newEndTime = new Date(Date.now() + minutes * 60 * 1000);
    await db
      .update(rooms)
      .set({ roundEndAt: newEndTime })
      .where(eq(rooms.code, code));
    res.json({ success: true, endTime: newEndTime.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

const handleForceEnd = async (req, res) => {
  const roomCode = req.body?.room || req.query.room;
  if (!roomCode) return res.status(400).json({ error: "room required" });
  try {
    const code = roomCode.toUpperCase();
    const roomResult = await db
      .select()
      .from(rooms)
      .where(eq(rooms.code, code));
    if (roomResult.length === 0)
      return res.status(404).json({ error: "Room not found" });
    const endTime = new Date();
    await db
      .update(rooms)
      .set({ roundEndAt: endTime })
      .where(eq(rooms.code, code));
    res.json({ success: true, endTime: endTime.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

const handleAddQuestion = async (req, res) => {
  const body = req.body;
  if (!body?.room || !body?.question)
    return res.status(400).json({ error: "room and question required" });
  try {
    const code = body.room.toUpperCase();
    const roomResult = await db
      .select()
      .from(rooms)
      .where(eq(rooms.code, code));
    if (roomResult.length === 0)
      return res.status(404).json({ error: "Room not found" });
    const result = await db
      .insert(questionsTable)
      .values({
        roomCode: code,
        questionText: body.question.text,
        isReal: true,
        correctAnswer: String(body.question.correctAnswer),
      })
      .returning();
    const newQuestion = {
      id: String(result[0].questionId),
      text: body.question.text,
      options: body.question.options ?? [],
      correctAnswer: body.question.correctAnswer,
      points: body.question.points ?? 0,
    };
    res.json({ success: true, question: newQuestion });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

const handleDeleteQuestion = async (req, res) => {
  const body = req.body;
  if (!body || !body.questionId || !body.room)
    return res.status(400).json({ error: "room and questionId required" });
  const questionIdInt = parseInt(String(body.questionId), 10);
  if (Number.isNaN(questionIdInt))
    return res.status(400).json({ error: "Invalid questionId" });
  try {
    await db
      .delete(questionsTable)
      .where(eq(questionsTable.questionId, questionIdInt));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

const handleUploadQuestions = async (req, res) => {
  try {
    const room = req.body.room;
    const file = req.file;
    console.log("Upload request:", { room, file: file ? { name: file.originalname, size: file.size } : null });

    if (!room) {
      console.log("No room code provided");
      return res.status(400).json({ error: "Room code required" });
    }
    if (!file || !file.buffer) {
      console.log("No file provided or file buffer missing");
      return res.status(400).json({ error: "File is required" });
    }

    const code = room.toUpperCase();
    console.log("Checking room:", code);

    const roomResult = await db
      .select()
      .from(rooms)
      .where(eq(rooms.code, code));

    console.log("Room result:", roomResult.length > 0 ? "found" : "not found");

    if (roomResult.length === 0)
      return res.status(404).json({ error: "Room not found" });

    const csvData = file.buffer.toString("utf-8");
    console.log("CSV data length:", csvData.length);

    // Parse CSV properly handling multiline fields
    const lines = parseCSV(csvData);
    console.log("Parsed CSV lines:", lines.length);

    if (lines.length < 2)
      return res.status(400).json({
        error: "CSV must have at least a header row and one data row",
      });

    const headers = lines[0].map((h) => h.toLowerCase().trim());
    console.log("CSV headers:", headers);

    // Create a map for faster column lookup
    const headerMap = new Map();
    headers.forEach((header, index) => headerMap.set(header, index));

    // Optimized column detection using map lookup
    const getColumnIndex = (possibleNames) => {
      for (const name of possibleNames) {
        const index = headerMap.get(name.toLowerCase().trim());
        if (index !== undefined) return index;
      }
      return -1;
    };

    const questionTextIndex = getColumnIndex(['question_text', 'code', 'question_code']);
    const correctAnswerIndex = getColumnIndex(['correct_answer', 'answer', 'expected_output']);
    const questionTitleIndex = headerMap.get('question_title') ?? -1;

    console.log("Column indices:", { questionTextIndex, correctAnswerIndex });

    if (questionTextIndex === -1 || correctAnswerIndex === -1)
      return res.status(400).json({ error: "CSV missing required columns. Expected 'question_text', 'code', or 'question_code' for questions and 'correct_answer', 'answer', or 'expected_output' for answers" });

    const questionsToInsert = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i];
      if (values.length <= Math.max(questionTextIndex, correctAnswerIndex))
        continue;

      const rawQuestionText = values[questionTextIndex]?.trim();
      const correctAnswer = values[correctAnswerIndex]?.trim();

      if (!rawQuestionText || !correctAnswer) continue;

      let questionText = rawQuestionText;

      // Optimized code detection - check for common code patterns more efficiently
      const looksLikeCode = (s) => {
        if (!s || s.length < 10) return false;
        return s.includes("#") || s.includes("int ") || s.includes("printf") ||
               s.includes(";") || s.includes("{") || s.includes("}\n") ||
               s.includes("\n") || /^\d+$/.test(s);
      };

      if (!looksLikeCode(questionText)) {
        const title = questionTitleIndex !== -1 ? values[questionTitleIndex]?.trim() : undefined;
        if (title && title.length > questionText.length) {
          questionText = title;
        }
      }

      questionsToInsert.push({
        roomCode: code,
        questionText,
        isReal: true,
        correctAnswer,
      });
    }

    console.log("Questions to insert:", questionsToInsert.length);

    if (questionsToInsert.length === 0)
      return res
        .status(400)
        .json({ error: "No valid questions found in CSV. Check that columns contain data and are properly formatted." });

    await db.insert(questionsTable).values(questionsToInsert);
    res.json({ success: true, importedCount: questionsToInsert.length });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

const handleWipeUserData = async (req, res) => {
  try {
    const body = (req.body || {});
    const confirm = String(body.confirm || "").trim();
    const adminSecretHeader = String(req.header("x-admin-secret") || "");
    const envSecret = process.env.ADMIN_SECRET || "";
    if (
      confirm !== "WIPE" ||
      (!envSecret &&
        process.env.NODE_ENV !== "development" &&
        !adminSecretHeader)
    ) {
      return res
        .status(400)
        .json({ error: "Confirmation 'WIPE' and admin secret required" });
    }
    if (envSecret && adminSecretHeader !== envSecret)
      return res.status(403).json({ error: "Invalid admin secret" });

    const preserveRooms = Array.isArray(body.preserveRooms)
      ? body.preserveRooms.map(String)
      : [];
    const purgeRooms = !!body.purgeRooms;
    const purgeQuestions = !!body.purgeQuestions;
    const softDelete = !!body.softDelete;
    const initiatedBy = String(
      body.initiatedBy || req.header("x-initiated-by") || "admin",
    );

    const deleted = {};
    const auditOptions = {
      preserveRooms,
      purgeRooms,
      purgeQuestions,
      softDelete,
    };

    // Use Drizzle ORM transaction
    await db.transaction(async (tx) => {
      if (softDelete) {
        // Soft delete: mark as deleted instead of removing
        const r1 = await tx.update(teamSolvedPositions).set({ isDeleted: true });
        deleted.team_solved_positions = 1; // Drizzle doesn't return affected rows count

        const r2 = await tx.update(teamSolvedQuestions).set({ isDeleted: true });
        deleted.team_solved_questions = 1;

        const r3 = await tx.update(teamQuestionMapping).set({ isDeleted: true });
        deleted.team_question_mapping = 1;

        if (preserveRooms.length > 0) {
          // Get teams not in preserved rooms
          const teamsAll = await tx
            .select({ teamId: teams.teamId, roomCode: teams.roomCode })
            .from(teams);

          const teamIdsToMark = teamsAll
            .filter(
              (t) =>
                !preserveRooms
                  .map((r) => r.toUpperCase())
                  .includes(String(t.roomCode).toUpperCase()),
            )
            .map((t) => t.teamId);

          if (teamIdsToMark.length > 0) {
            await tx
              .update(teams)
              .set({ isDeleted: true })
              .where(inArray(teams.teamId, teamIdsToMark));
            deleted.teams = teamIdsToMark.length;
          } else {
            deleted.teams = 0;
          }
        } else {
          await tx.update(teams).set({ isDeleted: true });
          deleted.teams = 1; // Approximate count
        }
      } else {
        if (!purgeQuestions) {
          // Hard delete team data but keep questions
          await tx.delete(teamSolvedPositions);
          deleted.team_solved_positions = 1;

          await tx.delete(teamSolvedQuestions);
          deleted.team_solved_questions = 1;

          await tx.delete(teamQuestionMapping);
          deleted.team_question_mapping = 1;

          if (preserveRooms.length > 0) {
            // Get teams not in preserved rooms
            const teamsAll = await tx
              .select({ teamId: teams.teamId, roomCode: teams.roomCode })
              .from(teams);

            const teamIdsToDelete = teamsAll
              .filter(
                (t) =>
                  !preserveRooms
                    .map((r) => r.toUpperCase())
                    .includes(String(t.roomCode).toUpperCase()),
              )
              .map((t) => t.teamId);

            if (teamIdsToDelete.length > 0) {
              await tx.delete(teams).where(inArray(teams.teamId, teamIdsToDelete));
              deleted.teams = teamIdsToDelete.length;
            } else {
              deleted.teams = 0;
            }
          } else {
            await tx.delete(teams);
            deleted.teams = 1; // Approximate count
          }
        } else {
          // Hard delete everything including questions
          await tx.delete(teamSolvedPositions);
          deleted.team_solved_positions = 1;

          await tx.delete(teamSolvedQuestions);
          deleted.team_solved_questions = 1;

          await tx.delete(teamQuestionMapping);
          deleted.team_question_mapping = 1;

          await tx.delete(teams);
          deleted.teams = 1;

          await tx.delete(questionsTable);
          deleted.questions = 1;

          if (purgeRooms) {
            await tx.delete(rooms);
            deleted.rooms = 1;
          }
        }
      }

      // Insert audit record
      try {
        await tx.insert(wipeAudits).values({
          initiatedBy,
          initiatedAt: new Date(),
          options: JSON.stringify(auditOptions),
          deletedCounts: JSON.stringify(deleted),
        });
      } catch (err) {
        console.error("Failed to insert wipe audit", err);
      }
    });

    res.json({ success: true, deleted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export default async (req, res) => {
  const { slug } = req.query;
  const path = Array.isArray(slug) ? slug[0] : slug || "";

  console.log("Admin API request:", req.method, req.url, "slug:", slug, "path:", path);
  console.log("Environment check:", {
    DATABASE_URL: process.env.DATABASE_URL ? "SET" : "NOT SET",
    NODE_ENV: process.env.NODE_ENV
  });

  try {
    switch (path) {
      case "state":
        await handleAdminState(req, res);
        break;
      case "create-room":
        await handleCreateRoom(req, res);
        break;
      case "start":
        await handleStartGame(req, res);
        break;
      case "extend-timer":
        await handleExtendTimer(req, res);
        break;
      case "force-end":
        await handleForceEnd(req, res);
        break;
      case "add-question":
        await handleAddQuestion(req, res);
        break;
      case "delete-question":
        await handleDeleteQuestion(req, res);
        break;
      case "upload-questions":
        // Handle file upload with multer
        const multerUpload = multer({ storage: multer.memoryStorage() });
        multerUpload.single("file")(req, res, async (err) => {
          if (err) {
            console.error("Multer error:", err);
            return res.status(400).json({ error: "File upload error" });
          }
          await handleUploadQuestions(req, res);
        });
        break;
      case "wipe":
        await handleWipeUserData(req, res);
        break;
      default:
        console.log("Unknown admin path:", path);
        res.status(404).json({ error: "Admin endpoint not found" });
    }
  } catch (error) {
    console.error("Admin API error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal server error",
        message: error.message
      });
    }
  }
};