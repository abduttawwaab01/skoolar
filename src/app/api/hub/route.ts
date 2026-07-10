import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ===================== RATE LIMITING =====================
const rateLimitCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // max 10 write ops per minute per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitCounts.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }
  record.count++;
  return record.count > RATE_LIMIT_MAX;
}

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
}

// ===================== TYPES & CONSTANTS =====================

type BadgeLevel = 'newcomer' | 'learner' | 'contributor' | 'expert' | 'master' | 'legend';

const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || 'admin@skoolar.org').toLowerCase();

export const HUB_POINTS = { post: 25, comment: 5, review: 15, likeReceived: 2, gamePlay: 3, like: 1 };

const contentTypeLabels: Record<string, string> = {
  text: 'Text',
  poem: 'Poem',
  story: 'Story',
  drama: 'Drama',
  article: 'Article',
  question: 'Question',
  debate: 'Debate',
};

const contentTypeColors: Record<string, string> = {
  text: 'bg-gray-100 text-gray-700',
  poem: 'bg-purple-100 text-purple-700',
  story: 'bg-amber-100 text-amber-700',
  drama: 'bg-rose-100 text-rose-700',
  article: 'bg-blue-100 text-blue-700',
  question: 'bg-green-100 text-green-700',
  debate: 'bg-orange-100 text-orange-700',
};

const badgeLevelThresholds: Record<BadgeLevel, number> = {
  newcomer: 0,
  learner: 200,
  contributor: 800,
  expert: 2000,
  master: 4000,
  legend: 8000,
};

const badgeColors: Record<BadgeLevel, string> = {
  newcomer: 'bg-gray-100 text-gray-600 border-gray-200',
  learner: 'bg-blue-100 text-blue-600 border-blue-200',
  contributor: 'bg-green-100 text-green-600 border-green-200',
  expert: 'bg-purple-100 text-purple-600 border-purple-200',
  master: 'bg-amber-100 text-amber-600 border-amber-200',
  legend: 'bg-gradient-to-r from-red-500 to-orange-500 text-white border-red-300',
};

function isSuperAdminEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === SUPER_ADMIN_EMAIL;
}

const funFacts = [
  "The shortest war in history lasted only 38-45 minutes, between Britain and Zanzibar on August 27, 1896.",
  "Honey never spoils. Archaeologists have found 3,000-year-old honey in Egyptian tombs that was still edible.",
  "Octopuses have three hearts and blue blood. Two hearts pump blood to the gills, and one pumps it to the body.",
  "A group of flamingos is called a 'flamboyance'.",
  "The total weight of all ants on Earth is roughly equal to the total weight of all humans.",
  "Bananas are berries, but strawberries aren't! In botany, a berry develops from a single ovary.",
  "The inventor of the Pringles can is buried in one. Fredric Baur's ashes were placed in a Pringles can after his death.",
  "A day on Venus is longer than a year on Venus. It takes 243 Earth days to rotate once on its axis.",
  "Cows have best friends and get stressed when they're separated from them.",
  "The first computer programmer was Ada Lovelace, who wrote algorithms for Charles Babbage's Analytical Engine in 1843.",
  "There are more possible iterations of a game of chess than there are atoms in the observable universe.",
  "Dolphins sleep with one eye open, keeping half their brain awake to watch for predators.",
  "The Great Wall of China is not visible from space with the naked eye, despite popular belief.",
  "A teaspoon of neutron star material would weigh about 6 billion tons on Earth.",
  "Elephants are the only animals that can't jump. But they can communicate using infrasound over distances of 10km.",
  "Light takes 8 minutes and 20 seconds to travel from the Sun to Earth.",
  "The human brain uses about 20% of the body's total energy, despite being only 2% of body weight.",
  "A bolt of lightning is five times hotter than the surface of the Sun.",
  "Butterflies taste with their feet. They have taste sensors on their legs to identify plants.",
  "There are more stars in the universe than grains of sand on all of Earth's beaches.",
  "The Hawaiian alphabet has only 12 letters: A, E, I, O, U, H, K, L, M, N, P, W.",
  "Water can boil and freeze at the same time at a specific temperature and pressure called the triple point.",
  "Sharks have been around longer than trees. Sharks: ~400 million years. Trees: ~350 million years.",
  "A jiffy is an actual unit of time — 1/100th of a second.",
  "The word 'robot' comes from the Czech word 'robota', meaning 'forced labor' or 'work'.",
  "An ostrich's eye is bigger than its brain.",
  "The Eiffel Tower can be 15 cm taller during the summer due to thermal expansion of iron.",
  "Wombat poop is cube-shaped. They use these cubes to mark their territory.",
  "The inventor of the microwave appliance received only $2 for his patent.",
  "A cloud can weigh more than a million pounds.",
  "Cats have over 20 vocalizations, including the meow.",
  "The shortest complete sentence in the English language is 'I am'.",
  "Giraffes have no vocal cords and communicate using infrasound.",
  "The Mona Lisa has no eyebrows.",
  "A group of crows is called a 'murder'.",
  "The human eye blinks an average of 4.2 million times a year.",
  "Almonds are a member of the peach family.",
  "The tongue is the only muscle attached at only one end.",
  "Astronauts shrink while in space due to lack of gravity compressing their spines.",
  "The oldest known 'your mom' joke was discovered on a 3,500-year-old Babylonian tablet.",
  "Maine is the closest U.S. state to Africa.",
  "You can't hum while holding your nose closed.",
  "The dot over the letters 'i' and 'j' is called a tittle.",
  "A group of porcupines is called a 'prickle'.",
  "The inventor of the stop sign was a priest.",
  "Dolphins have names for each other and respond when called.",
  "The shortest verse in the Bible is 'Jesus wept' (John 11:35).",
  "A rhinoceros's horn is made of compacted hair, not bone.",
  "The inventor of the television never let his children watch it.",
];

// ===================== HELPERS =====================

function calculateBadge(points: number): BadgeLevel {
  if (points >= 8000) return 'legend';
  if (points >= 4000) return 'master';
  if (points >= 2000) return 'expert';
  if (points >= 800) return 'contributor';
  if (points >= 200) return 'learner';
  return 'newcomer';
}

