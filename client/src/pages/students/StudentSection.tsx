import React, { useState, useEffect } from 'react';
import { useSchoolStore, useAuthStore } from '../../store';
import { toast } from '../../components/Toast';
import ClassManagerModal from '../../components/ClassManagerModal';
import CameraModal from '../../components/CameraModal';
import { CardSkeleton } from '../../components/Skeleton';
import { Settings, RefreshCw, Download, Camera } from 'lucide-react';
import { contactLinks } from '../../lib/contacts';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';
import jsPDF from 'jspdf';

const API_URL = '/api';

export default function StudentSection() {
  const { classes, students, fetchClasses, fetchStudents, loading } = useSchoolStore();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'admin';

  const [activeClass, setActiveClass] = useState<string | null>(null);
  const [showClassManager, setShowClassManager] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddNew, setShowAddNew] = useState(false);

  const [photo, setPhoto] = useState<string | null>(null);
  const [form, setForm] = useState({ className: '', roll: '', name: '', fatherName: '', motherName: '', contact: '' });

  useEffect(() => { fetchClasses(); fetchStudents(); }, []);

  const sorted = [...classes].sort((a, b) => a.order - b.order);
  const classStudents = students.filter((s) => activeClass && s.class === activeClass);
  const filtered = classStudents.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.roll?.includes(search)
  );

  const resetForm = () => {
    setForm({ className: '', roll: '', name: '', fatherName: '', motherName: '', contact: '' });
    setPhoto(null);
    setEditingId(null);
    setShowAddNew(false);
  };

  const handleEdit = (s: any) => {
    setForm({
      className: s.class,
      roll: s.roll || '',
      name: s.name,
      fatherName: s.fatherName || '',
      motherName: s.motherName || '',
      contact: s.contact || '',
    });
    setPhoto(s.hasPhoto ? `${API_URL}/students/${s.id}/photo` : null);
    setEditingId(s.id);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast('Enter student name', 'error');
    if (!form.className) return toast('Select a class', 'error');

    const body = {
      class: form.className,
      roll: form.roll || undefined,
      name: form.name.trim(),
      fatherName: form.fatherName || undefined,
      motherName: form.motherName || undefined,
      contact: form.contact || undefined,
      photo: photo || undefined,
    };

    try {
      if (editingId) {
        await fetch(`${API_URL}/students/${editingId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify(body),
        });
        toast('Student updated ✓', 'success');
      } else {
        await fetch(`${API_URL}/students`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify(body),
        });
        toast('Student added ✓', 'success');
      }
      resetForm();
      fetchStudents();
    } catch (e: any) {
      toast(e.message || 'Error', 'error');
    }
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    await fetch(`${API_URL}/students/${deleteId}`, { method: 'DELETE', credentials: 'include' });
    toast('Student deleted');
    setDeleteId(null);
    setDeleteLoading(false);
    fetchStudents();
  };

  const renderEditCard = (isNew: boolean) => {
    const inputCls = 'w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent';
    return (
      <div className={`p-4 rounded-2xl border-2 transition-all ${isNew ? 'border-violet-400 bg-violet-50/50' : 'border-blue-400 bg-blue-50/50'}`}>
        <div className="flex justify-center mb-3">
          <button onClick={() => setShowCamera(true)} className="relative group">
            {photo ? (
              <img src={photo.startsWith('data:') ? photo : photo} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-md" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-school-primary text-white flex items-center justify-center text-3xl">👤</div>
            )}
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera size={20} className="text-white" />
            </div>
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-school-muted mb-1 block">Class</label>
            <select value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} className={inputCls}>
              <option value="">Select class</option>
              {sorted.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-school-muted mb-1 block">Roll No <span className="font-normal opacity-60">(optional)</span></label>
            <input type="text" value={form.roll} onChange={(e) => setForm({ ...form, roll: e.target.value })} placeholder="e.g. 01" className={inputCls} />
          </div>
        </div>
        <div className="mt-3">
          <label className="text-xs font-bold text-school-muted mb-1 block">Full Name</label>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Student's full name" className={inputCls} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div>
            <label className="text-xs font-bold text-school-muted mb-1 block">Father's Name</label>
            <input type="text" value={form.fatherName} onChange={(e) => setForm({ ...form, fatherName: e.target.value })} placeholder="Father's full name" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-bold text-school-muted mb-1 block">Mother's Name</label>
            <input type="text" value={form.motherName} onChange={(e) => setForm({ ...form, motherName: e.target.value })} placeholder="Mother's full name" className={inputCls} />
          </div>
        </div>
        <div className="mt-3">
          <label className="text-xs font-bold text-school-muted mb-1 block">Contact Number</label>
          <input type="tel" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="01XXXXXXXXX" className={inputCls} />
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={handleSubmit} className={`flex-1 py-2 text-white rounded-xl text-sm font-bold hover:opacity-90 ${isNew ? 'bg-violet-600' : 'bg-blue-600'}`}>
            {isNew ? '+ Add Student' : '✓ Save'}
          </button>
          <button onClick={resetForm} className="px-4 py-2 border border-school-border rounded-xl text-sm hover:bg-white">Cancel</button>
        </div>
      </div>
    );
  };

  const renderViewCard = (s: any) => (
    <div className="bg-white p-4 rounded-2xl border border-school-border hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        {s.hasPhoto ? (
          <img src={`${API_URL}/students/${s.id}/photo`} alt="" className="w-12 h-12 rounded-full object-cover border border-school-border flex-shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-school-primary text-white flex items-center justify-center text-lg flex-shrink-0">👤</div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm text-school-primary truncate">{s.name}</div>
          <div className="text-xs text-school-muted">{s.roll ? `Roll: ${s.roll}` : activeClass}</div>
        </div>
      </div>
      <div className="mt-2 space-y-1">
        {s.fatherName && <div className="text-xs text-school-muted">Father: {s.fatherName}</div>}
        {s.motherName && <div className="text-xs text-school-muted">Mother: {s.motherName}</div>}
        {s.contact && <div className="text-xs text-school-muted">Contact: <span className="text-school-primary">{contactLinks(s.contact)}</span></div>}
      </div>
      {isAdmin && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-school-border">
          <button onClick={() => handleEdit(s)} className="flex-1 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100">✏️ Edit</button>
          <button onClick={() => setDeleteId(s.id)} className="flex-1 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-medium hover:bg-red-100">🗑 Delete</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <ClassManagerModal open={showClassManager} onClose={() => setShowClassManager(false)} />
      <CameraModal open={showCamera} onClose={() => setShowCamera(false)} onCapture={(d) => { setPhoto(d); setShowCamera(false); }} />

      {/* Panel Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-serif text-lg text-school-primary">Students</h3>
          <span className="bg-school-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">{filtered.length}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              const list = filtered.length > 0 ? filtered : classStudents;
              const photoCache: Record<string, string> = {};
              await Promise.all(list.filter((s: any) => s.hasPhoto).map(async (s: any) => {
                try { const r = await fetch(`${API_URL}/students/${s.id}/photo`, { credentials: 'include' }); const blob = await r.blob(); photoCache[s.id] = await new Promise<string>(res => { const reader = new FileReader(); reader.onload = () => res(reader.result as string); reader.readAsDataURL(blob); }); } catch {}
              }));
              const doc = new jsPDF();
              const title = activeClass ? activeClass + ' — Students' : 'All Students';
              doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
              doc.text(title, 105, 14, { align: 'center' });
              let y = 22;
              list.forEach((s, i) => {
                if (y > 250) { doc.addPage(); y = 20; }
                doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(200, 75, 49);
                doc.text(`${i + 1}. ${s.name}`, 15, y); y += 7;
                doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
                const lines = [`Class: ${s.class}${s.roll ? '   Roll No: ' + s.roll : ''}`, `Father: ${s.fatherName || ''}`, `Mother: ${s.motherName || ''}`, `Contact: ${s.contact || ''}`];
                if (photoCache[s.id]) {
                  try { doc.addImage(photoCache[s.id], 'JPEG', 15, y, 22, 22); } catch (_e) {}
                  lines.forEach((l, li) => doc.text(l, 42, y + 5 + li * 5)); y += 28;
                } else { lines.forEach(l => { doc.text(l, 15, y); y += 5; }); }
                doc.setDrawColor(200); doc.setLineWidth(0.3); doc.setLineDash([4, 4]);
                doc.line(15, y + 2, 195, y + 2); doc.setLineDash([]); y += 8;
              });
              doc.save((activeClass || 'All_Students') + '_List.pdf');
            }}
            className="flex items-center gap-1 px-3 py-1.5 border border-school-border rounded-lg text-xs hover:bg-school-paper"
          >
            <Download size={12} /> PDF
          </button>
          <button onClick={() => fetchStudents()} className="flex items-center gap-1 px-3 py-1.5 border border-school-border rounded-lg text-xs hover:bg-school-paper">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Class Picker or Student List */}
      {!activeClass ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-school-muted">Select a class to view students:</p>
            {isAdmin && (
              <button onClick={() => setShowClassManager(true)} className="flex items-center gap-1 text-xs text-school-muted hover:text-school-primary">
                <Settings size={12} /> Manage Classes
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {sorted.map((cls) => (
              <button key={cls.id} onClick={() => { setActiveClass(cls.name); setForm({ ...form, className: cls.name }); }}
                className="bg-white p-4 rounded-2xl border border-school-border text-center hover:border-school-accent hover:shadow-md transition-all">
                <div className="text-2xl mb-1">{cls.name === 'Play' ? '🧸' : cls.name === 'Nursery' ? '🌱' : cls.name === 'KG' ? '🎨' : '📖'}</div>
                <div className="font-bold text-sm text-school-primary">{cls.name}</div>
                <div className="text-[11px] text-school-muted mt-1">{cls.studentCount} student{cls.studentCount !== 1 ? 's' : ''}</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => { setActiveClass(null); resetForm(); }} className="text-sm text-school-accent hover:underline">← All Classes</button>
            <span className="font-serif text-sm text-school-primary">{activeClass}</span>
          </div>

          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or roll..."
            className="w-full px-3 py-2 border border-school-border rounded-xl text-sm mb-3 focus:outline-none focus:border-school-accent" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Add New Card */}
            {isAdmin && (showAddNew ? (
              renderEditCard(true)
            ) : (
              <button onClick={() => { setShowAddNew(true); setForm({ ...form, className: activeClass }); }}
                className="border-2 border-dashed border-violet-300 bg-violet-50/30 p-4 rounded-2xl flex flex-col items-center justify-center min-h-[160px] hover:border-violet-400 hover:bg-violet-50/60 transition-all">
                <div className="text-3xl text-violet-400 mb-2">+</div>
                <div className="text-sm font-bold text-violet-600">Add New Student</div>
              </button>
            ))}

            {/* Loading Skeleton */}
            {loading.students && filtered.length === 0 && Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}

            {/* Student Cards */}
            {!loading.students && filtered.map((s) => (
              editingId === s.id ? (
                <div key={s.id}>{renderEditCard(false)}</div>
              ) : (
                <div key={s.id}>{renderViewCard(s)}</div>
              )
            ))}
          </div>

          {filtered.length === 0 && !showAddNew && (
            <div className="text-center py-12 text-school-muted">
              <div className="text-4xl mb-2">🎓</div>
              <p className="text-sm">No students in {activeClass} yet.</p>
            </div>
          )}
        </div>
      )}
      <DeleteConfirmModal open={!!deleteId} title="Delete Student" message="This will permanently delete this student and all their results." onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} loading={deleteLoading} />
    </div>
  );
}
