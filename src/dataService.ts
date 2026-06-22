import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  deleteDoc,
  setDoc,
  updateDoc,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import {Sale, Expense, Supplier, MonthEntry, ExtraEntry, MonthOverride, MonthOverrides, ActivityLog, UserProfile} from './types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ── Activity Logs ──────────────────────────────────────────────────────────

export const createActivityLog = async (
  action: string,
  category: string,
  details: string,
  item_id?: string,
  transaction_date?: string
): Promise<void> => {
  try {
    const currentUser = auth.currentUser;
    const log: ActivityLog = {
      timestamp: new Date().toISOString(),
      user_email: currentUser?.email || 'unknown@example.com',
      user_id: currentUser?.uid || 'unknown-uid',
      action,
      category,
      details,
    };
    if (item_id !== undefined) {
      log.item_id = item_id;
    }
    if (transaction_date !== undefined) {
      log.transaction_date = transaction_date;
    }
    await addDoc(collection(db, 'activity_logs'), log);
  } catch (e) {
    console.error('Failed to write activity log', e);
  }
};

export const getActivityLogs = async (): Promise<ActivityLog[]> => {
  try {
    const snap = await getDocs(collection(db, 'activity_logs'));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as ActivityLog))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, 'activity_logs');
    return [];
  }
};

export const backfillHistoricalLogs = async (): Promise<{ count: number }> => {
  try {
    // 1. Fetch existing activity_logs to find which ones have item_ids so we avoid duplicates
    const logsSnap = await getDocs(collection(db, 'activity_logs'));
    const loggedIds = new Set<string>();
    const logTimestampsByItemId = new Map<string, string>();
    
    logsSnap.docs.forEach(doc => {
      const data = doc.data() as ActivityLog;
      if (data.item_id) {
        loggedIds.add(data.item_id);
        if (data.timestamp) {
          const prev = logTimestampsByItemId.get(data.item_id);
          if (!prev || data.timestamp < prev) {
            logTimestampsByItemId.set(data.item_id, data.timestamp);
          }
        }
      }
    });

    let backfilledCount = 0;
    const batchList: any[] = [];

    // 2. Backfill Sales
    const salesSnap = await getDocs(collection(db, 'sales'));
    for (const docSnap of salesSnap.docs) {
      const id = docSnap.id;
      const sale = docSnap.data() as any;
      const hasCreatedAt = !!(sale.created_at || sale.createdAt || sale.timestamp || sale.time);
      const timestamp = sale.created_at || sale.createdAt || sale.timestamp || sale.time || logTimestampsByItemId.get(id) || (sale.date ? `${sale.date}T12:00:00.000Z` : new Date().toISOString());

      // Permanently write created_at back to the sale document if missing
      if (!hasCreatedAt) {
        try {
          await updateDoc(doc(db, 'sales', id), { created_at: timestamp });
        } catch (err) {
          console.error(`Failed to write created_at back to sale document ${id}:`, err);
        }
      }

      if (!loggedIds.has(id)) {
        batchList.push({
          timestamp,
          user_email: 'historical-import@system.com',
          user_id: 'historical-import-uid',
          action: 'create',
          category: 'sale',
          details: `[Historical Log Sync] Recorded Daily Sale for transaction date ${sale.date} with total cash SR ${(sale.total_cash_sales || 0).toLocaleString()}`,
          item_id: id,
          transaction_date: sale.date
        });
      }
    }

    // 3. Backfill Expenses
    const expensesSnap = await getDocs(collection(db, 'expenses'));
    for (const docSnap of expensesSnap.docs) {
      const id = docSnap.id;
      const exp = docSnap.data() as any;
      const hasCreatedAt = !!(exp.created_at || exp.createdAt || exp.timestamp || exp.time);
      const timestamp = exp.created_at || exp.createdAt || exp.timestamp || exp.time || logTimestampsByItemId.get(id) || (exp.date ? `${exp.date}T12:00:00.000Z` : new Date().toISOString());

      // Permanently write created_at back to the expense document if missing
      if (!hasCreatedAt) {
        try {
          await updateDoc(doc(db, 'expenses', id), { created_at: timestamp });
        } catch (err) {
          console.error(`Failed to write created_at back to expense document ${id}:`, err);
        }
      }

      if (!loggedIds.has(id)) {
        batchList.push({
          timestamp,
          user_email: 'historical-import@system.com',
          user_id: 'historical-import-uid',
          action: 'create',
          category: 'expense',
          details: `[Historical Log Sync] Recorded Expense for transaction date ${exp.date}: ${exp.item_name || 'N/A'} from ${exp.supplier_name || 'N/A'} (Amount: SR ${(exp.total || 0).toLocaleString()})`,
          item_id: id,
          transaction_date: exp.date
        });
      }
    }

    // Write all logs to Firestore
    for (const log of batchList) {
      await addDoc(collection(db, 'activity_logs'), log);
      backfilledCount++;
    }

    return { count: backfilledCount };
  } catch (e) {
    console.error('Failed to backfill historical logs', e);
    throw e;
  }
};