function getNextBadgeThreshold(points: number): number {
  const badge = calculateBadge(points);
  const idx = (Object.keys(badgeLevelThresholds) as BadgeLevel[]).indexOf(badge);
  const levels = Object.keys(badgeLevelThresholds) as BadgeLevel[];
  if (idx >= levels.length - 1) return points + 1000;
  return badgeLevelThresholds[levels[idx + 1]];
}

function formatUser(user: any) {
  const badge = user.badge as BadgeLevel;
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email || '',
    avatar: user.avatar || undefined,
    bio: user.bio || undefined,
    badge,
    points: user.points,
    postsCount: user.totalPosts,
    isBanned: user.isBanned,
    isModerator: user.isModerator || false,
    createdAt: user.createdAt?.toISOString?.() || new Date().toISOString(),
    lastActive: user.lastSeenAt?.toISOString?.() || user.createdAt?.toISOString?.() || new Date().toISOString(),
    badgeColor: badgeColors[badge],
  };
}

function formatPost(post: any, authorMap: Map<string, any>, channelMap: Map<string, any>, likeMap: Map<string, string[]>) {
  const author = authorMap.get(post.hubUserId);
  const channel = post.channelId ? channelMap.get(post.channelId) : null;
  const likedBy = likeMap.get(post.id) || [];
  const badge = (author?.badge || 'newcomer') as BadgeLevel;

  return {
    id: post.id,
    authorId: post.hubUserId,
    authorName: author?.displayName || 'Unknown',
    channelId: post.channelId || '',
    title: post.title || '',
    content: post.content,
    contentType: post.contentType,
    category: post.category || 'General',
    tags: post.tags ? JSON.parse(post.tags) : [],
    imageUrl: post.imageUrl || '',
    mediaUrl: post.mediaUrl || '',
    mediaType: post.mediaType || '',
    likes: post.likeCount,
    likedBy,
    commentsCount: post.commentCount,
    reviewsCount: 0, // Will be filled separately if needed
    isPinned: post.isPinned,
    isFeatured: post.isFeatured,
    isHidden: post.isHidden,
    isFlagged: post.isFlagged,
    createdAt: post.createdAt?.toISOString?.() || new Date().toISOString(),
    channel: channel ? {
      id: channel.id,
      name: channel.name,
      description: channel.description || '',
      icon: channel.icon || 'MessageCircle',
      postsCount: 0,
      isDefault: false,
    } : undefined,
    authorBadge: badge,
    authorBadgeColor: badgeColors[badge],
    contentTypeLabel: contentTypeLabels[post.contentType] || post.contentType,
    contentTypeColor: contentTypeColors[post.contentType] || 'bg-gray-100 text-gray-700',
  };
}

function formatGame(game: any) {
  let gameData: Record<string, any> = {};
  try {
    gameData = game.gameData ? JSON.parse(game.gameData) : {};
  } catch { /* ignore */ }

  return {
    id: game.id,
    title: game.title,
    description: game.description || '',
    category: game.category,
    difficulty: game.difficulty,
    plays: game.playCount,
    icon: gameData.icon || 'Gamepad2',
    color: gameData.color || 'from-gray-500 to-gray-600',
    isFeatured: game.isFeatured,
    url: gameData.url || '#',
    createdAt: game.createdAt?.toISOString?.() || new Date().toISOString(),
  };
}

function formatComment(comment: any, authorMap: Map<string, any>) {
  const author = authorMap.get(comment.hubUserId);
  const badge = (author?.badge || 'newcomer') as BadgeLevel;
  return {
    id: comment.id,
    postId: comment.postId || '',
    authorId: comment.hubUserId,
    authorName: author?.displayName || 'Unknown',
    content: comment.content,
    parentId: comment.parentId,
    likes: comment.likeCount,
    createdAt: comment.createdAt?.toISOString?.() || new Date().toISOString(),
    authorBadge: badge,
    authorBadgeColor: badgeColors[badge],
  };
}

function formatReview(review: any, authorMap: Map<string, any>) {
  const author = authorMap.get(review.hubUserId);
  const badge = (author?.badge || 'newcomer') as BadgeLevel;
  return {
    id: review.id,
    postId: review.postId,
    authorId: review.hubUserId,
    authorName: author?.displayName || 'Unknown',
    rating: review.rating,
    comment: review.content,
    createdAt: review.createdAt?.toISOString?.() || new Date().toISOString(),
    authorBadge: badge,
    authorBadgeColor: badgeColors[badge],
  };
}

// ===================== DEFAULT CHANNEL =====================

let channelPromise: Promise<void> | null = null;

async function ensureDefaultChannel() {
  if (channelPromise) return channelPromise;

  channelPromise = (async () => {
    try {
      const existing = await db.hubChannel.findFirst({ where: { name: 'General' } });
      if (existing) return;
      await db.hubChannel.create({
        data: {
          name: 'General',
          description: 'General discussions and introductions',
          icon: 'MessageCircle',
          sortOrder: 0,
        },
      });
    } catch (error) {
      console.error('Failed to ensure default channel:', error);
    }
  })();

  return channelPromise;
}

