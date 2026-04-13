import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ===================== TYPES & CONSTANTS =====================

type BadgeLevel = 'newcomer' | 'learner' | 'contributor' | 'expert' | 'master' | 'legend';

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

// ===================== SEED DATA =====================

let seedPromise: Promise<void> | null = null;

async function ensureSeedData() {
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    try {
      // Check if seed data already exists
      const existingUser = await db.hubUser.findUnique({ where: { displayName: 'Amara Obi' } });
      if (existingUser) return;

      // Create users
      const userData = [
        { id: 'u1', displayName: 'Amara Obi', email: 'amara@example.com', badge: 'legend', points: 4850, totalPosts: 67, lastSeenAt: new Date('2025-01-15T10:00:00Z'), createdAt: new Date('2024-01-15T10:00:00Z') },
        { id: 'u2', displayName: 'Chidi Nwosu', email: 'chidi@example.com', badge: 'master', points: 3200, totalPosts: 45, lastSeenAt: new Date('2025-01-14T10:00:00Z'), createdAt: new Date('2024-02-10T10:00:00Z') },
        { id: 'u3', displayName: 'Fatima Ali', email: 'fatima@example.com', badge: 'expert', points: 2100, totalPosts: 32, lastSeenAt: new Date('2025-01-13T10:00:00Z'), createdAt: new Date('2024-03-05T10:00:00Z') },
        { id: 'u4', displayName: 'Emeka Okafor', email: 'emeka@example.com', badge: 'contributor', points: 1200, totalPosts: 18, lastSeenAt: new Date('2025-01-12T10:00:00Z'), createdAt: new Date('2024-04-20T10:00:00Z') },
        { id: 'u5', displayName: 'Zainab Musa', email: 'zainab@example.com', badge: 'contributor', points: 980, totalPosts: 14, lastSeenAt: new Date('2025-01-11T10:00:00Z'), createdAt: new Date('2024-05-15T10:00:00Z') },
        { id: 'u6', displayName: 'Tunde Bakare', email: 'tunde@example.com', badge: 'learner', points: 450, totalPosts: 8, lastSeenAt: new Date('2025-01-10T10:00:00Z'), createdAt: new Date('2024-06-01T10:00:00Z') },
        { id: 'u7', displayName: 'Amina Bello', email: 'amina@example.com', badge: 'learner', points: 320, totalPosts: 5, lastSeenAt: new Date('2025-01-09T10:00:00Z'), createdAt: new Date('2024-07-10T10:00:00Z') },
        { id: 'u8', displayName: 'Yusuf Ibrahim', email: 'yusuf@example.com', badge: 'newcomer', points: 120, totalPosts: 2, lastSeenAt: new Date('2025-01-08T10:00:00Z'), createdAt: new Date('2024-08-20T10:00:00Z') },
        { id: 'u9', displayName: 'Grace Okonkwo', email: 'grace@example.com', badge: 'newcomer', points: 50, totalPosts: 1, lastSeenAt: new Date('2025-01-07T10:00:00Z'), createdAt: new Date('2024-09-05T10:00:00Z') },
      ];

      for (const u of userData) {
        await db.hubUser.create({ data: u });
      }

      // Create channels
      const channelData = [
        { id: 'ch1', name: 'General', description: 'General discussions and introductions', icon: 'MessageCircle', sortOrder: 0 },
        { id: 'ch2', name: 'Creative Writing', description: 'Share poems, stories, and creative pieces', icon: 'PenLine', sortOrder: 1 },
        { id: 'ch3', name: 'Science & Tech', description: 'Explore science, technology, and innovation', icon: 'Zap', sortOrder: 2 },
        { id: 'ch4', name: 'Debate Club', description: 'Engage in thoughtful debates and discussions', icon: 'Swords', sortOrder: 3 },
        { id: 'ch5', name: 'Study Tips', description: 'Share study strategies and learning resources', icon: 'BookOpen', sortOrder: 4 },
        { id: 'ch6', name: 'Fun Zone', description: 'Games, quizzes, and fun activities', icon: 'Gamepad2', sortOrder: 5 },
      ];

      for (const c of channelData) {
        await db.hubChannel.create({ data: c });
      }

      // Create posts
      const postData = [
        {
          id: 'p1', hubUserId: 'u1', channelId: 'ch2', title: 'The Whispering Baobab',
          content: `In the heart of the village stood a baobab tree, ancient and wise. Its branches stretched like open arms, embracing the sky. The villagers said it whispered secrets to those who listened carefully.\n\nOne evening, young Kofi sat beneath its shade, feeling the rough bark against his back. The wind rustled through the leaves, and he heard it — not words, but a feeling. A warmth that spread through his chest like the first rays of dawn.\n\n"The tree remembers," his grandmother had told him. "It remembers the rains that never came, the children who grew tall, the songs that faded into the evening air."\n\nKofi closed his eyes and listened. The baobab whispered of resilience, of roots that go deep, of branches that reach high. It whispered that even in drought, life finds a way to bloom.`,
          contentType: 'story', category: 'Fiction', tags: JSON.stringify(['creative-writing', 'african-literature', 'short-story']),
          likeCount: 4, commentCount: 3, isPinned: false, isFeatured: true, createdAt: new Date('2025-01-10T14:30:00Z'),
        },
        {
          id: 'p2', hubUserId: 'u2', channelId: 'ch3', title: 'How Solar Panels Really Work',
          content: `Solar panels convert sunlight into electricity through the photovoltaic effect. When photons from sunlight hit the semiconductor material (usually silicon) in the solar cells, they knock electrons loose from their atoms.\n\nKey Steps:\n1. Photons hit the solar panel and are absorbed by semiconducting materials\n2. Electrons are knocked loose and flow through the material\n3. The flow of electrons creates an electrical current\n4. Metal contacts on the top and bottom of the cell draw the current off\n5. An inverter converts DC to AC for home use\n\nFun fact: A typical solar panel can generate about 300 watts of power in full sun, which is enough to power a laptop and charge your phone simultaneously!`,
          contentType: 'article', category: 'Technology', tags: JSON.stringify(['science', 'solar-energy', 'education']),
          likeCount: 2, commentCount: 5, isPinned: true, isFeatured: false, createdAt: new Date('2025-01-11T09:15:00Z'),
        },
        {
          id: 'p3', hubUserId: 'u3', channelId: 'ch2', title: 'Echoes of Dawn',
          content: `The morning breaks in whispered gold,\nAcross the hills where winds unfold.\nA sparrow sings its quiet tune,\nBeneath the watchful, silver moon.\n\nThe river hums an ancient song,\nOf all who've passed and all who've gone.\nYet in its depths, the light still gleams,\nLike shattered stars in broken dreams.\n\nSo let the dawn remind us well,\nThat every night has tales to tell,\nAnd every sun that paints the sky\nWas once a tear the heavens cried.`,
          contentType: 'poem', category: 'Poetry', tags: JSON.stringify(['poetry', 'nature', 'morning']),
          likeCount: 5, commentCount: 7, isPinned: false, isFeatured: true, createdAt: new Date('2025-01-12T07:00:00Z'),
        },
        {
          id: 'p4', hubUserId: 'u4', channelId: 'ch4', title: 'Should AI Replace Teachers in Classrooms?',
          content: `This is a topic that sparks passionate debate. On one side, AI can personalize learning, provide instant feedback, and never gets tired. On the other, teachers provide empathy, mentorship, and social development that no algorithm can replicate.\n\nArguments FOR AI in classrooms:\n• Personalized learning paths for every student\n• 24/7 availability for questions\n• Consistent quality of instruction\n• Reduced educational costs\n\nArguments AGAINST:\n• Lack of emotional intelligence and empathy\n• No real-world experience to draw from\n• Students need human connection to thrive\n• Technology can fail or be misused\n\nMy take: AI should supplement, not replace, human teachers. The best approach combines both.`,
          contentType: 'debate', category: 'Education', tags: JSON.stringify(['ai', 'education', 'debate', 'technology']),
          likeCount: 2, commentCount: 12, isPinned: false, isFeatured: false, createdAt: new Date('2025-01-13T11:30:00Z'),
        },
        {
          id: 'p5', hubUserId: 'u5', channelId: 'ch5', title: 'The Feynman Technique: Learn Anything Faster',
          content: `The Feynman Technique is a powerful learning method named after Nobel Prize-winning physicist Richard Feynman. It works in 4 simple steps:\n\nStep 1: Choose a concept you want to learn\nStep 2: Explain it as if teaching a 12-year-old (use simple language)\nStep 3: Identify gaps in your explanation — go back to the source\nStep 4: Simplify and use analogies\n\nWhy it works: When you can explain something simply, it means you truly understand it. If you stumble or use jargon, you've found a gap in your knowledge.\n\nExample: Instead of saying "photosynthesis converts CO2 and H2O to glucose," say "Plants eat sunlight and air to make their own food."\n\nI've been using this technique for 3 months and my exam scores improved by 20%!`,
          contentType: 'article', category: 'Study Tips', tags: JSON.stringify(['study-tips', 'feynman-technique', 'learning']),
          likeCount: 6, commentCount: 8, isPinned: false, isFeatured: true, createdAt: new Date('2025-01-09T16:45:00Z'),
        },
        {
          id: 'p6', hubUserId: 'u6', channelId: 'ch1', title: 'Hello everyone! I am new here 👋',
          content: `Hi everyone! My name is Tunde and I'm a JSS 3 student from Lagos. I love mathematics and science. I heard about this platform from my teacher and I'm excited to join the community.\n\nI hope to make new friends, learn new things, and maybe share some of my own writings too. What are your favorite subjects?`,
          contentType: 'text', category: 'Introduction', tags: JSON.stringify(['introduction', 'new-member']),
          likeCount: 3, commentCount: 6, isPinned: false, isFeatured: false, createdAt: new Date('2025-01-14T08:20:00Z'),
        },
        {
          id: 'p7', hubUserId: 'u1', channelId: 'ch3', title: 'Why is the Sky Blue? (Simple Explanation)',
          content: `Here's a simple explanation of why the sky appears blue:\n\nSunlight looks white but is actually made up of all the colors of the rainbow. Each color travels as a wave, and blue light travels as shorter, smaller waves.\n\nWhen sunlight reaches Earth's atmosphere, it collides with gas molecules (mostly nitrogen and oxygen). Blue light is scattered more than other colors because it travels as shorter waves — this is called Rayleigh scattering.\n\nSo when you look up on a clear day, you're seeing scattered blue light from all directions. At sunset, light has to travel through more atmosphere, so the blue light gets scattered away, leaving reds and oranges.\n\nCool right? Nature's own color filter!`,
          contentType: 'article', category: 'Science', tags: JSON.stringify(['science', 'physics', 'explainer']),
          likeCount: 6, commentCount: 4, isPinned: false, isFeatured: false, createdAt: new Date('2025-01-08T13:00:00Z'),
        },
        {
          id: 'p8', hubUserId: 'u3', channelId: 'ch4', title: 'Is Homework Actually Helpful?',
          content: `Let's debate this! I've been thinking about whether homework actually helps students learn or just causes stress.\n\nPROS:\n• Reinforces what was learned in class\n• Develops time management skills\n• Allows parents to see what their children are learning\n• Prepares students for independent study\n\nCONS:\n• Can cause burnout and mental health issues\n• Takes time away from hobbies, family, and rest\n• Not all students have equal resources at home\n• Research shows benefits diminish after 2 hours for high schoolers\n\nWhat do you all think? I personally believe homework is useful in moderation, but too much can be harmful.`,
          contentType: 'debate', category: 'Education', tags: JSON.stringify(['homework', 'education', 'debate', 'mental-health']),
          likeCount: 4, commentCount: 15, isPinned: false, isFeatured: false, isFlagged: true, createdAt: new Date('2025-01-11T15:00:00Z'),
        },
      ];

      for (const p of postData) {
        await db.hubPost.create({ data: p });
      }

      // Create comments
      const commentData = [
        { id: 'c1', postId: 'p1', hubUserId: 'u2', content: "This is beautiful writing! The imagery of the baobab tree really resonates with me. It reminds me of the tree in my grandmother's compound.", createdAt: new Date('2025-01-10T15:00:00Z') },
        { id: 'c2', postId: 'p1', hubUserId: 'u3', content: '"Even in drought, life finds a way to bloom" — what a powerful line! This gave me chills.', createdAt: new Date('2025-01-10T16:00:00Z') },
        { id: 'c3', postId: 'p1', hubUserId: 'u1', content: "Thank you both! I was inspired by a real baobab in my village. Nature is the best storyteller. @Chidi, I'd love to hear about your grandmother's tree!", parentId: 'c1', createdAt: new Date('2025-01-10T17:00:00Z') },
        { id: 'c4', postId: 'p4', hubUserId: 'u1', content: 'Great balanced view! I agree that AI should be a tool, not a replacement. The human connection in education is irreplaceable.', createdAt: new Date('2025-01-13T12:00:00Z') },
        { id: 'c5', postId: 'p4', hubUserId: 'u6', content: 'I actually think AI could help with subjects where there are no qualified teachers. In rural areas especially.', createdAt: new Date('2025-01-13T13:00:00Z') },
        { id: 'c6', postId: 'p4', hubUserId: 'u4', content: 'Good point @Tunde! But even with AI, we still need someone to guide students emotionally and socially.', parentId: 'c5', createdAt: new Date('2025-01-13T14:00:00Z') },
        { id: 'c7', postId: 'p3', hubUserId: 'u2', content: 'This poem is stunning! The rhythm and imagery are perfect. "Shattered stars in broken dreams" is my favorite line.', createdAt: new Date('2025-01-12T08:00:00Z') },
        { id: 'c8', postId: 'p5', hubUserId: 'u7', content: 'Thank you for sharing this! I tried the Feynman technique with chemistry and it really works. I explained ionic bonds to my little sister!', createdAt: new Date('2025-01-10T10:00:00Z') },
        { id: 'c9', postId: 'p6', hubUserId: 'u1', content: "Welcome Tunde! Mathematics is amazing. You'll love it here. Feel free to share your writings anytime!", createdAt: new Date('2025-01-14T09:00:00Z') },
        { id: 'c10', postId: 'p6', hubUserId: 'u5', content: 'Hey Tunde! Great to have you. My favorite subject is Biology. Maybe we can study together sometime!', createdAt: new Date('2025-01-14T09:30:00Z') },
      ];

      for (const c of commentData) {
        await db.hubComment.create({ data: c });
      }

      // Create reviews
      const reviewData = [
        { id: 'r1', postId: 'p1', hubUserId: 'u2', rating: 5, content: 'Masterful storytelling with vivid imagery. The baobab metaphor is powerful.', createdAt: new Date('2025-01-10T18:00:00Z') },
        { id: 'r2', postId: 'p1', hubUserId: 'u5', rating: 4, content: "Beautiful piece. Would love to see a continuation of Kofi's story.", createdAt: new Date('2025-01-11T09:00:00Z') },
        { id: 'r3', postId: 'p3', hubUserId: 'u1', rating: 5, content: 'Exquisite poetry! The word choice and rhythm are exceptional.', createdAt: new Date('2025-01-12T10:00:00Z') },
        { id: 'r4', postId: 'p3', hubUserId: 'u4', rating: 5, content: 'This gave me goosebumps. Pure talent!', createdAt: new Date('2025-01-12T11:00:00Z') },
        { id: 'r5', postId: 'p5', hubUserId: 'u1', rating: 5, content: "Incredibly practical! I've shared this with all my classmates.", createdAt: new Date('2025-01-10T11:00:00Z') },
        { id: 'r6', postId: 'p2', hubUserId: 'u3', rating: 4, content: 'Clear and well-organized explanation. The fun fact was a nice touch!', createdAt: new Date('2025-01-11T10:00:00Z') },
        { id: 'r7', postId: 'p5', hubUserId: 'u2', rating: 5, content: 'This technique changed my study habits. Thank you!', createdAt: new Date('2025-01-10T12:00:00Z') },
      ];

      for (const r of reviewData) {
        await db.hubReview.create({ data: r });
      }

      // Create games
      const gameData = [
        { id: 'g1', hubUserId: 'u1', title: 'Math Sprint', description: 'Race against the clock solving math problems', category: 'Mathematics', difficulty: 'medium', gameData: JSON.stringify({ icon: 'Calculator', color: 'from-blue-500 to-blue-600', url: '#math-sprint' }), playCount: 234, isFeatured: true, createdAt: new Date('2024-06-01T00:00:00Z') },
        { id: 'g2', hubUserId: 'u1', title: 'Word Wizard', description: 'Build words from scrambled letters and expand vocabulary', category: 'English', difficulty: 'easy', gameData: JSON.stringify({ icon: 'BookOpen', color: 'from-purple-500 to-purple-600', url: '#word-wizard' }), playCount: 456, isFeatured: true, createdAt: new Date('2024-06-02T00:00:00Z') },
        { id: 'g3', hubUserId: 'u1', title: 'Science Quest', description: 'Answer science questions to explore the galaxy', category: 'Science', difficulty: 'medium', gameData: JSON.stringify({ icon: 'FlaskConical', color: 'from-green-500 to-green-600', url: '#science-quest' }), playCount: 189, isFeatured: true, createdAt: new Date('2024-06-03T00:00:00Z') },
        { id: 'g4', hubUserId: 'u1', title: 'History Timeline', description: 'Arrange historical events in the correct order', category: 'History', difficulty: 'hard', gameData: JSON.stringify({ icon: 'Clock', color: 'from-amber-500 to-amber-600', url: '#history-timeline' }), playCount: 123, isFeatured: false, createdAt: new Date('2024-06-04T00:00:00Z') },
        { id: 'g5', hubUserId: 'u1', title: 'Geography Explorer', description: 'Identify countries, capitals, and landmarks', category: 'Geography', difficulty: 'easy', gameData: JSON.stringify({ icon: 'Globe', color: 'from-teal-500 to-teal-600', url: '#geography-explorer' }), playCount: 312, isFeatured: false, createdAt: new Date('2024-06-05T00:00:00Z') },
        { id: 'g6', hubUserId: 'u1', title: 'Code Breaker', description: 'Solve logic puzzles and learn programming concepts', category: 'Computer Studies', difficulty: 'hard', gameData: JSON.stringify({ icon: 'Code', color: 'from-rose-500 to-rose-600', url: '#code-breaker' }), playCount: 78, isFeatured: false, createdAt: new Date('2024-06-06T00:00:00Z') },
        { id: 'g7', hubUserId: 'u1', title: 'Quick Quiz', description: 'General knowledge quiz with multiplayer support', category: 'General', difficulty: 'easy', gameData: JSON.stringify({ icon: 'Brain', color: 'from-indigo-500 to-indigo-600', url: '#quick-quiz' }), playCount: 567, isFeatured: true, createdAt: new Date('2024-06-07T00:00:00Z') },
        { id: 'g8', hubUserId: 'u1', title: 'Memory Match', description: 'Test and improve your memory with card matching', category: 'Brain Training', difficulty: 'easy', gameData: JSON.stringify({ icon: 'Brain', color: 'from-pink-500 to-pink-600', url: '#memory-match' }), playCount: 445, isFeatured: false, createdAt: new Date('2024-06-08T00:00:00Z') },
      ];

      for (const g of gameData) {
        await db.hubGame.create({ data: g });
      }

      // Create likes (post likes from seed data)
      const likeEntries = [
        { hubUserId: 'u2', postId: 'p1' },
        { hubUserId: 'u3', postId: 'p1' },
        { hubUserId: 'u4', postId: 'p1' },
        { hubUserId: 'u5', postId: 'p1' },
        { hubUserId: 'u1', postId: 'p2' },
        { hubUserId: 'u3', postId: 'p2' },
        { hubUserId: 'u1', postId: 'p3' },
        { hubUserId: 'u2', postId: 'p3' },
        { hubUserId: 'u4', postId: 'p3' },
        { hubUserId: 'u5', postId: 'p3' },
        { hubUserId: 'u6', postId: 'p3' },
        { hubUserId: 'u1', postId: 'p4' },
        { hubUserId: 'u6', postId: 'p4' },
        { hubUserId: 'u1', postId: 'p5' },
        { hubUserId: 'u2', postId: 'p5' },
        { hubUserId: 'u3', postId: 'p5' },
        { hubUserId: 'u4', postId: 'p5' },
        { hubUserId: 'u6', postId: 'p5' },
        { hubUserId: 'u7', postId: 'p5' },
        { hubUserId: 'u1', postId: 'p6' },
        { hubUserId: 'u2', postId: 'p6' },
        { hubUserId: 'u5', postId: 'p6' },
        { hubUserId: 'u2', postId: 'p7' },
        { hubUserId: 'u3', postId: 'p7' },
        { hubUserId: 'u4', postId: 'p7' },
        { hubUserId: 'u5', postId: 'p7' },
        { hubUserId: 'u7', postId: 'p7' },
        { hubUserId: 'u8', postId: 'p7' },
        { hubUserId: 'u1', postId: 'p8' },
        { hubUserId: 'u4', postId: 'p8' },
        { hubUserId: 'u5', postId: 'p8' },
        { hubUserId: 'u6', postId: 'p8' },
      ];

      for (const l of likeEntries) {
        await db.hubLike.create({ data: l });
      }

    } catch (error) {
      console.error('Failed to seed hub data:', error);
    }
  })();

  return seedPromise;
}

// ===================== ROUTE HANDLERS =====================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    // Ensure seed data exists on first call
    await ensureSeedData();

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

  try {
    await ensureSeedData();

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

        const user = await db.hubUser.create({
          data: {
            displayName: displayName.trim(),
            email: typeof email === 'string' ? email.trim().slice(0, 100) : null,
            points: 10,
            badge: 'newcomer',
            lastSeenAt: new Date(),
          },
        });

        return NextResponse.json({ success: true, data: formatUser(user) });
      }

      // --- Create Post ---
      case 'create-post': {
        const { authorId, authorName, channelId, title, content, contentType, category, tags, imageUrl } = body;
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
