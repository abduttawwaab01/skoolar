'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Plus, X, Vote, BarChart3, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Poll {
  id: string;
  question: string;
  options: { id: string; text: string }[];
  isMultiple: boolean;
  isAnonymous: boolean;
  isActive: boolean;
  _count?: { votes: number };
  votes?: PollVote[];
}

interface PollVote {
  id: string;
  optionId: string;
  userId?: string;
  guestId?: string;
}

interface PollsProps {
  liveClassId: string;
  isHost: boolean;
  userId?: string;
  guestId?: string;
}

export function Polls({ liveClassId, isHost, userId, guestId }: PollsProps) {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isMultiple, setIsMultiple] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const fetchPolls = async () => {
    try {
      const res = await fetch(`/api/live-classes/${liveClassId}/polls`);
      const json = await res.json();
      setPolls(json.data || []);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolls();
  }, [liveClassId]);

  const addOption = () => {
    if (options.length < 10) setOptions([...options, '']);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) setOptions(options.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, value: string) => {
    const next = [...options];
    next[index] = value;
    setOptions(next);
  };

  const createPoll = async () => {
    if (!question.trim()) {
      toast.error('Enter a question');
      return;
    }
    const validOptions = options.filter(o => o.trim());
    if (validOptions.length < 2) {
      toast.error('At least 2 options required');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`/api/live-classes/${liveClassId}/polls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          options: validOptions,
          isMultiple,
          isAnonymous,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      setQuestion('');
      setOptions(['', '']);
      setIsMultiple(false);
      setIsAnonymous(false);
      toast.success('Poll created!');
      fetchPolls();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create poll');
    } finally {
      setCreating(false);
    }
  };

  const vote = async (pollId: string, optionId: string) => {
    try {
      const res = await fetch(`/api/live-classes/${liveClassId}/polls/${pollId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId, guestId: guestId || undefined }),
      });

      if (res.ok) {
        fetchPolls();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to vote');
      }
    } catch {
      toast.error('Failed to vote');
    }
  };

  const getTotalVotes = (poll: Poll) => {
    return poll._count?.votes || 0;
  };

  const getVotePercentage = (poll: Poll, optionId: string) => {
    const total = getTotalVotes(poll);
    if (total === 0) return 0;
    const optionVotes = poll.votes?.filter(v => v.optionId === optionId).length || 0;
    return Math.round((optionVotes / total) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="size-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isHost && (
        <div className="space-y-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <h4 className="text-sm font-medium text-white">Create Poll</h4>
          <div className="space-y-2">
            <Input
              placeholder="Ask a question..."
              value={question}
              onChange={e => setQuestion(e.target.value)}
              className="bg-slate-700/50 border-slate-600 text-white text-sm"
            />
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  placeholder={`Option ${i + 1}`}
                  value={opt}
                  onChange={e => updateOption(i, e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white text-sm"
                />
                {options.length > 2 && (
                  <Button variant="ghost" size="icon" className="size-8 text-slate-400"
                    onClick={() => removeOption(i)}>
                    <X className="size-3" />
                  </Button>
                )}
              </div>
            ))}
            {options.length < 10 && (
              <Button variant="ghost" size="sm" onClick={addOption}
                className="text-xs text-slate-400 h-7">
                <Plus className="size-3 mr-1" /> Add option
              </Button>
            )}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <Switch checked={isMultiple} onCheckedChange={setIsMultiple} className="scale-75" />
                  Multiple
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} className="scale-75" />
                  Anonymous
                </label>
              </div>
              <Button size="sm" onClick={createPoll} disabled={creating}
                className="bg-emerald-600 hover:bg-emerald-700 text-xs h-8">
                {creating ? <Loader2 className="size-3 animate-spin" /> : <Vote className="size-3 mr-1" />}
                Create
              </Button>
            </div>
          </div>
        </div>
      )}

      <ScrollArea className="max-h-[400px]">
        <div className="space-y-3">
          {polls.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-8">No polls yet</p>
          )}
          {polls.map(poll => (
            <div key={poll.id} className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/30">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-white">{poll.question}</h4>
                {poll.isActive ? (
                  <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-[10px]">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-slate-400 border-slate-500/30 text-[10px]">
                    Closed
                  </Badge>
                )}
              </div>

              {poll.isActive ? (
                <div className="space-y-1.5">
                  {poll.options.map(opt => {
                    const pct = getVotePercentage(poll, opt.id);
                    return (
                      <button
                        key={opt.id}
                        onClick={() => vote(poll.id, opt.id)}
                        className="w-full text-left p-2 rounded bg-slate-700/30 hover:bg-slate-700/50 transition-colors relative overflow-hidden"
                      >
                        <div
                          className="absolute inset-0 bg-emerald-500/10 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                        <span className="relative text-xs text-slate-300 flex items-center justify-between">
                          <span>{opt.text}</span>
                          <span className="text-emerald-400">{pct}%</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1.5 opacity-60">
                  {poll.options.map(opt => (
                    <div key={opt.id} className="p-2 rounded bg-slate-700/20">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>{opt.text}</span>
                        <span>{getVotePercentage(poll, opt.id)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 mt-1.5">
                <BarChart3 className="size-3 text-slate-500" />
                <span className="text-[10px] text-slate-500">
                  {getTotalVotes(poll)} votes
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
