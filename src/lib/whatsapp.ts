export function generateWhatsAppUrl(phone: string, message: string): string {
  const cleaned = phone.replace(/[\s\-\+\(\)]/g, '');
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${cleaned}?text=${encoded}`;
}

export function formatPhoneForWhatsApp(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[\s\-\+\(\)]/g, '');
  if (cleaned.length < 10) return null;
  if (cleaned.startsWith('0')) {
    return '234' + cleaned.slice(1);
  }
  if (cleaned.startsWith('234')) {
    return cleaned;
  }
  return cleaned;
}

export function getParentWhatsAppUrls(
  parents: { phone?: string | null; user?: { name?: string | null } | null }[],
  message: string
): { name: string; phone: string; url: string }[] {
  const results: { name: string; phone: string; url: string }[] = [];
  for (const parent of parents) {
    const formatted = formatPhoneForWhatsApp(parent.phone);
    if (formatted) {
      results.push({
        name: parent.user?.name || 'Parent',
        phone: formatted,
        url: generateWhatsAppUrl(formatted, message),
      });
    }
  }
  return results;
}
