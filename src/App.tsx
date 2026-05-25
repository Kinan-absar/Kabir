import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from './firebase';
import { doc, getDocFromCache, getDocFromServer } from 'firebase/firestore';
import { db } from './firebase';
import { 
  Plus, Trash2, LayoutDashboard, Receipt, TrendingUp, CreditCard,
  Calendar, DollarSign, Users, FileText, Search,
  Edit2, Save, X, Shield, LogOut, Download, Check, BookOpen, ChevronDown, ChevronUp
} from 'lucide-react';
import { Sale, Expense, Supplier, DAYS, MonthEntry, ExtraEntry, MonthOverrides } from './types';
import { EXPENSE_CATEGORIES } from './constants';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import {
  getSales, saveSale, deleteSale as deleteSaleDb,
  getExpenses, saveExpense, deleteExpense as deleteExpenseDb,
  getSuppliers, saveSupplier, deleteSupplier as deleteSupplierDb,
  getMonthlyCash, saveMonthlyCashData,
  getUserRole, UserRole,
  getManualMonths, saveManualMonth, deleteManualMonth,
  getExtraExpenses, saveExtraExpense, deleteExtraExpense,
  getMonthOverrides, saveMonthOverride,
} from './dataService';
import { exportSalesToExcel, exportExpensesToExcel } from './exportUtils';
import AuthScreen from './AuthScreen';
import Logo from './logo';

