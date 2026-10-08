const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function youtubeVideoId(value: string) {
  const input = value.trim();
  if (!input) return '';
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    let id = '';
    if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
    else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
      else {
        const [kind, candidate] = url.pathname.split('/').filter(Boolean);
        if (['embed', 'shorts', 'live'].includes(kind)) id = candidate || '';
      }
    }
    return YOUTUBE_ID.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function youtubeEmbedUrl(value: string) {
  const id = youtubeVideoId(value);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null;
}
