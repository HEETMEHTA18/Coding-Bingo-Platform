import postgres from 'postgres';
import 'dotenv/config';
import process from 'node:process';

async function fixSchema() {
  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
  try {
    console.log('Dropping NOT NULL constraint on game_boards.team_id...');
    await sql`ALTER TABLE game_boards ALTER COLUMN team_id DROP NOT NULL;`;
    console.log('✅ Successfully dropped NOT NULL constraint.');
  } catch (err) {
    console.error('❌ Failed to drop constraint:', err);
  } finally {
    await sql.end();
  }
}

fixSchema();
