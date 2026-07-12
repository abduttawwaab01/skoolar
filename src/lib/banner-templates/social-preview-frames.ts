function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface SocialFrame {
  id: string;
  name: string;
  platform: string;
  description: string;
}

export const SOCIAL_FRAMES: SocialFrame[] = [
  { id: 'instagram-post', name: 'Instagram Post', platform: 'Instagram', description: '1080×1080 feed post' },
  { id: 'instagram-story', name: 'Instagram Story', platform: 'Instagram', description: '1080×1920 story' },
  { id: 'facebook-post', name: 'Facebook Post', platform: 'Facebook', description: '1200×630 feed post' },
  { id: 'twitter-post', name: 'Twitter/X Post', platform: 'Twitter', description: '1200×675 tweet' },
  { id: 'linkedin-post', name: 'LinkedIn Post', platform: 'LinkedIn', description: '1200×627 post' },
];

export function renderInstagramPostFrame(bannerDataUrl: string, schoolName: string): string {
  const name = esc(schoolName);
  return `<!DOCTYPE html>
<html><head><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#fafafa; display:flex; justify-content:center; padding:20px; }
  .card { background:#fff; border:1px solid #dbdbdb; border-radius:8px; width:470px; overflow:hidden; }
  .header { display:flex; align-items:center; padding:10px 12px; }
  .avatar { width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:14px; margin-right:10px; }
  .name { font-weight:600; font-size:14px; color:#262626; }
  .dots { margin-left:auto; color:#262626; font-size:16px; letter-spacing:2px; }
  .image { width:100%; aspect-ratio:1; object-fit:cover; display:block; }
  .actions { padding:8px 12px; display:flex; gap:12px; }
  .action { font-size:22px; cursor:pointer; }
  .likes { padding:0 12px; font-weight:600; font-size:14px; color:#262626; margin-bottom:4px; }
  .caption { padding:0 12px 12px; font-size:14px; color:#262626; }
  .caption b { font-weight:600; }
</style></head><body>
<div class="card">
  <div class="header">
    <div class="avatar">${name.charAt(0).toUpperCase()}</div>
    <div class="name">${name}</div>
    <div class="dots">•••</div>
  </div>
  <img class="image" src="${bannerDataUrl}" alt="Banner" />
  <div class="actions">
    <span class="action">♡</span>
    <span class="action">💬</span>
    <span class="action">↗</span>
  </div>
  <div class="likes">1,234 likes</div>
  <div class="caption"><b>${name}</b> Check out our latest banner!</div>
</div>
</body></html>`;
}

export function renderInstagramStoryFrame(bannerDataUrl: string, schoolName: string): string {
  const name = esc(schoolName);
  return `<!DOCTYPE html>
<html><head><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#1a1a2e; display:flex; justify-content:center; align-items:center; min-height:100vh; padding:20px; }
  .phone { width:220px; height:480px; border-radius:28px; overflow:hidden; position:relative; background:#000; border:3px solid #333; }
  .progress { position:absolute; top:6px; left:8px; right:8px; height:2px; background:rgba(255,255,255,0.3); border-radius:2px; z-index:20; }
  .progress-fill { width:40%; height:100%; background:#fff; border-radius:2px; }
  .top-bar { position:absolute; top:14px; left:10px; right:10px; display:flex; align-items:center; z-index:20; }
  .avatar { width:28px; height:28px; border-radius:50%; background:linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:11px; margin-right:8px; border:2px solid #fff; }
  .username { color:#fff; font-weight:600; font-size:12px; }
  .time { color:rgba(255,255,255,0.6); font-size:11px; margin-left:8px; }
  .img { width:100%; height:100%; object-fit:cover; display:block; }
  .reply { position:absolute; bottom:12px; left:10px; right:10px; z-index:20; }
  .reply-box { background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.3); border-radius:20px; padding:6px 12px; color:rgba(255,255,255,0.7); font-size:11px; }
</style></head><body>
<div class="phone">
  <div class="progress"><div class="progress-fill"></div></div>
  <div class="top-bar">
    <div class="avatar">${name.charAt(0).toUpperCase()}</div>
    <div class="username">${name}</div>
    <div class="time">2h</div>
  </div>
  <img class="img" src="${bannerDataUrl}" alt="Banner" />
  <div class="reply"><div class="reply-box">Send message...</div></div>
</div>
</body></html>`;
}

export function renderFacebookPostFrame(bannerDataUrl: string, schoolName: string): string {
  const name = esc(schoolName);
  return `<!DOCTYPE html>
<html><head><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#f0f2f5; display:flex; justify-content:center; padding:20px; }
  .card { background:#fff; border-radius:8px; width:500px; box-shadow:0 1px 2px rgba(0,0,0,0.1); overflow:hidden; }
  .header { display:flex; align-items:center; padding:12px; }
  .avatar { width:40px; height:40px; border-radius:50%; background:linear-gradient(135deg,#1877f2,#42a5f5); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:16px; margin-right:10px; }
  .info .name { font-weight:600; font-size:14px; color:#050505; }
  .info .meta { font-size:12px; color:#65676b; }
  .text { padding:0 12px 10px; font-size:14px; color:#050505; line-height:1.4; }
  .image { width:100%; aspect-ratio:1.9; object-fit:cover; display:block; }
  .stats { padding:8px 12px; display:flex; justify-content:space-between; border-bottom:1px solid #e4e6eb; }
  .stat { font-size:13px; color:#65676b; }
  .actions { display:flex; padding:4px 12px; }
  .act { flex:1; text-align:center; padding:8px 0; font-size:13px; font-weight:600; color:#65676b; border-radius:4px; cursor:pointer; }
  .act:hover { background:#f0f2f5; }
</style></head><body>
<div class="card">
  <div class="header">
    <div class="avatar">${name.charAt(0).toUpperCase()}</div>
    <div class="info">
      <div class="name">${name}</div>
      <div class="meta">Sponsored · · ·</div>
    </div>
  </div>
  <div class="text">Check out our latest banner!</div>
  <img class="image" src="${bannerDataUrl}" alt="Banner" />
  <div class="stats">
    <span class="stat">👍❤️ 342</span>
    <span class="stat">28 comments · 15 shares</span>
  </div>
  <div class="actions">
    <div class="act">👍 Like</div>
    <div class="act">💬 Comment</div>
    <div class="act">↗ Share</div>
  </div>
</div>
</body></html>`;
}

