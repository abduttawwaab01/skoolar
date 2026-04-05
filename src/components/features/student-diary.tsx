'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  BookOpen, TrendingUp, Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight,
  Flame, Search, Smile, Frown, Meh, SmilePlus, Angry,
} from 'lucide-react';
import { toast } from 'sonner';

interface DiaryEntry {
  id: string;
  date: string;
  mood: 'happy' | 'good' | 'okay' | 'bad' | 'terrible';
  highlight: string;
  learned: string;
  teacherFeedback: string;
  goalsTomorrow: string;
  studentId: string;
  schoolId: string;
  createdAt: string;
}

interface DiaryStats {
  totalEntries: number;
  currentStreak: number;
  longestStreak: number;
  averageMood: number;
}

interface MoodHistoryItem {
  date: string;
  mood: string;
  moodValue: number;
}

const moodConfig: Record<string, { emoji: string; label: string; color: string; bgColor: string; value: number; icon: React.ReactNode }> = {
  happy: { emoji: '😊', label: 'Happy', color: 'text-emerald-600', bgColor: 'bg-emerald-100', value: 5, icon: <SmilePlus className="h-5 w-5 text-emerald-500" /> },
  good: { emoji: '🙂', label: 'Good', color: 'text-blue-600', bgColor: 'bg-blue-100', value: 4, icon: <Smile className="h-5 w-5 text-blue-500" /> },
  okay: { emoji: '😐', label: 'Okay', color: 'text-amber-600', bgColor: 'bg-amber-100', value: 3, icon: <Meh className="h-5 w-5 text-amber-500" /> },
  bad: { emoji: '😔', label: 'Bad', color: 'text-orange-600', bgColor: 'bg-orange-100', value: 2, icon: <Frown className="h-5 w-5 text-orange-500" /> },
  terrible: { emoji: '😢', label: 'Terrible', color: 'text-red-600', bgColor: 'bg-red-100', value: 1, icon: <Angry className="h-5 w-5 text-red-500" /> },
};

