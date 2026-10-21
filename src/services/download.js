// ==========================================================================
// Video Download & Camera Roll Helper
// Saves to iOS Photos / Camera Roll via Web Share API, or to computer Downloads folder
// ==========================================================================

export async function downloadHighlightVideo(clip, buttonElement = null) {
  if (!clip || !clip.videoUrl) return;

  const cleanLabel = (clip.label || 'Highlight').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanScore = (clip.score || '0-0').replace(/\s+/g, '');
  const filename = `Volleyball_${cleanLabel}_Set${clip.set || 1}_${cleanScore}.mp4`;

  let originalHtml = '';
  if (buttonElement) {
    originalHtml = buttonElement.innerHTML;
    buttonElement.innerHTML = '⏳';
    buttonElement.style.pointerEvents = 'none';
  }

  try {
    const res = await fetch(clip.videoUrl);
    const blob = await res.blob();
    const file = new File([blob], filename, { type: 'video/mp4' });

    // 1. iPhone / iPad: Web Share API with Files
    // When navigator.share receives a video file, iOS presents the native share sheet
    // with the prominent "Save Video" action, saving directly to the Camera Roll / Photos!
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `${clip.label || 'Volleyball Highlight'}`,
          text: `Volleyball Highlight: ${clip.label || ''} (Set ${clip.set}, ${clip.score})`
        });
        return;
      } catch (shareErr) {
        if (shareErr.name === 'AbortError') {
          // User simply closed the iOS share sheet
          return;
        }
        console.warn('Web Share failed, attempting computer download fallback:', shareErr);
      }
    }

    // 2. Computer / Desktop: Direct download to user's Downloads folder
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    }, 1200);
  } catch (err) {
    console.warn('Blob fetch failed, falling back to direct anchor download:', err);
    // 3. Fallback if CORS prevents blob fetching: trigger anchor download
    const a = document.createElement('a');
    a.href = clip.videoUrl;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 800);
  } finally {
    if (buttonElement) {
      buttonElement.innerHTML = originalHtml;
      buttonElement.style.pointerEvents = 'auto';
    }
  }
}
