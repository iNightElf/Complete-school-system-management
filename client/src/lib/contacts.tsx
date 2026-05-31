
import { Phone, MessageSquare } from 'lucide-react';

export function formatBDPhone(raw: string): string {
  if (!raw) return '';
  let n = raw.replace(/[\s().+-]/g, '');
  if (n.startsWith('880')) n = n.slice(3);
  if (n.startsWith('0')) n = n.slice(1);
  return n.length === 10 && n.startsWith('1') ? '+880' + n : raw;
}

export function contactLinks(raw: string) {
  if (!raw) return <span className="text-school-muted">—</span>;
  const e164 = formatBDPhone(raw);
  if (!(e164.startsWith('+880') && e164.length === 14)) return <span>{raw}</span>;
  const wa = e164.slice(1);
  return (
    <span className="flex gap-2 flex-wrap items-center justify-center">
      <a href={`tel:${e164}`} className="text-blue-600 hover:underline text-xs inline-flex items-center gap-1"><Phone size={14} /> {e164}</a>
      <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="text-green-600 hover:underline text-xs inline-flex items-center gap-1"><MessageSquare size={14} /> WhatsApp</a>
    </span>
  );
}
