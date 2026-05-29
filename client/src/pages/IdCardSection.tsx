import React, { useState, useEffect, useCallback } from 'react';
import { useSchoolStore, useUIStore, useAuthStore } from '../store';
import { toast } from '../components/Toast';
import ClassManagerModal from '../components/ClassManagerModal';
import CameraModal from '../components/CameraModal';
import PhotoUpload from '../components/PhotoUpload';
import { Settings, FileText, RefreshCw, Phone, Mail, MessageCircle } from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

function formatBDPhone(raw: string): string {
  if (!raw) return '';
  let n = raw.replace(/[\s().+-]/g, '');
  if (n.startsWith('880')) n = n.slice(3);
  if (n.startsWith('0')) n = n.slice(1);
  return n.length === 10 && n.startsWith('1') ? '+880' + n : raw;
}

function contactLinks(raw: string) {
  if (!raw) return <span className="text-school-muted">—</span>;
  const e164 = formatBDPhone(raw);
  if (!(e164.startsWith('+880') && e164.length === 14)) return <span>{raw}</span>;
  const wa = e164.slice(1);
  return (
    <span className="flex gap-2 flex-wrap">
      <a href={`tel:${e164}`} className="text-blue-600 hover:underline text-xs">📞 {e164}</a>
      <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="text-green-600 hover:underline text-xs">💬 WhatsApp</a>
    </span>
  );
}

// ── Student Section ──

