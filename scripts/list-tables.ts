import postgres from "postgres";
import { config } from "dotenv";

config();

const sql = postgres(process.env.DATABASE_URL!);

async function listTables() {
  console.log("📋 Listing all tables in database...\n");
  
  try {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    console.log(`Found ${tables.length} tables:\n`);
    tables.forEach((t: any) => {
      console.log(`  ✓ ${t.table_name}`);
    });
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await sql.end();
  }
}

listTables();
