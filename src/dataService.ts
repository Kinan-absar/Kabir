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
import { Sale, Expense, Supplier, MonthlyAttachment } from './types';

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
    console.warn('Could not fetch user role, defaulting to employee:', e);
  }
  return 'employee'; // safest default
};

// ── Sales ──────────────────────────────────────────────────────────────────

export const getSales = async (): Promise<Sale[]> => {
  const snap = await getDocs(collection(db, 'sales'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Sale))
    .sort((a, b) => b.date.localeCompare(a.date));
};

export const saveSale = async (sale: Sale): Promise<Sale> => {
  const { id, ...data } = sale;
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
};

export const deleteSale = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'sales', id));
};

// ── Expenses ───────────────────────────────────────────────────────────────

export const getExpenses = async (): Promise<Expense[]> => {
  const snap = await getDocs(collection(db, 'expenses'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Expense))
    .sort((a, b) => b.date.localeCompare(a.date));
};

export const saveExpense = async (expense: Expense): Promise<Expense> => {
  const { id, ...data } = expense;
  if (id) {
    await setDoc(doc(db, 'expenses', id), data, { merge: true });
    return { id, ...data };
  }
  const ref = await addDoc(collection(db, 'expenses'), data);
  return { id: ref.id, ...data };
};

export const deleteExpense = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'expenses', id));
};

// ── Suppliers ──────────────────────────────────────────────────────────────

export const getSuppliers = async (): Promise<Supplier[]> => {
  const snap = await getDocs(collection(db, 'suppliers'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Supplier))
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const saveSupplier = async (supplier: Supplier): Promise<Supplier> => {
  const { id, ...data } = supplier;
  if (id) {
    await setDoc(doc(db, 'suppliers', id), data, { merge: true });
    return { id, ...data };
  }
  const ref = await addDoc(collection(db, 'suppliers'), data);
  return { id: ref.id, ...data };
};

export const deleteSupplier = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'suppliers', id));
};

// ── Attachments ────────────────────────────────────────────────────────────

export const getAttachments = async (monthYear: string): Promise<MonthlyAttachment[]> => {
  const q = query(collection(db, 'attachments'), where('month_year', '==', monthYear));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as MonthlyAttachment));
};

export const saveAttachment = async (
  attachment: Omit<MonthlyAttachment, 'id' | 'uploaded_at'>
): Promise<MonthlyAttachment> => {
  const data = { ...attachment, uploaded_at: new Date().toISOString() };
  const ref = await addDoc(collection(db, 'attachments'), data);
  return { id: ref.id, ...data };
};

export const deleteAttachment = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'attachments', id));
};

// ── Monthly Cash ───────────────────────────────────────────────────────────

export interface MonthlyCash {
  id?: string;
  month_year: string;
  opening_cash: number;
  closing_cash: number;
}

export const getMonthlyCash = async (monthYear: string): Promise<MonthlyCash> => {
  const q = query(collection(db, 'monthly_cash'), where('month_year', '==', monthYear), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return { month_year: monthYear, opening_cash: 0, closing_cash: 0 };
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as MonthlyCash;
};

export const saveMonthlyCashData = async (
  monthYear: string,
  opening_cash: number,
  closing_cash: number
): Promise<void> => {
  const q = query(collection(db, 'monthly_cash'), where('month_year', '==', monthYear), limit(1));
  const snap = await getDocs(q);
  if (!snap.empty) {
    await updateDoc(doc(db, 'monthly_cash', snap.docs[0].id), { opening_cash, closing_cash });
  } else {
    await addDoc(collection(db, 'monthly_cash'), { month_year: monthYear, opening_cash, closing_cash });
  }
};