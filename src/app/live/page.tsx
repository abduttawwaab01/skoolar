'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Video, Users, Link2, Monitor, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LivePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex flex-col">
      <div className="p-4 pb-0">
        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-white/5" onClick={() => router.push('/')}>
          <ArrowLeft className="size-4 mr-1" />
          Back to Home
        </Button>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-emerald-500/20 mb-4 ring-1 ring-emerald-500/30">
            <Video className="size-8 text-emerald-400" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">Live Classes</h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Create or join a virtual classroom. Host live lessons, staff meetings, or interviews in real-time.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-white/5 border-slate-700/50 backdrop-blur-xl hover:bg-white/10 transition-all cursor-pointer group h-full"
              onClick={() => router.push('/live/create')}
            >
              <CardHeader>
                <div className="size-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Monitor className="size-6 text-emerald-400" />
                </div>
                <CardTitle className="text-white text-xl">Create a Class</CardTitle>
                <CardDescription className="text-slate-400">
                  Start a new live classroom, meeting, or interview session
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li className="flex items-center gap-2"><Video className="size-4 text-emerald-400" /> HD Video & Audio</li>
                  <li className="flex items-center gap-2"><Monitor className="size-4 text-emerald-400" /> Screen Sharing</li>
                  <li className="flex items-center gap-2"><Users className="size-4 text-emerald-400" /> Up to 50 participants</li>
                </ul>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white/5 border-slate-700/50 backdrop-blur-xl hover:bg-white/10 transition-all cursor-pointer group h-full"
              onClick={() => router.push('/live/join')}
            >
              <CardHeader>
                <div className="size-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Link2 className="size-6 text-purple-400" />
                </div>
                <CardTitle className="text-white text-xl">Join a Class</CardTitle>
                <CardDescription className="text-slate-400">
                  Enter a join code or link to participate in a live session
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li className="flex items-center gap-2"><Link2 className="size-4 text-purple-400" /> Enter 6-digit code</li>
                  <li className="flex items-center gap-2"><Users className="size-4 text-purple-400" /> Join as guest or member</li>
                  <li className="flex items-center gap-2"><Video className="size-4 text-purple-400" /> No account required</li>
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
      </div>
    </div>
  );
}
