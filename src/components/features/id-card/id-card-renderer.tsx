'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, XCircle } from 'lucide-react';

interface IDCardRendererProps {
  cardId?: string;
  schoolId?: string;
  studentId?: string;
  teacherId?: string;
  designId?: string;
  side?: 'front' | 'back';
  orientation?: 'landscape' | 'portrait';
  className?: string;
}

export function IDCardRenderer({
  cardId,
  schoolId,
  studentId,
  teacherId,
  designId,
  side = 'front',
  orientation = 'landscape',
  className = '',
}: IDCardRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isLand = orientation === 'landscape';
  const cw = isLand ? '85.6mm' : '53.98mm';
  const ch = isLand ? '53.98mm' : '85.6mm';

  useEffect(() => {
    loadCard();
  }, [cardId, studentId, teacherId, designId, side]);

  async function loadCard() {
    setLoading(true);
    setError(null);
    try {
      let personId = studentId || teacherId || '';
      let personType: 'student' | 'teacher' | '' = studentId ? 'student' : teacherId ? 'teacher' : '';

      if (cardId && !personId) {
        const cardRes = await fetch(`/api/id-cards/${cardId}`);
        if (cardRes.ok) {
          const cardData = await cardRes.json();
          personId = cardData.personId || '';
          personType = cardData.personType || '';
        }
      }

      const params: Record<string, string> = { side };
      if (schoolId) params.schoolId = schoolId;
      if (personId && personType === 'student') params.studentId = personId;
      if (personId && personType === 'teacher') params.teacherId = personId;
      if (designId) params.designId = designId;

      const res = await fetch('/api/id-cards/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error('Failed to load card');
      const html = await res.text();
      if (iframeRef.current) {
        iframeRef.current.srcdoc = html;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load card');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`relative ${className} w-full max-w-[500px] mx-auto`} style={{ width: cw, height: ch }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 rounded-xl border border-gray-200">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-8 animate-spin text-indigo-600" />
            <p className="text-sm font-medium text-gray-700">Loading ID card...</p>
          </div>
        </div>
      )}
      {error ? (
        <div className="flex items-center justify-center bg-red-50 rounded-xl text-xs text-red-700 h-full p-6 border border-red-200">
          <div className="text-center">
            <div className="size-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
              <XCircle className="size-6 text-red-600" />
            </div>
            <p className="text-sm font-medium mb-2">Failed to Load ID Card</p>
            <p className="text-xs text-red-600">{error}</p>
          </div>
        </div>
      ) : (
        <div className="relative w-full h-full">
          <iframe
            ref={iframeRef}
            className="w-full h-full border-0 rounded-xl shadow-lg"
            style={{ width: cw, height: ch }}
            title="ID Card"
          />
        </div>
      )}
    </div>
  );
}
