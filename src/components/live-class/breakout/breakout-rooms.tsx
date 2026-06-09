'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Plus, X, Users, DoorOpen, Loader2, Trash2 } from 'lucide-react';

interface BreakoutRoom {
  id: string;
  name: string;
  participantIds: string[];
  isActive: boolean;
  createdAt: string;
}

interface BreakoutRoomsProps {
  liveClassId: string;
  isHost: boolean;
  participants: { id: string; name: string; role: string }[];
}

export function BreakoutRooms({ liveClassId, isHost, participants }: BreakoutRoomsProps) {
  const [rooms, setRooms] = useState<BreakoutRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRoomName, setNewRoomName] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch(`/api/live-classes/${liveClassId}/breakout-rooms`);
      const json = await res.json();
      setRooms(json.data || []);
    } catch {} finally {
      setLoading(false);
    }
  }, [liveClassId]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const createRoom = async () => {
    if (!newRoomName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/live-classes/${liveClassId}/breakout-rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRoomName.trim() }),
      });
      if (res.ok) {
        const json = await res.json();
        setRooms(prev => [...prev, json.data]);
        setNewRoomName('');
        toast.success('Breakout room created');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to create room');
      }
    } catch {
      toast.error('Failed to create room');
    } finally {
      setCreating(false);
    }
  };

  const deleteRoom = async (roomId: string) => {
    try {
      const res = await fetch(`/api/live-classes/${liveClassId}/breakout-rooms/${roomId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setRooms(prev => prev.filter(r => r.id !== roomId));
        toast.success('Room deleted');
      }
    } catch {
      toast.error('Failed to delete room');
    }
  };

  const toggleActive = async (room: BreakoutRoom) => {
    try {
      await fetch(`/api/live-classes/${liveClassId}/breakout-rooms/${room.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !room.isActive }),
      });
      setRooms(prev => prev.map(r => r.id === room.id ? { ...r, isActive: !r.isActive } : r));
    } catch {
      toast.error('Failed to update room');
    }
  };

  const assignParticipant = async (roomId: string, participantId: string, add: boolean) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    const participantIds = add
      ? [...room.participantIds, participantId]
      : room.participantIds.filter(id => id !== participantId);
    try {
      await fetch(`/api/live-classes/${liveClassId}/breakout-rooms/${roomId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantIds }),
      });
      setRooms(prev => prev.map(r => r.id === roomId ? { ...r, participantIds } : r));
    } catch {
      toast.error('Failed to assign participant');
    }
  };

  const nonHostParticipants = participants.filter(p => p.role !== 'host');
  const unassignedParticipants = nonHostParticipants.filter(p =>
    !rooms.some(r => r.participantIds.includes(p.id))
  );

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
        <div className="flex gap-2">
          <Input
            placeholder="New room name..."
            value={newRoomName}
            onChange={e => setNewRoomName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createRoom()}
            className="bg-slate-700/50 border-slate-600 text-white text-sm h-9"
          />
          <Button size="sm" onClick={createRoom} disabled={creating || !newRoomName.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 h-9 shrink-0">
            <Plus className="size-3.5 mr-1" /> Add
          </Button>
        </div>
      )}

      <ScrollArea className="max-h-[400px]">
        <div className="space-y-3">
          {rooms.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-8">
              {isHost ? 'Create breakout rooms for group discussions' : 'No breakout rooms yet'}
            </p>
          )}
          {rooms.map(room => (
            <div key={room.id} className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <DoorOpen className="size-4 text-emerald-400" />
                  <h4 className="text-sm font-medium text-white">{room.name}</h4>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] ${room.isActive ? 'text-emerald-400 border-emerald-500/30' : 'text-slate-400 border-slate-500/30'}`}>
                    {room.isActive ? 'Active' : 'Closed'}
                  </Badge>
                  {isHost && (
                    <>
                      <Button variant="ghost" size="icon" className="size-6 text-slate-400 hover:text-white"
                        onClick={() => toggleActive(room)} title={room.isActive ? 'Close room' : 'Open room'}>
                        <DoorOpen className="size-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-6 text-red-400 hover:text-red-300"
                        onClick={() => deleteRoom(room.id)} title="Delete room">
                        <Trash2 className="size-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {isHost && unassignedParticipants.length > 0 && (
                <div className="mb-2">
                  <select
                    className="w-full text-xs bg-slate-700/50 border border-slate-600 rounded p-1.5 text-slate-300"
                    onChange={e => {
                      if (e.target.value) {
                        assignParticipant(room.id, e.target.value, true);
                        e.target.value = '';
                      }
                    }}
                    value=""
                  >
                    <option value="">Assign participant...</option>
                    {unassignedParticipants.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {room.participantIds.map(pid => {
                  const p = participants.find(pp => pp.id === pid);
                  return p ? (
                    <Badge key={pid} variant="secondary" className="text-[10px] flex items-center gap-1">
                      {p.name}
                      {isHost && (
                        <button onClick={() => assignParticipant(room.id, pid, false)}
                          className="text-slate-400 hover:text-white ml-1">
                          <X className="size-2.5" />
                        </button>
                      )}
                    </Badge>
                  ) : null;
                })}
                {room.participantIds.length === 0 && (
                  <span className="text-[10px] text-slate-500">No participants assigned</span>
                )}
              </div>

              <div className="flex items-center gap-1 mt-1.5">
                <Users className="size-3 text-slate-500" />
                <span className="text-[10px] text-slate-500">{room.participantIds.length} participant{room.participantIds.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
