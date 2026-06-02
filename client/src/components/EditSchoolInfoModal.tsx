import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { toast } from './Toast';
import { useSchoolStore } from '../store';
import type { SchoolSettings } from '../lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

const FIELDS: { key: keyof SchoolSettings; label: string; placeholder: string }[] = [
  { key: 'school_name', label: 'School Name', placeholder: 'AL RAWA English School' },
  { key: 'address', label: 'Address', placeholder: 'School address' },
  { key: 'phone', label: 'Phone', placeholder: '+880 XXXX-XXXXXX' },
  { key: 'email', label: 'Email', placeholder: 'school@example.com' },
  { key: 'website', label: 'Website', placeholder: 'https://' },
];

export default function EditSchoolInfoModal({ open, onClose }: Props) {
  const { settings, updateSettings } = useSchoolStore();
  const [form, setForm] = useState<SchoolSettings>({ ...settings });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ ...settings });
  }, [open, settings]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings(form);
      toast('School info saved ✓', 'success');
      onClose();
    } catch {
      toast('Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-school-border">
          <h3 className="font-bold text-sm text-school-primary">School Information</h3>
          <button onClick={onClose} className="p-1 hover:bg-school-paper rounded-lg"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3">
          {FIELDS.map(f => (
            <div key={f.key}>
              <label className="text-[11px] font-bold text-school-muted block mb-1">{f.label}</label>
              <input
                type="text"
                value={form[f.key]}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 p-4 border-t border-school-border">
          <button onClick={onClose} className="flex-1 py-2 border border-school-border rounded-xl text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-school-primary text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
