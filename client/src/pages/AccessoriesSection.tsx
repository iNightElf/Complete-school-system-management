import React, { useState, useEffect } from 'react';
import { useSchoolStore, useAuthStore } from '../store';
import { toast } from '../components/Toast';
import ClassManagerModal from '../components/ClassManagerModal';
import { Settings, RefreshCw } from 'lucide-react';

const API_URL = '/api';

const AccessoriesSection: React.FC = () => {
  const { classes, books, fetchClasses, fetchBooks } = useSchoolStore();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'admin';

  const [activeClass, setActiveClass] = useState<string | null>(null);
  const [showClassManager, setShowClassManager] = useState(false);
  const [formExpanded, setFormExpanded] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [form, setForm] = useState({ classId: '', name: '', publication: '', mrp: '', discounted: '', sell: '' });

  useEffect(() => { fetchClasses(); fetchBooks(); }, []);

  const sorted = [...classes].sort((a, b) => a.order - b.order);
  const classBooks = books.filter((b: any) => activeClass && b.class?.name === activeClass);
  const totalSell = classBooks.reduce((sum: number, b: any) => sum + Number(b.sell || 0), 0);

  const resetForm = () => {
    setForm({ classId: '', name: '', publication: '', mrp: '', discounted: '', sell: '' });
    setEditId(null);
    setFormExpanded(false);
  };

  const handleEdit = (b: any) => {
    setForm({
      classId: b.classId,
      name: b.name,
      publication: b.publication || '',
      mrp: String(b.mrp || ''),
      discounted: String(b.discounted || ''),
      sell: String(b.sell || ''),
    });
    setEditId(b.id);
    setFormExpanded(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast('Enter book name', 'error');
    if (!form.classId) return toast('Select a class', 'error');

    const body = {
      name: form.name.trim(),
      publication: form.publication || undefined,
      mrp: Number(form.mrp) || 0,
      discounted: Number(form.discounted) || 0,
      sell: Number(form.sell) || 0,
      classId: form.classId,
    };

    try {
      const url = editId ? `${API_URL}/books/${editId}` : `${API_URL}/books`;
      await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      toast(editId ? 'Book updated ✓' : 'Book added ✓', 'success');
      resetForm();
      fetchBooks();
    } catch (e: any) {
      toast(e.message || 'Error', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this book?')) return;
    await fetch(`${API_URL}/books/${id}`, { method: 'DELETE', credentials: 'include' });
    toast('Book deleted');
    fetchBooks();
  };

  return (
    <div className="space-y-4">
      <ClassManagerModal open={showClassManager} onClose={() => setShowClassManager(false)} />

      {/* Form */}
      <div className="bg-white rounded-2xl border border-school-border overflow-hidden">
        <button onClick={() => setFormExpanded(!formExpanded)} className="w-full flex items-center justify-between p-4 hover:bg-school-paper/50 transition-colors">
          <span className="font-bold text-sm text-school-primary">{editId ? '✏️ Edit Accessory' : '➕ Add Accessory'}</span>
          <span className="text-school-muted text-xs">{formExpanded ? '▲' : '▼'}</span>
        </button>
        {formExpanded && (
          <div className="p-4 border-t border-school-border space-y-3">
            <div>
              <label className="text-xs font-bold text-school-muted mb-1 block">Class</label>
              <select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent">
                <option value="">Select class</option>
                {sorted.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-school-muted mb-1 block">Book Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. English Grammar Part 1" className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" />
            </div>
            <div>
              <label className="text-xs font-bold text-school-muted mb-1 block">Publication <span className="font-normal opacity-60">(optional)</span></label>
              <input type="text" value={form.publication} onChange={(e) => setForm({ ...form, publication: e.target.value })} placeholder="e.g. National Curriculum" className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-school-muted mb-1 block">MRP (৳)</label>
                <input type="number" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} placeholder="0" min="0" className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" />
              </div>
              <div>
                <label className="text-xs font-bold text-school-muted mb-1 block">Disc. (৳)</label>
                <input type="number" value={form.discounted} onChange={(e) => setForm({ ...form, discounted: e.target.value })} placeholder="0" min="0" className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" />
              </div>
              <div>
                <label className="text-xs font-bold text-school-muted mb-1 block">Sell (৳)</label>
                <input type="number" value={form.sell} onChange={(e) => setForm({ ...form, sell: e.target.value })} placeholder="0" min="0" className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSubmit} className="flex-1 py-2 bg-amber-600 text-white rounded-xl text-sm font-bold hover:opacity-90">
                {editId ? '✓ Update' : '+ Add Book'}
              </button>
              {editId && <button onClick={resetForm} className="px-4 py-2 border border-school-border rounded-xl text-sm">Cancel</button>}
            </div>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-serif text-lg text-school-primary">Accessories</h3>
          <span className="bg-amber-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{classBooks.length}</span>
        </div>
        <button onClick={() => fetchBooks()} className="flex items-center gap-1 px-3 py-1.5 border border-school-border rounded-lg text-xs hover:bg-school-paper">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Class Picker or Book Table */}
      {!activeClass ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-school-muted">Select a class to manage accessories:</p>
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
                onClick={() => { setActiveClass(cls.name); setForm({ ...form, classId: cls.id }); }}
                className="bg-white p-4 rounded-2xl border border-school-border text-center hover:border-amber-500 hover:shadow-md transition-all"
              >
                <div className="text-2xl mb-1">📚</div>
                <div className="font-bold text-sm text-school-primary">{cls.name}</div>
                <div className="text-[11px] text-school-muted mt-1">{cls.bookCount} book{cls.bookCount !== 1 ? 's' : ''}</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => { setActiveClass(null); resetForm(); }} className="text-sm text-school-accent hover:underline">← All Classes</button>
            <span className="font-serif text-sm text-school-primary">{activeClass}</span>
            <span className="text-xs text-school-muted">({classBooks.length} books, Total sell: ৳{totalSell.toLocaleString()})</span>
          </div>

          {classBooks.length === 0 ? (
            <div className="text-center py-12 text-school-muted">
              <div className="text-4xl mb-2">📚</div>
              <p className="text-sm">No accessories in {activeClass} yet.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-school-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-school-paper text-school-muted text-xs uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">#</th>
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-left">Publication</th>
                      <th className="px-4 py-3 text-right">MRP (৳)</th>
                      <th className="px-4 py-3 text-right">Disc. (৳)</th>
                      <th className="px-4 py-3 text-right">Sell (৳)</th>
                      {isAdmin && <th className="px-4 py-3 text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {classBooks.map((b: any, i: number) => (
                      <tr key={b.id} className="border-t border-school-border hover:bg-school-paper/30">
                        <td className="px-4 py-3 text-school-muted">{i + 1}</td>
                        <td className="px-4 py-3 font-medium">{b.name}</td>
                        <td className="px-4 py-3 text-school-muted">{b.publication || '—'}</td>
                        <td className="px-4 py-3 text-right">{Number(b.mrp).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">{Number(b.discounted).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-bold">{Number(b.sell).toLocaleString()}</td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-center">
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => handleEdit(b)} className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100">Edit</button>
                              <button onClick={() => handleDelete(b.id)} className="px-2 py-1 bg-red-50 text-red-500 rounded text-xs hover:bg-red-100">Delete</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-school-primary bg-school-paper font-bold">
                      <td colSpan={5} className="px-4 py-3 text-right text-xs uppercase tracking-wider">Total Sell Price</td>
                      <td className="px-4 py-3 text-right">৳{totalSell.toLocaleString()}</td>
                      {isAdmin && <td></td>}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AccessoriesSection;