export default function App() {
  // ── Auth state ────────────────────────────────────────────────────────────
  const [authReady, setAuthReady]   = useState(false);
  const [user, setUser]             = useState<User | null>(null);
  const [userRole, setUserRole]     = useState<UserRole>('employee');

  // ── App state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'dashboard' | 'sales' | 'expenses' | 'suppliers' | 'accounts'>('sales');
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isAddingSale, setIsAddingSale] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingSupplierVat, setEditingSupplierVat] = useState<string>('');
  const [addingSupplierVat, setAddingSupplierVat] = useState<string>('');
  const [addingCategory, setAddingCategory] = useState<string>('');
  const [editingCategory, setEditingCategory] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedPeriod, setSelectedPeriod] = useState<string>((new Date().getMonth() + 1).toString().padStart(2, '0'));
  
  // ── Filter states ─────────────────────────────────────────────────────────
  const [expenseFilterSupplier, setExpenseFilterSupplier] = useState('');
  const [expenseFilterItem, setExpenseFilterItem] = useState('');
  const [expenseFilterPaidBy, setExpenseFilterPaidBy] = useState('');
  const [expenseFilterCategory, setExpenseFilterCategory] = useState('');
  const [expenseFilterSubCategory, setExpenseFilterSubCategory] = useState('');
  const [salesFilterCategory, setSalesFilterCategory] = useState('');
  
  const [addingHasVat, setAddingHasVat] = useState(true);
  const [editingHasVat, setEditingHasVat] = useState(true);

  const [monthlyOpeningCash, setMonthlyOpeningCash] = useState(0);
  const [monthlyClosingCash, setMonthlyClosingCash] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Listen to Firebase Auth state
  useEffect(() => {
    // Test connection to Firestore
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
          setError("Firebase is offline. Please check your connection or configuration.");
        }
      }
    };
    testConnection();

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const role = await getUserRole(firebaseUser.uid);
        setUserRole(role);
        setActiveTab(role === 'admin' ? 'accounts' : 'sales');
      } else {
        setUserRole('employee');
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Load data once the user is confirmed logged in
  useEffect(() => {
    if (!user) return;
    Promise.all([fetchSales(), fetchExpenses(), fetchSuppliers()]).finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (selectedPeriod !== 'all' && !selectedPeriod.startsWith('Q')) {
      fetchMonthlyCash(`${selectedYear}-${selectedPeriod}`);
    }
  }, [selectedYear, selectedPeriod]);

  const fetchSales = async () => { try { setSales(await getSales()); } catch (e: any) { setError('Failed to load sales: ' + e.message); } };
  const fetchExpenses = async () => { try { setExpenses(await getExpenses()); } catch (e: any) { setError('Failed to load expenses: ' + e.message); } };
  const fetchSuppliers = async () => { try { setSuppliers(await getSuppliers()); } catch (e: any) { setError('Failed to load suppliers: ' + e.message); } };
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
      date, day: DAYS[new Date(date).getDay()],
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
    const net = Number(fd.get('total_debit'));
    const hasVat = fd.get('has_vat') === 'on';
    const supplierId = fd.get('supplier_id') as string;
    const supplier = suppliers.find(s => s.id === supplierId);
    const expense: Expense = {
      date: fd.get('date') as string,
      invoice_no: fd.get('invoice_number') as string,
      supplier_id: supplierId,
      supplier_name: supplier ? supplier.name : (fd.get('supplier_name') as string || ''),
      item_name: fd.get('item_name') as string,
      vat_number: fd.get('vat_number') as string,
      total_debit: net,
      vat_debit: hasVat ? net * 0.15 : 0,
      total: hasVat ? net * 1.15 : net,
      has_vat: hasVat,
      credit: Number(fd.get('credit') || 0),
      total_w_vat_credit: Number(fd.get('total_w_vat_credit') || 0),
      paid_by: fd.get('paid_by') as string,
      category: fd.get('category') as string,
      sub_category: fd.get('sub_category') as string,
    };
    const id = (fd.get('id') as string) || editingExpenseId || undefined;
    try { await saveExpense(id ? { ...expense, id } : expense); setEditingExpenseId(null); setIsAddingExpense(false); setAddingSupplierVat(''); await fetchExpenses(); }
    catch (e: any) { setError('Failed to save expense: ' + e.message); }
  };



  const handleAddSupplier = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget; const fd = new FormData(form);
    try { await saveSupplier({ name: fd.get('supplier_name') as string, vat_number: fd.get('supplier_vat') as string }); await fetchSuppliers(); form.reset(); }
    catch (e: any) { setError('Failed to save supplier: ' + e.message); }
  };

  const handleDeleteSale = async (id: string) => { if (!confirm('Are you sure?')) return; try { await deleteSaleDb(id); await fetchSales(); } catch (e: any) { setError(e.message); } };
  const handleDeleteExpense = async (id: string) => { if (!confirm('Are you sure?')) return; try { await deleteExpenseDb(id); await fetchExpenses(); } catch (e: any) { setError(e.message); } };
  const handleDeleteSupplier = async (id: string) => { if (!confirm('Are you sure?')) return; try { await deleteSupplierDb(id); await fetchSuppliers(); } catch (e: any) { setError(e.message); } };

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

  const filteredSales = sales.filter(s => {
    const matchesTime = filterByTime(s.date);
    const matchesSearch = s.date.includes(searchTerm);
    const matchesCategory = !salesFilterCategory || (s as any)[salesFilterCategory] > 0;
    return matchesTime && matchesSearch && matchesCategory;
  });

  const filteredExpenses = expenses.filter(e => {
    const matchesTime = filterByTime(e.date);
    const matchesSearch = (
      (e.supplier_name||'').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (e.item_name||'').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (e.invoice_no||'').toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.date.includes(searchTerm)
    );
    const matchesSupplier = !expenseFilterSupplier || e.supplier_name === expenseFilterSupplier;
    const matchesItem = !expenseFilterItem || e.item_name === expenseFilterItem;
    const matchesPaidBy = !expenseFilterPaidBy || e.paid_by === expenseFilterPaidBy;
    const matchesCategory = !expenseFilterCategory || e.category === expenseFilterCategory;
    const matchesSubCategory = !expenseFilterSubCategory || e.sub_category === expenseFilterSubCategory;
    
    return matchesTime && matchesSearch && matchesSupplier && matchesItem && matchesPaidBy && matchesCategory && matchesSubCategory;
  });

  const totalSalesSum = filteredSales.reduce((a, s) => a + calcTotal(s), 0);
  const totalCashSalesSum = filteredSales.reduce((a, s) => a + (s.total_cash_sales||0), 0);
  const totalExpensesSum = filteredExpenses.reduce((a, e) => a + (e.total||0), 0);
  const totalExpensesExVatSum = filteredExpenses.reduce((a, e) => a + (e.total_debit||0), 0);
  const totalCashExpensesSum = filteredExpenses.reduce((a, e) => a + (e.paid_by?.toLowerCase()==='cash' ? (e.total||0) : 0), 0);

  // ── Accounts Tab ──────────────────────────────────────────────────────────
  const AccountsTab = () => {

    const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const MONTH_NAMES_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

    const DEFAULT_EXTRAS: ExtraEntry[] = [
      { name:'اللوحة والكلادينج',                    amount:21505 },
      { name:'الرخصة مع الرصيف',                     amount:10000 },
      { name:'الصحون وملحقاتها',                     amount:8000 },
      { name:'صيانة المكيفات',                       amount:3450 },
      { name:'متفرقات للصالة',                       amount:5000 },
      { name:'مكيف للمطبخ',                          amount:4600 },
      { name:'صيانة للمطعم',                         amount:5000 },
      { name:'نقل الكفالات والتجديد',                amount:123258 },
      { name:'تأمين الفيلا',                         amount:10000 },
      { name:'تأمين المطعم',                         amount:10000 },
      { name:'المنيو والباركود واللوحات على الكاشير', amount:5000 },
      { name:'طاولة الخدمة والكاشير والكرسي',        amount:3000 },
      { name:'فواتير الكهرباء للفيلا',               amount:2731 },
      { name:'فواتير الكهرباء للمطعم',               amount:12377.43 },
      { name:'عقد الصيانة والسلامة',                 amount:2000 },
      { name:'عقد رش المبيدات',                      amount:2000 },
      { name:'مبالغ نقدية بيد جان',                  amount:130000 },
      { name:'مبلغ نقدي بيد زياد (تساهيل)',           amount:5000 },
      { name:'مصاريف نقل المستودع',                  amount:3500 },
    ];

    // types are imported from types.ts
    // Overrides: fields an admin has manually edited on an auto row
    // type MonthOverrides is imported from types.ts

    // ── Persisted state (Now from Firestore) ────────────────────────────────
    const [overrides, setOverrides] = React.useState<Record<string, MonthOverrides>>({});
    const [manualMonths, setManualMonths] = React.useState<MonthEntry[]>([]);
    const [extras, setExtras] = React.useState<ExtraEntry[]>([]);
    const [acLoading, setAcLoading] = React.useState(true);

    // ── Load data ──────────────────────────────────────────────────────────
    React.useEffect(() => {
      const loadAcData = async () => {
        try {
          const [mn, ex, ov] = await Promise.all([
            getManualMonths(),
            getExtraExpenses(),
            getMonthOverrides(),
          ]);
          setManualMonths(mn);
          // Combine extras from Firestore and the default extras so that any defaults that aren't in Firestore yet are still shown.
          const firestoreNames = new Set(ex.map(item => item.name));
          const missingDefaults = DEFAULT_EXTRAS.filter(item => !firestoreNames.has(item.name));
          setExtras([...ex, ...missingDefaults]);
          setOverrides(ov);
        } catch (e) {
          console.error('Failed to load accounts data', e);
        } finally {
          setAcLoading(false);
        }
      };
      loadAcData();
    }, []);

    const saveOverridesData = async (key: string, data: MonthOverrides) => {
      const newOv = { ...overrides, [key]: data };
      setOverrides(newOv);
      await saveMonthOverride(key, data);
    };

    const saveManualMonthData = async (month: MonthEntry) => {
      const saved = await saveManualMonth(month);
      setManualMonths(prev => {
        const idx = prev.findIndex(m => m.key === saved.key);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = saved;
          return updated;
        }
        return [...prev, saved];
      });
    };

    const deleteManualMonthData = async (m: MonthEntry) => {
      if (m.id) await deleteManualMonth(m.id);
      setManualMonths(prev => prev.filter(item => item.key !== m.key));
    };

    const saveExtraData = async (extra: ExtraEntry) => {
      const saved = await saveExtraExpense(extra);
      setExtras(prev => {
        const idx = prev.findIndex(e => (e.id && e.id === saved.id) || e.name === saved.name);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = saved;
          return updated;
        }
        return [...prev, saved];
      });
    };

    const deleteExtraData = async (extra: ExtraEntry) => {
      if (extra.id) await deleteExtraExpense(extra.id);
      setExtras(prev => prev.filter(e => e.id !== extra.id || e.name !== extra.name));
    };

    // ── Build the YYYY-MM key for a date string ───────────────────────────
    const toKey = (dateStr: string) => dateStr.slice(0, 7);
    const keyToLabel = (key: string) => {
      const [y, m] = key.split('-');
      return `${MONTH_NAMES_AR[parseInt(m) - 1]} ${y}`;
    };

    // ── Aggregate Firestore sales by month ────────────────────────────────
    const firestoreByMonth = React.useMemo((): Record<string, { sales: number; hungr: number }> => {
      const map: Record<string, { sales: number; hungr: number }> = {};
      sales.forEach(s => {
        const key = toKey(s.date);
        if (!map[key]) map[key] = { sales: 0, hungr: 0 };
        const total = (s.total_cash_sales||0)+(s.dining_card||0)+(s.jahez_bistro||0)+(s.jahez_burger||0)+(s.keeta_bistro||0)+(s.keeta_burger||0)+(s.hunger_station_bistro||0)+(s.hunger_station_burger||0)+(s.ninja||0);
        const delivery = (s.jahez_bistro||0)+(s.jahez_burger||0)+(s.keeta_bistro||0)+(s.keeta_burger||0)+(s.hunger_station_bistro||0)+(s.hunger_station_burger||0)+(s.ninja||0);
        map[key].sales += total;
        map[key].hungr += delivery;
      });
      return map;
    }, [sales]);

    // ── Aggregate Firestore expenses ops by month (non-salary categories) ─
    const firestoreOpsbyMonth = React.useMemo(() => {
      const map: Record<string, number> = {};
      expenses.forEach(e => {
        const key = toKey(e.date);
        if (!map[key]) map[key] = 0;
        // Staff = tips/transport, NOT salaries. Everything except Staff & Utilities counted as ops.
        if (e.category !== 'Staff') map[key] += (e.total || 0);
      });
      return map;
    }, [expenses]);

    // ── Merge: auto (Firestore) + manual, apply overrides ──────────
    const mergedMonths = React.useMemo((): MonthEntry[] => {
      const all: Record<string, MonthEntry> = {};
      const fsMap = firestoreByMonth as Record<string, { sales: number; hungr: number }>;

      // 1. Auto rows from Firestore
      Object.entries(fsMap).forEach(([key, fs]) => {
        const fsOps = firestoreOpsbyMonth[key] || 0;
        const ovManualOps = overrides[key]?.manualOps || 0;
        all[key] = {
          key,
          month: keyToLabel(key),
          sales: fs.sales,
          hungr: fs.hungr,
          ops: fsOps + ovManualOps,
          rentR: 12458.3,
          rentV: 8333,
          rentS: 3100,
          salary: 0,
          source: 'auto',
          manualOps: ovManualOps,
        };
      });

      // 2. Manual months added by admin
      manualMonths.forEach(m => {
        if (!all[m.key]) {
          const fsOps = firestoreOpsbyMonth[m.key] || 0;
          const combinedOps = m.ops + fsOps; 
          all[m.key] = { ...m, ops: combinedOps, source: 'manual' };
        }
      });

      // 3. Apply overrides (admin edits on top of any source)
      Object.entries(overrides).forEach(([key, ov]) => {
        if (all[key]) {
          all[key] = { ...all[key], ...(ov as MonthOverrides) };
          // After applying overrides, re-ensure ops is the sum of Firestore + Manual
          const fsOps = firestoreOpsbyMonth[key] || 0;
          const manualPart = all[key].source === 'manual' ? all[key].ops : (all[key].manualOps || 0);
          // Wait, if source is manual, all[key].ops WAS m.ops + fsOps. 
          // This is getting confusing. Let's simplify:
          // A MonthEntry's 'ops' should ALWAYS be the final display value.
          // For auto: ops = firestoreOpsbyMonth + manualOps override
          // For manual: ops = manual input ops + firestoreOpsbyMonth (if any)
        }
      });

      // Final pass to ensure 'ops' is always correctly aggregated for display
      Object.values(all).forEach(m => {
        const fsOps = firestoreOpsbyMonth[m.key] || 0;
        if (m.source === 'auto') {
          m.ops = fsOps + (m.manualOps || 0);
        } else {
          // For manual sources, 'ops' initially entered by user is the manual part
          // But we want to show it combined if there happens to be Firestore data for that manual key
          // Actually, if it's manual, we'll assume the user-entered 'ops' is the base.
          // If Firestore data exists for that month, we add it. 
          // Wait, manualMonths logic already did: ops = m.ops + fsOps (line 373-374)
        }
      });

      return Object.values(all).sort((a, b) => a.key.localeCompare(b.key));
    }, [firestoreByMonth, firestoreOpsbyMonth, manualMonths, overrides]);

    // Filter out hidden rows
    const visibleMonths = React.useMemo(() => {
      return mergedMonths.filter(m => !(overrides[m.key] as any)?._hidden);
    }, [mergedMonths, overrides]);

    // ── Calculations ───────────────────────────────────────────────────────
    const extrasByMonth = React.useMemo(() => {
      const map: Record<string, number> = {};
      extras.forEach(e => {
        if (e.month_key) {
          map[e.month_key] = (map[e.month_key] || 0) + (e.amount || 0);
        }
      });
      return map;
    }, [extras]);

    const calcMonth = (m: MonthEntry) => {
      const disc    = m.hungr * 0.4;
      const net     = m.sales - disc;
      const monthExtras = extrasByMonth[m.key] || 0;
      const totalEx = m.ops + m.rentR + m.rentV + m.rentS + m.salary + monthExtras;
      const profit  = net - totalEx;
      return { disc, net, totalEx, profit, monthExtras };
    };

    const grandTotals = mergedMonths.reduce((acc, m) => {
      const c = calcMonth(m);
      return { 
        sales: acc.sales+m.sales, 
        hungr: acc.hungr+m.hungr, 
        disc: acc.disc+c.disc, 
        net: acc.net+c.net, 
        totalEx: acc.totalEx+c.totalEx, 
        profit: acc.profit+c.profit,
        manualOps: acc.manualOps + (m.manualOps || 0)
      };
    }, { sales:0, hungr:0, disc:0, net:0, totalEx:0, profit:0, manualOps: 0 });

    const totalExtrasAmount = extras.reduce((sum, e) => sum + e.amount, 0);
    const unassignedExtrasAmount = extras.filter(e => !e.month_key).reduce((sum, e) => sum + e.amount, 0);
    const netProfitAfterExtras = grandTotals.profit - unassignedExtrasAmount;
    const totalVisibleExtrasAmount = visibleMonths.reduce((sum, m) => sum + (extrasByMonth[m.key] || 0), 0);
    const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits:0, maximumFractionDigits:0 });
    const fmtSAR = (n: number) => `SR ${fmt(n)}`;

    // ── UI state ───────────────────────────────────────────────────────────
    const [acPage, setAcPage] = React.useState<'overview'|'monthly'|'extras'|'add-month'|'add-extra'>('overview');
    const [editingKey, setEditingKey] = React.useState<string|null>(null);
    const [editForm, setEditForm] = React.useState<MonthEntry | null>(null);
    const [addMonthForm, setAddMonthForm] = React.useState<MonthEntry>({ key:'', month:'', sales:0, hungr:0, ops:0, rentR:12458.3, rentV:8333, rentS:3100, salary:0, source:'manual' });
    const [editingExtraIdx, setEditingExtraIdx] = React.useState<number|null>(null);
    const [extraForm, setExtraForm] = React.useState<ExtraEntry>({ name:'', amount:0, month_key:'' });
    const [addExtraForm, setAddExtraForm] = React.useState<ExtraEntry>({ name:'', amount:0, month_key:'' });

    // ── Month edit handlers ────────────────────────────────────────────────
    const startEdit = (m: MonthEntry) => { setEditForm({ ...m }); setEditingKey(m.key); };
    const saveEdit = async () => {
      if (!editForm || !editingKey) return;
      const base = mergedMonths.find(m => m.key === editingKey);
      if (!base) return;
      // Store only changed fields as overrides
      const changed: MonthOverrides = { ...(overrides[editingKey] || {}) };
      (Object.keys(editForm) as (keyof MonthEntry)[]).forEach(f => {
        if (f === 'key' || f === 'source' || f === 'id') return;
        if ((editForm as any)[f] !== (base as any)[f]) (changed as any)[f] = (editForm as any)[f];
      });
      await saveOverridesData(editingKey, changed);
      setEditingKey(null);
      setEditForm(null);
    };
    const cancelEdit = () => { setEditingKey(null); setEditForm(null); };
    const deleteMonth = async (key: string, source: string) => {
      if (!confirm('Delete this month entry?')) return;
      // For manual months, remove from manualMonths
      if (source === 'manual') {
        const m = manualMonths.find(i => i.key === key);
        if (m) await deleteManualMonthData(m);
      }
      // For auto/seed, just clear overrides and the row stays (driven by data)
      // For seed rows with no Firestore data: hide by flagging in overrides
      const data = { ...(overrides[key] || {}), _hidden: true } as MonthOverrides;
      await saveOverridesData(key, data);
    };

    const handleAddMonth = async () => {
      if (!addMonthForm.month) return;
      const arToIdx: Record<string, number> = {};
      MONTH_NAMES_AR.forEach((n, i) => { arToIdx[n] = i + 1; });
      const parts = addMonthForm.month.split(' ');
      const arName = parts[0];
      const year = parts[1] || new Date().getFullYear().toString();
      const monthIdx = arToIdx[arName] || MONTH_NAMES.findIndex(n => n.toLowerCase().startsWith(arName.toLowerCase())) + 1;
      const key = monthIdx > 0 ? `${year}-${String(monthIdx).padStart(2, '0')}` : `manual-${Date.now()}`;

      await saveManualMonthData({ ...addMonthForm, key, source: 'manual' });
      setAddMonthForm({ key: '', month: '', sales: 0, hungr: 0, ops: 0, rentR: 12458.3, rentV: 8333, rentS: 3100, salary: 0, source: 'manual' });
      setAcPage('monthly');
    };

    // ── Extra handlers ─────────────────────────────────────────────────────
    const saveEditExtra = async () => {
      if (editingExtraIdx === null) return;
      await saveExtraData(extraForm);
      setEditingExtraIdx(null);
    };
    const handleAddExtra = async () => {
      if (!addExtraForm.name) return;
      await saveExtraData(addExtraForm);
      setAddExtraForm({ name: '', amount: 0, month_key: '' }); setAcPage('extras');
    };
    const deleteExtra = async (i: number) => {
      if (!confirm('Delete?')) return;
      await deleteExtraData(extras[i]);
    };

    const sourceBadge = (src: string) => {
      if (src==='auto') return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 ml-1">AUTO</span>;
      return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 ml-1">MANUAL</span>;
    };

    const fieldLabel = (f: string) => ({
      month:'Month Name', sales:'Total Sales', hungr:'Delivery Sales (Hunger/Keeta/Jahez)',
      ops:'Operations Expenses', rentR:'Restaurant Rent', rentV:'Villa Rent',
      rentS:"Chef's Apt Rent", salary:'Salaries',
    }[f] || f);

    const navItems = [
      { id:'overview',    label:'Overview',          icon:<TrendingUp size={15}/> },
      { id:'monthly',     label:'Monthly Data',      icon:<Calendar size={15}/> },
      { id:'extras',      label:'Extra Expenses',    icon:<Receipt size={15}/> },
      { id:'add-month',   label:'Add Month',         icon:<Plus size={15}/> },
      { id:'add-extra',   label:'Add Extra Expense', icon:<Plus size={15}/> },
    ];

    if (acLoading) return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-stone-500 text-sm font-medium">Loading accounts...</p>
        </div>
      </div>
    );

    return (
      <div className="flex gap-6 min-h-[70vh]">
        {/* Sidebar */}
        <div className="w-52 flex-shrink-0">
          <div className="bg-slate-900 rounded-2xl p-3 space-y-1 sticky top-24">
            <div className="px-3 pb-3 border-b border-white/10 mb-2">
              <p className="text-xs font-bold text-white">حسابات الكبير</p>
              <p className="text-[10px] text-slate-400">Financial Accounts</p>
            </div>
            {navItems.map(n => (
              <button key={n.id} onClick={() => setAcPage(n.id as any)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all
                  ${acPage===n.id?'bg-blue-600 text-white':'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                {n.icon}{n.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">

          {/* ── OVERVIEW ── */}
          {acPage==='overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  {label2:'Total Sales',   label:'إجمالي المبيعات', val:grandTotals.sales,  cls:'text-blue-700'},
                  {label2:'Net Sales',     label:'صافي المبيعات',   val:grandTotals.net,    cls:'text-emerald-700'},
                  {label2:'Total Profit',  label:'إجمالي الأرباح',  val:grandTotals.profit, cls:grandTotals.profit>=0?'text-emerald-700':'text-red-600'},
                  {label2:'Extra Expenses',label:'مصاريف إضافية',   val:totalExtrasAmount,  cls:'text-amber-600'},
                  {label2:'Net Total',     label:'الصافي النهائي',  val:netProfitAfterExtras, cls:netProfitAfterExtras>=0?'text-blue-700 font-black':'text-red-600 font-black'},
                ].map(kpi=>(
                  <div key={kpi.label2} className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
                    <p className="text-[10px] text-stone-400 font-semibold uppercase tracking-widest mb-0.5">{kpi.label2}</p>
                    <p className="text-xs text-stone-400 mb-2">{kpi.label}</p>
                    <p className={`text-lg font-bold ${kpi.cls}`}>{fmtSAR(kpi.val)}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-blue-600"/>
                    <h4 className="font-bold text-sm">Monthly Performance — الأداء الشهري</h4>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-bold">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">AUTO = from Firestore</span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">MANUAL = added by you</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-stone-50 text-[10px] uppercase text-stone-500 font-bold tracking-widest">
                      <tr>
                        <th className="px-5 py-3 text-left">الشهر</th>
                        <th className="px-5 py-3 text-left">المبيعات</th>
                        <th className="px-5 py-3 text-left">خصم 40%</th>
                        <th className="px-5 py-3 text-left">صافي</th>
                        <th className="px-5 py-3 text-left">مصاريف</th>
                        <th className="px-5 py-3 text-left">ربح/خسارة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {visibleMonths.map(m => {
                        const c = calcMonth(m);
                        return (
                          <tr key={m.key} className="hover:bg-stone-50 transition-colors">
                            <td className="px-5 py-3 font-semibold text-stone-800">{m.month}{sourceBadge(m.source)}</td>
                            <td className="px-5 py-3 font-mono text-stone-600">{fmtSAR(m.sales)}</td>
                            <td className="px-5 py-3 font-mono text-amber-600">({fmtSAR(c.disc)})</td>
                            <td className="px-5 py-3 font-mono text-blue-700">{fmtSAR(c.net)}</td>
                            <td className="px-5 py-3 font-mono text-red-600">({fmtSAR(c.totalEx)})</td>
                            <td className={`px-5 py-3 font-bold font-mono ${c.profit>=0?'text-emerald-700':'text-red-600'}`}>{fmtSAR(c.profit)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-900 text-white text-xs font-bold">
                      <tr>
                        <td className="px-5 py-3">الإجمالي</td>
                        <td className="px-5 py-3 font-mono">{fmtSAR(grandTotals.sales)}</td>
                        <td className="px-5 py-3 font-mono text-amber-300">({fmtSAR(grandTotals.disc)})</td>
                        <td className="px-5 py-3 font-mono text-blue-300">{fmtSAR(grandTotals.net)}</td>
                        <td className="px-5 py-3 font-mono text-red-300">({fmtSAR(grandTotals.totalEx)})</td>
                        <td className={`px-5 py-3 font-mono ${grandTotals.profit>=0?'text-green-300':'text-red-300'}`}>{fmtSAR(grandTotals.profit)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {extras.length>0&&(
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-amber-800">Extra / One-off Expenses — مصاريف إضافية</p>
                    <p className="text-2xl font-bold text-amber-700 mt-1">{fmtSAR(totalExtrasAmount)}</p>
                    <p className="text-xs text-amber-500 mt-1">{extras.length} items</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-amber-600">صافي بعد المصاريف الإضافية</p>
                    <p className={`text-2xl font-bold mt-1 ${netProfitAfterExtras>=0?'text-emerald-700':'text-red-600'}`}>
                      {fmtSAR(netProfitAfterExtras)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── MONTHLY DATA ── */}
          {acPage==='monthly' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-stone-900">Monthly Data — بيانات الأشهر</h3>
                <button onClick={()=>setAcPage('add-month')} className="flex items-center gap-1.5 text-xs font-bold bg-blue-600 text-white px-3 py-2 rounded-xl hover:bg-blue-700 transition-colors">
                  <Plus size={14}/>Add Month
                </button>
              </div>

              <div className="flex items-center gap-3 text-[10px] font-bold mb-1">
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">AUTO = live from Firestore</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">MANUAL = added by you</span>
              </div>

              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead className="bg-stone-50 text-[10px] uppercase text-stone-500 font-bold tracking-widest">
                    <tr>
                      <th className="px-4 py-3 text-left">Month</th>
                      <th className="px-4 py-3 text-left">Sales</th>
                      <th className="px-4 py-3 text-left">Net</th>
                      <th className="px-4 py-3 text-left">Profit</th>
                      <th className="px-4 py-3 text-left">Rent R</th>
                      <th className="px-4 py-3 text-left">Rent V</th>
                      <th className="px-4 py-3 text-left">Rent S</th>
                      <th className="px-4 py-3 text-left">Salaries</th>
                      <th className="px-4 py-3 text-left">Ops (FS)</th>
                      <th className="px-4 py-3 text-left">Extra (M)</th>
                      <th className="px-4 py-3 text-left text-amber-600">Extras (إضافي)</th>
                      <th className="px-4 py-3 text-left">Delivery</th>
                      <th className="px-4 py-3 text-left">Disc 40%</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {visibleMonths.map(m => {
                      const c = calcMonth(m);
                      const isEditing = editingKey === m.key;
                      const ef = editForm;
                      const ec = ef ? calcMonth(ef) : c;

                      if (isEditing && ef) return (
                        <tr key={m.key} className="bg-blue-50/60">
                          <td className="px-2 py-2">
                            <input type="text" value={ef.month}
                              onChange={e=>setEditForm(p=>p?{...p,month:e.target.value}:p)}
                              className="w-32 px-2 py-1.5 border border-blue-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"/>
                          </td>
                          <td className="px-2 py-2">
                             <input type="number" value={ef.sales}
                                onChange={e=>setEditForm(p=>p?{...p,sales:parseFloat(e.target.value)||0}:p)}
                                className="w-24 px-2 py-1.5 border border-blue-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"/>
                          </td>
                          <td className="px-2 py-2 font-mono text-xs text-blue-700">{fmtSAR(ec.net)}</td>
                          <td className={`px-2 py-2 font-bold font-mono text-xs ${ec.profit>=0?'text-emerald-700':'text-red-600'}`}>{fmtSAR(ec.profit)}</td>
                          {(['rentR','rentV','rentS','salary'] as (keyof MonthEntry)[]).map(f=>(
                            <td key={f} className="px-2 py-2">
                              <input type="number" value={(ef as any)[f]}
                                onChange={e=>setEditForm(p=>p?{...p,[f]:parseFloat(e.target.value)||0}:p)}
                                className="w-24 px-2 py-1.5 border border-blue-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"/>
                            </td>
                          ))}
                          <td className="px-2 py-2 text-xs font-mono text-stone-400">{fmtSAR(firestoreOpsbyMonth[m.key]||0)}</td>
                          <td className="px-2 py-2">
                             <input type="number" value={ef.manualOps||0}
                                onChange={e=>setEditForm(p=>p?{...p,manualOps:parseFloat(e.target.value)||0}:p)}
                                className="w-20 px-2 py-1.5 border border-blue-300 rounded-lg text-xs font-bold text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"/>
                          </td>
                          <td className="px-2 py-2 text-xs font-mono font-bold text-amber-600">{fmtSAR(extrasByMonth[m.key]||0)}</td>
                          <td className="px-2 py-2">
                             <input type="number" value={ef.hungr}
                                onChange={e=>setEditForm(p=>p?{...p,hungr:parseFloat(e.target.value)||0}:p)}
                                className="w-24 px-2 py-1.5 border border-blue-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"/>
                          </td>
                          <td className="px-2 py-2 font-mono text-xs text-amber-600">({fmtSAR(ec.disc)})</td>
                          <td className="px-2 py-2">
                            <div className="flex gap-1">
                              <button onClick={saveEdit} className="text-[10px] font-bold bg-blue-600 text-white px-2 py-1 rounded-lg hover:bg-blue-700">Save</button>
                              <button onClick={cancelEdit} className="text-[10px] font-bold bg-stone-200 text-stone-700 px-2 py-1 rounded-lg hover:bg-stone-300">Cancel</button>
                            </div>
                          </td>
                        </tr>
                      );

                      return (
                        <tr key={m.key} className="hover:bg-stone-50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-stone-800">{m.month}{sourceBadge(m.source)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-600">{fmtSAR(m.sales)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-blue-700">{fmtSAR(c.net)}</td>
                          <td className={`px-4 py-3 font-bold font-mono text-xs ${c.profit>=0?'text-emerald-700':'text-red-600'}`}>{fmtSAR(c.profit)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-600">{fmtSAR(m.rentR)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-600">{fmtSAR(m.rentV)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-600">{fmtSAR(m.rentS)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-600">{fmtSAR(m.salary)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-400 group relative">
                            {fmtSAR(firestoreOpsbyMonth[m.key]||0)}
                            {m.manualOps ? <span className="block text-[8px] text-blue-500 font-bold">+ {fmt(m.manualOps!)} manual</span> : null}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-blue-600 font-bold">{m.manualOps ? fmtSAR(m.manualOps) : '-'}</td>
                          <td className="px-4 py-3 font-mono text-xs text-amber-600 font-bold">{c.monthExtras ? fmtSAR(c.monthExtras) : '-'}</td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-500">{fmtSAR(m.hungr)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-amber-600">({fmtSAR(c.disc)})</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1.5">
                              <button onClick={()=>startEdit(m)} className="text-[10px] font-bold text-blue-600 hover:text-blue-800 px-2 py-1 rounded-lg hover:bg-blue-50">Edit</button>
                              <button onClick={()=>deleteMonth(m.key, m.source)} className="text-[10px] font-bold text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50">Del</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-900 text-white text-xs font-bold font-mono">
                    <tr>
                      <td className="px-4 py-3 font-sans">الإجمالي</td>
                      <td className="px-4 py-3">{fmtSAR(grandTotals.sales)}</td>
                      <td className="px-4 py-3 text-blue-300">{fmtSAR(grandTotals.net)}</td>
                      <td className={`px-4 py-3 ${grandTotals.profit>=0?'text-green-300':'text-red-300'}`}>{fmtSAR(grandTotals.profit)}</td>
                      <td colSpan={4} className="px-4 py-3"/>
                      <td className="px-4 py-3 text-stone-400">{fmtSAR(grandTotals.totalEx - grandTotals.manualOps - 0 /* rent totals */)}...</td>
                      <td className="px-4 py-3 text-blue-300">{fmtSAR(grandTotals.manualOps)}</td>
                      <td className="px-4 py-3 text-amber-300">{fmtSAR(totalVisibleExtrasAmount)}</td>
                      <td className="px-4 py-3">{fmtSAR(grandTotals.hungr)}</td>
                      <td className="px-4 py-3 text-amber-300">({fmtSAR(grandTotals.disc)})</td>
                      <td/>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ── EXTRA EXPENSES ── */}
          {acPage==='extras' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-stone-900">Extra / One-off Expenses — مصاريف إضافية</h3>
                  <p className="text-xs text-stone-400 mt-0.5">Total: <strong className="text-amber-700">{fmtSAR(totalExtrasAmount)}</strong></p>
                </div>
                <button onClick={()=>{setAddExtraForm({name:'',amount:0,month_key:''});setAcPage('add-extra');}}
                  className="flex items-center gap-1.5 text-xs font-bold bg-blue-600 text-white px-3 py-2 rounded-xl hover:bg-blue-700 transition-colors">
                  <Plus size={14}/>Add Item
                </button>
              </div>
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                {extras.map((ex, i) => {
                  const isEditing = editingExtraIdx===i;
                  return (
                    <div key={i} className="flex items-center gap-3 px-5 py-3 border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors">
                      {isEditing ? (
                        <>
                          <input type="text" value={extraForm.name} onChange={e=>setExtraForm(p=>({...p,name:e.target.value}))}
                            className="flex-1 px-2 py-1.5 border border-blue-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"/>
                          <select value={extraForm.month_key||''} onChange={e=>setExtraForm(p=>({...p,month_key:e.target.value}))}
                            className="w-40 px-2 py-1.5 border border-blue-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
                            <option value="">-- No Month (Unassigned) --</option>
                            {mergedMonths.map(m => (
                              <option key={m.key} value={m.key}>{m.month}</option>
                            ))}
                          </select>
                          <input type="number" value={extraForm.amount} onChange={e=>setExtraForm(p=>({...p,amount:parseFloat(e.target.value)||0}))}
                            className="w-28 px-2 py-1.5 border border-blue-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"/>
                          <button onClick={saveEditExtra} className="text-[10px] font-bold bg-blue-600 text-white px-2 py-1 rounded-lg">Save</button>
                          <button onClick={()=>setEditingExtraIdx(null)} className="text-[10px] font-bold bg-stone-200 text-stone-700 px-2 py-1 rounded-lg">Cancel</button>
                        </>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-stone-800">{ex.name}</p>
                              {ex.month_key ? (
                                <span className="text-[10px] bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold">
                                  {keyToLabel(ex.month_key)}
                                </span>
                              ) : (
                                <span className="text-[10px] bg-stone-100 text-stone-500 px-2.5 py-0.5 rounded-full font-medium">
                                  Unassigned
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="font-bold font-mono text-sm text-stone-800">{fmtSAR(ex.amount)}</p>
                          <button onClick={()=>{setExtraForm({month_key:'',...ex});setEditingExtraIdx(i);}} className="text-[10px] font-bold text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-50">Edit</button>
                          <button onClick={()=>deleteExtra(i)} className="text-[10px] font-bold text-red-500 px-2 py-1 rounded-lg hover:bg-red-50">Del</button>
                        </>
                      )}
                    </div>
                  );
                })}
                {extras.length>0&&(
                  <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Total المجموع</span>
                    <span className="font-bold font-mono">{fmtSAR(totalExtrasAmount)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── ADD MONTH ── */}
          {acPage==='add-month' && (
            <div className="max-w-xl">
              <h3 className="font-bold text-stone-900 mb-4">Add Month — إضافة شهر</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700 font-medium mb-4">
                Months with daily sales in Firestore appear automatically. Use this only for months not yet in the system.
              </div>
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4">
                {(['month','sales','hungr','rentR','rentV','rentS','salary','ops'] as (keyof MonthEntry)[]).map(f=>(
                  <div key={f}>
                    <label className="text-xs font-bold text-stone-600 block mb-1">{fieldLabel(f)}</label>
                    <input
                      type={f==='month'?'text':'number'}
                      placeholder={f==='month'?'e.g. يونيو 2026':'0'}
                      value={(addMonthForm as any)[f]}
                      onChange={e=>setAddMonthForm(p=>({...p,[f]:f==='month'?e.target.value:parseFloat(e.target.value)||0}))}
                      className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                ))}
                <div className="bg-stone-50 rounded-xl p-4 text-xs space-y-1 text-stone-600">
                  <p>Discount (40%): <strong>{fmtSAR(addMonthForm.hungr*0.4)}</strong></p>
                  <p>Net Sales: <strong>{fmtSAR(addMonthForm.sales-addMonthForm.hungr*0.4)}</strong></p>
                  <p>Total Expenses: <strong>{fmtSAR(addMonthForm.ops+addMonthForm.salary+addMonthForm.rentR+addMonthForm.rentV+addMonthForm.rentS)}</strong></p>
                  <p className={`font-bold ${(addMonthForm.sales-addMonthForm.hungr*0.4-addMonthForm.ops-addMonthForm.salary-addMonthForm.rentR-addMonthForm.rentV-addMonthForm.rentS)>=0?'text-emerald-700':'text-red-600'}`}>
                    Profit/Loss: {fmtSAR(addMonthForm.sales-addMonthForm.hungr*0.4-addMonthForm.ops-addMonthForm.salary-addMonthForm.rentR-addMonthForm.rentV-addMonthForm.rentS)}
                  </p>
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={()=>setAcPage('monthly')} className="flex-1 border border-stone-200 text-stone-600 text-sm font-semibold py-2 rounded-xl hover:bg-stone-50">Cancel</button>
                  <button onClick={handleAddMonth} className="flex-1 bg-blue-600 text-white text-sm font-bold py-2 rounded-xl hover:bg-blue-700">Save Month</button>
                </div>
              </div>
            </div>
          )}

          {/* ── ADD EXTRA ── */}
          {acPage==='add-extra' && (
            <div className="max-w-md">
              <h3 className="font-bold text-stone-900 mb-4">Add Extra Expense — إضافة بند مصاريف</h3>
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-stone-600 block mb-1">Name — اسم البند</label>
                  <input type="text" placeholder="e.g. صيانة المكيفات" value={addExtraForm.name}
                    onChange={e=>setAddExtraForm(p=>({...p,name:e.target.value}))}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-600 block mb-1">Month — الشهر المتعلق به</label>
                  <select value={addExtraForm.month_key||''}
                    onChange={e=>setAddExtraForm(p=>({...p,month_key:e.target.value}))}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
                    <option value="">-- No Month (Unassigned) --</option>
                    {mergedMonths.map(m => (
                      <option key={m.key} value={m.key}>{m.month}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-600 block mb-1">Amount SAR — المبلغ</label>
                  <input type="number" placeholder="0" value={addExtraForm.amount||''}
                    onChange={e=>setAddExtraForm(p=>({...p,amount:parseFloat(e.target.value)||0}))}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={()=>setAcPage('extras')} className="flex-1 border border-stone-200 text-stone-600 text-sm font-semibold py-2 rounded-xl hover:bg-stone-50">Cancel</button>
                  <button onClick={handleAddExtra} className="flex-1 bg-blue-600 text-white text-sm font-bold py-2 rounded-xl hover:bg-blue-700">Add Expense</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    );
  };

  const Dashboard = () => {
    const totalCustomers = filteredSales.reduce((a, s) => a + (s.num_customers||0), 0);
    const netSales = totalSalesSum / 1.15;
    const grossProfit = netSales - totalExpensesExVatSum;
    const grossProfitMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
    const costRatio = netSales > 0 ? (totalExpensesExVatSum / netSales) * 100 : 0;
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

    // ── Expense Analysis Data ──
    const supplierSpend = filteredExpenses.reduce((acc: Record<string, number>, curr) => {
      const name = curr.supplier_name || 'Unknown';
      acc[name] = (acc[name] || 0) + (curr.total || 0);
      return acc;
    }, {});

    const topSuppliersData = Object.entries(supplierSpend)
      .map(([name, value]): { name: string; value: number } => ({ name, value: value as number }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const categorySpend = filteredExpenses.reduce((acc: Record<string, number>, curr) => {
      const cat = curr.category || 'Uncategorized';
      acc[cat] = (acc[cat] || 0) + (curr.total || 0);
      return acc;
    }, {});

    const categoryData = Object.entries(categorySpend)
      .map(([name, value]): { name: string; value: number } => ({ name, value: value as number }))
      .sort((a, b) => b.value - a.value);

    const COLORS = ['#064e3b', '#065f46', '#047857', '#059669', '#10b981', '#34d399', '#6ee7b7'];

    // ── Daily Sales Report Data ──
    const dailyReport = filteredSales.map(s => {
      const keetaTotal = ((s.keeta_bistro || 0) + (s.keeta_burger || 0)) * 0.6;
      const hungerTotal = ((s.hunger_station_bistro || 0) + (s.hunger_station_burger || 0)) * 0.6;
      const jahezTotal = ((s.jahez_bistro || 0) + (s.jahez_burger || 0)) * 0.6;
      const otherTotal = (s.dining_cash || 0) + (s.dining_card || 0) + (s.ninja || 0);
      const adjustedTotal = otherTotal + keetaTotal + hungerTotal + jahezTotal;
      return {
        date: s.date,
        cash: s.dining_cash || 0,
        card: s.dining_card || 0,
        keeta: keetaTotal,
        hunger: hungerTotal,
        jahez: jahezTotal,
        total: adjustedTotal
      };
    }).sort((a, b) => b.date.localeCompare(a.date));

    return (
      <div className="space-y-8 pb-12">
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

        {/* Daily Sales Report Section */}
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-stone-100 flex items-center justify-between">
            <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <TrendingUp size={18} className="text-emerald-600" />
              Daily Sales Report (Adjusted)
            </h4>
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest bg-stone-50 px-3 py-1 rounded-full border border-stone-100">
              Keeta, Hunger & Jahez @ 60%
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-stone-50/50 text-[10px] uppercase font-bold text-stone-400 tracking-widest">
                <tr>
                  <th className="px-8 py-4">Date</th>
                  <th className="px-8 py-4 text-right">Cash</th>
                  <th className="px-8 py-4 text-right">Card</th>
                  <th className="px-8 py-4 text-right">Keeta (60%)</th>
                  <th className="px-8 py-4 text-right">Hunger (60%)</th>
                  <th className="px-8 py-4 text-right">Jahez (60%)</th>
                  <th className="px-8 py-4 text-right bg-emerald-50/50 text-emerald-700">Adj. Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 italic">
                {dailyReport.slice(0, 10).map(row => (
                  <tr key={row.date} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-8 py-4 text-xs font-bold text-stone-900">{row.date}</td>
                    <td className="px-8 py-4 text-xs text-right font-mono text-stone-600">SR {row.cash.toFixed(2)}</td>
                    <td className="px-8 py-4 text-xs text-right font-mono text-stone-600">SR {row.card.toFixed(2)}</td>
                    <td className="px-8 py-4 text-xs text-right font-mono text-stone-600">SR {row.keeta.toFixed(2)}</td>
                    <td className="px-8 py-4 text-xs text-right font-mono text-stone-600">SR {row.hunger.toFixed(2)}</td>
                    <td className="px-8 py-4 text-xs text-right font-mono text-stone-600">SR {row.jahez.toFixed(2)}</td>
                    <td className="px-8 py-4 text-xs text-right font-mono font-bold text-emerald-700 bg-emerald-50/30">SR {row.total.toFixed(2)}</td>
                  </tr>
                ))}
                {dailyReport.length === 0 && (
                  <tr><td colSpan={7} className="px-8 py-8 text-center text-stone-400 text-xs">No sales data for this period</td></tr>
                )}
              </tbody>
              {dailyReport.length > 0 && (
                <tfoot className="bg-stone-50/50 border-t border-stone-200">
                  <tr className="font-bold">
                    <td className="px-8 py-4 text-[10px] uppercase tracking-widest text-stone-500">Totals</td>
                    <td className="px-8 py-4 text-xs text-right font-mono text-stone-900">SR {dailyReport.reduce((a,b)=>a+b.cash,0).toFixed(2)}</td>
                    <td className="px-8 py-4 text-xs text-right font-mono text-stone-900">SR {dailyReport.reduce((a,b)=>a+b.card,0).toFixed(2)}</td>
                    <td className="px-8 py-4 text-xs text-right font-mono text-stone-900">SR {dailyReport.reduce((a,b)=>a+b.keeta,0).toFixed(2)}</td>
                    <td className="px-8 py-4 text-xs text-right font-mono text-stone-900">SR {dailyReport.reduce((a,b)=>a+b.hunger,0).toFixed(2)}</td>
                    <td className="px-8 py-4 text-xs text-right font-mono text-stone-900">SR {dailyReport.reduce((a,b)=>a+b.jahez,0).toFixed(2)}</td>
                    <td className="px-8 py-4 text-xs text-right font-mono text-emerald-700 bg-emerald-50/50">SR {dailyReport.reduce((a,b)=>a+b.total,0).toFixed(2)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Expense Analysis Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm">
            <h4 className="text-sm font-bold text-stone-900 mb-8 flex items-center gap-2">
              <Users size={18} className="text-stone-400" />
              Top Suppliers by Spend
            </h4>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topSuppliersData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f5f5f4" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={100} 
                    tick={{ fontSize: 10, fill: '#78716c' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f5f5f4' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                    formatter={(value: number) => [`SR ${value.toLocaleString()}`, 'Spend']}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                    {topSuppliersData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm">
            <h4 className="text-sm font-bold text-stone-900 mb-8 flex items-center gap-2">
              <Receipt size={18} className="text-stone-400" />
              Expenses by Category
            </h4>
            <div className="h-[280px] w-full flex flex-col md:flex-row items-center">
              <div className="h-full w-full md:w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                      formatter={(value: number) => [`SR ${value.toLocaleString()}`, 'Spend']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full md:w-1/2 space-y-2 mt-4 md:mt-0 max-h-[200px] overflow-y-auto pr-2">
                {categoryData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-stone-600 font-medium truncate max-w-[80px]">{item.name}</span>
                    </div>
                    <span className="text-stone-400 font-mono">SR {item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const SalesTotals = () => {
    const dc=filteredSales.reduce((a,r)=>a+(r.total_cash_sales||0),0);
    const dcard=filteredSales.reduce((a,r)=>a+(r.dining_card||0),0);
    const jb=filteredSales.reduce((a,r)=>a+(r.jahez_bistro||0),0);
    const jbg=filteredSales.reduce((a,r)=>a+(r.jahez_burger||0),0);
    const kb=filteredSales.reduce((a,r)=>a+(r.keeta_bistro||0),0);
    const kbg=filteredSales.reduce((a,r)=>a+(r.keeta_burger||0),0);
    const hb=filteredSales.reduce((a,r)=>a+(r.hunger_station_bistro||0),0);
    const hbg=filteredSales.reduce((a,r)=>a+(r.hunger_station_burger||0),0);
    const n=filteredSales.reduce((a,r)=>a+(r.ninja||0),0);
    const credit=dcard+jb+jbg+kb+kbg+hb+hbg+n;
    const ts=dc+credit;
    const cust=filteredSales.reduce((a,r)=>a+(r.num_customers||0),0);
    return (<>
      {[dc,dcard,jb,jbg,kb,kbg,hb,hbg,n].map((v,i)=><td key={i} className="px-2 py-3 text-right border border-stone-200 font-mono">{v.toFixed(2)}</td>)}
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
  };

  // ── Auth gate ─────────────────────────────────────────────────────────────
  if (!authReady) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-emerald-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user) return <AuthScreen />;

  if (loading) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-emerald-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-stone-500 font-medium">Loading data...</p>
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
        <div className="flex items-center gap-2 mb-12 px-2">
          <Logo size={56} />
          <div>
            <h1 className="text-lg font-black tracking-tight leading-tight">Al Kabir</h1>
            <p className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider">Bistro</p>
          </div>
        </div>
        <div className="space-y-2">
          {[{id:'sales',label:'Daily Sales',icon:<LayoutDashboard size={20}/>},{id:'expenses',label:'Expenses',icon:<Receipt size={20}/>},{id:'suppliers',label:'Suppliers',icon:<Users size={20}/>}].map(tab=>(
            <button key={tab.id} onClick={()=>setActiveTab(tab.id as any)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab===tab.id?'bg-emerald-900 text-white font-semibold shadow-md':'text-stone-500 hover:bg-stone-50'}`}>{tab.icon}<span>{tab.label}</span></button>
          ))}
          {userRole==='admin'&&(<button onClick={()=>setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab==='dashboard'?'bg-emerald-900 text-white font-semibold shadow-md':'text-stone-500 hover:bg-stone-50'}`}><TrendingUp size={20}/><span>Dashboard</span></button>)}
          {userRole==='admin'&&(<button onClick={()=>setActiveTab('accounts')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab==='accounts'?'bg-blue-700 text-white font-semibold shadow-md':'text-stone-500 hover:bg-stone-50'}`}><BookOpen size={20}/><span>Accounts</span></button>)}
        </div>
        <div className="absolute bottom-8 left-6 right-6 space-y-4">
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={14} className="text-stone-400"/>
              <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Signed In As</p>
            </div>
            <p className="text-xs font-semibold text-stone-700 truncate mb-1">{user.email}</p>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${userRole==='admin' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'}`}>{userRole}</span>
              <button
                onClick={() => signOut(auth)}
                className="flex items-center gap-1.5 text-[11px] font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg transition-colors"
              >
                <LogOut size={12}/> Sign Out
              </button>
            </div>
          </div>
          <div className="p-4 bg-emerald-900 rounded-2xl text-white shadow-xl shadow-emerald-200">
            <p className="text-xs text-emerald-400/70 mb-1">{selectedPeriod==='all'?'Yearly':selectedPeriod.startsWith('Q')?'Quarterly':'Monthly'} Balance</p>
            <p className="text-xl font-bold">SR {(totalSalesSum-totalExpensesSum).toLocaleString()}</p>
          </div>
        </div>
      </nav>

      <main className="lg:pl-64 min-h-screen">
        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-stone-200 px-8 py-6 z-10">
          <div className="flex items-center justify-between mb-4">
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
              {(activeTab === 'sales' || activeTab === 'expenses') && (
                <button
                  onClick={() => {
                    if (activeTab === 'sales') {
                      exportSalesToExcel(filteredSales, `Sales_${selectedYear}_${selectedPeriod}.xlsx`);
                    } else {
                      exportExpensesToExcel(filteredExpenses, `Expenses_${selectedYear}_${selectedPeriod}.xlsx`);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 rounded-xl text-sm font-semibold text-stone-700 hover:bg-stone-50 shadow-sm transition-all"
                  title="Export to Excel"
                >
                  <Download size={18} className="text-emerald-600" />
                  <span className="hidden sm:inline">Export</span>
                </button>
              )}
            </div>
          </div>

          {/* ── Additional Filters ── */}
          {(activeTab === 'sales' || activeTab === 'expenses') && (
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-stone-100">
              <div className="flex items-center gap-2 text-[10px] font-bold text-stone-400 uppercase tracking-widest mr-2">
                <FileText size={12} />
                Quick Filters:
              </div>
              
              {activeTab === 'sales' && (
                <select 
                  value={salesFilterCategory} 
                  onChange={e => setSalesFilterCategory(e.target.value)}
                  className="text-xs font-semibold bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5 focus:ring-0 cursor-pointer"
                >
                  <option value="">All Categories</option>
                  <option value="dining_cash">Dining (Cash)</option>
                  <option value="dining_card">Dining (Card)</option>
                  <option value="jahez_bistro">Jahez Bistro</option>
                  <option value="jahez_burger">Jahez Burger</option>
                  <option value="keeta_bistro">Keeta Bistro</option>
                  <option value="keeta_burger">Keeta Burger</option>
                  <option value="hunger_station_bistro">Hunger Station Bistro</option>
                  <option value="hunger_station_burger">Hunger Station Burger</option>
                  <option value="ninja">Ninja</option>
                </select>
              )}

              {activeTab === 'expenses' && (
                <>
                  <select 
                    value={expenseFilterSupplier} 
                    onChange={e => setExpenseFilterSupplier(e.target.value)}
                    className="text-xs font-semibold bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5 focus:ring-0 cursor-pointer max-w-[150px]"
                  >
                    <option value="">All Suppliers</option>
                    {Array.from(new Set(expenses.map(e => e.supplier_name))).filter(Boolean).sort().map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <select 
                    value={expenseFilterItem} 
                    onChange={e => setExpenseFilterItem(e.target.value)}
                    className="text-xs font-semibold bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5 focus:ring-0 cursor-pointer max-w-[150px]"
                  >
                    <option value="">All Items</option>
                    {Array.from(new Set(expenses.map(e => e.item_name))).filter(Boolean).sort().map(i => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                  <select 
                    value={expenseFilterPaidBy} 
                    onChange={e => setExpenseFilterPaidBy(e.target.value)}
                    className="text-xs font-semibold bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5 focus:ring-0 cursor-pointer"
                  >
                    <option value="">All Payment Methods</option>
                    <option value="Cash">Cash</option>
                    <option value="Transfer">Transfer</option>
                  </select>
                  <select 
                    value={expenseFilterCategory} 
                    onChange={e => {
                      setExpenseFilterCategory(e.target.value);
                      setExpenseFilterSubCategory('');
                    }}
                    className="text-xs font-semibold bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5 focus:ring-0 cursor-pointer"
                  >
                    <option value="">All Categories</option>
                    {Object.keys(EXPENSE_CATEGORIES).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {expenseFilterCategory && (
                    <select 
                      value={expenseFilterSubCategory} 
                      onChange={e => setExpenseFilterSubCategory(e.target.value)}
                      className="text-xs font-semibold bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5 focus:ring-0 cursor-pointer"
                    >
                      <option value="">All Sub-Categories</option>
                      {EXPENSE_CATEGORIES[expenseFilterCategory].map(sc => (
                        <option key={sc} value={sc}>{sc}</option>
                      ))}
                    </select>
                  )}
                </>
              )}

              {(salesFilterCategory || expenseFilterSupplier || expenseFilterItem || expenseFilterPaidBy || expenseFilterCategory || expenseFilterSubCategory || searchTerm) && (
                <button 
                  onClick={() => {
                    setSalesFilterCategory('');
                    setExpenseFilterSupplier('');
                    setExpenseFilterItem('');
                    setExpenseFilterPaidBy('');
                    setExpenseFilterCategory('');
                    setExpenseFilterSubCategory('');
                    setSearchTerm('');
                  }}
                  className="text-[10px] font-bold text-rose-500 hover:text-rose-700 uppercase tracking-widest flex items-center gap-1 px-2 py-1 rounded-md hover:bg-rose-50 transition-colors"
                >
                  <X size={10} /> Clear All
                </button>
              )}
            </div>
          )}
        </header>

        <div className="p-8">
          {activeTab==='dashboard'?<Dashboard/>:activeTab==='accounts'?<AccountsTab/>:(
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm"><div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg w-fit mb-4"><TrendingUp size={20}/></div><p className="text-stone-500 text-sm font-medium">Total Revenue</p><p className="text-2xl font-bold mt-1">SR {totalSalesSum.toLocaleString()}</p></div>
                <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm"><div className="p-2 bg-rose-50 text-rose-600 rounded-lg w-fit mb-4"><Receipt size={20}/></div><p className="text-stone-500 text-sm font-medium">Total Expenses</p><p className="text-2xl font-bold mt-1">SR {totalExpensesSum.toLocaleString()}</p></div>
                <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm"><div className="p-2 bg-blue-50 text-blue-600 rounded-lg w-fit mb-4"><DollarSign size={20}/></div><p className="text-stone-500 text-sm font-medium">Cash Balance</p><p className="text-2xl font-bold mt-1">SR {(monthlyOpeningCash+totalCashSalesSum-totalCashExpensesSum).toLocaleString()}</p></div>
              </div>

              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                {activeTab === 'expenses' && (
                  <div className="p-6 border-b border-stone-100 bg-stone-50/30">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2 uppercase tracking-wider">
                        <DollarSign size={16} className="text-emerald-600" />
                        Cash Reconciliation ({selectedPeriod === 'all' ? 'Full Year' : selectedPeriod})
                      </h3>
                      <div className="flex gap-2">
                        {!(selectedPeriod === 'all' || selectedPeriod.startsWith('Q')) ? (
                          <button 
                            onClick={() => handleSaveMonthlyCash(monthlyOpeningCash, monthlyClosingCash)}
                            className="text-[10px] font-bold bg-emerald-900 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-800 transition-colors uppercase tracking-widest"
                          >
                            Save Reconciliation
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold text-stone-400 italic px-3 py-1.5">
                            Select a month to save reconciliation
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Opening Cash</p>
                        <input 
                          type="number" 
                          value={monthlyOpeningCash} 
                          onChange={e => setMonthlyOpeningCash(Number(e.target.value))}
                          className="w-full text-sm font-bold bg-white border border-stone-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Cash Sales (+)</p>
                        <div className="w-full text-sm font-bold bg-stone-100 border border-stone-200 rounded-xl px-3 py-2 text-emerald-600">
                          SR {totalCashSalesSum.toLocaleString()}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Cash Expenses (-)</p>
                        <div className="w-full text-sm font-bold bg-stone-100 border border-stone-200 rounded-xl px-3 py-2 text-rose-600">
                          SR {totalCashExpensesSum.toLocaleString()}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Expected Cash</p>
                        <div className="w-full text-sm font-bold bg-stone-100 border border-stone-200 rounded-xl px-3 py-2 text-stone-900">
                          SR {(monthlyOpeningCash + totalCashSalesSum - totalCashExpensesSum).toLocaleString()}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Actual Cash</p>
                        <input 
                          type="number" 
                          value={monthlyClosingCash} 
                          onChange={e => setMonthlyClosingCash(Number(e.target.value))}
                          className="w-full text-sm font-bold bg-white border border-stone-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Difference</p>
                        <div className={`w-full text-sm font-bold border rounded-xl px-3 py-2 ${
                          (monthlyClosingCash - (monthlyOpeningCash + totalCashSalesSum - totalCashExpensesSum)) === 0 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                            : 'bg-rose-50 border-rose-200 text-rose-600'
                        }`}>
                          SR {(monthlyClosingCash - (monthlyOpeningCash + totalCashSalesSum - totalCashExpensesSum)).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <form onSubmit={activeTab==='sales'?handleAddSale:activeTab==='expenses'?handleAddExpense:handleAddSupplier}>
                    <table className="w-full text-left border-collapse border border-stone-200">
                      <thead className="sticky top-0 z-10 bg-stone-50 shadow-sm">
                        {activeTab==='sales'?(<tr className="border-b border-stone-200">{['Date','Day','Dining(Cash)','Dining(Card)','Jahez Bis','Jahez Bur','Keeta Bis','Keeta Bur','Hunger Bis','Hunger Bur','Ninja','Credit','Total Sales','Net','VAT','Disc','Cust','Avg','POS','Diff','Actions'].map(h=><th key={h} className="px-2 py-3 text-[11px] font-bold text-stone-500 uppercase tracking-wider border border-stone-200 whitespace-nowrap">{h}</th>)}</tr>)
                        :activeTab==='expenses'?(<tr className="border-b border-stone-200">{['Date','Invoice #','Supplier','Item','Category','Sub-Category','VAT Number','Net (ex. VAT)','VAT?','VAT (15%)','Total (inc. VAT)','Paid By','Actions'].map(h=><th key={h} className="px-3 py-3 text-xs font-bold text-stone-500 uppercase tracking-wider border border-stone-200 whitespace-nowrap">{h}</th>)}</tr>)
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
                                <td className="px-2 py-2 text-center border border-stone-200"><div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button type="button" onClick={()=>setEditingSaleId(sale.id!)} className="p-1 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"><Edit2 size={12}/></button><button type="button" onClick={()=>handleDeleteSale(sale.id!)} className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded"><Trash2 size={12}/></button></div></td>
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
                                <td className="px-1 py-1 border border-stone-200"><input id="edit-date" name="date" type="date" defaultValue={expense.date} required className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md"/></td>
                                <td className="px-1 py-1 border border-stone-200"><input id="edit-invoice" name="invoice_number" type="text" defaultValue={expense.invoice_no} className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md"/></td>
                                <td className="px-1 py-1 border border-stone-200">
                                  <select id="edit-supplier" name="supplier_id" defaultValue={expense.supplier_id} onChange={e => setEditingSupplierVat(suppliers.find(s=>s.id===e.target.value)?.vat_number ?? expense.vat_number ?? '')} className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md">
                                    <option value="">Select</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                                  </select>
                                </td>
                                <td className="px-1 py-1 border border-stone-200"><input id="edit-item" name="item_name" type="text" defaultValue={expense.item_name} required className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md"/></td>
                                <td className="px-1 py-1 border border-stone-200">
                                  <select id="edit-category" name="category" defaultValue={expense.category} onChange={e => setEditingCategory(e.target.value)} className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md">
                                    <option value="">Select</option>
                                    {Object.keys(EXPENSE_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                </td>
                                <td className="px-1 py-1 border border-stone-200">
                                  <select id="edit-sub-category" name="sub_category" defaultValue={expense.sub_category} className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md">
                                    <option value="">Select</option>
                                    {(editingCategory || expense.category) && EXPENSE_CATEGORIES[editingCategory || expense.category!]?.map(sc => <option key={sc} value={sc}>{sc}</option>)}
                                  </select>
                                </td>
                                <td className="px-1 py-1 border border-stone-200"><input id="edit-vat" name="vat_number" type="text" value={editingSupplierVat} onChange={e=>setEditingSupplierVat(e.target.value)} className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md"/></td>
                                <td className="px-1 py-1 border border-stone-200"><input id="edit-total" name="total_debit" type="number" step="0.01" defaultValue={expense.total_debit} required className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md text-right font-bold"/></td>
                                <td className="px-1 py-1 border border-stone-200 text-center">
                                  <input 
                                    id="edit-has-vat" 
                                    name="has_vat" 
                                    type="checkbox" 
                                    defaultChecked={expense.has_vat !== false} 
                                    className="w-4 h-4 text-emerald-600 border-stone-300 rounded focus:ring-emerald-500"
                                  />
                                </td>
                                <td className="px-1 py-1 border border-stone-200 text-right text-[10px] text-stone-400">Auto</td>
                                <td className="px-1 py-1 border border-stone-200 text-right text-[10px] text-stone-400">Auto</td>
                                <td className="px-1 py-1 border border-stone-200"><select id="edit-paid" name="paid_by" defaultValue={expense.paid_by} className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md"><option>Cash</option><option>Transfer</option></select></td>
                                <td className="px-1 py-1 border border-stone-200"><div className="flex gap-1 justify-center">
                                  <button type="button" onClick={()=>{
                                    const net = Number((document.getElementById('edit-total') as HTMLInputElement)?.value);
                                    const hasVat = (document.getElementById('edit-has-vat') as HTMLInputElement)?.checked;
                                    const supplierId = (document.getElementById('edit-supplier') as HTMLSelectElement)?.value;
                                    const supplier = suppliers.find(s=>s.id===supplierId);
                                    const updated: Expense = {
                                      date: (document.getElementById('edit-date') as HTMLInputElement)?.value,
                                      invoice_no: (document.getElementById('edit-invoice') as HTMLInputElement)?.value,
                                      supplier_id: supplierId,
                                      supplier_name: supplier?.name ?? expense.supplier_name,
                                      item_name: (document.getElementById('edit-item') as HTMLInputElement)?.value,
                                      category: (document.getElementById('edit-category') as HTMLSelectElement)?.value,
                                      sub_category: (document.getElementById('edit-sub-category') as HTMLSelectElement)?.value,
                                      vat_number: (document.getElementById('edit-vat') as HTMLInputElement)?.value,
                                      total_debit: net, 
                                      vat_debit: hasVat ? net * 0.15 : 0, 
                                      total: hasVat ? net * 1.15 : net,
                                      has_vat: hasVat,
                                      credit: expense.credit||0, total_w_vat_credit: expense.total_w_vat_credit||0,
                                      paid_by: (document.getElementById('edit-paid') as HTMLSelectElement)?.value,
                                    };
                                    saveExpense({...updated, id: expense.id}).then(()=>{setEditingExpenseId(null);setEditingSupplierVat('');fetchExpenses();}).catch((e:any)=>setError(e.message));
                                  }} className="p-1 bg-emerald-600 text-white rounded"><Save size={12}/></button>
                                  <button type="button" onClick={()=>{setEditingExpenseId(null);setEditingSupplierVat('');}} className="p-1 bg-stone-200 text-stone-600 rounded"><X size={12}/></button>
                                </div></td>
                              </tr>
                            );
                            return (
                              <tr key={expense.id} className="hover:bg-emerald-50/30 transition-colors group text-[11px] even:bg-stone-50/20">
                                <td className="px-4 py-2 font-medium border border-stone-200">{expense.date}</td>
                                <td className="px-4 py-2 text-stone-500 border border-stone-200">{expense.invoice_no}</td>
                                <td className="px-4 py-2 text-stone-700 border border-stone-200">{expense.supplier_name}</td>
                                <td className="px-4 py-2 text-stone-500 italic border border-stone-200">{expense.item_name}</td>
                                <td className="px-4 py-2 text-stone-500 border border-stone-200"><span className="px-2 py-0.5 bg-stone-100 text-stone-600 rounded text-[9px] font-bold uppercase">{expense.category}</span></td>
                                <td className="px-4 py-2 text-stone-500 border border-stone-200"><span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] font-bold uppercase">{expense.sub_category}</span></td>
                                <td className="px-4 py-2 text-stone-500 border border-stone-200">{expense.vat_number}</td>
                                <td className="px-4 py-2 text-right font-mono border border-stone-200">SR {(expense.total_debit||0).toFixed(2)}</td>
                                <td className="px-4 py-2 text-center border border-stone-200">
                                  <div className={`w-4 h-4 mx-auto rounded flex items-center justify-center ${expense.has_vat !== false ? 'bg-emerald-100 text-emerald-600' : 'bg-stone-100 text-stone-400'}`}>
                                    {expense.has_vat !== false ? <Check size={10} strokeWidth={4} /> : <X size={10} strokeWidth={4} />}
                                  </div>
                                </td>
                                <td className="px-4 py-2 text-right font-mono border border-stone-200">SR {(expense.vat_debit||0).toFixed(2)}</td>
                                <td className="px-4 py-2 text-right font-bold text-rose-600 font-mono border border-stone-200 bg-stone-50">SR {(expense.total||0).toFixed(2)}</td>
                                <td className="px-4 py-2 border border-stone-200"><span className="px-2 py-1 bg-stone-100 text-stone-600 rounded text-[10px] font-bold uppercase">{expense.paid_by}</span></td>
                                <td className="px-4 py-2 text-center border border-stone-200"><div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button type="button" onClick={()=>{setEditingExpenseId(expense.id!); setEditingSupplierVat(expense.vat_number||'');}} className="p-1 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"><Edit2 size={12}/></button><button type="button" onClick={()=>handleDeleteExpense(expense.id!)} className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded"><Trash2 size={12}/></button></div></td>
                              </tr>
                            );
                          })}
                          {isAddingExpense?(
                            <tr className="bg-rose-50/30">
                              <td className="px-1 py-1 border border-stone-200"><input name="date" type="date" required className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md"/></td>
                              <td className="px-1 py-1 border border-stone-200"><input name="invoice_number" type="text" placeholder="Invoice #" className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md"/></td>
                              <td className="px-1 py-1 border border-stone-200"><select name="supplier_id" onChange={e=>setAddingSupplierVat(suppliers.find(s=>s.id===e.target.value)?.vat_number||'')} className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md"><option value="">Select Supplier</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></td>
                              <td className="px-1 py-1 border border-stone-200"><input name="item_name" type="text" placeholder="Item" required className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md"/></td>
                              <td className="px-1 py-1 border border-stone-200">
                                <select name="category" onChange={e => setAddingCategory(e.target.value)} className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md">
                                  <option value="">Category</option>
                                  {Object.keys(EXPENSE_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </td>
                              <td className="px-1 py-1 border border-stone-200">
                                <select name="sub_category" className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md">
                                  <option value="">Sub-Category</option>
                                  {addingCategory && EXPENSE_CATEGORIES[addingCategory]?.map(sc => <option key={sc} value={sc}>{sc}</option>)}
                                </select>
                              </td>
                              <td className="px-1 py-1 border border-stone-200"><input name="vat_number" type="text" placeholder="VAT #" value={addingSupplierVat} onChange={e=>setAddingSupplierVat(e.target.value)} className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md"/></td>
                              <td className="px-1 py-1 border border-stone-200"><input name="total_debit" type="number" step="0.01" placeholder="Net amount" required className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md text-right font-bold"/></td>
                              <td className="px-1 py-1 border border-stone-200 text-center">
                                <input 
                                  name="has_vat" 
                                  type="checkbox" 
                                  defaultChecked={true} 
                                  className="w-4 h-4 text-emerald-600 border-stone-300 rounded focus:ring-emerald-500"
                                />
                              </td>
                              <td className="px-1 py-1 border border-stone-200 text-right text-[10px] text-stone-400">Auto</td>
                              <td className="px-1 py-1 border border-stone-200 text-right text-[10px] text-stone-400">Auto</td>
                              <td className="px-1 py-1 border border-stone-200"><select name="paid_by" className="w-full text-xs px-1 py-1 border border-stone-200 rounded-md"><option>Cash</option><option>Transfer</option></select></td>
                              <td className="px-1 py-1 border border-stone-200"><div className="flex gap-1 justify-center"><button type="submit" className="p-1.5 bg-rose-600 text-white hover:bg-rose-700 rounded-lg"><Plus size={14}/></button><button type="button" onClick={()=>setIsAddingExpense(false)} className="p-1.5 text-stone-400 hover:bg-stone-100 rounded-lg"><X size={14}/></button></div></td>
                            </tr>
                          ):(
                            <tr className="hover:bg-stone-50 cursor-pointer" onClick={()=>setIsAddingExpense(true)}>
                              <td colSpan={13} className="px-4 py-3 text-center text-stone-400 text-sm italic"><div className="flex items-center justify-center gap-2"><Plus size={16}/><span>Add New Expense Line</span></div></td>
                            </tr>
                          )}
                        </>)}

                        {activeTab==='suppliers'&&(<>
                          {suppliers.map(supplier=>(
                            <tr key={supplier.id} className="hover:bg-stone-50 transition-colors group text-[11px]">
                              <td className="px-4 py-2 border border-stone-200" colSpan={2}>{supplier.name}</td>
                              <td className="px-4 py-2 border border-stone-200" colSpan={2}>{supplier.vat_number}</td>
                              <td className="px-4 py-2 text-center border border-stone-200" colSpan={2}><button type="button" onClick={()=>handleDeleteSupplier(supplier.id!)} className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button></td>
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
                          {activeTab==='sales'&&<SalesTotals/>}
                          {activeTab==='expenses'&&(<>
                            <td className="px-4 py-3 border border-stone-200" colSpan={5}/>
                            <td className="px-4 py-3 text-right border border-stone-200 font-mono">SR {filteredExpenses.reduce((a,e)=>a+(e.total_debit||0),0).toFixed(2)}</td>
                            <td className="px-4 py-3 border border-stone-200"/>
                            <td className="px-4 py-3 text-right border border-stone-200 font-mono">SR {filteredExpenses.reduce((a,r)=>a+(r.vat_debit||0),0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-right border border-stone-200 font-mono text-rose-600">SR {filteredExpenses.reduce((a,e)=>a+(e.total||0),0).toFixed(2)}</td>
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