// ===================== ROUTE HANDLERS =====================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    // Ensure default channel exists
    await ensureDefaultChannel();

    switch (action) {
      // --- Get User ---
      case 'get-user': {
        const userId = searchParams.get('userId');
        if (!userId) return NextResponse.json({ success: false, message: 'userId required' }, { status: 400 });
        const user = await db.hubUser.findUnique({ where: { id: userId } });
        if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
        return NextResponse.json({ success: true, data: formatUser(user) });
      }

      // --- Users ---
      case 'users': {
        const search = searchParams.get('search')?.toLowerCase() || '';
        const users = await db.hubUser.findMany({
          where: {
            ...(search ? {
              OR: [
                { displayName: { contains: search } },
                { email: { contains: search } },
              ]
            } : {}),
          },
          orderBy: { points: 'desc' },
        });
        return NextResponse.json({ success: true, data: users.map(formatUser) });
      }

      // --- Leaderboard ---
      case 'leaderboard': {
        const users = await db.hubUser.findMany({
          orderBy: { points: 'desc' },
          take: 20,
        });
        return NextResponse.json({
          success: true,
          data: users.map((u, i) => ({
            ...formatUser(u),
            rank: i + 1,
            nextLevelPoints: getNextBadgeThreshold(u.points),
          }))
        });
      }

      // --- Channels ---
      case 'channels': {
        const channels = await db.hubChannel.findMany({
          orderBy: { sortOrder: 'asc' },
          include: {
            _count: { select: { posts: true } },
          },
        });
        return NextResponse.json({
          success: true,
          data: channels.map(c => ({
            id: c.id,
            name: c.name,
            description: c.description || '',
            icon: c.icon || 'MessageCircle',
            postsCount: c._count.posts,
            isDefault: c.name === 'General',
          }))
        });
      }

      // --- Posts ---
      case 'posts': {
        const channelId = searchParams.get('channelId') || 'all';
        const contentType = searchParams.get('contentType');
        const search = searchParams.get('search')?.toLowerCase() || '';
        const authorId = searchParams.get('authorId');
        const sort = searchParams.get('sort') || 'recent';

        const where: any = { isHidden: false };

        if (channelId !== 'all') where.channelId = channelId;
        if (contentType) where.contentType = contentType;
        if (authorId) where.hubUserId = authorId;
        if (search) {
          where.OR = [
            { title: { contains: search, mode: 'insensitive' } },
            { content: { contains: search, mode: 'insensitive' } },
          ];
        }

        const orderBy: any = sort === 'popular' ? { likeCount: 'desc' }
          : sort === 'commented' ? { commentCount: 'desc' }
          : { createdAt: 'desc' };

        const posts = await db.hubPost.findMany({
          where,
          orderBy,
          include: {
            author: { select: { id: true, displayName: true, badge: true } },
            channel: { select: { id: true, name: true, description: true, icon: true } },
          },
        });

        // Get all likes for these posts
        const postIds = posts.map(p => p.id);
        const likes = postIds.length > 0
          ? await db.hubLike.findMany({
              where: { postId: { in: postIds } },
              select: { postId: true, hubUserId: true },
            })
          : [];

        const likeMap = new Map<string, string[]>();
        for (const like of likes) {
          const arr = likeMap.get(like.postId || '') || [];
          arr.push(like.hubUserId || '');
          likeMap.set(like.postId || '', arr);
        }

        // Build author and channel maps
        const authorMap = new Map<string, any>();
        for (const p of posts) {
          if (p.author && !authorMap.has(p.author.id)) {
            authorMap.set(p.author.id, p.author);
          }
        }
        const channelMap = new Map<string, any>();
        for (const p of posts) {
          if (p.channel && !channelMap.has(p.channel.id)) {
            channelMap.set(p.channel.id, p.channel);
          }
        }

        // Get review counts for posts
        const reviewCounts = postIds.length > 0
          ? await db.hubReview.groupBy({
              by: ['postId'],
              where: { postId: { in: postIds } },
              _count: { id: true },
            })
          : [];
        const reviewCountMap = new Map<string, number>();
        for (const rc of reviewCounts) {
          reviewCountMap.set(rc.postId, rc._count.id);
        }

        const formatted = posts.map(p => {
          const fp = formatPost(p, authorMap, channelMap, likeMap);
          fp.reviewsCount = reviewCountMap.get(p.id) || 0;
          return fp;
        });

        // Pinned first
        const pinned = formatted.filter(p => p.isPinned);
        const unpinned = formatted.filter(p => !p.isPinned);

        return NextResponse.json({ success: true, data: [...pinned, ...unpinned] });
      }

      // --- Single Post ---
      case 'post': {
        const postId = searchParams.get('postId');
        if (!postId) return NextResponse.json({ success: false, message: 'postId required' }, { status: 400 });

        const post = await db.hubPost.findUnique({
          where: { id: postId },
          include: {
            author: { select: { id: true, displayName: true, badge: true } },
            channel: { select: { id: true, name: true, description: true, icon: true } },
          },
        });

        if (!post) return NextResponse.json({ success: false, message: 'Post not found' }, { status: 404 });

        // Get likes
        const postLikes = await db.hubLike.findMany({
          where: { postId },
          select: { hubUserId: true },
        });
        const likeMap = new Map<string, string[]>();
        likeMap.set(post.id, postLikes.map(l => l.hubUserId));

        // Get comments
        const comments = await db.hubComment.findMany({
          where: { postId },
          orderBy: { createdAt: 'asc' },
        });

        // Build author map for comments
        const commentAuthorIds = Array.from(new Set(comments.map(c => c.hubUserId)));
        const commentAuthors = commentAuthorIds.length > 0
          ? await db.hubUser.findMany({
              where: { id: { in: commentAuthorIds } },
              select: { id: true, displayName: true, badge: true },
            })
          : [];
        const authorMap = new Map<string, any>();
        for (const a of commentAuthors) authorMap.set(a.id, a);
        if (post.author) authorMap.set(post.author.id, post.author);

        // Get reviews
        const reviews = await db.hubReview.findMany({
          where: { postId },
          orderBy: { createdAt: 'desc' },
        });

        // Review author IDs
        const reviewAuthorIds = Array.from(new Set(reviews.map(r => r.hubUserId)));
        const reviewAuthors = reviewAuthorIds.length > 0
          ? await db.hubUser.findMany({
              where: { id: { in: reviewAuthorIds } },
              select: { id: true, displayName: true, badge: true },
            })
          : [];
        const reviewAuthorMap = new Map<string, any>();
        for (const a of reviewAuthors) reviewAuthorMap.set(a.id, a);

        const channelMap = new Map<string, any>();
        if (post.channel) channelMap.set(post.channel.id, post.channel);

        const formattedPost = formatPost(post, authorMap, channelMap, likeMap);

        // Build comment tree
        const formattedComments = comments.map(c => formatComment(c, authorMap));
        const commentMap = new Map<string, any>();
        for (const c of formattedComments) {
          (c as any).children = [];
          commentMap.set(c.id, c);
        }
        const rootComments: any[] = [];
        for (const c of formattedComments) {
          if (c.parentId && commentMap.has(c.parentId)) {
            commentMap.get(c.parentId).children.push(c);
          } else {
            rootComments.push(c);
          }
        }

        const formattedReviews = reviews.map(r => formatReview(r, reviewAuthorMap));
        const avgRating = reviews.length > 0
          ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
          : 0;

        return NextResponse.json({
          success: true,
          data: {
            ...formattedPost,
            reviewsCount: reviews.length,
            comments: rootComments,
            reviews: formattedReviews,
            avgRating,
          }
        });
      }

      // --- Games ---
      case 'games': {
        const featured = searchParams.get('featured') === 'true';
        const games = await db.hubGame.findMany({
          where: { ...(featured ? { isFeatured: true } : {}), isPublished: true },
          orderBy: { playCount: 'desc' },
        });
        return NextResponse.json({ success: true, data: games.map(formatGame) });
      }

      // --- Fun Fact ---
      case 'fun-fact': {
        const randomIndex = Math.floor(Math.random() * funFacts.length);
        return NextResponse.json({ success: true, data: { fact: funFacts[randomIndex], index: randomIndex } });
      }

      // --- Admin Stats ---
      case 'admin-stats': {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [
          totalUsers, totalPosts, totalGames, totalReviews, totalComments,
          activeToday, flaggedPosts, pinnedPosts,
        ] = await Promise.all([
          db.hubUser.count(),
          db.hubPost.count(),
          db.hubGame.count(),
          db.hubReview.count(),
          db.hubComment.count(),
          db.hubUser.count({ where: { lastSeenAt: { gte: today } } }),
          db.hubPost.count({ where: { isFlagged: true } }),
          db.hubPost.count({ where: { isPinned: true } }),
        ]);

        return NextResponse.json({
          success: true,
          data: {
            totalUsers, totalPosts, totalGames, totalReviews, totalComments,
            activeToday, flaggedPosts, pinnedPosts,
          }
        });
      }

      // --- Flagged Posts ---
      case 'flagged': {
        const posts = await db.hubPost.findMany({
          where: { isFlagged: true },
          include: {
            author: { select: { id: true, displayName: true, badge: true } },
            channel: { select: { id: true, name: true, description: true, icon: true } },
          },
          orderBy: { createdAt: 'desc' },
        });

        const authorMap = new Map<string, any>();
        for (const p of posts) {
          if (p.author && !authorMap.has(p.author.id)) authorMap.set(p.author.id, p.author);
        }
        const channelMap = new Map<string, any>();
        for (const p of posts) {
          if (p.channel && !channelMap.has(p.channel.id)) channelMap.set(p.channel.id, p.channel);
        }
        const likeMap = new Map<string, string[]>();

        return NextResponse.json({
          success: true,
          data: posts.map(p => formatPost(p, authorMap, channelMap, likeMap))
        });
      }

      default:
        return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Hub GET error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const body = await request.json().catch(() => ({}));

  // Rate limiting for write operations
  if (isRateLimited(getClientIp(request))) {
    return NextResponse.json({ success: false, message: 'Too many requests. Please slow down.' }, { status: 429 });
  }

  try {
    await ensureDefaultChannel();

    switch (action) {
      // --- Register ---
      case 'register': {
        const { displayName, email } = body;
        if (!displayName || typeof displayName !== 'string' || displayName.trim().length < 2 || displayName.trim().length > 50) {
          return NextResponse.json({ success: false, message: 'Display name must be 2-50 characters' }, { status: 400 });
        }

        // Check if displayName already taken
        const existing = await db.hubUser.findUnique({ where: { displayName: displayName.trim() } });
        if (existing) {
          return NextResponse.json({ success: false, message: 'Display name already taken' }, { status: 409 });
        }

        // Auto-grant moderator for the platform super admin email
        const isModerator = typeof email === 'string' && email.trim().toLowerCase() === 'admin@skoolar.org';

        const user = await db.hubUser.create({
          data: {
            displayName: displayName.trim(),
            email: typeof email === 'string' ? email.trim().slice(0, 100) : null,
            isModerator,
            points: isModerator ? 5000 : 10,
            badge: isModerator ? 'legend' : 'newcomer',
            lastSeenAt: new Date(),
          },
        });

        return NextResponse.json({ success: true, data: formatUser(user) });
      }

      // --- Login (lookup by email or displayName) ---
      case 'login': {
        const { email: loginEmail, displayName: loginName } = body;
        if ((!loginEmail || typeof loginEmail !== 'string') && (!loginName || typeof loginName !== 'string')) {
          return NextResponse.json({ success: false, message: 'Email or display name required' }, { status: 400 });
        }
        const where: Record<string, unknown> = loginEmail ? { email: loginEmail.trim().toLowerCase() } : { displayName: loginName.trim() };
        let user = await db.hubUser.findFirst({ where });
        if (!user) {
          return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
        }
        if (user.isBanned) {
          return NextResponse.json({ success: false, message: 'Account is banned' }, { status: 403 });
        }

        const isPlatformAdmin = user.email?.toLowerCase() === 'admin@skoolar.org';
        let updatedData: any = { lastSeenAt: new Date() };
        
        if (isPlatformAdmin && !user.isModerator) {
          updatedData.isModerator = true;
          updatedData.points = Math.max(user.points, 5000);
          updatedData.badge = calculateBadge(Math.max(user.points, 5000));
        }

        user = await db.hubUser.update({ 
          where: { id: user.id }, 
          data: updatedData 
        });

        return NextResponse.json({ success: true, data: formatUser(user) });
      }

      // --- Create Post ---
      case 'create-post': {
        const { authorId, authorName, channelId, title, content, contentType, category, tags, imageUrl, mediaUrl, mediaType } = body;
        if (!authorId || !title || !content || !channelId) {
          return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const user = await db.hubUser.findUnique({ where: { id: authorId } });
        if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
        if (user.isBanned) return NextResponse.json({ success: false, message: 'User is banned' }, { status: 403 });

        const post = await db.hubPost.create({
          data: {
            hubUserId: authorId,
            channelId,
            title: String(title).slice(0, 200),
            content: String(content).slice(0, 50000),
            contentType: contentType || 'text',
            category: category || 'General',
            tags: Array.isArray(tags) ? JSON.stringify(tags.map(String).slice(0, 10)) : null,
            imageUrl: typeof imageUrl === 'string' ? imageUrl.slice(0, 500) : null,
            mediaUrl: typeof mediaUrl === 'string' ? mediaUrl.slice(0, 500) : null,
            mediaType: typeof mediaType === 'string' ? mediaType.slice(0, 50) : null,
          },
        });

        // Add points to user
        const newPoints = Math.max(0, user.points + 25);
        const newBadge = calculateBadge(newPoints);
        await db.hubUser.update({
          where: { id: authorId },
          data: { points: newPoints, badge: newBadge, totalPosts: { increment: 1 } },
        });

        // Get channel info
        const channel = await db.hubChannel.findUnique({ where: { id: channelId } });

        const badge = newBadge as BadgeLevel;
        return NextResponse.json({
          success: true,
          data: {
            id: post.id,
            authorId,
            authorName: authorName || user.displayName,
            channelId,
            title: post.title,
            content: post.content,
            contentType: post.contentType,
            category: post.category || 'General',
            tags: Array.isArray(tags) ? tags.map(String).slice(0, 10) : [],
            imageUrl: post.imageUrl || '',
            likes: 0,
            likedBy: [],
            commentsCount: 0,
            reviewsCount: 0,
            isPinned: false, isFeatured: false, isHidden: false, isFlagged: false,
            createdAt: post.createdAt.toISOString(),
            channel: channel ? {
              id: channel.id, name: channel.name, description: channel.description || '',
              icon: channel.icon || 'MessageCircle', postsCount: 0, isDefault: false,
            } : undefined,
            authorBadge: badge,
            authorBadgeColor: badgeColors[badge],
            contentTypeLabel: contentTypeLabels[post.contentType] || post.contentType,
            contentTypeColor: contentTypeColors[post.contentType] || 'bg-gray-100 text-gray-700',
          }
        });
      }

      // --- Like Post ---
      case 'like-post': {
        const { postId, userId } = body;
        if (!postId || !userId) return NextResponse.json({ success: false, message: 'Missing fields' }, { status: 400 });

        const post = await db.hubPost.findUnique({ where: { id: postId } });
        if (!post) return NextResponse.json({ success: false, message: 'Post not found' }, { status: 404 });

        // Check if already liked
        const existingLike = await db.hubLike.findFirst({
          where: { hubUserId: userId, postId },
        });

        if (existingLike) {
          // Unlike
          await db.hubLike.delete({ where: { id: existingLike.id } });
          await db.hubPost.update({
            where: { id: postId },
            data: { likeCount: { decrement: 1 } },
          });

          // Remove points from liker
          const liker = await db.hubUser.findUnique({ where: { id: userId } });
          if (liker) {
            const newPoints = Math.max(0, liker.points - 1);
            await db.hubUser.update({
              where: { id: userId },
              data: { points: newPoints, badge: calculateBadge(newPoints), totalLikes: { decrement: 1 } },
            });
          }

          const updatedPost = await db.hubPost.findUnique({ where: { id: postId } });
          return NextResponse.json({ success: true, data: { likes: updatedPost?.likeCount || 0, liked: false } });
        } else {
          // Like
          await db.hubLike.create({
            data: { hubUserId: userId, postId },
          });
          await db.hubPost.update({
            where: { id: postId },
            data: { likeCount: { increment: 1 } },
          });

          // Add points to liker
          const liker = await db.hubUser.findUnique({ where: { id: userId } });
          if (liker) {
            const newPoints = liker.points + 1;
            await db.hubUser.update({
              where: { id: userId },
              data: { points: newPoints, badge: calculateBadge(newPoints), totalLikes: { increment: 1 } },
            });
          }

          // Add points to post author
          if (post.hubUserId !== userId) {
            const author = await db.hubUser.findUnique({ where: { id: post.hubUserId } });
            if (author) {
              const newPoints = author.points + 2;
              await db.hubUser.update({
                where: { id: post.hubUserId },
                data: { points: newPoints, badge: calculateBadge(newPoints) },
              });
            }
          }

          const updatedPost = await db.hubPost.findUnique({ where: { id: postId } });
          return NextResponse.json({ success: true, data: { likes: updatedPost?.likeCount || 0, liked: true } });
        }
      }

      // --- Create Comment ---
      case 'create-comment': {
        const { postId, authorId, authorName, content, parentId } = body;
        if (!postId || !authorId || !content) return NextResponse.json({ success: false, message: 'Missing fields' }, { status: 400 });

        const user = await db.hubUser.findUnique({ where: { id: authorId } });
        if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
        if (user.isBanned) return NextResponse.json({ success: false, message: 'User is banned' }, { status: 403 });

        const post = await db.hubPost.findUnique({ where: { id: postId } });
        if (!post) return NextResponse.json({ success: false, message: 'Post not found' }, { status: 404 });

        const comment = await db.hubComment.create({
          data: {
            postId,
            hubUserId: authorId,
            content: String(content).slice(0, 5000),
            parentId: parentId || null,
          },
        });

        // Increment comment count on post
        await db.hubPost.update({
          where: { id: postId },
          data: { commentCount: { increment: 1 } },
        });

        // Add points to user
        const newPoints = Math.max(0, user.points + 5);
        const newBadge = calculateBadge(newPoints);
        await db.hubUser.update({
          where: { id: authorId },
          data: { points: newPoints, badge: newBadge },
        });

        const badge = newBadge as BadgeLevel;
        return NextResponse.json({
          success: true,
          data: {
            id: comment.id,
            postId,
            authorId,
            authorName: authorName || user.displayName,
            content: comment.content,
            parentId: comment.parentId,
            likes: 0,
            createdAt: comment.createdAt.toISOString(),
            authorBadge: badge,
            authorBadgeColor: badgeColors[badge],
          }
        });
      }

      // --- Create Review ---
      case 'create-review': {
        const { postId, authorId, authorName, rating, comment } = body;
        if (!postId || !authorId || !rating || rating < 1 || rating > 5) {
          return NextResponse.json({ success: false, message: 'Invalid fields. Rating must be 1-5.' }, { status: 400 });
        }

        const user = await db.hubUser.findUnique({ where: { id: authorId } });
        if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
        if (user.isBanned) return NextResponse.json({ success: false, message: 'User is banned' }, { status: 403 });

        const post = await db.hubPost.findUnique({ where: { id: postId } });
        if (!post) return NextResponse.json({ success: false, message: 'Post not found' }, { status: 404 });

        // Check if already reviewed
        const existingReview = await db.hubReview.findFirst({
          where: { hubUserId: authorId, postId },
        });

        if (existingReview) {
          // Update existing review
          await db.hubReview.update({
            where: { id: existingReview.id },
            data: {
              rating,
              content: String(comment || '').slice(0, 1000),
            },
          });
        } else {
          // Create new review
          await db.hubReview.create({
            data: {
              postId,
              hubUserId: authorId,
              rating,
              content: String(comment || '').slice(0, 1000),
            },
          });

          // Add points
          const newPoints = Math.max(0, user.points + 15);
          const newBadge = calculateBadge(newPoints);
          await db.hubUser.update({
            where: { id: authorId },
            data: { points: newPoints, badge: newBadge, totalReviews: { increment: 1 } },
          });

          // Add points to post author
          if (post.hubUserId !== authorId) {
            const author = await db.hubUser.findUnique({ where: { id: post.hubUserId } });
            if (author) {
              const authorNewPoints = author.points + 5;
              await db.hubUser.update({
                where: { id: post.hubUserId },
                data: { points: authorNewPoints, badge: calculateBadge(authorNewPoints) },
              });
            }
          }
        }

        // Count reviews for this post
        const reviewsCount = await db.hubReview.count({ where: { postId } });
        return NextResponse.json({ success: true, data: { reviewsCount } });
      }

      // --- Sync user from NextAuth session (Learning Hub → Platform SSO) ---
      case 'sync-user': {
        const { platformUserId, name, email } = body;
        if (!platformUserId) {
          return NextResponse.json({ success: false, message: 'platformUserId required' }, { status: 400 });
        }

        // Check if HubUser already exists linked to this platform user
        let hubUser = await db.hubUser.findUnique({
          where: { userId: platformUserId as string },
        });

        if (hubUser) {
          // Update last seen and display name if changed
          hubUser = await db.hubUser.update({
            where: { id: hubUser.id },
            data: {
              lastSeenAt: new Date(),
              ...(name ? { displayName: String(name).slice(0, 50) } : {}),
              ...(email ? { email: String(email).slice(0, 100).toLowerCase() } : {}),
            },
          });
        } else {
          // Create new HubUser linked to this platform user
          const displayName = String(name || email || 'User').slice(0, 50);
          // Ensure unique displayName
          let uniqueName = displayName;
          let counter = 1;
          while (await db.hubUser.findUnique({ where: { displayName: uniqueName } })) {
            uniqueName = `${displayName}_${counter}`;
            counter++;
          }
          hubUser = await db.hubUser.create({
            data: {
              userId: platformUserId as string,
              displayName: uniqueName,
              email: email ? String(email).slice(0, 100).toLowerCase() : null,
              lastSeenAt: new Date(),
              points: 10,
            },
          });
        }

        return NextResponse.json({ success: true, data: formatUser(hubUser) });
      }

      // --- Create Channel ---
      case 'create-channel': {
        const { name, description, icon } = body;
        if (!name) return NextResponse.json({ success: false, message: 'Channel name required' }, { status: 400 });

        const channel = await db.hubChannel.create({
          data: {
            name: String(name).slice(0, 50),
            description: String(description || '').slice(0, 200),
            icon: icon || 'MessageCircle',
          },
        });

        return NextResponse.json({
          success: true,
          data: {
            id: channel.id,
            name: channel.name,
            description: channel.description || '',
            icon: channel.icon || 'MessageCircle',
            postsCount: 0,
            isDefault: false,
          }
        });
      }

      // --- Create Game ---
      case 'create-game': {
        const { title, description, category, difficulty, icon, color, url } = body;
        if (!title) return NextResponse.json({ success: false, message: 'Game title required' }, { status: 400 });

        const gameData = JSON.stringify({
          icon: icon || 'Gamepad2',
          color: color || 'from-gray-500 to-gray-600',
          url: url || '#',
        });

        const game = await db.hubGame.create({
          data: {
            hubUserId: body.authorId || 'u1',
            title: String(title).slice(0, 100),
            description: String(description || '').slice(0, 500),
            category: category || 'General',
            difficulty: difficulty || 'easy',
            gameData,
          },
        });

        return NextResponse.json({ success: true, data: formatGame(game) });
      }

      // --- Play Game ---
      case 'play-game': {
        const { gameId, userId } = body;
        if (!gameId) return NextResponse.json({ success: false, message: 'gameId required' }, { status: 400 });

        const game = await db.hubGame.findUnique({ where: { id: gameId } });
        if (!game) return NextResponse.json({ success: false, message: 'Game not found' }, { status: 404 });

        await db.hubGame.update({
          where: { id: gameId },
          data: { playCount: { increment: 1 } },
        });

        if (userId) {
          const user = await db.hubUser.findUnique({ where: { id: userId } });
          if (user) {
            const newPoints = Math.max(0, user.points + 3);
            await db.hubUser.update({
              where: { id: userId },
              data: { points: newPoints, badge: calculateBadge(newPoints) },
            });
          }
        }

        const updatedGame = await db.hubGame.findUnique({ where: { id: gameId } });
        return NextResponse.json({ success: true, data: { plays: updatedGame?.playCount || 0 } });
      }

      default:
        return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Hub POST error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const body = await request.json().catch(() => ({}));

  // Rate limiting for write operations
  if (isRateLimited(getClientIp(request))) {
    return NextResponse.json({ success: false, message: 'Too many requests. Please slow down.' }, { status: 429 });
  }

  try {
    switch (action) {
      // --- Update User (admin) ---
      case 'update-user': {
        const { userId, displayName, isBanned } = body;
        if (!userId) return NextResponse.json({ success: false, message: 'userId required' }, { status: 400 });

        const user = await db.hubUser.findUnique({ where: { id: userId } });
        if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });

        const updateData: any = {};
        if (typeof displayName === 'string') updateData.displayName = displayName.slice(0, 50);
        if (typeof isBanned === 'boolean') {
          updateData.isBanned = isBanned;
          if (isBanned) {
            updateData.bannedAt = new Date();
          } else {
            updateData.bannedAt = null;
            updateData.banReason = null;
          }
        }

        const updatedUser = await db.hubUser.update({
          where: { id: userId },
          data: updateData,
        });

        return NextResponse.json({ success: true, data: formatUser(updatedUser) });
      }

      // --- Update Post (admin) ---
      case 'update-post': {
        const { postId, isPinned, isFeatured, isHidden, isFlagged } = body;
        if (!postId) return NextResponse.json({ success: false, message: 'postId required' }, { status: 400 });

        const post = await db.hubPost.findUnique({ where: { id: postId } });
        if (!post) return NextResponse.json({ success: false, message: 'Post not found' }, { status: 404 });

        const updateData: any = {};
        if (typeof isPinned === 'boolean') updateData.isPinned = isPinned;
        if (typeof isFeatured === 'boolean') updateData.isFeatured = isFeatured;
        if (typeof isHidden === 'boolean') updateData.isHidden = isHidden;
        if (typeof isFlagged === 'boolean') updateData.isFlagged = isFlagged;

        const updatedPost = await db.hubPost.update({
          where: { id: postId },
          data: updateData,
        });

        return NextResponse.json({ success: true, data: { id: updatedPost.id, ...updateData } });
      }

      // --- Update Channel (admin) ---
      case 'update-channel': {
        const { channelId, name, description, icon } = body;
        if (!channelId) return NextResponse.json({ success: false, message: 'channelId required' }, { status: 400 });

        const channel = await db.hubChannel.findUnique({ where: { id: channelId } });
        if (!channel) return NextResponse.json({ success: false, message: 'Channel not found' }, { status: 404 });

        const updateData: any = {};
        if (typeof name === 'string') updateData.name = name.slice(0, 50);
        if (typeof description === 'string') updateData.description = description.slice(0, 200);
        if (typeof icon === 'string') updateData.icon = icon;

        const updatedChannel = await db.hubChannel.update({
          where: { id: channelId },
          data: updateData,
        });

        return NextResponse.json({
          success: true,
          data: {
            id: updatedChannel.id,
            name: updatedChannel.name,
            description: updatedChannel.description || '',
            icon: updatedChannel.icon || 'MessageCircle',
          }
        });
      }

      // --- Update Game (admin) ---
      case 'update-game': {
        const { gameId, title, description, isFeatured } = body;
        if (!gameId) return NextResponse.json({ success: false, message: 'gameId required' }, { status: 400 });

        const game = await db.hubGame.findUnique({ where: { id: gameId } });
        if (!game) return NextResponse.json({ success: false, message: 'Game not found' }, { status: 404 });

        const updateData: any = {};
        if (typeof title === 'string') updateData.title = title.slice(0, 100);
        if (typeof description === 'string') updateData.description = description.slice(0, 500);
        if (typeof isFeatured === 'boolean') updateData.isFeatured = isFeatured;

        const updatedGame = await db.hubGame.update({
          where: { id: gameId },
          data: updateData,
        });

        return NextResponse.json({ success: true, data: formatGame(updatedGame) });
      }

      // --- Members (list all with follow status) ---
      case 'members': {
        const { viewerId } = body;
        const members = await db.hubUser.findMany({
          where: { isBanned: false },
          orderBy: { points: 'desc' },
          select: {
            id: true,
            displayName: true,
            email: true,
            avatar: true,
            bio: true,
            points: true,
            badge: true,
            isModerator: true,
            totalPosts: true,
            totalLikes: true,
            lastSeenAt: true,
            createdAt: true,
          },
        });

        // Get follow relationships for viewer
        let followingSet = new Set<string>();
        if (viewerId) {
          const follows = await db.hubFollow.findMany({
            where: { followerId: viewerId },
            select: { followingId: true },
          });
          followingSet = new Set(follows.map(f => f.followingId));
        }

        // Get follower counts for each member
        const followerCounts = await db.hubFollow.groupBy({
          by: ['followingId'],
          _count: { followerId: true },
        });
        const followerCountMap = new Map(followerCounts.map(f => [f.followingId, f._count.followerId]));
        // Get following counts for each member
        const followingCounts = await db.hubFollow.groupBy({
          by: ['followerId'],
          _count: { followingId: true },
        });
        const followingCountMap = new Map(followingCounts.map(f => [f.followerId, f._count.followingId]));

        const data = members.map(m => {
          const badge = m.badge as BadgeLevel;
          return {
            id: m.id,
            displayName: m.displayName,
            email: m.email || '',
            avatar: m.avatar || undefined,
            bio: m.bio || undefined,
            badge,
            points: m.points,
            postsCount: m.totalPosts,
            isModerator: m.isModerator,
            followerCount: followerCountMap.get(m.id) || 0,
            followingCount: followingCountMap.get(m.id) || 0,
            isFollowedByViewer: followingSet.has(m.id),
            lastActive: m.lastSeenAt?.toISOString?.() || m.createdAt?.toISOString?.() || new Date().toISOString(),
            badgeColor: badgeColors[badge],
          };
        });

        return NextResponse.json({ success: true, data });
      }

      // --- Follow a member ---
      case 'follow': {
        const { followerId, followingId } = body;
        if (!followerId || !followingId || followerId === followingId) {
          return NextResponse.json({ success: false, message: 'Invalid follow request' }, { status: 400 });
        }
        const existing = await db.hubFollow.findUnique({
          where: { followerId_followingId: { followerId, followingId } },
        });
        if (existing) {
          return NextResponse.json({ success: true, data: { followed: true } });
        }
        await db.hubFollow.create({ data: { followerId, followingId } });
        return NextResponse.json({ success: true, data: { followed: true } });
      }

      // --- Unfollow a member ---
      case 'unfollow': {
        const { followerId: uFollowerId, followingId: uFollowingId } = body;
        if (!uFollowerId || !uFollowingId) {
          return NextResponse.json({ success: false, message: 'Invalid unfollow request' }, { status: 400 });
        }
        await db.hubFollow.deleteMany({
          where: { followerId: uFollowerId, followingId: uFollowingId },
        });
        return NextResponse.json({ success: true, data: { followed: false } });
      }

      // --- List all moderators ---
      case 'list-moderators': {
        const mods = await db.hubUser.findMany({
          where: { isModerator: true, isBanned: false },
          orderBy: { points: 'desc' },
        });
        return NextResponse.json({ success: true, data: mods.map(formatUser) });
      }

      // --- Assign moderator ---
      case 'assign-moderator': {
        const { targetUserId, requesterId } = body;
        if (!targetUserId || !requesterId) {
          return NextResponse.json({ success: false, message: 'Missing user IDs' }, { status: 400 });
        }
        const requester = await db.hubUser.findUnique({ where: { id: requesterId } });
        if (!requester?.isModerator) {
          return NextResponse.json({ success: false, message: 'Only moderators can assign moderators' }, { status: 403 });
        }
        const target = await db.hubUser.findUnique({ where: { id: targetUserId } });
        if (!target) {
          return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
        }
        if (target.isBanned) {
          return NextResponse.json({ success: false, message: 'Cannot promote a banned user' }, { status: 400 });
        }
        const updated = await db.hubUser.update({
          where: { id: targetUserId },
          data: { isModerator: true },
        });
        return NextResponse.json({ success: true, data: formatUser(updated), message: `${target.displayName} is now a moderator` });
      }

      // --- Remove moderator ---
      case 'remove-moderator': {
        const { targetUserId: rmTargetId, requesterId: rmRequesterId } = body;
        if (!rmTargetId || !rmRequesterId) {
          return NextResponse.json({ success: false, message: 'Missing user IDs' }, { status: 400 });
        }
        const rmRequester = await db.hubUser.findUnique({ where: { id: rmRequesterId } });
        if (!rmRequester?.isModerator) {
          return NextResponse.json({ success: false, message: 'Only moderators can remove moderators' }, { status: 403 });
        }
        // Cannot remove the super admin moderator
        const rmTarget = await db.hubUser.findUnique({ where: { id: rmTargetId } });
        if (!rmTarget) {
          return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
        }
        if (rmTarget.email?.toLowerCase() === 'admin@skoolar.org') {
          return NextResponse.json({ success: false, message: 'Cannot remove the platform admin moderator' }, { status: 403 });
        }
        const updated = await db.hubUser.update({
          where: { id: rmTargetId },
          data: { isModerator: false },
        });
        return NextResponse.json({ success: true, data: formatUser(updated), message: `Moderator privileges removed from ${rmTarget.displayName}` });
      }

      // --- Moderation ---
      case 'moderate': {
        const { postId, action: modAction, reason, moderatorId } = body;
        if (!postId || !modAction || !moderatorId) {
          return NextResponse.json({ success: false, message: 'Missing moderation details' }, { status: 400 });
        }

        // Verify moderator role
        const modHubUser = await db.hubUser.findUnique({ where: { id: moderatorId } });
        if (!modHubUser || !modHubUser.isModerator) {
          return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
        }

        let result;
        switch (modAction) {
          case 'hide':
            result = await db.hubPost.update({ where: { id: postId }, data: { isHidden: true, hiddenBy: moderatorId } });
            break;
          case 'unhide':
            result = await db.hubPost.update({ where: { id: postId }, data: { isHidden: false, hiddenBy: null } });
            break;
          case 'delete':
            result = await db.hubPost.delete({ where: { id: postId } });
            break;
          case 'pin':
            result = await db.hubPost.update({ where: { id: postId }, data: { isPinned: true } });
            break;
          case 'unpin':
            result = await db.hubPost.update({ where: { id: postId }, data: { isPinned: false } });
            break;
          case 'feature':
            result = await db.hubPost.update({ where: { id: postId }, data: { isFeatured: true } });
            break;
          case 'unfeature':
            result = await db.hubPost.update({ where: { id: postId }, data: { isFeatured: false } });
            break;
          case 'flag':
            result = await db.hubPost.update({ where: { id: postId }, data: { isFlagged: true, flagReason: reason || 'Community violation' } });
            break;
          case 'resolve-flag':
            result = await db.hubPost.update({ where: { id: postId }, data: { isFlagged: false, flagReason: null } });
            break;
          case 'ban-author': {
            const post = await db.hubPost.findUnique({ where: { id: postId } });
            if (post) {
              result = await db.hubUser.update({ 
                where: { id: post.hubUserId }, 
                data: { isBanned: true, bannedBy: moderatorId, banReason: reason || 'Terms of service violation', bannedAt: new Date() } 
              });
            }
            break;
          }
          default:
            return NextResponse.json({ success: false, message: 'Invalid moderation action' }, { status: 400 });
        }

        return NextResponse.json({ success: true, data: result, message: `Moderation action '${modAction}' successful` });
      }

      default:
        return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Hub PUT error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      // --- Delete Post ---
      case 'delete-post': {
        const postId = searchParams.get('postId');
        if (!postId) return NextResponse.json({ success: false, message: 'postId required' }, { status: 400 });

        const post = await db.hubPost.findUnique({ where: { id: postId } });
        if (!post) return NextResponse.json({ success: false, message: 'Post not found' }, { status: 404 });

        await db.hubPost.delete({ where: { id: postId } });
        return NextResponse.json({ success: true, data: { message: 'Post deleted' } });
      }

      // --- Delete Channel ---
      case 'delete-channel': {
        const channelId = searchParams.get('channelId');
        if (!channelId) return NextResponse.json({ success: false, message: 'channelId required' }, { status: 400 });

        const channel = await db.hubChannel.findUnique({ where: { id: channelId } });
        if (!channel) return NextResponse.json({ success: false, message: 'Channel not found' }, { status: 404 });

        await db.hubChannel.delete({ where: { id: channelId } });
        return NextResponse.json({ success: true, data: { message: 'Channel deleted' } });
      }

      // --- Delete Game ---
      case 'delete-game': {
        const gameId = searchParams.get('gameId');
        if (!gameId) return NextResponse.json({ success: false, message: 'gameId required' }, { status: 400 });

        const game = await db.hubGame.findUnique({ where: { id: gameId } });
        if (!game) return NextResponse.json({ success: false, message: 'Game not found' }, { status: 404 });

        await db.hubGame.delete({ where: { id: gameId } });
        return NextResponse.json({ success: true, data: { message: 'Game deleted' } });
      }

      default:
        return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Hub DELETE error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}
