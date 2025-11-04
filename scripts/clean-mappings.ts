import "dotenv/config";
import { db } from "../server/db";
import { teamQuestionMapping } from "../server/schema";
import { eq, isNull } from "drizzle-orm";

async function cleanMappings() {
  console.log("Cleaning up broken question mappings...");
  console.log("DATABASE_URL:", process.env.DATABASE_URL ? "Set" : "Not set");
  
  // Delete mappings with NULL grid_position
  const result = await db
    .delete(teamQuestionMapping)
    .where(isNull(teamQuestionMapping.gridPosition));
  
  console.log("Deleted broken mappings successfully");
  process.exit(0);
}

cleanMappings().catch((err) => {
  console.error("Error cleaning mappings:", err);
  process.exit(1);
});
