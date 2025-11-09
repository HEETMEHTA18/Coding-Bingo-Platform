import "dotenv/config";
import { db } from "../server/db";
import { teamQuestionMapping } from "../server/schema";
import { eq } from "drizzle-orm";

async function fixMappings() {
  console.log("🔧 Fixing team question mappings...");
  
  try {
    // Delete all existing mappings
    console.log("Deleting existing mappings...");
    await db.delete(teamQuestionMapping);
    
    console.log("✅ Deleted all mappings. Teams will get new 25-question mappings on next game load.");
    console.log("💡 Just reload the game page and the system will auto-generate 25 questions per team.");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

fixMappings();
