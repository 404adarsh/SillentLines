import React, { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  BookOpenCheck,
  Calculator,
  Clipboard,
  Download,
  Edit3,
  FileText,
  Loader2,
  Plus,
  Printer,
  Save,
  Share2,
  Trash2,
} from "lucide-react";
import { apiUrl, postJson } from "../lib/api";
import { todayIndiaInput } from "../lib/format";

const defaultTemplates = {
  journal: ["Journal Voucher", "Being general adjustment entry recorded.", "Expenses / Assets A/c", "Liabilities / Income A/c"],
  payment: ["Payment Voucher", "Being payment made.", "Expense / Supplier A/c", "Cash / Bank A/c"],
  receipt: ["Receipt Voucher", "Being amount received.", "Cash / Bank A/c", "Income / Debtor A/c"],
  contra: ["Contra Voucher", "Being cash-bank transfer.", "Cash A/c", "Bank A/c"],
  sales: ["Sales Voucher", "Being goods sold.", "Cash / Debtor A/c", "Sales A/c"],
  purchase: ["Purchase Voucher", "Being goods purchased.", "Purchase A/c", "Cash / Creditor A/c"],
  debit_note: ["Debit Note", "Being debit note issued.", "Supplier A/c", "Purchase Return A/c"],
  credit_note: ["Credit Note", "Being credit note issued.", "Sales Return A/c", "Customer A/c"],
  gst: ["GST Entry", "Being GST recorded.", "Input GST / Purchase A/c", "Output GST / GST Payable A/c"],
  inventory: ["Inventory Entry", "Being stock movement recorded.", "Stock / Inventory A/c", "Purchase / COGS A/c"],
  bank_reco: ["Bank Reconciliation", "Being bank reconciliation adjusted.", "Bank Charges / Difference A/c", "Bank A/c"],
  capital: ["Capital Introduction", "Being capital introduced.", "Cash / Bank A/c", "Capital A/c"],
  drawings: ["Drawings", "Being drawings made.", "Drawings A/c", "Cash / Bank A/c"],
  expense: ["Expense Voucher", "Being expense incurred.", "Expense A/c", "Cash / Bank A/c"],
  income: ["Income Voucher", "Being income received.", "Cash / Bank A/c", "Income A/c"],
};

const makeTemplate = ([label, narration, debitAccount, creditAccount]) => ({
  label,
  narration,
  lines: [
    { account_name: debitAccount, debit: "", credit: "" },
    { account_name: creditAccount, debit: "", credit: "" },
  ],
});

const templates = Object.fromEntries(
  Object.entries(defaultTemplates).map(([key, value]) => [key, makeTemplate(value)])
);

const tallyModules = [
  "Company", "Ledger", "Groups", "Vouchers", "Day Book", "Trial Balance",
  "Cash Book", "Bank Book", "P&L", "Balance Sheet", "GST", "Inventory",
  "Receivables", "Payables", "Export", "Print",
];

const currencyOptions = [
  { code: "USD", label: "USD $", locale: "en-US" },
  { code: "INR", label: "INR Rs", locale: "en-IN" },
  { code: "EUR", label: "EUR EUR", locale: "de-DE" },
  { code: "GBP", label: "GBP £", locale: "en-GB" },
  { code: "JPY", label: "JPY ¥", locale: "ja-JP" },
  { code: "AUD", label: "AUD A$", locale: "en-AU" },
  { code: "CAD", label: "CAD C$", locale: "en-CA" },
  { code: "SGD", label: "SGD S$", locale: "en-SG" },
  { code: "AED", label: "AED", locale: "en-AE" },
];

const emptyLine = { account_name: "", debit: "", credit: "" };

function cloneLines(lines) {
  return lines.map((line) => ({ ...line }));
}

function cleanNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

