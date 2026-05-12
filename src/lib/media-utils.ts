export function getEmbedUrl(url: string): string {
  if (!url) return '';
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0&modestbranding=1`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  const dmMatch = url.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/);
  if (dmMatch) return `https://www.dailymotion.com/embed/video/${dmMatch[1]}`;
  const ttMatch = url.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/);
  if (ttMatch) return `https://www.tiktok.com/embed/v2/${ttMatch[1]}`;
  const fbMatch = url.match(/facebook\.com\/.*\/videos\/(\d+)/);
  if (fbMatch) return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`;
  const fbReelMatch = url.match(/facebook\.com\/reel\/(\d+)/);
  if (fbReelMatch) return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`;
  const igMatch = url.match(/instagram\.com\/(reel|p)\/([a-zA-Z0-9_-]+)/);
  if (igMatch) return `https://www.instagram.com/${igMatch[1]}/${igMatch[2]}/embed/`;
  const twMatch = url.match(/twitter\.com\/\w+\/status\/(\d+)|x\.com\/\w+\/status\/(\d+)/);
  if (twMatch) return url;
  if (url.includes('embed') || url.includes('iframe') || url.includes('plugins/video')) return url;
  if (url.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i)) return url;
  return url;
}

export function getVideoThumbnail(url: string): string {
  if (!url) return '';
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://vumbnail.com/${vimeoMatch[1]}.jpg`;
  const dmMatch = url.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/);
  if (dmMatch) return `https://www.dailymotion.com/thumbnail/video/${dmMatch[1]}`;
  return '';
}

export function getAudioEmbedUrl(url: string): { embedUrl: string; platform: string } | null {
  if (!url) return null;
  const spotifyMatch = url.match(/open\.spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/);
  if (spotifyMatch) return { embedUrl: `https://open.spotify.com/embed/${spotifyMatch[1]}/${spotifyMatch[2]}`, platform: 'spotify' };
  const soundcloudMatch = url.match(/soundcloud\.com\/([\w-]+\/[\w-]+)/);
  if (soundcloudMatch) return { embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23059669&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false`, platform: 'soundcloud' };
  if (url.match(/\.(mp3|wav|ogg|m4a|aac)(\?.*)?$/i)) return { embedUrl: url, platform: 'direct' };
  return null;
}

export function detectVideoPlatform(url: string): string {
  if (!url) return '';
  if (url.match(/youtube\.|youtu\.be/)) return 'youtube';
  if (url.match(/vimeo\./)) return 'vimeo';
  if (url.match(/dailymotion\./)) return 'dailymotion';
  if (url.match(/tiktok\./)) return 'tiktok';
  if (url.match(/facebook\./)) return 'facebook';
  if (url.match(/instagram\./)) return 'instagram';
  if (url.match(/twitter\.|x\.com/)) return 'twitter';
  if (url.match(/\.(mp4|webm|ogg|mov)/i)) return 'direct';
  return 'other';
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs > 0 ? `${secs}s` : ''}`;
  return `${secs}s`;
}
