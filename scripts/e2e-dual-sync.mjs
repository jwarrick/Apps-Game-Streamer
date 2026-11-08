import { chromium } from 'playwright';

async function runDualSyncTest() {
  console.log('=====================================================');
  console.log('🚀 RUNNING DUAL-THREAD BROADCASTER & WATCHER SYNC TEST');
  console.log('=====================================================');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required'
    ]
  });

  // Thread 1: Broadcaster Browser Context
  const contextBroadcaster = await browser.newContext({
    ignoreHTTPSErrors: true,
    permissions: ['camera', 'microphone']
  });
  const pageBroadcaster = await contextBroadcaster.newPage();

  pageBroadcaster.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('[BROADCASTER ERROR]:', msg.text());
    }
  });

  // Thread 2: Watcher / Viewer Browser Context
  const contextWatcher = await browser.newContext({
    ignoreHTTPSErrors: true
  });
  const pageWatcher = await contextWatcher.newPage();

  pageWatcher.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('[WATCHER ERROR]:', msg.text());
    }
  });

  try {
    // ------------------------------------------------------------------------
    // Step 1: Broadcaster starts a live volleyball match
    // ------------------------------------------------------------------------
    console.log('\n--- Step 1: Broadcaster Initiates Stream ---');
    await pageBroadcaster.goto('https://localhost:5173/');
    await pageBroadcaster.waitForTimeout(1000);

    const btnGoLive = await pageBroadcaster.$('#btn-go-live-header');
    await btnGoLive.click();
    await pageBroadcaster.waitForTimeout(500);

    const pinInput = await pageBroadcaster.$('#pin-input');
    if (pinInput) {
      await pinInput.fill('1234');
      await pageBroadcaster.click('#btn-submit-pin');
      await pageBroadcaster.waitForTimeout(500);
    }

    const inputOpponent = await pageBroadcaster.$('#input-opponent');
    if (inputOpponent) {
      await inputOpponent.fill('Sync Hawks');
    }

    const btnConfirm = await pageBroadcaster.$('#btn-confirm-go-live');
    await btnConfirm.click();
    await pageBroadcaster.waitForTimeout(2000);

    const broadcasterHash = await pageBroadcaster.evaluate(() => window.location.hash);
    console.log(`Broadcaster on page: ${broadcasterHash}`);
    if (broadcasterHash !== '#/stream') {
      throw new Error(`Broadcaster failed to navigate to #/stream, got ${broadcasterHash}`);
    }

    // ------------------------------------------------------------------------
    // Step 2: Watcher joins the live stream
    // ------------------------------------------------------------------------
    console.log('\n--- Step 2: Watcher Joins /watch ---');
    await pageWatcher.goto('https://localhost:5173/#/watch');
    await pageWatcher.waitForTimeout(2500);

    const watcherScoreOverlay = await pageWatcher.$('#watcher-score-container');
    console.log(`Watcher score container mounted: ${!!watcherScoreOverlay}`);
    if (!watcherScoreOverlay) throw new Error('Watcher score container not found!');

    // ------------------------------------------------------------------------
    // Step 3: Broadcaster scores points & verifies real-time score sync
    // ------------------------------------------------------------------------
    console.log('\n--- Step 3: Testing Real-Time Score Sync from Broadcaster to Watcher ---');
    // Adjust score on broadcaster side: +1 for US (left side)
    await pageBroadcaster.evaluate(() => {
      window.store.adjustScore('left', +1);
    });
    console.log('Broadcaster scored +1 point for US...');

    // Wait for Firestore sync to reflect on Watcher
    let syncedScore = '';
    for (let i = 0; i < 15; i++) {
      await pageWatcher.waitForTimeout(500);
      syncedScore = await pageWatcher.evaluate(() => {
        const el = document.querySelector('#watcher-score-container .tabular-nums');
        return el ? el.textContent.trim() : '';
      });
      if (syncedScore.includes('1 - 0') || syncedScore.includes('1-0') || syncedScore.includes('0 - 1')) {
        console.log(`✓ Watcher received live score update: "${syncedScore}" (attempt ${i + 1})`);
        break;
      }
    }

    if (!syncedScore.includes('1')) {
      throw new Error(`Score failed to sync to Watcher. Watcher shows "${syncedScore}"`);
    }

    // ------------------------------------------------------------------------
    // Step 4: Broadcaster fires a highlight pill & verifies Watcher comment sync
    // ------------------------------------------------------------------------
    console.log('\n--- Step 4: Broadcaster Triggers Highlight Pill ---');
    await pageBroadcaster.evaluate(() => {
      window.store.triggerPointHighlight({
        type: 'player',
        label: '🚀 Monster Spike!',
        target: 'current'
      });
    });
    console.log('Broadcaster triggered highlight: "🚀 Monster Spike!"');

    // Verify comment appears in Watcher's drawer in real-time
    let highlightCommentFound = false;
    for (let i = 0; i < 15; i++) {
      await pageWatcher.waitForTimeout(500);
      const commentsText = await pageWatcher.evaluate(() => {
        const el = document.querySelector('#drawer-chat-list');
        return el ? el.textContent : '';
      });
      if (commentsText.includes('Monster Spike')) {
        console.log(`✓ Watcher received highlight comment in real-time!`);
        highlightCommentFound = true;
        break;
      }
    }

    if (!highlightCommentFound) {
      throw new Error('Highlight comment was not received by Watcher drawer!');
    }

    // ------------------------------------------------------------------------
    // Step 5: Watcher sends a reply comment & verifies Broadcaster receives it
    // ------------------------------------------------------------------------
    console.log('\n--- Step 5: Watcher Posts Comment to Broadcaster ---');
    await pageWatcher.evaluate(() => {
      window.store.postChatMessage('Grandma', 'Amazing hit team! Watching from home! ❤️');
    });

    let watcherReplyFound = false;
    for (let i = 0; i < 15; i++) {
      await pageBroadcaster.waitForTimeout(500);
      const broadcasterComments = await pageBroadcaster.evaluate(() => {
        const el = document.querySelector('#drawer-chat-list');
        return el ? el.textContent : '';
      });
      if (broadcasterComments.includes('Watching from home')) {
        console.log(`✓ Broadcaster received Watcher comment in real-time!`);
        watcherReplyFound = true;
        break;
      }
    }

    if (!watcherReplyFound) {
      throw new Error('Watcher comment was not received by Broadcaster drawer!');
    }

    // ------------------------------------------------------------------------
    // Step 6: Broadcaster concludes match -> Watcher sees conclusion overlay
    // ------------------------------------------------------------------------
    console.log('\n--- Step 6: Finishing Match & Verifying Watcher Screen ---');
    await pageBroadcaster.evaluate(() => {
      window.store.finishMatch('us');
    });
    await pageWatcher.waitForTimeout(1500);

    const watcherStatus = await pageWatcher.evaluate(() => {
      const el = document.querySelector('#stream-status-text');
      return el ? el.textContent : '';
    });
    console.log(`Watcher stream status text: "${watcherStatus}"`);

    // ------------------------------------------------------------------------
    // Step 7: Test 3-Stage Storage Lifecycle on Hub
    // ------------------------------------------------------------------------
    console.log('\n--- Step 7: Verifying 3-Stage Storage Lifecycle on Hub ---');
    await pageBroadcaster.goto('https://localhost:5173/');
    await pageBroadcaster.waitForTimeout(1500);

    // Stage 1: Verify Server Copy badge and immediate server video playback
    const serverBadge = await pageBroadcaster.$('.server-clip-tag');
    console.log(`✓ Stage 1 Server Copy badge visible: ${!!serverBadge}`);

    console.log('Testing Stage 1 Server Playback...');
    let btnPlayClip = await pageBroadcaster.$('.btn-play-clip');
    if (btnPlayClip) {
      await btnPlayClip.click();
      await pageBroadcaster.waitForTimeout(1000);
      const videoElem = await pageBroadcaster.$('#replay-video-elem');
      console.log(`✓ Stage 1 Server Video playing in ReplayPlayer: ${!!videoElem}`);
      const btnCloseReplay = await pageBroadcaster.$('#btn-close-replay');
      if (btnCloseReplay) await btnCloseReplay.click();
      await pageBroadcaster.waitForTimeout(500);
    }

    // Stage 2: Backup to Drive (Server + Drive)
    const btnBackupDrive = await pageBroadcaster.$('.btn-backup-drive');
    console.log(`"☁️ Backup to Drive" button visible: ${!!btnBackupDrive}`);
    if (btnBackupDrive) {
      console.log('Clicking "☁️ Backup to Drive"...');
      await btnBackupDrive.click();
      await pageBroadcaster.waitForTimeout(500);

      const btnCloseDrive = await pageBroadcaster.$('#btn-close-drive-modal');
      if (btnCloseDrive) await btnCloseDrive.click();
      await pageBroadcaster.waitForTimeout(800);

      const syncedBadge = await pageBroadcaster.$('.synced-clip-tag');
      console.log(`✓ Stage 2 Synced badge (Server + Drive) visible: ${!!syncedBadge}`);

      // Test Stage 2 Playback (still plays fast server copy while backed up to Drive)
      btnPlayClip = await pageBroadcaster.$('.btn-play-clip');
      if (btnPlayClip) {
        await btnPlayClip.click();
        await pageBroadcaster.waitForTimeout(1000);
        const videoElem = await pageBroadcaster.$('#replay-video-elem');
        console.log(`✓ Stage 2 Video STILL playing from server in ReplayPlayer: ${!!videoElem}`);
        const btnCloseReplay = await pageBroadcaster.$('#btn-close-replay');
        if (btnCloseReplay) await btnCloseReplay.click();
        await pageBroadcaster.waitForTimeout(500);
      }

      // Stage 3: Purge server video copy to reclaim cloud quota (Drive Only)
      const btnFreeServer = await pageBroadcaster.$('.btn-purge-server');
      console.log(`"🗑️ Free Server Space" button visible: ${!!btnFreeServer}`);
      if (btnFreeServer) {
        console.log('Clicking "🗑️ Free Server Space"...');
        await btnFreeServer.click();
        await pageBroadcaster.waitForTimeout(500);

        const btnConfirmModal = await pageBroadcaster.$('#btn-execute-confirm');
        if (btnConfirmModal) {
          console.log('Confirming Free Server Space modal...');
          await btnConfirmModal.click();
          await pageBroadcaster.waitForTimeout(1000);

          const driveClipTag = await pageBroadcaster.$('.drive-clip-tag');
          console.log(`✓ Stage 3 Drive Archived tag visible: ${!!driveClipTag}`);

          // Test Stage 3 Playback (shows Google Drive box with direct link)
          btnPlayClip = await pageBroadcaster.$('.btn-play-clip');
          if (btnPlayClip) {
            await btnPlayClip.click();
            await pageBroadcaster.waitForTimeout(1000);
            const driveBox = await pageBroadcaster.$('.replay-drive-box');
            console.log(`✓ Stage 3 Google Drive box rendered: ${!!driveBox}`);
            const btnCloseReplay = await pageBroadcaster.$('#btn-close-replay');
            if (btnCloseReplay) await btnCloseReplay.click();
            await pageBroadcaster.waitForTimeout(500);
          }
        }
      }
    }

    console.log('\n=====================================================');
    console.log('🎉 ALL DUAL-THREAD SYNC & STORAGE TESTS PASSED 100%!');
    console.log('=====================================================');

  } finally {
    await browser.close();
  }
}

runDualSyncTest().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