const StudentSection: React.FC = () => {
  const { classes, students, fetchClasses, fetchStudents } = useSchoolStore();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'admin';

  const [activeClass, setActiveClass] = useState<string | null>(null);
  const [showClassManager, setShowClassManager] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [formExpanded, setFormExpanded] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

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
    setEditId(null);
    setFormExpanded(false);
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
    setPhoto(s.photo || null);
    setEditId(s.id);
    setFormExpanded(true);
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
      if (editId) {
        await fetch(`${API_URL}/students/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
        toast('Student updated ✓', 'success');
      } else {
        await fetch(`${API_URL}/students`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
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

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this student?')) return;
    await fetch(`${API_URL}/students/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    toast('Student deleted');
    fetchStudents();
  };

  return (
    <div className="space-y-4">
      {/* Class Manager Modal */}
      <ClassManagerModal open={showClassManager} onClose={() => setShowClassManager(false)} />
      <CameraModal open={showCamera} onClose={() => setShowCamera(false)} onCapture={(d) => { setPhoto(d); setShowCamera(false); }} />

      {/* Form Card */}
      <div className="bg-white rounded-2xl border border-school-border overflow-hidden">
        <button
          onClick={() => setFormExpanded(!formExpanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-school-paper/50 transition-colors"
        >
          <span className="font-bold text-sm text-school-primary">{editId ? '✏️ Edit Student' : '➕ Add New Student'}</span>
          <span className="text-school-muted text-xs">{formExpanded ? '▲' : '▼'}</span>
        </button>

        {formExpanded && (
          <div className="p-4 border-t border-school-border space-y-3">
            <div className="flex justify-center">
              <PhotoUpload photo={photo} onPhotoChange={setPhoto} onOpenCamera={() => setShowCamera(true)} size="lg" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-school-muted mb-1 block">Class</label>
                <select
                  value={form.className}
                  onChange={(e) => setForm({ ...form, className: e.target.value })}
                  className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent"
                >
                  <option value="">Select class</option>
                  {sorted.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-school-muted mb-1 block">Roll No <span className="font-normal opacity-60">(optional)</span></label>
                <input type="text" value={form.roll} onChange={(e) => setForm({ ...form, roll: e.target.value })} placeholder="e.g. 01" className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-school-muted mb-1 block">Full Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Student's full name" className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-school-muted mb-1 block">Father's Name</label>
                <input type="text" value={form.fatherName} onChange={(e) => setForm({ ...form, fatherName: e.target.value })} placeholder="Father's full name" className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" />
              </div>
              <div>
                <label className="text-xs font-bold text-school-muted mb-1 block">Mother's Name</label>
                <input type="text" value={form.motherName} onChange={(e) => setForm({ ...form, motherName: e.target.value })} placeholder="Mother's full name" className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-school-muted mb-1 block">Contact Number</label>
              <input type="tel" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="01XXXXXXXXX" className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" />
              {form.contact && <p className="text-[11px] text-green-600 mt-1">{formatBDPhone(form.contact)}</p>}
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={handleSubmit} className="flex-1 py-2 bg-school-primary text-white rounded-xl text-sm font-bold hover:opacity-90">
                {editId ? '✓ Update' : '+ Add Student'}
              </button>
              {editId && (
                <button onClick={resetForm} className="px-4 py-2 border border-school-border rounded-xl text-sm hover:bg-school-paper">
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Panel Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-serif text-lg text-school-primary">Students</h3>
          <span className="bg-school-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">{filtered.length}</span>
        </div>
        <div className="flex gap-2">
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
              <button
                key={cls.id}
                onClick={() => { setActiveClass(cls.name); setForm({ ...form, className: cls.name }); }}
                className="bg-white p-4 rounded-2xl border border-school-border text-center hover:border-school-accent hover:shadow-md transition-all"
              >
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

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or roll..."
            className="w-full px-3 py-2 border border-school-border rounded-xl text-sm mb-3 focus:outline-none focus:border-school-accent"
          />

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-school-muted">
              <div className="text-4xl mb-2">🎓</div>
              <p className="text-sm">No students in {activeClass} yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((s) => (
                <div key={s.id} className="bg-white p-4 rounded-2xl border border-school-border hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    {s.photo ? (
                      <img src={s.photo} alt="" className="w-12 h-12 rounded-full object-cover border border-school-border flex-shrink-0" />
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
      )}
    </div>
  );
};

// ── Teacher Section ──

const TeacherSection: React.FC = () => {
  const { teachers, fetchTeachers } = useSchoolStore();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'admin';

  const [showCamera, setShowCamera] = useState(false);
  const [formExpanded, setFormExpanded] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeDesig, setActiveDesig] = useState<string | null>(null);

  const [photo, setPhoto] = useState<string | null>(null);
  const [form, setForm] = useState({ designation: '', name: '', email: '', contact: '' });

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
    setEditId(null);
    setFormExpanded(false);
  };

  const handleEdit = (t: any) => {
    setForm({ designation: t.designation, name: t.name, email: t.email || '', contact: t.contact || '' });
    setPhoto(t.photo || null);
    setEditId(t.id);
    setFormExpanded(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast('Enter teacher name', 'error');
    if (!form.designation.trim()) return toast('Enter designation', 'error');

    const body = { ...form, photo: photo || undefined };

    try {
      const url = editId ? `${API_URL}/teachers/${editId}` : `${API_URL}/teachers`;
      await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      toast(editId ? 'Teacher updated ✓' : 'Teacher added ✓', 'success');
      resetForm();
      fetchTeachers();
    } catch (e: any) {
      toast(e.message || 'Error', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this teacher?')) return;
    await fetch(`${API_URL}/teachers/${id}`, { method: 'DELETE', credentials: 'include' });
    toast('Teacher deleted');
    fetchTeachers();
  };

  return (
    <div className="space-y-4">
      <CameraModal open={showCamera} onClose={() => setShowCamera(false)} onCapture={(d) => { setPhoto(d); setShowCamera(false); }} />

      {/* Form */}
      <div className="bg-white rounded-2xl border border-school-border overflow-hidden">
        <button onClick={() => setFormExpanded(!formExpanded)} className="w-full flex items-center justify-between p-4 hover:bg-school-paper/50 transition-colors">
          <span className="font-bold text-sm text-school-primary">{editId ? '✏️ Edit Teacher' : '➕ Add New Teacher'}</span>
          <span className="text-school-muted text-xs">{formExpanded ? '▲' : '▼'}</span>
        </button>
        {formExpanded && (
          <div className="p-4 border-t border-school-border space-y-3">
            <div className="flex justify-center">
              <PhotoUpload photo={photo} onPhotoChange={setPhoto} onOpenCamera={() => setShowCamera(true)} size="lg" />
            </div>
            <div>
              <label className="text-xs font-bold text-school-muted mb-1 block">Designation</label>
              <input type="text" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="e.g. Head Teacher" className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" />
            </div>
            <div>
              <label className="text-xs font-bold text-school-muted mb-1 block">Full Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Teacher's full name" className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-school-muted mb-1 block">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="teacher@school.com" className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" />
              </div>
              <div>
                <label className="text-xs font-bold text-school-muted mb-1 block">Contact</label>
                <input type="tel" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="01XXXXXXXXX" className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSubmit} className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:opacity-90">
                {editId ? '✓ Update' : '+ Add Teacher'}
              </button>
              {editId && <button onClick={resetForm} className="px-4 py-2 border border-school-border rounded-xl text-sm">Cancel</button>}
            </div>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-serif text-lg text-school-primary">Teachers</h3>
          <span className="bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{filtered.length}</span>
        </div>
        <button onClick={() => fetchTeachers()} className="flex items-center gap-1 px-3 py-1.5 border border-school-border rounded-lg text-xs hover:bg-school-paper">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Designation Picker or List */}
      {!activeDesig && designations.length > 0 && (
        <div>
          <p className="text-sm text-school-muted mb-2">Filter by designation:</p>
          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={() => setActiveDesig(null)} className="px-3 py-1.5 bg-school-primary text-white rounded-full text-xs font-medium">All</button>
            {designations.map((d) => (
              <button key={d} onClick={() => setActiveDesig(d)} className="px-3 py-1.5 border border-school-border rounded-full text-xs font-medium hover:bg-school-paper">{d}</button>
            ))}
          </div>
        </div>
      )}
      {activeDesig && (
        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => setActiveDesig(null)} className="text-sm text-school-accent hover:underline">← All</button>
          <span className="text-sm font-medium">{activeDesig}</span>
        </div>
      )}

      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or designation..." className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" />

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-school-muted">
          <div className="text-4xl mb-2">👩‍🏫</div>
          <p className="text-sm">No teachers found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((t: any) => (
            <div key={t.id} className="bg-white p-4 rounded-2xl border border-school-border hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                {t.photo ? (
                  <img src={t.photo} alt="" className="w-12 h-12 rounded-full object-cover border border-school-border flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center text-lg flex-shrink-0">👩‍🏫</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-school-primary truncate">{t.name}</div>
                  <div className="text-xs text-emerald-600 font-medium">{t.designation}</div>
                </div>
              </div>
              <div className="mt-2 space-y-1">
                {t.email && <div className="text-xs flex items-center gap-1"><Mail size={11} className="text-school-muted" /> {t.email}</div>}
                {t.contact && <div className="text-xs">{contactLinks(t.contact)}</div>}
              </div>
              {isAdmin && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-school-border">
                  <button onClick={() => handleEdit(t)} className="flex-1 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100">✏️ Edit</button>
                  <button onClick={() => handleDelete(t.id)} className="flex-1 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-medium hover:bg-red-100">🗑 Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Staff Section ──

const StaffSection: React.FC = () => {
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
    setPhoto(s.photo || null);
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
        <button onClick={() => fetchStaff()} className="flex items-center gap-1 px-3 py-1.5 border border-school-border rounded-lg text-xs hover:bg-school-paper">
          <RefreshCw size={12} /> Refresh
        </button>
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
                {s.photo ? (
                  <img src={s.photo} alt="" className="w-12 h-12 rounded-full object-cover border border-school-border flex-shrink-0" />
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
};

// ── Main IdCard Section ──

const IdCardSection: React.FC = () => {
  const { activeSubMode, setIdSubMode } = useUIStore();

  const tabs = [
    { id: 'student' as const, label: '🎓 Students', color: 'bg-blue-600' },
    { id: 'teacher' as const, label: '👩‍🏫 Teachers', color: 'bg-emerald-600' },
    { id: 'staff' as const, label: '🏢 Staff', color: 'bg-indigo-600' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setIdSubMode(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              activeSubMode === tab.id
                ? `${tab.color} text-white shadow-lg`
                : 'bg-white border border-school-border text-school-primary hover:border-school-accent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubMode === 'student' && <StudentSection />}
      {activeSubMode === 'teacher' && <TeacherSection />}
      {activeSubMode === 'staff' && <StaffSection />}
    </div>
  );
};

export default IdCardSection;
