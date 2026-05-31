import { useEffect, useState } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import { ClipboardList } from 'lucide-react';

const API_URL = '/api';

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Create',
  UPDATE: 'Update',
  DELETE: 'Delete',
  CANCEL: 'Cancel',
  DEACTIVATE: 'Deactivate',
  BULK_ASSIGN: 'Bulk Assign',
};

const ENTITY_COLORS: Record<string, string> = {
  Student: 'text-blue-600 bg-blue-50',
  Transaction: 'text-emerald-600 bg-emerald-50',
  FeeSchedule: 'text-purple-600 bg-purple-50',
  FeeWaiver: 'text-amber-600 bg-amber-50',
  StudentFeeAssignment: 'text-rose-600 bg-rose-50',
};

const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [actions, setActions] = useState<string[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (actionFilter) params.action = actionFilter;
      if (entityFilter) params.entityType = entityFilter;
      const res = await axios.get(`${API_URL}/audit`, { params, withCredentials: true });
      setLogs(res.data.data);
      setTotal(res.data.total);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    axios.get(`${API_URL}/audit/actions`, { withCredentials: true })
      .then(res => setActions(res.data.map((r: any) => r.action)))
      .catch(() => {});
    axios.get(`${API_URL}/audit/entity-types`, { withCredentials: true })
      .then(res => setEntityTypes(res.data.map((r: any) => r.entityType)))
      .catch(() => {});
  }, []);

  useEffect(() => { fetchLogs(); }, [page, actionFilter, entityFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.ceil(total / limit);

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-500 text-white rounded-xl flex items-center justify-center">
            <ClipboardList size={20} />
          </div>
          <div>
            <h2 className="font-serif text-xl text-school-primary">Audit Logs</h2>
            <p className="text-xs text-school-muted">{total} total entries</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }}
            className="text-xs bg-white border border-school-border rounded-lg px-3 py-1.5 outline-none">
            <option value="">All Actions</option>
            {actions.map(a => <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>)}
          </select>
          <select value={entityFilter} onChange={e => { setEntityFilter(e.target.value); setPage(1); }}
            className="text-xs bg-white border border-school-border rounded-lg px-3 py-1.5 outline-none">
            <option value="">All Entities</option>
            {entityTypes.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <span className="text-xs text-school-muted self-center ml-auto">
            Page {page} of {totalPages || 1}
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-3 border-school-primary/20 border-t-school-primary rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-school-muted text-sm">No audit log entries found.</div>
        ) : (
          <div className="bg-white rounded-2xl border border-school-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-school-paper border-b border-school-border text-left">
                    <th className="px-4 py-2.5 font-semibold text-school-muted uppercase tracking-wider">Date</th>
                    <th className="px-4 py-2.5 font-semibold text-school-muted uppercase tracking-wider">Action</th>
                    <th className="px-4 py-2.5 font-semibold text-school-muted uppercase tracking-wider">Entity</th>
                    <th className="px-4 py-2.5 font-semibold text-school-muted uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log: any) => (
                    <tr key={log.id} className="border-b border-school-border/50 hover:bg-school-paper/50">
                      <td className="px-4 py-2.5 text-school-muted whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${actionFilter === 'DELETE' ? 'bg-red-50 text-red-600' : actionFilter === 'CREATE' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${ENTITY_COLORS[log.entityType] || 'text-gray-600 bg-gray-50'}`}>
                          {log.entityType}
                          {log.entityId && <span className="opacity-50 ml-1">#{log.entityId.slice(0, 8)}</span>}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-school-muted max-w-[300px] truncate font-mono">
                        {log.details || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-school-border">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-school-border disabled:opacity-30 hover:bg-school-paper">
                  Previous
                </button>
                <span className="text-xs text-school-muted">Page {page} of {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-school-border disabled:opacity-30 hover:bg-school-paper">
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AuditLogs;
