import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  
  // Sales API
  app.get("/api/sales", async (req, res) => {
    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .order("date", { ascending: false });
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/sales", async (req, res) => {
    const { 
      date, day, opening_cash, dining_cash, total_cash_sales, dining_card, jahez_bistro, jahez_burger, 
      keeta_bistro, keeta_burger, hunger_station_bistro, hunger_station_burger, 
      ninja, discount, num_customers, pos_closing_report, closing_cash_actual 
    } = req.body;

    const { data, error } = await supabase
      .from("sales")
      .upsert({ 
        date, day, opening_cash, dining_cash, total_cash_sales, dining_card, jahez_bistro, jahez_burger, 
        keeta_bistro, keeta_burger, hunger_station_bistro, hunger_station_burger, 
        ninja, discount, num_customers, pos_closing_report, closing_cash_actual 
      }, { onConflict: 'date' })
      .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
  });

  app.delete("/api/sales/:id", async (req, res) => {
    const { error } = await supabase
      .from("sales")
      .delete()
      .eq("id", req.params.id);
    
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // Expenses API
  app.get("/api/expenses", async (req, res) => {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("date", { ascending: false });
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/expenses", async (req, res) => {
    const { 
      date, invoice_no, supplier_name, item_name, vat_number, 
      total_debit, vat_debit, grand_total, credit, total_w_vat_credit, paid_by 
    } = req.body;

    const { data, error } = await supabase
      .from("expenses")
      .insert({ 
        date, invoice_no, supplier_name, item_name, vat_number, 
        total_debit, vat_debit, grand_total, credit, total_w_vat_credit, paid_by
      })
      .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
  });

  app.delete("/api/expenses/:id", async (req, res) => {
    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", req.params.id);
    
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // Monthly Cash API
  app.get("/api/monthly-cash/:monthYear", async (req, res) => {
    const { data, error } = await supabase
      .from("monthly_cash")
      .select("*")
      .eq("month_year", req.params.monthYear)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows found"
      return res.status(500).json({ error: error.message });
    }
    res.json(data || { month_year: req.params.monthYear, opening_cash: 0, closing_cash: 0 });
  });

  app.post("/api/monthly-cash", async (req, res) => {
    const { month_year, opening_cash, closing_cash } = req.body;
    const { data, error } = await supabase
      .from("monthly_cash")
      .upsert({ month_year, opening_cash, closing_cash }, { onConflict: 'month_year' })
      .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
