
// scripts/verify-games.mjs
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

async function verifyGame(gameType) {

    // Map game types to short codes to keep room code < 10 chars
    const shortCodes = {
        'bingo': 'BNGO',
        'sudoku': 'SUDO',
        'connect4': 'CON4',
        'memory': 'MEMO',
        'race': 'RACE',
        'crossword': 'CROS',
        'quiz': 'QUIZ',
        'puzzlehunt': 'HUNT',
        'codecanvas': 'CNVS'
    };

    const shortType = shortCodes[gameType] || gameType.substring(0, 4).toUpperCase();
    const randomSuffix = Math.floor(Math.random() * 90 + 10); // 2 digits
    const roomCode = `V_${shortType}_${randomSuffix}`; // e.g. V_BNGO_12 (9 chars)

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
            return { success: false, error: `Create Room Failed: ${createRoomRes.status} ${text}` };
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
            return { success: false, error: `Join Team Failed: ${joinRes.status} ${text}` };
        }

        const joinData = await joinRes.json();
        const teamId = joinData.team?.id;

        if (!teamId) {
            console.error(`❌ No team ID returned`);
            return { success: false, error: 'No team ID returned' };
        }
        console.log(`✅ Joined team: ${teamName} (${teamId})`);

        // 3. Get Game State
        const gameRes = await fetch(`${BASE_URL}/api/game?room=${roomCode}&team=${teamId}`);

        if (!gameRes.ok) {
            const text = await gameRes.text();
            console.error(`❌ Failed to get game state: ${gameRes.status} ${text}`);
            return { success: false, error: `Get Game State Failed: ${gameRes.status} ${text}` };
        }

        const gameData = await gameRes.json();

        if (gameData.room?.gameType !== gameType) {
            console.error(`❌ Game type mismatch. Expected ${gameType}, got ${gameData.room?.gameType}`);
            return { success: false, error: `Game type mismatch. Expected ${gameType}, got ${gameData.room?.gameType}` };
        }

        console.log(`✅ Game state verified for ${gameType}`);
        return { success: true };

    } catch (error) {
        console.error(`❌ Exception during verification:`, error);
        return { success: false, error: error.message };
    }
}

async function main() {
    console.log('Starting Game Verification...');
    console.log(`Target: ${BASE_URL}`);

    let passed = 0;
    let failed = 0;
    const results = [];

    for (const game of GAMES) {
        const result = await verifyGame(game);
        results.push({ game, ...result });
        if (result.success) {
            passed++;
        } else {
            failed++;
        }
    }

    const summary = {
        total: GAMES.length,
        passed,
        failed,
        results
    };

    const fs = await import('fs/promises');
    await fs.writeFile('verification_results.json', JSON.stringify(summary, null, 2));

    console.log('\n-------------------');
    console.log('Verification Summary');
    console.log('-------------------');
    console.log(`Total Games: ${GAMES.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    if (failed > 0) {
        console.log(`Failed Games: ${results.filter(r => !r.success).map(r => r.game).join(', ')}`);
        process.exit(1);
    } else {
        console.log('All games passed verification!');
        process.exit(0);
    }
}

main();