// ── User Role ──────────────────────────────────────────────────────────────
// Reads /users/{uid} document with field: role = 'admin' | 'employee'
export type UserRole = 'admin' | 'employee';

export const getUserRole = async (uid: string): Promise<UserRole> => {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const role = snap.data().role;
      if (role === 'admin' || role === 'employee') return role;
    }
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, `users/${uid}`);
  }
  return 'employee'; // safest default
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const data = snap.data();
      return {
        id: snap.id,
        email: data.email || '',
        role: data.role || 'employee',
        allowedTabs: data.allowedTabs || [],
        name: data.name || '',
        created_at: data.created_at || undefined,
      } as UserProfile;
    }
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, `users/${uid}`);
  }
  return null;
};

export const saveUserProfile = async (profile: UserProfile): Promise<void> => {
  try {
    const { id, ...data } = profile;
    const cleanData: Record<string, any> = {};
    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined) {
        cleanData[key] = val;
      }
    });
    await setDoc(doc(db, 'users', id), {
      ...cleanData,
      updated_at: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `users/${profile.id}`);
  }
};

export const getAllUserProfiles = async (): Promise<UserProfile[]> => {
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        email: data.email || '',
        role: data.role || 'employee',
        allowedTabs: data.allowedTabs || [],
        name: data.name || '',
        created_at: data.created_at || undefined,
      } as UserProfile;
    });
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, 'users');
    return [];
  }
};

export const deleteUserProfile = async (uid: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `users/${uid}`);
  }
};

// ── Sales ──────────────────────────────────────────────────────────────────

