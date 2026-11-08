// scratch/inspect-rice-highlights.mjs
import fs from 'fs';
import path from 'path';

const clip0Id = '1CXE5oURmptwYUarh16XYz1kuKiha0yMz'; // Amazing Dig
const clip1Id = '1yEg7BDr_WJpvW0sKAwIK5OeYBWPy8-re'; // Crazy Kill

async function downloadFile(driveId, outPath) {
  const url = `https://drive.google.com/uc?export=download&id=${driveId}`;
  console.log(`Downloading ${driveId} to ${outPath}...`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buf);
  console.log(`Saved ${outPath} (${buf.length} bytes)`);
  return buf;
}

function parseMp4Boxes(buffer) {
  let offset = 0;
  const boxes = [];
  while (offset + 8 <= buffer.length) {
    const size = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    let boxSize = size;
    if (size === 1 && offset + 16 <= buffer.length) {
      // 64-bit size
      boxSize = Number(buffer.readBigUInt64BE(offset + 8));
    } else if (size === 0) {
      boxSize = buffer.length - offset;
    }
    boxes.push({ type, offset, size: boxSize });
    if (boxSize <= 0 || offset + boxSize > buffer.length) {
      break;
    }
    offset += boxSize;
  }
  return boxes;
}

(async () => {
  const clip0Path = path.resolve('scratch/rice_clip0_amazing_dig.mp4');
  const clip1Path = path.resolve('scratch/rice_clip1_crazy_kill.mp4');

  const buf0 = await downloadFile(clip0Id, clip0Path);
  const buf1 = await downloadFile(clip1Id, clip1Path);

  console.log('\n--- Box Structure: Rice Clip 0 (Amazing Dig) ---');
  const boxes0 = parseMp4Boxes(buf0);
  console.log(`Total boxes: ${boxes0.length}`);
  boxes0.slice(0, 15).forEach((b, i) => console.log(`  [${i}] ${b.type} at ${b.offset}, size: ${b.size}`));
  if (boxes0.length > 15) console.log(`  ... and ${boxes0.length - 15} more boxes`);

  console.log('\n--- Box Structure: Rice Clip 1 (Crazy Kill) ---');
  const boxes1 = parseMp4Boxes(buf1);
  console.log(`Total boxes: ${boxes1.length}`);
  boxes1.slice(0, 15).forEach((b, i) => console.log(`  [${i}] ${b.type} at ${b.offset}, size: ${b.size}`));
  if (boxes1.length > 15) console.log(`  ... and ${boxes1.length - 15} more boxes`);
})();
