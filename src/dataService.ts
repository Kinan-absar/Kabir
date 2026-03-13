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
import { db } from './firebase';
import {Sale, Expense, Supplier} from './types';

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

// ── User Role ──────────────────────────────────────────────────────────────
// Reads /users/{uid} document with field: role = 'admin' | 'employee'
// Create these documents manually in Firebase Console for each user.

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

// ── Sales ──────────────────────────────────────────────────────────────────

export const getSales = async (): Promise<Sale[]> => {
  try {
    const snap = await getDocs(collection(db, 'sales'));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Sale))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, 'sales');
    return [];
  }
};

export const saveSale = async (sale: Sale): Promise<Sale> => {
  const { id, ...data } = sale;
  try {
    if (id) {
      await setDoc(doc(db, 'sales', id), data, { merge: true });
      return { id, ...data };
    }
    // Check if date already exists → upsert
    const existing = await getDocs(
      query(collection(db, 'sales'), where('date', '==', sale.date), limit(1))
    );
    if (!existing.empty) {
      const docId = existing.docs[0].id;
      await updateDoc(doc(db, 'sales', docId), data as any);
      return { id: docId, ...data };
    }
    const ref = await addDoc(collection(db, 'sales'), data);
    return { id: ref.id, ...data };
  } catch (e) {
    handleFirestoreError(e, id ? OperationType.UPDATE : OperationType.CREATE, 'sales');
    throw e;
  }
};

export const deleteSale = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'sales', id));
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, `sales/${id}`);
  }
};

// ── Expenses ───────────────────────────────────────────────────────────────

export const getExpenses = async (): Promise<Expense[]> => {
  try {
    const snap = await getDocs(collection(db, 'expenses'));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Expense))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, 'expenses');
    return [];
  }
};

export const saveExpense = async (expense: Expense): Promise<Expense> => {
  const { id, ...data } = expense;
  try {
    if (id) {
      await setDoc(doc(db, 'expenses', id), data, { merge: true });
      return { id, ...data };
    }
    const ref = await addDoc(collection(db, 'expenses'), data);
    return { id: ref.id, ...data };
  } catch (e) {
    handleFirestoreError(e, id ? OperationType.UPDATE : OperationType.CREATE, 'expenses');
    throw e;
  }
};

export const deleteExpense = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'expenses', id));
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
    if (id) {
      await setDoc(doc(db, 'suppliers', id), data, { merge: true });
      return { id, ...data };
    }
    const ref = await addDoc(collection(db, 'suppliers'), data);
    return { id: ref.id, ...data };
  } catch (e) {
    handleFirestoreError(e, id ? OperationType.UPDATE : OperationType.CREATE, 'suppliers');
    throw e;
  }
};

export const deleteSupplier = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'suppliers', id));
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
    const q = query(collection(db, 'monthly_cash'), where('month_year', '==', monthYear), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      await updateDoc(doc(db, 'monthly_cash', snap.docs[0].id), { opening_cash, closing_cash });
    } else {
      await addDoc(collection(db, 'monthly_cash'), { month_year: monthYear, opening_cash, closing_cash });
    }
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, 'monthly_cash');
  }
};