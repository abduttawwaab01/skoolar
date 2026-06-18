'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface IDCardRendererProps {
  cardId?: string;
  schoolId?: string;
  studentId?: string;
  teacherId?: string;
  designId?: string;
  side?: 'front' | 'back';
  className?: string;
}

export function IDCardRenderer({
  cardId,
  schoolId,
  studentId,
  teacherId,
  designId,
  side = 'front',
  className = '',
}: IDCardRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCard();
  }, [cardId, studentId, teacherId, designId, side]);

  async function loadCard() {
    setLoading(true);
    setError(null);
    try {
      let url = '';
      if (cardId) {
        url = `/api/id-cards/${cardId}/${side === 'front' ? 'pdf' : 'pdf'}`;
      } else {
        const res = await fetch('/api/id-cards/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schoolId: schoolId || '',
            studentId: studentId || undefined,
            teacherId: teacherId || undefined,
            designId: designId || undefined,
            side,
          }),
        });
        if (!res.ok) throw new Error('Preview failed');
        const html = await res.text();
        if (iframeRef.current) {
          iframeRef.current.srcdoc = html;
        }
        setLoading(false);
        return;
      }

      if (url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load card');
        const html = await res.text();
        if (iframeRef.current) {
          iframeRef.current.srcdoc = html;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load card');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`relative ${className}`} style={{ width: '85.6mm', height: '53.98mm' }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10 rounded-md">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      )}
      {error ? (
        <div className="flex items-center justify-center bg-muted rounded-md text-xs text-muted-foreground h-full">
          {error}
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          className="w-full h-full border-0 rounded-md"
          style={{ width: '85.6mm', height: '53.98mm' }}
          title="ID Card"
        />
      )}
    </div>
  );
}
