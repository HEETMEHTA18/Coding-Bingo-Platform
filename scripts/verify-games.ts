
import { fetch } from 'undici'; // Use built-in fetch if available, or undici if needed. Node 22 has fetch.
// Actually, let's just use global fetch.

const BASE_URL = 'http://localhost:8080';

const GAMES = [
  'bingo',
  'sudoku',
  'connect4',
  'memory',
  'race',
  'crossword',
  'quiz',
  'puzzlehunt',
  'codecanvas'
];

async function verifyGame(gameType: string) {
  const roomCode = `VERIFY_${gameType.toUpperCase()}_${Date.now().toString().slice(-4)}`;
  const teamName = `Team_${gameType}`;

  console.log(`\nTesting ${gameType}...`);

  try {
    // 1. Create Room
    const createRoomRes = await fetch(`${BASE_URL}/api/admin/create-room`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: roomCode,
        gameType: gameType,
        title: `Verification Room for ${gameType}`
      })
    });

    if (!createRoomRes.ok) {
        const text = await createRoomRes.text();
        console.error(`❌ Failed to create room: ${createRoomRes.status} ${text}`);
        return false;
    }
    console.log(`✅ Room created: ${roomCode}`);

    // 2. Join Team
    const joinRes = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_code: roomCode,
        team_name: teamName
      })
    });

    if (!joinRes.ok) {
        const text = await joinRes.text();
        console.error(`❌ Failed to join team: ${joinRes.status} ${text}`);
        return false;
    }
    
    const joinData = await joinRes.json();
    const teamId = joinData.team?.id;
    
    if (!teamId) {
        console.error(`❌ No team ID returned`);
        return false;
    }
    console.log(`✅ Joined team: ${teamName} (${teamId})`);

    // 3. Get Game State
    const gameRes = await fetch(`${BASE_URL}/api/game?room=${roomCode}&team=${teamId}`);
    
    if (!gameRes.ok) {
        const text = await gameRes.text();
        console.error(`❌ Failed to get game state: ${gameRes.status} ${text}`);
        return false;
    }

    const gameData = await gameRes.json();
    
    if (gameData.room?.gameType !== gameType) {
        console.error(`❌ Game type mismatch. Expected ${gameType}, got ${gameData.room?.gameType}`);
        return false;
    }

    console.log(`✅ Game state verified for ${gameType}`);
    return true;

  } catch (error) {
    console.error(`❌ Exception during verification:`, error);
    return false;
  }
}

async function main() {
  console.log('Starting Game Verification...');
  console.log(`Target: ${BASE_URL}`);

  let passed = 0;
  let failed = 0;
  const failedGames = [];

  for (const game of GAMES) {
    const success = await verifyGame(game);
    if (success) {
      passed++;
    } else {
      failed++;
      failedGames.push(game);
    }
  }

  console.log('\n-------------------');
  console.log('Verification Summary');
  console.log('-------------------');
  console.log(`Total Games: ${GAMES.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) {
    console.log(`Failed Games: ${failedGames.join(', ')}`);
    process.exit(1);
  } else {
    console.log('All games passed verification!');
    process.exit(0);
  }
}

main();
