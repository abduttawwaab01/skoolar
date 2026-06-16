'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, MessageCircle, Send, ExternalLink, Mail, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface SendToParentProps {
  endpoint: string;
  label?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  onSuccess?: () => void;
  studentName?: string;
  assessmentName?: string;
}

interface ParentWhatsAppContact {
  name: string;
  phone: string;
  url: string;
}

export function SendToParent({
  endpoint,
  label = 'Send to Parent',
  variant = 'outline',
  size = 'sm',
  className,
  onSuccess,
  studentName,
  assessmentName,
}: SendToParentProps) {
  const [sending, setSending] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [result, setResult] = useState<{
    emailSent: number;
    emailFailed: number;
    whatsapp: ParentWhatsAppContact[];
  } | null>(null);

  const handleSend = async () => {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send');

      setResult({
        emailSent: json.sent || json.email?.sent || 0,
        emailFailed: json.failed || json.email?.failed || 0,
        whatsapp: json.whatsappUrls || json.whatsapp || [],
      });
      setShowDialog(true);
      toast.success(json.message || 'Sent to parent(s) successfully');
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleSend}
        disabled={sending}
        className={className}
      >
        {sending ? (
          <Loader2 className="size-3.5 mr-1.5 animate-spin" />
        ) : (
          <Send className="size-3.5 mr-1.5" />
        )}
        {sending ? 'Sending...' : label}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-5 text-emerald-600" />
              Report Shared with Parent
              {studentName && <span className="text-muted-foreground font-normal">— {studentName}</span>}
            </DialogTitle>
            <DialogDescription>
              {assessmentName && `${assessmentName} · `}
              {result && (
                <span>
                  {result.emailSent > 0 && `Email sent to ${result.emailSent} parent(s). `}
                  {result.emailFailed > 0 && `${result.emailFailed} failed. `}
                  {result.whatsapp.length > 0 && `${result.whatsapp.length} WhatsApp link(s) ready.`}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {result?.whatsapp && result.whatsapp.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <MessageCircle className="size-3.5 text-emerald-600" />
                  WhatsApp — Click to open and send manually
                </p>
                <div className="space-y-2">
                  {result.whatsapp.map((item, i) => (
                    <a
                      key={i}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <MessageCircle className="size-4 text-emerald-600 shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.phone}</p>
                        </div>
                      </div>
                      <ExternalLink className="size-3.5 text-muted-foreground shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {result?.emailSent === 0 && result?.emailFailed === 0 && (!result?.whatsapp || result.whatsapp.length === 0) && (
              <div className="flex flex-col items-center py-6 text-muted-foreground">
                <XCircle className="size-8 mb-2 opacity-50" />
                <p className="text-sm">No parent contacts found</p>
                <p className="text-xs mt-1">Ensure the student has parents with phone/email linked.</p>
              </div>
            )}

            {result && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
                <div className="flex items-center gap-1.5">
                  <Mail className="size-3.5" />
                  <span>Email: <strong className={result.emailSent > 0 ? 'text-emerald-600' : 'text-muted-foreground'}>{result.emailSent} sent</strong>
                    {result.emailFailed > 0 && <span className="text-red-600">, {result.emailFailed} failed</span>}
                  </span>
                </div>
                {result.whatsapp?.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <MessageCircle className="size-3.5" />
                    <span>WhatsApp: <strong className="text-emerald-600">{result.whatsapp.length} link(s)</strong></span>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
