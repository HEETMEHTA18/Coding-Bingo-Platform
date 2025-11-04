import "dotenv/config";
import { db } from "../server/db";
import { questions, teamQuestionMapping, teamSolvedQuestions } from "../server/schema";
import { inArray } from "drizzle-orm";

async function deleteQuestions() {
  console.log("Deleting questions and related data...");

  const questionIdsToDelete = Array.from({ length: 50 }, (_, i) => i + 1);
  // You can adjust the length based on how many questions you want to delete
  // For example, if you have 50 questions, this will create an array [1, 2, ..., 50]
  console.log(`Deleting ${questionIdsToDelete.length} questions...`);
  
  // Step 1: Delete from team_solved_questions (if any)
  console.log("Step 1: Deleting team_solved_questions...");
  await db
    .delete(teamSolvedQuestions)
    .where(inArray(teamSolvedQuestions.questionId, questionIdsToDelete));
  console.log("✓ Deleted team_solved_questions");
  
  // Step 2: Delete from team_question_mapping
  console.log("Step 2: Deleting team_question_mapping...");
  await db
    .delete(teamQuestionMapping)
    .where(inArray(teamQuestionMapping.questionId, questionIdsToDelete));
  console.log("✓ Deleted team_question_mapping");
  
  // Step 3: Delete from questions
  console.log("Step 3: Deleting questions...");
  await db
    .delete(questions)
    .where(inArray(questions.questionId, questionIdsToDelete));
  console.log("✓ Deleted questions");
  
  console.log("\n✅ Successfully deleted all questions and related data!");
  process.exit(0);
}

deleteQuestions().catch((err) => {
  console.error("❌ Error deleting questions:", err);
  process.exit(1);
});