export const getSales = async (): Promise<Sale[]> => {
  try {
    const snap = await getDocs(collection(db, 'sales'));
    return snap.docs
      .map(d => {
        const sale = d.data() as any;
        return {
          id: d.id,
          ...sale,
          created_at: sale.created_at || sale.createdAt || sale.timestamp || sale.time || (sale.date ? `${sale.date}T12:00:00.000Z` : undefined)
        } as Sale;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, 'sales');
    return [];
  }
};

export const saveSale = async (sale: Sale): Promise<Sale> => {
  const { id, ...data } = sale;
  try {
    let action = 'create';
    let details = `Added Daily Sale on ${sale.date} with cash SR ${sale.total_cash_sales.toLocaleString()}`;
    const nowStr = new Date().toISOString();

    if (id) {
      action = 'update';
      details = `Updated Daily Sale on ${sale.date} with cash SR ${sale.total_cash_sales.toLocaleString()}`;
      
      let existingCreatedAt = nowStr;
      try {
        const snap = await getDoc(doc(db, 'sales', id));
        if (snap.exists()) {
          const d = snap.data();
          existingCreatedAt = d.created_at || d.createdAt || d.timestamp || d.time || nowStr;
        }
      } catch (_) {}

      const updateData = {
        ...data,
        created_at: existingCreatedAt,
        updated_at: nowStr
      };

      await setDoc(doc(db, 'sales', id), updateData, { merge: true });
      await createActivityLog(action, 'sale', details, id, sale.date);
      return { id, ...updateData as any };
    }

    // Check if date already exists → upsert
    const existing = await getDocs(
      query(collection(db, 'sales'), where('date', '==', sale.date), limit(1))
    );
    if (!existing.empty) {
      action = 'update';
      details = `Updated Daily Sale on ${sale.date} with cash SR ${sale.total_cash_sales.toLocaleString()}`;
      const docId = existing.docs[0].id;
      const existingData = existing.docs[0].data();
      const existingCreatedAt = existingData.created_at || existingData.createdAt || existingData.timestamp || existingData.time || nowStr;

      const updateData = {
        ...data,
        created_at: existingCreatedAt,
        updated_at: nowStr
      };

      await updateDoc(doc(db, 'sales', docId), updateData as any);
      await createActivityLog(action, 'sale', details, docId, sale.date);
      return { id: docId, ...updateData as any };
    }

    const createData = {
      ...data,
      created_at: nowStr,
      updated_at: nowStr
    };
    const ref = await addDoc(collection(db, 'sales'), createData);
    await createActivityLog(action, 'sale', details, ref.id, sale.date);
    return { id: ref.id, ...createData };
  } catch (e) {
    handleFirestoreError(e, id ? OperationType.UPDATE : OperationType.CREATE, 'sales');
    throw e;
  }
};

export const deleteSale = async (id: string): Promise<void> => {
  try {
    let details = `Deleted Daily Sale ID: ${id}`;
    let transDate: string | undefined = undefined;
    try {
      const snap = await getDoc(doc(db, 'sales', id));
      if (snap.exists()) {
        const d = snap.data();
        details = `Deleted Daily Sale on ${d.date} (Net: SR ${(d.total_cash_sales || 0).toLocaleString()})`;
        transDate = d.date;
      }
    } catch (_) {}
    await deleteDoc(doc(db, 'sales', id));
    await createActivityLog('delete', 'sale', details, id, transDate);
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `sales/${id}`);
  }
};

// ── Expenses ───────────────────────────────────────────────────────────────

export const getExpenses = async (): Promise<Expense[]> => {
  try {
    const snap = await getDocs(collection(db, 'expenses'));
    return snap.docs
      .map(d => {
        const exp = d.data() as any;
        return {
          id: d.id,
          ...exp,
          created_at: exp.created_at || exp.createdAt || exp.timestamp || exp.time || (exp.date ? `${exp.date}T12:00:00.000Z` : undefined)
        } as Expense;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, 'expenses');
    return [];
  }
};

export const saveExpense = async (expense: Expense): Promise<Expense> => {
  const { id, ...data } = expense;
  try {
    const action = id ? 'update' : 'create';
    const details = `${id ? 'Updated' : 'Added'} Expense: ${expense.item_name} from ${expense.supplier_name || 'N/A'} (Amount: SR ${expense.total.toLocaleString()})`;
    const nowStr = new Date().toISOString();

    if (id) {
      let existingCreatedAt = nowStr;
      try {
        const snap = await getDoc(doc(db, 'expenses', id));
        if (snap.exists()) {
          const d = snap.data();
          existingCreatedAt = d.created_at || d.createdAt || d.timestamp || d.time || nowStr;
        }
      } catch (_) {}

      const updateData = {
        ...data,
        created_at: existingCreatedAt,
        updated_at: nowStr
      };

      await setDoc(doc(db, 'expenses', id), updateData, { merge: true });
      await createActivityLog(action, 'expense', details, id, expense.date);
      return { id, ...updateData as any };
    }

    const createData = {
      ...data,
      created_at: nowStr,
      updated_at: nowStr
    };
    const ref = await addDoc(collection(db, 'expenses'), createData);
    await createActivityLog(action, 'expense', details, ref.id, expense.date);
    return { id: ref.id, ...createData };
  } catch (e) {
    handleFirestoreError(e, id ? OperationType.UPDATE : OperationType.CREATE, 'expenses');
    throw e;
  }
};

export const deleteExpense = async (id: string): Promise<void> => {
  try {
    let details = `Deleted Expense ID: ${id}`;
    let transDate: string | undefined = undefined;
    try {
      const snap = await getDoc(doc(db, 'expenses', id));
      if (snap.exists()) {
        const d = snap.data();
        details = `Deleted Expense: ${d.item_name} from ${d.supplier_name || 'N/A'} (Amount: SR ${(d.total || 0).toLocaleString()})`;
        transDate = d.date;
      }
    } catch (_) {}
    await deleteDoc(doc(db, 'expenses', id));
    await createActivityLog('delete', 'expense', details, id, transDate);
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `expenses/${id}`);
  }
};