const moodBarColors: Record<string, string> = {
  happy: 'bg-emerald-400',
  good: 'bg-blue-400',
  okay: 'bg-amber-400',
  bad: 'bg-orange-400',
  terrible: 'bg-red-400',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function StudentDiary() {
  const today = new Date();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [stats, setStats] = useState<DiaryStats>({ totalEntries: 0, currentStreak: 0, longestStreak: 0, averageMood: 0 });
  const [moodHistory, setMoodHistory] = useState<MoodHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedEntry, setSelectedEntry] = useState<DiaryEntry | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // New entry form
  const [newEntry, setNewEntry] = useState({
    date: today.toISOString().split('T')[0],
    mood: 'good' as DiaryEntry['mood'],
    highlight: '',
    learned: '',
    teacherFeedback: '',
    goalsTomorrow: '',
  });

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/student-diary');
      const json = await res.json();
      if (json.data) setEntries(json.data);
      if (json.stats) setStats(json.stats);
      if (json.moodHistory) setMoodHistory(json.moodHistory);
    } catch {
      toast.error('Failed to load diary entries');
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = async () => {
    if (!newEntry.date || !newEntry.mood) {
      toast.error('Please select a date and mood');
      return;
    }
    try {
      const res = await fetch('/api/student-diary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newEntry,
          studentId: 'student-1',
          schoolId: 'school-1',
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(json.message || 'Diary entry saved successfully');
        setShowAddDialog(false);
        setNewEntry({
          date: today.toISOString().split('T')[0],
          mood: 'good',
          highlight: '',
          learned: '',
          teacherFeedback: '',
          goalsTomorrow: '',
        });
        fetchEntries();
      } else {
        toast.error(json.error || 'Failed to save entry');
      }
    } catch {
      toast.error('Failed to save entry');
    }
  };

  const prevMonth = () => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  const goToToday = () => setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const formatDateStr = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const getEntryForDate = (dateStr: string) => entries.find(e => e.date === dateStr);

  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [currentDate]);

  const filteredEntries = useMemo(() => {
    if (!searchQuery) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(e =>
      e.highlight.toLowerCase().includes(q) ||
      e.learned.toLowerCase().includes(q) ||
      e.teacherFeedback.toLowerCase().includes(q) ||
      e.goalsTomorrow.toLowerCase().includes(q)
    );
  }, [entries, searchQuery]);

  const isToday = (day: number) => {
    return day === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
  };

  const getMoodLabel = (mood: string) => moodConfig[mood]?.label || 'Unknown';
  const getMoodEmoji = (mood: string) => moodConfig[mood]?.emoji || '📝';
  const getMoodColor = (mood: string) => moodConfig[mood]?.color || 'text-gray-500';
  const getMoodBgColor = (mood: string) => moodConfig[mood]?.bgColor || 'bg-gray-100';

  const getAverageMoodLabel = (avg: number) => {
    if (avg >= 4.5) return 'Very Happy';
    if (avg >= 3.5) return 'Happy';
    if (avg >= 2.5) return 'Okay';
    if (avg >= 1.5) return 'Bad';
    return 'Struggling';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100">
            <BookOpen className="h-6 w-6 text-blue-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Student Diary</h2>
            <p className="text-sm text-gray-500">Daily journal and mood tracker</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowAddDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Entry
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <BookOpen className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalEntries}</p>
              <p className="text-xs text-gray-500">Total Entries</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100">
              <Flame className="h-4 w-4 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.currentStreak}</p>
              <p className="text-xs text-gray-500">Current Streak</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100">
              <Flame className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.longestStreak}</p>
              <p className="text-xs text-gray-500">Longest Streak</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.averageMood.toFixed(1)}</p>
              <p className="text-xs text-gray-500">{getAverageMoodLabel(stats.averageMood)}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Mood History Chart (last 30 days) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Mood History (Last 30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1 h-24">
                {moodHistory.length > 0 ? moodHistory.map((item, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                    <div
                      className={`w-full rounded-t-sm ${moodBarColors[item.mood] || 'bg-gray-300'}`}
                      style={{ height: `${(item.moodValue / 5) * 100}%`, minHeight: '4px' }}
                      title={`${item.date}: ${getMoodLabel(item.mood)} ${moodConfig[item.mood]?.emoji}`}
                    />
                  </div>
                )) : (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-xs text-gray-400">No mood data yet</p>
                  </div>
                )}
              </div>
              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-gray-100">
                {Object.entries(moodConfig).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <div className={`w-3 h-2 rounded-sm ${moodBarColors[key]}`} />
                    <span className="text-[10px] text-gray-500">{val.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Search Entries */}
          <Card>
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search diary entries..."
                  className="pl-9 h-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Recent Entries */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-600" />
                {searchQuery ? 'Search Results' : 'Recent Entries'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-3">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="animate-pulse space-y-2 p-3 rounded-lg border">
                        <div className="h-4 bg-gray-200 rounded w-1/3" />
                        <div className="h-3 bg-gray-100 rounded w-full" />
                        <div className="h-3 bg-gray-100 rounded w-2/3" />
                      </div>
                    ))
                  ) : filteredEntries.length === 0 ? (
                    <div className="text-center py-8">
                      <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">{searchQuery ? 'No matching entries found' : 'No diary entries yet'}</p>
                      <p className="text-xs text-gray-400 mt-1">{searchQuery ? 'Try a different search term' : 'Click "Add Entry" to start journaling'}</p>
                    </div>
                  ) : (
                    filteredEntries.slice(0, 10).map(entry => (
                      <button
                        key={entry.id}
                        onClick={() => setSelectedEntry(entry)}
                        className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{getMoodEmoji(entry.mood)}</span>
                            <span className="text-xs font-medium text-gray-500">
                              {new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <Badge className={`${getMoodBgColor(entry.mood)} ${getMoodColor(entry.mood)} text-[10px] border-0`}>
                            {getMoodLabel(entry.mood)}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-800 font-medium line-clamp-1">{entry.highlight || 'No highlight'}</p>
                        <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{entry.learned || 'No notes'}</p>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Calendar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-blue-600" />
                  Diary Calendar
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={goToToday} className="text-xs h-7">
                  Today
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-semibold">
                  {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Weekday Headers */}
              <div className="grid grid-cols-7 mb-1">
                {WEEKDAYS.map(day => (
                  <div key={day} className="text-center text-[10px] font-medium text-gray-400 py-1">{day}</div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => {
                  if (day === null) {
                    return <div key={`empty-${idx}`} className="h-10" />;
                  }
                  const dateStr = formatDateStr(currentDate.getFullYear(), currentDate.getMonth(), day);
                  const entry = getEntryForDate(dateStr);
                  const todayHighlight = isToday(day);

                  return (
                    <button
                      key={dateStr}
                      onClick={() => {
                        if (entry) setSelectedEntry(entry);
                        else {
                          setNewEntry(prev => ({ ...prev, date: dateStr }));
                          setShowAddDialog(true);
                        }
                      }}
                      className={`h-10 flex flex-col items-center justify-center rounded-lg text-xs transition-colors hover:bg-gray-100 relative ${
                        todayHighlight ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                      } ${entry ? 'font-medium' : 'text-gray-400'}`}
                    >
                      <span className={todayHighlight ? 'text-blue-600' : ''}>{day}</span>
                      {entry && (
                        <span className="text-[10px] -mt-0.5">{getMoodEmoji(entry.mood)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Weekly Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Weekly Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(() => {
                  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                  const weekEntries = entries.filter(e => new Date(e.date) >= weekAgo);

                  if (weekEntries.length === 0) {
                    return <p className="text-xs text-gray-400 text-center py-4">No entries this week</p>;
                  }

                  const moodCounts: Record<string, number> = {};
                  weekEntries.forEach(e => {
                    moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
                  });

                  const weekAvg = weekEntries.reduce((sum, e) => sum + (moodConfig[e.mood]?.value || 3), 0) / weekEntries.length;

                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Entries this week</span>
                        <span className="text-sm font-bold">{weekEntries.length}</span>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Average mood</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold">{weekAvg.toFixed(1)}</span>
                          <span className="text-xs">{moodConfig[weekAvg >= 4 ? 'happy' : weekAvg >= 3 ? 'okay' : 'bad']?.emoji}</span>
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Mood breakdown</p>
                        <div className="flex gap-2 flex-wrap">
                          {Object.entries(moodCounts).map(([mood, count]) => (
                            <div key={mood} className="flex items-center gap-1">
                              <span className="text-sm">{moodConfig[mood]?.emoji}</span>
                              <span className="text-xs text-gray-600">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <p className="text-xs text-gray-500 mb-1.5">Learning streak</p>
                        <div className="flex items-center gap-1.5">
                          <Flame className="h-4 w-4 text-orange-500" />
                          <span className="text-sm font-bold text-orange-600">{stats.currentStreak} days</span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Entry Detail Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="sm:max-w-lg">
          {selectedEntry && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span className="text-2xl">{getMoodEmoji(selectedEntry.mood)}</span>
                  <div>
                    <div>{new Date(selectedEntry.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
                    <Badge className={`${getMoodBgColor(selectedEntry.mood)} ${getMoodColor(selectedEntry.mood)} text-xs mt-1 border-0`}>
                      {getMoodLabel(selectedEntry.mood)}
                    </Badge>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Today&apos;s Highlight</label>
                  <p className="text-sm text-gray-800 mt-1 leading-relaxed">{selectedEntry.highlight || 'No highlight recorded'}</p>
                </div>
                <Separator />
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">What I Learned</label>
                  <p className="text-sm text-gray-800 mt-1 leading-relaxed">{selectedEntry.learned || 'Nothing recorded'}</p>
                </div>
                <Separator />
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Teacher Feedback</label>
                  <p className="text-sm text-gray-800 mt-1 leading-relaxed">{selectedEntry.teacherFeedback || 'No feedback'}</p>
                </div>
                <Separator />
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Goals for Tomorrow</label>
                  <p className="text-sm text-gray-800 mt-1 leading-relaxed">{selectedEntry.goalsTomorrow || 'No goals set'}</p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Entry Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              Add Diary Entry
            </DialogTitle>
            <DialogDescription>Record your thoughts and learnings for the day</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Date</label>
              <Input
                type="date"
                value={newEntry.date}
                onChange={(e) => setNewEntry(prev => ({ ...prev, date: e.target.value }))}
                className="h-10"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">How are you feeling?</label>
              <div className="flex items-center gap-3">
                {(Object.entries(moodConfig) as [string, typeof moodConfig.happy][]).map(([key, val]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setNewEntry(prev => ({ ...prev, mood: key as DiaryEntry['mood'] }))}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                      newEntry.mood === key
                        ? `${val.bgColor} ${val.color} border-current scale-105`
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-2xl">{val.emoji}</span>
                    <span className="text-[10px] font-medium">{val.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Today&apos;s Highlight</label>
              <Textarea
                value={newEntry.highlight}
                onChange={(e) => setNewEntry(prev => ({ ...prev, highlight: e.target.value }))}
                placeholder="What was the best part of your day?"
                rows={2}
                className="resize-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">What I Learned</label>
              <Textarea
                value={newEntry.learned}
                onChange={(e) => setNewEntry(prev => ({ ...prev, learned: e.target.value }))}
                placeholder="What new things did you learn today?"
                rows={2}
                className="resize-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Teacher Feedback</label>
              <Textarea
                value={newEntry.teacherFeedback}
                onChange={(e) => setNewEntry(prev => ({ ...prev, teacherFeedback: e.target.value }))}
                placeholder="Any feedback from your teacher?"
                rows={2}
                className="resize-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Goals for Tomorrow</label>
              <Textarea
                value={newEntry.goalsTomorrow}
                onChange={(e) => setNewEntry(prev => ({ ...prev, goalsTomorrow: e.target.value }))}
                placeholder="What do you want to achieve tomorrow?"
                rows={2}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddEntry} className="gap-2">
              <BookOpen className="h-4 w-4" /> Save Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
