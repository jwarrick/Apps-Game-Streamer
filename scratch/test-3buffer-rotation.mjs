import { chromium } from 'playwright';

async function runTest() {
  console.log('🚀 Starting 3-Buffer Rotating Architecture E2E Test...');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--ignore-certificate-errors'
    ]
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    permissions: ['camera', 'microphone']
  });

  const page = await context.newPage();

  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    if (text.includes('[StreamerView]') || text.includes('Buffer') || text.includes('highlight') || text.includes('Highlight')) {
      console.log('  [BROWSER LOG]', text);
    }
  });

  page.on('pageerror', err => {
    console.error('  [PAGE ERROR]', err);
  });

  console.log('Navigating to https://localhost:4174...');
  await page.goto('https://localhost:4174', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    window.location.hash = '#/stream';
  });
  await page.waitForTimeout(2500);

  // Check if camera initialized and Buffer A started
  const bufferAStarted = logs.some(l => l.includes('Buffer A started (active)'));
  console.log(`✓ Buffer A started actively: ${bufferAStarted}`);

  // Let Buffer A record for 2 seconds
  console.log('Recording in Buffer A for 2 seconds...');
  await page.waitForTimeout(2000);

  // 1. Simulate Score Click at t ~ 2s
  console.log('Simulating score click (+1 Us)...');
  await page.evaluate(() => {
    const s = window.GameStreamer?.store || window.store;
    s.adjustScore('left', 1);
  });

  await page.waitForTimeout(500);
  const bufferBStarted = logs.some(l => l.includes('Starting tentative Buffer B'));
  console.log(`✓ Tentative Buffer B started on score click: ${bufferBStarted}`);

  // 2. Simulate rapid score correction within 1.5s (< 3s debounce)
  console.log('Simulating rapid score correction (+1 Us again within debounce)...');
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const s = window.GameStreamer?.store || window.store;
    s.adjustScore('left', 1);
  });

  await page.waitForTimeout(500);
  const bufferBRestarted = logs.some(l => l.includes('Restarting tentative Buffer B'));
  console.log(`✓ Tentative Buffer B cleanly restarted on rapid click: ${bufferBRestarted}`);

  // 3. Wait for 3-second debounce to expire and commit
  console.log('Waiting 3.5s for debounce to commit...');
  await page.waitForTimeout(3500);

  const bufferAFinalized = logs.some(l => l.includes('Completed rally finalized in Buffer A'));
  const bufferBPromoted = logs.some(l => l.includes('Buffer B is now officially started & active'));
  console.log(`✓ Buffer A finalized cleanly: ${bufferAFinalized}`);
  console.log(`✓ Buffer B promoted to active: ${bufferBPromoted}`);

  // 4. Bookmark "Current Point" highlight during Buffer B
  console.log('Opening highlight modal to bookmark Current Point...');
  await page.evaluate(() => {
    const btnPlayer = document.querySelector('#btn-highlight-player');
    if (btnPlayer) btnPlayer.click();
  });
  await page.waitForTimeout(500);

  // Click "Amazing Dig" pill
  const bookmarkResult = await page.evaluate(() => {
    const pills = Array.from(document.querySelectorAll('.btn-highlight-select'));
    const digPill = pills.find(p => p.textContent.includes('Amazing Dig'));
    if (digPill) {
      digPill.click();
      return true;
    }
    return false;
  });
  console.log(`✓ Clicked Amazing Dig pill: ${bookmarkResult}`);

  const bufferBBookmarked = logs.some(l => l.includes('Bookmarked highlight "🪏 Amazing Dig" on active Buffer B'));
  console.log(`✓ Highlight successfully bookmarked on Buffer B: ${bufferBBookmarked}`);

  // Verify Buffer B did NOT stop! It continues running.
  await page.waitForTimeout(2000);

  // 5. Score next point to conclude Buffer B's rally
  console.log('Scoring next point to finish Buffer B rally...');
  await page.evaluate(() => {
    const s = window.GameStreamer?.store || window.store;
    s.adjustScore('right', 1);
  });
  await page.waitForTimeout(500);

  const bufferCStarted = logs.some(l => l.includes('Starting tentative Buffer C'));
  console.log(`✓ Tentative Buffer C started in rotation: ${bufferCStarted}`);

  // 6. Wait for debounce to commit Buffer B
  console.log('Waiting 3.5s for debounce to commit Buffer B...');
  await page.waitForTimeout(3500);

  const bufferBFinalized = logs.some(l => l.includes('Completed rally finalized in Buffer B'));
  const bufferCPromoted = logs.some(l => l.includes('Buffer C is now officially started & active'));
  const highlightExported = logs.some(l => l.includes('Exported highlight "🪏 Amazing Dig"'));

  console.log(`✓ Buffer B finalized cleanly: ${bufferBFinalized}`);
  console.log(`✓ Buffer C promoted to active: ${bufferCPromoted}`);
  console.log(`✓ Bookmarked highlight automatically exported on point completion: ${highlightExported}`);

  // 7. Verify exported clip in store and test HTML5 video playback
  const clipValidation = await page.evaluate(async () => {
    const s = window.GameStreamer?.store || window.store;
    const activeM = s.getState().activeMatch;
    const matchEntry = (s.getState().matches || []).find(m => m.id === activeM?.id) || activeM;
    const clips = matchEntry?.highlights || activeM?.highlights || [];
    if (clips.length === 0) return { error: 'No highlights found in match', matchEntry, matchesCount: (s.getState().matches || []).length };

    const lastClip = clips[clips.length - 1];
    if (!lastClip.videoUrl) return { error: 'Clip missing videoUrl' };

    // Test playback in an HTML5 video element
    const v = document.createElement('video');
    v.src = lastClip.videoUrl;
    v.muted = true;
    v.playsInline = true;

    return new Promise((resolve) => {
      v.onloadedmetadata = () => {
        v.play().then(() => {
          setTimeout(() => {
            resolve({
              success: true,
              clipId: lastClip.id,
              label: lastClip.label,
              score: lastClip.score,
              duration: v.duration,
              currentTime: v.currentTime,
              paused: v.paused,
              readyState: v.readyState
            });
          }, 600);
        }).catch(err => resolve({ error: err.message }));
      };
      v.onerror = () => {
        resolve({ error: `Video error: ${v.error ? v.error.message : 'Unknown'}` });
      };
      setTimeout(() => {
        resolve({ error: 'Video load timeout after 4s' });
      }, 4000);
    });
  });

  console.log('🎬 Clip Playback Validation Result:', clipValidation);

  await browser.close();

  const allPassed = bufferAStarted && bufferBStarted && bufferBRestarted &&
                    bufferAFinalized && bufferBPromoted && bufferBBookmarked &&
                    bufferCStarted && bufferBFinalized && bufferCPromoted &&
                    highlightExported && clipValidation.success;

  if (allPassed) {
    console.log('\n🎉 ALL 3-BUFFER ROTATION TESTS PASSED WITH 100% SUCCESS!');
    process.exit(0);
  } else {
    console.error('\n❌ SOME CHECKS FAILED. Check logs above.');
    process.exit(1);
  }
}

runTest().catch(e => {
  console.error('Test crashed:', e);
  process.exit(1);
});
