import postgres from 'postgres';
import 'dotenv/config';

async function fix() {
  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
  try {
    console.log('Stopping current sessions or waiting for lock...');
    // Try to drop the constraint with a timeout
    await sql`SET lock_timeout = '10s';`;
    await sql`ALTER TABLE game_boards ALTER COLUMN team_id DROP NOT NULL;`;
    console.log('✅ Success!');
  } catch (err) {
    console.error('❌ Failed:', err);
    console.log('Retrying without the lock timeout...');
    try {
      await sql`ALTER TABLE game_boards ALTER COLUMN team_id DROP NOT NULL;`;
      console.log('✅ Success on retry!');
    } catch (err2) {
      console.error('❌ Failed on retry too:', err2);
    }
  } finally {
    await sql.end();
  }
}

fix();
