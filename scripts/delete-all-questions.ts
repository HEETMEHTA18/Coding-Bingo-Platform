import "dotenv/config";
import { db } from "../server/db";
import { 
  teamSolvedQuestions, 
  teamQuestionMapping, 
  questions 
} from "../server/schema";

async function deleteAllQuestions() {
  console.log("🗑️  Deleting all questions from database...");
  
  try {
    // Delete in order to respect foreign key constraints
    console.log("Deleting teamSolvedQuestions...");
    await db.delete(teamSolvedQuestions);
    
    console.log("Deleting teamQuestionMapping...");
    await db.delete(teamQuestionMapping);
    
    console.log("Deleting questions...");
    await db.delete(questions);
    
    console.log("✅ All questions deleted successfully!");
    console.log("💡 You can now upload new questions via the admin panel.");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error deleting questions:", error);
    process.exit(1);
  }
}

deleteAllQuestions();
