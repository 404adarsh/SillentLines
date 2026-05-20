import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, BookOpen, Clock3, Loader2, LockKeyhole, PenLine, Share2, Sparkles } from "lucide-react";
import { useAuth0 } from "@auth0/auth0-react";
import { apiUrl } from "../lib/api";
import { normalizeTheme, themePresets } from "../lib/themes";
import { splitDiaryPages } from "../lib/writingCustomize";
import { jsPDF } from "jspdf";
import GuestNotebook from "../component/GuestNotebook";
import { formatIndiaDate } from "../lib/format";

const MOODS = {
  angry: { label: "Angry", accent: "#dc2626", wash: "#fff1f2" },
  confused: { label: "Confused", accent: "#7c3aed", wash: "#f5f3ff" },
  anxiety: { label: "Anxiety", accent: "#475569", wash: "#f8fafc" },
  sad: { label: "Sad", accent: "#2563eb", wash: "#eff6ff" },
  stress: { label: "Stress", accent: "#ea580c", wash: "#fff7ed" },
  gratitude: { label: "Gratitude", accent: "#be123c", wash: "#fff1f2" },
};

export default function SharedEntry() {
  const { token } = useParams();
  const { user, isAuthenticated } = useAuth0();
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNotebook, setShowNotebook] = useState(false);
  const [pages, setPages] = useState([]);
  const [visibleCount, setVisibleCount] = useState(1); // number of pages currently rendered
  const [pageJump, setPageJump] = useState('1');
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const [activeUsers, setActiveUsers] = useState([]);
  const [presenceError, setPresenceError] = useState('');
  const pageRefs = React.useRef([]);
  const [activePage, setActivePage] = useState(0);
  const sentinelRef = React.useRef(null);

  const allPages = splitDiaryPages(entry?.entry_text || "");
  useEffect(() => {
    setPages(allPages.length ? allPages : [{ title: '', text: '' }]);
    setVisibleCount(Math.min(1, allPages.length || 1));
    setPageJump('1');
    // reset refs
    pageRefs.current = [];
  }, [entry]);

  const MAX_CHARS_PER_PAGE = 2200;

  function paginateText(text) {
    if (!text) return [''];
    const chunks = [];
    let remaining = String(text);
    while (remaining.length > 0) {
      if (remaining.length <= MAX_CHARS_PER_PAGE) {
        chunks.push(remaining);
        break;
      }
      // try to split at nearest newline before limit
      let splitAt = remaining.lastIndexOf('\n', MAX_CHARS_PER_PAGE);
      if (splitAt < Math.max(0, MAX_CHARS_PER_PAGE - 200)) {
        // try to split at last space
        splitAt = remaining.lastIndexOf(' ', MAX_CHARS_PER_PAGE);
      }
      if (splitAt <= 0) splitAt = MAX_CHARS_PER_PAGE; // hard split
      const head = remaining.slice(0, splitAt).trimEnd();
      const tail = remaining.slice(splitAt).trimStart();
      chunks.push(head);
      remaining = tail;
    }
    return chunks;
  }

  // In the shared read-only view, show one page at a time. When the sentinel
  // at the bottom becomes visible, advance to the next page (if any).
  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entryObs) => {
        if (entryObs.isIntersecting) {
          setActivePage((p) => Math.min(pages.length - 1, p + 1));
        }
      });
    }, { root: null, threshold: 0.5 });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [pages.length]);

  useEffect(() => {
    setPageJump(String(activePage + 1));
  }, [activePage]);

  const exportShareBook = async () => {
    if (!entry?.can_export) {
      window.alert('Only the entry owner or an accepted collaborator may export this shared diary.');
      return;
    }

    // Render each page as HTML in a hidden container, snapshot with html2canvas
    // so the PDF preserves the on-screen notebook font, lines and background.
    const html2canvas = (await import('html2canvas')).default;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const coverTitle = entry?.diary_title?.trim() || 'Shared Diary Book';

    doc.setFillColor(theme.page || '#fff7ed');
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(theme.text || '#1c1917');
    doc.setFontSize(28);
    const coverTop = 140;
    doc.text(coverTitle, pageWidth / 2, coverTop, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Pages: ${pages.length}`, pageWidth / 2, coverTop + 30, { align: 'center' });
    doc.addPage();

    // Helper to build HTML for a page
    function buildPageElement(page) {
      const wrapper = document.createElement('div');
      wrapper.style.width = '794px'; // approximate A4 width in CSS px for good quality
      wrapper.style.height = '1123px';
      wrapper.style.boxSizing = 'border-box';
      wrapper.style.padding = '48px';
      wrapper.style.background = '#ffffff'; // Force white background for PDF
      wrapper.style.color = theme.text || '#1c1917';
      wrapper.style.fontFamily = theme.font || 'Georgia, serif';
      wrapper.style.lineHeight = '1.6';
      wrapper.style.borderRadius = '8px';
      wrapper.style.fontSize = '20px';
      wrapper.style.position = 'absolute';
      wrapper.style.left = '-9999px';

      // add background ruled lines with darker color for visibility
      wrapper.style.backgroundImage = 'linear-gradient(#a89a87 1px, transparent 1px)';
      wrapper.style.backgroundSize = '100% 2.55rem';

      const titleEl = document.createElement('div');
      titleEl.style.fontWeight = '700';
      titleEl.style.marginBottom = '12px';
      titleEl.textContent = page.title ? page.title : '';
      wrapper.appendChild(titleEl);

      if (logoDataUrl && page.displayLogo) {
        const logoEl = document.createElement('img');
        logoEl.src = logoDataUrl;
        logoEl.style.maxWidth = '220px';
        logoEl.style.maxHeight = '100px';
        logoEl.style.display = 'block';
        logoEl.style.margin = '0 0 18px auto';
        logoEl.style.borderRadius = '12px';
        wrapper.appendChild(logoEl);
      }

      const contentEl = document.createElement('div');
      contentEl.style.whiteSpace = 'pre-wrap';
      contentEl.style.fontSize = '20px';
      contentEl.textContent = page.text || '';
      wrapper.appendChild(contentEl);

      if (Array.isArray(page.images) && page.images.length > 0) {
        const imgs = document.createElement('div');
        imgs.style.display = 'grid';
        imgs.style.gridTemplateColumns = '1fr 1fr';
        imgs.style.gap = '12px';
        imgs.style.marginTop = '16px';
        for (const img of page.images) {
          const im = document.createElement('img');
          im.src = img.dataUrl;
          im.style.width = '100%';
          im.style.height = 'auto';
          im.style.objectFit = 'cover';
          imgs.appendChild(im);
        }
        wrapper.appendChild(imgs);
      }

      return wrapper;
    }

    for (let i = 0; i < pages.length; i += 1) {
      const page = pages[i] || { title: '', text: '', images: [] };
      // paginate long text into multiple book pages
      const textChunks = paginateText(page.text || '');
      for (let chunkIndex=0; chunkIndex< textChunks.length; chunkIndex +=1) {
        const chunk = textChunks[chunkIndex];
        const pageObj = {
          title: chunkIndex === 0 ? page.title : (page.title ? `${page.title} (cont.)` : `Page ${i+1} (cont.)`),
          text: chunk,
          images: chunkIndex === 0 ? page.images : [],
          displayLogo: i === 0 && chunkIndex === 0,
        };
        const el = buildPageElement(pageObj);
        document.body.appendChild(el);
      try {
        const canvas = await html2canvas(el, { useCORS: true, backgroundColor: '#ffffff', scale: 1 });
        const imgData = canvas.toDataURL('image/jpeg', 0.95); // Higher quality for better line visibility
        // fit image into PDF page
        doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);
        if (!(i === pages.length - 1 && chunkIndex === textChunks.length - 1)) doc.addPage();
      } catch (err) {
        // fallback: render simple text page
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(12);
          const lines = doc.splitTextToSize(chunk || '', pageWidth - 100);
          let y = 60;
          lines.forEach((ln) => {
            doc.text(50, y, ln);
            y += 14;
          });
          if (!(i === pages.length - 1 && chunkIndex === textChunks.length - 1)) doc.addPage();
      } finally {
        document.body.removeChild(el);
        // remove the inner appended element for chunk case as well
        const appended = document.body.querySelectorAll('div[style*="left: -9999px"]');
        appended.forEach((n) => { try { if (n && n.parentNode) n.parentNode.removeChild(n); } catch {} });
      }
      }
    }

    doc.save(`${coverTitle.replace(/\s+/g, '_') || 'shared_diary_book'}.pdf`);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setEntry(null);

    if (!token) {
      setError("This share link is missing its access token.");
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    fetch(apiUrl("/public_shared_entry.php"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, current_email: user?.email || '' }),
    })
      .then((res) => readJson(res))
      .then((data) => {
        if (cancelled) return;
        if (data.status === "success" && data.entry) {
          setEntry(data.entry);
          return;
        }
        setError(data.message || "This shared entry is unavailable.");
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load this shared diary entry.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, user?.email]);

  useEffect(() => {
    let cancelled = false;
    let timerId;

    const loadPresence = async () => {
      if (!token) return;
      try {
        const res = await fetch(apiUrl("/share_presence.php"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, current_email: user?.email || '', page: activePage }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (data?.status === 'success') {
          setActiveUsers(data.active_users || []);
          setPresenceError('');
        }
      } catch (err) {
        if (!cancelled) setPresenceError('Could not refresh presence.');
      }
    };

    loadPresence();
    timerId = window.setInterval(loadPresence, 12000);
    return () => {
      cancelled = true;
      window.clearInterval(timerId);
    };
  }, [token, user?.email, activePage]);

  const theme = useMemo(() => {
    try {
      const mood = MOODS[String(entry?.emotion || "").toLowerCase()] || MOODS.gratitude;
      const sharedTheme = entry?.theme && typeof entry.theme === "object" ? entry.theme : {};
      return normalizeTheme({
        ...themePresets[0],
        ...sharedTheme,
        accent: sharedTheme.accent || mood.accent,
        page: sharedTheme.page || mood.wash,
      });
    } catch {
      return normalizeTheme(themePresets[0]);
    }
  }, [entry]);

  const contentText = pages.map(p => (p.text || '')).join(' ').trim() || "This shared diary entry has no visible text, but its memory is still here.";
  const mood = MOODS[String(entry?.emotion || "").toLowerCase()] || MOODS.gratitude;
  const dateLabel = safeDateLabel(entry?.diary_date || entry?.created_at);
  const wordCount = contentText.split(/\s+/).filter(Boolean).length;
  const minuteCount = Math.max(1, Math.ceil(wordCount / 180));

  if (loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-[#f7f4ee]">
        <div className="rounded-lg border border-orange-100 bg-white px-5 py-4 shadow-sm">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-orange-500" />
          <p className="mt-3 text-sm font-black text-stone-600">Opening shared diary...</p>
        </div>
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-[#f7f4ee] px-4">
        <ShareUnavailable error={error} onWrite={() => setShowNotebook(true)} />
        {showNotebook && (
          <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#f7f1e6]">
            <GuestNotebook source="share-unavailable" />
          </div>
        )}
      </div>
    );
  }
  

  const pageStyle = {
    backgroundColor: theme.page,
    color: theme.text,
    "--share-accent": theme.accent,
    "--share-writing-bg": theme.writingBg || '#fbf7f0',
    "--share-line": theme.line || 'rgba(148, 163, 184, 0.35)',
    "--share-font": theme.font || 'Georgia, serif',
  };

  return (
    <main className="min-h-screen bg-linear-to-br from-white via-stone-50 to-stone-100" style={pageStyle}>
      <section className="relative overflow-hidden border-b border-black/5 bg-white/60 backdrop-blur-sm">
        {theme.image && <div className="absolute inset-0 bg-cover bg-center opacity-15" style={{ backgroundImage: `url(${theme.image})` }} />}
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-12 lg:grid-cols-[1fr_380px] lg:items-start lg:py-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-2 text-xs font-black uppercase tracking-widest shadow-sm" style={{ color: theme.accent }}>
              <Sparkles className="h-4 w-4" />
              Shared diary entry
            </div>
            <h1 className="mt-6 max-w-3xl break-words text-5xl font-black leading-tight text-stone-950 sm:text-6xl">
              {entry.diary_title || "Untitled memory"}
            </h1>
            <div className="mt-6 flex flex-wrap gap-3">
              <Pill icon={BookOpen} text={mood.label} />
              <Pill icon={Clock3} text={`${minuteCount} min read`} />
              <Pill icon={LockKeyhole} text="Public link" />
            </div>
          </div>

          <aside className="rounded-3xl border border-white/50 bg-white/90 p-7 shadow-2xl backdrop-blur-sm">
            <p className="text-xs font-black uppercase tracking-widest text-stone-500">Pages shared with you</p>
            <div className="mt-4 flex items-center gap-3 rounded-full bg-stone-100 px-4 py-3">
              <span className="text-2xl">{mood.emoji}</span>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-stone-600">{mood.label}</p>
                <p className="text-sm font-bold text-stone-800">{pages.length} {pages.length === 1 ? 'page' : 'pages'}</p>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <button onClick={() => setShowNotebook(true)} className="inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-2xl bg-stone-950 px-4 text-sm font-black text-white transition hover:bg-stone-900 shadow-lg">
                <PenLine className="h-4 w-4" />
                Write your feeling
              </button>
              <Link to="/login" className="inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-2xl border border-stone-300 bg-white px-4 text-sm font-black text-stone-800 transition hover:bg-stone-50 shadow-md">
                <Share2 className="h-4 w-4" />
                Login to save
              </Link>
              {pages.length > 0 && (
                <button
                  onClick={exportShareBook}
                  disabled={!entry?.can_export}
                  className="inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-2xl shadow-lg transition disabled:opacity-50"
                  style={{ backgroundColor: theme.accent }}
                >
                  <BookOpen className="h-4 w-4" />
                  <span className="font-black text-white text-sm">Export as PDF</span>
                </button>
              )}
              {entry?.is_owner && (
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <label className="text-xs font-black uppercase tracking-widest text-stone-600">Add export logo</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => setLogoDataUrl(reader.result?.toString() || null);
                      reader.readAsDataURL(file);
                    }}
                    className="mt-3 w-full text-xs"
                  />
                </div>
              )}
            </div>
            {activeUsers.length > 0 && (
              <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-emerald-900">Live readers</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeUsers.map((viewer) => (
                    <span key={`${viewer.user_id}-${viewer.role}`} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-stone-700 shadow-sm border border-emerald-200">
                      <span className={`h-2 w-2 rounded-full ${viewer.role === 'owner' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      {viewer.full_name || viewer.username || viewer.user_email}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>

      <section className="px-4 py-10 sm:py-14">
        <article className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-white/30 bg-white/95 shadow-2xl">
          <header className="flex flex-col gap-4 border-b border-stone-100 bg-white/80 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <p className="text-xs font-black uppercase tracking-widest" style={{ color: theme.accent }}>Reading</p>
              <p className="mt-1 text-sm font-bold text-stone-600">{dateLabel}</p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest text-white shadow-lg" style={{ backgroundColor: theme.accent }}>
              <BookOpen className="h-4 w-4" />
              Page {activePage + 1} of {pages.length}
            </div>
          </header>

          <div
            className="relative min-h-96 px-6 py-8 sm:px-16 sm:py-12"
            style={{
              backgroundColor: theme.writingBg || '#fffef7',
              color: theme.text || '#111111',
              backgroundImage: `linear-gradient(${theme.line || 'rgba(148, 163, 184, 0.35)'} 1px, transparent 1px)`,
              backgroundSize: '100% 2.55rem',
            }}
          >
            <div className="absolute bottom-0 left-10 top-0 w-0.5 bg-slate-300/50 sm:left-16" />
            {pages[activePage] && (
              <article>
                {pages[activePage].title && (
                  <h3 className="mb-6 text-3xl font-bold" style={{ color: theme.text }}>{pages[activePage].title}</h3>
                )}
                {logoDataUrl && activePage === 0 && (
                  <div className="mb-8 flex justify-center">
                    <img src={logoDataUrl} alt="Share export logo" className="h-32 w-auto rounded-2xl border border-stone-200 object-contain shadow-lg" />
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words pl-6 text-2xl leading-[2.55rem] sm:pl-10" style={{ fontFamily: "var(--share-font)" }}>
                  {pages[activePage].text || ""}
                </div>
                {Array.isArray(pages[activePage].images) && pages[activePage].images.length > 0 && (
                  <div className="relative mt-8 grid gap-4 pl-6 sm:grid-cols-2 sm:pl-10">
                    {pages[activePage].images.map((image) => (
                      <img key={image.id || image.dataUrl} src={image.dataUrl} alt={image.name || "Diary attachment"} className="w-full rounded-2xl border border-stone-200 object-cover shadow-lg" />
                    ))}
                  </div>
                )}
              </article>
            )}
            <div ref={sentinelRef} className="h-8" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-stone-100 bg-white/80 p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-stone-100 px-4 py-2 text-xs font-black text-stone-700">Page {activePage + 1}/{pages.length}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <input 
                type="number" 
                min="1" 
                max={pages.length} 
                value={pageJump} 
                onChange={(e) => setPageJump(e.target.value)}
                className="w-20 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-stone-400" 
              />
              <button 
                onClick={() => {
                  const target = Number(pageJump);
                  if (!Number.isFinite(target) || target < 1 || target > pages.length) return;
                  setActivePage(target - 1);
                }}
                className="rounded-lg bg-stone-950 px-4 py-2 text-xs font-black text-white transition hover:bg-stone-800 shadow-md"
              >
                Go
              </button>
              {pages.length > 1 && (
                <>
                  <button 
                    onClick={() => setActivePage(Math.max(0, activePage - 1))}
                    disabled={activePage === 0}
                    className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-xs font-black text-stone-800 transition hover:bg-stone-50 disabled:opacity-40 shadow-md"
                  >
                    ← Prev
                  </button>
                  <button 
                    onClick={() => setActivePage(Math.min(pages.length - 1, activePage + 1))}
                    disabled={activePage === pages.length - 1}
                    className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-xs font-black text-stone-800 transition hover:bg-stone-50 disabled:opacity-40 shadow-md"
                  >
                    Next →
                  </button>
                </>
              )}
            </div>
          </div>
        </article>

        <div className="mx-auto mt-10 max-w-4xl rounded-3xl border border-white/30 bg-white/95 p-8 text-center shadow-lg">
          <p className="text-xs font-black uppercase tracking-widest text-stone-600">Share your thoughts</p>
          <h2 className="mt-4 text-3xl font-black text-stone-950">A diary is easier to start when you don't aim for perfection.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-6 text-stone-700">
            Write one line here without login. Your draft stays in this browser until you decide to save it.
          </p>
          <button onClick={() => setShowNotebook(true)} className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-black text-white transition hover:opacity-90 shadow-lg" style={{ backgroundColor: theme.accent }}>
            <PenLine className="h-4 w-4" />
            Write your feeling
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {showNotebook && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#f7f1e6]">
          <button
            onClick={() => setShowNotebook(false)}
            className="fixed right-4 top-4 z-[110] rounded-lg bg-white px-4 py-3 text-sm font-black text-stone-800 shadow-xl"
          >
            Back to shared page
          </button>
          <GuestNotebook source="share" />
        </div>
      )}
    </main>
  );
}

function ShareUnavailable({ error, onWrite }) {
  return (
    <div className="max-w-lg rounded-lg border border-amber-200 bg-white p-6 text-center shadow-xl">
      <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" />
      <h1 className="mt-3 text-2xl font-black text-stone-950">This shared page is not available</h1>
      <p className="mt-2 text-sm font-semibold leading-6 text-stone-500">
        {error || "The share link did not return a readable entry. The owner may need to generate a new link."}
      </p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <button onClick={onWrite} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-stone-950 px-4 text-sm font-black text-white">
          <PenLine className="h-4 w-4" />
          Write your feeling
        </button>
        <Link to="/login" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 text-sm font-black text-stone-800">
          Login
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function safeSplitDiaryImages(text = "") {
  try {
    return splitDiaryImages(text);
  } catch {
    return { text: String(text || ""), images: [] };
  }
}

function Pill({ icon: Icon, text }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-2 text-xs font-black uppercase tracking-widest text-stone-600 shadow-sm">
      <Icon className="h-4 w-4" />
      {text}
    </span>
  );
}

function safeDateLabel(value) {
  if (!value) return "Shared memory";
  return formatIndiaDate(value, { month: "long", day: "numeric", year: "numeric" });
}

async function readJson(response) {
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text ? "Server returned an invalid response." : "Server returned an empty response." };
  }
  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }
  return data;
}
