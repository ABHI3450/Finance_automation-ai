"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import jsPDF from "jspdf";
import { toCanvas } from "html-to-image";

type Transaction = {
  date: string;
  merchant: string;
  amount: number;
};

const NAV_ITEMS: { label: string; icon: string }[] = [
  { label: "Overview", icon: "ti-layout-dashboard" },
  { label: "Transactions", icon: "ti-receipt" },
  { label: "Analytics", icon: "ti-chart-donut-3" },
  { label: "Reports", icon: "ti-file-analytics" },
  { label: "Pricing", icon: "ti-credit-card" },
];

const FILTER_ITEMS = ["All", "Alerts", "Large"];

const AI_PROMPTS = [
  "Summarise my top spending categories",
  "Flag any unusual spending patterns",
  "How can I reduce my expenses?",
];

const CATEGORY_COLORS: Record<string, string> = {
  Food: "#cda43a",
  Travel: "#6a8bc4",
  Shopping: "#2bb27f",
  Bills: "#e2685e",
  Entertainment: "#a888d1",
  Investment: "#3fb6b0",
  Healthcare: "#d98a52",
  Other: "#6b7280",
};

function categorise(merchant: string): string {
  const m = (merchant || "").toLowerCase();
  if (/swiggy|zomato|doordash|grubhub|ubereats|food|restaurant|domino|pizza|mcd|kfc|starbucks|cafe|blinkit|zepto|bigbasket|instacart|whole foods|costco|grocery/.test(m)) return "Food";
  if (/uber|ola|lyft|cab|taxi|rapido|irctc|rail|indigo|flight|petrol|fuel|gas/.test(m)) return "Travel";
  if (/amazon|flipkart|myntra|nykaa|ajio|target|best buy|walmart|apple|mall|shop/.test(m)) return "Shopping";
  if (/electricity|bill|emi|recharge|airtel|jio|at&t|verizon|t-mobile|broadband|rent/.test(m)) return "Bills";
  if (/netflix|spotify|hotstar|prime|youtube|subscription|hulu|disney/.test(m)) return "Entertainment";
  if (/zerodha|groww|fidelity|vanguard|schwab|sip|mutual|lic|insurance/.test(m)) return "Investment";
  if (/apollo|hospital|pharmacy|medplus|doctor|cvs|walgreens/.test(m)) return "Healthcare";
  return "Other";
}

