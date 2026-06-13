'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Tldraw } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

interface WhiteboardCanvasProps {
  liveClassId: string;
  isHost: boolean;
  socket: any;
}

export function WhiteboardCanvas({ liveClassId, isHost, socket }: WhiteboardCanvasProps) {
  const [editor, setEditor] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const editorRef = useRef<any>(null);

  const handleMount = useCallback((editorInstance: any) => {
    editorRef.current = editorInstance;
    setEditor(editorInstance);
    loadSnapshot(editorInstance);
  }, []);

  const loadSnapshot = async (editorInstance: any) => {
    try {
      const res = await fetch(`/api/live-classes/${liveClassId}`);
      const json = await res.json();
      if (json.data?.whiteboards?.length > 0) {
        const lastSnapshot = json.data.whiteboards[json.data.whiteboards.length - 1].snapshot;
        editorInstance.loadSnapshot(lastSnapshot);
      }
    } catch {}
  };

  const saveSnapshot = async () => {
    if (!editor) return;
    setIsSaving(true);
    try {
      const snapshot = editor.getSnapshot();
      await fetch(`/api/live-classes/${liveClassId}/whiteboard`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot }),
      });
      toast.success('Whiteboard saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    if (!editor) return;
    const svg = await editor.getSvg(Array.from(editor.getCurrentPageShapeIds()));
    if (!svg) return;
    const svgStr = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whiteboard-${liveClassId.slice(0, 8)}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Use a ref to track the current socket so effects don't depend on socket identity
  const socketRef = useRef<any>(socket);
  socketRef.current = socket;

  useEffect(() => {
    const currentEditor = editorRef.current;
    if (!socketRef.current || !currentEditor) return;

    const handleSync = ({ snapshot }: { snapshot: any }) => {
      currentEditor.loadSnapshot(snapshot);
    };

    const s = socketRef.current;
    s.on('live-class:whiteboard-sync', handleSync);

    const unsubscribe = currentEditor.store.listen(() => {
      const snapshot = currentEditor.getSnapshot();
      if (socketRef.current?.connected) {
        socketRef.current.emit('live-class:whiteboard-update', {
          classId: liveClassId,
          snapshot,
        });
      }
    }, { scope: 'document', source: 'user' });

    return () => {
      s.off('live-class:whiteboard-sync', handleSync);
      unsubscribe?.();
    };
  }, [editor, liveClassId]);

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        {isHost && (
          <Button size="sm" variant="outline" onClick={saveSnapshot} disabled={isSaving}
            className="bg-white/90 text-xs h-8">
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={handleExport}
          className="bg-white/90 text-xs h-8">
          <Download className="size-3 mr-1" /> Export
        </Button>
      </div>
      <Tldraw
        onMount={handleMount}
      />
    </div>
  );
}
