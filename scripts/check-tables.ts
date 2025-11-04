import "dotenv/config";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function checkTables() {
  console.log("🔍 Checking database tables...\n");
  
  try {
    // Query to list all tables
    const result = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log("📋 Tables found:");
    result.rows.forEach((row: any) => {
      console.log(`  - ${row.table_name}`);
    });
    
    console.log("\n🔢 Checking row counts...\n");
    
    // Check each table
    const tables = ['rooms', 'questions', 'teams', 'team_solved_questions', 'team_solved_positions', 'team_question_mapping', 'wipe_audits'];
    
    for (const table of tables) {
      try {
        const count = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${table}`));
        console.log(`  ${table}: ${count.rows[0].count} rows`);
      } catch (e: any) {
        console.log(`  ${table}: ❌ Error - ${e.message}`);
      }
    }
    
    console.log("\n✅ Database check complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error checking database:", error);
    process.exit(1);
  }
}

checkTables();
