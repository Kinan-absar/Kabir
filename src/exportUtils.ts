import * as XLSX from 'xlsx';
import { Sale, Expense } from './types';

export const exportSalesToExcel = (sales: Sale[], fileName: string = 'Sales_Report.xlsx') => {
  const worksheetData = sales.map(sale => ({
    'Date': sale.date,
    'Day': sale.day,
    'Dining (Cash)': sale.dining_cash,
    'Dining (Card)': sale.dining_card,
    'Jahez Bistro': sale.jahez_bistro,
    'Jahez Burger': sale.jahez_burger,
    'Keeta Bistro': sale.keeta_bistro,
    'Keeta Burger': sale.keeta_burger,
    'Hunger Station Bistro': sale.hunger_station_bistro,
    'Hunger Station Burger': sale.hunger_station_burger,
    'Ninja': sale.ninja,
    'Discount': sale.discount,
    'Num Customers': sale.num_customers,
    'POS Closing Report': sale.pos_closing_report,
    'Total Cash Sales': sale.total_cash_sales,
    'Closing Cash Actual': sale.closing_cash_actual,
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales');
  XLSX.writeFile(workbook, fileName);
};

export const exportExpensesToExcel = (expenses: Expense[], fileName: string = 'Expenses_Report.xlsx') => {
  const worksheetData = expenses.map(expense => ({
    'Date': expense.date,
    'Invoice No': expense.invoice_no,
    'Supplier Name': expense.supplier_name,
    'Item Name': expense.item_name,
    'VAT Number': expense.vat_number,
    'Net (ex. VAT)': expense.total_debit,
    'VAT (15%)': expense.vat_debit,
    'Total (inc. VAT)': expense.total,
    'Paid By': expense.paid_by,
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses');
  XLSX.writeFile(workbook, fileName);
};