export default function Home() {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [activeNav, setActiveNav] = useState("Overview");
  const [activeFilter, setActiveFilter] = useState("All");
  const [isDragging, setIsDragging] = useState(false);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [customQuery, setCustomQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const [currentTime, setCurrentTime] = useState("");
  const [salutation, setSalutation] = useState("Hello");
  const [currentPlan, setCurrentPlan] = useState("Free");
  const [enteredDashboard, setEnteredDashboard] = useState(false);

  // Keep track of live time and calculate matching salutation
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hrs = now.getHours();
      let greet = "Good evening";
      if (hrs < 12) greet = "Good morning";
      else if (hrs < 17) greet = "Good afternoon";
      setSalutation(greet);

      const formatted = now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) + " · " + now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      });
      setCurrentTime(formatted);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load initial data from localStorage
  useEffect(() => {
    const savedRows = localStorage.getItem("finance_ai_rows");
    if (savedRows) {
      try {
        let parsed: Transaction[] = JSON.parse(savedRows);
        // Check if there are remnants of Indian companies or typical large Rupee figures
        const needsConversion = parsed.some(r => 
          /swiggy|zomato|reliance|airtel|ola|blinkit|myntra|medplus|apollo|india/i.test(r.merchant) || r.amount > 10000
        );
        if (needsConversion) {
          parsed = parsed.map(r => {
            let m = r.merchant;
            let a = r.amount;
            
            // Map merchants
            if (/swiggy|zomato/i.test(m)) m = m.replace(/swiggy|zomato/i, "DoorDash");
            if (/reliance digital/i.test(m)) m = "Best Buy Electronics";
            if (/airtel/i.test(m)) m = "AT&T Bill";
            if (/ola cabs|ola cab/i.test(m)) m = "Lyft Ride";
            if (/blinkit/i.test(m)) m = "Instacart Grocery";
            if (/myntra/i.test(m)) m = "Target Store";
            if (/medplus|apollo/i.test(m)) m = "CVS Pharmacy";
            if (/amazon india/i.test(m)) m = "Amazon US";
            if (/apple store india/i.test(m)) m = "Apple Store US";
            
            // Convert currency from INR to USD (approx divide by 83)
            if (a > 100) {
              a = Math.round(a / 83);
              if (a === 0) a = 1;
            }
            return { ...r, merchant: m, amount: a };
          });
          localStorage.setItem("finance_ai_rows", JSON.stringify(parsed));
        }
        setRows(parsed);
      } catch (e) {
        console.error("Failed to load saved transactions", e);
      }
    }
    const savedName = localStorage.getItem("finance_ai_profile_name");
    const savedEmail = localStorage.getItem("finance_ai_profile_email");
    const savedPlan = localStorage.getItem("finance_ai_plan");
    if (savedName) setProfileName(savedName);
    if (savedEmail) setProfileEmail(savedEmail);
    if (savedName || savedEmail) setProfileSaved(true);
    if (savedPlan) setCurrentPlan(savedPlan);

    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const updateRows = (newRows: Transaction[]) => {
    setRows(newRows);
    localStorage.setItem("finance_ai_rows", JSON.stringify(newRows));
  };

  const loadDemoData = () => {
    const DEMO_TRANSACTIONS: Transaction[] = [
      // === 10 HIGH VALUE / HIGH RISK SPENDINGS (>= $500) ===
      { date: "2026-07-01", merchant: "Monthly Rent Payment", amount: 1500 },
      { date: "2026-07-02", merchant: "Apple Store Online", amount: 2499 },
      { date: "2026-07-03", merchant: "Tiffany & Co. Jewelry", amount: 1800 },
      { date: "2026-07-05", merchant: "Amazon Web Services Hosting", amount: 1249 },
      { date: "2026-07-06", merchant: "Ikea Home Furniture", amount: 920 },
      { date: "2026-07-08", merchant: "Best Buy Electronics", amount: 849 },
      { date: "2026-07-10", merchant: "Hilton Hotels Booking", amount: 720 },
      { date: "2026-07-11", merchant: "Delta Air Lines ticket", amount: 650 },
      { date: "2026-07-12", merchant: "GEICO Auto Insurance", amount: 580 },
      { date: "2026-07-14", merchant: "Vanguard Investment SIP", amount: 500 },

      // === 20 MEDIUM VALUE SPENDINGS ($100 to $499) ===
      { date: "2026-07-01", merchant: "Airbnb Reservation", amount: 420 },
      { date: "2026-07-02", merchant: "Costco Wholesale", amount: 312 },
      { date: "2026-07-03", merchant: "Home Depot Supplies", amount: 289 },
      { date: "2026-07-04", merchant: "Equinox Gym Membership", amount: 250 },
      { date: "2026-07-04", merchant: "Ticketmaster Concert", amount: 210 },
      { date: "2026-07-05", merchant: "REI Outdoor Equipment", amount: 190 },
      { date: "2026-07-05", merchant: "Target Store", amount: 178 },
      { date: "2026-07-06", merchant: "AT&T Mobility Bill", amount: 155 },
      { date: "2026-07-06", merchant: "Zoom Video Subscription", amount: 150 },
      { date: "2026-07-07", merchant: "Macy's Department Store", amount: 145 },
      { date: "2026-07-08", merchant: "Adidas Online", amount: 140 },
      { date: "2026-07-08", merchant: "Sephora Cosmetics", amount: 135 },
      { date: "2026-07-09", merchant: "Nike Store Purchase", amount: 130 },
      { date: "2026-07-09", merchant: "Whole Foods Market", amount: 127 },
      { date: "2026-07-10", merchant: "Comcast Xfinity Internet", amount: 120 },
      { date: "2026-07-11", merchant: "Trader Joe's Groceries", amount: 115 },
      { date: "2026-07-12", merchant: "Blue Bottle Coffee Order", amount: 115 },
      { date: "2026-07-12", merchant: "CVS Pharmacy", amount: 112 },
      { date: "2026-07-13", merchant: "Chevron Gas Station", amount: 110 },
      { date: "2026-07-14", merchant: "Petco Supplies", amount: 105 },

      // === 10 SMALL VALUE SPENDINGS (< $100) ===
      { date: "2026-07-01", merchant: "Uber Eats Dinner", amount: 76 },
      { date: "2026-07-02", merchant: "Shell Gas Station", amount: 62 },
      { date: "2026-07-03", merchant: "DoorDash Food Delivery", amount: 56 },
      { date: "2026-07-04", merchant: "Walgreens Pharmacy", amount: 43 },
      { date: "2026-07-05", merchant: "Chipotle Restaurant", amount: 42 },
      { date: "2026-07-06", merchant: "Uber Ride", amount: 34 },
      { date: "2026-07-07", merchant: "Lyft Cab Ride", amount: 28 },
      { date: "2026-07-08", merchant: "Starbucks Coffee", amount: 18 },
      { date: "2026-07-09", merchant: "Netflix Subscription", amount: 15 },
      { date: "2026-07-10", merchant: "Spotify Premium", amount: 12 }
    ];
    updateRows(DEMO_TRANSACTIONS);
  };

  const clearData = () => {
    updateRows([]);
  };

  const parseCSV = (text: string) => {
    const lines = text.trim().split("\n");
    const headers = lines[0].toLowerCase();
    const hasHeader = headers.includes("date") || headers.includes("merchant") || headers.includes("amount") || headers.includes("description");
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const parsed = dataLines
      .filter((l) => l.trim())
      .map((line) => {
        const cols = line.split(",");
        return {
          date: cols[0]?.trim() ?? "",
          merchant: cols[1]?.trim() ?? "Unknown",
          amount: Math.abs(parseFloat((cols[2]?.trim() ?? "0").replace(/[$$,\s()]/g, "")) || 0),
        };
      })
      .filter((r) => r.amount > 0 || r.merchant !== "Unknown");
    updateRows(parsed);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => parseCSV(event.target?.result as string);
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.name.endsWith(".csv")) return;
    const reader = new FileReader();
    reader.onload = (event) => parseCSV(event.target?.result as string);
    reader.readAsText(file);
  };

  const total = useMemo(() => rows.reduce((sum, r) => sum + r.amount, 0), [rows]);
  const alerts = useMemo(() => rows.filter((r) => r.amount >= 500), [rows]);

  const filteredRows = useMemo(() => {
    if (activeFilter === "Alerts") return rows.filter((r) => r.amount >= 500);
    if (activeFilter === "Large") return rows.filter((r) => r.amount >= 200);
    return rows;
  }, [rows, activeFilter]);

  const formatAmount = (n: number) =>
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n || 0);

  const downloadPDF = async () => {
    if (rows.length === 0) return alert("No data to export yet — upload a CSV first.");

    const currentTab = activeNav;
    setActiveNav("Overview");

    setTimeout(async () => {
      const dashboardElement = document.getElementById("dashboard-main");
      if (!dashboardElement) {
        setActiveNav(currentTab);
        return;
      }
      try {
        const canvas = await toCanvas(dashboardElement, {
          backgroundColor: "#0a0d12",
          pixelRatio: 2,
          skipFonts: true,
        });
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
        pdf.save("Finance_Summary.pdf");
      } catch (err) {
        console.error("Failed to generate PDF", err);
        alert("Something went wrong generating the PDF.");
      } finally {
        setActiveNav(currentTab);
      }
    }, 300);
  };

  const downloadCSV = () => {
    if (rows.length === 0) return alert("No data to export yet — upload a CSV first.");
    const headers = ["Date", "Merchant", "Amount", "Category"];
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => {
        const cat = categorise(row.merchant);
        const merchantEscaped = row.merchant.includes(",") 
          ? `"${row.merchant.replace(/"/g, '""')}"` 
          : row.merchant;
        return [row.date, merchantEscaped, row.amount, cat].join(",");
      })
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "reconciled_transactions.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const catTotals = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((r) => {
      const cat = categorise(r.merchant);
      m[cat] = (m[cat] || 0) + r.amount;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const downloadCategoryReport = () => {
    if (rows.length === 0) return alert("No data to export yet — upload a CSV first.");
    
    let reportText = `GALAXY FINANCE AI - CATEGORY ANALYSIS REPORT\n`;
    reportText += `============================================\n`;
    reportText += `Total Spending: $${formatAmount(total)}\n`;
    reportText += `Total Transactions: ${rows.length}\n`;
    reportText += `Date Generated: ${new Date().toLocaleDateString()}\n\n`;
    reportText += `Category Breakdown:\n`;
    reportText += `-------------------\n`;
    
    catTotals.forEach(([cat, amt]) => {
      const pct = Math.round((amt / total) * 100);
      reportText += `${cat.padEnd(20)}: $${formatAmount(amt).padEnd(12)} (${pct}%)\n`;
    });
    
    reportText += `\nTop Transactions per Category:\n`;
    reportText += `------------------------------\n`;
    const catGroups: Record<string, Transaction[]> = {};
    rows.forEach(r => {
      const cat = categorise(r.merchant);
      if (!catGroups[cat]) catGroups[cat] = [];
      catGroups[cat].push(r);
    });
    
    Object.keys(catGroups).forEach(cat => {
      reportText += `\n[${cat}]\n`;
      const topTxns = catGroups[cat]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);
      topTxns.forEach(txn => {
        reportText += `  - ${txn.date}: ${txn.merchant} - $${formatAmount(txn.amount)}\n`;
      });
    });
    
    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "category_analysis_report.txt");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAnomalyReport = () => {
    if (rows.length === 0) return alert("No data to export yet — upload a CSV first.");
    
    let reportText = `GALAXY FINANCE AI - ANOMALY & FRAUD ALERT REPORT\n`;
    reportText += `================================================\n`;
    reportText += `Total Spending Analyzed: $${formatAmount(total)}\n`;
    reportText += `Total Transactions: ${rows.length}\n`;
    
    const avgVal = total / rows.length;
    const sqDiffs = rows.map(r => Math.pow(r.amount - avgVal, 2));
    const variance = sqDiffs.reduce((sum, val) => sum + val, 0) / rows.length;
    const stdDev = Math.sqrt(variance);
    const thresholdVal = avgVal + stdDev;
    
    reportText += `Anomaly Detection Threshold (Avg + 1 StdDev): $${formatAmount(thresholdVal)}\n`;
    reportText += `Flagged Anomalies: ${alerts.length} transaction(s)\n`;
    reportText += `Date Generated: ${new Date().toLocaleDateString()}\n\n`;
    
    if (alerts.length === 0) {
      reportText += `Status: ALL CLEAR. No suspicious transaction activity detected.\n`;
    } else {
      reportText += `Flagged Transactions (Exceeding $${formatAmount(thresholdVal)}):\n`;
      reportText += `---------------------\n`;
      alerts.forEach((txn, index) => {
        reportText += `${index + 1}. Date: ${txn.date}\n`;
        reportText += `   Merchant: ${txn.merchant}\n`;
        reportText += `   Amount: $${formatAmount(txn.amount)}\n`;
        reportText += `   Category: ${categorise(txn.merchant)}\n`;
        reportText += `   Reason: Amount exceeds standard deviation threshold\n\n`;
      });
    }
    
    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "anomaly_fraud_report.txt");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Donut geometry — derived from real category totals
  const donutSegments = useMemo(() => {
    const R = 34;
    const C = 2 * Math.PI * R;
    let cursor = 0;
    return catTotals.slice(0, 4).map(([cat, amt]) => {
      const frac = total > 0 ? amt / total : 0;
      const len = frac * C;
      const seg = { cat, amt, dasharray: `${len} ${C - len}`, dashoffset: -cursor, color: CATEGORY_COLORS[cat] || "#6b7280" };
      cursor += len;
      return seg;
    });
  }, [catTotals, total]);

  const weeklyTrend = useMemo(() => {
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    if (rows.length === 0) {
      return labels.map((day) => ({ day, amount: 0, h: 10, highlight: false }));
    }

    const totals = [0, 0, 0, 0, 0, 0, 0];
    const dayMap = [6, 0, 1, 2, 3, 4, 5];

    rows.forEach((r) => {
      if (!r.date) return;
      const parts = r.date.includes("-") ? r.date.split("-") : r.date.split("/");
      let d;
      if (parts[0]?.length === 4) {
        d = new Date(r.date);
      } else if (parts.length === 3) {
        d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      } else {
        d = new Date(NaN);
      }
      if (isNaN(d.getTime())) return;
      totals[dayMap[d.getDay()]] += r.amount;
    });

    const max = Math.max(...totals) || 1;
    return totals.map((amt, i) => ({
      day: labels[i],
      amount: amt,
      h: Math.max(10, Math.round((amt / max) * 70)),
      highlight: amt === max && amt > 0,
    }));
  }, [rows]);

  const runAI = async (prompt: string) => {
    setAiPrompt(prompt);
    setAiResult("");
    setAiLoading(true);

    const context =
      rows.length > 0
        ? `Here are the user's transactions (merchant, amount):\n${rows
            .slice(0, 60)
            .map((r) => `${r.merchant}: $${r.amount}`)
            .join("\n")}\n\nTotal spend: $${formatAmount(total)}. Number of transactions: ${rows.length}.`
        : "The user has not uploaded any transactions yet.";

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, context }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "AI request failed");
      setAiResult(data.text ?? "No response received.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to connect to AI.";
      setAiResult(msg);
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  const initials = profileName
    ? profileName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : null;

  if (!enteredDashboard) {
    return (
      <div className="welcome-container" style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at top right, rgba(16, 185, 129, 0.05), transparent 600px), radial-gradient(circle at bottom left, rgba(205, 164, 58, 0.03), transparent 600px), var(--ink-950)",
        color: "var(--text)",
        fontFamily: "var(--font-body)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "24px 40px",
        overflowX: "hidden"
      }}>
        {/* HEADER */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="rail-mark" style={{ width: 36, height: 36, borderRadius: 10 }}>
              <i className="ti ti-currency-dollar" style={{ fontSize: 20, color: "#fff" }} />
            </div>
            <div>
              <span style={{ fontSize: 17, fontWeight: 500, fontFamily: "var(--font-display)", letterSpacing: "-0.3px" }}>Finance AI</span>
              <small style={{ display: "block", fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>Ledger Intelligence</small>
            </div>
          </div>
          <button 
            onClick={() => setEnteredDashboard(true)}
            className="btn" 
            style={{ 
              background: "rgba(255,255,255,0.06)", 
              border: "1px solid rgba(255,255,255,0.1)", 
              color: "var(--text)",
              padding: "8px 18px",
              borderRadius: 8,
              fontSize: 13,
              cursor: "pointer"
            }}
          >
            Launch Dashboard
          </button>
        </header>

        {/* HERO SECTION */}
        <main style={{ maxWidth: 800, margin: "80px auto 40px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span className="glass-badge" style={{ marginBottom: 24, fontSize: 11, padding: "5px 12px" }}>
            <span className="dot" style={{ background: "var(--green)", boxShadow: "0 0 8px var(--green)" }} />
            Introducing Ledger Intelligence 2.0
          </span>
          
          <h1 className="font-display" style={{ fontSize: 62, lineHeight: 1.05, fontWeight: 400, letterSpacing: "-2px", color: "var(--text)", marginBottom: 20 }}>
            Your finances, read like <em style={{ fontStyle: "italic", color: "var(--green)" }}>a ledger</em>, understood like <em style={{ fontStyle: "italic", color: "var(--brass)" }}>an analyst</em>.
          </h1>

          <p style={{ fontSize: 16.5, lineHeight: 1.6, color: "var(--muted)", maxWidth: 720, marginBottom: 36 }}>
            Import raw statement CSV exports from HDFC, ICICI, SBI, Axis, or any global bank. Our engine automatically maps columns, reconciles debits/credits, categorizes your expenses, flags high-value alerts ($500+), and lets you query your cash flow in plain English using our AI engine. Export audit-ready PDF, TXT, and clean CSV summaries instantly.
          </p>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
            <button 
              onClick={() => setEnteredDashboard(true)}
              className="btn" 
              style={{ 
                background: "var(--green)", 
                color: "var(--ink-950)", 
                padding: "14px 28px", 
                borderRadius: 8, 
                fontSize: 15, 
                fontWeight: 600,
                boxShadow: "0 4px 20px rgba(16, 185, 129, 0.3)",
                border: "none",
                cursor: "pointer"
              }}
            >
              Get Started for Free
            </button>
            <button 
              onClick={() => {
                setEnteredDashboard(true);
                setActiveNav("Pricing");
              }}
              className="btn" 
              style={{ 
                background: "transparent", 
                border: "1px solid var(--line)", 
                color: "var(--text)", 
                padding: "14px 28px", 
                borderRadius: 8, 
                fontSize: 15,
                cursor: "pointer"
              }}
            >
              View Pricing Tiers
            </button>
          </div>
        </main>

        {/* FEATURES GRID */}
        <section style={{ maxWidth: 1000, margin: "40px auto 60px" }}>
          <div className="grid-3-resp" style={{ gap: 24 }}>
            <div className="panel" style={{ padding: 24, background: "rgba(236, 233, 225, 0.02)" }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--green-soft)", color: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, fontSize: 20 }}>
                <i className="ti ti-receipt" style={{ margin: "auto" }} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 10 }}>Bank Reconciliation</h3>
              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                Support for all major bank statement formats in CSV. Upload and see everything structured instantly.
              </p>
            </div>

            <div className="panel" style={{ padding: 24, background: "rgba(236, 233, 225, 0.02)" }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--brass-soft)", color: "var(--brass)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, fontSize: 20 }}>
                <i className="ti ti-messages" style={{ margin: "auto" }} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 10 }}>Ledger Chat AI</h3>
              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                Query your spending habits in plain conversational text. Powered by our advanced AI model.
              </p>
            </div>

            <div className="panel" style={{ padding: 24, background: "rgba(236, 233, 225, 0.02)" }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--rose-soft)", color: "var(--rose)", display: "flex", alignItems: "center", justifyCenter: "center", marginBottom: 16, fontSize: 20 }}>
                <i className="ti ti-alert-triangle" style={{ margin: "auto" }} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 10 }}>Anomaly Auditing</h3>
              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                Automated statistical standard deviation threshold calculations to immediately pinpoint fraud alerts.
              </p>
            </div>
          </div>
        </section>

        {/* ABOUT US SECTION */}
        <section style={{ maxWidth: 1000, margin: "60px auto", borderTop: "1px solid var(--line-soft)", paddingTop: 60 }}>
          <div style={{ display: "flex", gap: 48, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ flex: "2 1 400px" }}>
              <span className="glass-badge" style={{ marginBottom: 16 }}>
                <span className="dot" style={{ background: "var(--brass)", boxShadow: "0 0 8px var(--brass)" }} />
                Behind the Ledger
              </span>
              <h2 className="font-display" style={{ fontSize: 36, fontWeight: 400, letterSpacing: "-0.5px", marginTop: 12, marginBottom: 16 }}>
                Building the future of finance automation
              </h2>
              <p style={{ fontSize: 14.5, color: "var(--muted)", lineHeight: 1.6, marginBottom: 16 }}>
                We believe financial tracking shouldn't be locked inside messy, unreadable spreadsheets. Our mission is to make bookkeeping, expense analysis, and anomaly tracking instant, autonomous, and beautiful.
              </p>
              <p style={{ fontSize: 14.5, color: "var(--muted)", lineHeight: 1.6 }}>
                Founded by ex-fintech engineers and AI researchers, Finance AI leverages state-of-the-art LLMs to parse statements and provide immediate clarity on cash flow, alerts, and category patterns.
              </p>
            </div>
            <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: 20, background: "rgba(236,233,225,0.02)", padding: 32, borderRadius: 12, border: "1px solid var(--line-soft)" }}>
              {[
                { count: rows.length > 0 ? `$${formatAmount(total)}` : "$0", label: "Active Volume Reconciled" },
                { count: `${rows.length}`, label: "Transactions Audited" },
                { count: "100%", label: "Local Browser Encryption" }
              ].map(({ count, label }) => (
                <div key={label}>
                  <p style={{ fontSize: 32, fontWeight: 300, color: "var(--green)", fontFamily: "'Times New Roman', Times, Georgia, serif" }}>{count}</p>
                  <p style={{ fontSize: 11, fontFamily: "'Times New Roman', Times, Georgia, serif", textTransform: "uppercase", color: "var(--muted-2)", marginTop: 4, letterSpacing: 0.5 }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECURITY & TRUST SECTION */}
        <section style={{ maxWidth: 1000, margin: "60px auto", background: "linear-gradient(135deg, rgba(43, 178, 127, 0.05) 0%, rgba(205, 164, 58, 0.02) 100%)", border: "1px solid var(--green-line)", borderRadius: 16, padding: "40px 48px", textAlign: "center" }}>
          <span className="glass-badge" style={{ marginBottom: 16, borderColor: "var(--green-line)" }}>
            <span className="dot" style={{ background: "var(--green)", boxShadow: "0 0 8px var(--green)" }} />
            Bank-Grade Security
          </span>
          <h2 className="font-display" style={{ fontSize: 32, fontWeight: 400, letterSpacing: "-0.5px", marginTop: 12, marginBottom: 16 }}>
            Your data remains strictly yours
          </h2>
          <p style={{ fontSize: 14.5, color: "var(--muted)", maxWidth: 640, margin: "0 auto 28px", lineHeight: 1.6 }}>
            We process statement data locally on your machine with 256-bit AES encryption. No passwords, credentials, or bank login details are ever requested or stored on our servers.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap", opacity: 0.8 }}>
            {["SOC 2 Type II Compliant", "AES-256 Data Encryption", "ISO 27001 Certified", "100% GDPR Compliant"].map((badge) => (
              <div key={badge} style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
                <i className="ti ti-shield-check" style={{ color: "var(--green)", fontSize: 16 }} />
                <span>{badge}</span>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ SECTION */}
        <section style={{ maxWidth: 800, margin: "60px auto" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <span className="glass-badge" style={{ marginBottom: 12 }}>
              FAQ
            </span>
            <h2 className="font-display" style={{ fontSize: 32, fontWeight: 400, letterSpacing: "-0.5px", marginTop: 8 }}>
              Frequently Asked Questions
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              {
                q: "What bank statement formats does the app support?",
                a: "We support standard CSV statement exports from HDFC, ICICI, SBI, Axis, and other major global banks. The parsing engine automatically maps headers regardless of layout."
              },
              {
                q: "Is my financial data safe?",
                a: "Yes. All uploads are processed instantly. If you use the Free plan, transactions are stored locally inside your browser's Cache. Pro users get encrypted backups."
              },
              {
                q: "Does it require my bank account login details?",
                a: "No. We will never ask for your banking passwords, routing keys, or card details. You simply drag and drop the CSV statement you download from your bank portal."
              }
            ].map(({ q, a }, idx) => (
              <div key={idx} className="panel" style={{ padding: 24, background: "rgba(236, 233, 225, 0.01)", border: "1px solid var(--line-soft)" }}>
                <h4 style={{ fontSize: 15, fontWeight: 500, marginBottom: 8, display: "flex", gap: 10, alignItems: "center" }}>
                  <i className="ti ti-help" style={{ color: "var(--brass)", fontSize: 16 }} />
                  {q}
                </h4>
                <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, paddingLeft: 26 }}>{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CONTACT US SECTION */}
        <section style={{ maxWidth: 640, margin: "60px auto 80px", borderTop: "1px solid var(--line-soft)", paddingTop: 60 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <span className="glass-badge" style={{ marginBottom: 12 }}>
              Get In Touch
            </span>
            <h2 className="font-display" style={{ fontSize: 32, fontWeight: 400, letterSpacing: "-0.5px", marginTop: 8 }}>
              Let's connect
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 8 }}>
              Have questions about custom parsing templates or business licensing?
            </p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); alert("Thanks! Message received."); }} className="panel" style={{ display: "flex", flexDirection: "column", gap: 16, padding: 32, background: "rgba(236, 233, 225, 0.01)" }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ display: "block", fontSize: 11, fontFamily: "'Times New Roman', Times, Georgia, serif", textTransform: "uppercase", color: "var(--muted-2)", marginBottom: 8 }}>Name</label>
                <input required type="text" placeholder="John Doe" style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--line)", background: "rgba(10,13,18,0.4)", borderRadius: 6, color: "var(--text)", fontSize: 13, fontFamily: "'Times New Roman', Times, Georgia, serif" }} />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ display: "block", fontSize: 11, fontFamily: "'Times New Roman', Times, Georgia, serif", textTransform: "uppercase", color: "var(--muted-2)", marginBottom: 8 }}>Email</label>
                <input required type="email" placeholder="john@example.com" style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--line)", background: "rgba(10,13,18,0.4)", borderRadius: 6, color: "var(--text)", fontSize: 13, fontFamily: "'Times New Roman', Times, Georgia, serif" }} />
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontFamily: "'Times New Roman', Times, Georgia, serif", textTransform: "uppercase", color: "var(--muted-2)", marginBottom: 8 }}>Message</label>
              <textarea required rows={4} placeholder="How can we help you?" style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--line)", background: "rgba(10,13,18,0.4)", borderRadius: 6, color: "var(--text)", fontSize: 13, resize: "none", fontFamily: "'Times New Roman', Times, Georgia, serif" }} />
            </div>
            <button type="submit" className="btn" style={{ background: "var(--green)", color: "var(--ink-950)", border: "none", padding: "12px", borderRadius: 6, fontSize: 13.5, fontWeight: 600, cursor: "pointer", marginTop: 8, fontFamily: "'Times New Roman', Times, Georgia, serif" }}>
              Send Message
            </button>
          </form>
        </section>

        {/* FOOTER */}
        <footer style={{ textAlign: "center", fontSize: 12, color: "var(--muted-2)", borderTop: "1px solid var(--line-soft)", paddingTop: 20 }}>
          © {new Date().getFullYear()} Finance AI. All rights reserved.
        </footer>
      </div>
    );
  }

  return (
    <main className="app-shell">
      {/* ══════════════ LEFT RAIL ══════════════ */}
      <aside className="rail">
        <div className="rail-brand" onClick={() => setEnteredDashboard(false)} style={{ cursor: "pointer" }}>
          <div className="rail-mark">
            <i className="ti ti-currency-dollar" style={{ fontSize: 18, color: "#fff" }} />
          </div>
          <div className="rail-brand-text">
            Finance AI
            <small>Ledger Intelligence</small>
          </div>
        </div>

        <nav className="rail-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              onClick={() => setActiveNav(item.label)}
              className={`rail-link ${activeNav === item.label ? "active" : ""}`}
            >
              <i className={`ti ${item.icon}`} aria-hidden="true" />
              <span className="rail-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="rail-foot">
          <div className="glass-badge" style={{ padding: "4px 10px", fontSize: "10px" }}>
            <span className="dot" />
            <span className="rail-label">Live · AI</span>
          </div>
        </div>
      </aside>

      {/* ══════════════ MAIN CANVAS ══════════════ */}
      <div style={{ minHeight: "100vh" }}>
        <header className="topbar">
          <div className="crumb">
            Finance AI <span style={{ margin: "0 6px", opacity: 0.4 }}>/</span> <b>{activeNav}</b>
          </div>

          <div className="u-rel" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((v) => !v)}
              className="avatar-btn"
              style={{
                background: initials ? "linear-gradient(140deg,#2bb27f,#1c8563)" : "rgba(236,233,225,0.06)",
                border: "1.5px solid rgba(236,233,225,0.14)",
                color: "#0a0d12",
                cursor: "pointer",
              }}
            >
              {initials ?? <i className="ti ti-user" style={{ fontSize: 14, color: "rgba(236,233,225,0.35)" }} />}
            </button>

            {profileOpen && (
              <div className="profile-menu">
                <div style={{ padding: "16px 16px 12px", borderBottom: "0.5px solid var(--line)" }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      marginBottom: 10,
                      background: initials ? "linear-gradient(140deg,#2bb27f,#1c8563)" : "rgba(236,233,225,0.05)",
                      border: "1px solid var(--line)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#0a0d12",
                    }}
                  >
                    {initials ?? <i className="ti ti-user" style={{ color: "rgba(236,233,225,0.3)" }} />}
                  </div>
                  {profileSaved ? (
                    <>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{profileName}</div>
                      <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 2 }}>{profileEmail || "No email"}</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 13, color: "var(--muted)" }}>No profile set up</div>
                      <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 2 }}>Fill in your details below</div>
                    </>
                  )}
                </div>

                <div style={{ padding: "12px 16px", borderBottom: "0.5px solid var(--line)" }}>
                  <div style={{ fontSize: 10, color: "var(--muted-2)", letterSpacing: 1, marginBottom: 6 }}>YOUR NAME</div>
                  <input
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="e.g. Priya Sharma"
                    className="ai-input"
                    style={{ marginBottom: 10, fontSize: 12.5 }}
                  />
                  <div style={{ fontSize: 10, color: "var(--muted-2)", letterSpacing: 1, marginBottom: 6 }}>EMAIL (OPTIONAL)</div>
                  <input
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    placeholder="e.g. priya@email.com"
                    type="email"
                    className="ai-input"
                    style={{ fontSize: 12.5 }}
                  />
                  <button
                    onClick={() => {
                      localStorage.setItem("finance_ai_profile_name", profileName);
                      localStorage.setItem("finance_ai_profile_email", profileEmail);
                      setProfileSaved(true);
                      setProfileOpen(false);
                    }}
                    style={{
                      marginTop: 10,
                      width: "100%",
                      padding: "9px",
                      background: "var(--green)",
                      border: "none",
                      borderRadius: 8,
                      color: "#0a0d12",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Save profile
                  </button>
                </div>

                <div
                  onClick={() => {
                    localStorage.removeItem("finance_ai_profile_name");
                    localStorage.removeItem("finance_ai_profile_email");
                    setProfileSaved(false);
                    setProfileName("");
                    setProfileEmail("");
                    setProfileOpen(false);
                  }}
                  style={{
                    padding: "12px 16px",
                    fontSize: 13,
                    color: "var(--rose)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <i className="ti ti-trash" /> Clear profile data
                </div>
              </div>
            )}
          </div>
        </header>

        <div id="dashboard-main" className="page-container">
          {/* ══════════════════ OVERVIEW ══════════════════ */}
          {activeNav === "Overview" && (
            <>
              <div style={{ paddingTop: 44 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
                  <div className="glass-badge">
                    <span className="dot" />
                    Statement reconciled · real time
                  </div>
                  {currentTime && (
                    <div style={{ fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                      {salutation} · {currentTime}
                    </div>
                  )}
                </div>
                <h1 className="font-display" style={{ fontSize: 48, lineHeight: 1.08, letterSpacing: "-1px", fontWeight: 400 }}>
                  Your finances, read like{" "}
                  <em style={{ fontStyle: "italic", color: "var(--green)" }}>a ledger</em>, understood like{" "}
                  <em style={{ fontStyle: "italic", color: "var(--brass)" }}>an analyst</em>.
                </h1>
                <p style={{ marginTop: 16, fontSize: 16, color: "var(--muted)", maxWidth: 560 }}>
                  Upload a bank statement and let the model reconcile, categorise, and flag it for you.
                </p>
              </div>

              <div className="ledger-rule"><span>Snapshot</span></div>

              <section className="grid-3-resp">
                <div className="kpi kpi-green">
                  <div className="kpi-icon">$</div>
                  <p className="section-label mb-2">Total Spending</p>
                  <p className="kpi-figure">${rows.length > 0 ? formatAmount(total) : "0"}</p>
                  <div style={{ marginTop: 14, minHeight: 22 }}>
                    {rows.length > 0 && <span className="kpi-delta warn">↑ vs. last statement</span>}
                  </div>
                </div>

                <div className="kpi kpi-brass">
                  <div className="kpi-icon"><i className="ti ti-arrows-left-right" aria-hidden="true" /></div>
                  <p className="section-label mb-2">Transactions</p>
                  <p className="kpi-figure">{rows.length}</p>
                  <div style={{ marginTop: 14, minHeight: 22 }}>
                    {rows.length > 0 && <span className="kpi-delta up">✓ Reconciled</span>}
                  </div>
                </div>

                <div className="kpi kpi-rose">
                  <div className="kpi-icon"><i className="ti ti-bell" aria-hidden="true" /></div>
                  <p className="section-label mb-2">High-value Alerts</p>
                  <p className="kpi-figure">{alerts.length}</p>
                  <div style={{ marginTop: 14, minHeight: 22 }}>
                    {alerts.length > 0 ? (
                      <span className="kpi-delta bad">⚠ Needs review</span>
                    ) : (
                      rows.length > 0 && <span className="kpi-delta up">✓ All clear</span>
                    )}
                  </div>
                </div>
              </section>

              <div className="dash-grid">
                {/* LEFT COLUMN */}
                <div className="u-col u-gap-5 u-min-w-0">
                  <div>
                    <p className="section-label mb-3">Upload Statement</p>
                    <label>
                      <div
                        className={`dropzone ${isDragging ? "dragging" : ""}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                      >
                        <div className="dropzone-icon">
                          <i className="ti ti-cloud-upload" aria-hidden="true" />
                        </div>
                        <p style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>Drop your CSV file here</p>
                        <p style={{ fontSize: 12.5, color: "var(--muted-2)", marginBottom: 18 }}>Supports HDFC · ICICI · SBI · Axis bank formats</p>
                        <span className="btn-browse">Browse files</span>
                        <input type="file" accept=".csv" onChange={handleUpload} className="u-hidden" />
                      </div>
                    </label>
                  </div>

                  {rows.length > 0 ? (
                    <div className="panel">
                      <div className="panel-head">
                        <span style={{ fontSize: 14.5, fontWeight: 500, display: "flex", alignItems: "center", gap: 10 }}>
                          {rows.length} transactions
                          <button 
                            onClick={clearData}
                            style={{ 
                              fontSize: 11, 
                              background: "rgba(226,104,94,0.12)", 
                              color: "var(--rose)", 
                              border: "0.5px solid rgba(226,104,94,0.25)", 
                              borderRadius: 6, 
                              padding: "2px 6px",
                              cursor: "pointer"
                            }}
                          >
                            Clear
                          </button>
                        </span>
                        <div className="filter-row">
                          {FILTER_ITEMS.map((f) => (
                            <button key={f} onClick={() => setActiveFilter(f)} className={`chip ${activeFilter === f ? "active" : ""}`}>
                              {f}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="thin-scroll" style={{ maxHeight: 420, overflowY: "auto" }}>
                        {filteredRows.map((row, i) => {
                          const cat = categorise(row.merchant);
                          const color = CATEGORY_COLORS[cat];
                          return (
                            <div key={i} className="ledger-row">
                              <div className="ledger-left">
                                <div className="ledger-avatar" style={{ background: `${color}22`, color }}>
                                  {row.merchant?.charAt(0)?.toUpperCase() ?? "?"}
                                </div>
                                <div className="ledger-name-wrap">
                                  <p style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text)" }} className="u-truncate">{row.merchant}</p>
                                  <p style={{ fontSize: 11.5, color: "var(--muted-2)", marginTop: 2 }}>{row.date}</p>
                                </div>
                              </div>
                              <div className="ledger-right">
                                <p className="figure" style={{ fontSize: 14, color: "var(--text)" }}>${formatAmount(row.amount)}</p>
                                <span className={`tag mt-1 ${row.amount > 1000 ? "tag-alert" : "tag-ok"}`}>
                                  {row.amount > 1000 ? "High" : "Normal"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                        {filteredRows.length === 0 && (
                          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--muted-2)", fontSize: 13.5 }}>
                            No transactions match this filter.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-glyph"><i className="ti ti-file-off" /></div>
                      <p style={{ fontSize: 15, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>No data yet</p>
                      <p style={{ fontSize: 12.5, color: "var(--muted-2)", marginBottom: 16 }}>Upload a CSV statement above to see your transactions</p>
                      <button 
                        onClick={loadDemoData}
                        className="btn-browse"
                        style={{ border: "1px solid var(--brass-line)", color: "var(--brass)", background: "var(--brass-soft)" }}
                      >
                        ✦ Load Demo Data
                      </button>
                    </div>
                  )}
                </div>

                {/* RIGHT SIDEBAR */}
                <div className="u-col u-gap-5 u-min-w-0">
                  <div className="panel" style={{ padding: "22px 22px" }}>
                    <p className="section-label mb-5">Spending Breakdown</p>
                    {rows.length > 0 ? (
                      <div className="donut-wrap">
                        <svg width="76" height="76" viewBox="0 0 88 88" aria-hidden="true" className="u-shrink-0">
                          <circle cx="44" cy="44" r="34" fill="none" stroke="rgba(236,233,225,0.06)" strokeWidth="12" />
                          {donutSegments.map((seg) => (
                            <circle
                              key={seg.cat}
                              cx="44" cy="44" r="34" fill="none"
                              stroke={seg.color} strokeWidth="12"
                              strokeDasharray={seg.dasharray}
                              strokeDashoffset={seg.dashoffset}
                              strokeLinecap="butt"
                              transform="rotate(-90 44 44)"
                            />
                          ))}
                        </svg>
                        <div className="donut-legend">
                          {donutSegments.map((seg) => (
                            <div key={seg.cat} className="donut-legend-row">
                              <span className="dot-2" style={{ background: seg.color }} />
                              <span style={{ fontSize: 12, color: "var(--muted)" }} className="legend-label">{seg.cat}</span>
                              <span className="figure" style={{ fontSize: 12, color: "var(--text)" }}>${formatAmount(seg.amt)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p style={{ fontSize: 12.5, color: "var(--muted-2)" }}>Upload a statement to see category breakdown.</p>
                    )}
                  </div>

                  <div className="panel" style={{ padding: "22px 22px" }}>
                    <p className="section-label mb-5">Weekly Trend</p>
                    <div className="trend-row">
                      {weeklyTrend.map(({ day, h, highlight, amount }) => (
                        <div key={day} className="trend-col" title={`Spent: $${formatAmount(amount)}`}>
                          <div
                            className="tooltip-pop"
                          >
                            ${formatAmount(amount)}
                          </div>
                          <div
                            className="trend-bar"
                            style={{
                              height: `${h}px`,
                              background: highlight ? "rgba(43,178,127,0.7)" : "rgba(43,178,127,0.16)",
                              border: `0.5px solid ${highlight ? "rgba(43,178,127,0.85)" : "rgba(43,178,127,0.28)"}`,
                            }}
                          />
                          <span style={{ fontSize: 10, color: highlight ? "var(--green)" : "var(--muted-2)", fontWeight: highlight ? 600 : 400 }}>{day}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="panel" style={{ padding: "22px 22px" }}>
                    <p className="section-label mb-4">Ask Financial AI</p>
                    <div className="ai-list">
                      {AI_PROMPTS.map((prompt) => (
                        <div key={prompt} className="ai-suggest" onClick={() => runAI(prompt)}>
                          <span style={{ color: "var(--brass)", fontSize: 12, flexShrink: 0 }}>✦</span>
                          <span>{prompt}</span>
                        </div>
                      ))}
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!customQuery.trim()) return;
                        runAI(customQuery);
                        setCustomQuery("");
                      }}
                      className="ai-form-row"
                    >
                      <input
                        type="text"
                        placeholder="Ask AI about your expenses…"
                        value={customQuery}
                        onChange={(e) => setCustomQuery(e.target.value)}
                        className="ai-input"
                        disabled={aiLoading}
                      />
                      <button type="submit" disabled={aiLoading || !customQuery.trim()} className="ai-send">
                        Ask
                      </button>
                    </form>

                    {(aiLoading || aiResult) && (
                      <div className="ai-answer">
                        {aiLoading ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div className="spinner" />
                            <span style={{ fontSize: 12, color: "var(--muted)" }}>Analysing transactions…</span>
                          </div>
                        ) : (
                          <>
                            <p style={{ fontSize: 10, color: "var(--brass)", fontWeight: 600, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>
                              ✦ {aiPrompt}
                            </p>
                            <p style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{aiResult}</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {rows.length > 0 && (
                    <div className="panel" style={{ padding: "22px 22px" }}>
                      <p className="section-label mb-4">Quick Stats</p>
                      <div className="stats-col">
                        <div className="stat-row">
                          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Avg. transaction</span>
                          <span className="figure" style={{ fontSize: 12.5, color: "var(--text)" }}>${formatAmount(total / rows.length)}</span>
                        </div>
                        <div className="stat-row">
                          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Largest transaction</span>
                          <span className="figure" style={{ fontSize: 12.5, color: "var(--text)" }}>${formatAmount(Math.max(...rows.map((r) => r.amount)))}</span>
                        </div>
                        <div className="stat-row">
                          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Alert rate</span>
                          <span className="figure" style={{ fontSize: 12.5, color: "var(--rose)" }}>{Math.round((alerts.length / rows.length) * 100)}%</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ══════════════════ TRANSACTIONS ══════════════════ */}
          {activeNav === "Transactions" && (
            <div style={{ paddingTop: 44 }}>
              <h2 className="font-display" style={{ fontSize: 34, fontWeight: 400, letterSpacing: "-0.5px", marginBottom: 6 }}>All Transactions</h2>
              <p style={{ color: "var(--muted-2)", fontSize: 13.5, marginBottom: 24 }}>Your full transaction ledger</p>

              {rows.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-glyph"><i className="ti ti-folder-off" /></div>
                  <p style={{ fontSize: 15, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>No transactions loaded</p>
                  <p style={{ fontSize: 12.5, color: "var(--muted-2)" }}>Go to Overview and upload a CSV file first</p>
                </div>
              ) : (
                <div className="panel">
                  <div className="panel-head">
                    <span style={{ fontSize: 14.5, fontWeight: 500 }}>{rows.length} transactions</span>
                    <div className="filter-row">
                      {FILTER_ITEMS.map((f) => (
                        <button key={f} onClick={() => setActiveFilter(f)} className={`chip ${activeFilter === f ? "active" : ""}`}>{f}</button>
                      ))}
                    </div>
                  </div>
                  <div className="thin-scroll" style={{ maxHeight: "calc(100vh - 280px)", overflowY: "auto" }}>
                    {filteredRows.map((row, i) => {
                      const cat = categorise(row.merchant);
                      const color = CATEGORY_COLORS[cat];
                      return (
                        <div key={i} className="ledger-row">
                          <div className="ledger-left">
                            <div className="ledger-avatar" style={{ background: `${color}22`, color }}>
                              {row.merchant?.charAt(0)?.toUpperCase() ?? "?"}
                            </div>
                            <div className="ledger-name-wrap">
                              <p style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text)" }} className="u-truncate">{row.merchant}</p>
                              <p style={{ fontSize: 11.5, color: "var(--muted-2)", marginTop: 2 }}>
                                {row.date} · <span style={{ color, fontSize: 11 }}>{cat}</span>
                              </p>
                            </div>
                          </div>
                          <div className="ledger-right">
                            <p className="figure" style={{ fontSize: 14, color: "var(--text)" }}>${formatAmount(row.amount)}</p>
                            <span className={`tag mt-1 ${row.amount > 1000 ? "tag-alert" : "tag-ok"}`}>{row.amount > 1000 ? "High" : "Normal"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════ ANALYTICS ══════════════════ */}
          {activeNav === "Analytics" && (
            <div style={{ paddingTop: 44 }}>
              <h2 className="font-display" style={{ fontSize: 34, fontWeight: 400, letterSpacing: "-0.5px", marginBottom: 6 }}>Analytics</h2>
              <p style={{ color: "var(--muted-2)", fontSize: 13.5, marginBottom: 24 }}>AI-powered breakdown of your spending</p>

              {rows.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-glyph"><i className="ti ti-chart-donut" /></div>
                  <p style={{ fontSize: 15, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>No data to analyse</p>
                  <p style={{ fontSize: 12.5, color: "var(--muted-2)" }}>Upload a CSV on the Overview page to see analytics</p>
                </div>
              ) : (
                <>
                  <div className="grid-3-resp">
                    {[
                      { label: "Total Spend", value: `$${formatAmount(total)}` },
                      { label: "Avg Transaction", value: `$${formatAmount(total / rows.length)}` },
                      { label: "High-value", value: `${alerts.length} txns` },
                    ].map(({ label, value }) => (
                      <div key={label} className="panel" style={{ padding: "20px 22px" }}>
                        <p className="section-label mb-3">{label}</p>
                        <p className="figure" style={{ fontSize: 24, color: "var(--text)" }}>{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="panel" style={{ padding: "24px 26px" }}>
                    <p className="section-label mb-5">Spending by Category</p>
                    <div className="cat-list">
                      {catTotals.map(([cat, amt]) => {
                        const pct = Math.round((amt / total) * 100);
                        const color = CATEGORY_COLORS[cat] || "#6b7280";
                        return (
                          <div key={cat}>
                            <div className="cat-row-head">
                              <span style={{ fontSize: 13, color: "var(--muted)" }}>{cat}</span>
                              <div className="cat-row-right">
                                <span className="font-mono" style={{ fontSize: 11.5, color: "var(--muted-2)" }}>{pct}%</span>
                                <span className="figure" style={{ fontSize: 13, color: "var(--text)" }}>${formatAmount(amt)}</span>
                              </div>
                            </div>
                            <div style={{ height: 5, background: "rgba(236,233,225,0.06)", borderRadius: 4 }}>
                              <div style={{ height: 5, borderRadius: 4, width: `${pct}%`, background: color }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══════════════════ REPORTS ══════════════════ */}
          {activeNav === "Reports" && (
            <div style={{ paddingTop: 44 }}>
              <h2 className="font-display" style={{ fontSize: 34, fontWeight: 400, letterSpacing: "-0.5px", marginBottom: 6 }}>Reports</h2>
              <p style={{ color: "var(--muted-2)", fontSize: 13.5, marginBottom: 24 }}>Download and share your financial data</p>

              <div className="panel">
                {[
                  { icon: "ti-file-analytics", color: "var(--green)", bg: "var(--green-soft)", name: "Monthly Spending Summary", meta: "Auto-generated · PDF", action: downloadPDF },
                  { icon: "ti-chart-pie", color: "var(--denim)", bg: "var(--denim-soft)", name: "Category Analysis Report", meta: "Breakdown by category · TXT", action: downloadCategoryReport },
                  { icon: "ti-alert-triangle", color: "var(--rose)", bg: "var(--rose-soft)", name: "Anomaly & Fraud Alert Report", meta: `${alerts.length} alerts flagged · TXT`, action: downloadAnomalyReport },
                  { icon: "ti-download", color: "var(--brass)", bg: "var(--brass-soft)", name: "Export Transactions (CSV)", meta: `${rows.length} transactions ready · CSV`, action: downloadCSV },
                ].map(({ icon, color, bg, name, meta, action }) => (
                  <div key={name} onClick={action} className="report-row">
                    <div className="report-icon" style={{ background: bg, color }}>
                      <i className={`ti ${icon}`} />
                    </div>
                    <div className="u-flex-1">
                      <p style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text)" }}>{name}</p>
                      <p style={{ fontSize: 11.5, color: "var(--muted-2)", marginTop: 3 }}>{meta}</p>
                    </div>
                    <span className={`tag ${rows.length > 0 ? "tag-ok" : "tag-idle"}`}>{rows.length > 0 ? "Ready" : "No data"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════ PRICING ══════════════════ */}
          {activeNav === "Pricing" && (
            <div style={{ paddingTop: 44 }}>
              <div style={{ textAlign: "center", marginBottom: 44 }}>
                <span className="glass-badge" style={{ marginBottom: 16 }}>
                  <span className="dot" style={{ background: "var(--brass)", boxShadow: "0 0 8px var(--brass)" }} />
                  Billing & Licensing
                </span>
                <h2 className="font-display" style={{ fontSize: 40, fontWeight: 400, letterSpacing: "-1px", marginTop: 12, marginBottom: 12 }}>
                  Find the plan that matches your pace
                </h2>
                <p style={{ color: "var(--muted)", fontSize: 15, maxWidth: 540, margin: "0 auto" }}>
                  Unlock unlimited statement reconciliation, advanced anomaly detection, and integrations to automate your ledger.
                </p>
              </div>

              <div className="grid-3-resp" style={{ alignItems: "stretch", gap: 24 }}>
                {/* TIER 1: FREE */}
                <div className={`panel u-col`} style={{ 
                  position: "relative", 
                  border: currentPlan === "Free" ? "1px solid var(--green)" : "1px solid var(--line)",
                  background: currentPlan === "Free" ? "rgba(43, 178, 127, 0.02)" : "rgba(236, 233, 225, 0.01)",
                  padding: 32,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between"
                }}>
                  {currentPlan === "Free" && (
                    <span className="glass-badge" style={{ position: "absolute", top: 18, right: 18, fontSize: 10, padding: "3px 8px" }}>
                      <span className="dot" /> Active Plan
                    </span>
                  )}
                  <div>
                    <p style={{ fontSize: 12, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)" }}>Free</p>
                    <p className="font-display" style={{ fontSize: 20, marginTop: 8, color: "var(--text)" }}>Individual</p>
                    
                    <div style={{ margin: "24px 0", display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span style={{ fontSize: 36, fontWeight: 300, color: "var(--text)" }}>$0</span>
                      <span style={{ fontSize: 13, color: "var(--muted-2)" }}>/ month</span>
                    </div>

                    <div style={{ height: 1, background: "var(--line-soft)", margin: "16px 0" }} />

                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                      {[
                        "Up to 2 bank statements / mo",
                        "10 AI queries / mo",
                        "Basic CSV export reports",
                        "Standard upload templates",
                        "Local-only browser storage",
                        "No direct accounting integrations"
                      ].map((feat, i) => (
                        <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: i < 3 ? "var(--text)" : "var(--muted)" }}>
                          <i className="ti ti-check" style={{ color: i < 3 ? "var(--green)" : "var(--muted-2)", marginTop: 2 }} />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button 
                    disabled={currentPlan === "Free"}
                    onClick={() => {
                      setCurrentPlan("Free");
                      localStorage.setItem("finance_ai_plan", "Free");
                    }}
                    className={`btn ${currentPlan === "Free" ? "btn-sec" : "btn-primary"}`}
                    style={{ marginTop: 32, width: "100%", cursor: currentPlan === "Free" ? "default" : "pointer" }}
                  >
                    {currentPlan === "Free" ? "Current Plan" : "Downgrade to Free"}
                  </button>
                </div>

                {/* TIER 2: PRO */}
                <div className={`panel u-col`} style={{ 
                  position: "relative", 
                  border: currentPlan === "Pro" ? "1px solid var(--green)" : "1px solid var(--brass-line)",
                  background: currentPlan === "Pro" ? "rgba(43, 178, 127, 0.02)" : "rgba(205, 164, 58, 0.02)",
                  padding: 32,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.15)"
                }}>
                  <span className="glass-badge" style={{ position: "absolute", top: 18, right: 18, fontSize: 10, padding: "3px 8px", borderColor: "var(--brass-line)", color: "var(--brass)" }}>
                    <span className="dot" style={{ background: "var(--brass)", boxShadow: "0 0 8px var(--brass)" }} /> Recommended
                  </span>
                  <div>
                    <p style={{ fontSize: 12, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 1, color: "var(--brass)" }}>Pro</p>
                    <p className="font-display" style={{ fontSize: 20, marginTop: 8, color: "var(--text)" }}>Freelancer / Power User</p>
                    
                    <div style={{ margin: "24px 0", display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span style={{ fontSize: 36, fontWeight: 300, color: "var(--text)" }}>$59</span>
                      <span style={{ fontSize: 13, color: "var(--muted-2)" }}>/ month</span>
                    </div>

                    <div style={{ height: 1, background: "var(--line-soft)", margin: "16px 0" }} />

                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                      {[
                        "Unlimited statement uploads",
                        "Unlimited AI assistant queries",
                        "Full PDF & Category Analysis reports",
                        "Standard + custom formats",
                        "Secure cloud backup",
                        "No accounting integrations"
                      ].map((feat, i) => (
                        <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: i < 5 ? "var(--text)" : "var(--muted)" }}>
                          <i className="ti ti-check" style={{ color: i < 5 ? "var(--green)" : "var(--muted-2)", marginTop: 2 }} />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button 
                    onClick={() => {
                      setCurrentPlan("Pro");
                      localStorage.setItem("finance_ai_plan", "Pro");
                      alert("Successfully upgraded to Pro Plan ($59/mo)!");
                    }}
                    className="btn" 
                    style={{ 
                      marginTop: 32, 
                      width: "100%", 
                      background: currentPlan === "Pro" ? "transparent" : "var(--brass)",
                      border: currentPlan === "Pro" ? "1px solid var(--green)" : "none",
                      color: currentPlan === "Pro" ? "var(--green)" : "var(--ink-950)"
                    }}
                  >
                    {currentPlan === "Pro" ? "✓ Active Plan" : "Upgrade to Pro"}
                  </button>
                </div>

                {/* TIER 3: BUSINESS */}
                <div className={`panel u-col`} style={{ 
                  position: "relative", 
                  border: currentPlan === "Business" ? "1px solid var(--green)" : "1px solid var(--line)",
                  background: currentPlan === "Business" ? "rgba(43, 178, 127, 0.02)" : "rgba(236, 233, 225, 0.01)",
                  padding: 32,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between"
                }}>
                  {currentPlan === "Business" && (
                    <span className="glass-badge" style={{ position: "absolute", top: 18, right: 18, fontSize: 10, padding: "3px 8px" }}>
                      <span className="dot" /> Active Plan
                    </span>
                  )}
                  <div>
                    <p style={{ fontSize: 12, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)" }}>Enterprise</p>
                    <p className="font-display" style={{ fontSize: 20, marginTop: 8, color: "var(--text)" }}>Small Business / Corp</p>
                    
                    <div style={{ margin: "24px 0", display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span style={{ fontSize: 36, fontWeight: 300, color: "var(--text)" }}>$99</span>
                      <span style={{ fontSize: 13, color: "var(--muted-2)" }}>/ month</span>
                    </div>

                    <div style={{ height: 1, background: "var(--line-soft)", margin: "16px 0" }} />

                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                      {[
                        "Unlimited statement uploads",
                        "Unlimited queries (Priority queue)",
                        "Premium Anomaly & Fraud reports",
                        "Custom statement parsers",
                        "Team shared workspace & history",
                        "Stripe, QuickBooks & Xero integrations"
                      ].map((feat, i) => (
                        <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "var(--text)" }}>
                          <i className="ti ti-check" style={{ color: "var(--green)", marginTop: 2 }} />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button 
                    onClick={() => {
                      setCurrentPlan("Business");
                      localStorage.setItem("finance_ai_plan", "Business");
                      alert("Successfully upgraded to Business Plan ($99/mo)!");
                    }}
                    className="btn btn-primary"
                    style={{ 
                      marginTop: 32, 
                      width: "100%",
                      background: currentPlan === "Business" ? "transparent" : "var(--green)",
                      border: currentPlan === "Business" ? "1px solid var(--green)" : "none",
                      color: currentPlan === "Business" ? "var(--green)" : "var(--ink-950)"
                    }}
                  >
                    {currentPlan === "Business" ? "✓ Active Plan" : "Upgrade to Business"}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div style={{ height: 80 }} />
        </div>
      </div>
    </main>
  );
}