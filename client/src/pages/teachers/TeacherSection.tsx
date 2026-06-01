import { useState, useEffect } from 'react';
import { useSchoolStore, useAuthStore } from '../../store';
import { toast } from '../../components/Toast';
import CameraModal from '../../components/CameraModal';
import ImportModal from '../../components/ImportModal';
import { CardSkeleton } from '../../components/Skeleton';
import { RefreshCw, Mail, Download, Upload, Camera, Pencil, Trash2, Check, GraduationCap } from 'lucide-react';
import { contactLinks } from '../../lib/contacts';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';
import jsPDF from 'jspdf';
import { API_URL } from '../../lib/config';

export default function TeacherSection() {
  const { teachers, fetchTeachers, loading } = useSchoolStore();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'admin';

  const [showCamera, setShowCamera] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddNew, setShowAddNew] = useState(false);
  const [search, setSearch] = useState('');
  const [activeDesig, setActiveDesig] = useState<string | null>(null);

  const [photo, setPhoto] = useState<string | null>(null);
  const [form, setForm] = useState({ designation: '', name: '', email: '', contact: '' });

  useEffect(() => { document.title = 'Teachers - AL RAWA English School'; }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchTeachers(); }, []);

  const designations = [...new Set(teachers.map((t: any) => t.designation))];
  const filtered = teachers.filter((t: any) => {
    if (activeDesig && t.designation !== activeDesig) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.designation.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const resetForm = () => {
    setForm({ designation: '', name: '', email: '', contact: '' });
    setPhoto(null);
    setEditingId(null);
    setShowAddNew(false);
  };

  const handleEdit = (t: any) => {
    setForm({ designation: t.designation, name: t.name, email: t.email || '', contact: t.contact || '' });
    setPhoto(t.hasPhoto ? `${API_URL}/teachers/${t.id}/photo` : null);
    setEditingId(t.id);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast('Enter teacher name', 'error');
    if (!form.designation.trim()) return toast('Enter designation', 'error');

    const body = { ...form, photo: photo || undefined };

    try {
      const url = editingId ? `${API_URL}/teachers/${editingId}` : `${API_URL}/teachers`;
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Save failed'); }
      toast(editingId ? 'Teacher updated ✓' : 'Teacher added ✓', 'success');
      resetForm();
      fetchTeachers();
    } catch (e: any) {
      toast(e.message || 'Error', 'error');
    }
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const confirmDelete = async () => {
    if (!deleteId) return;
    const idToRestore = deleteId;
    setDeleteLoading(true);
    try {
      const res = await fetch(`${API_URL}/teachers/${deleteId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Delete failed'); }
      toast('Teacher deleted', '', { label: 'Undo', onClick: async () => {
        try {
          await fetch(`${API_URL}/teachers/${idToRestore}/restore`, { method: 'POST', credentials: 'include' });
          toast('Teacher restored ✓', 'success');
          fetchTeachers();
        } catch { toast('Could not undo', 'error'); }
      }});
    } catch (e: any) { toast(e.message || 'Error', 'error'); }
    setDeleteId(null);
    setDeleteLoading(false);
    fetchTeachers();
  };

  const inputCls = 'w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent';

  const renderEditCard = (isNew: boolean) => (
    <div className={`p-4 rounded-2xl border-2 transition-all ${isNew ? 'border-violet-400 bg-violet-50/50' : 'border-blue-400 bg-blue-50/50'}`} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}>
      <div className="flex justify-center mb-3">
        <button onClick={() => setShowCamera(true)} className="relative group" aria-label="Take photo">
          {photo ? (
            <img src={photo} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-md" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-emerald-600 text-white flex items-center justify-center"><GraduationCap size={32} className="text-white" /></div>
          )}
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera size={20} className="text-white" />
          </div>
        </button>
      </div>
      <div>
        <label className="text-xs font-bold text-school-muted mb-1 block">Designation</label>
        <input type="text" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="e.g. Head Teacher" className={inputCls} />
      </div>
      <div className="mt-3">
        <label className="text-xs font-bold text-school-muted mb-1 block">Full Name</label>
        <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Teacher's full name" className={inputCls} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <div>
          <label className="text-xs font-bold text-school-muted mb-1 block">Email</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="teacher@school.com" className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-bold text-school-muted mb-1 block">Contact</label>
          <input type="tel" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="01XXXXXXXXX" className={inputCls} />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={handleSubmit} className={`flex-1 py-2 text-white rounded-xl text-sm font-bold hover:opacity-90 flex items-center justify-center gap-1.5 ${isNew ? 'bg-violet-600' : 'bg-blue-600'}`}>
          {isNew ? '+ Add Teacher' : <><Check size={14} /> Save</>}
        </button>
        <button onClick={resetForm} className="px-4 py-2 border border-school-border rounded-xl text-sm hover:bg-white">Cancel</button>
      </div>
    </div>
  );

  const renderViewCard = (t: any) => (
    <div className="bg-white p-4 rounded-2xl border border-school-border card-shadow text-center">
      <div className="flex flex-col items-center gap-2">
        {t.hasPhoto ? (
          <img src={`${API_URL}/teachers/${t.id}/photo`} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-school-border shadow-sm" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center shadow-sm"><GraduationCap size={24} className="text-white" /></div>
        )}
        <div>
          <div className="font-bold text-sm text-school-primary">{t.name}</div>
          <div className="text-xs text-emerald-600 font-medium">{t.designation}</div>
        </div>
      </div>
      <div className="mt-2 space-y-0.5">
        {t.email && <div className="text-xs flex items-center justify-center gap-1"><Mail size={11} className="text-school-muted" /> {t.email}</div>}
        {t.contact && <div className="text-xs">{contactLinks(t.contact)}</div>}
      </div>
      {isAdmin && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-school-border">
          <button onClick={() => handleEdit(t)} className="flex-1 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 flex items-center justify-center gap-1"><Pencil size={14} /> Edit</button>
          <button onClick={() => setDeleteId(t.id)} className="flex-1 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-medium hover:bg-red-100 flex items-center justify-center gap-1"><Trash2 size={14} /> Delete</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <CameraModal open={showCamera} onClose={() => setShowCamera(false)} onCapture={(d) => { setPhoto(d); setShowCamera(false); }} />
      <ImportModal open={showImport} onClose={() => setShowImport(false)} onImported={() => fetchTeachers()} entity="teacher" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-serif text-lg text-school-primary">Teachers</h3>
          <span className="bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{filtered.length}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              const photoCache: Record<string, string> = {};
              await Promise.all(filtered.filter((t: any) => t.hasPhoto).map(async (t: any) => {
                try { const r = await fetch(`${API_URL}/teachers/${t.id}/photo`, { credentials: 'include' }); const blob = await r.blob(); photoCache[t.id] = await new Promise<string>(res => { const reader = new FileReader(); reader.onload = () => res(reader.result as string); reader.readAsDataURL(blob); }); } catch {}
              }));
              const doc = new jsPDF();
              doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
              doc.text('Teacher List', 105, 14, { align: 'center' });
              let y = 22;
              filtered.forEach((t: any, i) => {
                if (y > 250) { doc.addPage(); y = 20; }
                doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(107, 63, 160);
                doc.text(`${i + 1}. ${t.name}`, 15, y); y += 7;
                doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
                const lines = [`Designation: ${t.designation}`, t.email ? `Email: ${t.email}` : null, `Contact: ${t.contact || ''}`].filter(Boolean);
                if (photoCache[t.id]) {
                  try { doc.addImage(photoCache[t.id], 'JPEG', 15, y, 22, 22); } catch {}
                  lines.forEach((l, li) => doc.text(l!, 42, y + 5 + li * 5)); y += 28;
                } else { lines.forEach(l => { doc.text(l!, 15, y); y += 5; }); }
                doc.setDrawColor(200); doc.setLineWidth(0.3); doc.setLineDashPattern([4, 4], 0);
                doc.line(15, y + 2, 195, y + 2); doc.setLineDashPattern([], 0); y += 8;
              });
              doc.save('Teacher_List.pdf');
            }}
            className="flex items-center gap-1 px-3 py-1.5 border border-school-border rounded-lg text-xs hover:bg-school-paper"
          >
            <Download size={12} /> PDF
          </button>
          {isAdmin && <button onClick={() => setShowImport(true)} className="flex items-center gap-1 px-3 py-1.5 border border-school-border rounded-lg text-xs hover:bg-school-paper">
            <Upload size={12} /> Import
          </button>}
          <button onClick={() => fetchTeachers()} className="flex items-center gap-1 px-3 py-1.5 border border-school-border rounded-lg text-xs hover:bg-school-paper">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Designation Picker */}
      {!activeDesig && designations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setActiveDesig(null)} className="px-3 py-1.5 bg-school-primary text-white rounded-full text-xs font-medium">All</button>
          {designations.map((d) => (
            <button key={d} onClick={() => setActiveDesig(d)} className="px-3 py-1.5 border border-school-border rounded-full text-xs font-medium hover:bg-school-paper">{d}</button>
          ))}
        </div>
      )}
      {activeDesig && (
        <div className="flex items-center gap-2">
          <button onClick={() => setActiveDesig(null)} className="text-sm text-school-accent hover:underline">← All</button>
          <span className="text-sm font-medium">{activeDesig}</span>
        </div>
      )}

      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or designation..." className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {isAdmin && (showAddNew ? renderEditCard(true) : (
          <button onClick={() => setShowAddNew(true)} className="border-2 border-dashed border-violet-300 bg-violet-50/30 p-4 rounded-2xl flex flex-col items-center justify-center min-h-[160px] hover:border-violet-400 hover:bg-violet-50/60 transition-all">
            <div className="text-3xl text-violet-400 mb-2">+</div>
            <div className="text-sm font-bold text-violet-600">Add New Teacher</div>
          </button>
        ))}
        {loading.teachers && filtered.length === 0 && Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        {!loading.teachers && filtered.map((t: any) => editingId === t.id ? <div key={t.id}>{renderEditCard(false)}</div> : <div key={t.id}>{renderViewCard(t)}</div>)}
      </div>

      {filtered.length === 0 && !showAddNew && (
        <div className="text-center py-12 text-school-muted">
          <div className="text-4xl mb-2"><GraduationCap size={48} className="text-school-muted mx-auto mb-2" /></div>
          <p className="text-sm">No teachers found.</p>
        </div>
      )}
      <DeleteConfirmModal open={!!deleteId} title="Delete Teacher" message="This will permanently delete this teacher." onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} loading={deleteLoading} />
    </div>
  );
}
