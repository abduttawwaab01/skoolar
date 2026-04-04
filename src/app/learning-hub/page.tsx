'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react';
import {
  MessageCircle, Hash, Heart, MessageSquare, Star, Trophy, Gamepad2,
  Lightbulb, Plus, Search, Filter, ArrowUpDown, Download, Clock, Eye,
  ThumbsUp, Send, ChevronDown, ChevronUp, Crown, Medal, Award,
  Flame, Sparkles, Loader2, X, Pin, BookOpen, PenLine, Zap,
  Swords, GraduationCap, Users, Brain, Calculator, Globe, Code,
  ChevronRight, Quote, RefreshCw, FileText, ArrowLeft, BadgeCheck,
  FlaskConical, Bookmark, BookmarkCheck, Share2, Copy, Check,
  TrendingUp, Target, BarChart3, Play, Shield, ChevronLeft,
  Menu, MapPin, Volume2, Lock, Unlock, CheckCircle2, CircleDot,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { handleSilentError } from '@/lib/error-handler';

// ======================== TYPES ========================

type BadgeLevel = 'newcomer' | 'learner' | 'contributor' | 'expert' | 'master' | 'legend';

interface HubUser {
  id: string;
  displayName: string;
  email: string;
  avatar?: string;
  bio?: string;
  badge: BadgeLevel;
  points: number;
  postsCount: number;
  isBanned: boolean;
  createdAt: string;
  lastActive: string;
  interests?: string[];
  streak?: number;
  badgeColor?: string;
}

interface HubChannel {
  id: string;
  name: string;
  description: string;
  icon: string;
  postsCount: number;
  isDefault: boolean;
}

interface HubComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  content: string;
  parentId: string | null;
  likes: number;
  createdAt: string;
  authorBadge?: BadgeLevel;
  authorBadgeColor?: string;
  children?: HubComment[];
}

interface HubReview {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
  authorBadge?: BadgeLevel;
  authorBadgeColor?: string;
}

interface HubPost {
  id: string;
  authorId: string;
  authorName: string;
  channelId: string;
  title: string;
  content: string;
  contentType: 'text' | 'poem' | 'story' | 'drama' | 'article' | 'question' | 'debate';
  category: string;
  tags: string[];
  imageUrl: string;
  likes: number;
  likedBy?: string[];
  commentsCount: number;
  reviewsCount: number;
  isPinned: boolean;
  isFeatured: boolean;
  isHidden: boolean;
  isFlagged: boolean;
  createdAt: string;
  channel?: HubChannel;
  authorBadge?: BadgeLevel;
  authorBadgeColor?: string;
  contentTypeLabel?: string;
  contentTypeColor?: string;
}

interface HubGame {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  plays: number;
  icon: string;
  color: string;
  isFeatured: boolean;
  url: string;
}

interface LeaderboardEntry extends HubUser {
  rank: number;
  nextLevelPoints: number;
}

// ======================== CONSTANTS ========================

const BADGE_CONFIG: Record<BadgeLevel, { label: string; color: string; bg: string; icon: React.ElementType; minPoints: number; description: string }> = {
  newcomer: { label: 'Newcomer', color: 'text-gray-600', bg: 'bg-gray-100 border-gray-200', icon: Sparkles, minPoints: 0, description: 'Just getting started! Welcome aboard.' },
  learner: { label: 'Learner', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: BookOpen, minPoints: 200, description: 'Active learner with curiosity to grow.' },
  contributor: { label: 'Contributor', color: 'text-green-600', bg: 'bg-green-50 border-green-200', icon: ThumbsUp, minPoints: 800, description: 'Regular contributor to the community.' },
  expert: { label: 'Expert', color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200', icon: Award, minPoints: 2000, description: 'Knowledgeable expert and valued member.' },
  master: { label: 'Master', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: Medal, minPoints: 4000, description: 'Master of the community, a true leader.' },
  legend: { label: 'Legend', color: 'text-white', bg: 'bg-gradient-to-r from-red-500 to-orange-500 border-red-300', icon: Crown, minPoints: 8000, description: 'Legendary! An icon of the community.' },
};

const BADGE_LEVELS: BadgeLevel[] = ['newcomer', 'learner', 'contributor', 'expert', 'master', 'legend'];

const CONTENT_TYPE_ICONS: Record<string, React.ElementType> = {
  text: FileText, poem: Sparkles, story: BookOpen, drama: Swords,
  article: GraduationCap, question: MessageCircle, debate: Zap,
};

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  MessageCircle, PenLine, Zap, Swords, BookOpen, Gamepad2,
};

const DIFFICULTY_CONFIG = {
  easy: { color: 'bg-green-100 text-green-700 border-green-200', label: 'Easy', icon: CheckCircle2 },
  medium: { color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Medium', icon: Target },
  hard: { color: 'bg-red-100 text-red-700 border-red-200', label: 'Hard', icon: Flame },
};

const RANK_ICONS: Record<number, React.ElementType> = { 1: Crown, 2: Medal, 3: Award };

const RANK_COLORS: Record<number, string> = {
  1: 'from-amber-400 to-yellow-500',
  2: 'from-gray-300 to-gray-400',
  3: 'from-amber-600 to-orange-600',
};

const AVATAR_EMOJIS = ['🎨', '📚', '🚀', '💡', '🌟', '🎯', '🎮', '🎭', '✍️', '🔬', '🎵', '🧠', '⚡', '🌍', '👑', '🦊', '🐱', '🦁', '🐼', '🦅', '🌊', '🔥', '💎', '🏆'];

const INTEREST_OPTIONS = ['Creative Writing', 'Science', 'Mathematics', 'Debate', 'Poetry', 'Stories', 'Art', 'Technology', 'History', 'Languages', 'Games', 'Study Tips'];

const POINTS_CONFIG = { post: 25, comment: 5, review: 15, likeReceived: 2 };

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

// ======================== HELPERS ========================

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function estimateReadTime(content: string): string {
  const words = content.split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

function downloadAsText(title: string, content: string, authorName: string, createdAt: string) {
  const date = new Date(createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const text = `${'═'.repeat(50)}\n  ${title}\n  by ${authorName}\n  ${date}\n${'═'.repeat(50)}\n\n${content}\n\n${'─'.repeat(50)}\nShared from Skoolar Learning Hub\n${'─'.repeat(50)}`;
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success('Downloaded successfully!');
}

function getNextBadgeLevel(currentBadge: BadgeLevel): { level: BadgeLevel; pointsNeeded: number; progress: number } | null {
  const idx = BADGE_LEVELS.indexOf(currentBadge);
  if (idx >= BADGE_LEVELS.length - 1) return null;
  const next = BADGE_LEVELS[idx + 1];
  return { level: next, pointsNeeded: BADGE_CONFIG[next].minPoints, progress: 0 };
}

function getLevelProgress(points: number, badge: BadgeLevel): number {
  const idx = BADGE_LEVELS.indexOf(badge);
  if (idx >= BADGE_LEVELS.length - 1) return 100;
  const currentMin = BADGE_CONFIG[badge].minPoints;
  const nextMin = BADGE_CONFIG[BADGE_LEVELS[idx + 1]].minPoints;
  return Math.round(((points - currentMin) / (nextMin - currentMin)) * 100);
}

function getChannelIcon(iconName: string): React.ElementType {
  return CHANNEL_ICONS[iconName] || MessageCircle;
}

function getGameIcon(iconName: string): React.ElementType {
  const icons: Record<string, React.ElementType> = { Calculator, BookOpen, FlaskConical, Clock, Globe, Code, Brain, Gamepad2 };
  return icons[iconName] || Gamepad2;
}

// ======================== SUB-COMPONENTS ========================

function AnimatedCounter({ value, label, icon: Icon }: { value: number; label: string; icon: React.ElementType }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.max(1, Math.ceil(value / 40));
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(start);
    }, 30);
    return () => clearInterval(timer);
  }, [value]);
  return (
    <div className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm border border-white/10 hover:bg-white/15 transition-colors">
      <Icon className="w-5 h-5 mx-auto mb-1.5 opacity-80" />
      <div className="text-xl md:text-2xl font-bold tabular-nums">{display.toLocaleString()}</div>
      <div className="text-[10px] md:text-xs text-emerald-200 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function FloatingParticle({ delay, size, left }: { delay: number; size: number; left: number }) {
  return (
    <div
      className="absolute rounded-full bg-white/20 animate-float pointer-events-none"
      style={{
        width: size, height: size, left: `${left}%`, bottom: '-10px',
        animationDelay: `${delay}s`, animationDuration: `${6 + Math.random() * 4}s`,
      }}
    />
  );
}