// ── Suppliers ──────────────────────────────────────────────────────────────

export const getSuppliers = async (): Promise<Supplier[]> => {
  try {
    const snap = await getDocs(collection(db, 'suppliers'));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Supplier))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, 'suppliers');
    return [];
  }
};

export const saveSupplier = async (supplier: Supplier): Promise<Supplier> => {
  const { id, ...data } = supplier;
  try {
    const action = id ? 'update' : 'create';
    const details = `${id ? 'Updated' : 'Added'} Supplier: ${supplier.name} ${supplier.vat_number ? `(VAT: ${supplier.vat_number})` : ''}`;
    if (id) {
      await setDoc(doc(db, 'suppliers', id), data, { merge: true });
      await createActivityLog(action, 'supplier', details, id);
      return { id, ...data };
    }
    const ref = await addDoc(collection(db, 'suppliers'), data);
    await createActivityLog(action, 'supplier', details, ref.id);
    return { id: ref.id, ...data };
  } catch (e) {
    handleFirestoreError(e, id ? OperationType.UPDATE : OperationType.CREATE, 'suppliers');
    throw e;
  }
};

export const deleteSupplier = async (id: string): Promise<void> => {
  try {
    let details = `Deleted Supplier ID: ${id}`;
    try {
      const snap = await getDoc(doc(db, 'suppliers', id));
      if (snap.exists()) {
        details = `Deleted Supplier: ${snap.data().name}`;
      }
    } catch (_) {}
    await deleteDoc(doc(db, 'suppliers', id));
    await createActivityLog('delete', 'supplier', details, id);
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `suppliers/${id}`);
  }
};

// ── Monthly Cash ───────────────────────────────────────────────────────────

export interface MonthlyCash {
  id?: string;
  month_year: string;
  opening_cash: number;
  closing_cash: number;
}

export const getMonthlyCash = async (monthYear: string): Promise<MonthlyCash> => {
  try {
    const q = query(collection(db, 'monthly_cash'), where('month_year', '==', monthYear), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return { month_year: monthYear, opening_cash: 0, closing_cash: 0 };
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as MonthlyCash;
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, 'monthly_cash');
    return { month_year: monthYear, opening_cash: 0, closing_cash: 0 };
  }
};

export const saveMonthlyCashData = async (
  monthYear: string,
  opening_cash: number,
  closing_cash: number
): Promise<void> => {
  try {
    const details = `Reconciled Monthly Cash for ${monthYear} (Opening: SR ${opening_cash.toLocaleString()}, Closing: SR ${closing_cash.toLocaleString()})`;
    const q = query(collection(db, 'monthly_cash'), where('month_year', '==', monthYear), limit(1));
    const snap = await getDocs(q);
    let targetId = '';
    if (!snap.empty) {
      targetId = snap.docs[0].id;
      await updateDoc(doc(db, 'monthly_cash', targetId), { opening_cash, closing_cash });
    } else {
      const ref = await addDoc(collection(db, 'monthly_cash'), { month_year: monthYear, opening_cash, closing_cash });
      targetId = ref.id;
    }
    await createActivityLog('reconciliation', 'reconciliation', details, targetId);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, 'monthly_cash');
  }
};

// ── Manual Months ───────────────────────────────────────────────────────────

export const getManualMonths = async (): Promise<MonthEntry[]> => {
  try {
    const snap = await getDocs(collection(db, 'manual_months'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as MonthEntry));
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, 'manual_months');
    return [];
  }
};

