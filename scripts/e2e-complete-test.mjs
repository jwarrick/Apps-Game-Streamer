import { chromium } from 'playwright';
import { db } from '../src/services/firebase.js';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

async function runTest() {
  console.log('=====================================================');
  console.log('🚀 RUNNING COMPREHENSIVE E2E VERIFICATION TEST');
  console.log('=====================================================');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream'
    ]
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    permissions: ['camera', 'microphone']
  });

  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[BROWSER ${msg.type().toUpperCase()}]:`, msg.text());
    }
  });

  page.on('pageerror', err => {
    console.error('[BROWSER UNCAUGHT ERROR]:', err);
  });

  // Step 1: Open Hub
  console.log('\n--- STEP 1: Loading Hub Page ---');
  await page.goto('https://localhost:5173/');
  await page.waitForTimeout(1000);

  let initialCards = await page.$$('.match-card');
  console.log(`Initial match cards on Hub: ${initialCards.length}`);

  // Step 2: Test Broadcast Creation
  console.log('\n--- STEP 2: Starting a Broadcast ---');
  const btnGoLive = await page.$('#btn-go-live-header');
  if (!btnGoLive) throw new Error('#btn-go-live-header not found!');
  await btnGoLive.click();
  await page.waitForTimeout(500);

  const pinInput = await page.$('#pin-input');
  if (pinInput) {
    console.log('Entering PIN 1234...');
    await pinInput.fill('1234');
    await page.click('#btn-submit-pin');
    await page.waitForTimeout(500);
  }

  // Type custom opponent name
  const inputOpponent = await page.$('#input-opponent');
  if (inputOpponent) {
    await inputOpponent.fill('E2E Warriors');
  }

  const btnConfirm = await page.$('#btn-confirm-go-live');
  if (!btnConfirm) throw new Error('#btn-confirm-go-live not found!');
  console.log('Clicking "Start Stream"...');
  await btnConfirm.click();
  await page.waitForTimeout(2000);

  const currentHash = await page.evaluate(() => window.location.hash);
  console.log(`Navigated URL hash: ${currentHash}`);
  if (currentHash !== '#/stream') {
    throw new Error(`Expected hash #/stream but got ${currentHash}`);
  }

  const streamerMounted = await page.$('.streamer-container');
  console.log(`Streamer container mounted: ${!!streamerMounted}`);
  if (!streamerMounted) throw new Error('Streamer container did not mount!');

  // Check Firestore to verify the new match has isLive: true
  const snap = await getDocs(collection(db, 'matches'));
  let liveMatchDoc = null;
  snap.forEach(d => {
    const data = d.data();
    if (data.opponent === 'E2E Warriors' && data.isLive === true) {
      liveMatchDoc = { id: d.id, ...data };
    }
  });

  if (!liveMatchDoc) {
    console.error('Available docs in Firestore:');
    snap.forEach(d => console.log(' -', d.id, d.data().opponent, 'isLive:', d.data().isLive));
    throw new Error('Match "E2E Warriors" was NOT live in Firestore!');
  }
  console.log(`✓ Firestore verified: Match ${liveMatchDoc.id} is actively LIVE in Firestore!`);

  // Step 3: Finish Match from StreamerView
  console.log('\n--- STEP 3: Ending Broadcast and Finishing Match ---');
  const btnEnd = await page.$('#btn-end-stream');
  if (!btnEnd) throw new Error('#btn-end-stream not found!');
  await btnEnd.click();
  await page.waitForTimeout(500);

  const btnFinish = await page.$('#btn-finish-stream');
  if (!btnFinish) throw new Error('#btn-finish-stream not found!');
  console.log('Clicking "Finish Match"...');
  await btnFinish.click();
  await page.waitForTimeout(1500);

  const hashAfterFinish = await page.evaluate(() => window.location.hash);
  console.log(`URL hash after finish: ${hashAfterFinish}`);
  if (hashAfterFinish !== '#/' && hashAfterFinish !== '') {
    throw new Error(`Expected Hub hash but got ${hashAfterFinish}`);
  }

  const hubMounted = await page.$('.hub-container');
  console.log(`Hub container mounted: ${!!hubMounted}`);
  if (!hubMounted) throw new Error('Hub view did not mount cleanly after match finish!');

  // Verify Firestore updated to isLive: false, isFinished: true
  const finishedSnap = await getDoc(doc(db, 'matches', liveMatchDoc.id));
  const finishedData = finishedSnap.data();
  console.log(`Firestore status for ${liveMatchDoc.id}: isLive=${finishedData.isLive}, isFinished=${finishedData.isFinished}`);
  if (finishedData.isLive !== false || finishedData.isFinished !== true) {
    throw new Error(`Expected isLive=false & isFinished=true, but got isLive=${finishedData.isLive}, isFinished=${finishedData.isFinished}`);
  }
  console.log('✓ Firestore verified: Match cleanly marked isLive=false and isFinished=true!');

  // Step 4: Test Match Deletion (Verify it only deletes target match)
  console.log('\n--- STEP 4: Testing Match Deletion ---');
  let cardsBefore = await page.$$('.match-card');
  console.log(`Matches on Hub before deletion: ${cardsBefore.length}`);

  const trashBtn = await page.$(`.btn-trash-match[data-match-id="${liveMatchDoc.id}"]`);
  if (!trashBtn) throw new Error(`Trash button for match ${liveMatchDoc.id} not found!`);
  await trashBtn.click();
  await page.waitForTimeout(500);

  // In-app modal should appear
  const confirmModal = await page.$('#confirm-action-modal');
  console.log(`In-app confirmation modal displayed: ${!!confirmModal}`);
  if (!confirmModal) throw new Error('In-app confirm modal did not appear!');

  const btnExecuteConfirm = await page.$('#btn-execute-confirm');
  if (!btnExecuteConfirm) throw new Error('#btn-execute-confirm not found!');
  console.log('Clicking "Delete Match" in modal...');
  await btnExecuteConfirm.click();
  await page.waitForTimeout(1500);

  // Verify match is gone from Firestore
  const deletedDocSnap = await getDoc(doc(db, 'matches', liveMatchDoc.id));
  console.log(`Deleted match exists in Firestore: ${deletedDocSnap.exists()}`);
  if (deletedDocSnap.exists()) {
    throw new Error(`Expected match ${liveMatchDoc.id} to be deleted from Firestore, but it still exists!`);
  }
  console.log('✓ Firestore verified: Target match successfully deleted from Firestore!');

  let cardsAfter = await page.$$('.match-card');
  console.log(`Matches on Hub after deletion: ${cardsAfter.length}`);
  if (cardsAfter.length !== cardsBefore.length - 1) {
    throw new Error(`Expected cards to decrease by 1 (from ${cardsBefore.length} to ${cardsBefore.length - 1}), but got ${cardsAfter.length}!`);
  }
  console.log('✓ Hub verified: Exactly ONE match was deleted, all other matches remain safe!');

  await browser.close();
  console.log('\n=====================================================');
  console.log('🎉 ALL PLAYWRIGHT E2E TESTS PASSED 100%!');
  console.log('=====================================================');
  process.exit(0);
}

runTest().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
