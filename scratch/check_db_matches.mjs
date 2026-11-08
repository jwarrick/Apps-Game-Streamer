import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDummyKeyForPublicFirestore",
  projectId: "gamestreamer-live",
  databaseURL: "https://gamestreamer-live-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  const col = collection(db, 'matches');
  const snap = await getDocs(col);
  console.log(`Found ${snap.size} matches:`);
  snap.forEach(docSnap => {
    const data = docSnap.data();
    console.log(`\nMatch ID: ${docSnap.id}`);
    console.log(`Opponent: ${data.opponent}, Date: ${data.date}`);
    console.log(`StorageTier: ${data.storageTier}, Status: ${data.status}`);
    const hl = data.highlights || [];
    console.log(`Highlights (${hl.length}):`);
    hl.forEach((h, i) => {
      console.log(`  [${i}] ID: ${h.id}, Set: ${h.set}, Score: ${h.score}, Label: ${h.label}`);
      console.log(`       storageTier: ${h.storageTier}, driveFileId: ${h.driveFileId || 'NONE'}`);
      console.log(`       videoUrl: ${h.videoUrl || 'NONE'}`);
      console.log(`       driveUrl: ${h.driveUrl || 'NONE'}`);
    });
  });
  process.exit(0);
}

check().catch(err => {
  console.error('Error querying Firestore:', err);
  process.exit(1);
});
