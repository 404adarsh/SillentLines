import React, { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  Bug,
  Code2,
  Eye,
  FileCode2,
  FlaskConical,
  LayoutTemplate,
  Loader2,
  MonitorSmartphone,
  Play,
  RefreshCcw,
  Save,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Trash2,
} from "lucide-react";
import { apiUrl, postJson } from "../lib/api";

const starterTemplates = {
  blank: {
    label: "Blank Lab",
    title: "New code note",
    goal: "What am I trying to build or understand?",
    html_code: "<main>\n  <h1>Hello from my journal</h1>\n  <button id=\"action\">Click me</button>\n  <p id=\"output\">Write, test, save, repeat.</p>\n</main>",
    css_code: "body {\n  font-family: Inter, system-ui, sans-serif;\n  margin: 0;\n  background: #f8fafc;\n  color: #111827;\n}\nmain {\n  max-width: 680px;\n  margin: 48px auto;\n  padding: 24px;\n}\nbutton {\n  border: 0;\n  border-radius: 8px;\n  padding: 10px 14px;\n  background: #0f766e;\n  color: white;\n  font-weight: 800;\n}",
    js_code: "document.querySelector('#action')?.addEventListener('click', () => {\n  document.querySelector('#output').textContent = 'JavaScript ran inside the preview sandbox.';\n});",
    notes: "Today I learned:\n\nNext experiment:\n\nReference links:",
    tags: "practice, html",
  },
  component: {
    label: "UI Component",
    title: "Component experiment",
    goal: "Build one reusable UI idea and record what worked.",
    html_code: "<section class=\"pricing\">\n  <h1>Starter Plan</h1>\n  <p class=\"price\">$9</p>\n  <ul>\n    <li>Private notes</li>\n    <li>Sandbox previews</li>\n    <li>Saved experiments</li>\n  </ul>\n</section>",
    css_code: ".pricing {\n  max-width: 320px;\n  margin: 36px auto;\n  border: 1px solid #d4d4d8;\n  border-radius: 8px;\n  padding: 22px;\n  background: white;\n  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);\n}\n.price {\n  color: #b45309;\n  font-size: 44px;\n  font-weight: 900;\n}",
    js_code: "",
    notes: "States to test:\n- Empty\n- Loading\n- Error\n- Success\n\nAccessibility check:",
    tags: "component, css",
  },
  debugging: {
    label: "Bug Hunt",
    title: "Bug investigation",
    goal: "Describe expected behavior, actual behavior, and the smallest reproduction.",
    html_code: "<div id=\"app\">\n  <h1>Bug reproduction</h1>\n  <pre id=\"log\"></pre>\n</div>",
    css_code: "body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #111827; color: #f9fafb; }\n#app { padding: 24px; }\npre { white-space: pre-wrap; background: #020617; padding: 16px; border-radius: 8px; }",
    js_code: "const values = [1, 2, 3];\nconst doubled = values.map((value) => value * 2);\ndocument.querySelector('#log').textContent = JSON.stringify({ values, doubled }, null, 2);",
    notes: "Expected:\n\nActual:\n\nReproduction steps:\n\nRoot cause:\n\nFix:",
    tags: "debugging, javascript",
  },
};

const emptyForm = {
  id: 0,
  title: starterTemplates.blank.title,
  language: "html",
  tags: starterTemplates.blank.tags,
  html_code: starterTemplates.blank.html_code,
  css_code: starterTemplates.blank.css_code,
  js_code: starterTemplates.blank.js_code,
  notes: starterTemplates.blank.notes,
  goal: starterTemplates.blank.goal,
  bug_notes: "",
};

