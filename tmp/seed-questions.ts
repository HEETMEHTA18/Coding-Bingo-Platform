import postgres from 'postgres';
import 'dotenv/config';

async function seed() {
  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
  try {
    console.log('Seeding questions for rooms...');
    const questions = [
      { room_code: 'ADA1', question_text: 'What is 10 + 10?', correct_answer: '20', is_real: true },
      { room_code: 'ADA1', question_text: 'What is the capital of France?', correct_answer: 'Paris', is_real: true },
      { room_code: 'ADA1', question_text: 'Solve: 5 * 5', correct_answer: '25', is_real: false },
      { room_code: 'AZA1', question_text: 'What is 10 + 10?', correct_answer: '20', is_real: true },
      { room_code: 'AZA1', question_text: 'What is the capital of France?', correct_answer: 'Paris', is_real: true },
      { room_code: 'AZA1', question_text: 'Solve: 5 * 5', correct_answer: '25', is_real: false },
    ];

    for (const q of questions) {
      await sql`INSERT INTO questions (room_code, question_text, correct_answer, is_real)
                      VALUES (${q.room_code}, ${q.question_text}, ${q.correct_answer}, ${q.is_real})
                      ON CONFLICT DO NOTHING;`;
    }
    console.log('✅ Seeding complete!');
  } catch (err) {
    console.error('❌ Seeding failed:', err);
  } finally {
    await sql.end();
  }
}

seed();