export const saveManualMonth = async (month: MonthEntry): Promise<MonthEntry> => {
  const { id, ...data } = month;
  try {
    const action = id ? 'update' : 'create';
    const details = `${id ? 'Updated' : 'Added'} Manual Account Month: ${month.month} (Sales: SR ${month.sales.toLocaleString()}, Ops: SR ${(month.ops || 0).toLocaleString()})`;
    if (id) {
      await setDoc(doc(db, 'manual_months', id), data, { merge: true });
      await createActivityLog(action, 'month', details, id);
      return { id, ...data };
    }
    const ref = await addDoc(collection(db, 'manual_months'), data);
    await createActivityLog(action, 'month', details, ref.id);
    return { id: ref.id, ...data };
  } catch (e) {
    handleFirestoreError(e, id ? OperationType.UPDATE : OperationType.CREATE, 'manual_months');
    throw e;
  }
};

export const deleteManualMonth = async (id: string): Promise<void> => {
  try {
    let details = `Deleted Manual Month Entry ID: ${id}`;
    try {
      const snap = await getDoc(doc(db, 'manual_months', id));
      if (snap.exists()) {
        details = `Deleted Manual Month Entry: ${snap.data().month}`;
      }
    } catch (_) {}
    await deleteDoc(doc(db, 'manual_months', id));
    await createActivityLog('delete', 'month', details, id);
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `manual_months/${id}`);
  }
};

// ── Extra Expenses ─────────────────────────────────────────────────────────

export const getExtraExpenses = async (): Promise<ExtraEntry[]> => {
  try {
    const snap = await getDocs(collection(db, 'extra_expenses'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ExtraEntry));
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, 'extra_expenses');
    return [];
  }
};

export const saveExtraExpense = async (extra: ExtraEntry): Promise<ExtraEntry> => {
  const { id, ...data } = extra;
  try {
    const action = id ? 'update' : 'create';
    const details = `${id ? 'Updated' : 'Added'} Extra Expense: ${extra.name} (Amount: SR ${extra.amount.toLocaleString()})${extra.month_key ? ` for Month ${extra.month_key}` : ''}`;
    if (id) {
      await setDoc(doc(db, 'extra_expenses', id), data, { merge: true });
      await createActivityLog(action, 'extra', details, id);
      return { id, ...data };
    }
    const ref = await addDoc(collection(db, 'extra_expenses'), data);
    await createActivityLog(action, 'extra', details, ref.id);
    return { id: ref.id, ...data };
  } catch (e) {
    handleFirestoreError(e, id ? OperationType.UPDATE : OperationType.CREATE, 'extra_expenses');
    throw e;
  }
};

export const deleteExtraExpense = async (id: string): Promise<void> => {
  try {
    let details = `Deleted Extra Expense ID: ${id}`;
    try {
      const snap = await getDoc(doc(db, 'extra_expenses', id));
      if (snap.exists()) {
        const d = snap.data();
        details = `Deleted Extra Expense: ${d.name} (Amount: SR ${(d.amount || 0).toLocaleString()})`;
      }
    } catch (_) {}
    await deleteDoc(doc(db, 'extra_expenses', id));
    await createActivityLog('delete', 'extra', details, id);
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `extra_expenses/${id}`);
  }
};

// ── Month Overrides ────────────────────────────────────────────────────────

export const getMonthOverrides = async (): Promise<Record<string, MonthOverrides>> => {
  try {
    const snap = await getDocs(collection(db, 'month_overrides'));
    const map: Record<string, MonthOverrides> = {};
    snap.docs.forEach(d => {
      const data = d.data() as MonthOverride;
      map[data.key] = data.data;
    });
    return map;
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, 'month_overrides');
    return {};
  }
};

export const saveMonthOverride = async (key: string, data: MonthOverrides): Promise<void> => {
  try {
    const details = `Updated Admin Overrides for Month ${key} (Hidden: ${data._hidden ? 'Yes' : 'No'}, Salary: SR ${(data.salary || 0).toLocaleString()})`;
    const q = query(collection(db, 'month_overrides'), where('key', '==', key), limit(1));
    const snap = await getDocs(q);
    let targetId = '';
    if (!snap.empty) {
      targetId = snap.docs[0].id;
      await updateDoc(doc(db, 'month_overrides', targetId), { data } as any);
    } else {
      const ref = await addDoc(collection(db, 'month_overrides'), { key, data });
      targetId = ref.id;
    }
    await createActivityLog('override', 'month', details, targetId);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, 'month_overrides');
  }
};
