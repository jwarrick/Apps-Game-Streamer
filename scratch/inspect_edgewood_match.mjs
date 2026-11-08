import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDummyKeyForPublicFirestore",
  projectId: "gamestreamer-live",
  databaseURL: "https://gamestreamer-live-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function inspect() {
  const matchDocRef = doc(db, 'matches', 'match_1793145552168');
  const snap = await getDoc(matchDocRef);
  if (!snap.exists()) {
    console.log('Match match_1793145552168 not found!');
    process.exit(1);
  }

  const d = snap.data();
  console.log('=== MATCH SUMMARY ===');
  console.log(`Opponent: ${d.opponent}`);
  console.log(`Date: ${d.date}`);
  console.log(`Score: Us ${d.scoreUs} - ${d.scoreThem} Them (Sets: ${d.setsUs} - ${d.setsThem}, Current Set: ${d.currentSet})`);
  console.log(`StorageTier: ${d.storageTier}`);
  console.log(`Folder URL: ${d.driveFolderUrl}`);
  console.log(`Highlights Total: ${(d.highlights || []).length}`);

  console.log('\n=== HIGHLIGHT DETAILS ===');
  (d.highlights || []).forEach((h, i) => {
    console.log(`[${i}] ID: ${h.id}`);
    console.log(`    Set: ${h.set}, Score: ${h.score}, Label: ${h.label}`);
    console.log(`    storageTier: ${h.storageTier}`);
    console.log(`    hasLocalBlob: ${h.hasLocalBlob}, localBlobId: ${h.localBlobId}`);
    console.log(`    driveFileId: ${h.driveFileId}`);
    console.log(`    videoUrl: ${h.videoUrl}`);
    console.log(`    durationMs: ${h.durationMs}`);
    console.log(`    timestamp: ${h.timestamp} (${new Date(h.timestamp).toISOString()})`);
  });

  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