export default function ProgrammingJournal() {
  const { user, isAuthenticated } = useAuth0();
  const [form, setForm] = useState(emptyForm);
  const [entries, setEntries] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("blank");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [activeFile, setActiveFile] = useState("html");
  const [previewKey, setPreviewKey] = useState(0);
  const [previewWidth, setPreviewWidth] = useState("desktop");
  const [consoleLines, setConsoleLines] = useState([]);

  const previewDoc = useMemo(() => {
    const safeJs = JSON.stringify(form.js_code || "");

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body { min-height: 100vh; }
    ${form.css_code || ""}
  </style>
</head>
<body>
  ${form.html_code || ""}
  <script>
    ["log", "warn", "error"].forEach(function(level) {
      var original = console[level];
      console[level] = function() {
        var message = Array.prototype.slice.call(arguments).map(function(item) {
          try { return typeof item === "string" ? item : JSON.stringify(item); }
          catch { return String(item); }
        }).join(" ");
        window.parent.postMessage({ source: "silentlines-preview", level: level, message: message }, "*");
        original.apply(console, arguments);
      };
    });
    window.alert = function(message) { console.log("Alert blocked in sandbox:", message); };
    window.confirm = function() { return false; };
    window.prompt = function() { return null; };
    try {
      new Function(${safeJs})();
      console.log("Preview ready");
    } catch (error) {
      console.error(error && error.stack ? error.stack : String(error));
      document.body.insertAdjacentHTML("beforeend", '<pre style="white-space:pre-wrap;color:#b91c1c;background:#fee2e2;padding:12px;border-radius:8px;margin:16px;">' + String(error).replace(/[&<>]/g, function(ch) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch]; }) + '</pre>');
    }
  </script>
</body>
</html>`;
  }, [form.css_code, form.html_code, form.js_code]);

  const loadEntries = async () => {
    if (!isAuthenticated || !user?.email) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl("/programming_journal.php")}?email=${encodeURIComponent(user.email)}`);
      const data = await res.json();
      if (data.status === "success") setEntries(data.entries || []);
    } catch {
      setMessage("Could not load programming journals.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, [isAuthenticated, user?.email]);

  useEffect(() => {
    const onMessage = (event) => {
      if (event.data?.source !== "silentlines-preview") return;
      setConsoleLines((current) => [...current.slice(-19), event.data]);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    setConsoleLines([]);
  }, [previewKey, form.html_code, form.css_code, form.js_code]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveEntry();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        setPreviewKey((key) => key + 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const applyTemplate = (key) => {
    const template = starterTemplates[key];
    setSelectedTemplate(key);
    setForm((current) => ({
      ...current,
      id: 0,
      title: template.title,
      tags: template.tags,
      html_code: template.html_code,
      css_code: template.css_code,
      js_code: template.js_code,
      notes: template.notes,
      goal: template.goal,
      bug_notes: "",
    }));
    setActiveFile("html");
    setPreviewKey((key) => key + 1);
  };

  const saveEntry = async () => {
    if (!user?.email) {
      setMessage("Please log in before saving code notes.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const data = await postJson("/programming_journal.php", {
        email: user.email,
        ...form,
      });
      if (data.status !== "success") throw new Error(data.message || "Save failed");
      setForm((current) => ({ ...current, id: data.id }));
      setMessage("Programming journal saved.");
      loadEntries();
    } catch (err) {
      setMessage(err.message || "Could not save programming journal.");
    } finally {
      setSaving(false);
    }
  };

  const openEntry = async (entryId) => {
    if (!user?.email) return;
    try {
      const res = await fetch(`${apiUrl("/programming_journal.php")}?email=${encodeURIComponent(user.email)}&id=${entryId}`);
      const data = await res.json();
      if (data.status === "success") {
        setForm({
          id: Number(data.entry.id),
          title: data.entry.title || "",
          language: data.entry.language || "html",
          tags: data.entry.tags || "",
          html_code: data.entry.html_code || "",
          css_code: data.entry.css_code || "",
          js_code: data.entry.js_code || "",
          notes: data.entry.notes || "",
          goal: data.entry.goal || "",
          bug_notes: data.entry.bug_notes || "",
        });
      }
    } catch {
      setMessage("Could not open that saved journal.");
    }
  };

  const deleteEntry = async (entryId) => {
    if (!user?.email) return;
    try {
      const data = await postJson("/programming_journal.php", {
        email: user.email,
        action: "delete",
        id: entryId,
      });
      if (data.status !== "success") throw new Error(data.message || "Delete failed");
      setEntries((current) => current.filter((entry) => Number(entry.id) !== Number(entryId)));
      if (Number(form.id) === Number(entryId)) setForm(emptyForm);
      setMessage("Programming journal deleted.");
    } catch (err) {
      setMessage(err.message || "Could not delete this journal.");
    }
  };

  return (
    <main className="min-h-screen bg-[#0f172a] px-3 py-4 text-slate-950 sm:px-4 sm:py-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="overflow-hidden rounded-lg border border-slate-700 bg-slate-950 text-white shadow-2xl">
          <div className="border-b border-slate-800 bg-slate-900/80 px-4 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-teal-300">
                <FileCode2 className="h-4 w-4" />
                Programming Lab
              </p>
              <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Code, preview, debug, save the lesson</h1>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-300">
                A Replit-style scratchpad for HTML, CSS, JavaScript, debugging notes, snippets, and learning goals.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={saveEntry}
                disabled={saving}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal-400 px-4 text-xs font-black uppercase tracking-widest text-slate-950 disabled:opacity-60"
                aria-label="Save programming lab with Control S or Command S"
                title="Save lab (Ctrl+S)"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
              {Object.entries(starterTemplates).map(([key, template]) => (
                <button
                  key={key}
                  onClick={() => applyTemplate(key)}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-black uppercase tracking-widest ${
                    selectedTemplate === key ? "border-teal-400 bg-teal-400 text-slate-950" : "border-slate-700 bg-slate-800 text-slate-200"
                  }`}
                  aria-pressed={selectedTemplate === key}
                  aria-label={`Use ${template.label} template`}
                >
                  <LayoutTemplate className="h-4 w-4" />
                  {template.label}
                </button>
              ))}
            </div>
          </div>
          </div>
        </section>

        {message && (
          <div className="rounded-lg border border-teal-400 bg-teal-50 px-4 py-3 text-sm font-bold text-teal-900" role="status">
            {message}
          </div>
        )}

        <section className="grid gap-4 xl:grid-cols-[280px_1fr]">
          <aside className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-white shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-300">Saved Labs</h2>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-teal-300" />}
            </div>
            <div className="max-h-[60dvh] space-y-2 overflow-auto pr-1">
              {entries.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-slate-700 bg-slate-950 p-3 transition hover:border-teal-400">
                  <button onClick={() => openEntry(entry.id)} className="block w-full text-left" aria-label={`Open saved lab ${entry.title}`}>
                    <p className="truncate text-sm font-black text-white">{entry.title}</p>
                    <p className="mt-1 truncate text-xs font-semibold text-slate-400">{entry.tags || entry.language}</p>
                  </button>
                  <button onClick={() => deleteEntry(entry.id)} className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-md bg-rose-500/10 px-2 py-1 text-xs font-bold text-rose-200" aria-label={`Delete saved lab ${entry.title}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              ))}
              {!entries.length && !loading && (
                <p className="rounded-lg bg-slate-800 p-4 text-sm font-semibold leading-6 text-slate-300">
                  Your saved programming experiments will appear here.
                </p>
              )}
            </div>
          </aside>

          <div className="space-y-5">
            <section className="grid gap-4 rounded-lg border border-slate-700 bg-slate-900 p-4 text-white shadow-sm lg:grid-cols-3">
              <label className="text-xs font-black uppercase tracking-widest text-slate-300">
                Title
                <input aria-label="Programming lab title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm font-bold normal-case tracking-normal text-white" />
              </label>
              <label className="text-xs font-black uppercase tracking-widest text-slate-300">
                Language / Stack
                <input aria-label="Programming language or stack" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm font-bold normal-case tracking-normal text-white" />
              </label>
              <label className="text-xs font-black uppercase tracking-widest text-slate-300">
                Tags
                <input aria-label="Programming lab tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm font-bold normal-case tracking-normal text-white" />
              </label>
              <label className="text-xs font-black uppercase tracking-widest text-slate-300 lg:col-span-2">
                Goal
                <input aria-label="Programming lab goal" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm font-semibold normal-case tracking-normal text-white" />
              </label>
              <div className="flex items-end">
                <button onClick={saveEntry} disabled={saving} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-teal-400 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-60" aria-label="Save programming lab with Control S or Command S" title="Save lab (Ctrl+S)">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Lab
                </button>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
              <div className="rounded-lg border border-slate-700 bg-slate-950 shadow-sm">
                <div className="flex flex-wrap gap-2 border-b border-slate-800 bg-slate-900 p-2" role="tablist" aria-label="Code files">
                  <FileTab id="html" active={activeFile === "html"} icon={Code2} label="index.html" onClick={() => setActiveFile("html")} />
                  <FileTab id="css" active={activeFile === "css"} icon={Sparkles} label="style.css" onClick={() => setActiveFile("css")} />
                  <FileTab id="js" active={activeFile === "js"} icon={FlaskConical} label="script.js" onClick={() => setActiveFile("js")} />
                </div>
                <div className="p-3">
                  {activeFile === "html" && <CodeBox title="HTML editor" icon={Code2} value={form.html_code} onChange={(value) => setForm({ ...form, html_code: value })} />}
                  {activeFile === "css" && <CodeBox title="CSS editor" icon={Sparkles} value={form.css_code} onChange={(value) => setForm({ ...form, css_code: value })} />}
                  {activeFile === "js" && <CodeBox title="JavaScript editor" icon={FlaskConical} value={form.js_code} onChange={(value) => setForm({ ...form, js_code: value })} />}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border border-slate-700 bg-slate-900 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Play className="h-4 w-4 text-teal-300" />
                      <h2 className="text-sm font-black uppercase tracking-widest text-slate-200">Live Preview</h2>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setPreviewWidth((width) => width === "desktop" ? "mobile" : "desktop")} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-black uppercase text-slate-200" aria-label="Toggle preview size">
                        <MonitorSmartphone className="h-4 w-4" />
                        {previewWidth}
                      </button>
                      <button onClick={() => setPreviewKey((key) => key + 1)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-teal-400 px-3 text-xs font-black uppercase text-slate-950" aria-label="Refresh preview with Control Enter" title="Run preview (Ctrl+Enter)">
                        <RefreshCcw className="h-4 w-4" />
                        Run
                      </button>
                    </div>
                  </div>
                  <div className="bg-slate-950 p-3">
                    <div className={`mx-auto overflow-hidden rounded-lg border border-slate-700 bg-white transition-all duration-300 ${previewWidth === "mobile" ? "max-w-[390px]" : "max-w-full"}`}>
                      <iframe
                        key={previewKey}
                        title="Programming journal sandbox preview"
                        sandbox="allow-scripts"
                        srcDoc={previewDoc}
                        className="h-[420px] w-full bg-white sm:h-[520px]"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-700 bg-slate-950 p-4 text-slate-200 shadow-sm" aria-label="Preview console output">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-300">
                      <TerminalSquare className="h-4 w-4 text-teal-300" />
                      Console
                    </p>
                    <button onClick={() => setConsoleLines([])} className="rounded-md border border-slate-700 px-2 py-1 text-xs font-black uppercase text-slate-300" aria-label="Clear preview console">Clear</button>
                  </div>
                  <div className="max-h-36 overflow-auto rounded-lg bg-black p-3 font-mono text-xs leading-5">
                    {consoleLines.length ? consoleLines.map((line, index) => (
                      <p key={`${line.level}-${index}`} className={line.level === "error" ? "text-rose-300" : line.level === "warn" ? "text-amber-200" : "text-emerald-200"}>
                        [{line.level}] {line.message}
                      </p>
                    )) : <p className="text-slate-500">Run the preview to see logs and JavaScript errors here.</p>}
                  </div>
                </div>

                <label className="block rounded-lg border border-slate-700 bg-slate-900 p-4 text-xs font-black uppercase tracking-widest text-slate-300 shadow-sm">
                  Notes
                  <textarea aria-label="Programming lab notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows="9" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm font-medium normal-case tracking-normal text-white" />
                </label>

                <label className="block rounded-lg border border-slate-700 bg-slate-900 p-4 text-xs font-black uppercase tracking-widest text-slate-300 shadow-sm">
                  Bug Notes
                  <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-400/10 p-3 text-xs font-bold normal-case tracking-normal text-amber-100">
                    <Bug className="mt-0.5 h-4 w-4 shrink-0" />
                    Keep reproduction steps, root cause, and the final fix together.
                  </div>
                  <textarea aria-label="Programming bug notes" value={form.bug_notes} onChange={(e) => setForm({ ...form, bug_notes: e.target.value })} rows="5" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm font-medium normal-case tracking-normal text-white" />
                </label>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function FileTab({ id, active, icon: Icon, label, onClick }) {
  return (
    <button
      id={`${id}-tab`}
      role="tab"
      aria-selected={active}
      aria-controls={`${id}-panel`}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-black uppercase tracking-widest transition ${
        active ? "bg-teal-400 text-slate-950" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function CodeBox({ title, icon: Icon, value, onChange }) {
  return (
    <label className="block text-xs font-black uppercase tracking-widest text-slate-300">
      <span className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-teal-300" />
        {title}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck="false"
        rows="11"
        aria-label={title}
        className="min-h-[420px] w-full resize-y rounded-lg border border-slate-800 bg-[#020617] p-3 font-mono text-sm font-medium normal-case tracking-normal text-slate-100 outline-none focus:border-teal-400 sm:min-h-[620px]"
      />
    </label>
  );
}
