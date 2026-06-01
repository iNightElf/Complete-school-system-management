import React, { useState } from 'react';
import { useSchoolStore } from '../store';
import { toast } from './Toast';
import { X, ArrowUp, ArrowDown, Trash2, Settings, GraduationCap, ChevronUp, ChevronDown } from 'lucide-react';
import DeleteConfirmModal from './DeleteConfirmModal';

const classIcon = () => <GraduationCap size={20} />;

interface Props {
  open: boolean;
  onClose: () => void;
}

const ClassManagerModal: React.FC<Props> = ({ open, onClose }) => {
  const { classes, createClass, deleteClass, reorderClasses } = useSchoolStore();
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState('');

  if (!open) return null;

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    if (classes.some((c) => c.name === name)) return toast('Class already exists', 'error');
    setLoading(true);
    try {
      await createClass(name);
      setNewName('');
    } catch (e: any) {
      toast(e.response?.data?.error || 'Error', 'error');
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteClass(deleteId);
    setDeleteId(null);
  };

  const handleMove = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= classes.length) return;
    const sorted = [...classes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    [sorted[index], sorted[j]] = [sorted[j], sorted[index]];
    await reorderClasses(sorted.map((c) => c.id));
  };

  const sorted = [...classes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-school-border">
          <h3 className="font-serif text-lg text-school-primary flex items-center gap-1.5"><Settings size={16} /> Manage Classes</h3>
          <button onClick={onClose} className="p-1 hover:bg-school-paper rounded-full" aria-label="Close"><X size={20} /></button>
        </div>
        <div className="p-4">
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="e.g. Class Six, Pre-KG"
              className="flex-1 px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent"
              maxLength={40}
            />
            <button
              onClick={handleAdd}
              disabled={loading}
              className="px-4 py-2 bg-school-primary text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50"
            >
              + Add
            </button>
          </div>

          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {sorted.map((cls, i) => (
              <li key={cls.id} className="flex items-center gap-3 p-2 bg-school-paper rounded-xl">
                <span>{classIcon()}</span>
                <span className="flex-1 text-sm font-medium">{cls.name}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleMove(i, -1)}
                    disabled={i === 0}
                    className="p-1 hover:bg-white rounded disabled:opacity-30"
                    aria-label={`Move ${cls.name} up`}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    onClick={() => handleMove(i, 1)}
                    disabled={i === sorted.length - 1}
                    className="p-1 hover:bg-white rounded disabled:opacity-30"
                    aria-label={`Move ${cls.name} down`}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    onClick={() => { setDeleteId(cls.id); setDeleteName(cls.name); }}
                    className="p-1 hover:bg-red-100 text-red-500 rounded"
                    aria-label={`Delete ${cls.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <p className="text-[11px] text-school-muted mt-3 flex items-center gap-0.5"><ChevronUp size={12} /><ChevronDown size={12} /> to reorder · Changes saved automatically</p>
        </div>
      </div>
      <DeleteConfirmModal open={!!deleteId} title="Delete Class" message={`Delete "${deleteName}"? This cannot be undone.`} onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
    </div>
  );
};

export default ClassManagerModal;
