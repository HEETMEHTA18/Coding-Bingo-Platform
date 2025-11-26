import "dotenv/config";
import { db } from "../server/db.js";
import { sql as sqlTag } from "drizzle-orm";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyIndexes() {
  console.log('📊 Applying performance indexes...');
  
  try {
    // Read the migration SQL file
    const migrationPath = join(__dirname, '../drizzle/0006_add_performance_indexes.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'));
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`[${i + 1}/${statements.length}] Executing: ${statement.substring(0, 80)}...`);
      
      try {
        await db.execute(sqlTag.raw(statement));
        console.log(`  ✓ Success`);
      } catch (err: any) {
        if (err.message?.includes('already exists')) {
          console.log(`  ⚠️  Index already exists (skipping)`);
        } else {
          throw err;
        }
      }
    }
    
    console.log('✅ All indexes applied successfully!');
    console.log('   Query performance should be significantly improved.');
    
  } catch (error) {
    console.error('❌ Failed to apply indexes:', error);
    throw error;
  }
}

applyIndexes()
  .then(() => {
    console.log('\n✓ Migration complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n✗ Migration failed:', err);
    process.exit(1);
  });
