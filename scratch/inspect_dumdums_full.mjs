import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDummyKey",
  authDomain: "gamestreamer-live.firebaseapp.com",
  projectId: "gamestreamer-live",
  storageBucket: "gamestreamer-live.appspot.com",
  appId: "1:931215439404:web:dummy"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function inspectDumdums() {
  const matchSnap = await getDoc(doc(db, 'matches', 'match_1792935638228'));
  if (matchSnap.exists()) {
    const data = matchSnap.data();
    console.log("=== Match Info ===");
    console.log("Opponent:", data.opponent);
    console.log("Date:", data.date);
    console.log("StorageTier:", data.storageTier);
    console.log("Highlights count:", data.highlights?.length);
    data.highlights?.forEach((h, i) => {
      console.log(`\n--- Highlight [${i}] ---`);
      console.log(JSON.stringify(h, null, 2));
    });
  } else {
    console.log("Match match_1792935638228 not found");
  }
}

inspectDumdums();
