import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, LayoutDashboard, Receipt, TrendingUp,
  Calendar, DollarSign, Users, FileText, Search,
  Edit2, Save, X, Shield, Upload, ExternalLink,
} from 'lucide-react';
import { Sale, Expense, Supplier, MonthlyAttachment, UserRole, DAYS } from './types';
import {
  getSales, saveSale, deleteSale as deleteSaleDb,
  getExpenses, saveExpense, deleteExpense as deleteExpenseDb,
  getSuppliers, saveSupplier, deleteSupplier as deleteSupplierDb,
  getAttachments, saveAttachment, deleteAttachment as deleteAttachmentDb,
  getMonthlyCash, saveMonthlyCashData,
} from './dataService';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'sales' | 'expenses' | 'suppliers'>('dashboard');
  const [userRole, setUserRole] = useState<UserRole>('admin');
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [attachments, setAttachments] = useState<MonthlyAttachment[]>([]);
  const [isAddingSale, setIsAddingSale] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedPeriod, setSelectedPeriod] = useState<string>((new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [monthlyOpeningCash, setMonthlyOpeningCash] = useState(0);
  const [monthlyClosingCash, setMonthlyClosingCash] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchSales(), fetchExpenses(), fetchSuppliers()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedPeriod !== 'all' && !selectedPeriod.startsWith('Q')) {
      fetchMonthlyCash(`${selectedYear}-${selectedPeriod}`);
      fetchAttachments(`${selectedYear}-${selectedPeriod}`);
    }
  }, [selectedYear, selectedPeriod]);

  const fetchSales = async () => { try { setSales(await getSales()); } catch (e: any) { setError('Failed to load sales: ' + e.message); } };
  const fetchExpenses = async () => { try { setExpenses(await getExpenses()); } catch (e: any) { setError('Failed to load expenses: ' + e.message); } };
  const fetchSuppliers = async () => { try { setSuppliers(await getSuppliers()); } catch (e: any) { setError('Failed to load suppliers: ' + e.message); } };
  const fetchAttachments = async (my: string) => { try { setAttachments(await getAttachments(my)); } catch (e) { console.error(e); } };
  const fetchMonthlyCash = async (my: string) => {
    try {
      const data = await getMonthlyCash(my);
      if (data.id) { setMonthlyOpeningCash(data.opening_cash); setMonthlyClosingCash(data.closing_cash); }
      else {
        const [year, month] = my.split('-').map(Number);
        let py = year, pm = month - 1;
        if (pm === 0) { pm = 12; py -= 1; }
        const prev = await getMonthlyCash(`${py}-${pm.toString().padStart(2, '0')}`);
        setMonthlyOpeningCash(prev.closing_cash || 0);
        setMonthlyClosingCash(0);
      }
    } catch (e) { console.error(e); }
  };

  const handleSaveMonthlyCash = async (opening: number, closing: number) => {
    if (selectedPeriod === 'all' || selectedPeriod.startsWith('Q')) return;
    await saveMonthlyCashData(`${selectedYear}-${selectedPeriod}`, opening, closing);
  };

  const handleAddSale = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const date = fd.get('date') as string;
    const sale: Sale = {
      date, day: DAYS[new Date(date).getDay()], opening_cash: 0, closing_cash_actual: 0,
      dining_cash: Number(fd.get('dining_cash')) || 0,
      total_cash_sales: Number(fd.get('dining_cash')) || 0,
      dining_card: Number(fd.get('dining_card')) || 0,
      jahez_bistro: Number(fd.get('jahez_bistro')) || 0,
      jahez_burger: Number(fd.get('jahez_burger')) || 0,
      keeta_bistro: Number(fd.get('keeta_bistro')) || 0,
      keeta_burger: Number(fd.get('keeta_burger')) || 0,
      hunger_station_bistro: Number(fd.get('hunger_station_bistro')) || 0,
      hunger_station_burger: Number(fd.get('hunger_station_burger')) || 0,
      ninja: Number(fd.get('ninja')) || 0,
      discount: Number(fd.get('discount')) || 0,
      num_customers: Number(fd.get('num_customers')) || 0,
      pos_closing_report: Number(fd.get('pos_closing_report')) || 0,
    };
    const id = (fd.get('id') as string) || editingSaleId || undefined;
    try { await saveSale(id ? { ...sale, id } : sale); setEditingSaleId(null); setIsAddingSale(false); await fetchSales(); }
    catch (e: any) { setError('Failed to save sale: ' + e.message); }
  };

  const handleAddExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const total = Number(fd.get('total'));
    const supplierId = fd.get('supplier_id') as string;
    const supplier = suppliers.find(s => s.id === supplierId);
    const expense: Expense = {
      date: fd.get('date') as string,
      invoice_no: fd.get('invoice_number') as string,
      supplier_id: supplierId,
      supplier_name: supplier ? supplier.name : (fd.get('supplier_name') as string || ''),
      item_name: fd.get('item_name') as string,
      vat_number: fd.get('vat_number') as string,
      total, vat_debit: total - total / 1.15, total_debit: total / 1.15,
      credit: Number(fd.get('credit') || 0),
      total_w_vat_credit: Number(fd.get('total_w_vat_credit') || 0),
      paid_by: fd.get('paid_by') as string,
    };
    const id = (fd.get('id') as string) || editingExpenseId || undefined;
    try { await saveExpense(id ? { ...expense, id } : expense); setEditingExpenseId(null); setIsAddingExpense(false); await fetchExpenses(); }
    catch (e: any) { setError('Failed to save expense: ' + e.message); }
  };

  const handleAddSupplier = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget; const fd = new FormData(form);
    try { await saveSupplier({ name: fd.get('supplier_name') as string, vat_number: fd.get('supplier_vat') as string }); await fetchSuppliers(); form.reset(); }
    catch (e: any) { setError('Failed to save supplier: ' + e.message); }
  };

  const handleUploadAttachment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget; const fd = new FormData(form);
    try {
      await saveAttachment({ month_year: `${selectedYear}-${selectedPeriod}`, file_url: fd.get('file_url') as string, file_name: fd.get('file_name') as string });
      await fetchAttachments(`${selectedYear}-${selectedPeriod}`); form.reset();
    } catch (e: any) { setError('Failed to upload: ' + e.message); }
  };

  const handleDeleteSale = async (id: string) => { if (!confirm('Are you sure?')) return; try { await deleteSaleDb(id); await fetchSales(); } catch (e: any) { setError(e.message); } };
  const handleDeleteExpense = async (id: string) => { if (!confirm('Are you sure?')) return; try { await deleteExpenseDb(id); await fetchExpenses(); } catch (e: any) { setError(e.message); } };
  const handleDeleteSupplier = async (id: string) => { if (!confirm('Are you sure?')) return; try { await deleteSupplierDb(id); await fetchSuppliers(); } catch (e: any) { setError(e.message); } };
  const handleDeleteAttachment = async (id: string) => { if (!confirm('Are you sure?')) return; try { await deleteAttachmentDb(id); await fetchAttachments(`${selectedYear}-${selectedPeriod}`); } catch (e: any) { setError(e.message); } };

  const calcCredit = (s: Sale) => (s.dining_card||0)+(s.jahez_bistro||0)+(s.jahez_burger||0)+(s.keeta_bistro||0)+(s.keeta_burger||0)+(s.hunger_station_bistro||0)+(s.hunger_station_burger||0)+(s.ninja||0);
  const calcTotal = (s: Sale) => (s.total_cash_sales||0) + calcCredit(s);
  const calcNet = (t: number) => t / 1.15;
  const calcVAT = (t: number) => t - calcNet(t);
  const calcAvg = (t: number, c: number) => c > 0 ? t / c : 0;
  const calcDiff = (t: number, p: number) => t - p;

  const filterByTime = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime()) || d.getFullYear() !== selectedYear) return false;
    if (selectedPeriod === 'all') return true;
    if (selectedPeriod.startsWith('Q')) return `Q${Math.floor(d.getMonth()/3)+1}` === selectedPeriod;
    return (d.getMonth()+1).toString().padStart(2,'0') === selectedPeriod;
  };

  const filteredSales = sales.filter(s => filterByTime(s.date) && s.date.includes(searchTerm));
  const filteredExpenses = expenses.filter(e => filterByTime(e.date) && ((e.supplier_name||'').toLowerCase().includes(searchTerm.toLowerCase()) || (e.item_name||'').toLowerCase().includes(searchTerm.toLowerCase()) || e.date.includes(searchTerm)));

  const totalSalesSum = filteredSales.reduce((a, s) => a + calcTotal(s), 0);
  const totalCashSalesSum = filteredSales.reduce((a, s) => a + (s.total_cash_sales||0), 0);
  const totalExpensesSum = filteredExpenses.reduce((a, e) => a + (e.total||0), 0);
  const totalCashExpensesSum = filteredExpenses.reduce((a, e) => a + (e.paid_by?.toUpperCase()==='CASH' ? (e.total||0) : 0), 0);

  const Dashboard = () => {
    const totalCustomers = filteredSales.reduce((a, s) => a + (s.num_customers||0), 0);
    const netSales = totalSalesSum / 1.15;
    const grossProfit = netSales - totalExpensesSum;
    const grossProfitMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
    const costRatio = netSales > 0 ? (totalExpensesSum / netSales) * 100 : 0;
    const channels = [
      { name: 'Dining (Cash)', value: filteredSales.reduce((a,s)=>a+(s.total_cash_sales||0),0) },
      { name: 'Dining (Card)', value: filteredSales.reduce((a,s)=>a+(s.dining_card||0),0) },
      { name: 'Jahez Bistro', value: filteredSales.reduce((a,s)=>a+(s.jahez_bistro||0),0) },
      { name: 'Jahez Burger', value: filteredSales.reduce((a,s)=>a+(s.jahez_burger||0),0) },
      { name: 'Keeta Bistro', value: filteredSales.reduce((a,s)=>a+(s.keeta_bistro||0),0) },
      { name: 'Keeta Burger', value: filteredSales.reduce((a,s)=>a+(s.keeta_burger||0),0) },
    ];
    const weeks = [{name:'Week 1 (1–7)',start:1,end:7},{name:'Week 2 (8–14)',start:8,end:14},{name:'Week 3 (15–21)',start:15,end:21},{name:'Week 4 (22–31)',start:22,end:31}].map(w => {
      const ws = filteredSales.filter(s => { const d=new Date(s.date).getDate(); return d>=w.start&&d<=w.end; });
      return { ...w, total: ws.reduce((a,s)=>a+calcTotal(s),0), customers: ws.reduce((a,s)=>a+(s.num_customers||0),0) };
    });
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-emerald-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl">
            <div className="relative z-10">
              <p className="text-stone-400 text-sm font-medium mb-1">Total Revenue</p>
              <h3 className="text-5xl font-light tracking-tight mb-6">SR {totalSalesSum.toLocaleString(undefined,{minimumFractionDigits:2})}</h3>
              <div className="flex gap-8">
                <div><p className="text-stone-500 text-[10px] uppercase tracking-widest font-bold mb-1">Net Sales</p><p className="text-lg font-medium">SR {netSales.toLocaleString(undefined,{minimumFractionDigits:2})}</p></div>
                <div><p className="text-stone-500 text-[10px] uppercase tracking-widest font-bold mb-1">Gross Profit</p><p className="text-lg font-medium text-emerald-400">SR {grossProfit.toLocaleString(undefined,{minimumFractionDigits:2})}</p></div>
              </div>
            </div>
            <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          </div>
          <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm flex flex-col justify-between">
            <div><p className="text-stone-400 text-sm font-medium mb-1">Efficiency</p><div className="flex items-end gap-2 mb-4"><span className="text-4xl font-light text-stone-900">{grossProfitMargin.toFixed(1)}%</span><span className="text-xs font-bold text-emerald-600 mb-1.5">Margin</span></div></div>
            <div className="space-y-4"><div className="flex items-center justify-between text-xs"><span className="text-stone-500">Cost Ratio</span><span className="font-bold text-rose-500">{costRatio.toFixed(1)}%</span></div><div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden"><div className="h-full bg-rose-500 rounded-full" style={{width:`${costRatio}%`}} /></div></div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm">
            <h4 className="text-sm font-bold text-stone-900 mb-8 flex items-center gap-2"><div className="w-1.5 h-1.5 bg-emerald-600 rounded-full" />Channel Performance</h4>
            <div className="space-y-6">{channels.map(c=>(
              <div key={c.name}><div className="flex justify-between text-xs mb-2"><span className="text-stone-500 font-medium">{c.name}</span><span className="text-stone-900 font-bold">SR {c.value.toLocaleString()}</span></div><div className="w-full h-1 bg-stone-50 rounded-full overflow-hidden"><div className="h-full bg-emerald-600 rounded-full" style={{width:`${totalSalesSum>0?(c.value/totalSalesSum)*100:0}%`}} /></div></div>
            ))}</div>
          </div>
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm"><p className="text-stone-400 text-xs font-bold uppercase tracking-wider mb-1">Total Customers</p><p className="text-3xl font-light text-stone-900">{totalCustomers.toLocaleString()}</p></div>
              <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm"><p className="text-stone-400 text-xs font-bold uppercase tracking-wider mb-1">Average Check</p><p className="text-3xl font-light text-stone-900">SR {(totalCustomers>0?totalSalesSum/totalCustomers:0).toFixed(2)}</p></div>
            </div>
            <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-stone-100"><h4 className="text-sm font-bold text-stone-900">Weekly Summary</h4></div>
              <table className="w-full text-left">
                <thead className="bg-stone-50/50 text-[10px] uppercase font-bold text-stone-400 tracking-widest"><tr><th className="px-8 py-4">Period</th><th className="px-8 py-4 text-right">Revenue</th><th className="px-8 py-4 text-right">Customers</th></tr></thead>
                <tbody className="divide-y divide-stone-100">{weeks.map(w=>(<tr key={w.name} className="hover:bg-stone-50/50 transition-colors"><td className="px-8 py-4 text-xs font-bold text-stone-900">{w.name}</td><td className="px-8 py-4 text-xs text-right font-mono text-stone-600">SR {w.total.toLocaleString()}</td><td className="px-8 py-4 text-xs text-right text-stone-500">{w.customers}</td></tr>))}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-emerald-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-stone-500 font-medium">Connecting to Firebase...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-rose-600 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-medium">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X size={16} /></button>
        </div>
      )}

      <nav className="fixed top-0 left-0 h-full w-64 bg-white border-r border-stone-200 p-6 z-10 hidden lg:block shadow-sm">
        <div className="flex items-center gap-3 mb-12 px-2">
          <div className="w-10 h-10 bg-emerald-900 rounded-xl flex items-center justify-center text-white shadow-lg"><LayoutDashboard size={24} /></div>
          <h1 className="text-xl font-bold tracking-tight">Al Kabir</h1>
        </div>
        <div className="space-y-2">
          {[{id:'dashboard',label:'Dashboard',icon:<TrendingUp size={20}/>},{id:'sales',label:'Daily Sales',icon:<LayoutDashboard size={20}/>},{id:'expenses',label:'Expenses',icon:<Receipt size={20}/>}].map(tab=>(
            <button key={tab.id} onClick={()=>setActiveTab(tab.id as any)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab===tab.id?'bg-emerald-900 text-white font-semibold shadow-md':'text-stone-500 hover:bg-stone-50'}`}>{tab.icon}<span>{tab.label}</span></button>
          ))}
          {userRole==='admin'&&(<button onClick={()=>setActiveTab('suppliers')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab==='suppliers'?'bg-emerald-900 text-white font-semibold shadow-md':'text-stone-500 hover:bg-stone-50'}`}><Users size={20}/><span>Suppliers</span></button>)}
        </div>
        <div className="absolute bottom-8 left-6 right-6 space-y-4">
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
            <div className="flex items-center gap-2 mb-2"><Shield size={14} className="text-stone-400"/><p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">User Role</p></div>
            <div className="flex items-center justify-between"><span className="text-sm font-bold capitalize">{userRole}</span><button onClick={()=>setUserRole(userRole==='admin'?'employee':'admin')} className="text-[10px] bg-stone-200 px-2 py-1 rounded font-bold hover:bg-stone-300">Switch</button></div>
          </div>
          <div className="p-4 bg-emerald-900 rounded-2xl text-white shadow-xl shadow-emerald-200">
            <p className="text-xs text-emerald-400/70 mb-1">{selectedPeriod==='all'?'Yearly':selectedPeriod.startsWith('Q')?'Quarterly':'Monthly'} Balance</p>
            <p className="text-xl font-bold">SR {(totalSalesSum-totalExpensesSum).toLocaleString()}</p>
          </div>
        </div>
      </nav>

      <main className="lg:pl-64 min-h-screen">
        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-stone-200 px-8 py-6 flex items-center justify-between z-10">
          <div><h2 className="text-2xl font-bold tracking-tight capitalize">{activeTab}</h2><p className="text-sm text-stone-500">Manage your restaurant's financial data</p></div>
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-white border border-stone-200 rounded-xl px-2 py-1 gap-2 shadow-sm">
              <Calendar size={16} className="text-stone-400 ml-1"/>
              <select value={selectedYear} onChange={e=>setSelectedYear(Number(e.target.value))} className="text-sm font-semibold bg-transparent border-none focus:ring-0 cursor-pointer">
                {[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
              </select>
              <div className="w-px h-4 bg-stone-200"/>
              <select value={selectedPeriod} onChange={e=>setSelectedPeriod(e.target.value)} className="text-sm font-semibold bg-transparent border-none focus:ring-0 cursor-pointer min-w-[120px]">
                <option value="all">Full Year</option>
                <optgroup label="Quarters">{['Q1','Q2','Q3','Q4'].map((q,i)=><option key={q} value={q}>{q} ({['Jan-Mar','Apr-Jun','Jul-Sep','Oct-Dec'][i]})</option>)}</optgroup>
                <optgroup label="Months">{['January','February','March','April','May','June','July','August','September','October','November','December'].map((m,i)=><option key={m} value={(i+1).toString().padStart(2,'0')}>{m}</option>)}</optgroup>
              </select>
            </div>
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18}/>
              <input type="text" placeholder="Search records..." className="pl-10 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-500/20 w-64 shadow-sm" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/>
            </div>
          </div>
        </header>

        <div className="p-8">
          {activeTab==='dashboard'?<Dashboard/>:(
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm"><div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg w-fit mb-4"><TrendingUp size={20}/></div><p className="text-stone-500 text-sm font-medium">Total Revenue</p><p className="text-2xl font-bold mt-1">SR {totalSalesSum.toLocaleString()}</p></div>
                <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm"><div className="p-2 bg-rose-50 text-rose-600 rounded-lg w-fit mb-4"><Receipt size={20}/></div><p className="text-stone-500 text-sm font-medium">Total Expenses</p><p className="text-2xl font-bold mt-1">SR {totalExpensesSum.toLocaleString()}</p></div>
                <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm"><div className="p-2 bg-blue-50 text-blue-600 rounded-lg w-fit mb-4"><DollarSign size={20}/></div><p className="text-stone-500 text-sm font-medium">Cash Balance</p><p className="text-2xl font-bold mt-1">SR {(monthlyOpeningCash+totalCashSalesSum-totalCashExpensesSum).toLocaleString()}</p></div>
              </div>

              {selectedPeriod!=='all'&&!selectedPeriod.startsWith('Q')&&(
                <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm mb-8">
                  <h3 className="text-lg font-bold flex items-center gap-2 mb-4"><Upload size={20} className="text-stone-600"/>Monthly Document Attachment</h3>
                  {attachments.length>0?(
                    <div className="space-y-4">{attachments.map(att=>(
                      <div key={att.id} className="flex items-center justify-between p-4 bg-stone-50 rounded-xl border border-stone-100">
                        <div className="flex items-center gap-3"><FileText size={24} className="text-stone-400"/><div><p className="font-bold text-sm">{att.file_name}</p><p className="text-[10px] text-stone-400 uppercase font-bold">Uploaded on {new Date(att.uploaded_at).toLocaleDateString()}</p></div></div>
                        <div className="flex items-center gap-2">
                          <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="p-2 text-stone-600 hover:bg-stone-200 rounded-lg"><ExternalLink size={18}/></a>
                          {userRole==='admin'&&<button onClick={()=>handleDeleteAttachment(att.id!)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={18}/></button>}
                        </div>
                      </div>
                    ))}</div>
                  ):(
                    <form onSubmit={handleUploadAttachment} className="flex items-center gap-4">
                      <input name="file_name" type="text" placeholder="File Name" required className="flex-1 px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none"/>
                      <input name="file_url" type="url" placeholder="PDF URL" required className="flex-1 px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none"/>
                      <button type="submit" className="px-6 py-2 bg-emerald-900 text-white rounded-xl font-bold text-sm hover:bg-emerald-800 flex items-center gap-2"><Upload size={16}/>Attach PDF</button>
                    </form>
                  )}
                </div>
              )}

              {activeTab==='expenses'&&selectedPeriod!=='all'&&!selectedPeriod.startsWith('Q')&&(
                <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm mb-8">
                  <h3 className="text-lg font-bold flex items-center gap-2 mb-6"><DollarSign size={20} className="text-emerald-600"/>Cash Reconciliation</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div className="space-y-1"><p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Monthly Opening Cash</p><input type="number" value={monthlyOpeningCash} onChange={e=>{const v=Number(e.target.value);setMonthlyOpeningCash(v);handleSaveMonthlyCash(v,monthlyClosingCash);}} className="text-xl font-bold w-full bg-transparent border-b-2 border-stone-100 focus:border-emerald-500 focus:outline-none"/></div>
                    <div className="space-y-1"><p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Total Cash In (Sales)</p><p className="text-xl font-bold text-emerald-600">SR {totalCashSalesSum.toLocaleString()}</p></div>
                    <div className="space-y-1"><p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Total Cash Out (Expenses)</p><p className="text-xl font-bold text-rose-600">SR {totalCashExpensesSum.toLocaleString()}</p></div>
                    <div className="space-y-1"><p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Monthly Closing Cash</p><input type="number" value={monthlyClosingCash} onChange={e=>{const v=Number(e.target.value);setMonthlyClosingCash(v);handleSaveMonthlyCash(monthlyOpeningCash,v);}} className="text-xl font-bold w-full bg-transparent border-b-2 border-stone-100 focus:border-emerald-500 focus:outline-none"/></div>
                  </div>
                  <div className="mt-6 pt-6 border-t border-stone-100 flex items-center justify-between">
                    <p className="text-sm font-medium text-stone-500">Expected Balance: <span className="text-stone-900 font-bold">SR {(monthlyOpeningCash+totalCashSalesSum-totalCashExpensesSum).toLocaleString()}</span></p>
                    <p className="text-sm font-medium text-stone-500">Difference: <span className={`font-bold ${((monthlyOpeningCash+totalCashSalesSum-totalCashExpensesSum)-monthlyClosingCash)===0?'text-emerald-600':'text-rose-600'}`}>SR {((monthlyOpeningCash+totalCashSalesSum-totalCashExpensesSum)-monthlyClosingCash).toLocaleString()}</span></p>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <form onSubmit={activeTab==='sales'?handleAddSale:activeTab==='expenses'?handleAddExpense:handleAddSupplier}>
                    <table className="w-full text-left border-collapse border border-stone-200">
                      <thead className="sticky top-0 z-10 bg-stone-50 shadow-sm">
                        {activeTab==='sales'?(<tr className="border-b border-stone-200">{['Date','Day','Dining(Cash)','Dining(Card)','Jahez Bis','Jahez Bur','Keeta Bis','Keeta Bur','Hunger Bis','Hunger Bur','Ninja','Credit','Total Sales','Net','VAT','Disc','Cust','Avg','POS','Diff','Actions'].map(h=><th key={h} className="px-2 py-3 text-[11px] font-bold text-stone-500 uppercase tracking-wider border border-stone-200 whitespace-nowrap">{h}</th>)}</tr>)
                        :activeTab==='expenses'?(<tr className="border-b border-stone-200">{['Date','Invoice #','Supplier','Item','VAT Number','Total','VAT (15%)','Net','Paid By','Actions'].map(h=><th key={h} className="px-3 py-3 text-xs font-bold text-stone-500 uppercase tracking-wider border border-stone-200">{h}</th>)}</tr>)
                        :(<tr className="border-b border-stone-200"><th className="px-3 py-3 text-xs font-bold text-stone-500 uppercase border border-stone-200" colSpan={2}>Supplier Name</th><th className="px-4 py-3 text-xs font-bold text-stone-500 uppercase border border-stone-200" colSpan={2}>VAT Number</th><th className="px-4 py-3 text-xs font-bold text-stone-500 uppercase text-center border border-stone-200" colSpan={2}>Actions</th></tr>)}
                      </thead>
                      <tbody className="divide-y divide-stone-100">

                        {activeTab==='sales'&&(<>
                          {filteredSales.map(sale=>{
                            const tc=calcCredit(sale), ts=calcTotal(sale), isEditing=editingSaleId===sale.id;
                            if(isEditing) return (
                              <tr key={sale.id} className="bg-emerald-50/50">
                                <td className="px-1 py-1 border border-stone-200"><input name="date" type="date" defaultValue={sale.date} required className="w-16 text-xs px-1 py-1 border border-emerald-200 rounded-md"/></td>
                                <td className="px-1 py-1 border border-stone-200 text-center text-[10px] text-stone-400">Auto</td>
                                {['dining_cash','dining_card','jahez_bistro','jahez_burger','keeta_bistro','keeta_burger','hunger_station_bistro','hunger_station_burger','ninja'].map(f=>(
                                  <td key={f} className="px-1 py-1 border border-stone-200"><input name={f} type="number" step="0.01" defaultValue={(sale as any)[f]} className="w-16 text-xs px-1 py-1 border border-emerald-200 rounded-md text-right"/></td>
                                ))}
                                <td colSpan={4} className="px-1 py-1 border border-stone-200 text-center text-[10px] text-stone-400">Calc</td>
                                <td className="px-1 py-1 border border-stone-200"><input name="discount" type="number" step="0.01" defaultValue={sale.discount} className="w-14 text-xs px-1 py-1 border border-emerald-200 rounded-md text-right"/></td>
                                <td className="px-1 py-1 border border-stone-200"><input name="num_customers" type="number" defaultValue={sale.num_customers} className="w-14 text-xs px-1 py-1 border border-emerald-200 rounded-md text-right"/></td>
                                <td className="px-1 py-1 border border-stone-200 text-center text-[10px] text-stone-400">Avg</td>
                                <td className="px-1 py-1 border border-stone-200"><input name="pos_closing_report" type="number" step="0.01" defaultValue={sale.pos_closing_report} className="w-16 text-xs px-1 py-1 border border-emerald-200 rounded-md text-right"/></td>
                                <td className="px-1 py-1 border border-stone-200 text-center text-[10px] text-stone-400">Diff</td>
                                <td className="px-1 py-1 border border-stone-200"><div className="flex gap-1 justify-center"><button type="submit" className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"><Save size={12}/></button><button type="button" onClick={()=>setEditingSaleId(null)} className="p-1 bg-stone-200 text-stone-600 rounded"><X size={12}/></button></div></td>
                              </tr>
                            );
                            return (
                              <tr key={sale.id} className="hover:bg-emerald-50/30 transition-colors group text-[11px] even:bg-stone-50/20">
                                <td className="px-2 py-2 font-medium border border-stone-200 whitespace-nowrap">{sale.date}</td>
                                <td className="px-2 py-2 text-stone-500 border border-stone-200">{sale.day}</td>
                                <td className="px-2 py-2 text-right font-mono font-bold border border-stone-200">{(sale.dining_cash||0).toFixed(2)}</td>
                                <td className="px-2 py-2 text-right font-mono border border-stone-200">{(sale.dining_card||0).toFixed(2)}</td>
                                <td className="px-2 py-2 text-right font-mono border border-stone-200">{(sale.jahez_bistro||0).toFixed(2)}</td>
                                <td className="px-2 py-2 text-right font-mono border border-stone-200">{(sale.jahez_burger||0).toFixed(2)}</td>
                                <td className="px-2 py-2 text-right font-mono border border-stone-200">{(sale.keeta_bistro||0).toFixed(2)}</td>
                                <td className="px-2 py-2 text-right font-mono border border-stone-200">{(sale.keeta_burger||0).toFixed(2)}</td>
                                <td className="px-2 py-2 text-right font-mono border border-stone-200">{(sale.hunger_station_bistro||0).toFixed(2)}</td>
                                <td className="px-2 py-2 text-right font-mono border border-stone-200">{(sale.hunger_station_burger||0).toFixed(2)}</td>
                                <td className="px-2 py-2 text-right font-mono border border-stone-200">{(sale.ninja||0).toFixed(2)}</td>
                                <td className="px-2 py-2 text-right font-mono bg-stone-50/50 border border-stone-200">{tc.toFixed(2)}</td>
                                <td className="px-2 py-2 text-right font-bold text-emerald-700 font-mono bg-emerald-50/50 border border-stone-200">{ts.toFixed(2)}</td>
                                <td className="px-2 py-2 text-right font-mono border border-stone-200">{calcNet(ts).toFixed(2)}</td>
                                <td className="px-2 py-2 text-right font-mono border border-stone-200">{calcVAT(ts).toFixed(2)}</td>
                                <td className="px-2 py-2 text-right font-mono border border-stone-200">{(sale.discount||0).toFixed(2)}</td>
                                <td className="px-2 py-2 text-right font-mono border border-stone-200">{sale.num_customers||0}</td>
                                <td className="px-2 py-2 text-right font-mono border border-stone-200">{calcAvg(ts,sale.num_customers).toFixed(2)}</td>
                                <td className="px-2 py-2 text-right font-mono border border-stone-200">{(sale.pos_closing_report||0).toFixed(2)}</td>
                                <td className={`px-2 py-2 text-right font-mono font-bold border border-stone-200 ${calcDiff(ts,sale.pos_closing_report)!==0?'text-rose-600':'text-stone-400'}`}>{calcDiff(ts,sale.pos_closing_report).toFixed(2)}</td>
                                <td className="px-2 py-2 text-center border border-stone-200"><div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button type="button" onClick={()=>setEditingSaleId(sale.id!)} className="p-1 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"><Edit2 size={12}/></button>{userRole==='admin'&&<button type="button" onClick={()=>handleDeleteSale(sale.id!)} className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded"><Trash2 size={12}/></button>}</div></td>
                              </tr>
                            );
                          })}
                          {isAddingSale?(
                            <tr className="bg-emerald-50/30">
                              <td className="px-1 py-1 border border-stone-200"><input name="date" type="date" required className="w-16 text-xs px-1 py-1 border border-stone-200 rounded-md"/></td>
                              <td className="px-1 py-1 border border-stone-200 text-center text-[10px] text-stone-400">Auto</td>
                              {['dining_cash','dining_card','jahez_bistro','jahez_burger','keeta_bistro','keeta_burger','hunger_station_bistro','hunger_station_burger','ninja'].map(f=>(
                                <td key={f} className="px-1 py-1 border border-stone-200"><input name={f} type="number" step="0.01" placeholder="0" className="w-16 text-xs px-1 py-1 border border-stone-200 rounded-md text-right"/></td>
                              ))}
                              <td colSpan={4} className="px-1 py-1 border border-stone-200 text-center text-[10px] text-stone-400">Calc</td>
                              <td className="px-1 py-1 border border-stone-200"><input name="discount" type="number" step="0.01" placeholder="0" className="w-14 text-xs px-1 py-1 border border-stone-200 rounded-md text-right"/></td>
                              <td className="px-1 py-1 border border-stone-200"><input name="num_customers" type="number" placeholder="0" className="w-14 text-xs px-1 py-1 border border-stone-200 rounded-md text-right"/></td>
                              <td className="px-1 py-1 border border-stone-200 text-center text-[10px] text-stone-400">Avg</td>
                              <td className="px-1 py-1 border border-stone-200"><input name="pos_closing_report" type="number" step="0.01" placeholder="0" className="w-16 text-xs px-1 py-1 border border-stone-200 rounded-md text-right"/></td>
                              <td className="px-1 py-1 border border-stone-200 text-center text-[10px] text-stone-400">Diff</td>
                              <td className="px-1 py-1 border border-stone-200"><div className="flex gap-1 justify-center"><button type="submit" className="p-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg"><Plus size={14}/></button><button type="button" onClick={()=>setIsAddingSale(false)} className="p-1.5 text-stone-400 hover:bg-stone-100 rounded-lg"><X size={14}/></button></div></td>
                            </tr>
                          ):(
                            <tr className="hover:bg-stone-50 cursor-pointer" onClick={()=>setIsAddingSale(true)}>
                              <td colSpan={21} className="px-4 py-3 text-center text-stone-400 text-sm italic"><div className="flex items-center justify-center gap-2"><Plus size={16}/><span>Add New Sale Line</span></div></td>
                            </tr>
                          )}
                        </>)}

                        {activeTab==='expenses'&&(<>
                          {filteredExpenses.map(expense=>{
                            const isEditing=editingExpenseId===expense.id;
                            if(isEditing) return (
                              <tr key={expense.id} className="bg-rose-50/30">
                                <td className="px-1 py-1 border border-stone-200"><input name="date" type="date" defaultValue={expense.date} required className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md"/></td>
                                <td className="px-1 py-1 border border-stone-200"><input name="invoice_number" type="text" defaultValue={expense.invoice_no} className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md"/></td>
                                <td className="px-1 py-1 border border-stone-200"><select name="supplier_id" defaultValue={expense.supplier_id} className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md"><option value="">Select</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></td>
                                <td className="px-1 py-1 border border-stone-200"><input name="item_name" type="text" defaultValue={expense.item_name} required className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md"/></td>
                                <td className="px-1 py-1 border border-stone-200"><input name="vat_number" type="text" defaultValue={expense.vat_number} className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md"/></td>
                                <td className="px-1 py-1 border border-stone-200"><input name="total" type="number" step="0.01" defaultValue={expense.total} required className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md text-right font-bold"/></td>
                                <td className="px-1 py-1 border border-stone-200 text-right text-[10px] text-stone-400">Auto</td>
                                <td className="px-1 py-1 border border-stone-200 text-right text-[10px] text-stone-400">Auto</td>
                                <td className="px-1 py-1 border border-stone-200"><select name="paid_by" defaultValue={expense.paid_by} className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md"><option>Cash</option><option>Card</option><option>Transfer</option><option>WISSAM</option></select></td>
                                <td className="px-1 py-1 border border-stone-200"><div className="flex gap-1 justify-center"><button type="submit" className="p-1 bg-emerald-600 text-white rounded"><Save size={12}/></button><button type="button" onClick={()=>setEditingExpenseId(null)} className="p-1 bg-stone-200 text-stone-600 rounded"><X size={12}/></button></div></td>
                              </tr>
                            );
                            return (
                              <tr key={expense.id} className="hover:bg-emerald-50/30 transition-colors group text-[11px] even:bg-stone-50/20">
                                <td className="px-4 py-2 font-medium border border-stone-200">{expense.date}</td>
                                <td className="px-4 py-2 text-stone-500 border border-stone-200">{expense.invoice_no}</td>
                                <td className="px-4 py-2 text-stone-700 border border-stone-200">{expense.supplier_name}</td>
                                <td className="px-4 py-2 text-stone-500 italic border border-stone-200">{expense.item_name}</td>
                                <td className="px-4 py-2 text-stone-500 border border-stone-200">{expense.vat_number}</td>
                                <td className="px-4 py-2 text-right font-bold text-rose-600 font-mono border border-stone-200 bg-stone-50">SR {(expense.total||0).toFixed(2)}</td>
                                <td className="px-4 py-2 text-right font-mono border border-stone-200">SR {(expense.vat_debit||0).toFixed(2)}</td>
                                <td className="px-4 py-2 text-right font-mono border border-stone-200">SR {(expense.total_debit||0).toFixed(2)}</td>
                                <td className="px-4 py-2 border border-stone-200"><span className="px-2 py-1 bg-stone-100 text-stone-600 rounded text-[10px] font-bold uppercase">{expense.paid_by}</span></td>
                                <td className="px-4 py-2 text-center border border-stone-200"><div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button type="button" onClick={()=>setEditingExpenseId(expense.id!)} className="p-1 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"><Edit2 size={12}/></button>{userRole==='admin'&&<button type="button" onClick={()=>handleDeleteExpense(expense.id!)} className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded"><Trash2 size={12}/></button>}</div></td>
                              </tr>
                            );
                          })}
                          {isAddingExpense?(
                            <tr className="bg-rose-50/30">
                              <td className="px-1 py-1 border border-stone-200"><input name="date" type="date" required className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md"/></td>
                              <td className="px-1 py-1 border border-stone-200"><input name="invoice_number" type="text" placeholder="Invoice #" className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md"/></td>
                              <td className="px-1 py-1 border border-stone-200"><select name="supplier_id" className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md"><option value="">Select Supplier</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></td>
                              <td className="px-1 py-1 border border-stone-200"><input name="item_name" type="text" placeholder="Item" required className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md"/></td>
                              <td className="px-1 py-1 border border-stone-200"><input name="vat_number" type="text" placeholder="VAT #" className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md"/></td>
                              <td className="px-1 py-1 border border-stone-200"><input name="total" type="number" step="0.01" placeholder="Total" required className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md text-right font-bold"/></td>
                              <td className="px-1 py-1 border border-stone-200 text-right text-[10px] text-stone-400">Auto</td>
                              <td className="px-1 py-1 border border-stone-200 text-right text-[10px] text-stone-400">Auto</td>
                              <td className="px-1 py-1 border border-stone-200"><select name="paid_by" className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md"><option>Cash</option><option>Card</option><option>Transfer</option><option>WISSAM</option></select></td>
                              <td className="px-1 py-1 border border-stone-200"><div className="flex gap-1 justify-center"><button type="submit" className="p-1.5 bg-rose-600 text-white hover:bg-rose-700 rounded-lg"><Plus size={14}/></button><button type="button" onClick={()=>setIsAddingExpense(false)} className="p-1.5 text-stone-400 hover:bg-stone-100 rounded-lg"><X size={14}/></button></div></td>
                            </tr>
                          ):(
                            <tr className="hover:bg-stone-50 cursor-pointer" onClick={()=>setIsAddingExpense(true)}>
                              <td colSpan={10} className="px-4 py-3 text-center text-stone-400 text-sm italic"><div className="flex items-center justify-center gap-2"><Plus size={16}/><span>Add New Expense Line</span></div></td>
                            </tr>
                          )}
                        </>)}

                        {activeTab==='suppliers'&&(<>
                          {suppliers.map(supplier=>(
                            <tr key={supplier.id} className="hover:bg-stone-50 transition-colors group text-[11px]">
                              <td className="px-4 py-2 border border-stone-200" colSpan={2}>{supplier.name}</td>
                              <td className="px-4 py-2 border border-stone-200" colSpan={2}>{supplier.vat_number}</td>
                              <td className="px-4 py-2 text-center border border-stone-200" colSpan={2}>{userRole==='admin'&&<button type="button" onClick={()=>handleDeleteSupplier(supplier.id!)} className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button>}</td>
                            </tr>
                          ))}
                          <tr className="bg-stone-50/50">
                            <td className="px-1 py-1 border border-stone-200" colSpan={2}><input name="supplier_name" type="text" placeholder="Supplier Name" required className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md"/></td>
                            <td className="px-1 py-1 border border-stone-200" colSpan={2}><input name="supplier_vat" type="text" placeholder="VAT Number" className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md"/></td>
                            <td className="px-1 py-1 border border-stone-200 text-center" colSpan={2}><button type="submit" className="p-1.5 bg-emerald-900 text-white hover:bg-emerald-800 rounded-lg"><Plus size={14}/></button></td>
                          </tr>
                        </>)}

                      </tbody>
                      <tfoot className="sticky bottom-0 z-10 bg-stone-50 font-bold text-[11px]">
                        <tr className="bg-stone-100/80">
                          <td colSpan={2} className="px-3 py-3 text-stone-500 uppercase tracking-wider border border-stone-200">Totals</td>
                          {activeTab==='sales'&&(()=>{
                            const s={
                              dc:filteredSales.reduce((a,r)=>a+(r.total_cash_sales||0),0),
                              dcard:filteredSales.reduce((a,r)=>a+(r.dining_card||0),0),
                              jb:filteredSales.reduce((a,r)=>a+(r.jahez_bistro||0),0),
                              jbg:filteredSales.reduce((a,r)=>a+(r.jahez_burger||0),0),
                              kb:filteredSales.reduce((a,r)=>a+(r.keeta_bistro||0),0),
                              kbg:filteredSales.reduce((a,r)=>a+(r.keeta_burger||0),0),
                              hb:filteredSales.reduce((a,r)=>a+(r.hunger_station_bistro||0),0),
                              hbg:filteredSales.reduce((a,r)=>a+(r.hunger_station_burger||0),0),
                              n:filteredSales.reduce((a,r)=>a+(r.ninja||0),0),
                            };
                            const credit=s.dcard+s.jb+s.jbg+s.kb+s.kbg+s.hb+s.hbg+s.n;
                            const ts=s.dc+credit;
                            const cust=filteredSales.reduce((a,r)=>a+(r.num_customers||0),0);
                            return(<>
                              {Object.values(s).map((v,i)=><td key={i} className="px-2 py-3 text-right border border-stone-200 font-mono">{v.toFixed(2)}</td>)}
                              <td className="px-2 py-3 text-right border border-stone-200 font-mono bg-stone-200/50">{credit.toFixed(2)}</td>
                              <td className="px-2 py-3 text-right border border-stone-200 font-mono bg-emerald-100/50 text-emerald-700">{ts.toFixed(2)}</td>
                              <td className="px-2 py-3 text-right border border-stone-200 font-mono">{(ts/1.15).toFixed(2)}</td>
                              <td className="px-2 py-3 text-right border border-stone-200 font-mono">{(ts-ts/1.15).toFixed(2)}</td>
                              <td className="px-2 py-3 text-right border border-stone-200 font-mono">{filteredSales.reduce((a,r)=>a+(r.discount||0),0).toFixed(2)}</td>
                              <td className="px-2 py-3 text-right border border-stone-200 font-mono">{cust}</td>
                              <td className="px-2 py-3 text-right border border-stone-200 font-mono">{(cust>0?ts/cust:0).toFixed(2)}</td>
                              <td className="px-2 py-3 text-right border border-stone-200 font-mono">{filteredSales.reduce((a,r)=>a+(r.pos_closing_report||0),0).toFixed(2)}</td>
                              <td className="px-2 py-3 text-right border border-stone-200 font-mono">{filteredSales.reduce((a,r)=>a+calcDiff(calcTotal(r),r.pos_closing_report),0).toFixed(2)}</td>
                              <td className="px-2 py-3 border border-stone-200"/>
                            </>);
                          })()}
                          {activeTab==='expenses'&&(<>
                            <td className="px-4 py-3 border border-stone-200" colSpan={3}/>
                            <td className="px-4 py-3 text-right border border-stone-200 font-mono text-rose-600">SR {filteredExpenses.reduce((a,e)=>a+(e.total||0),0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-right border border-stone-200 font-mono">SR {filteredExpenses.reduce((a,e)=>a+(e.vat_debit||0),0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-right border border-stone-200 font-mono">SR {filteredExpenses.reduce((a,e)=>a+(e.total_debit||0),0).toFixed(2)}</td>
                            <td className="px-4 py-3 border border-stone-200" colSpan={2}/>
                          </>)}
                          {activeTab==='suppliers'&&<td colSpan={4} className="px-4 py-3 border border-stone-200"/>}
                        </tr>
                      </tfoot>
                    </table>
                  </form>
                </div>
                {((activeTab==='sales'&&filteredSales.length===0)||(activeTab==='expenses'&&filteredExpenses.length===0))&&(
                  <div className="p-12 text-center"><div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-300"><FileText size={32}/></div><p className="text-stone-500 font-medium">No records found</p></div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
