import "dotenv/config";
import { db } from "../server/db";
import { 
  teamSolvedQuestions, 
  teamQuestionMapping, 
  teamSolvedPositions, 
  questions, 
  teams 
} from "../server/schema";

async function cleanDatabase() {
  console.log("🧹 Cleaning database...");
  
  try {
    // Delete in order to respect foreign key constraints
    console.log("Deleting teamSolvedQuestions...");
    await db.delete(teamSolvedQuestions);
    
    console.log("Deleting teamSolvedPositions...");
    await db.delete(teamSolvedPositions);
    
    console.log("Deleting teamQuestionMapping...");
    await db.delete(teamQuestionMapping);
    
    console.log("Deleting questions...");
    await db.delete(questions);
    
    console.log("Deleting teams...");
    await db.delete(teams);
    
    console.log("✅ Database cleaned successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error cleaning database:", error);
    process.exit(1);
  }
}

cleanDatabase();
