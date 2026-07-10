'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, QrCode, Check, X, User, ScanLine, Loader2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { soundEffects } from '@/lib/ui-sounds';
import jsQR from 'jsqr';

interface ScanRecord {
  id: string;
  student: string;
  action: string;
  time: string;
  status: string;
  method: string;
}

interface AttendanceScannerProps {
  selectedClassId?: string;
}

export function AttendanceScanner({ selectedClassId }: AttendanceScannerProps) {
  const { selectedSchoolId, currentUser } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  const [scans, setScans] = React.useState<ScanRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [cameraActive, setCameraActive] = React.useState(false);
  const [cameraLoading, setCameraLoading] = React.useState(false);
  const [scanning, setScanning] = React.useState(false);
  const [lastScan, setLastScan] = React.useState<ScanRecord | null>(null);
  const [scanFeedback, setScanFeedback] = React.useState<'idle' | 'detecting' | 'success' | 'error' | 'duplicate'>('idle');

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);
  const lastScanTimeRef = React.useRef<number>(0);
  const scanningRef = React.useRef(false);
  const schoolIdRef = React.useRef(schoolId);
  const feedbackTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => { schoolIdRef.current = schoolId; }, [schoolId]);

  const showFeedback = React.useCallback((fb: 'success' | 'error' | 'duplicate', delay = 1500) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setScanFeedback(fb);
    feedbackTimerRef.current = setTimeout(() => setScanFeedback('idle'), delay);
  }, []);

  const handleQRScanRef = React.useRef(async (qrDataString: string) => {
    try {
      let qrData: Record<string, unknown> | string;
      if (qrDataString.startsWith('skoolar://')) {
        qrData = qrDataString;
      } else {
        try {
          qrData = JSON.parse(qrDataString);
        } catch {
          qrData = { id: qrDataString };
        }
      }
      const response = await fetch('/api/attendance/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrData,
          scanType: 'attendance',
          schoolId: schoolIdRef.current,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error || 'Failed to record scan');
        soundEffects.scanError();
        showFeedback('error');
        return;
      }
      if (!result.data || !result.data.person) {
        toast.error('Invalid scan response');
        soundEffects.scanError();
        showFeedback('error');
        return;
      }
      const { person } = result.data;
      const isDuplicate = result.duplicate === true;
      const isLate = result.late === true;
      const scanRecord: ScanRecord = {
        id: result.data.scanLog.id,
        student: person.name,
        action: 'Student Attendance',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: isDuplicate ? 'skipped' : isLate ? 'late' : 'success',
        method: 'qr_scan',
      };
      setLastScan(scanRecord);
      setScans(prev => [scanRecord, ...prev.slice(0, 19)]);
      if (isDuplicate) {
        soundEffects.scanDuplicate();
        showFeedback('duplicate');
        toast.info(`${person.name} - Already marked present today`);
      } else if (isLate) {
        soundEffects.scanSuccess();
        showFeedback('success');
        toast.warning(`${person.name} - Marked as late`);
      } else {
        soundEffects.scanSuccess();
        showFeedback('success');
        toast.success(`${person.name} - Attendance recorded`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error('QR scan error:', msg, error);
      soundEffects.scanError();
      showFeedback('error');
      toast.error(`Scan failed: ${msg}`);
    }
  });

  const scanLoopRef = React.useRef<(() => void) | null>(null);
  scanLoopRef.current = () => {
    if (!scanningRef.current || !videoRef.current || !canvasRef.current) {
      animationFrameRef.current = requestAnimationFrame(scanLoopRef.current!);
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (video.readyState === video.HAVE_ENOUGH_DATA && context) {
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
      });
      if (code && Date.now() - lastScanTimeRef.current > 3000) {
        lastScanTimeRef.current = Date.now();
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        setScanFeedback('detecting');
        handleQRScanRef.current(code.data);
      }
    }
    animationFrameRef.current = requestAnimationFrame(scanLoopRef.current!);
  };

  React.useEffect(() => {
    if (!schoolId) { setLoading(false); return; }
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/attendance?schoolId=${schoolId}&limit=20`);
        const json = await res.json();
        const items = (json.data || json || []).slice(0, 15);
        setScans(items.map((a: Record<string, unknown>, idx: number) => ({
          id: a.id || `scan-${idx}`,
          student: a.studentName || a.studentId || `Student ${idx + 1}`,
          action: a.method || 'Attendance',
          time: a.createdAt ? new Date(a.createdAt as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
          status: a.status || 'success',
          method: a.method || 'manual',
        })));
      } catch {
        setScans([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [schoolId]);

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('Camera not available. Please ensure you are using HTTPS.');
        return;
      }
      setCameraLoading(true);
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } }
        });
      }
      if (!stream) throw new Error('Failed to get camera stream');
      if (videoRef.current) {
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        scanningRef.current = true;
        setCameraActive(true);
        setScanning(true);
        try { await videoRef.current.play(); } catch { /* autoplay blocked */ }
        toast.success('Camera started');
        requestAnimationFrame(scanLoopRef.current!);
      }
      setCameraLoading(false);
    } catch (err) {
      setCameraLoading(false);
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes('Permission denied') || errorMsg.includes('NotAllowedError')) {
        toast.error('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (errorMsg.includes('not found') || errorMsg.includes('NotFoundError')) {
        toast.error('No camera found on this device.');
      } else {
        toast.error('Failed to start camera. Please try again.');
      }
    }
  };

  const stopCamera = () => {
    scanningRef.current = false;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setScanning(false);
    setCameraLoading(false);
  };

  React.useEffect(() => {
    return () => {
      scanningRef.current = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <QrCode className="size-5 text-emerald-600" />
            QR Attendance Scanner
          </h3>
          <p className="text-sm text-gray-500">
            Scan student ID cards to mark attendance
          </p>
        </div>
        <div className="flex gap-2">
          {!cameraActive ? (
            <Button onClick={startCamera} className="bg-emerald-600 hover:bg-emerald-700" disabled={cameraLoading}>
              {cameraLoading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Camera className="size-4 mr-2" />}
              {cameraLoading ? 'Starting Camera...' : 'Start Camera'}
            </Button>
          ) : (
            <Button variant="destructive" onClick={stopCamera}>
              <X className="size-4 mr-2" />
              Stop Camera
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live Scanner</CardTitle>
            <CardDescription>
              {cameraActive ? 'Point camera at QR code' : 'Start camera to begin scanning'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                className={`w-full h-full object-cover ${cameraActive ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'}`}
                playsInline
                autoPlay
                muted
              />
              <canvas ref={canvasRef} className="hidden" />
              {cameraActive ? (
                <>
                  <div className={`absolute inset-0 border-4 pointer-events-none transition-colors duration-300 ${
                    scanFeedback === 'detecting' ? 'border-yellow-400' :
                    scanFeedback === 'success' ? 'border-emerald-400 bg-emerald-500/10' :
                    scanFeedback === 'duplicate' ? 'border-blue-400 bg-blue-500/10' :
                    scanFeedback === 'error' ? 'border-red-500 bg-red-500/10' :
                    'border-emerald-500 animate-pulse'
                  }`} />
                  <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-[scan_2s_ease-in-out_infinite] pointer-events-none" style={{ marginTop: -40 }} />
                  {scanFeedback !== 'idle' && (
                    <div className={`absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold shadow-lg pointer-events-none z-10 whitespace-nowrap ${
                      scanFeedback === 'detecting' ? 'bg-yellow-400 text-yellow-900' :
                      scanFeedback === 'success' ? 'bg-emerald-400 text-emerald-900' :
                      scanFeedback === 'duplicate' ? 'bg-blue-400 text-blue-900' :
                      'bg-red-500 text-white'
                    }`}>
                      {scanFeedback === 'detecting' ? 'QR Detected...' :
                       scanFeedback === 'success' ? 'Scan Successful!' :
                       scanFeedback === 'duplicate' ? 'Already Marked' :
                       'Scan Failed'}
                    </div>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400 pointer-events-none">
                  <div className="text-center">
                    <Smartphone className="size-12 mx-auto mb-2 opacity-50" />
                    <p>Camera inactive</p>
                    <p className="text-xs">Click &quot;Start Camera&quot; to begin</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latest Scan</CardTitle>
            <CardDescription>Most recently scanned ID card</CardDescription>
          </CardHeader>
          <CardContent>
            {lastScan ? (
              <div className="space-y-4">
                <Alert className={
                  lastScan.status === 'late' ? 'bg-amber-50 border-amber-200' :
                  lastScan.status === 'success' ? 'bg-emerald-50 border-emerald-200' :
                  lastScan.status === 'skipped' ? 'bg-blue-50 border-blue-200' :
                  'bg-red-50 border-red-200'
                }>
                  <Check className={`h-4 w-4 ${
                    lastScan.status === 'late' ? 'text-amber-600' :
                    lastScan.status === 'success' ? 'text-emerald-600' :
                    lastScan.status === 'skipped' ? 'text-blue-600' :
                    'text-red-600'
                  }`} />
                  <AlertDescription className={
                    lastScan.status === 'late' ? 'text-amber-800' :
                    lastScan.status === 'success' ? 'text-emerald-800' :
                    lastScan.status === 'skipped' ? 'text-blue-800' :
                    'text-red-800'
                  }>
                    {lastScan.status === 'late' ? `Scanned ${lastScan.student} (Late)` :
                     lastScan.status === 'success' ? `Successfully scanned ${lastScan.student}` :
                     lastScan.status === 'skipped' ? `${lastScan.student} already marked present today` :
                     `Failed to scan ${lastScan.student}`}
                  </AlertDescription>
                </Alert>

                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    lastScan.status === 'late' ? 'bg-amber-100' :
                    lastScan.status === 'success' ? 'bg-emerald-100' :
                    lastScan.status === 'skipped' ? 'bg-blue-100' :
                    'bg-red-100'
                  }`}>
                    <User className={`size-6 ${
                      lastScan.status === 'late' ? 'text-amber-600' :
                      lastScan.status === 'success' ? 'text-emerald-600' :
                      lastScan.status === 'skipped' ? 'text-blue-600' :
                      'text-red-600'
                    }`} />
                  </div>
                  <div>
                    <p className="font-medium">{lastScan.student}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{lastScan.method.replace('_', ' ')}</Badge>
                      <Badge variant={lastScan.status === 'success' ? 'default' : 'secondary'} className={
                        lastScan.status === 'late' ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' :
                        lastScan.status === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' :
                        lastScan.status === 'skipped' ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' :
                        ''
                      }>
                        <Check className="size-3 mr-1" />
                        {lastScan.status === 'late' ? 'Late' : lastScan.status === 'skipped' ? 'Already Marked' : 'Success'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Action</p>
                    <p className="font-medium">{lastScan.action}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Time</p>
                    <p className="font-medium">{lastScan.time}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Date</p>
                    <p className="font-medium">{new Date().toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Method</p>
                    <p className="font-medium capitalize">{lastScan.method.replace('_', ' ')}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <QrCode className="size-12 mx-auto mb-2 opacity-50" />
                <p>No scans yet</p>
                <p className="text-xs">Scan an ID card to begin</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Scans</CardTitle>
          <CardDescription>Latest scan history for today</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : scans.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <ScanLine className="size-12 mx-auto mb-2 opacity-50" />
              <p>No scan activity yet</p>
              <p className="text-xs">Scanned cards will appear here</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {scans.map(scan => (
                <div key={scan.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex size-8 items-center justify-center rounded-full ${
                      scan.status === 'success' ? 'bg-emerald-100' :
                      scan.status === 'late' ? 'bg-amber-100' :
                      scan.status === 'skipped' ? 'bg-blue-100' : 'bg-red-100'
                    }`}>
                      <Check className={`size-4 ${
                        scan.status === 'success' ? 'text-emerald-600' :
                        scan.status === 'late' ? 'text-amber-600' :
                        scan.status === 'skipped' ? 'text-blue-600' : 'text-red-600'
                      }`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{scan.student}</p>
                      <p className="text-xs text-gray-500">{scan.action} - {scan.time}</p>
                    </div>
                  </div>
                  <Badge className={
                    scan.status === 'success' ? 'bg-emerald-600' :
                    scan.status === 'late' ? 'bg-amber-100 text-amber-800' :
                    scan.status === 'skipped' ? 'bg-blue-100 text-blue-800' : ''
                  }>
                    {scan.status === 'late' ? 'Late' : scan.status === 'skipped' ? 'Already Marked' : scan.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Alert className="bg-blue-50 border-blue-200">
        <ScanLine className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          Scanning student ID cards will mark them present for today&apos;s attendance.
          Duplicate scans are detected and will show a warning sound.
        </AlertDescription>
      </Alert>
    </div>
  );
}
