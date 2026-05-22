'use client';

import * as React from 'react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import jsQR from 'jsqr';
import {
  QrCode, Camera, X, Check, Clock, Shield, Loader2, ScanLine, CheckCircle2,
  Calendar, User, MapPin
} from 'lucide-react';

interface StaffAttendanceStatus {
  checkedIn: boolean;
  checkInTime: string | null;
  date: string;
  qrCodeUrl: string;
  schoolId: string;
}

export function StaffSelfAttendance() {
  const { currentUser, selectedSchoolId } = useAppStore();
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<StaffAttendanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<{ success: boolean; message: string } | null>(null);
  const [scanFeedback, setScanFeedback] = useState<'idle' | 'detecting' | 'success' | 'error'>('idle');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFeedback = useCallback((fb: 'success' | 'error', delay = 1500) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setScanFeedback(fb);
    feedbackTimerRef.current = setTimeout(() => setScanFeedback('idle'), delay);
  }, []);

  useEffect(() => { setMounted(true); }, []);

  // Fetch attendance status on mount
  useEffect(() => {
    fetchAttendanceStatus();
    return () => {
      scanningRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const fetchAttendanceStatus = async () => {
    try {
      const res = await fetch('/api/attendance/staff-checkin');
      const json = await res.json();
      if (json.success) {
        setStatus(json.data);
      }
    } catch {
      toast.error('Failed to load attendance status');
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('Camera not available. Please ensure you are using HTTPS.');
        return;
      }

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
      } catch (err) {
        console.log('Rear camera not available, trying default camera...');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } }
        });
      }

      if (videoRef.current && stream) {
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        scanningRef.current = true;
        setScanning(true);
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.log('Could not autoplay video:', playErr);
        }
        animationFrameRef.current = requestAnimationFrame(scanLoop);
      }
    } catch (err) {
      console.error(err);
      toast.error('Camera access denied. Please enable camera permissions.');
    }
  };

  const stopCamera = () => {
    scanningRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setScanning(false);
    setScanFeedback('idle');
  };

  const scanLoop = () => {
    if (!scanningRef.current) {
      return;
    }
    if (!videoRef.current || !canvasRef.current) {
      animationFrameRef.current = requestAnimationFrame(scanLoop);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code && Date.now() - lastScanTimeRef.current > 3000) {
        lastScanTimeRef.current = Date.now();
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        setScanFeedback('detecting');
        handleScan(code.data);
      }
    }

    if (scanningRef.current) {
      animationFrameRef.current = requestAnimationFrame(scanLoop);
    }
  };

  const handleScan = async (qrData: string) => {
    scanningRef.current = false;
    stopCamera();
    
    try {
      const res = await fetch('/api/attendance/staff-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrData }),
      });
      
      const json = await res.json();
      
      if (json.success) {
        setLastScanResult({ success: true, message: json.message });
        showFeedback('success');
        toast.success(json.message);
        fetchAttendanceStatus();
      } else {
        setLastScanResult({ success: false, message: json.error });
        showFeedback('error');
        toast.error(json.error);
      }
    } catch {
      setLastScanResult({ success: false, message: 'Failed to mark attendance' });
      showFeedback('error');
      toast.error('Failed to mark attendance');
    }

    setTimeout(() => setLastScanResult(null), 3000);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-md mx-auto">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
          <Shield className="size-6 text-emerald-600" />
          Staff Attendance
        </h2>
        <p className="text-muted-foreground">Scan the school QR code to mark your attendance</p>
      </div>

      {/* Current Status Card */}
      <Card className={status?.checkedIn ? 'border-emerald-500' : 'border-amber-500'}>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            {status?.checkedIn ? (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="size-10 text-emerald-600" />
                </div>
                <div>
                  <Badge className="bg-emerald-100 text-emerald-700 text-lg px-4 py-1">
                    Checked In
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-2">
                    You marked your attendance at <span className="font-medium">{status.checkInTime}</span>
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 flex items-center justify-center">
                  <Clock className="size-10 text-amber-600" />
                </div>
                <div>
                  <Badge variant="outline" className="text-lg px-4 py-1 border-amber-500 text-amber-700">
                    Not Checked In
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-2">
                    Scan the QR code below to mark attendance
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* QR Scanner */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ScanLine className="size-5" />
            Scan Attendance QR
          </CardTitle>
          <CardDescription>Point your camera at the school's attendance QR code</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!scanning ? (
            <Button onClick={startCamera} className="w-full" size="lg">
              <Camera className="size-5 mr-2" />
              Start Scanner
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="relative aspect-square max-h-80 mx-auto rounded-lg overflow-hidden bg-gray-900">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
                <canvas ref={canvasRef} className="hidden" />
                <div className={`absolute inset-0 border-4 pointer-events-none transition-colors duration-300 ${
                  scanFeedback === 'detecting' ? 'border-yellow-400' :
                  scanFeedback === 'success' ? 'border-emerald-400 bg-emerald-500/10' :
                  scanFeedback === 'error' ? 'border-red-500 bg-red-500/10' :
                  'border-emerald-500 animate-pulse'
                }`} />
                {scanFeedback !== 'idle' && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold shadow-lg pointer-events-none z-10 whitespace-nowrap
                    bg-yellow-400 text-yellow-900">
                    {scanFeedback === 'detecting' ? 'QR Detected...' :
                     scanFeedback === 'success' ? '✓ Scan Successful!' :
                     '✗ Scan Failed'}
                  </div>
                )}
              </div>
              <Button variant="destructive" onClick={stopCamera} className="w-full">
                <X className="size-4 mr-2" />
                Cancel
              </Button>
            </div>
          )}

          {/* Scan Result */}
          {lastScanResult && (
            <Alert className={lastScanResult.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}>
              {lastScanResult.success ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <X className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className={lastScanResult.success ? 'text-emerald-800' : 'text-red-800'}>
                {lastScanResult.message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card>
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="size-4" />
              <span>Date: {status?.date || (mounted ? new Date().toLocaleDateString() : '')}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="size-4" />
              <span>Staff: {currentUser.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="size-4" />
              <span>School ID: {status?.schoolId || selectedSchoolId}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}