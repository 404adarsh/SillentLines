import { Clock3, Code2, GitCommitHorizontal, Loader2, UserRound, X } from "lucide-react";
import { useMemo, useState } from "react";
import { authUserPayload, postJson } from "../lib/api";
import { formatIndiaDateTime, publicUserLabel } from "../lib/format";

export default function DiaryCommits({ entryId, user, currentText }) {
  const [open, setOpen] = useState(false);
  const [commits, setCommits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  const ownership = useMemo(() => buildOwnership(commits, currentText), [commits, currentText]);

  const loadCommits = async () => {
    setOpen(true);
    setLoading(true);
    setError("");
    try {
      const data = await postJson("/get_entry_commits.php", {
        ...authUserPayload(user),
        entry_id: entryId,
      });
      if (data.status !== "success") throw new Error(data.message || "Could not load commits");
      setCommits(data.commits || []);
      setSelected((data.commits || [])[0] || null);
    } catch (err) {
      setError(err?.message || "Could not load commits");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={loadCommits}
        className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 py-4 text-sm font-black text-stone-800 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl sm:flex-1 sm:py-5"
        aria-label="Open diary commit history"
      >
        <GitCommitHorizontal className="h-5 w-5" />
        <span>Commits</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[3200] flex items-end justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:items-center">
          <div className="flex max-h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="diary-commits-title">
            <div className="flex items-start justify-between gap-3 border-b border-stone-200 bg-stone-950 p-5 text-white">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-white/60">Diary Commits</p>
                <h2 id="diary-commits-title" className="mt-1 text-xl font-black leading-tight sm:text-2xl">History, authors, and changes</h2>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg bg-white/10 p-2 hover:bg-white/20" aria-label="Close commits">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 overflow-auto lg:grid-cols-[320px_1fr]">
              <aside className="max-h-72 overflow-auto border-b border-stone-200 bg-stone-50 p-4 lg:max-h-none lg:border-b-0 lg:border-r">
                {loading && (
                  <div className="flex items-center justify-center py-16 text-stone-500">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                )}
                {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
                {!loading && !error && commits.length === 0 && (
                  <p className="rounded-lg border border-dashed border-stone-200 bg-white p-4 text-sm font-semibold text-stone-500">
                    No commits yet. The next save will create one.
                  </p>
                )}
                <div className="grid gap-2">
                  {commits.map((commit) => (
                    <button
                      key={commit.id}
                      onClick={() => setSelected(commit)}
                      className={`rounded-lg border p-3 text-left transition ${
                        selected?.id === commit.id ? "border-stone-900 bg-white shadow" : "border-stone-200 bg-white/70 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-black text-stone-900">
                        <GitCommitHorizontal className="h-4 w-4" />
                        Commit #{commit.id}
                      </div>
                      <p className="mt-1 text-sm font-black text-stone-700">{commit.commit_message || "Updated diary entry"}</p>
                      <div className="mt-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-400">
                        <UserRound className="h-3.5 w-3.5" />
                        {publicUserLabel({
                          full_name: commit.author_name || commit.author_label,
                          username: commit.author_username,
                        })}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-400">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatIndiaDateTime(commit.created_at)}
                      </div>
                    </button>
                  ))}
                </div>
              </aside>

              <main className="min-h-0 overflow-auto p-4 sm:p-5">
                {selected ? (
                  <div className="grid gap-4">
                    <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                      <p className="text-xs font-black uppercase tracking-widest text-stone-400">Changed Fields</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(selected.changed_fields || []).map((field) => (
                          <span key={field} className="rounded-full bg-stone-900 px-3 py-1 text-xs font-black uppercase text-white">
                            {field.replace("_", " ")}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <DiffPanel title="Before" text={formatSnapshot(selected, "before")} tone="before" />
                      <DiffPanel title="After" text={formatSnapshot(selected, "after")} tone="after" />
                    </div>

                    <section className="rounded-lg border border-stone-200 bg-white p-4">
                      <div className="mb-3 flex items-center gap-2 text-stone-700">
                        <Code2 className="h-4 w-4" />
                        <p className="text-xs font-black uppercase tracking-widest">Current Writing By Person</p>
                      </div>
                      <div className="grid gap-2">
                        {ownership.length === 0 ? (
                          <p className="text-sm font-semibold text-stone-500">No line ownership available yet.</p>
                        ) : (
                          ownership.map((line, index) => (
                            <div key={`${line.author}-${index}`} className="grid gap-2 rounded-lg bg-stone-50 p-3 sm:grid-cols-[180px_1fr]">
                              <div className="text-xs font-black uppercase tracking-widest text-stone-400">{line.author}</div>
                              <p className="break-words text-sm font-semibold leading-6 text-stone-700">{line.text || "Blank line"}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </section>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-stone-200 p-10 text-center text-sm font-semibold text-stone-400">
                    Select a commit to see before and after.
                  </div>
                )}
              </main>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DiffPanel({ title, text, tone }) {
  return (
    <section className={`rounded-lg border p-4 ${tone === "before" ? "border-red-100 bg-red-50" : "border-emerald-100 bg-emerald-50"}`}>
      <p className={`mb-3 text-xs font-black uppercase tracking-widest ${tone === "before" ? "text-red-700" : "text-emerald-700"}`}>{title}</p>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-4 text-sm font-semibold leading-6 text-stone-800">{text || "Empty"}</pre>
    </section>
  );
}

function formatSnapshot(commit, side) {
  const title = commit[`${side}_title`] || "Untitled";
  const emotion = commit[`${side}_emotion`] || "No mood";
  const date = commit[`${side}_diary_date`] || "No date";
  const text = commit[`${side}_text`] || "";
  return `Title: ${title}\nMood: ${emotion}\nDiary date: ${date}\n\n${text}`;
}

function buildOwnership(commits, currentText) {
  const lines = String(currentText || "").split(/\r?\n/);
  if (!lines.length || !lines.join("").trim()) return [];
  const chronological = [...commits].reverse();
  const authorsByLine = lines.map(() => "Unknown");

  chronological.forEach((commit) => {
    const before = String(commit.before_text || "").split(/\r?\n/);
    const after = String(commit.after_text || "").split(/\r?\n/);
    const author = publicUserLabel({
      full_name: commit.author_name || commit.author_label,
      username: commit.author_username,
    }, "Unknown");
    after.forEach((line, index) => {
      if (line !== before[index]) authorsByLine[index] = author;
    });
  });

  return lines.map((text, index) => ({
    text,
    author: authorsByLine[index] || "Unknown",
  }));
}
