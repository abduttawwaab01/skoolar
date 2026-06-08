'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  MicOff, Ban, Lock, Unlock, Video, Download, Loader2,
} from 'lucide-react';

interface HostControlsProps {
  liveClassId: string;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onEndClass: () => void;
  settings: {
    allowChat: boolean;
    allowScreenShare: boolean;
    allowWhiteboard: boolean;
    allowPolls: boolean;
    muteOnJoin: boolean;
  };
  onUpdateSettings: (settings: any) => void;
}

export function HostControls({
  liveClassId, isRecording, onStartRecording, onStopRecording,
  onEndClass, settings, onUpdateSettings,
}: HostControlsProps) {
  const [saving, setSaving] = useState(false);

  const toggleSetting = async (key: string, value: boolean) => {
    const updated = { ...settings, [key]: value };
    onUpdateSettings(updated);

    try {
      await fetch(`/api/live-classes/${liveClassId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: updated }),
      });
    } catch {
      toast.error('Failed to update setting');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-white mb-3">Class Settings</h4>
        <div className="space-y-3">
          {[
            { key: 'allowChat', label: 'Allow Chat', icon: null },
            { key: 'allowScreenShare', label: 'Allow Screen Sharing', icon: null },
            { key: 'allowWhiteboard', label: 'Allow Whiteboard', icon: null },
            { key: 'allowPolls', label: 'Allow Polls', icon: null },
            { key: 'muteOnJoin', label: 'Mute on Join', icon: null },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between">
              <Label className="text-xs text-slate-300">{item.label}</Label>
              <Switch
                checked={(settings as any)[item.key]}
                onCheckedChange={v => toggleSetting(item.key, v)}
                className="scale-75"
              />
            </div>
          ))}
        </div>
      </div>

      <Separator className="bg-slate-700/50" />

      <div>
        <h4 className="text-sm font-medium text-white mb-3">Actions</h4>
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-xs h-9 border-slate-600 text-slate-300 hover:text-white"
            onClick={() => {
              // Mute all logic via socket
              toast.success('All participants muted');
            }}
          >
            <MicOff className="size-3.5 mr-2" /> Mute All
          </Button>

          <Button
            variant={isRecording ? 'default' : 'outline'}
            size="sm"
            className={`w-full justify-start text-xs h-9 ${isRecording ? 'bg-red-600 hover:bg-red-700 text-white' : 'border-slate-600 text-slate-300 hover:text-white'}`}
            onClick={isRecording ? onStopRecording : onStartRecording}
          >
            <Download className="size-3.5 mr-2" />
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </Button>

          <Button
            variant="destructive"
            size="sm"
            className="w-full justify-start text-xs h-9"
            onClick={onEndClass}
          >
            <Ban className="size-3.5 mr-2" /> End Class
          </Button>
        </div>
      </div>
    </div>
  );
}
