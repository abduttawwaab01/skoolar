'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const LiveClassRoom = dynamic(
  () => import('@/components/live-class/room/live-class-room'),
  { ssr: false, loading: () => (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <Loader2 className="size-8 animate-spin text-emerald-400" />
    </div>
  )}
);

export default function LiveClassRoomPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();

  const name = searchParams.get('name') || session?.user?.name || 'Guest';
  const guestId = searchParams.get('guestId') || '';
  const micParam = searchParams.get('mic') === 'true';
  const camParam = searchParams.get('cam') === 'true';

  const [liveClass, setLiveClass] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ltToken, setLtToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const classRes = await fetch(`/api/live-classes/${params.id}`);
        const classJson = await classRes.json();
        if (!classJson.data) throw new Error('Class not found');
        setLiveClass(classJson.data);

        const tokenRes = await fetch(`/api/live-classes/${params.id}/livekit-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, guestId }),
        });

        if (!tokenRes.ok) {
          const err = await tokenRes.json();
          throw new Error(err.error || 'Failed to get token');
        }

        const tokenJson = await tokenRes.json();
        setLtToken(tokenJson.data.token);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [params.id, name, guestId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (error || !ltToken || !liveClass) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <p className="text-red-400">{error || 'Failed to load class'}</p>
          <button
            onClick={() => router.push('/live')}
            className="text-emerald-400 hover:underline text-sm"
          >
            Back to live classes
          </button>
        </div>
      </div>
    );
  }

  const isHost = liveClass.hostId === session?.user?.id;

  return (
    <LiveClassRoom
      room={params.id}
      token={ltToken}
      liveClass={liveClass}
      identity={session?.user?.id || guestId || name}
      displayName={name}
      isHost={isHost}
      guestId={guestId}
      micEnabled={micParam}
      camEnabled={camParam}
      onEnd={() => router.push('/live')}
    />
  );
}