export default function AccountingJournal() {
  const { user, isAuthenticated } = useAuth0();
  const [voucherType, setVoucherType] = useState("journal");
  const [currencyCode, setCurrencyCode] = useState(() => localStorage.getItem("silentlines_accounting_currency") || "USD");
  const [editingId, setEditingId] = useState(null);
  const [entryDate, setEntryDate] = useState(todayIndiaInput());
  const [counterparty, setCounterparty] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [narration, setNarration] = useState(templates.journal.narration);
  const [lines, setLines] = useState(cloneLines(templates.journal.lines));
  const [entries, setEntries] = useState([]);
  const [selectedEntryId, setSelectedEntryId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState("Checking database...");

  const activeTemplate = templates[voucherType] || templates.journal;
  const selectedEntry = entries.find((entry) => Number(entry.id) === Number(selectedEntryId)) || entries[0];
  const currentCurrency = currencyOptions.find((option) => option.code === currencyCode) || currencyOptions[0];

  const formatMoney = (value, code = currencyCode) => {
    const option = currencyOptions.find((item) => item.code === code) || currentCurrency;
    return new Intl.NumberFormat(option.locale, {
      style: "currency",
      currency: option.code,
      maximumFractionDigits: option.code === "JPY" ? 0 : 2,
    }).format(cleanNumber(value));
  };

  const totals = useMemo(() => {
    const debit = lines.reduce((sum, line) => sum + cleanNumber(line.debit), 0);
    const credit = lines.reduce((sum, line) => sum + cleanNumber(line.credit), 0);
    return {
      debit,
      credit,
      difference: debit - credit,
      balanced: debit > 0 && debit.toFixed(2) === credit.toFixed(2),
    };
  }, [lines]);

  const reports = useMemo(() => {
    const voucherTotal = entries.reduce((sum, entry) => sum + cleanNumber(entry.total_debit), 0);
    const ledgerTotals = {};
    entries.forEach((entry) => {
      (entry.lines || []).forEach((line) => {
        const name = line.account_name || "Unknown Ledger";
        ledgerTotals[name] = ledgerTotals[name] || { debit: 0, credit: 0 };
        ledgerTotals[name].debit += cleanNumber(line.debit);
        ledgerTotals[name].credit += cleanNumber(line.credit);
      });
    });
    return { voucherTotal, ledgerTotals };
  }, [entries]);

  const loadEntries = async () => {
    if (!isAuthenticated || !user?.email) {
      setDbStatus("Login required before saving.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiUrl("/accounting_journal.php")}?email=${encodeURIComponent(user.email)}`);
      const data = await res.json();
      if (!res.ok || data.status !== "success") {
        throw new Error(data.message || "Database load failed.");
      }
      setEntries(data.entries || []);
      setDbStatus(`Connected. ${data.entries?.length || 0} saved voucher${data.entries?.length === 1 ? "" : "s"} loaded.`);
    } catch (err) {
      setDbStatus("Database connection failed.");
      setError(err.message || "Could not load accounting vouchers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, [isAuthenticated, user?.email]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        saveJournal();
      }
      if (key === "p") {
        event.preventDefault();
        printVoucher();
      }
      if (key === "e") {
        event.preventDefault();
        exportCsv();
      }
      if (key === "b") {
        event.preventDefault();
        autoBalance();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const chooseVoucher = (type) => {
    const template = templates[type];
    setVoucherType(type);
    setNarration(template.narration);
    setLines(cloneLines(template.lines));
    setMessage(`${template.label} format loaded.`);
    setError("");
    setEditingId(null);
  };

  const changeCurrency = (code) => {
    setCurrencyCode(code);
    localStorage.setItem("silentlines_accounting_currency", code);
  };

  const updateLine = (index, key, value) => {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, [key]: value } : line)));
  };

  const addLine = () => setLines((current) => [...current, { ...emptyLine }]);

  const removeLine = (index) => {
    setLines((current) => (current.length > 2 ? current.filter((_, i) => i !== index) : current));
  };

  const autoBalance = () => {
    if (!totals.difference) return;
    setLines((current) => {
      const next = current.map((line) => ({ ...line }));
      const index = next.findIndex((line) => !cleanNumber(line.debit) && !cleanNumber(line.credit));
      const target = index >= 0 ? index : next.length - 1;
      if (totals.difference > 0) next[target].credit = totals.difference.toFixed(2);
      if (totals.difference < 0) next[target].debit = Math.abs(totals.difference).toFixed(2);
      return next;
    });
  };

  const validateEntry = () => {
    const usableLines = lines.filter((line) => line.account_name.trim() && (cleanNumber(line.debit) || cleanNumber(line.credit)));
    if (!user?.email) return "Please login before saving.";
    if (!entryDate) return "Date is required.";
    if (!narration.trim()) return "Narration is required.";
    if (usableLines.length < 2) return "At least two ledger lines are required.";
    if (!totals.balanced) return "Debit and credit must match before saving.";
    return "";
  };

  const saveJournal = async () => {
    const validationError = validateEntry();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const data = await postJson("/accounting_journal.php", {
        action: editingId ? "update" : "create",
        journal_id: editingId,
        email: user.email,
        voucher_type: voucherType,
        currency_code: currencyCode,
        counterparty,
        reference_no: referenceNo,
        entry_date: entryDate,
        narration,
        lines,
      });
      if (data.status !== "success") {
        throw new Error(data.message || "Database save failed.");
      }
      setMessage(`Voucher ${editingId ? "updated" : "saved"} in database. Voucher ID: ${data.id}`);
      setEditingId(null);
      setSelectedEntryId(data.id);
      await loadEntries();
    } catch (err) {
      setError(err.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const editEntry = (entry) => {
    setEditingId(entry.id);
    setSelectedEntryId(entry.id);
    setVoucherType(entry.voucher_type || "journal");
    setCurrencyCode(entry.currency_code || currencyCode);
    setEntryDate(entry.entry_date || todayIndiaInput());
    setCounterparty(entry.counterparty || "");
    setReferenceNo(entry.reference_no || "");
    setNarration(entry.narration || "");
    setLines((entry.lines?.length ? entry.lines : cloneLines(templates[entry.voucher_type]?.lines || templates.journal.lines)).map((line) => ({
      account_name: line.account_name || "",
      debit: cleanNumber(line.debit) ? String(line.debit) : "",
      credit: cleanNumber(line.credit) ? String(line.credit) : "",
    })));
    setMessage(`Editing voucher #${entry.id}. Save will update the existing journal.`);
    setError("");
  };

  const resetForm = () => {
    setEditingId(null);
    setVoucherType("journal");
    setCurrencyCode(localStorage.getItem("silentlines_accounting_currency") || "USD");
    setEntryDate(todayIndiaInput());
    setCounterparty("");
    setReferenceNo("");
    setNarration(templates.journal.narration);
    setLines(cloneLines(templates.journal.lines));
  };

  const deleteEntry = async (entry) => {
    if (!user?.email || !entry?.id) return;
    const ok = window.confirm(`Delete voucher #${entry.id}? This cannot be undone.`);
    if (!ok) return;
    setSaving(true);
    setError("");
    try {
      const data = await postJson("/accounting_journal.php", {
        action: "delete",
        email: user.email,
        journal_id: entry.id,
      });
      if (data.status !== "success") throw new Error(data.message || "Delete failed.");
      setEntries((current) => current.filter((item) => Number(item.id) !== Number(entry.id)));
      if (Number(selectedEntryId) === Number(entry.id)) setSelectedEntryId(null);
      if (Number(editingId) === Number(entry.id)) resetForm();
      setMessage("Voucher deleted.");
    } catch (err) {
      setError(err.message || "Could not delete voucher.");
    } finally {
      setSaving(false);
    }
  };

  const voucherText = (entry = selectedEntry) => {
    if (!entry) return "";
    const rows = (entry.lines || []).map((line) => {
      const code = entry.currency_code || currencyCode;
      return `${line.account_name} | Dr ${formatMoney(line.debit, code)} | Cr ${formatMoney(line.credit, code)}`;
    });
    return [
      "SilentLines Accounting Voucher",
      `${entry.voucher_label || entry.voucher_type} | ${entry.entry_date}`,
      `Reference: ${entry.reference_no || "-"}`,
      `Party: ${entry.counterparty || "-"}`,
      `Narration: ${entry.narration || "-"}`,
      ...rows,
      `Currency: ${entry.currency_code || currencyCode}`,
      `Total: ${formatMoney(entry.total_debit, entry.currency_code || currencyCode)}`,
    ].join("\n");
  };

  const shareVoucher = async () => {
    const text = voucherText();
    if (!text) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Accounting Voucher", text });
        setMessage("Voucher shared.");
      } else {
        await navigator.clipboard.writeText(text);
        setMessage("Voucher copied to clipboard for sharing.");
      }
    } catch (err) {
      setError(err.message || "Could not share voucher.");
    }
  };

  const printVoucher = () => {
    window.print();
  };

  const exportCsv = () => {
    const rows = [
      ["Voucher ID", "Date", "Type", "Currency", "Party", "Reference", "Ledger", "Debit", "Credit", "Narration"],
      ...entries.flatMap((entry) =>
        (entry.lines?.length ? entry.lines : [emptyLine]).map((line) => [
          entry.id,
          entry.entry_date,
          entry.voucher_type,
          entry.currency_code || currencyCode,
          entry.counterparty || "",
          entry.reference_no || "",
          line.account_name || "",
          cleanNumber(line.debit).toFixed(2),
          cleanNumber(line.credit).toFixed(2),
          entry.narration || "",
        ])
      ),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `silentlines-accounting-${todayIndiaInput()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-[#0b0f14] text-gray-200">
      <style>{`
        .field-input {
          width: 100%;
          border: 1px solid #374151;
          background: #0f172a;
          color: #f8fafc;
          padding: 0.625rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        .field-input:focus {
          border-color: #22c55e;
          box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.18);
        }
        @media print {
          body * { visibility: hidden; }
          #print-voucher, #print-voucher * { visibility: visible; }
          #print-voucher { position: absolute; left: 0; top: 0; width: 100%; color: #111; background: white; padding: 24px; }
        }
      `}</style>

      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="border-r border-gray-800 bg-[#111827] p-4">
          <div className="mb-4 flex items-center gap-2 text-green-400">
            <BookOpenCheck className="h-5 w-5" />
            <h2 className="text-sm font-black uppercase tracking-widest">Gateway of Tally</h2>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-black uppercase tracking-wider text-gray-400">
            {tallyModules.map((item) => (
              <span key={item} className="rounded border border-gray-800 bg-[#0b1220] px-2 py-2 text-center">{item}</span>
            ))}
          </div>

          <h3 className="mt-5 mb-2 text-xs font-black uppercase tracking-widest text-gray-500">Voucher Types</h3>
          <div className="space-y-1">
            {Object.entries(templates).map(([key, template]) => (
              <button
                key={key}
                onClick={() => chooseVoucher(key)}
                className={`w-full rounded px-3 py-2 text-left text-sm font-semibold transition ${
                  voucherType === key ? "bg-green-500 text-black" : "text-gray-300 hover:bg-gray-800"
                }`}
              >
                {template.label}
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-w-0 flex-col">
          <header className="flex flex-col gap-3 border-b border-gray-800 bg-[#020617] px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-green-400">Accounting Journal</p>
              <h1 className="text-2xl font-black text-white">{editingId ? `Editing #${editingId}` : activeTemplate.label}</h1>
              <p className="mt-1 text-xs font-semibold text-gray-400">{dbStatus}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton onClick={saveJournal} disabled={saving || !totals.balanced} icon={saving ? Loader2 : Save} label="Save" hint="Ctrl+S" spin={saving} />
              {editingId && <ActionButton onClick={resetForm} icon={Plus} label="New" />}
              <ActionButton onClick={autoBalance} icon={Calculator} label="Balance" hint="Ctrl+B" />
              <ActionButton onClick={printVoucher} icon={Printer} label="Print" hint="Ctrl+P" />
              <ActionButton onClick={exportCsv} disabled={!entries.length} icon={Download} label="Export" hint="Ctrl+E" />
              <ActionButton onClick={shareVoucher} disabled={!selectedEntry} icon={Share2} label="Share" />
            </div>
          </header>

          {(message || error) && (
            <div className={`mx-5 mt-4 rounded-lg border px-4 py-3 text-sm font-bold ${
              error ? "border-red-400/30 bg-red-400/10 text-red-100" : "border-green-400/30 bg-green-400/10 text-green-100"
            }`}>
              {error || message}
            </div>
          )}

          <div className="grid flex-1 gap-5 overflow-auto p-5 xl:grid-cols-[1fr_380px]">
            <div className="space-y-5">
              <div className="grid gap-3 rounded-lg border border-gray-800 bg-[#111827] p-4 md:grid-cols-4">
                <Field label="Date">
                  <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="field-input" />
                </Field>
                <Field label="Reference">
                  <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder="INV-001 / VCH-01" className="field-input" />
                </Field>
                <Field label="Currency">
                  <select value={currencyCode} onChange={(e) => changeCurrency(e.target.value)} className="field-input">
                    {currencyOptions.map((option) => (
                      <option key={option.code} value={option.code}>{option.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Party" wide>
                  <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="Customer / Supplier / Bank / Owner" className="field-input" />
                </Field>
                <Field label="Narration" full>
                  <input value={narration} onChange={(e) => setNarration(e.target.value)} className="field-input" />
                </Field>
              </div>

              <div className="overflow-hidden rounded-lg border border-gray-800 bg-[#111827]">
                <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
                  <h2 className="text-sm font-black uppercase tracking-widest text-gray-300">Accounting Entries</h2>
                  <button onClick={addLine} className="inline-flex items-center gap-2 rounded bg-green-500 px-3 py-2 text-xs font-black text-black">
                    <Plus className="h-4 w-4" />
                    Add Ledger
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="bg-[#020617] text-xs uppercase tracking-widest text-gray-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Ledger Account</th>
                        <th className="px-4 py-3 text-right">Debit</th>
                        <th className="px-4 py-3 text-right">Credit</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, index) => (
                        <tr key={index} className="border-t border-gray-800 hover:bg-[#0b1220]">
                          <td className="px-4 py-2">
                            <input value={line.account_name} onChange={(e) => updateLine(index, "account_name", e.target.value)} className="w-full bg-transparent font-semibold text-white outline-none" />
                          </td>
                          <td className="px-4 py-2">
                            <input type="number" value={line.debit} onChange={(e) => updateLine(index, "debit", e.target.value)} className="w-full bg-transparent text-right font-mono text-green-200 outline-none" />
                          </td>
                          <td className="px-4 py-2">
                            <input type="number" value={line.credit} onChange={(e) => updateLine(index, "credit", e.target.value)} className="w-full bg-transparent text-right font-mono text-sky-200 outline-none" />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <button onClick={() => removeLine(index)} className="rounded p-2 text-red-300 hover:bg-red-500/10" aria-label="Remove ledger line">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="grid gap-3 border-t border-gray-800 bg-[#020617] px-4 py-4 text-sm font-black md:grid-cols-4">
                  <Total label="Debit" value={formatMoney(totals.debit)} />
                  <Total label="Credit" value={formatMoney(totals.credit)} />
                  <Total label="Difference" value={formatMoney(Math.abs(totals.difference))} tone={totals.balanced ? "good" : "bad"} />
                  <Total label="Status" value={totals.balanced ? "Balanced" : "Not Balanced"} tone={totals.balanced ? "good" : "bad"} />
                </div>
              </div>

              <div className="rounded-lg border border-gray-800 bg-[#111827] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-green-400" />
                  <h2 className="text-sm font-black uppercase tracking-widest">Saved Vouchers</h2>
                </div>
                <div className="max-h-80 overflow-auto">
                  {loading && <p className="p-4 text-sm text-gray-400">Loading saved vouchers...</p>}
                  {!loading && !entries.length && <p className="p-4 text-sm text-gray-400">No vouchers saved yet. Save one and it will appear here from the database.</p>}
                  {entries.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => setSelectedEntryId(entry.id)}
                      className={`mb-2 w-full rounded border p-3 text-left transition ${
                        Number(selectedEntry?.id) === Number(entry.id) ? "border-green-400 bg-green-400/10" : "border-gray-800 bg-[#0b1220] hover:border-gray-600"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-black text-white">{entry.voucher_label || entry.voucher_type}</p>
                        <p className="font-mono text-sm text-green-300">{formatMoney(entry.total_debit, entry.currency_code || currencyCode)}</p>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-gray-400">{entry.entry_date} | {entry.currency_code || "USD"} | {entry.counterparty || "General"} | {entry.reference_no || "No ref"}</p>
                      <div className="mt-3 flex gap-2">
                        <span onClick={(event) => { event.stopPropagation(); editEntry(entry); }} className="inline-flex items-center gap-1 rounded bg-amber-400 px-2 py-1 text-[11px] font-black uppercase text-black">
                          <Edit3 className="h-3 w-3" /> Edit
                        </span>
                        <span onClick={(event) => { event.stopPropagation(); deleteEntry(entry); }} className="inline-flex items-center gap-1 rounded bg-red-500 px-2 py-1 text-[11px] font-black uppercase text-white">
                          <Trash2 className="h-3 w-3" /> Delete
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <aside className="space-y-5">
              <div id="print-voucher" className="rounded-lg border border-gray-800 bg-white p-5 text-gray-950">
                <div className="flex items-start justify-between gap-3 border-b border-gray-200 pb-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-gray-500">SilentLines</p>
                    <h2 className="text-2xl font-black">Accounting Voucher</h2>
                  </div>
                  <Clipboard className="h-6 w-6 text-gray-500" />
                </div>
                {selectedEntry ? (
                  <div className="mt-4 text-sm">
                    <p><b>Type:</b> {selectedEntry.voucher_label || selectedEntry.voucher_type}</p>
                    <p><b>Currency:</b> {selectedEntry.currency_code || currencyCode}</p>
                    <p><b>Date:</b> {selectedEntry.entry_date}</p>
                    <p><b>Reference:</b> {selectedEntry.reference_no || "-"}</p>
                    <p><b>Party:</b> {selectedEntry.counterparty || "-"}</p>
                    <p className="mt-2"><b>Narration:</b> {selectedEntry.narration}</p>
                    <table className="mt-4 w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-300 text-left">
                          <th className="py-2">Ledger</th>
                          <th className="py-2 text-right">Debit</th>
                          <th className="py-2 text-right">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedEntry.lines || []).map((line) => (
                          <tr key={line.id || line.account_name} className="border-b border-gray-100">
                            <td className="py-2">{line.account_name}</td>
                            <td className="py-2 text-right">{formatMoney(line.debit, selectedEntry.currency_code || currencyCode)}</td>
                            <td className="py-2 text-right">{formatMoney(line.credit, selectedEntry.currency_code || currencyCode)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-gray-500">Saved voucher preview will appear here.</p>
                )}
              </div>

              <div className="rounded-lg border border-gray-800 bg-[#111827] p-4">
                <h2 className="text-sm font-black uppercase tracking-widest text-gray-300">Trial Balance Preview</h2>
                <div className="mt-3 max-h-72 overflow-auto text-sm">
                  {Object.entries(reports.ledgerTotals).slice(0, 12).map(([ledger, total]) => (
                    <div key={ledger} className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-gray-800 py-2">
                      <span className="font-semibold text-gray-300">{ledger}</span>
                      <span className="font-mono text-green-300">{formatMoney(total.debit)}</span>
                      <span className="font-mono text-sky-300">{formatMoney(total.credit)}</span>
                    </div>
                  ))}
                  {!Object.keys(reports.ledgerTotals).length && <p className="text-gray-500">No ledger totals yet.</p>}
                </div>
                <p className="mt-4 rounded bg-[#020617] p-3 text-xs font-bold uppercase tracking-widest text-gray-400">
                  Saved value: {formatMoney(reports.voucherTotal)}
                </p>
              </div>

              <div className="rounded-lg border border-gray-800 bg-[#111827] p-4 text-xs font-bold uppercase tracking-widest text-gray-400">
                Shortcuts: Ctrl+S Save | Ctrl+B Balance | Ctrl+P Print | Ctrl+E Export
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function ActionButton({ icon: Icon, label, hint, onClick, disabled, spin }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded bg-gray-800 px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-100 transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
      title={hint || label}
    >
      <Icon className={`h-4 w-4 ${spin ? "animate-spin" : ""}`} />
      {label}
      {hint && <span className="hidden text-gray-400 sm:inline">{hint}</span>}
    </button>
  );
}

function Field({ label, children, wide, full }) {
  return (
    <label className={`text-xs font-black uppercase tracking-widest text-gray-500 ${wide ? "md:col-span-2" : ""} ${full ? "md:col-span-4" : ""}`}>
      {label}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Total({ label, value, tone }) {
  const color = tone === "good" ? "text-green-300" : tone === "bad" ? "text-red-300" : "text-white";
  return (
    <div className="rounded border border-gray-800 bg-[#111827] px-3 py-2">
      <p className="text-xs uppercase tracking-widest text-gray-500">{label}</p>
      <p className={`mt-1 font-mono ${color}`}>{value}</p>
    </div>
  );
}
