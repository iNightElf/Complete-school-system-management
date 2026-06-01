import { useEffect, useState } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import { ClipboardList, X } from 'lucide-react';
import { API_URL } from '../lib/config';

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

const AuditLogs = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [actions, setActions] = useState<string[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [detailLog, setDetailLog] = useState<any>(null);

  useEffect(() => { document.title = 'Audit Logs - AL RAWA English School'; }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (actionFilter) params.action = actionFilter;
      if (entityFilter) params.entityType = entityFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (userIdFilter) params.userId = userIdFilter;
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

  useEffect(() => { fetchLogs(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = () => { setPage(1); fetchLogs(); };
  const clearFilters = () => {
    setActionFilter(''); setEntityFilter(''); setDateFrom(''); setDateTo('');
    setUserIdFilter(''); setPage(1);
  };

  const totalPages = Math.ceil(total / limit);

  const hasFilters = actionFilter || entityFilter || dateFrom || dateTo || userIdFilter;

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

        <div className="bg-white rounded-xl border border-school-border p-3 space-y-2">
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="text-[9px] font-bold uppercase text-school-muted mb-0.5 block">Action</label>
              <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
                className="text-xs bg-white border border-school-border rounded-lg px-3 py-1.5 outline-none">
                <option value="">All</option>
                {actions.map(a => <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase text-school-muted mb-0.5 block">Entity</label>
              <select value={entityFilter} onChange={e => setEntityFilter(e.target.value)}
                className="text-xs bg-white border border-school-border rounded-lg px-3 py-1.5 outline-none">
                <option value="">All</option>
                {entityTypes.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase text-school-muted mb-0.5 block">From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="text-xs bg-white border border-school-border rounded-lg px-3 py-1.5 outline-none w-[140px]" />
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase text-school-muted mb-0.5 block">To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="text-xs bg-white border border-school-border rounded-lg px-3 py-1.5 outline-none w-[140px]" />
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase text-school-muted mb-0.5 block">User ID</label>
              <input type="text" value={userIdFilter} onChange={e => setUserIdFilter(e.target.value)}
                placeholder="Filter by user..."
                className="text-xs bg-white border border-school-border rounded-lg px-3 py-1.5 outline-none w-[150px]" />
            </div>
            <div className="flex gap-1">
              <button onClick={applyFilters}
                className="text-xs px-3 py-1.5 rounded-lg bg-school-primary text-white font-bold hover:opacity-90">
                Apply
              </button>
              {hasFilters && (
                <button onClick={clearFilters}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-school-muted font-bold hover:bg-gray-200">
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-3 border-school-primary/20 border-t-school-primary rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-school-muted text-sm">No audit log entries found.</div>
        ) : (
          <div className="bg-white rounded-xl border border-school-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs mobile-card-table">
                <thead>
                  <tr className="bg-school-paper border-b border-school-border text-left">
                    <th className="px-4 py-2.5 font-semibold text-school-muted uppercase tracking-wider">Date</th>
                    <th className="px-4 py-2.5 font-semibold text-school-muted uppercase tracking-wider">User</th>
                    <th className="px-4 py-2.5 font-semibold text-school-muted uppercase tracking-wider">Action</th>
                    <th className="px-4 py-2.5 font-semibold text-school-muted uppercase tracking-wider">Entity</th>
                    <th className="px-4 py-2.5 font-semibold text-school-muted uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log: any) => {
                    let parsed: any = null;
                    try { if (log.details) parsed = JSON.parse(log.details); } catch { parsed = log.details; }
                    const preview = typeof parsed === 'object' && parsed ? JSON.stringify(parsed).slice(0, 80) + '…' : (log.details || '—');
                    return (
                      <tr key={log.id} className="border-b border-school-border/50 hover:bg-school-paper/50 cursor-pointer"
                        onClick={() => setDetailLog(log)}>
                        <td className="px-4 py-2.5 text-school-muted whitespace-nowrap" data-label="Date">
                          {new Date(log.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-2.5 text-school-muted font-mono" data-label="User">
                          {log.userId ? `#${log.userId.slice(0, 8)}` : '—'}
                        </td>
                        <td className="px-4 py-2.5" data-label="Action">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${log.action === 'DELETE' ? 'bg-red-50 text-red-600' : log.action === 'CREATE' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                            {ACTION_LABELS[log.action] || log.action}
                          </span>
                        </td>
                        <td className="px-4 py-2.5" data-label="Entity">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${ENTITY_COLORS[log.entityType] || 'text-gray-600 bg-gray-50'}`}>
                            {log.entityType}
                            {log.entityId && <span className="opacity-50 ml-1">#{log.entityId.slice(0, 8)}</span>}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-school-muted max-w-[300px] truncate font-mono text-[10px]" data-label="Details">
                          {preview}
                        </td>
                      </tr>
                    );
                  })}
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

        {/* Detail Modal */}
        {detailLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetailLog(null)}>
            <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-school-border sticky top-0 bg-white">
                <h3 className="font-bold text-sm text-school-primary">Audit Log Detail</h3>
                <button onClick={() => setDetailLog(null)}
                  className="p-1 rounded-lg hover:bg-school-paper">
                  <X size={16} />
                </button>
              </div>
              <div className="px-5 py-4 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-school-muted block">Date</span>
                    <span>{new Date(detailLog.createdAt).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-school-muted block">User</span>
                    <span className="font-mono">{detailLog.userId || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-school-muted block">Action</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${detailLog.action === 'DELETE' ? 'bg-red-50 text-red-600' : detailLog.action === 'CREATE' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                      {ACTION_LABELS[detailLog.action] || detailLog.action}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-school-muted block">Entity</span>
                    <span>{detailLog.entityType}{detailLog.entityId ? ` #${detailLog.entityId}` : ''}</span>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-school-muted block mb-1">Details</span>
                  <pre className="bg-school-paper rounded-lg p-3 text-[11px] font-mono whitespace-pre-wrap overflow-x-auto max-h-[300px]">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(detailLog.details || '{}'), null, 2);
                      } catch {
                        return detailLog.details || '—';
                      }
                    })()}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AuditLogs;
