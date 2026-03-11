import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  LayoutDashboard, 
  Receipt, 
  TrendingUp, 
  ChevronRight, 
  ChevronDown,
  Calendar,
  DollarSign,
  Users,
  FileText,
  Search,
  Download
} from 'lucide-react';
import { Sale, Expense, DAYS } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'sales' | 'expenses'>('sales');
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isAddingSale, setIsAddingSale] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [monthlyOpeningCash, setMonthlyOpeningCash] = useState(0);
  const [dailyOpeningCash, setDailyOpeningCash] = useState(0);
  const [dailyClosingCash, setDailyClosingCash] = useState(0);
  const [monthlyClosingCash, setMonthlyClosingCash] = useState(0);

  useEffect(() => {
    fetchSales();
    fetchExpenses();
  }, []);

  useEffect(() => {
    if (selectedPeriod !== 'all' && !selectedPeriod.startsWith('Q')) {
      fetchMonthlyCash(`${selectedYear}-${selectedPeriod}`);
    }
  }, [selectedYear, selectedPeriod]);

  const fetchMonthlyCash = async (monthYear: string) => {
    const res = await fetch(`/api/monthly-cash/${monthYear}`);
    const data = await res.json();
    
    if (data.id) {
      setMonthlyOpeningCash(data.opening_cash);
      setMonthlyClosingCash(data.closing_cash);
    } else {
      // If no data for current month, try to get previous month's closing cash
      const [year, month] = monthYear.split('-').map(Number);
      let prevYear = year;
      let prevMonth = month - 1;
      if (prevMonth === 0) {
        prevMonth = 12;
        prevYear -= 1;
      }
      const prevMonthYear = `${prevYear}-${prevMonth.toString().padStart(2, '0')}`;
      const prevRes = await fetch(`/api/monthly-cash/${prevMonthYear}`);
      const prevData = await prevRes.json();
      
      setMonthlyOpeningCash(prevData.closing_cash || 0);
      setMonthlyClosingCash(0);
    }
  };

  const saveMonthlyCash = async (opening: number, closing: number) => {
    if (selectedPeriod === 'all' || selectedPeriod.startsWith('Q')) return;
    await fetch('/api/monthly-cash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        month_year: `${selectedYear}-${selectedPeriod}`,
        opening_cash: opening,
        closing_cash: closing
      })
    });
  };

  const fetchSales = async () => {
    const res = await fetch('/api/sales');
    const data = await res.json();
    setSales(data);
  };

  const fetchExpenses = async () => {
    const res = await fetch('/api/expenses');
    const data = await res.json();
    setExpenses(data);
  };

  const handleAddSale = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const date = formData.get('date') as string;
    const day = DAYS[new Date(date).getDay()];
    
    const sale: Sale = {
      date,
      day,
      opening_cash: 0,
      dining_cash: Number(formData.get('total_cash_sales')),
      total_cash_sales: Number(formData.get('total_cash_sales')),
      dining_card: Number(formData.get('dining_card')),
      jahez_bistro: Number(formData.get('jahez_bistro')),
      jahez_burger: Number(formData.get('jahez_burger')),
      keeta_bistro: Number(formData.get('keeta_bistro')),
      keeta_burger: Number(formData.get('keeta_burger')),
      hunger_station_bistro: Number(formData.get('hunger_station_bistro')),
      hunger_station_burger: Number(formData.get('hunger_station_burger')),
      ninja: Number(formData.get('ninja')),
      discount: Number(formData.get('discount')),
      num_customers: Number(formData.get('num_customers')),
      pos_closing_report: Number(formData.get('pos_closing_report')),
      closing_cash_actual: 0,
    };

    await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sale),
    });
    
    setIsAddingSale(false);
    fetchSales();
  };

  const handleAddExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const total_debit = Number(formData.get('total_debit'));
    const vat_debit = total_debit * 0.15; // Assuming 15% VAT
    const grand_total = total_debit + vat_debit;

    const expense: Expense = {
      date: formData.get('date') as string,
      invoice_no: formData.get('invoice_no') as string,
      supplier_name: formData.get('supplier_name') as string,
      item_name: formData.get('item_name') as string,
      vat_number: formData.get('vat_number') as string,
      total_debit,
      vat_debit,
      grand_total,
      credit: Number(formData.get('credit')),
      total_w_vat_credit: Number(formData.get('total_w_vat_credit')),
      paid_by: formData.get('paid_by') as string,
    };

    await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expense),
    });
    
    setIsAddingExpense(false);
    fetchExpenses();
  };

  const deleteSale = async (id: number) => {
    if (!confirm('Are you sure?')) return;
    await fetch(`/api/sales/${id}`, { method: 'DELETE' });
    fetchSales();
  };

  const deleteExpense = async (id: number) => {
    if (!confirm('Are you sure?')) return;
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    fetchExpenses();
  };

  const calculateTotalCredit = (sale: Sale) => {
    return (sale.dining_card || 0) + (sale.jahez_bistro || 0) + (sale.jahez_burger || 0) + (sale.keeta_bistro || 0) + 
           (sale.keeta_burger || 0) + (sale.hunger_station_bistro || 0) + (sale.hunger_station_burger || 0) + (sale.ninja || 0);
  };

  const calculateTotalSales = (sale: Sale) => {
    return (sale.total_cash_sales || 0) + calculateTotalCredit(sale);
  };

  const calculateNetSales = (totalSales: number) => {
    return (totalSales || 0) / 1.15;
  };

  const calculateVAT = (totalSales: number) => {
    return (totalSales || 0) - calculateNetSales(totalSales);
  };

  const calculateAvgCheck = (totalSales: number, customers: number) => {
    return (customers || 0) > 0 ? (totalSales || 0) / customers : 0;
  };

  const calculateDiff = (totalSales: number, posReport: number) => {
    return (totalSales || 0) - (posReport || 0);
  };

  const filterByTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;
    
    const year = date.getFullYear();
    if (year !== selectedYear) return false;

    if (selectedPeriod === 'all') return true;

    if (selectedPeriod.startsWith('Q')) {
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return `Q${quarter}` === selectedPeriod;
    }

    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return month === selectedPeriod;
  };

  const filteredSales = sales.filter(s => filterByTime(s.date) && s.date.includes(searchTerm));
  const filteredExpenses = expenses.filter(e => 
    filterByTime(e.date) && (
      (e.supplier_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
      (e.item_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      e.date.includes(searchTerm)
    )
  );

  const totalSalesSum = filteredSales.reduce((acc, s) => acc + calculateTotalSales(s), 0);
  const totalCashSalesSum = filteredSales.reduce((acc, s) => acc + (s.total_cash_sales || 0), 0);
  const totalExpensesSum = filteredExpenses.reduce((acc, e) => acc + e.grand_total, 0);
  const totalCashExpensesSum = filteredExpenses.reduce((acc, e) => acc + (e.paid_by === 'CASH' ? e.grand_total : 0), 0);

  return (
    <div className="min-h-screen bg-[#F5F5F4] text-[#1C1917] font-sans selection:bg-emerald-100">
      {/* Sidebar / Navigation */}
      <nav className="fixed top-0 left-0 h-full w-64 bg-white border-r border-stone-200 p-6 z-10 hidden lg:block">
        <div className="flex items-center gap-3 mb-12 px-2">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
            <TrendingUp size={24} />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">Al Kabir</h1>
            <p className="text-xs text-stone-500 font-medium uppercase tracking-wider">Bistro Manager</p>
          </div>
        </div>

        <div className="space-y-2">
          <button 
            onClick={() => setActiveTab('sales')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'sales' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-stone-500 hover:bg-stone-50'}`}
          >
            <LayoutDashboard size={20} />
            <span>Daily Sales</span>
          </button>
          <button 
            onClick={() => setActiveTab('expenses')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'expenses' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-stone-500 hover:bg-stone-50'}`}
          >
            <Receipt size={20} />
            <span>Expenses</span>
          </button>
        </div>

        <div className="absolute bottom-8 left-6 right-6">
          <div className="p-4 bg-stone-900 rounded-2xl text-white">
            <p className="text-xs text-stone-400 mb-1">
              {selectedPeriod === 'all' ? 'Yearly' : selectedPeriod.startsWith('Q') ? 'Quarterly' : 'Monthly'} Balance
            </p>
            <p className="text-xl font-bold">SR {(totalSalesSum - totalExpensesSum).toLocaleString()}</p>
            <div className="mt-4 h-1.5 bg-stone-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 w-2/3" />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="lg:pl-64 min-h-screen">
        <header className="sticky top-0 bg-[#F5F5F4]/80 backdrop-blur-md border-b border-stone-200 px-8 py-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {activeTab === 'sales' ? 'Sales Overview' : 'Purchase Records'}
            </h2>
            <p className="text-stone-500 text-sm">Manage your restaurant's financial data</p>
          </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center bg-white border border-stone-200 rounded-xl px-2 py-1 gap-2">
                <Calendar size={16} className="text-stone-400 ml-1" />
                <select 
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="text-sm font-semibold bg-transparent border-none focus:ring-0 cursor-pointer"
                >
                  {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <div className="w-px h-4 bg-stone-200" />
                <select 
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="text-sm font-semibold bg-transparent border-none focus:ring-0 cursor-pointer min-w-[120px]"
                >
                  <option value="all">Full Year</option>
                  <optgroup label="Quarters">
                    <option value="Q1">Q1 (Jan-Mar)</option>
                    <option value="Q2">Q2 (Apr-Jun)</option>
                    <option value="Q3">Q3 (Jul-Sep)</option>
                    <option value="Q4">Q4 (Oct-Dec)</option>
                  </optgroup>
                  <optgroup label="Months">
                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                      <option key={m} value={(i + 1).toString().padStart(2, '0')}>{m}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search records..." 
                  className="pl-10 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
        </header>

        <div className="p-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <TrendingUp size={20} />
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">+12.5%</span>
              </div>
              <p className="text-stone-500 text-sm font-medium">Total Revenue</p>
              <p className="text-2xl font-bold mt-1">SR {totalSalesSum.toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                  <Receipt size={20} />
                </div>
                <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-full">-4.2%</span>
              </div>
              <p className="text-stone-500 text-sm font-medium">Total Expenses</p>
              <p className="text-2xl font-bold mt-1">SR {totalExpensesSum.toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <DollarSign size={20} />
                </div>
              </div>
              <p className="text-stone-500 text-sm font-medium">Cash Balance</p>
              <p className="text-2xl font-bold mt-1">SR {(monthlyOpeningCash + totalCashSalesSum - totalCashExpensesSum).toLocaleString()}</p>
            </div>
          </div>

          {/* Cash Reconciliation Card - Only in Expenses Tab for specific months */}
          {activeTab === 'expenses' && selectedPeriod !== 'all' && !selectedPeriod.startsWith('Q') && (
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm mb-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <DollarSign size={20} className="text-emerald-600" />
                  Cash Reconciliation
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Monthly Opening Cash</p>
                  <input 
                    type="number" 
                    value={monthlyOpeningCash}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setMonthlyOpeningCash(val);
                      saveMonthlyCash(val, monthlyClosingCash);
                    }}
                    placeholder="0.00"
                    className="text-xl font-bold w-full bg-transparent border-b-2 border-stone-100 focus:border-emerald-500 focus:outline-none transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Total Cash In (Sales)</p>
                  <p className="text-xl font-bold text-emerald-600">SR {totalCashSalesSum.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Total Cash Out (Expenses)</p>
                  <p className="text-xl font-bold text-rose-600">SR {totalCashExpensesSum.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Monthly Closing Cash</p>
                  <input 
                    type="number" 
                    value={monthlyClosingCash}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setMonthlyClosingCash(val);
                      saveMonthlyCash(monthlyOpeningCash, val);
                    }}
                    placeholder="0.00"
                    className="text-xl font-bold w-full bg-transparent border-b-2 border-stone-100 focus:border-emerald-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-stone-100 flex items-center justify-between">
                <p className="text-sm font-medium text-stone-500">Expected Balance: <span className="text-stone-900 font-bold">SR {(monthlyOpeningCash + totalCashSalesSum - totalCashExpensesSum).toLocaleString()}</span></p>
                <p className="text-sm font-medium text-stone-500">Difference: <span className={`font-bold ${((monthlyOpeningCash + totalCashSalesSum - totalCashExpensesSum) - monthlyClosingCash) === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>SR {((monthlyOpeningCash + totalCashSalesSum - totalCashExpensesSum) - monthlyClosingCash).toLocaleString()}</span></p>
              </div>
            </div>
          )}

          {/* Data Table */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <form onSubmit={activeTab === 'sales' ? handleAddSale : handleAddExpense}>
                <table className="w-full text-left border-collapse border border-stone-200">
                  <thead className="sticky top-0 z-10 bg-stone-50 shadow-sm">
                    <tr className="border-b border-stone-200">
                      <th className="px-3 py-3 text-xs font-bold text-stone-500 uppercase tracking-wider border border-stone-200">Date</th>
                      {activeTab === 'sales' ? (
                        <>
                          <th className="px-2 py-3 text-[11px] font-bold text-stone-500 uppercase tracking-wider border border-stone-200">Day</th>
                          <th className="px-2 py-3 text-[11px] font-bold text-stone-500 uppercase tracking-wider text-right border border-stone-200">Total Cash</th>
                          <th className="px-2 py-3 text-[11px] font-bold text-stone-500 uppercase tracking-wider text-right border border-stone-200">Dining Card</th>
                          <th className="px-2 py-3 text-[11px] font-bold text-stone-500 uppercase tracking-wider text-right border border-stone-200">Jahez Bis</th>
                          <th className="px-2 py-3 text-[11px] font-bold text-stone-500 uppercase tracking-wider text-right border border-stone-200">Jahez Bur</th>
                          <th className="px-2 py-3 text-[11px] font-bold text-stone-500 uppercase tracking-wider text-right border border-stone-200">Keeta Bis</th>
                          <th className="px-2 py-3 text-[11px] font-bold text-stone-500 uppercase tracking-wider text-right border border-stone-200">Keeta Bur</th>
                          <th className="px-2 py-3 text-[11px] font-bold text-stone-500 uppercase tracking-wider text-right border border-stone-200">Hunger Bis</th>
                          <th className="px-2 py-3 text-[11px] font-bold text-stone-500 uppercase tracking-wider text-right border border-stone-200">Hunger Bur</th>
                          <th className="px-2 py-3 text-[11px] font-bold text-stone-500 uppercase tracking-wider text-right border border-stone-200">Ninja</th>
                          <th className="px-2 py-3 text-[11px] font-bold text-stone-500 uppercase tracking-wider text-right bg-stone-100 border border-stone-200">Credit</th>
                          <th className="px-2 py-3 text-[11px] font-bold text-emerald-700 uppercase tracking-wider text-right bg-emerald-50 border border-stone-200">Total Sales</th>
                          <th className="px-2 py-3 text-[11px] font-bold text-stone-500 uppercase tracking-wider text-right border border-stone-200">Net</th>
                          <th className="px-2 py-3 text-[11px] font-bold text-stone-500 uppercase tracking-wider text-right border border-stone-200">VAT</th>
                          <th className="px-2 py-3 text-[11px] font-bold text-stone-500 uppercase tracking-wider text-right border border-stone-200">Disc</th>
                          <th className="px-2 py-3 text-[11px] font-bold text-stone-500 uppercase tracking-wider text-right border border-stone-200">Cust</th>
                          <th className="px-2 py-3 text-[11px] font-bold text-stone-500 uppercase tracking-wider text-right border border-stone-200">Avg</th>
                          <th className="px-2 py-3 text-[11px] font-bold text-stone-500 uppercase tracking-wider text-right border border-stone-200">POS</th>
                          <th className="px-2 py-3 text-[11px] font-bold text-stone-500 uppercase tracking-wider text-right border border-stone-200">Diff</th>
                        </>
                      ) : (
                        <>
                          <th className="px-4 py-3 text-xs font-bold text-stone-500 uppercase tracking-wider border border-stone-200">Supplier</th>
                          <th className="px-4 py-3 text-xs font-bold text-stone-500 uppercase tracking-wider border border-stone-200">Item</th>
                          <th className="px-4 py-3 text-xs font-bold text-stone-500 uppercase tracking-wider border border-stone-200">VAT Number</th>
                          <th className="px-4 py-3 text-xs font-bold text-stone-500 uppercase tracking-wider text-right border border-stone-200">VAT</th>
                          <th className="px-4 py-3 text-xs font-bold text-stone-500 uppercase tracking-wider text-right border border-stone-200">Grand Total</th>
                          <th className="px-4 py-3 text-xs font-bold text-stone-500 uppercase tracking-wider border border-stone-200">Paid By</th>
                        </>
                      )}
                      <th className="px-4 py-3 text-xs font-bold text-stone-500 uppercase tracking-wider text-center border border-stone-200">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {activeTab === 'sales' ? (
                      <>
                        {filteredSales.map((sale) => {
                          const totalCredit = calculateTotalCredit(sale);
                          const totalSales = calculateTotalSales(sale);
                          const netSales = calculateNetSales(totalSales);
                          const vat = calculateVAT(totalSales);
                          const avgCheck = calculateAvgCheck(totalSales, sale.num_customers);
                          const diff = calculateDiff(totalSales, sale.pos_closing_report);

                          return (
                            <tr key={sale.id} className="hover:bg-emerald-50/30 transition-colors group text-[11px] even:bg-stone-50/20">
                              <td className="px-2 py-2 font-medium text-stone-900 whitespace-nowrap border border-stone-200">{sale.date}</td>
                              <td className="px-2 py-2 text-stone-500 border border-stone-200">{sale.day}</td>
                              <td className="px-2 py-2 text-right font-mono text-stone-600 font-bold border border-stone-200">{(sale.total_cash_sales || 0).toFixed(2)}</td>
                              <td className="px-2 py-2 text-right font-mono text-stone-600 border border-stone-200">{(sale.dining_card || 0).toFixed(2)}</td>
                              <td className="px-2 py-2 text-right font-mono text-stone-600 border border-stone-200">{(sale.jahez_bistro || 0).toFixed(2)}</td>
                              <td className="px-2 py-2 text-right font-mono text-stone-600 border border-stone-200">{(sale.jahez_burger || 0).toFixed(2)}</td>
                              <td className="px-2 py-2 text-right font-mono text-stone-600 border border-stone-200">{(sale.keeta_bistro || 0).toFixed(2)}</td>
                              <td className="px-2 py-2 text-right font-mono text-stone-600 border border-stone-200">{(sale.keeta_burger || 0).toFixed(2)}</td>
                              <td className="px-2 py-2 text-right font-mono text-stone-600 border border-stone-200">{(sale.hunger_station_bistro || 0).toFixed(2)}</td>
                              <td className="px-2 py-2 text-right font-mono text-stone-600 border border-stone-200">{(sale.hunger_station_burger || 0).toFixed(2)}</td>
                              <td className="px-2 py-2 text-right font-mono text-stone-600 border border-stone-200">{(sale.ninja || 0).toFixed(2)}</td>
                              <td className="px-2 py-2 text-right font-mono text-stone-600 bg-stone-50/50 font-bold border border-stone-200">{(totalCredit || 0).toFixed(2)}</td>
                              <td className="px-2 py-2 text-right font-bold text-emerald-700 font-mono bg-emerald-50/50 border border-stone-200">{(totalSales || 0).toFixed(2)}</td>
                              <td className="px-2 py-2 text-right font-mono text-stone-600 border border-stone-200">{(netSales || 0).toFixed(2)}</td>
                              <td className="px-2 py-2 text-right font-mono text-stone-600 border border-stone-200">{(vat || 0).toFixed(2)}</td>
                              <td className="px-2 py-2 text-right font-mono text-stone-600 border border-stone-200">{(sale.discount || 0).toFixed(2)}</td>
                              <td className="px-2 py-2 text-right font-mono text-stone-600 border border-stone-200">{sale.num_customers || 0}</td>
                              <td className="px-2 py-2 text-right font-mono text-stone-600 border border-stone-200">{(avgCheck || 0).toFixed(2)}</td>
                              <td className="px-2 py-2 text-right font-mono text-stone-600 border border-stone-200">{(sale.pos_closing_report || 0).toFixed(2)}</td>
                              <td className={`px-2 py-2 text-right font-mono font-bold border border-stone-200 ${diff !== 0 ? 'text-rose-600' : 'text-stone-400'}`}>
                                {(diff || 0).toFixed(2)}
                              </td>
                              <td className="px-2 py-2 text-center border border-stone-200">
                                <button 
                                  type="button"
                                  onClick={() => deleteSale(sale.id!)}
                                  className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all opacity-0 group-hover:opacity-100"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}

                        {/* Inline Add Row for Sales */}
                        {isAddingSale ? (
                          <tr className="bg-emerald-50/50">
                            <td className="px-1 py-1 border border-stone-200">
                              <input name="date" type="date" required className="w-full text-xs px-1 py-1 border border-emerald-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                            </td>
                            <td className="px-1 py-1 border border-stone-200 text-[10px] text-stone-400 italic text-center">Auto</td>
                            <td className="px-1 py-1 border border-stone-200">
                              <input name="total_cash_sales" type="number" step="0.01" placeholder="0" className="w-full text-xs px-1 py-1 border border-emerald-200 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                            </td>
                            <td className="px-1 py-1 border border-stone-200">
                              <input name="dining_card" type="number" step="0.01" placeholder="0" className="w-full text-xs px-1 py-1 border border-emerald-200 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                            </td>
                            <td className="px-1 py-1 border border-stone-200">
                              <input name="jahez_bistro" type="number" step="0.01" placeholder="0" className="w-full text-xs px-1 py-1 border border-emerald-200 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                            </td>
                            <td className="px-1 py-1 border border-stone-200">
                              <input name="jahez_burger" type="number" step="0.01" placeholder="0" className="w-full text-xs px-1 py-1 border border-emerald-200 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                            </td>
                            <td className="px-1 py-1 border border-stone-200">
                              <input name="keeta_bistro" type="number" step="0.01" placeholder="0" className="w-full text-xs px-1 py-1 border border-emerald-200 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                            </td>
                            <td className="px-1 py-1 border border-stone-200">
                              <input name="keeta_burger" type="number" step="0.01" placeholder="0" className="w-full text-xs px-1 py-1 border border-emerald-200 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                            </td>
                            <td className="px-1 py-1 border border-stone-200">
                              <input name="hunger_station_bistro" type="number" step="0.01" placeholder="0" className="w-full text-xs px-1 py-1 border border-emerald-200 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                            </td>
                            <td className="px-1 py-1 border border-stone-200">
                              <input name="hunger_station_burger" type="number" step="0.01" placeholder="0" className="w-full text-xs px-1 py-1 border border-emerald-200 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                            </td>
                            <td className="px-1 py-1 border border-stone-200">
                              <input name="ninja" type="number" step="0.01" placeholder="0" className="w-full text-xs px-1 py-1 border border-emerald-200 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                            </td>
                            <td className="px-1 py-1 border border-stone-200 text-right text-[10px] text-stone-400 italic">Calc</td>
                            <td className="px-1 py-1 border border-stone-200 text-right text-[10px] text-stone-400 italic">Calc</td>
                            <td className="px-1 py-1 border border-stone-200 text-right text-[10px] text-stone-400 italic">Calc</td>
                            <td className="px-1 py-1 border border-stone-200 text-right text-[10px] text-stone-400 italic">Calc</td>
                            <td className="px-1 py-1 border border-stone-200">
                              <input name="discount" type="number" step="0.01" placeholder="0" className="w-full text-xs px-1 py-1 border border-emerald-200 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                            </td>
                            <td className="px-1 py-1 border border-stone-200">
                              <input name="num_customers" type="number" placeholder="0" className="w-full text-xs px-1 py-1 border border-emerald-200 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                            </td>
                            <td className="px-1 py-1 border border-stone-200 text-right text-[10px] text-stone-400 italic">Calc</td>
                            <td className="px-1 py-1 border border-stone-200">
                              <input name="pos_closing_report" type="number" step="0.01" placeholder="0" className="w-full text-xs px-1 py-1 border border-emerald-200 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                            </td>
                            <td className="px-1 py-1 border border-stone-200 text-right text-[10px] text-stone-400 italic">Calc</td>
                            <td className="px-1 py-1 border border-stone-200 text-center flex items-center justify-center gap-1">
                              <button type="submit" className="p-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-all shadow-sm">
                                <Plus size={14} />
                              </button>
                              <button type="button" onClick={() => setIsAddingSale(false)} className="p-1.5 text-stone-400 hover:bg-stone-100 rounded-lg transition-all">
                                <ChevronDown size={14} className="rotate-90" />
                              </button>
                            </td>
                          </tr>
                        ) : (
                          <tr className="hover:bg-stone-50 transition-colors cursor-pointer" onClick={() => setIsAddingSale(true)}>
                            <td colSpan={21} className="px-4 py-3 text-center text-stone-400 text-sm font-medium italic">
                              <div className="flex items-center justify-center gap-2">
                                <Plus size={16} />
                                <span>Add New Sale Line</span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ) : (
                      <>
                        {filteredExpenses.map((expense) => (
                          <tr key={expense.id} className="hover:bg-emerald-50/30 transition-colors group text-[11px] even:bg-stone-50/20">
                            <td className="px-4 py-2 font-medium text-stone-900 border border-stone-200">{expense.date}</td>
                            <td className="px-4 py-2 text-stone-700 border border-stone-200">{expense.supplier_name}</td>
                            <td className="px-4 py-2 text-stone-500 italic border border-stone-200">{expense.item_name}</td>
                            <td className="px-4 py-2 text-stone-500 border border-stone-200">{expense.vat_number}</td>
                            <td className="px-4 py-2 text-right font-mono text-stone-600 border border-stone-200">SR {(expense.vat_debit || 0).toFixed(2)}</td>
                            <td className="px-4 py-2 text-right font-bold text-rose-600 font-mono border border-stone-200">SR {(expense.grand_total || 0).toFixed(2)}</td>
                            <td className="px-4 py-2 border border-stone-200">
                              <span className="px-2 py-1 bg-stone-100 text-stone-600 rounded text-[10px] font-bold uppercase tracking-wider">
                                {expense.paid_by}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-center border border-stone-200">
                              <button 
                                type="button"
                                onClick={() => deleteExpense(expense.id!)}
                                className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}

                        {/* Inline Add Row for Expenses */}
                        {isAddingExpense ? (
                          <tr className="bg-emerald-50/50">
                            <td className="px-2 py-1 border border-stone-200">
                              <input name="date" type="date" required className="w-full text-xs px-2 py-1.5 border border-emerald-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                            </td>
                            <td className="px-2 py-1 border border-stone-200">
                              <input name="supplier_name" type="text" required placeholder="Supplier" className="w-full text-xs px-2 py-1.5 border border-emerald-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                            </td>
                            <td className="px-2 py-1 border border-stone-200">
                              <input name="item_name" type="text" required placeholder="Item" className="w-full text-xs px-2 py-1.5 border border-emerald-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                            </td>
                            <td className="px-2 py-1 border border-stone-200">
                              <input name="vat_number" type="text" placeholder="VAT #" className="w-full text-xs px-2 py-1.5 border border-emerald-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                            </td>
                            <td className="px-2 py-1 border border-stone-200 text-right text-[11px] text-stone-400 italic">Auto (15%)</td>
                            <td className="px-2 py-1 border border-stone-200">
                              <input name="total_debit" type="number" step="0.01" required placeholder="Amount" className="w-full text-xs px-2 py-1.5 border border-emerald-200 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" />
                            </td>
                            <td className="px-2 py-1 border border-stone-200">
                              <select name="paid_by" className="w-full text-xs px-2 py-1.5 border border-emerald-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all">
                                <option value="WISSAM">WISSAM</option>
                                <option value="CASH">CASH</option>
                              </select>
                            </td>
                            <td className="px-2 py-1 border border-stone-200 text-center flex items-center justify-center gap-2">
                              <button type="submit" className="p-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-all shadow-sm">
                                <Plus size={14} />
                              </button>
                              <button type="button" onClick={() => setIsAddingExpense(false)} className="p-1.5 text-stone-400 hover:bg-stone-100 rounded-lg transition-all">
                                <ChevronDown size={14} className="rotate-90" />
                              </button>
                              {/* Hidden fields for Expense interface */}
                              <input type="hidden" name="invoice_no" value="" />
                              <input type="hidden" name="credit" value="0" />
                              <input type="hidden" name="total_w_vat_credit" value="0" />
                            </td>
                          </tr>
                        ) : (
                          <tr className="hover:bg-stone-50 transition-colors cursor-pointer" onClick={() => setIsAddingExpense(true)}>
                            <td colSpan={7} className="px-4 py-3 text-center text-stone-400 text-sm font-medium italic">
                              <div className="flex items-center justify-center gap-2">
                                <Plus size={16} />
                                <span>Add New Expense Line</span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )}
                  </tbody>
                  {/* Totals Row */}
                  <tfoot className="sticky bottom-0 z-10 bg-stone-50 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] font-bold text-[11px]">
                    <tr className="bg-stone-100/80 backdrop-blur-sm">
                      <td colSpan={2} className="px-3 py-3 text-stone-500 uppercase tracking-wider border border-stone-200">Totals</td>
                      {activeTab === 'sales' ? (
                        <>
                          <td className="px-2 py-3 text-right border border-stone-200 font-mono">{filteredSales.reduce((sum, s) => sum + (s.total_cash_sales || 0), 0).toFixed(2)}</td>
                          <td className="px-2 py-3 text-right border border-stone-200 font-mono">{filteredSales.reduce((sum, s) => sum + (s.dining_card || 0), 0).toFixed(2)}</td>
                          <td className="px-2 py-3 text-right border border-stone-200 font-mono">{filteredSales.reduce((sum, s) => sum + (s.jahez_bistro || 0), 0).toFixed(2)}</td>
                          <td className="px-2 py-3 text-right border border-stone-200 font-mono">{filteredSales.reduce((sum, s) => sum + (s.jahez_burger || 0), 0).toFixed(2)}</td>
                          <td className="px-2 py-3 text-right border border-stone-200 font-mono">{filteredSales.reduce((sum, s) => sum + (s.keeta_bistro || 0), 0).toFixed(2)}</td>
                          <td className="px-2 py-3 text-right border border-stone-200 font-mono">{filteredSales.reduce((sum, s) => sum + (s.keeta_burger || 0), 0).toFixed(2)}</td>
                          <td className="px-2 py-3 text-right border border-stone-200 font-mono">{filteredSales.reduce((sum, s) => sum + (s.hunger_station_bistro || 0), 0).toFixed(2)}</td>
                          <td className="px-2 py-3 text-right border border-stone-200 font-mono">{filteredSales.reduce((sum, s) => sum + (s.hunger_station_burger || 0), 0).toFixed(2)}</td>
                          <td className="px-2 py-3 text-right border border-stone-200 font-mono">{filteredSales.reduce((sum, s) => sum + (s.ninja || 0), 0).toFixed(2)}</td>
                          <td className="px-2 py-3 text-right border border-stone-200 font-mono bg-stone-200/50">
                            {filteredSales.reduce((sum, s) => {
                              const tc = (s.dining_card || 0) + (s.jahez_bistro || 0) + (s.jahez_burger || 0) + (s.keeta_bistro || 0) + (s.keeta_burger || 0) + (s.hunger_station_bistro || 0) + (s.hunger_station_burger || 0) + (s.ninja || 0);
                              return sum + tc;
                            }, 0).toFixed(2)}
                          </td>
                          <td className="px-2 py-3 text-right border border-stone-200 font-mono bg-emerald-100/50 text-emerald-700">
                            {filteredSales.reduce((sum, s) => {
                              const tc = (s.dining_card || 0) + (s.jahez_bistro || 0) + (s.jahez_burger || 0) + (s.keeta_bistro || 0) + (s.keeta_burger || 0) + (s.hunger_station_bistro || 0) + (s.hunger_station_burger || 0) + (s.ninja || 0);
                              return sum + (s.total_cash_sales || 0) + tc;
                            }, 0).toFixed(2)}
                          </td>
                          <td className="px-2 py-3 text-right border border-stone-200 font-mono">
                            {filteredSales.reduce((sum, s) => {
                              const tc = (s.dining_card || 0) + (s.jahez_bistro || 0) + (s.jahez_burger || 0) + (s.keeta_bistro || 0) + (s.keeta_burger || 0) + (s.hunger_station_bistro || 0) + (s.hunger_station_burger || 0) + (s.ninja || 0);
                              const ts = (s.total_cash_sales || 0) + tc;
                              return sum + (ts / 1.15);
                            }, 0).toFixed(2)}
                          </td>
                          <td className="px-2 py-3 text-right border border-stone-200 font-mono">
                            {filteredSales.reduce((sum, s) => {
                              const tc = (s.dining_card || 0) + (s.jahez_bistro || 0) + (s.jahez_burger || 0) + (s.keeta_bistro || 0) + (s.keeta_burger || 0) + (s.hunger_station_bistro || 0) + (s.hunger_station_burger || 0) + (s.ninja || 0);
                              const ts = (s.total_cash_sales || 0) + tc;
                              return sum + (ts - (ts / 1.15));
                            }, 0).toFixed(2)}
                          </td>
                          <td className="px-2 py-3 text-right border border-stone-200 font-mono">{filteredSales.reduce((sum, s) => sum + (s.discount || 0), 0).toFixed(2)}</td>
                          <td className="px-2 py-3 text-right border border-stone-200 font-mono">{filteredSales.reduce((sum, s) => sum + (s.num_customers || 0), 0)}</td>
                          <td className="px-2 py-3 text-right border border-stone-200 font-mono">
                            {(filteredSales.reduce((sum, s) => {
                              const tc = (s.dining_card || 0) + (s.jahez_bistro || 0) + (s.jahez_burger || 0) + (s.keeta_bistro || 0) + (s.keeta_burger || 0) + (s.hunger_station_bistro || 0) + (s.hunger_station_burger || 0) + (s.ninja || 0);
                              return sum + (s.total_cash_sales || 0) + tc;
                            }, 0) / (filteredSales.reduce((sum, s) => sum + (s.num_customers || 0), 0) || 1)).toFixed(2)}
                          </td>
                          <td className="px-2 py-3 text-right border border-stone-200 font-mono">{filteredSales.reduce((sum, s) => sum + (s.pos_closing_report || 0), 0).toFixed(2)}</td>
                          <td className="px-2 py-3 text-right border border-stone-200 font-mono">
                            {filteredSales.reduce((sum, s) => {
                              const tc = (s.dining_card || 0) + (s.jahez_bistro || 0) + (s.jahez_burger || 0) + (s.keeta_bistro || 0) + (s.keeta_burger || 0) + (s.hunger_station_bistro || 0) + (s.hunger_station_burger || 0) + (s.ninja || 0);
                              const ts = (s.total_cash_sales || 0) + tc;
                              return sum + (ts - (s.pos_closing_report || 0));
                            }, 0).toFixed(2)}
                          </td>
                          <td className="px-2 py-3 border border-stone-200"></td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 border border-stone-200" colSpan={2}></td>
                          <td className="px-4 py-3 text-right border border-stone-200 font-mono">SR {filteredExpenses.reduce((sum, e) => sum + (e.vat_debit || 0), 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right border border-stone-200 font-mono text-rose-600">SR {filteredExpenses.reduce((sum, e) => sum + (e.grand_total || 0), 0).toFixed(2)}</td>
                          <td className="px-4 py-3 border border-stone-200" colSpan={2}></td>
                        </>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </form>
            </div>
            {((activeTab === 'sales' && filteredSales.length === 0) || (activeTab === 'expenses' && filteredExpenses.length === 0)) && (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-300">
                  <FileText size={32} />
                </div>
                <p className="text-stone-500 font-medium">No records found matching your search</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modals removed in favor of inline adding */}
    </div>
  );
}
