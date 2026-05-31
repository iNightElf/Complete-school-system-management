import React, { useState, useEffect } from 'react';
import { useSchoolStore, useAuthStore } from '../../store';
import { toast } from '../../components/Toast';
import CameraModal from '../../components/CameraModal';
import PhotoUpload from '../../components/PhotoUpload';
import { RefreshCw, Mail, Download } from 'lucide-react';
import { contactLinks } from '../../lib/contacts';
import jsPDF from 'jspdf';

const API_URL = '/api';

export default function StaffSection() {
  const { staff, fetchStaff } = useSchoolStore();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'admin';

  const [showCamera, setShowCamera] = useState(false);
  const [formExpanded, setFormExpanded] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [photo, setPhoto] = useState<string | null>(null);
  const [form, setForm] = useState({ role: '', name: '', email: '', contact: '' });

  useEffect(() => { fetchStaff(); }, []);

  const filtered = staff.filter((s: any) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.role.toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => {
    setForm({ role: '', name: '', email: '', contact: '' });
    setPhoto(null);
    setEditId(null);
    setFormExpanded(false);
  };

  const handleEdit = (s: any) => {
    setForm({ role: s.role, name: s.name, email: s.email || '', contact: s.contact || '' });
    setPhoto(s.hasPhoto ? `${API_URL}/staff/${s.id}/photo` : null);
    setEditId(s.id);
    setFormExpanded(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast('Enter staff name', 'error');
    if (!form.role.trim()) return toast('Enter role/designation', 'error');

    const body = { ...form, photo: photo || undefined };

    try {
      const url = editId ? `${API_URL}/staff/${editId}` : `${API_URL}/staff`;
      await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      toast(editId ? 'Staff updated ✓' : 'Staff added ✓', 'success');
      resetForm();
      fetchStaff();
    } catch (e: any) {
      toast(e.message || 'Error', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this staff member?')) return;
    await fetch(`${API_URL}/staff/${id}`, { method: 'DELETE', credentials: 'include' });
    toast('Staff deleted');
    fetchStaff();
  };

  return (
    <div className="space-y-4">
      <CameraModal open={showCamera} onClose={() => setShowCamera(false)} onCapture={(d) => { setPhoto(d); setShowCamera(false); }} />

      {/* Form */}
      <div className="bg-white rounded-2xl border border-school-border overflow-hidden">
        <button onClick={() => setFormExpanded(!formExpanded)} className="w-full flex items-center justify-between p-4 hover:bg-school-paper/50 transition-colors">
          <span className="font-bold text-sm text-school-primary">{editId ? '✏️ Edit Staff' : '➕ Add New Staff'}</span>
          <span className="text-school-muted text-xs">{formExpanded ? '▲' : '▼'}</span>
        </button>
        {formExpanded && (
          <div className="p-4 border-t border-school-border space-y-3">
            <div className="flex justify-center">
              <PhotoUpload photo={photo} onPhotoChange={setPhoto} onOpenCamera={() => setShowCamera(true)} size="lg" />
            </div>
            <div>
              <label className="text-xs font-bold text-school-muted mb-1 block">Role / Designation</label>
              <input type="text" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. Peon, Guard" className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" />
            </div>
            <div>
              <label className="text-xs font-bold text-school-muted mb-1 block">Full Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Staff member's full name" className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-school-muted mb-1 block">Email <span className="font-normal opacity-60">(optional)</span></label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="staff@school.com" className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" />
              </div>
              <div>
                <label className="text-xs font-bold text-school-muted mb-1 block">Contact</label>
                <input type="tel" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="01XXXXXXXXX" className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSubmit} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:opacity-90">
                {editId ? '✓ Update' : '+ Add Staff'}
              </button>
              {editId && <button onClick={resetForm} className="px-4 py-2 border border-school-border rounded-xl text-sm">Cancel</button>}
            </div>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-serif text-lg text-school-primary">Staff</h3>
          <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{filtered.length}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              const photoCache: Record<string, string> = {};
              await Promise.all(filtered.filter((s: any) => s.hasPhoto).map(async (s: any) => {
                try { const r = await fetch(`${API_URL}/staff/${s.id}/photo`, { credentials: 'include' }); const blob = await r.blob(); photoCache[s.id] = await new Promise<string>(res => { const reader = new FileReader(); reader.onload = () => res(reader.result as string); reader.readAsDataURL(blob); }); } catch {}
              }));
              const doc = new jsPDF();
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(16);
              doc.text('Staff List', 105, 14, { align: 'center' });
              let y = 22;
              filtered.forEach((s: any, i) => {
                if (y > 250) { doc.addPage(); y = 20; }
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.setTextColor(45, 106, 79);
                doc.text(`${i + 1}. ${s.name}`, 15, y);
                y += 7;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(0, 0, 0);
                const lines = [
                  `Role: ${s.role}`,
                  s.email ? `Email: ${s.email}` : null,
                  `Contact: ${s.contact || ''}`,
                ].filter(Boolean);
                if (photoCache[s.id]) {
                  try { doc.addImage(photoCache[s.id], 'JPEG', 15, y, 22, 22); } catch (_e) {}
                  lines.forEach((l, li) => doc.text(l!, 42, y + 5 + li * 5));
                  y += 28;
                } else {
                  lines.forEach(l => { doc.text(l!, 15, y); y += 5; });
                }
                doc.setDrawColor(200);
                doc.setLineWidth(0.3);
                doc.setLineDash([4, 4]);
                doc.line(15, y + 2, 195, y + 2);
                doc.setLineDash([]);
                y += 8;
              });
              doc.save('Staff_List.pdf');
            }}
            className="flex items-center gap-1 px-3 py-1.5 border border-school-border rounded-lg text-xs hover:bg-school-paper"
          >
            <Download size={12} /> PDF
          </button>
          <button onClick={() => fetchStaff()} className="flex items-center gap-1 px-3 py-1.5 border border-school-border rounded-lg text-xs hover:bg-school-paper">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or role..." className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" />

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-school-muted">
          <div className="text-4xl mb-2">🏢</div>
          <p className="text-sm">No staff found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((s: any) => (
            <div key={s.id} className="bg-white p-4 rounded-2xl border border-school-border hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                {s.hasPhoto ? (
                  <img src={`${API_URL}/staff/${s.id}/photo`} alt="" className="w-12 h-12 rounded-full object-cover border border-school-border flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center text-lg flex-shrink-0">🏢</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-school-primary truncate">{s.name}</div>
                  <div className="text-xs text-indigo-600 font-medium">{s.role}</div>
                </div>
              </div>
              <div className="mt-2 space-y-1">
                {s.email && <div className="text-xs flex items-center gap-1"><Mail size={11} className="text-school-muted" /> {s.email}</div>}
                {s.contact && <div className="text-xs">{contactLinks(s.contact)}</div>}
              </div>
              {isAdmin && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-school-border">
                  <button onClick={() => handleEdit(s)} className="flex-1 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100">✏️ Edit</button>
                  <button onClick={() => handleDelete(s.id)} className="flex-1 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-medium hover:bg-red-100">🗑 Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