function StarRating({ rating, size = 'sm', interactive = false, hoveredStar = 0, onHover, onClick }: {
  rating: number; size?: 'sm' | 'md' | 'lg'; interactive?: boolean; hoveredStar?: number; onHover?: (s: number) => void; onClick?: (s: number) => void;
}) {
  const sizeClasses = size === 'lg' ? 'h-8 w-8' : size === 'md' ? 'h-5 w-5' : 'h-3.5 w-3.5';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          type="button"
          disabled={!interactive}
          onMouseEnter={() => interactive && onHover?.(s)}
          onMouseLeave={() => interactive && onHover?.(0)}
          onClick={() => interactive && onClick?.(s)}
          className={`p-0 ${interactive ? 'cursor-pointer' : 'cursor-default'} transition-transform hover:scale-110`}
        >
          <Star className={`${sizeClasses} transition-all duration-200 ${s <= (interactive ? (hoveredStar || rating) : rating) ? 'text-amber-400 fill-amber-400 drop-shadow-sm' : 'text-gray-300'}`} />
        </button>
      ))}
    </div>
  );
}

function RatingBreakdownChart({ reviews }: { reviews: HubReview[] }) {
  const counts = [0, 0, 0, 0, 0];
  reviews.forEach(r => { if (r.rating >= 1 && r.rating <= 5) counts[r.rating - 1]++; });
  const maxCount = Math.max(...counts, 1);
  const avg = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className="text-3xl font-bold text-gray-900">{avg.toFixed(1)}</div>
          <StarRating rating={Math.round(avg)} size="sm" />
          <div className="text-xs text-gray-500 mt-1">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="flex-1 space-y-1.5">
          {[5, 4, 3, 2, 1].map(star => (
            <div key={star} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-3 text-right">{star}</span>
              <Star className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0" />
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${(counts[star - 1] / maxCount) * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 w-5">{counts[star - 1]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CommentItem({ comment, currentUser, onReply, depth = 0 }: { comment: HubComment; currentUser: HubUser | null; onReply: (r: { id: string; name: string } | null) => void; depth?: number }) {
  return (
    <div className={`${depth > 0 ? 'ml-6 pl-4 border-l-2 border-gray-100' : ''}`}>
      <div className="group bg-gray-50 hover:bg-gray-100/80 rounded-lg p-3 transition-colors">
        <div className="flex items-center gap-2 mb-1.5">
          <Avatar className="h-6 w-6">
            <AvatarFallback className={`${BADGE_CONFIG[comment.authorBadge || 'newcomer'].bg} text-[10px] ${BADGE_CONFIG[comment.authorBadge || 'newcomer'].color}`}>
              {getInitials(comment.authorName)}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium text-xs text-gray-900">{comment.authorName}</span>
          <Badge variant="outline" className={`text-xs px-1 py-0 border ${BADGE_CONFIG[comment.authorBadge || 'newcomer'].bg} ${BADGE_CONFIG[comment.authorBadge || 'newcomer'].color} capitalize`}>
            {comment.authorBadge || 'newcomer'}
          </Badge>
          <span className="text-[10px] text-gray-400 ml-auto">{timeAgo(comment.createdAt)}</span>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">{comment.content}</p>
        {currentUser && (
          <button onClick={() => onReply({ id: comment.id, name: comment.authorName })} className="text-[10px] text-emerald-600 hover:text-emerald-700 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
            Reply
          </button>
        )}
      </div>
      {comment.children && comment.children.map(child => (
        <CommentItem key={child.id} comment={child} currentUser={currentUser} onReply={onReply} depth={depth + 1} />
      ))}
    </div>
  );
}

function PodiumCard({ entry, position }: { entry: LeaderboardEntry; position: number }) {
  const RankIcon = RANK_ICONS[position] || Award;
  const heights = { 1: 'h-32', 2: 'h-24', 3: 'h-20' };
  const order = { 1: 'order-2 md:order-1', 2: 'order-1 md:order-2', 3: 'order-3 md:order-3' };
  return (
    <div className={`flex flex-col items-center ${order[position]}`}>
      {position === 1 && (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center mb-2 shadow-lg shadow-amber-200/50">
          <RankIcon className="w-5 h-5 text-white" />
        </div>
      )}
      <Card className={`w-full max-w-[180px] text-center border-2 ${position === 1 ? 'border-amber-300 shadow-lg shadow-amber-100' : position === 2 ? 'border-gray-300' : 'border-amber-600'} overflow-hidden`}>
        <div className={`${heights[position]} bg-gradient-to-t ${RANK_COLORS[position]} flex items-end justify-center relative`}>
          <div className="absolute top-2 left-1/2 -translate-x-1/2">
            {position > 1 && <RankIcon className="w-5 h-5 text-white/90" />}
          </div>
          <span className="text-3xl font-bold text-white/30 mb-2">#{position}</span>
        </div>
        <CardContent className="p-3 space-y-1.5">
          <Avatar className="h-10 w-10 mx-auto">
            <AvatarFallback className={`${BADGE_CONFIG[entry.badge].bg} ${BADGE_CONFIG[entry.badge].color} text-xs`}>
              {entry.avatar || getInitials(entry.displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="font-semibold text-sm text-gray-900 truncate">{entry.displayName}</div>
          <Badge variant="outline" className={`${BADGE_CONFIG[entry.badge].bg} ${BADGE_CONFIG[entry.badge].color} border text-[10px] capitalize`}>
            {entry.badge}
          </Badge>
          <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
            <Flame className="h-3 w-3 text-amber-500" />
            <span className="font-semibold">{entry.points.toLocaleString()}</span> pts
          </div>
          <div className="text-[10px] text-gray-400">{entry.postsCount} posts</div>
        </CardContent>
      </Card>
    </div>
  );
}

function PostCard({ post, currentUser, onOpen, onLike, isBookmarked, onBookmark, onShare }: {
  post: HubPost; currentUser: HubUser | null; onOpen: () => void; onLike: () => void; isBookmarked: boolean; onBookmark: () => void; onShare: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = post.content.length > 300;
  const isCreative = ['poem', 'story', 'drama'].includes(post.contentType);
  const contentIconComponent = CONTENT_TYPE_ICONS[post.contentType] || FileText;
  const contentIconEl = React.createElement(contentIconComponent, { className: 'h-3 w-3' });
  const isLiked = currentUser && post.likedBy?.includes(currentUser.id);

  return (
    <Card
      className={`group cursor-pointer hover:shadow-lg hover:shadow-emerald-100/50 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden ${post.isPinned ? 'ring-2 ring-emerald-200' : ''} ${post.isFeatured ? 'ring-2 ring-amber-200' : ''}`}
      onClick={onOpen}
    >
      {/* Pinned / Featured Indicator */}
      {(post.isPinned || post.isFeatured) && (
        <div className={`h-1 ${post.isPinned ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      )}
      <CardContent className="p-4 space-y-3">
        {/* Author Row */}
        <div className="flex items-center gap-2.5">
          <Avatar className="h-9 w-9 ring-2 ring-white shadow-sm">
            <AvatarFallback className={`${BADGE_CONFIG[post.authorBadge || 'newcomer'].bg} ${BADGE_CONFIG[post.authorBadge || 'newcomer'].color} text-xs`}>
              {getInitials(post.authorName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm text-gray-900 truncate">{post.authorName}</span>
              <Badge variant="outline" className={`text-xs px-1 py-0 border shrink-0 ${BADGE_CONFIG[post.authorBadge || 'newcomer'].bg} ${BADGE_CONFIG[post.authorBadge || 'newcomer'].color} capitalize`}>
                {post.authorBadge || 'newcomer'}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <Clock className="h-3 w-3" />
              {timeAgo(post.createdAt)}
              <span>·</span>
              {estimateReadTime(post.content)}
              {post.isPinned && <><Pin className="h-3 w-3 text-emerald-500" /><span className="text-emerald-500 font-medium">Pinned</span></>}
              {post.isFeatured && <><Star className="h-3 w-3 text-amber-500 fill-amber-500" /><span className="text-amber-500 font-medium">Featured</span></>}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={e => { e.stopPropagation(); onBookmark(); }}>
                {isBookmarked ? <BookmarkCheck className="h-4 w-4 mr-2 text-emerald-600" /> : <Bookmark className="h-4 w-4 mr-2" />}
                {isBookmarked ? 'Bookmarked' : 'Bookmark'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={e => { e.stopPropagation(); onShare(); }}>
                <Share2 className="h-4 w-4 mr-2" /> Share
              </DropdownMenuItem>
              {isCreative && (
                <DropdownMenuItem onClick={e => { e.stopPropagation(); downloadAsText(post.title, post.content, post.authorName, post.createdAt); }}>
                  <Download className="h-4 w-4 mr-2" /> Download
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Content */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge className={`${post.contentTypeColor || 'bg-gray-100 text-gray-700'} text-[10px] capitalize gap-1`}>
              {contentIconEl} {post.contentTypeLabel || post.contentType}
            </Badge>
            {post.channel && (
              <Badge variant="outline" className="text-[10px] gap-1">
                {React.createElement(getChannelIcon(post.channel.icon), { className: 'h-3 w-3' })} {post.channel.name}
              </Badge>
            )}
          </div>
          <h3 className="font-bold text-gray-900 group-hover:text-emerald-700 transition-colors line-clamp-2 leading-snug">{post.title}</h3>
          <div className={`mt-2 text-sm text-gray-600 leading-relaxed ${post.contentType === 'poem' ? 'whitespace-pre-wrap font-serif italic' : ''}`}>
            {isLong && !expanded ? (
              <>
                {post.content.slice(0, 300)}...
                <button onClick={(e) => { e.stopPropagation(); setExpanded(true); }} className="text-emerald-600 hover:text-emerald-700 font-medium ml-1">
                  Read More
                </button>
              </>
            ) : (
              post.content
            )}
          </div>
        </div>

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {post.tags.slice(0, 4).map(tag => (
              <Badge key={tag} variant="secondary" className="text-[10px] hover:bg-emerald-50 cursor-pointer">#{tag}</Badge>
            ))}
            {post.tags.length > 4 && <Badge variant="secondary" className="text-[10px]">+{post.tags.length - 4}</Badge>}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 pt-1 border-t border-gray-100">
          <Button
            variant="ghost" size="sm"
            className={`gap-1 h-8 text-xs ${isLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-400'}`}
            onClick={e => { e.stopPropagation(); onLike(); }}
          >
            <Heart className={`h-3.5 w-3.5 transition-all ${isLiked ? 'fill-red-500 scale-110' : ''}`} />
            <span className="font-medium">{post.likes}</span>
          </Button>
          <span className="flex items-center gap-1 text-xs text-gray-400 h-8 px-2">
            <MessageSquare className="h-3.5 w-3.5" /> {post.commentsCount}
          </span>
          {isCreative && (
            <span className="flex items-center gap-1 text-xs text-gray-400 h-8 px-2">
              <Star className="h-3.5 w-3.5" /> {post.reviewsCount}
            </span>
          )}
          <div className="ml-auto flex items-center gap-0.5">
            {isBookmarked && <BookmarkCheck className="h-3.5 w-3.5 text-emerald-500 mr-1" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GameCard({ game, currentUser, onPlay }: { game: HubGame; currentUser: HubUser | null; onPlay: (g: HubGame) => void }) {
  const DiffIcon = DIFFICULTY_CONFIG[game.difficulty].icon;
  return (
    <Card className="group cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden" onClick={() => onPlay(game)}>
      <div className={`h-28 bg-gradient-to-br ${game.color} flex items-center justify-center relative`}>
        {React.createElement(getGameIcon(game.icon), { className: "w-12 h-12 text-white/80 group-hover:scale-110 transition-transform" })}
        {game.isFeatured && (
          <Badge className="absolute top-2 right-2 bg-white/20 text-white border-white/30 backdrop-blur-sm text-[10px] gap-1">
            <Star className="h-3 w-3 fill-white" /> Featured
          </Badge>
        )}
        <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-black/30 to-transparent" />
      </div>
      <CardContent className="p-3 space-y-2">
        <h4 className="font-bold text-sm text-gray-900 group-hover:text-emerald-700 transition-colors truncate">{game.title}</h4>
        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{game.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={`text-[10px] gap-1 border ${DIFFICULTY_CONFIG[game.difficulty].color}`}>
              <DiffIcon className="h-3 w-3" /> {DIFFICULTY_CONFIG[game.difficulty].label}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">{game.category}</Badge>
          </div>
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <Play className="h-3 w-3" /> {game.plays}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ======================== MAIN COMPONENT ========================

export default function LearningHubPage() {
  // --- User State ---
  const [currentUser, setCurrentUser] = useState<HubUser | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [registerStep, setRegisterStep] = useState(0);
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerAvatar, setRegisterAvatar] = useState('');
  const [registerBio, setRegisterBio] = useState('');
  const [registerInterests, setRegisterInterests] = useState<string[]>([]);
  const [registering, setRegistering] = useState(false);

  // --- Data State ---
  const [channels, setChannels] = useState<HubChannel[]>([]);
  const [posts, setPosts] = useState<HubPost[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [games, setGames] = useState<HubGame[]>([]);
  const [featuredGames, setFeaturedGames] = useState<HubGame[]>([]);
  const [funFact, setFunFact] = useState<string>('');
  const [funFactShuffling, setFunFactShuffling] = useState(false);
  const [stats, setStats] = useState({ totalUsers: 0, totalPosts: 0, totalGames: 0, totalComments: 0 });
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Set<string>>(new Set());

  // --- UI State ---
  const [activeChannel, setActiveChannel] = useState('all');
  const [activeTab, setActiveTab] = useState('feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [contentTypeFilter, setContentTypeFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [gameCategory, setGameCategory] = useState('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // --- Post Detail ---
  const [selectedPost, setSelectedPost] = useState<(HubPost & { comments?: HubComment[]; reviews?: HubReview[]; avgRating?: number }) | null>(null);
  const [postComments, setPostComments] = useState<HubComment[]>([]);
  const [postReviews, setPostReviews] = useState<HubReview[]>([]);
  const [loadingPost, setLoadingPost] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [hoveredStar, setHoveredStar] = useState(0);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

  // --- Create Post ---
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '', channelId: 'ch1', contentType: 'text', category: '', tags: '' });
  const [creatingPost, setCreatingPost] = useState(false);

  // --- Animated Stats ---
  const [visibleStats, setVisibleStats] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  // --- Load user from localStorage ---
  useEffect(() => {
    try {
      const saved = localStorage.getItem('skoolar-hub-user');
      if (saved) {
        const user = JSON.parse(saved);
        if (user && user.id) {
          setCurrentUser(user);
        } else {
          localStorage.removeItem('skoolar-hub-user');
          setShowRegister(true);
        }
      } else {
        setShowRegister(true);
      }
      const bm = localStorage.getItem('skoolar-hub-bookmarks');
      if (bm) setBookmarkedPosts(new Set(JSON.parse(bm)));
    } catch {
      setShowRegister(true);
    }
  }, []);

  // --- Intersection observer for hero stats ---
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleStats(true); },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // --- Fetch initial data ---
  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [channelsRes, postsRes, leaderboardRes, gamesRes, featGamesRes, factRes, statsRes] = await Promise.all([
        fetch('/api/hub?action=channels'),
        fetch('/api/hub?action=posts'),
        fetch('/api/hub?action=leaderboard'),
        fetch('/api/hub?action=games'),
        fetch('/api/hub?action=games&featured=true'),
        fetch('/api/hub?action=fun-fact'),
        fetch('/api/hub?action=admin-stats'),
      ]);
      const [chData, poData, lbData, gmData, fgData, ffData, stData] = await Promise.all([
        channelsRes.json(), postsRes.json(), leaderboardRes.json(),
        gamesRes.json(), featGamesRes.json(), factRes.json(), statsRes.json(),
      ]);
      if (chData.success) setChannels(chData.data);
      if (poData.success) setPosts(poData.data);
      if (lbData.success) setLeaderboard(lbData.data);
      if (gmData.success) setGames(gmData.data);
      if (fgData.success) setFeaturedGames(fgData.data);
      if (ffData.success) setFunFact(ffData.data.fact);
      if (stData.success) setStats(stData.data);
    } catch (err) {
      console.error('Failed to load hub data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInitialData(); }, [fetchInitialData]);

  // --- Fetch posts with filters ---
  const fetchPosts = useCallback(async () => {
    try {
      const params = new URLSearchParams({ action: 'posts', channelId: activeChannel, sort: sortBy });
      if (searchQuery) params.set('search', searchQuery);
      if (contentTypeFilter !== 'all') params.set('contentType', contentTypeFilter);
      const res = await fetch(`/api/hub?${params}`);
      const json = await res.json();
      if (json.success) setPosts(json.data);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    }
  }, [activeChannel, sortBy, searchQuery, contentTypeFilter]);

  useEffect(() => {
    if (!loading) fetchPosts();
  }, [fetchPosts, loading]);

  // --- Register (multi-step) ---
  const handleRegister = async () => {
    if (registerStep === 0 && (!registerName.trim() || registerName.trim().length < 2)) {
      toast.error('Display name must be at least 2 characters');
      return;
    }
    if (registerStep === 0) { setRegisterStep(1); return; }
    if (registerStep === 1 && !registerAvatar) {
      toast.error('Please choose an avatar');
      return;
    }
    if (registerStep === 1) { setRegisterStep(2); return; }
    if (registerStep === 2) { setRegisterStep(3); return; }
    // Step 3: Submit
    setRegistering(true);
    try {
      const res = await fetch('/api/hub?action=register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: registerName.trim(), email: registerEmail.trim() || undefined }),
      });
      const json = await res.json();
      if (json.success) {
        const user: HubUser = {
          ...json.data,
          avatar: registerAvatar,
          bio: registerBio,
          interests: registerInterests,
          streak: 1,
        };
        setCurrentUser(user);
        localStorage.setItem('skoolar-hub-user', JSON.stringify(user));
        setShowRegister(false);
        setRegisterStep(0);
        toast.success(`Welcome to the Learning Hub, ${user.displayName}! 🎉`);
      } else {
        toast.error(json.message || 'Registration failed');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setRegistering(false);
    }
  };

  // --- Like Post ---
  const handleLike = async (postId: string) => {
    if (!currentUser) { setShowRegister(true); return; }
    try {
      const res = await fetch('/api/hub?action=like-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, userId: currentUser.id }),
      });
      const json = await res.json();
      if (json.success) {
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: json.data.likes, likedBy: json.data.liked ? [...(p.likedBy || []), currentUser.id] : (p.likedBy || []).filter(id => id !== currentUser.id) } : p));
        if (selectedPost?.id === postId) {
          setSelectedPost(prev => prev ? { ...prev, likes: json.data.likes } : null);
        }
      }
    } catch { toast.error('Failed to like post'); }
  };

  // --- Open Post Detail ---
  const openPost = async (post: HubPost) => {
    setLoadingPost(true);
    try {
      const res = await fetch(`/api/hub?action=post&postId=${post.id}`);
      const json = await res.json();
      if (json.success) {
        setSelectedPost(json.data);
        setPostComments(json.data.comments || []);
        setPostReviews(json.data.reviews || []);
      }
    } catch { toast.error('Failed to load post'); }
    finally { setLoadingPost(false); }
  };

  // --- Submit Comment ---
  const handleSubmitComment = async () => {
    if (!currentUser || !selectedPost || !commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await fetch('/api/hub?action=create-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: selectedPost.id, authorId: currentUser.id,
          authorName: currentUser.displayName, content: commentText.trim(),
          parentId: replyTo?.id || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        const newComment = json.data;
        setPostComments(prev => {
          if (newComment.parentId) {
            return prev.map(c => c.id === newComment.parentId
              ? { ...c, children: [...(c.children || []), newComment] } : c);
          }
          return [...prev, { ...newComment, children: [] }];
        });
        setCommentText('');
        setReplyTo(null);
        setSelectedPost(prev => prev ? { ...prev, commentsCount: prev.commentsCount + 1 } : null);
        toast.success('Comment added! +5 points');
      }
    } catch { toast.error('Failed to add comment'); }
    finally { setSubmittingComment(false); }
  };

  // --- Submit Review ---
  const handleSubmitReview = async () => {
    if (!currentUser || !selectedPost || reviewRating === 0) {
      toast.error('Please select a star rating');
      return;
    }
    setSubmittingReview(true);
    try {
      const res = await fetch('/api/hub?action=create-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: selectedPost.id, authorId: currentUser.id,
          authorName: currentUser.displayName, rating: reviewRating,
          comment: reviewText.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setPostReviews(prev => {
          const existing = prev.findIndex(r => r.authorId === currentUser.id);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = { ...updated[existing], rating: reviewRating, comment: reviewText.trim() };
            return updated;
          }
          return [...prev, {
            id: `rev-${Date.now()}`, postId: selectedPost.id,
            authorId: currentUser.id, authorName: currentUser.displayName,
            rating: reviewRating, comment: reviewText.trim(),
            createdAt: new Date().toISOString(),
            authorBadge: currentUser.badge,
            authorBadgeColor: BADGE_CONFIG[currentUser.badge].bg,
          }];
        });
        setReviewRating(0);
        setReviewText('');
        setSelectedPost(prev => prev ? { ...prev, reviewsCount: json.data.reviewsCount } : null);
        toast.success('Review submitted! +15 points 🌟');
      }
    } catch { toast.error('Failed to submit review'); }
    finally { setSubmittingReview(false); }
  };

  // --- Create Post ---
  const handleCreatePost = async () => {
    if (!currentUser) { setShowRegister(true); return; }
    if (!newPost.title.trim() || !newPost.content.trim()) {
      toast.error('Title and content are required');
      return;
    }
    setCreatingPost(true);
    try {
      const tagsArr = newPost.tags.split(',').map(t => t.trim()).filter(Boolean);
      const res = await fetch('/api/hub?action=create-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorId: currentUser.id, authorName: currentUser.displayName,
          channelId: newPost.channelId, title: newPost.title.trim(),
          content: newPost.content.trim(), contentType: newPost.contentType,
          category: newPost.category || 'General', tags: tagsArr,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setPosts(prev => [json.data, ...prev]);
        setShowCreatePost(false);
        setNewPost({ title: '', content: '', channelId: newPost.channelId, contentType: 'text', category: '', tags: '' });
        const updatedUser = { ...currentUser, points: currentUser.points + 25, postsCount: currentUser.postsCount + 1 };
        setCurrentUser(updatedUser);
        localStorage.setItem('skoolar-hub-user', JSON.stringify(updatedUser));
        toast.success('Post published! +25 points 🎉');
      } else {
        toast.error(json.message || 'Failed to create post');
      }
    } catch { toast.error('Network error'); }
    finally { setCreatingPost(false); }
  };

  // --- Refresh Fun Fact ---
  const refreshFunFact = async () => {
    setFunFactShuffling(true);
    try {
      const res = await fetch('/api/hub?action=fun-fact');
      const json = await res.json();
      if (json.success) setFunFact(json.data.fact);
    } catch { /* keep existing */ }
    setTimeout(() => setFunFactShuffling(false), 500);
  };

  // --- Bookmark ---
  const toggleBookmark = (postId: string) => {
    setBookmarkedPosts(prev => {
      const next = new Set(prev);
      if (next.has(postId)) { next.delete(postId); toast.info('Removed bookmark'); }
      else { next.add(postId); toast.success('Bookmarked! 🔖'); }
      localStorage.setItem('skoolar-hub-bookmarks', JSON.stringify([...next]));
      return next;
    });
  };

  // --- Share ---
  const sharePost = (post: HubPost) => {
    const url = `${window.location.origin}/learning-hub?post=${post.id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Link copied to clipboard! 📋');
    }).catch(() => {
      toast.info('Share: ' + url);
    });
  };

  // --- Play Game ---
  const playGame = async (game: HubGame) => {
    if (!currentUser) { setShowRegister(true); return; }
    try {
      await fetch('/api/hub?action=play-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: game.id, userId: currentUser.id }),
      });
      toast.success(`Playing ${game.title}! 🎮`);
    } catch { /* still allow play */ }
  };

  // --- Filtered/processed data ---
  const isReviewable = (post: HubPost | null) => post && ['poem', 'story', 'drama'].includes(post.contentType);

  const nestedComments = useMemo(() => {
    const roots = postComments.filter(c => !c.parentId);
    const childMap = new Map<string, HubComment[]>();
    postComments.filter(c => c.parentId).forEach(c => {
      const existing = childMap.get(c.parentId!) || [];
      existing.push(c);
      childMap.set(c.parentId!, existing);
    });
    return roots.map(c => ({ ...c, children: childMap.get(c.id) || [] }));
  }, [postComments]);

  const filteredGames = useMemo(() => {
    if (gameCategory === 'all') return games;
    return games.filter(g => g.category === gameCategory);
  }, [games, gameCategory]);

  const gameCategories = useMemo(() => [...new Set(games.map(g => g.category))], [games]);

  const top3 = leaderboard.slice(0, 3);
  const restLeaderboard = leaderboard.slice(3, 10);

  // Rising Stars: top posts by reviews (most reviewed)
  const mostReviewed = useMemo(() =>
    [...posts].filter(p => ['poem', 'story', 'drama'].includes(p.contentType)).sort((a, b) => b.reviewsCount - a.reviewsCount).slice(0, 3),
    [posts]);

  const userRank = useMemo(() => {
    if (!currentUser) return null;
    return leaderboard.find(e => e.id === currentUser.id) || null;
  }, [leaderboard, currentUser]);

  // ======================== RENDER ========================

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        {/* ===== REGISTRATION ONBOARDING MODAL ===== */}
        <Dialog open={showRegister} onOpenChange={setShowRegister}>
          <DialogContent className="sm:max-w-lg overflow-hidden">
            <DialogHeader className="sr-only">
              <DialogTitle>Join the Learning Hub</DialogTitle>
            </DialogHeader>
            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-2 mb-6 pt-2">
              {['Name', 'Avatar', 'About', 'Interests'].map((step, i) => (
                <Fragment key={step}>
                  <div className={`flex items-center gap-2 ${i <= registerStep ? 'text-emerald-600' : 'text-gray-300'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${i < registerStep ? 'bg-emerald-500 text-white' : i === registerStep ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500 ring-offset-2' : 'bg-gray-100 text-gray-400'}`}>
                      {i < registerStep ? <Check className="w-4 h-4" /> : i + 1}
                    </div>
                    <span className="text-xs font-medium hidden sm:block">{step}</span>
                  </div>
                  {i < 3 && <div className={`h-0.5 w-8 transition-colors duration-300 ${i < registerStep ? 'bg-emerald-500' : 'bg-gray-200'}`} />}
                </Fragment>
              ))}
            </div>

            {/* Step 0: Name + Email */}
            {registerStep === 0 && (
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4 shadow-lg shadow-emerald-200/50">
                    <GraduationCap className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Join the Learning Hub</h2>
                  <p className="text-sm text-gray-500 mt-1">Share, learn, and grow with our community</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Display Name *</label>
                  <Input placeholder="What should we call you?" value={registerName} onChange={(e) => setRegisterName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRegister()} maxLength={50} className="h-11" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Email (optional)</label>
                  <Input type="email" placeholder="your@email.com" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} maxLength={100} className="h-11" />
                </div>
              </div>
            )}

            {/* Step 1: Avatar Selection */}
            {registerStep === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-gray-900 text-center">Choose Your Avatar</h2>
                <p className="text-sm text-gray-500 text-center">Pick an emoji that represents you!</p>
                <div className="grid grid-cols-6 gap-3">
                  {AVATAR_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setRegisterAvatar(emoji)}
                      className={`w-full aspect-square rounded-xl text-2xl flex items-center justify-center transition-all duration-200 hover:scale-110 ${registerAvatar === emoji ? 'bg-emerald-100 ring-2 ring-emerald-500 shadow-md scale-105' : 'bg-gray-50 hover:bg-gray-100'}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Bio */}
            {registerStep === 2 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-gray-900 text-center">Tell Us About Yourself</h2>
                <p className="text-sm text-gray-500 text-center">Write a short tagline (optional)</p>
                <Textarea
                  placeholder="I love creative writing and debating ideas..."
                  value={registerBio}
                  onChange={e => setRegisterBio(e.target.value)}
                  rows={3}
                  maxLength={200}
                  className="resize-none"
                />
                <div className="text-right text-xs text-gray-400">{registerBio.length}/200</div>
              </div>
            )}

            {/* Step 3: Interests */}
            {registerStep === 3 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-gray-900 text-center">Pick Your Interests</h2>
                <p className="text-sm text-gray-500 text-center">Select topics you care about</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {INTEREST_OPTIONS.map(interest => {
                    const isSelected = registerInterests.includes(interest);
                    return (
                      <button
                        key={interest}
                        onClick={() => setRegisterInterests(prev => isSelected ? prev.filter(i => i !== interest) : [...prev, interest])}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${isSelected ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200/50' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                        {interest}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-3 mt-4">
              {registerStep > 0 && (
                <Button variant="outline" onClick={() => setRegisterStep(s => s - 1)} className="flex-1">
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
              )}
              <Button onClick={handleRegister} disabled={registering} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-11">
                {registering ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {registerStep < 3 ? 'Next' : registering ? 'Joining...' : 'Join Learning Hub'}
                {registerStep < 3 && <ChevronRight className="w-4 h-4 ml-1" />}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ===== CREATE POST DIALOG ===== */}
        <Dialog open={showCreatePost} onOpenChange={setShowCreatePost}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-emerald-600" />
                </div>
                Create New Post
              </DialogTitle>
              <DialogDescription>Share your thoughts, stories, or questions with the community.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Title *</label>
                <Input placeholder="Give your post a title..." value={newPost.title} onChange={e => setNewPost(p => ({ ...p, title: e.target.value }))} maxLength={200} className="h-11" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Channel *</label>
                  <Select value={newPost.channelId} onValueChange={v => setNewPost(p => ({ ...p, channelId: v }))}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {channels.map(ch => (
                        <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Content Type</label>
                  <Select value={newPost.contentType} onValueChange={v => setNewPost(p => ({ ...p, contentType: v }))}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['text', 'poem', 'story', 'drama', 'article', 'question', 'debate'].map(ct => (
                        <SelectItem key={ct} value={ct} className="capitalize">{ct}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Category</label>
                <Input placeholder="e.g., Fiction, Science, Study Tips..." value={newPost.category} onChange={e => setNewPost(p => ({ ...p, category: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Content * <span className="text-gray-400 font-normal">({newPost.content.length}/50000)</span></label>
                <Textarea placeholder="Write your content here..." value={newPost.content} onChange={e => setNewPost(p => ({ ...p, content: e.target.value }))} rows={8} className="resize-y" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Tags (comma separated)</label>
                <Input placeholder="e.g., poetry, nature, creative-writing" value={newPost.tags} onChange={e => setNewPost(p => ({ ...p, tags: e.target.value }))} />
              </div>
            </div>
            <DialogFooter className="gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowCreatePost(false)}>Cancel</Button>
              <Button onClick={handleCreatePost} disabled={creatingPost} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {creatingPost && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Publish Post
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== POST DETAIL SHEET ===== */}
        <Sheet open={!!selectedPost} onOpenChange={(open) => { if (!open) { setSelectedPost(null); setReplyTo(null); setCommentText(''); setReviewRating(0); setReviewText(''); } }}>
          <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
            <SheetHeader className="p-4 pb-0 shrink-0">
              <SheetTitle className="sr-only">Post Detail</SheetTitle>
              {selectedPost && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedPost(null)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Badge className={`${selectedPost.contentTypeColor || 'bg-gray-100 text-gray-700'} text-[10px] capitalize gap-1`}>
                    {React.createElement(CONTENT_TYPE_ICONS[selectedPost.contentType] || FileText, { className: 'h-3 w-3' })}
                    {selectedPost.contentTypeLabel || selectedPost.contentType}
                  </Badge>
                  {selectedPost.channel && <Badge variant="outline" className="text-[10px]">{selectedPost.channel.name}</Badge>}
                </div>
              )}
            </SheetHeader>

            {loadingPost ? (
              <div className="flex-1 p-4 space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : selectedPost ? (
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-5">
                  {/* Post Header */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-11 w-11 ring-2 ring-emerald-100">
                        <AvatarFallback className={`${BADGE_CONFIG[selectedPost.authorBadge || 'newcomer'].bg} ${BADGE_CONFIG[selectedPost.authorBadge || 'newcomer'].color}`}>
                          {getInitials(selectedPost.authorName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">{selectedPost.authorName}</span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${BADGE_CONFIG[selectedPost.authorBadge || 'newcomer'].bg} ${BADGE_CONFIG[selectedPost.authorBadge || 'newcomer'].color} capitalize`}>
                            {selectedPost.authorBadge || 'newcomer'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                          <Clock className="h-3 w-3" /> {timeAgo(selectedPost.createdAt)}
                          <span>·</span> {estimateReadTime(selectedPost.content)}
                          {selectedPost.isPinned && <><span>·</span><Pin className="h-3 w-3 text-emerald-500" /><span className="text-emerald-500 font-medium">Pinned</span></>}
                          {selectedPost.isFeatured && <><span>·</span><Star className="h-3 w-3 text-amber-500 fill-amber-500" /><span className="text-amber-500 font-medium">Featured</span></>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleBookmark(selectedPost.id)}>
                          {bookmarkedPosts.has(selectedPost.id) ? <BookmarkCheck className="h-4 w-4 text-emerald-500" /> : <Bookmark className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => sharePost(selectedPost)}>
                          <Share2 className="h-4 w-4" />
                        </Button>
                        {['poem', 'story', 'drama'].includes(selectedPost.contentType) && (
                          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => downloadAsText(selectedPost.title, selectedPost.content, selectedPost.authorName, selectedPost.createdAt)}>
                            <Download className="h-3.5 w-3.5" /> Download
                          </Button>
                        )}
                      </div>
                    </div>

                    <h2 className="text-xl font-bold text-gray-900 leading-tight">{selectedPost.title}</h2>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-xs">{selectedPost.category}</Badge>
                      {selectedPost.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">#{tag}</Badge>
                      ))}
                    </div>
                  </div>

                  {/* Post Content */}
                  <div className={`rounded-lg p-5 border bg-white shadow-sm text-gray-700 leading-relaxed ${selectedPost.contentType === 'poem' ? 'font-serif italic whitespace-pre-wrap text-center text-base' : 'whitespace-pre-wrap'}`}>
                    {selectedPost.content}
                  </div>

                  {/* Post Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button variant="ghost" size="sm" className={`gap-1.5 ${currentUser && selectedPost.likedBy?.includes(currentUser.id) ? 'text-red-500' : 'text-gray-500'}`} onClick={() => handleLike(selectedPost.id)}>
                      <Heart className={`h-4 w-4 transition-all ${currentUser && selectedPost.likedBy?.includes(currentUser.id) ? 'fill-red-500 scale-110' : ''}`} />
                      <span className="text-sm font-medium">{selectedPost.likes}</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1.5 text-gray-500">
                      <MessageSquare className="h-4 w-4" /> <span className="text-sm">{postComments.length}</span>
                    </Button>
                    {isReviewable(selectedPost) && (
                      <Button variant="ghost" size="sm" className="gap-1.5 text-gray-500">
                        <Star className="h-4 w-4" /> <span className="text-sm">{postReviews.length}</span>
                      </Button>
                    )}
                  </div>

                  <Separator />

                  {/* Reviews Section */}
                  {isReviewable(selectedPost) && (
                    <div className="space-y-4">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Star className="h-4 w-4 text-amber-500" /> Reviews ({postReviews.length})
                        {selectedPost.avgRating !== undefined && selectedPost.avgRating > 0 && (
                          <span className="text-sm font-normal text-gray-500">· {selectedPost.avgRating}/5 avg</span>
                        )}
                      </h3>

                      {/* Rating Breakdown Chart */}
                      {postReviews.length > 0 && <RatingBreakdownChart reviews={postReviews} />}

                      {/* Existing Reviews */}
                      <div className="space-y-3">
                        {postReviews.map(review => (
                          <div key={review.id} className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100/80 transition-colors">
                            <div className="flex items-center gap-2 mb-1.5">
                              <Avatar className="h-5 w-5">
                                <AvatarFallback className={`${BADGE_CONFIG[review.authorBadge || 'newcomer'].bg} text-xs ${BADGE_CONFIG[review.authorBadge || 'newcomer'].color}`}>
                                  {getInitials(review.authorName)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-xs text-gray-900">{review.authorName}</span>
                              <StarRating rating={review.rating} size="sm" />
                              <span className="text-[10px] text-gray-400 ml-auto">{timeAgo(review.createdAt)}</span>
                            </div>
                            {review.comment && <p className="text-sm text-gray-600 leading-relaxed">{review.comment}</p>}
                          </div>
                        ))}
                      </div>

                      {/* Add Review */}
                      {currentUser && currentUser.id !== selectedPost.authorId && (
                        <div className="bg-gradient-to-br from-amber-50/50 to-emerald-50/30 rounded-xl p-4 space-y-3 border border-amber-100/50">
                          <h4 className="text-sm font-semibold text-gray-800">Write a Review</h4>
                          <div className="flex items-center gap-2">
                            <StarRating rating={reviewRating} size="md" interactive hoveredStar={hoveredStar} onHover={setHoveredStar} onClick={setReviewRating} />
                            <span className="text-xs text-gray-500 font-medium">
                              {reviewRating === 0 ? 'Select rating' : RATING_LABELS[reviewRating]}
                            </span>
                          </div>
                          <Textarea placeholder="Share your thoughts on this piece..." value={reviewText} onChange={e => setReviewText(e.target.value)} rows={2} className="text-sm resize-none" maxLength={1000} />
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-400">{reviewText.length}/1000</span>
                            <Button size="sm" onClick={handleSubmitReview} disabled={submittingReview || reviewRating === 0} className="bg-amber-500 hover:bg-amber-600 text-white text-xs">
                              {submittingReview && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                              Submit Review
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <Separator />

                  {/* Comments Section */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-emerald-500" /> Comments ({postComments.length})
                    </h3>
                    <div className="space-y-3">
                      {nestedComments.map(comment => (
                        <CommentItem key={comment.id} comment={comment} currentUser={currentUser} onReply={setReplyTo} />
                      ))}
                      {postComments.length === 0 && (
                        <div className="text-center py-6 text-gray-400">
                          <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No comments yet. Be the first to share your thoughts!</p>
                        </div>
                      )}
                    </div>
                    {currentUser ? (
                      <div className="space-y-2">
                        {replyTo && (
                          <div className="flex items-center gap-2 text-xs text-gray-500 bg-emerald-50 rounded-lg px-3 py-2">
                            <MessageCircle className="h-3 w-3" />
                            <span>Replying to <strong>{replyTo.name}</strong></span>
                            <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-gray-600 ml-auto"><X className="h-3 w-3" /></button>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Input placeholder="Write a comment..." value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSubmitComment()} className="flex-1 text-sm" />
                          <Button size="icon" onClick={handleSubmitComment} disabled={submittingComment || !commentText.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0">
                            {submittingComment ? <Loader2 className="h-4 h-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" className="w-full" onClick={() => setShowRegister(true)}>
                        <Users className="h-4 w-4 mr-2" /> Sign in to comment
                      </Button>
                    )}
                  </div>
                </div>
              </ScrollArea>
            ) : null}
          </SheetContent>
        </Sheet>

        {/* ===== HERO SECTION ===== */}
        <div ref={heroRef} className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 text-white">
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-transparent to-teal-500/20 animate-gradient-x" />
          {/* Floating particles */}
          {[...Array(8)].map((_, i) => (
            <FloatingParticle key={i} delay={i * 0.8} size={4 + Math.random() * 8} left={10 + Math.random() * 80} />
          ))}
          <div className="relative max-w-7xl mx-auto px-4 py-10 md:py-16">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
              <div className="space-y-4 max-w-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 shadow-lg">
                    <GraduationCap className="w-7 h-7" />
                  </div>
                  <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Learning Hub</h1>
                    <p className="text-emerald-200 text-sm">Skoolar Community</p>
                  </div>
                </div>
                <p className="text-emerald-100 text-sm md:text-base leading-relaxed">
                  A vibrant community for creative minds! Share poems, stories, and articles. Debate ideas, learn together, play educational games, and earn badges as you grow.
                </p>
                {currentUser && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5 backdrop-blur-sm border border-white/10">
                      <span className="text-lg">{currentUser.avatar || '👤'}</span>
                      <span className="text-sm font-medium">{currentUser.displayName}</span>
                    </div>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge className={`${BADGE_CONFIG[currentUser.badge].bg} ${BADGE_CONFIG[currentUser.badge].color} border capitalize text-xs cursor-help`}>
                          {BADGE_CONFIG[currentUser.badge].icon && React.createElement(BADGE_CONFIG[currentUser.badge].icon, { className: 'w-3 h-3 mr-1' })}
                          {BADGE_CONFIG[currentUser.badge].label}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent><p>{BADGE_CONFIG[currentUser.badge].description}</p></TooltipContent>
                    </Tooltip>
                    <Badge variant="outline" className="bg-white/10 text-white border-white/20 text-xs">
                      <Flame className="h-3 w-3 mr-1 text-amber-400" /> {currentUser.points} pts
                    </Badge>
                    {currentUser.streak && (
                      <Badge variant="outline" className="bg-white/10 text-white border-white/20 text-xs">
                        <Zap className="h-3 w-3 mr-1 text-yellow-400" /> {currentUser.streak} day streak
                      </Badge>
                    )}
                  </div>
                )}
                {!currentUser && (
                  <Button onClick={() => setShowRegister(true)} size="lg" className="bg-white text-emerald-700 hover:bg-emerald-50 font-semibold shadow-lg shadow-emerald-900/20">
                    <Users className="w-4 h-4 mr-2" /> Join the Community
                  </Button>
                )}
              </div>

              {/* Stats */}
              {visibleStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Members', value: stats.totalUsers, icon: Users },
                    { label: 'Posts', value: stats.totalPosts, icon: FileText },
                    { label: 'Comments', value: stats.totalComments, icon: MessageCircle },
                    { label: 'Games', value: stats.totalGames, icon: Gamepad2 },
                  ].map(stat => (
                    <AnimatedCounter key={stat.label} {...stat} />
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Wave divider */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
              <path d="M0 60L48 55C96 50 192 40 288 35C384 30 480 30 576 33.3C672 36.7 768 43.3 864 45C960 46.7 1056 43.3 1152 40C1248 36.7 1344 33.3 1392 31.7L1440 30V60H1392C1344 60 1248 60 1152 60C1056 60 960 60 864 60C768 60 672 60 576 60C480 60 384 60 288 60C192 60 96 60 48 60H0Z" fill="#f9fafb" />
            </svg>
          </div>
        </div>

        {/* ===== MAIN CONTENT ===== */}
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex gap-6">
            {/* --- Channel Sidebar (Desktop) --- */}
            <aside className="hidden lg:block w-64 shrink-0 space-y-4">
              {/* Channels */}
              <Card className="sticky top-20 border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Hash className="h-4 w-4 text-emerald-500" /> Channels
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 pt-0 space-y-1">
                  <button
                    onClick={() => setActiveChannel('all')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${activeChannel === 'all' ? 'bg-emerald-50 text-emerald-700 font-medium shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    <MessageCircle className="h-4 w-4 shrink-0" />
                    <span>All Channels</span>
                    <Badge variant="secondary" className="ml-auto text-[10px]">{posts.length}</Badge>
                  </button>
                  {channels.map(ch => {
                    const ChannelIcon = getChannelIcon(ch.icon);
                    const channelIconEl = <ChannelIcon className="h-4 w-4 shrink-0" />;
                    return (
                      <button
                        key={ch.id}
                        onClick={() => setActiveChannel(ch.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${activeChannel === ch.id ? 'bg-emerald-50 text-emerald-700 font-medium shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                      >
                        {channelIconEl}
                        <span className="truncate">{ch.name}</span>
                        <Badge variant="secondary" className="ml-auto text-[10px]">{ch.postsCount}</Badge>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>

              {/* User Profile Card */}
              {currentUser && (
                <Card className="border-0 shadow-sm overflow-hidden">
                  <div className="h-16 bg-gradient-to-r from-emerald-400 to-teal-500 relative">
                    <div className="absolute -bottom-5 left-4">
                      <Avatar className="h-12 w-12 ring-3 ring-white shadow-md">
                        <AvatarFallback className={`${BADGE_CONFIG[currentUser.badge].bg} ${BADGE_CONFIG[currentUser.badge].color} text-base`}>
                          {currentUser.avatar || getInitials(currentUser.displayName)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </div>
                  <CardContent className="p-4 pt-8 space-y-3">
                    <div>
                      <div className="font-bold text-gray-900">{currentUser.displayName}</div>
                      <div className="text-xs text-gray-500">{currentUser.bio || 'Community member'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`${BADGE_CONFIG[currentUser.badge].bg} ${BADGE_CONFIG[currentUser.badge].color} border capitalize text-[10px] gap-1`}>
                        {React.createElement(BADGE_CONFIG[currentUser.badge].icon, { className: 'h-3 w-3' })}
                        {BADGE_CONFIG[currentUser.badge].label}
                      </Badge>
                    </div>
                    {/* XP Progress */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">{currentUser.points} pts</span>
                        {(() => {
                          const next = getNextBadgeLevel(currentUser.badge);
                          return next ? <span className="text-gray-400">{next.pointsNeeded} for {BADGE_CONFIG[next.level].label}</span> : <span className="text-amber-500 font-medium">MAX LEVEL!</span>;
                        })()}
                      </div>
                      <Progress value={getLevelProgress(currentUser.points, currentUser.badge)} className="h-2 bg-gray-100" />
                    </div>
                    {/* Points Breakdown */}
                    <div className="text-[10px] text-gray-400 space-y-0.5 border-t pt-2">
                      <div className="flex justify-between"><span>+25 pts per post</span></div>
                      <div className="flex justify-between"><span>+15 pts per review</span></div>
                      <div className="flex justify-between"><span>+5 pts per comment</span></div>
                      <div className="flex justify-between"><span>+2 pts per like received</span></div>
                    </div>
                    {/* Badges Showcase */}
                    <div className="border-t pt-2">
                      <div className="text-[10px] text-gray-500 font-medium mb-1.5">Badge Progress</div>
                      <div className="flex gap-1 flex-wrap">
                        {BADGE_LEVELS.map(level => (
                          <Tooltip key={level}>
                            <TooltipTrigger>
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${currentUser.badge === level ? `${BADGE_CONFIG[level].bg} shadow-md scale-110` : 'bg-gray-50 opacity-40'}`}>
                                <span className={currentUser.badge === level ? '' : 'grayscale'}>
                                  {React.createElement(BADGE_CONFIG[level].icon, { className: `w-3.5 h-3.5 ${BADGE_CONFIG[level].color}` })}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom"><p className="text-xs">{BADGE_CONFIG[level].label}: {BADGE_CONFIG[level].minPoints}+ pts — {BADGE_CONFIG[level].description}</p></TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Fun Fact */}
              <Card className="border-0 shadow-sm overflow-hidden">
                <div className="h-20 bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 flex items-center justify-center relative">
                  <Lightbulb className="w-8 h-8 text-white/80" />
                  <div className="absolute top-2 right-2 flex gap-0.5">
                    {[...Array(3)].map((_, i) => (
                      <Sparkles key={i} className="w-3 h-3 text-white/60 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                    ))}
                  </div>
                </div>
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-amber-500" /> Did You Know?
                  </h3>
                  <p className={`text-sm text-gray-600 leading-relaxed transition-opacity duration-300 ${funFactShuffling ? 'opacity-0' : 'opacity-100'}`}>
                    {funFact || 'Loading a fun fact...'}
                  </p>
                  <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={refreshFunFact}>
                    <RefreshCw className={`h-3 w-3 ${funFactShuffling ? 'animate-spin' : ''}`} /> New Fact
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full gap-1.5 text-xs" onClick={() => { navigator.clipboard.writeText(funFact); toast.success('Fact copied!'); }}>
                    <Share2 className="h-3 w-3" /> Share Fact
                  </Button>
                </CardContent>
              </Card>
            </aside>

            {/* --- Main Content Area --- */}
            <main className="flex-1 min-w-0 space-y-6">
              {/* Mobile Channel Selector */}
              <div className="lg:hidden">
                <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="w-full justify-between gap-2 h-11">
                      <div className="flex items-center gap-2">
                        <Menu className="h-4 w-4" />
                        <span>{activeChannel === 'all' ? 'All Channels' : channels.find(c => c.id === activeChannel)?.name || 'Channels'}</span>
                      </div>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-72 p-0">
                    <SheetHeader className="p-4 border-b">
                      <SheetTitle className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-emerald-500" /> Channels
                      </SheetTitle>
                    </SheetHeader>
                    <div className="p-2 space-y-1">
                      <button onClick={() => { setActiveChannel('all'); setSidebarOpen(false); }} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm ${activeChannel === 'all' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-600'}`}>
                        <MessageCircle className="h-4 w-4" /> All Channels
                      </button>
                      {channels.map(ch => {
                        const MobileChIcon = getChannelIcon(ch.icon);
                        return (
                          <button key={ch.id} onClick={() => { setActiveChannel(ch.id); setSidebarOpen(false); }} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm ${activeChannel === ch.id ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-600'}`}>
                            <MobileChIcon className="h-4 w-4" /> {ch.name}
                            <Badge variant="secondary" className="ml-auto text-[10px]">{ch.postsCount}</Badge>
                          </button>
                        );
                      })}
                    </div>
                    {/* Mobile Fun Fact */}
                    <div className="p-4 border-t">
                      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-3">
                        <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1 mb-1">
                          <Sparkles className="h-3 w-3 text-amber-500" /> Did You Know?
                        </h4>
                        <p className="text-xs text-gray-600 leading-relaxed">{funFact}</p>
                        <Button variant="ghost" size="sm" className="w-full mt-2 h-7 text-[10px]" onClick={refreshFunFact}>
                          <RefreshCw className="h-3 w-3 mr-1" /> New Fact
                        </Button>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              {/* Action Bar */}
              <div className="flex flex-col sm:flex-row gap-3">
                {currentUser && (
                  <Button onClick={() => setShowCreatePost(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm">
                    <Plus className="w-4 h-4" /> Create Post
                  </Button>
                )}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search posts, tags, authors..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 h-11 bg-white border-gray-200 shadow-sm"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
                  <SelectTrigger className="w-full sm:w-40 h-11"><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {['text', 'poem', 'story', 'drama', 'article', 'question', 'debate'].map(ct => (
                      <SelectItem key={ct} value={ct} className="capitalize">{ct}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full sm:w-40 h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Most Recent</SelectItem>
                    <SelectItem value="popular">Most Popular</SelectItem>
                    <SelectItem value="commented">Most Commented</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="bg-white shadow-sm border p-1 h-auto">
                  <TabsTrigger value="feed" className="gap-1.5 text-xs data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 rounded-md">
                    <MessageCircle className="h-3.5 w-3.5" /> Feed
                  </TabsTrigger>
                  <TabsTrigger value="games" className="gap-1.5 text-xs data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 rounded-md">
                    <Gamepad2 className="h-3.5 w-3.5" /> Games
                  </TabsTrigger>
                  <TabsTrigger value="leaderboard" className="gap-1.5 text-xs data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 rounded-md">
                    <Trophy className="h-3.5 w-3.5" /> Leaderboard
                  </TabsTrigger>
                  <TabsTrigger value="bookmarks" className="gap-1.5 text-xs data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 rounded-md">
                    <Bookmark className="h-3.5 w-3.5" /> Saved
                    {bookmarkedPosts.size > 0 && (
                      <Badge className="bg-emerald-500 text-white text-xs px-1.5 min-w-[16px] h-4 flex items-center justify-center">{bookmarkedPosts.size}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* ===== FEED TAB ===== */}
                <TabsContent value="feed" className="space-y-4">
                  {loading ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {[...Array(4)].map((_, i) => (
                        <Card key={i} className="overflow-hidden"><CardContent className="p-4 space-y-3">
                          <div className="flex items-center gap-2"><Skeleton className="h-9 w-9 rounded-full" /><Skeleton className="h-4 w-28" /></div>
                          <Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" />
                        </CardContent></Card>
                      ))}
                    </div>
                  ) : posts.length === 0 ? (
                    <div className="text-center py-12">
                      <BookOpen className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                      <h3 className="text-lg font-semibold text-gray-900">No posts yet</h3>
                      <p className="text-sm text-gray-500 mt-1">Be the first to share something amazing!</p>
                      {currentUser && (
                        <Button onClick={() => setShowCreatePost(true)} className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                          <Plus className="w-4 h-4" /> Create First Post
                        </Button>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Most Reviewed Section */}
                      {mostReviewed.length > 0 && activeChannel === 'all' && !searchQuery && contentTypeFilter === 'all' && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 text-amber-500" />
                            <h3 className="font-bold text-gray-900">Most Reviewed</h3>
                          </div>
                          <div className="grid gap-4 md:grid-cols-3">
                            {mostReviewed.map(post => (
                              <PostCard
                                key={post.id}
                                post={post}
                                currentUser={currentUser}
                                onOpen={() => openPost(post)}
                                onLike={() => handleLike(post.id)}
                                isBookmarked={bookmarkedPosts.has(post.id)}
                                onBookmark={() => toggleBookmark(post.id)}
                                onShare={() => sharePost(post)}
                              />
                            ))}
                          </div>
                          <Separator />
                        </div>
                      )}

                      {/* All Posts Grid */}
                      <div className={`grid gap-4 ${['poem', 'story', 'drama'].some(ct => ct === contentTypeFilter || contentTypeFilter === 'all') ? 'md:grid-cols-2' : ''}`}>
                        {posts.map(post => (
                          <PostCard
                            key={post.id}
                            post={post}
                            currentUser={currentUser}
                            onOpen={() => openPost(post)}
                            onLike={() => handleLike(post.id)}
                            isBookmarked={bookmarkedPosts.has(post.id)}
                            onBookmark={() => toggleBookmark(post.id)}
                            onShare={() => sharePost(post)}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </TabsContent>

                {/* ===== GAMES TAB ===== */}
                <TabsContent value="games" className="space-y-6">
                  {/* Featured Games Carousel */}
                  {featuredGames.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        <Star className="h-4 w-4 text-amber-500 fill-amber-500" /> Featured Games
                      </h3>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {featuredGames.map(game => (
                          <GameCard key={game.id} game={game} currentUser={currentUser} onPlay={playGame} />
                        ))}
                      </div>
                      <Separator />
                    </div>
                  )}

                  {/* All Games */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-bold text-gray-900">All Games</h3>
                      <div className="flex gap-1.5 flex-wrap">
                        <button onClick={() => setGameCategory('all')} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${gameCategory === 'all' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                          All
                        </button>
                        {gameCategories.map(cat => (
                          <button key={cat} onClick={() => setGameCategory(cat)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${gameCategory === cat ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredGames.map(game => (
                        <GameCard key={game.id} game={game} currentUser={currentUser} onPlay={playGame} />
                      ))}
                    </div>
                  </div>
                </TabsContent>

                {/* ===== LEADERBOARD TAB ===== */}
                <TabsContent value="leaderboard" className="space-y-6">
                  {/* Your Rank */}
                  {userRank && (
                    <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50/50 to-teal-50/50">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                          <Trophy className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-gray-900">Your Rank</div>
                          <div className="text-xs text-gray-500">#{userRank.rank} on the leaderboard</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-emerald-700">{userRank.points.toLocaleString()}</div>
                          <div className="text-[10px] text-gray-500">points</div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Podium - Top 3 */}
                  {top3.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-bold text-gray-900 text-center flex items-center justify-center gap-2">
                        <Crown className="h-5 w-5 text-amber-500" /> Top 3
                      </h3>
                      <div className="flex items-end justify-center gap-4">
                        {top3.map(entry => (
                          <PodiumCard key={entry.id} entry={entry} position={entry.rank} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rest of Leaderboard */}
                  {restLeaderboard.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-bold text-sm text-gray-900">Full Rankings</h3>
                      <Card className="border-0 shadow-sm overflow-hidden">
                        <div className="divide-y">
                          {restLeaderboard.map(entry => (
                            <div key={entry.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors">
                              <span className="text-sm font-bold text-gray-400 w-6 text-center">#{entry.rank}</span>
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className={`${BADGE_CONFIG[entry.badge].bg} ${BADGE_CONFIG[entry.badge].color} text-xs`}>
                                  {entry.avatar || getInitials(entry.displayName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium text-gray-900 truncate">{entry.displayName}</span>
                                <Badge variant="outline" className={`text-xs px-1 py-0 border ml-1.5 ${BADGE_CONFIG[entry.badge].bg} ${BADGE_CONFIG[entry.badge].color} capitalize`}>
                                  {entry.badge}
                                </Badge>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold text-gray-700">{entry.points.toLocaleString()}</div>
                                <div className="text-[10px] text-gray-400">{entry.postsCount} posts</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    </div>
                  )}

                  {/* Rising Stars */}
                  <div className="space-y-3">
                    <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-500" /> Rising Stars
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {leaderboard.slice(0, 3).filter(u => u.badge === 'newcomer' || u.badge === 'learner').map(user => (
                        <Card key={user.id} className="border-0 shadow-sm">
                          <CardContent className="p-3 flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className={`${BADGE_CONFIG[user.badge].bg} ${BADGE_CONFIG[user.badge].color} text-xs`}>
                                {getInitials(user.displayName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold truncate">{user.displayName}</div>
                              <div className="text-[10px] text-gray-500">{user.points} pts · {user.postsCount} posts</div>
                            </div>
                            <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                {/* ===== BOOKMARKS TAB ===== */}
                <TabsContent value="bookmarks" className="space-y-4">
                  {bookmarkedPosts.size === 0 ? (
                    <div className="text-center py-12">
                      <Bookmark className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                      <h3 className="text-lg font-semibold text-gray-900">No bookmarks yet</h3>
                      <p className="text-sm text-gray-500 mt-1">Save posts to read later!</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {posts.filter(p => bookmarkedPosts.has(p.id)).map(post => (
                        <PostCard
                          key={post.id}
                          post={post}
                          currentUser={currentUser}
                          onOpen={() => openPost(post)}
                          onLike={() => handleLike(post.id)}
                          isBookmarked={true}
                          onBookmark={() => toggleBookmark(post.id)}
                          onShare={() => sharePost(post)}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </main>
          </div>
        </div>

      </div>
    </TooltipProvider>
  );
}
