import * as XLSX from 'xlsx';
import { Sale, Expense } from './types';

export const exportSalesToExcel = (sales: Sale[], fileName: string = 'Sales_Report.xlsx') => {
  const hasHistoricalPlatforms = sales.some(s => 
    (s.jahez_bistro || 0) + (s.jahez_burger || 0) + (s.keeta_bistro || 0) + 
    (s.keeta_burger || 0) + (s.hunger_station_bistro || 0) + (s.hunger_station_burger || 0) + 
    (s.ninja || 0) > 0
  );

  const worksheetData = sales.map(sale => {
    const row: Record<string, any> = {
      'Date': sale.date,
      'Day': sale.day,
      'Dining (Cash)': sale.dining_cash || 0,
      'Dining (Card)': sale.dining_card || 0,
      'Delivery (Cash)': sale.delivery_cash || 0,
      'Delivery (Card)': sale.delivery_card || 0,
    };

    if (hasHistoricalPlatforms) {
      row['Jahez Bistro'] = sale.jahez_bistro || 0;
      row['Jahez Burger'] = sale.jahez_burger || 0;
      row['Keeta Bistro'] = sale.keeta_bistro || 0;
      row['Keeta Burger'] = sale.keeta_burger || 0;
      row['Hunger Station Bistro'] = sale.hunger_station_bistro || 0;
      row['Hunger Station Burger'] = sale.hunger_station_burger || 0;
      row['Ninja'] = sale.ninja || 0;
    }

    row['Discount'] = sale.discount || 0;
    row['Num Customers'] = sale.num_customers || 0;
    row['Opening Cash'] = sale.opening_cash || 0;
    row['Closing Cash Actual'] = sale.closing_cash_actual || 0;
    row['POS Closing Report'] = sale.pos_closing_report || 0;
    row['Total Cash Sales'] = (sale.dining_cash || 0) + (sale.delivery_cash || 0);

    return row;
  });

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
    'Has VAT?': expense.has_vat !== false ? 'Yes' : 'No',
    'Net (ex. VAT)': expense.total_debit,
    'VAT (15%)': expense.vat_debit,
    'Total (inc. VAT)': expense.total,
    'Paid By': expense.paid_by,
    'Category': expense.category || '',
    'Sub-Category': expense.sub_category || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses');
  XLSX.writeFile(workbook, fileName);
};
