import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  ActivityLog 
} from '../types';
import { 
  Search, Calendar, Filter, Trash2, CheckCircle2, Info, Eye, Download, HardDrive, RefreshCw, Database
} from 'lucide-react';
import { backfillHistoricalLogs } from '../dataService';

interface LogsTabProps {
  logs: ActivityLog[];
  loading: boolean;
  onRefresh: () => void;
}

export default function LogsTab({ logs, loading, onRefresh }: LogsTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);

  const handleBackfill = async () => {
    try {
      setIsBackfilling(true);
      setBackfillMessage(null);
      const res = await backfillHistoricalLogs();
      if (res.count > 0) {
        setBackfillMessage(`تم استيراد ${res.count} سجل سابق وبثهم في لوحة السجلات بنجاح! / Successfully backfilled ${res.count} older records!`);
      } else {
        setBackfillMessage('كل السجلات والبيانات السابقة تم سحبها مسبقاً، لا يوجد سجلات مفقودة. / All historical records are already in logs. No new entries found.');
      }
      onRefresh();
    } catch (e: any) {
      setBackfillMessage(`فشل الاستيراد: ${e.message || e}`);
    } finally {
      setIsBackfilling(false);
      // Auto-clear message after 8 seconds
      setTimeout(() => {
        setBackfillMessage(null);
      }, 8000);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchSearch = 
        log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchAction = !actionFilter || log.action === actionFilter;
      const matchCategory = !categoryFilter || log.category === categoryFilter;
      return matchSearch && matchAction && matchCategory;
    });
  }, [logs, searchTerm, actionFilter, categoryFilter]);

  const stats = useMemo(() => {
    const total = logs.length;
    const creates = logs.filter(l => l.action === 'create').length;
    const updates = logs.filter(l => l.action === 'update').length;
    const deletes = logs.filter(l => l.action === 'delete').length;
    return { total, creates, updates, deletes };
  }, [logs]);

  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch {
      return isoString;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
            إضافة / Create
          </span>
        );
      case 'update':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
            تعديل / Update
          </span>
        );
      case 'delete':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 border border-rose-200">
            حذف / Delete
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            {action}
          </span>
        );
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'sale':
        return 'المبيعات / Sales';
      case 'expense':
        return 'المصاريف / Expenses';
      case 'supplier':
        return 'الموردين / Suppliers';
      case 'reconciliation':
        return 'مطابقة النقدية / Cash Match';
      case 'month':
        return 'الأشهر اليدوية / Manual Months';
      case 'extra':
        return 'المصاريف الإضافية / Extras';
      case 'override':
        return 'التجاوزات / Overrides';
      default:
        return cat;
    }
  };

  const exportLogsToCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = ['Timestamp', 'Entered Date', 'User Email', 'Action', 'Category', 'Details'];
    const rows = filteredLogs.map(log => [
      log.timestamp,
      log.transaction_date || 'N/A',
      log.user_email,
      log.action,
      log.category,
      log.details.replace(/"/g, '""')
    ]);

    const csvContent = 
      "\uFEFF" + 
      [headers.join(','), ...rows.map(r => r.map(val => `"${val}"`).join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Al_Kabir_Audit_Logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Cards stats log */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-stone-400 text-xs font-bold uppercase tracking-wider">إجمالي العمليات / Total Actions</p>
            <p className="text-3xl font-black mt-1 text-stone-800">{stats.total}</p>
          </div>
          <div className="p-3 bg-stone-100 text-stone-600 rounded-xl">
            <HardDrive size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-stone-400 text-xs font-bold uppercase tracking-wider">عمليات الإضافة / Added Records</p>
            <p className="text-3xl font-black mt-1 text-emerald-600">{stats.creates}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-stone-400 text-xs font-bold uppercase tracking-wider">تعديل البيانات / Edited Records</p>
            <p className="text-3xl font-black mt-1 text-indigo-600">{stats.updates}</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Info size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-stone-400 text-xs font-bold uppercase tracking-wider">عمليات الحذف / Deleted Records</p>
            <p className="text-3xl font-black mt-1 text-rose-500">{stats.deletes}</p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-500 rounded-xl">
            <Trash2 size={22} />
          </div>
        </div>
      </div>

      {/* Filter and search actions */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input 
              type="text" 
              placeholder="البحث في السجلات (المستخدم، التفاصيل، التصنيف...) / Search logs..." 
              className="w-full pl-11 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-800/20 shadow-inner" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-stone-100 px-3 py-1.5 rounded-lg text-xs font-bold text-stone-500 gap-1">
              <Filter size={14} /> تصفية / Filter
            </div>

            <select 
              value={actionFilter} 
              onChange={e => setActionFilter(e.target.value)}
              className="text-xs font-bold bg-white border border-stone-200 rounded-lg px-3 py-2 cursor-pointer shadow-sm text-stone-600 focus:outline-none"
            >
              <option value="">كل العمليات / All Actions</option>
              <option value="create">إضافة / Create</option>
              <option value="update">تعديل / Update</option>
              <option value="delete">حذف / Delete</option>
            </select>

            <select 
              value={categoryFilter} 
              onChange={e => setCategoryFilter(e.target.value)}
              className="text-xs font-bold bg-white border border-stone-200 rounded-lg px-3 py-2 cursor-pointer shadow-sm text-stone-600 focus:outline-none"
            >
              <option value="">كل التصنيفات / All Categories</option>
              <option value="sale">المبيعات / Sales</option>
              <option value="expense">المصاريف / Expenses</option>
              <option value="supplier">الموردين / Suppliers</option>
              <option value="reconciliation">مطابقة النقدية / Reconciliation</option>
              <option value="month">الأشر اليدوية / Manual Months</option>
              <option value="extra">المصاريف الإضافية / Extras</option>
              <option value="override">التجاوزات / Overrides</option>
            </select>

            <button 
              onClick={exportLogsToCSV}
              disabled={filteredLogs.length === 0}
              className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-900 border border-stone-700 text-white rounded-lg px-4 py-2 text-xs font-semibold shadow transition-colors disabled:opacity-50"
            >
              <Download size={14} /> تصدير CSV / Export
            </button>

            <button 
              onClick={handleBackfill}
              disabled={isBackfilling || loading}
              className="flex items-center gap-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg px-4 py-2 text-xs font-semibold shadow transition-colors disabled:opacity-50"
              title="سحب البيانات السابقة وتحويلها لسجلات مراجعة / Import historical logs"
            >
              <Database size={14} className={isBackfilling ? "animate-pulse" : ""} />
              {isBackfilling ? 'جاري المزامنة... / Syncing...' : 'استعادة السجلات السابقة / Sync Old Data'}
            </button>

            <button 
              onClick={onRefresh}
              className="p-2 text-stone-500 hover:text-emerald-800 hover:bg-stone-100 rounded-lg transition-all"
              title="تحديث البيانات / Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {backfillMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-amber-50/70 border border-amber-200 text-amber-900 text-xs font-bold rounded-xl flex items-center gap-2 leading-relaxed"
          >
            <Info size={16} className="text-amber-700 shrink-0" />
            <span>{backfillMessage}</span>
          </motion.div>
        )}

        {/* Real-time indicator */}
        <div className="flex items-center gap-2 text-[10px] font-semibold text-stone-400 px-1 border-t border-stone-100 pt-3">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>مراقب السجل نشط ومباشر / Audit Trail Live Monitoring Active</span>
        </div>
      </div>

      {/* Audit table representation */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-4 border-stone-800 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-stone-400 font-bold">جاري تحميل سجلات الهيئة والمدير / Fetching Audit Logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-16 px-4">
            <HardDrive size={40} className="mx-auto text-stone-300 mb-3" />
            <h3 className="text-sm font-bold text-stone-700">لا توجد سجلات مطابقة</h3>
            <p className="text-xs text-stone-400 mt-1">امسح الفلاتر أو جرب كتابة كلمة أخرى في البحث.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50/70 border-b border-stone-200">
                  <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider text-left">Recorded At (Log Time)</th>
                  <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider text-left">Entered Date (Transaction Date)</th>
                  <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider text-left">User / Email</th>
                  <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider text-left">Action</th>
                  <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider text-left">Category</th>
                  <th className="px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider text-left">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredLogs.map((log) => (
                  <motion.tr 
                    key={log.id} 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="hover:bg-stone-50/50 transition-colors"
                  >
                    {/* Timestamp */}
                    <td className="px-6 py-4 text-xs font-medium text-stone-500 text-left whitespace-nowrap">
                      {formatTimestamp(log.timestamp)}
                    </td>

                    {/* Entered Date */}
                    <td className="px-6 py-4 text-left whitespace-nowrap">
                      {log.transaction_date ? (
                        <div className="flex items-center gap-1.5 text-xs text-amber-800 font-bold bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-xl w-fit">
                          <Calendar size={13} className="text-amber-700 shrink-0" />
                          <span>{log.transaction_date}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-stone-400 italic px-2">N/A</span>
                      )}
                    </td>

                    {/* Security auth email target */}
                    <td className="px-6 py-4 text-xs font-semibold text-stone-700 text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span>{log.user_email}</span>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="px-6 py-4 text-left whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>

                    {/* Category */}
                    <td className="px-6 py-4 text-left text-xs font-semibold text-stone-600 whitespace-nowrap">
                      {getCategoryLabel(log.category)}
                    </td>

                    {/* Detailed string log */}
                    <td className="px-6 py-4 text-left text-xs font-medium text-stone-800 leading-relaxed font-mono">
                      {log.details}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
