// ==========================================================================
// Video Share & Camera Roll Helper
// Shares via Apple/Android Share Sheet (saving to Camera Roll / Photos or messaging),
// or downloads to user's Downloads folder on desktop browsers
// ==========================================================================

export async function shareHighlightVideo(clip, buttonElement = null) {
  if (!clip || !clip.videoUrl) return;

  const cleanLabel = (clip.label || 'Highlight').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanScore = (clip.score || '0-0').replace(/\s+/g, '');
  const filename = `Volleyball_${cleanLabel}_Set${clip.set || 1}_${cleanScore}.mp4`;

  if (buttonElement) {
    buttonElement.classList.add('working');
    buttonElement.style.pointerEvents = 'none';
  }

  try {
    const res = await fetch(clip.videoUrl);
    const blob = await res.blob();
    const file = new File([blob], filename, { type: 'video/mp4' });

    // 1. iPhone / iPad / Android: Web Share API with Files
    // When navigator.share receives a video file, iOS presents the native share sheet
    // with actions to "Save Video" (direct to Photos / Camera Roll), AirDrop, Messages, etc.
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
          // User simply closed the native share sheet
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
      buttonElement.classList.remove('working');
      buttonElement.style.pointerEvents = 'auto';
    }
  }
}

// Backwards-compatible alias for any legacy callers
export const downloadHighlightVideo = shareHighlightVideo;
