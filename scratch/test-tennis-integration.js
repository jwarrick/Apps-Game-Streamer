import { store, getTennisPointDisplay, formatTennisSetScores } from '../src/services/store.js';

function assert(condition, message) {
  if (!condition) {
    console.error('❌ FAIL:', message);
    process.exit(1);
  } else {
    console.log('✓ PASS:', message);
  }
}

console.log('\n--- 1. Testing Tennis Broadcast Setup ---');
store.startBroadcast('Roosevelt High', {
  sport: 'tennis',
  tennisScoringType: 'ad',
  currentSetFormat: 'standard',
  server: 'us',
  startingSet: 1
});

let state = store.getState().activeMatch;
assert(state.sport === 'tennis', 'Sport is tennis');
assert(state.ringBufferDuration === 30, 'Ring buffer is 30s for tennis');
assert(state.server === 'us', 'Server is US');
assert(state.gamesUs === 0 && state.gamesThem === 0, 'Games start at 0-0');
assert(state.pointsUs === 0 && state.pointsThem === 0, 'Points start at 0-0');

console.log('\n--- 2. Testing Tennis Game Scoring (Ad Scoring) ---');
// US is on left, Opponent on right
// US wins 3 points: 0 -> 15 -> 30 -> 40
store.adjustScore('left', 1);
assert(getTennisPointDisplay(store.getState().activeMatch.pointsUs, store.getState().activeMatch.pointsThem).us === '15', 'Point 1: 15');
store.adjustScore('left', 1);
assert(getTennisPointDisplay(store.getState().activeMatch.pointsUs, store.getState().activeMatch.pointsThem).us === '30', 'Point 2: 30');
store.adjustScore('left', 1);
assert(getTennisPointDisplay(store.getState().activeMatch.pointsUs, store.getState().activeMatch.pointsThem).us === '40', 'Point 3: 40');

// Opponent scores to 40-40 (Deuce)
store.adjustScore('right', 1);
store.adjustScore('right', 1);
store.adjustScore('right', 1);
assert(store.getState().activeMatch.pointsUs === 3 && store.getState().activeMatch.pointsThem === 3, 'Score is 3-3 (Deuce)');
assert(getTennisPointDisplay(store.getState().activeMatch.pointsUs, store.getState().activeMatch.pointsThem).us === '40', 'Deuce displayed as 40');

// US gets Ad-in
store.adjustScore('left', 1);
assert(getTennisPointDisplay(store.getState().activeMatch.pointsUs, store.getState().activeMatch.pointsThem).us === 'AD', 'US has AD');

// Opponent scores: back to Deuce
store.adjustScore('right', 1);
assert(store.getState().activeMatch.pointsUs === 3 && store.getState().activeMatch.pointsThem === 3, 'Back to 3-3 (Deuce)');

// US scores twice: wins game 1!
store.adjustScore('left', 1);
store.adjustScore('left', 1);
state = store.getState().activeMatch;
assert(state.gamesUs === 1 && state.gamesThem === 0, 'US wins game 1 (1-0)');
assert(state.pointsUs === 0 && state.pointsThem === 0, 'Points reset after game');
assert(state.server === 'them', 'Server rotated to Opponent after Game 1');

console.log('\n--- 3. Testing Set 1 Completion ---');
// Fast forward US to 5 games, Opponent to 4 games
store.updateTennisScore({ gamesUs: 5, gamesThem: 4, pointsUs: 0, pointsThem: 0, server: 'us' });
// Win 4 points to take game 6 and win set 6-4
store.adjustScore('left', 1);
store.adjustScore('left', 1);
store.adjustScore('left', 1);
store.adjustScore('left', 1);

state = store.getState().activeMatch;
assert(state.setFinished === true, 'Set 1 is finished at 6-4');
assert(state.setsUs === 1 && state.setsThem === 0, 'US won Set 1');
assert(state.setScores.length === 1 && state.setScores[0].score === '6-4', 'Set score 6-4 recorded');
assert(formatTennisSetScores(state.setScores) === '6-4', 'Set score formatted correctly');

console.log('\n--- 4. Testing Next Set Format Selection (10-Pt Match Tiebreak) ---');
store.startNextTennisSet('match_tiebreak_10');
state = store.getState().activeMatch;
assert(state.currentSet === 2, 'Current set is 2');
assert(state.currentSetFormat === 'match_tiebreak_10', 'Format is 10-pt match tiebreak');
assert(state.isTiebreak === true, 'isTiebreak is true for match tiebreak');
assert(state.tiebreakTarget === 10, 'Target is 10');

// Win 10 points
for (let i = 0; i < 10; i++) {
  store.adjustScore('left', 1);
}
state = store.getState().activeMatch;
assert(state.setFinished === true, '10-point tiebreak finished');
assert(state.setsUs === 2, 'US has 2 sets won');
assert(state.setScores.length === 2, '2 sets recorded');
assert(formatTennisSetScores(state.setScores) === '6-4, [10-0]', 'Format displays 6-4, [10-0]');

console.log('\n--- 5. Testing Unknown Set Scores (?) and Winner Confirmation ---');
// Set 1 score as unknown '?'
store.updateTennisScore({
  setScores: [
    { setNumber: 1, score: '?', isUnknown: true, winner: 'us' },
    { setNumber: 2, score: '6-4', isUnknown: false, winner: 'them' }
  ]
});
state = store.getState().activeMatch;
assert(formatTennisSetScores(state.setScores) === '?, 6-4', 'Unknown set score formats as ?');

// Declare match finished with winnerOverride
store.finishMatch('us');
state = store.getState().activeMatch;
assert(state.isFinished === true, 'Match marked finished');
assert(state.winner === 'us', 'Winner marked as US despite ? in set score');

console.log('\n--- 6. Testing Volleyball Compatibility (Zero Regressions) ---');
store.startBroadcast('Volleyball Rival', {
  sport: 'volleyball',
  startingSet: 1
});
state = store.getState().activeMatch;
assert(state.sport === 'volleyball', 'Sport is volleyball');
assert(state.ringBufferDuration === 20, 'Ring buffer is 20s for volleyball');
store.adjustScore('left', 1);
store.adjustScore('left', 1);
assert(store.getState().activeMatch.scoreUs === 2, 'Volleyball score tallies normally');

console.log('\n✅ ALL INTEGRATION TESTS PASSED PERFECTLY!\n');
