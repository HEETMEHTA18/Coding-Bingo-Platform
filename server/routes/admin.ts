import { RequestHandler } from "express";
import multer from "multer";
import type {
  AdminStateResponse,
  AdminCreateRoomRequest,
  AdminAddQuestionRequest,
  AdminDeleteQuestionRequest,
  Question,
} from "../../shared/api.js";
import { db } from "../db.js";
import {
  rooms,
  questions as questionsTable,
  teams,
  teamSolvedQuestions,
  teamSolvedPositions,
  teamQuestionMapping,
  wipeAudits,
  submissionAttempts,
  gameBoards,
  gameMoves,
} from "../schema.js";
import { eq, inArray, sql } from "drizzle-orm";

const upload = multer();

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
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

function parseCSV(csvData: string): string[][] {
  const lines: string[][] = [];
  const rows = csvData.split("\n");
  let currentRow: string[] = [];
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

export const handleAdminState: RequestHandler = async (req, res) => {
  const roomCode = (req.query.room as string) || (req.body?.room as string);
  if (!roomCode) return res.status(400).json({ error: "Room code required" });
  try {
    const code = roomCode.toUpperCase();
    const [room] = await db.select().from(rooms).where(eq(rooms.code, code));

    // Optimize queries by selecting only needed columns to reduce payload and query time
    const questionsResult = await db
      .select({
        questionId: questionsTable.questionId,
        questionText: questionsTable.questionText,
        correctAnswer: questionsTable.correctAnswer,
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

    const response: AdminStateResponse = {
      room: room
        ? {
          code: room.code,
          title: room.title,
          roundEndAt: room.roundEndAt?.toISOString() || null,
        }
        : null,
      questions: questionsResult.map((q: any) => ({
        id: String(q.questionId),
        question_id: q.questionId,
        text: q.questionText,
        question_text: q.questionText,
        correct_answer: q.correctAnswer,
        is_real: q.isReal,
      })) as any,
      teams: teamsResult.map((t: any) => ({
        id: t.teamId,
        name: t.teamName,
        lines_completed: t.linesCompleted,
      })) as any,
      currentQuestionIndex: 0,
      gameStarted: false,
      gameEnded: false,
      timeRemaining: 0,
    };
    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleCreateRoom: RequestHandler = async (req, res) => {
  const body: AdminCreateRoomRequest = req.body;
  if (!body?.code) return res.status(400).json({ error: "code required" });
  const code = body.code.toUpperCase();
  try {
    const existing = await db.select().from(rooms).where(eq(rooms.code, code));
    if (existing.length > 0)
      return res.status(400).json({ error: "Room already exists" });
    await db.insert(rooms).values({
      code,
      title: body.title ?? null,
      gameType: body.gameType || 'bingo',
      roundEndAt: body.durationMinutes
        ? new Date(Date.now() + body.durationMinutes * 60 * 1000)
        : null,
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleStartGame: RequestHandler = async (req, res) => {
  const { minutes } = req.body;
  const roomCode = (req.body?.room as string) || (req.query.room as string);
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

export const handleExtendTimer: RequestHandler = async (req, res) => {
  const { minutes } = req.body;
  const roomCode = (req.body?.room as string) || (req.query.room as string);
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
    let newEndTime: Date;
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

export const handleForceEnd: RequestHandler = async (req, res) => {
  const roomCode = (req.body?.room as string) || (req.query.room as string);
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

export const handleAddQuestion: RequestHandler = async (req, res) => {
  const body: AdminAddQuestionRequest = req.body;
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
        isReal: body.question.isReal ?? true,
        correctAnswer: String(body.question.correctAnswer),
      })
      .returning();
    const newQuestion: Question = {
      id: String(result[0].questionId),
      text: body.question.text,
      options: body.question.options ?? [],
      correctAnswer: body.question.correctAnswer,
      points: body.question.points ?? 0,
    } as any;
    res.json({ success: true, question: newQuestion });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleDeleteQuestion: RequestHandler = async (req, res) => {
  const body: AdminDeleteQuestionRequest = req.body;
  console.log('Delete question request:', body);

  if (!body || !body.questionId || !body.room) {
    console.log('Missing required fields:', { hasBody: !!body, hasQuestionId: !!body?.questionId, hasRoom: !!body?.room });
    return res.status(400).json({ error: "room and questionId required" });
  }

  const questionIdInt = parseInt(String(body.questionId), 10);
  console.log('Parsed question ID:', questionIdInt);

  if (Number.isNaN(questionIdInt)) {
    console.log('Invalid question ID format');
    return res.status(400).json({ error: "Invalid questionId" });
  }

  try {
    // Delete dependent records first to avoid foreign key constraint violations
    // 1. Delete from teamQuestionMapping
    await db
      .delete(teamQuestionMapping)
      .where(eq(teamQuestionMapping.questionId, questionIdInt));

    // 2. Delete from teamSolvedQuestions
    await db
      .delete(teamSolvedQuestions)
      .where(eq(teamSolvedQuestions.questionId, questionIdInt));

    // 3. Delete from submissionAttempts
    await db
      .delete(submissionAttempts)
      .where(eq(submissionAttempts.questionId, questionIdInt));

    // 4. Finally delete the question
    await db
      .delete(questionsTable)
      .where(eq(questionsTable.questionId, questionIdInt));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleUploadQuestions = [
  upload.single("file"),
  async (req: any, res: any) => {
    try {
      const room = req.body.room as string;
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
      const headerMap = new Map<string, number>();
      headers.forEach((header, index) => headerMap.set(header, index));

      // Optimized column detection using map lookup
      const getColumnIndex = (possibleNames: string[]): number => {
        for (const name of possibleNames) {
          const index = headerMap.get(name.toLowerCase().trim());
          if (index !== undefined) return index;
        }
        return -1;
      };

      const questionTextIndex = getColumnIndex(['question_text', 'code', 'question_code']);
      const correctAnswerIndex = getColumnIndex(['correct_answer', 'answer', 'expected_output']);
      const questionTitleIndex = headerMap.get('question_title') ?? -1;
      const isRealIndex = getColumnIndex(['is_real', 'isreal', 'real', 'is_fake', 'fake']);

      console.log("Column indices:", { questionTextIndex, correctAnswerIndex, isRealIndex });

      if (questionTextIndex === -1 || correctAnswerIndex === -1)
        return res.status(400).json({ error: "CSV missing required columns. Expected 'question_text', 'code', or 'question_code' for questions and 'correct_answer', 'answer', or 'expected_output' for answers" });

      const questionsToInsert: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i];
        if (values.length <= Math.max(questionTextIndex, correctAnswerIndex))
          continue;

        const rawQuestionText = values[questionTextIndex]?.trim();
        const correctAnswer = values[correctAnswerIndex]?.trim();

        if (!rawQuestionText || !correctAnswer) continue;

        // Determine if question is real or fake
        let isReal = true;
        if (isRealIndex !== -1) {
          const isRealValue = values[isRealIndex]?.toLowerCase().trim();
          // Check for fake/false values
          if (isRealValue === 'false' || isRealValue === '0' || isRealValue === 'fake' || isRealValue === 'no') {
            isReal = false;
          }
          // Check for real/true values (explicit)
          else if (isRealValue === 'true' || isRealValue === '1' || isRealValue === 'real' || isRealValue === 'yes') {
            isReal = true;
          }
        }

        let questionText = rawQuestionText;

        // Preserve code formatting - detect if it's code and format it properly
        const looksLikeCode = (s: string) => {
          if (!s || s.length < 10) return false;
          return s.includes("#") || s.includes("int ") || s.includes("printf") ||
            s.includes(";") || s.includes("{") || s.includes("}") ||
            s.includes("\n") || /^\d+$/.test(s);
        };

        // If it looks like code, preserve/restore formatting
        if (looksLikeCode(questionText)) {
          // Replace escaped newlines with actual newlines
          questionText = questionText
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '  '); // Convert tabs to 2 spaces

          // If the code has line numbers at the start of lines, preserve them
          // Otherwise, ensure proper indentation is maintained
          const lines = questionText.split('\n');
          questionText = lines.map(line => line.trimEnd()).join('\n').trim();
        } else {
          // For non-code, try to find better question text from title column
          const title = questionTitleIndex !== -1 ? values[questionTitleIndex]?.trim() : undefined;
          if (title && title.length > questionText.length) {
            questionText = title;
          }
        }

        questionsToInsert.push({
          roomCode: code,
          questionText,
          isReal: isReal,
          correctAnswer,
        });
      }

      console.log("Questions to insert:", questionsToInsert.length);

      if (questionsToInsert.length === 0)
        return res
          .status(400)
          .json({ error: "No valid questions found in CSV. Check that columns contain data and are properly formatted." });

      // Handle random fake question selection if numRandomFake is specified
      const numRandomFake = parseInt(req.body.numRandomFake || '0', 10);
      if (numRandomFake > 0 && numRandomFake <= questionsToInsert.length) {
        // Randomly select indices to mark as fake
        const totalQuestions = questionsToInsert.length;
        const indices = Array.from({ length: totalQuestions }, (_, i) => i);

        // Shuffle indices using Fisher-Yates algorithm
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }

        // Mark first numRandomFake questions as fake
        const fakeIndices = new Set(indices.slice(0, numRandomFake));
        questionsToInsert.forEach((q, idx) => {
          if (fakeIndices.has(idx)) {
            q.isReal = false;
          }
        });

        console.log(`Marked ${numRandomFake} random questions as fake out of ${totalQuestions} total`);
      }

      await db.insert(questionsTable).values(questionsToInsert);
      res.json({ success: true, importedCount: questionsToInsert.length });
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
];

export const handleWipeUserData: RequestHandler = async (req, res) => {
  try {
    const body = (req.body || {}) as any;
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

    const preserveRooms: string[] = Array.isArray(body.preserveRooms)
      ? body.preserveRooms.map(String)
      : [];
    const purgeRooms = !!body.purgeRooms;
    const purgeQuestions = !!body.purgeQuestions;
    const softDelete = !!body.softDelete;
    const initiatedBy = String(
      body.initiatedBy || req.header("x-initiated-by") || "admin",
    );

    const deleted: Record<string, number> = {};
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
                  .map((r: string) => r.toUpperCase())
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
                    .map((r: string) => r.toUpperCase())
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

// Generate random fake questions
export const handleGenerateFakeQuestions: RequestHandler = async (req, res) => {
  try {
    const { room, count } = req.body;

    if (!room || typeof room !== "string" || count <= 0) {
      res.status(400).json({ error: "Invalid room or count" });
      return;
    }

    const roomCode = room.toUpperCase();
    const fakeCount = Math.min(count, 100); // Limit to 100 max

    // Array of coding concepts for fake questions
    const concepts = [
      "What does DRY stand for?",
      "Explain the Single Responsibility Principle",
      "What is polymorphism?",
      "Define encapsulation",
      "What is a pure function?",
      "Explain middleware in Express",
      "What is async/await?",
      "Define dependency injection",
      "What is SOLID?",
      "Explain REST API",
      "What is GraphQL?",
      "Define closure in JavaScript",
      "What is hoisting?",
      "Explain prototype chain",
      "What is memoization?",
      "Define currying",
      "What is composition?",
      "Explain destructuring",
      "What are generators?",
      "Define promises",
      "What is event delegation?",
      "Explain debouncing",
      "What is throttling?",
      "Define scoping",
      "What is higher-order function?",
      "Explain tree shaking",
      "What is lazy loading?",
      "Define caching strategy",
      "What is tokenization?",
      "Explain JWT",
    ];

    let generatedCount = 0;
    for (let i = 0; i < fakeCount; i++) {
      const concept = concepts[i % concepts.length];
      const randomSuffix = Math.random().toString(36).substring(7);
      try {
        await db.insert(questionsTable).values({
          roomCode,
          questionText: `${concept} (Variant ${randomSuffix})`,
          correctAnswer: "0",
          isReal: false,
        });
        generatedCount++;
      } catch (err) {
        console.error("Error inserting fake question:", err);
      }
    }

    res.json({ success: true, generatedCount });
  } catch (err) {
    console.error("Error generating fake questions:", err);
    res.status(500).json({ error: "Failed to generate fake questions" });
  }
};

// Delete questions by type (real or fake)
export const handleDeleteQuestionsByType: RequestHandler = async (req, res) => {
  try {
    const { room, type } = req.body;

    if (!room || !type || !["real", "fake"].includes(type)) {
      res.status(400).json({ error: "Invalid room or type" });
      return;
    }

    const roomCode = room.toUpperCase();
    const isReal = type === "real";

    // Delete questions of specified type
    const questionsToDelete = await db
      .select({ id: questionsTable.questionId })
      .from(questionsTable)
      .where(
        sql`${questionsTable.roomCode} = ${roomCode} AND ${questionsTable.isReal} = ${isReal}`,
      );

    let deletedCount = 0;
    if (questionsToDelete.length > 0) {
      const ids = questionsToDelete.map((q) => q.id);

      // Delete dependent records first to avoid foreign key constraint violations
      // 1. Delete from teamQuestionMapping
      await db
        .delete(teamQuestionMapping)
        .where(inArray(teamQuestionMapping.questionId, ids));

      // 2. Delete from teamSolvedQuestions
      await db
        .delete(teamSolvedQuestions)
        .where(inArray(teamSolvedQuestions.questionId, ids));

      // 3. Delete from submissionAttempts
      await db
        .delete(submissionAttempts)
        .where(inArray(submissionAttempts.questionId, ids));

      // 4. Finally delete the questions
      await db
        .delete(questionsTable)
        .where(inArray(questionsTable.questionId, ids));
      deletedCount = ids.length;
    }

    res.json({
      success: true,
      deletedCount,
      type,
    });
  } catch (err) {
    console.error("Error deleting questions by type:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleDeleteTeam: RequestHandler = async (req, res) => {
  try {
    const { room, teamId } = req.body;
    if (!room || !teamId) {
      res.status(400).json({ error: "Room and teamId required" });
      return;
    }

    // Delete cascading data
    await db.delete(teamSolvedPositions).where(eq(teamSolvedPositions.teamId, teamId));
    await db.delete(teamSolvedQuestions).where(eq(teamSolvedQuestions.teamId, teamId));
    await db.delete(teamQuestionMapping).where(eq(teamQuestionMapping.teamId, teamId));
    await db.delete(submissionAttempts).where(eq(submissionAttempts.teamId, teamId));
    await db.delete(gameMoves).where(eq(gameMoves.teamId, teamId));
    await db.delete(gameBoards).where(eq(gameBoards.teamId, teamId));

    // Finally delete team
    await db.delete(teams).where(eq(teams.teamId, teamId));

    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting team:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleDeleteAllTeams: RequestHandler = async (req, res) => {
  try {
    const { room } = req.body;
    if (!room) {
      res.status(400).json({ error: "Room required" });
      return;
    }
    const code = room.toUpperCase();

    // Get all teams in room
    const teamsInRoom = await db.select().from(teams).where(eq(teams.roomCode, code));
    const teamIds = teamsInRoom.map((t) => t.teamId);

    if (teamIds.length > 0) {
      await db.delete(teamSolvedPositions).where(inArray(teamSolvedPositions.teamId, teamIds));
      await db.delete(teamSolvedQuestions).where(inArray(teamSolvedQuestions.teamId, teamIds));
      await db.delete(teamQuestionMapping).where(inArray(teamQuestionMapping.teamId, teamIds));
      await db.delete(submissionAttempts).where(inArray(submissionAttempts.teamId, teamIds));
      await db.delete(gameMoves).where(inArray(gameMoves.teamId, teamIds));
      await db.delete(gameBoards).where(inArray(gameBoards.teamId, teamIds));
      await db.delete(teams).where(inArray(teams.teamId, teamIds));
    }

    res.json({ success: true, count: teamIds.length });
  } catch (err) {
    console.error("Error deleting all teams:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};


// Delete all questions in a room
export const handleDeleteAllQuestions: RequestHandler = async (req, res) => {
  try {
    const { room } = req.body;

    if (!room || typeof room !== "string") {
      res.status(400).json({ error: "Invalid room" });
      return;
    }

    const roomCode = room.toUpperCase();

    // Get count before delete
    const questionsToDelete = await db
      .select({ id: questionsTable.questionId })
      .from(questionsTable)
      .where(eq(questionsTable.roomCode, roomCode));

    let deletedCount = 0;
    if (questionsToDelete.length > 0) {
      const ids = questionsToDelete.map((q) => q.id);

      // Delete dependent records first to avoid foreign key constraint violations
      // 1. Delete from teamQuestionMapping
      await db
        .delete(teamQuestionMapping)
        .where(inArray(teamQuestionMapping.questionId, ids));

      // 2. Delete from teamSolvedQuestions
      await db
        .delete(teamSolvedQuestions)
        .where(inArray(teamSolvedQuestions.questionId, ids));

      // 3. Delete from submissionAttempts
      await db
        .delete(submissionAttempts)
        .where(inArray(submissionAttempts.questionId, ids));

      // 4. Finally delete the questions
      await db
        .delete(questionsTable)
        .where(inArray(questionsTable.questionId, ids));
      deletedCount = ids.length;
    }

    res.json({
      success: true,
      deletedCount,
    });
  } catch (err) {
    console.error("Error deleting all questions:", err);
    res.status(500).json({ error: "Failed to delete all questions" });
  }
};

export const handleListRooms: RequestHandler = async (req, res) => {
  try {
    const allRooms = await db.select().from(rooms);

    // Get counts for each room
    const roomsWithCounts = await Promise.all(allRooms.map(async (room) => {
      const qCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(questionsTable)
        .where(eq(questionsTable.roomCode, room.code));

      const tCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(teams)
        .where(eq(teams.roomCode, room.code));

      return {
        ...room,
        questionCount: Number(qCount[0].count),
        teamCount: Number(tCount[0].count),
      };
    }));

    res.json({ rooms: roomsWithCounts });
  } catch (err) {
    console.error("Error listing rooms:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleDeleteRoom: RequestHandler = async (req, res) => {
  try {
    const { room } = req.body;
    if (!room) {
      res.status(400).json({ error: "Room code required" });
      return;
    }
    const code = room.toUpperCase();

    // Delete everything related to this room
    // 1. Get all teams to delete their related data
    const teamsInRoom = await db.select().from(teams).where(eq(teams.roomCode, code));
    const teamIds = teamsInRoom.map(t => t.teamId);

    if (teamIds.length > 0) {
      await db.delete(teamSolvedPositions).where(inArray(teamSolvedPositions.teamId, teamIds));
      await db.delete(teamSolvedQuestions).where(inArray(teamSolvedQuestions.teamId, teamIds));
      await db.delete(teamQuestionMapping).where(inArray(teamQuestionMapping.teamId, teamIds));
      await db.delete(submissionAttempts).where(inArray(submissionAttempts.teamId, teamIds));
      await db.delete(gameMoves).where(inArray(gameMoves.teamId, teamIds));
      await db.delete(gameBoards).where(inArray(gameBoards.teamId, teamIds));
      await db.delete(teams).where(inArray(teams.teamId, teamIds));
    }

    // 2. Delete questions
    await db.delete(questionsTable).where(eq(questionsTable.roomCode, code));

    // 3. Delete room
    await db.delete(rooms).where(eq(rooms.code, code));

    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting room:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleDeleteAllRooms: RequestHandler = async (req, res) => {
  try {
    // Delete EVERYTHING
    await db.delete(teamSolvedPositions);
    await db.delete(teamSolvedQuestions);
    await db.delete(teamQuestionMapping);
    await db.delete(submissionAttempts);
    await db.delete(gameMoves);
    await db.delete(gameBoards);
    await db.delete(teams);
    await db.delete(questionsTable);
    await db.delete(rooms);

    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting all rooms:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