export function renderTwitterPostFrame(bannerDataUrl: string, schoolName: string): string {
  const name = esc(schoolName);
  return `<!DOCTYPE html>
<html><head><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#000; display:flex; justify-content:center; padding:20px; }
  .card { background:#000; border:1px solid #2f3336; border-radius:16px; width:500px; overflow:hidden; }
  .header { display:flex; padding:12px; }
  .avatar { width:40px; height:40px; border-radius:50%; background:linear-gradient(135deg,#1d9bf0,#1a8cd8); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:16px; margin-right:10px; flex-shrink:0; }
  .info { flex:1; }
  .name-row { display:flex; align-items:center; gap:4px; }
  .name { font-weight:700; font-size:15px; color:#e7e9ea; }
  .handle { font-size:15px; color:#71767b; }
  .dots { color:#e7e9ea; margin-left:auto; font-size:14px; }
  .text { padding:0 12px 10px; font-size:15px; color:#e7e9ea; line-height:1.4; }
  .image { width:100%; aspect-ratio:1.77; object-fit:cover; display:block; border:1px solid #2f3336; border-radius:12px; margin:0 12px; width:calc(100% - 24px); }
  .actions { display:flex; justify-content:space-around; padding:10px 12px; }
  .act { font-size:18px; color:#71767b; display:flex; align-items:center; gap:6px; }
  .act span { font-size:13px; }
</style></head><body>
<div class="card">
  <div class="header">
    <div class="avatar">${name.charAt(0).toUpperCase()}</div>
    <div class="info">
      <div class="name-row"><span class="name">${name}</span><span class="handle">@${name.toLowerCase().replace(/\s/g,'')}</span></div>
    </div>
    <span class="dots">···</span>
  </div>
  <div class="text">Check out our latest banner!</div>
  <img class="image" src="${bannerDataUrl}" alt="Banner" />
  <div class="actions">
    <div class="act">💬 <span>24</span></div>
    <div class="act">🔁 <span>48</span></div>
    <div class="act">❤️ <span>256</span></div>
    <div class="act">📊 <span>12K</span></div>
  </div>
</div>
</body></html>`;
}

export function renderLinkedInPostFrame(bannerDataUrl: string, schoolName: string): string {
  const name = esc(schoolName);
  return `<!DOCTYPE html>
<html><head><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#f4f2ee; display:flex; justify-content:center; padding:20px; }
  .card { background:#fff; border:1px solid #e0e0e0; border-radius:8px; width:500px; overflow:hidden; }
  .header { display:flex; align-items:center; padding:12px; }
  .avatar { width:48px; height:48px; border-radius:50%; background:linear-gradient(135deg,#0077b5,#00a0dc); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:18px; margin-right:10px; }
  .name { font-weight:600; font-size:14px; color:rgba(0,0,0,0.9); }
  .meta { font-size:12px; color:rgba(0,0,0,0.6); }
  .text { padding:0 12px 10px; font-size:14px; color:rgba(0,0,0,0.9); line-height:1.5; }
  .image { width:100%; aspect-ratio:1.9; object-fit:cover; display:block; }
  .stats { padding:8px 12px; display:flex; justify-content:space-between; font-size:12px; color:rgba(0,0,0,0.6); border-bottom:1px solid #e0e0e0; }
  .actions { display:flex; padding:4px 0; }
  .act { flex:1; text-align:center; padding:10px 0; font-size:12px; font-weight:600; color:rgba(0,0,0,0.6); cursor:pointer; }
</style></head><body>
<div class="card">
  <div class="header">
    <div class="avatar">${name.charAt(0).toUpperCase()}</div>
    <div>
      <div class="name">${name}</div>
      <div class="meta">Sponsored</div>
    </div>
  </div>
  <div class="text">Check out our latest banner!</div>
  <img class="image" src="${bannerDataUrl}" alt="Banner" />
  <div class="stats"><span>👍❤️ 156 reactions</span><span>12 comments</span></div>
  <div class="actions">
    <div class="act">👍 Like</div>
    <div class="act">💬 Comment</div>
    <div class="act">↗ Share</div>
    <div class="act">✉ Send</div>
  </div>
</div>
</body></html>`;
}

export function renderSocialFrame(
  frameId: string,
  bannerDataUrl: string,
  schoolName: string
): string {
  switch (frameId) {
    case 'instagram-post': return renderInstagramPostFrame(bannerDataUrl, schoolName);
    case 'instagram-story': return renderInstagramStoryFrame(bannerDataUrl, schoolName);
    case 'facebook-post': return renderFacebookPostFrame(bannerDataUrl, schoolName);
    case 'twitter-post': return renderTwitterPostFrame(bannerDataUrl, schoolName);
    case 'linkedin-post': return renderLinkedInPostFrame(bannerDataUrl, schoolName);
    default: return renderInstagramPostFrame(bannerDataUrl, schoolName);
  }
}
