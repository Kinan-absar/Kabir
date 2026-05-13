export interface Sale {
  id?: string;
  date: string;
  day: string;
  opening_cash?: number;
  dining_cash: number;
  total_cash_sales: number;
  dining_card: number;
  jahez_bistro: number;
  jahez_burger: number;
  keeta_bistro: number;
  keeta_burger: number;
  hunger_station_bistro: number;
  hunger_station_burger: number;
  ninja: number;
  discount: number;
  num_customers: number;
  pos_closing_report: number;
  closing_cash_actual?: number;
}

export interface Expense {
  id?: string;
  date: string;
  invoice_no: string;
  supplier_id?: string;
  supplier_name: string;
  item_name: string;
  vat_number: string;
  total_debit: number;
  total: number; // Renamed from grand_total
  vat_debit: number;
  credit: number;
  total_w_vat_credit: number;
  paid_by: string;
  category?: string;
  sub_category?: string;
  has_vat?: boolean;
}

export interface Supplier {
  id?: string;
  name: string;
  vat_number?: string;
}

// UserRole is defined and exported from dataService.ts


export interface MonthEntry {
  id?: string;
  key: string;           // "YYYY-MM" — unique identifier
  month: string;         // display label
  sales: number;
  hungr: number;
  ops: number;           // This will be Firestore Ops + Manual Ops
  rentR: number;
  rentV: number;
  rentS: number;
  salary: number;
  source: 'auto' | 'manual'; // where the row came from
  manualOps?: number;    // Extra manual ops for this month
}

export interface ExtraEntry {
  id?: string;
  name: string;
  amount: number;
}

export type MonthOverrides = Partial<Omit<MonthEntry, 'key' | 'source'>> & { _hidden?: boolean };

export interface MonthOverride {
  id?: string;
  key: string;
  data: MonthOverrides;
}

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
