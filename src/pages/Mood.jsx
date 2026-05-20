import React, { useEffect, useState, useRef } from 'react';
import { Heart, Flame, Save, ArrowLeft, Loader2, ArrowRight, Sparkles, ImagePlus, Code2, RefreshCcw } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import MusicPlayer from '../component/MusicPlayer';
import CollaboratorModal from "../component/CollaboratorModal";
import { Users } from "lucide-react";
import { apiUrl, authUserPayload, postJson } from "../lib/api";
import DiaryAiHelper from "../component/DiaryAiHelper";
import WritingStats from "../component/WritingStats";
import DiaryMediaPreview from "../component/DiaryMediaPreview";
import { loadTheme } from "../lib/themes";
import { clearGuestDraft, loadGuestDraft } from "../lib/guestDraft";
import { composeDiaryContent, composeDiaryPages, defaultEditorCustomize, insertCodeBlock, normalizeEditorCustomize, resetEditorCustomize, safeImageId, shrinkImageFile, visibleEditorButtons } from "../lib/writingCustomize";
import { formatIndiaDate, todayIndiaInput } from "../lib/format";
const MOOD_CONFIG = {
  angry: {
    label: 'Angry',
    emoji: '😠',
    bg: 'bg-linear-to-br from-red-400 via-red-900 to-red-400',
    card: 'bg-red-50 border-red-600',
    text: 'text-red-900',
    btnSave: 'bg-linear-to-r from-red-700 to-red-900',
    btnBurn: 'bg-linear-to-r from-orange-700 to-red-800',
    font: 'font-bold',
  },
  confused: {
    label: 'Confused',
    emoji: '🤔',
    bg: 'bg-linear-to-br from-indigo-800 via-purple-300 to-slate-200',
    card: 'bg-indigo-50 border-indigo-300',
    text: 'text-indigo-900',
    btnSave: 'bg-linear-to-r from-indigo-500 to-purple-600',
    btnBurn: 'bg-linear-to-r from-purple-600 to-indigo-800',
    font: 'italic',
  },
  anxiety: {
    label: 'Anxiety',
    emoji: '😰',
    bg: 'bg-linear-to-br from-purple-400 via-purple-900 to-purple-400',
    card: 'bg-indigo-50 border-indigo-300',
    text: 'text-indigo-900',
    btnSave: 'bg-linear-to-r from-indigo-600 to-purple-700',
    btnBurn: 'bg-linear-to-r from-slate-700 to-indigo-900',
    font: 'tracking-tight',
  },
  stress: {
    label: 'Stress',
    emoji: '😫',
    bg: 'bg-linear-to-br from-gray-700 via-blue-300 to-gray-900',
    card: 'bg-orange-50 border-orange-300',
    text: 'text-orange-900',
    btnSave: 'bg-linear-to-r from-orange-500 to-amber-600',
    btnBurn: 'bg-linear-to-r from-amber-600 to-orange-700',
    font: 'tracking-wide',
  },
  sad: {
    label: 'Sad',
    emoji: '😢',
    bg: 'bg-linear-to-br from-[#889099] via-[#889099] to-[#E3F0FF]',
    card: 'bg-blue-50/95 border-blue-400',
    text: 'text-blue-900',
    btnSave: 'bg-linear-to-r from-blue-600 to-cyan-700',
    btnBurn: 'bg-linear-to-r from-cyan-700 to-blue-800',
    font: 'font-light',
  },
  gratitude: {
    label: 'Gratitude',
    emoji: '😊',
    bg: 'bg-linear-to-br from-[#FFE6D9] via-[#998A82] to-[#C07A52]',
    card: 'bg-white border-pink-200',
    text: 'text-pink-900',
    btnSave: 'bg-linear-to-r from-rose-500 to-pink-600',
    btnBurn: 'bg-linear-to-r from-pink-400 to-rose-400',
    font: 'font-normal',
  },
};

const STICKER_EMOJI = {
  star: "⭐",
  heart: "💗",
  note: "📝",
  spark: "✨",
  moon: "🌙",
  flower: "🌸",
};


function MoodSelectionPage({ onMoodSelect }) {
  const today = formatIndiaDate(new Date(), { day: "2-digit", month: "short", year: "numeric" });
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f8f5f1] p-4 sm:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <section className="diary-enter diary-floating rounded-lg border border-rose-100 bg-white p-6 shadow-xl sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-black uppercase tracking-widest text-rose-700">
            <Sparkles className="h-4 w-4" />
            Today is {today}
          </div>
          <h1 className="mt-5 text-4xl font-black leading-tight text-stone-950 sm:text-5xl">
            Welcome back to your quiet daily space.
          </h1>
          <p className="mt-4 text-base font-semibold leading-7 text-stone-600">
            Start with a mood check, then write the first honest sentence. Small daily returns build memory, clarity, and a reason to come back tomorrow.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => onMoodSelect({ ...MOOD_CONFIG.gratitude, id: "gratitude" })}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-stone-950 px-4 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              Start writing now
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigate("/daily-workspace")}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-black text-stone-800 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              Open daily workspace
            </button>
          </div>
          <div className="mt-6 rounded-lg bg-amber-50 p-4">
            <p className="text-xs font-black uppercase tracking-widest text-amber-700">Retention cue</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-amber-950">
              Write for two minutes. Save the truth, not the perfect paragraph.
            </p>
          </div>
        </section>

        <div className="diary-enter w-full" style={{ animationDelay: "120ms" }}>
          <div className="mb-8 text-center">
            <Heart className="mx-auto mb-4 h-11 w-11 animate-pulse text-rose-500" fill="currentColor" />
            <h2 className="text-2xl font-black text-gray-800 sm:text-3xl">How are you feeling right now?</h2>
            <p className="mt-2 text-sm font-bold uppercase tracking-widest text-gray-400">Pick the closest one. You can change later.</p>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {Object.entries(MOOD_CONFIG).map(([id, mood], index) => (
              <button
                key={id}
                onClick={() => onMoodSelect({ ...mood, id })}
                className="diary-card-enter diary-retention-card group relative flex min-h-40 flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border border-gray-100 bg-white p-5 shadow-lg transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl"
                style={{ animationDelay: `${180 + index * 70}ms` }}
              >
                <div className={`absolute inset-0 bg-linear-to-br ${mood.bg} opacity-0 transition-opacity group-hover:opacity-10`} />
                <div className="z-10 text-5xl transition-transform duration-500 group-hover:scale-110">{mood.emoji}</div>
                <span className="z-10 text-xs font-black uppercase tracking-widest text-gray-600">{mood.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WritingPage({ mood, onBack, onSave, onBurn, saving }) {
  const [pages, setPages] = useState([{ title: '', text: '', images: [] }]);
  const [activePage, setActivePage] = useState(0);
  const [pageJump, setPageJump] = useState('1');
  const [title, setTitle] = useState('');
  const MAX_CHARS_PER_PAGE = 2200;
  const [entryDate, setEntryDate] = useState(() => todayIndiaInput());
  const { user } = useAuth0();
  const [isBurning, setIsBurning] = useState(false);
  const [customTheme, setCustomTheme] = useState(loadTheme);
  const [writingCustomize, setWritingCustomize] = useState(defaultEditorCustomize);
  const theme = MOOD_CONFIG[mood.id];
  useEffect(() => {
    const syncTheme = () => setCustomTheme(loadTheme());
    window.addEventListener("silentlines-theme-updated", syncTheme);
    return () => window.removeEventListener("silentlines-theme-updated", syncTheme);
  }, []);
  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;
    fetch(`${apiUrl("/writing_customization.php")}?email=${encodeURIComponent(user.email)}`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.status === "success") setWritingCustomize(normalizeEditorCustomize(data.customization));
      })
      .catch(() => {});
    const syncCustomize = (event) => {
      if (event.detail?.customization) setWritingCustomize(normalizeEditorCustomize(event.detail.customization));
    };
    window.addEventListener("silentlines-writing-customized", syncCustomize);
    return () => {
      cancelled = true;
      window.removeEventListener("silentlines-writing-customized", syncCustomize);
    };
  }, [user?.email]);
  const fireAudioRef = useRef(null); // Add this ref for the sound
  const imageInputRef = useRef(null);
  const currentPage = pages[activePage] || { title: '', text: '', images: [] };
  
  const hasAnyContent = pages.some((page) => page.title || page.text.trim() || page.images.length > 0);
  const handleBurnAction = () => {
    if (!hasAnyContent) return;

    setIsBurning(true);

    // 🔊 Play the burning sound
    if (fireAudioRef.current) {
      fireAudioRef.current.currentTime = 0;
      fireAudioRef.current.play().catch(() => {});
    }

    // Timer to match the 2.5s - 3s CSS animation duration
    setTimeout(() => {
      onBurn(composeDiaryPages(pages));
      setIsBurning(false);
      setPages([{ title: '', text: '', images: [] }]);
      setActivePage(0);
      setPageJump('1');

      // Stop sound after burning finishes
      if (fireAudioRef.current) {
        fireAudioRef.current.pause();
      }
    }, 3000);
  };

  const insertImage = async (file) => {
    if (!file) return;
    try {
      const image = await shrinkImageFile(file);
      const name = file.name || `Image ${currentPage.images.length + 1}`;
      setPages((current) => current.map((page, pageIndex) => pageIndex === activePage ? {
        ...page,
        images: [...page.images, { id: safeImageId(), name, dataUrl: image }],
      } : page));
    } catch (err) {
      alert(err.message || "Could not insert image.");
    }
  };

  const removeEntryImage = (index) => {
    setPages((current) => current.map((page, pageIndex) => pageIndex === activePage ? {
      ...page,
      images: page.images.filter((_, itemIndex) => itemIndex !== index),
    } : page));
  };

  const resetWritingCustomize = async () => {
    if (!user?.email) return;
    try {
      const data = await postJson("/writing_customization.php", {
        email: user.email,
        action: "reset",
        customization: resetEditorCustomize(),
      });
      const next = normalizeEditorCustomize(data.customization);
      setWritingCustomize(next);
      window.dispatchEvent(new CustomEvent("silentlines-writing-customized", { detail: { customization: next } }));
    } catch (err) {
      alert(err.message || "Could not reset writing customization.");
    }
  };
  const addPage = () => {
    setPages((current) => {
      const next = [...current, { title: '', text: '', images: [] }];
      setActivePage(next.length - 1);
      setPageJump(String(next.length));
      return next;
    });
  };

  const removePage = (index) => {
    if (pages.length === 1) return;
    setPages((current) => {
      const next = current.filter((_, pageIndex) => pageIndex !== index);
      const nextActive = Math.min(activePage, next.length - 1);
      setActivePage(nextActive);
      setPageJump(String(nextActive + 1));
      return next;
    });
  };

  const updateCurrentPageText = (text) => {
    setPages((current) => current.map((page, pageIndex) => pageIndex === activePage ? { ...page, text } : page));
    // after state update, run overflow split synchronously based on latest pages array
    setTimeout(() => handleOverflowSplit(activePage), 40);
  };

  function paginateTextLocal(text) {
    if (!text) return [''];
    const chunks = [];
    let remaining = String(text);
    while (remaining.length > 0) {
      if (remaining.length <= MAX_CHARS_PER_PAGE) {
        chunks.push(remaining);
        break;
      }
      let splitAt = remaining.lastIndexOf('\n', MAX_CHARS_PER_PAGE);
      if (splitAt < Math.max(0, MAX_CHARS_PER_PAGE - 200)) {
        splitAt = remaining.lastIndexOf(' ', MAX_CHARS_PER_PAGE);
      }
      if (splitAt <= 0) splitAt = MAX_CHARS_PER_PAGE;
      const head = remaining.slice(0, splitAt).trimEnd();
      const tail = remaining.slice(splitAt).trimStart();
      chunks.push(head);
      remaining = tail;
    }
    return chunks;
  }

  function handleOverflowSplit(pageIndex) {
    setPages((current) => {
      const cur = [...current];
      const page = cur[pageIndex];
      if (!page) return cur;
      if ((page.text || '').length <= MAX_CHARS_PER_PAGE) return cur;
      const chunks = paginateTextLocal(page.text || '');
      // replace current page text with first chunk and insert remaining chunks as new pages
      cur[pageIndex] = { ...page, text: chunks[0] };
      const tailPages = chunks.slice(1).map((t, idx) => ({ title: page.title ? (idx === 0 ? `${page.title} (cont.)` : `${page.title} (cont.${idx+1})`) : '', text: t, images: idx === 0 ? page.images || [] : [] }));
      cur.splice(pageIndex + 1, 0, ...tailPages);
      return cur;
    });
  }



  const updateCurrentPageTitle = (titleText) => {
    setPages((current) => current.map((page, pageIndex) => pageIndex === activePage ? { ...page, title: titleText } : page));
  };

  const goToPageNumber = () => {
    const target = Number(pageJump);
    if (!Number.isFinite(target) || target < 1 || target > pages.length) return;
    setActivePage(target - 1);
  };

  useEffect(() => {
    setPageJump(String(activePage + 1));
  }, [activePage, pages.length]);

  

  const downloadBookPdf = async () => {
    // Use html2canvas to render each page to an image so that the exported PDF
    // preserves the notebook font, background lines and images. Compress images
    // to reduce final PDF size.
    const html2canvas = (await import('html2canvas')).default;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const coverTitle = title.trim() || 'My Diary Book';
    doc.setFillColor(customTheme.page || '#fff7ed');
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(customTheme.text || '#1c1917');
    doc.setFontSize(28);
    doc.text(coverTitle, pageWidth / 2, 140, { align: 'center' });
    doc.addPage();

    function buildPageElement(page) {
      const wrapper = document.createElement('div');
      wrapper.style.width = '794px';
      wrapper.style.height = '1123px';
      wrapper.style.boxSizing = 'border-box';
      wrapper.style.padding = '48px';
      wrapper.style.background = '#ffffff'; // Force white background for PDF
      wrapper.style.color = customTheme.text || '#1c1917';
      wrapper.style.fontFamily = customTheme.font || 'Georgia, serif';
      wrapper.style.lineHeight = '1.6';
      wrapper.style.fontSize = '20px';
      wrapper.style.position = 'absolute';
      wrapper.style.left = '-9999px';
      wrapper.style.backgroundImage = 'linear-gradient(#a89a87 1px, transparent 1px)'; // Darker lines for visibility
      wrapper.style.backgroundSize = '100% 2.55rem';

      const titleEl = document.createElement('div');
      titleEl.style.fontWeight = '700';
      titleEl.style.marginBottom = '12px';
      titleEl.textContent = page.title ? page.title : '';
      wrapper.appendChild(titleEl);

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
      const el = buildPageElement(page);
      document.body.appendChild(el);
      try {
        const canvas = await html2canvas(el, { useCORS: true, backgroundColor: '#ffffff', scale: 1 });
        const imgData = canvas.toDataURL('image/jpeg', 0.95); // Higher quality for better line visibility
        doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);
        if (i < pages.length - 1) doc.addPage();
      } catch (err) {
        // fallback to simple text rendering
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        const lines = doc.splitTextToSize(page.text || '', pageWidth - 100);
        let y = 60;
        lines.forEach((ln) => {
          doc.text(50, y, ln);
          y += 14;
        });
        if (i < pages.length - 1) doc.addPage();
      } finally {
        document.body.removeChild(el);
      }
    }

    doc.save(`${coverTitle.replace(/\s+/g, '_') || 'diary_book'}.pdf`);
  };

  return (
    <div
      className={`relative min-h-screen overflow-x-hidden bg-linear-to-br ${theme.bg} px-4 pb-32 pt-4 transition-colors duration-1000 md:px-8 md:pb-36 md:pt-8`}
      style={customTheme.image ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.18), rgba(0,0,0,0.18)), url(${customTheme.image})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
    >
      {writingCustomize.effects.includes("sparkle") && (
        <div 
          className="pointer-events-none fixed inset-0 z-1 opacity-70" 
          style={{
            backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18), transparent 18%), radial-gradient(circle at 80% 15%, rgba(255,255,255,0.16), transparent 16%), radial-gradient(circle at 35% 75%, rgba(255,255,255,0.1), transparent 16%)'
          }}
        />
      )}
      <MusicPlayer moodId={mood.id} MOOD_CONFIG={MOOD_CONFIG} />

      {/* BURNING ANIMATION OVERLAY */}
      {isBurning && (
        <>
          {/* Dark Backdrop with Glowing Flame */}
          <div className="fixed inset-0 z-400 flex items-center justify-center bg-black/90 backdrop-blur-lg">
            <div className="text-center">
              <div className="relative">
                <Flame className="w-48 h-48 text-orange-500 animate-pulse mx-auto filter drop-shadow-[0_0_30px_rgba(249,115,22,0.8)]" />
                {/* Subtle secondary glow layer */}
                <div className="absolute inset-0 bg-orange-600/20 blur-3xl rounded-full animate-pulse" />
              </div>
              <p className="text-white text-4xl font-serif italic mt-8 animate-bounce tracking-tight">
                Reducing to ashes...
              </p>
            </div>
          </div>

          {/* The Shredding Paper Effect (Horizontal Strips) */}
          <div className="fixed inset-0 z-999 pointer-events-none">
            {[...Array(25)].map((_, i) => (
              <div
                key={i}
                className="absolute left-0 w-full"
                style={{
                  height: "4.1%", // Slight overlap to prevent gaps
                  bottom: `${i * 4}%`,
                  background: "white",
                  animation: `burn-strip 2.5s ease-in forwards`,
                  animationDelay: `${i * 0.08}s`,
                  boxShadow: "0 -2px 10px rgba(0,0,0,0.1)"
                }}
              />
            ))}
          </div>

          {/* CSS Keyframes for the "Real" Burn */}
          <style>{`
      @keyframes burn-strip {
        0% { 
          transform: scaleX(1); 
          opacity: 1; 
          background: white; 
        }
        20% { 
          background: #ffedd5; /* Off-white heat */
        }
        40% { 
          background: #f97316; /* Bright Orange Fire */
          box-shadow: 0 0 20px #f97316;
        }
        60% {
          background: #444; /* Dark Carbon */
        }
        100% { 
          transform: scaleX(0); 
          opacity: 0; 
          background: #000; 
        }
      }
    `}</style>
        </>
      )}

      <div className={`relative z-10 mx-auto max-w-6xl ${writingCustomize.effects.includes("glow") ? "drop-shadow-[0_0_24px_rgba(255,255,255,0.18)]" : ""}`}>
        <button onClick={onBack} className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/20 px-4 py-2 text-sm font-black text-white/90 transition hover:bg-white/30 hover:text-white mb-8">
          <ArrowLeft className="w-5 h-5" /> <span>Change Mood</span>
        </button>

        <div className={`${theme.card} bg-white/95 rounded-3xl shadow-2xl overflow-hidden flex flex-col min-h-[calc(100vh-8rem)] relative border-l-4 border-l-gray-300`}>
          <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-white/50 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{mood.emoji}</span>
              <h2 className={`text-xl font-bold ${theme.text} uppercase tracking-tighter`}>{mood.label} Entry</h2>
            </div>
            <div className="h-2 w-24 bg-gray-200 rounded-full hidden md:block" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-white/80 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              {pages.map((page, pageIndex) => (
                <button
                  key={`page-${pageIndex}`}
                  type="button"
                  onClick={() => setActivePage(pageIndex)}
                  className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest transition ${activePage === pageIndex ? "bg-stone-950 text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200"}`}
                >
                  {page.title ? `P${pageIndex + 1}: ${page.title}` : `Page ${pageIndex + 1}`}
                </button>
              ))}
              <button
                type="button"
                onClick={addPage}
                className="rounded-full bg-emerald-100 px-4 py-2 text-xs font-black uppercase tracking-widest text-emerald-800 hover:bg-emerald-200"
              >
                + Add page
              </button>
              {pages.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePage(activePage)}
                  className="rounded-full bg-rose-100 px-4 py-2 text-xs font-black uppercase tracking-widest text-rose-700 hover:bg-rose-200"
                >
                  Remove page
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr] sm:gap-4">
              <label className="text-xs font-black uppercase tracking-widest text-gray-500">
                Title / Caption
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Example: The day I finally said it"
                  className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-gray-900 outline-none focus:ring-4 focus:ring-orange-100"
                />
              </label>
              <label className="text-xs font-black uppercase tracking-widest text-gray-500">
                Diary Date
                <input
                  type="date"
                  value={entryDate}
                  onChange={(event) => setEntryDate(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-gray-900 outline-none focus:ring-4 focus:ring-orange-100"
                />
              </label>
            </div>
          </div>
          <div className="grid gap-3 border-b border-gray-100 bg-white/80 p-4 sm:grid-cols-[1fr_1fr] sm:gap-4">
            <label className="text-xs font-black uppercase tracking-widest text-gray-500">
              Page name
              <input
                value={currentPage.title}
                onChange={(event) => updateCurrentPageTitle(event.target.value)}
                placeholder="Page title"
                className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-gray-900 outline-none focus:ring-4 focus:ring-orange-100"
              />
            </label>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-gray-500">Jump to page</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max={pages.length}
                  value={pageJump}
                  onChange={(event) => setPageJump(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-900 outline-none focus:ring-4 focus:ring-orange-100"
                />
                <button
                  type="button"
                  onClick={goToPageNumber}
                  className="rounded-lg bg-stone-950 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-stone-800"
                >
                  Go
                </button>
              </div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{pages.length} pages</p>
            </div>
          </div>

          <WritingStats content={composeDiaryPages(pages)} />
          <div className="relative grow min-h-[calc(100vh-16rem)]"
            style={{
              backgroundColor: 'var(--sl-writing-bg)',
              backgroundImage: 'linear-gradient(var(--sl-writing-line) 1px, transparent 1px)',
              backgroundSize: '100% 2.5rem'
            }}>
            <div className="absolute left-12 top-0 bottom-0 w-px bg-red-200" />
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => insertImage(event.target.files?.[0])} />
            <textarea
              autoFocus
              value={currentPage.text}
              onChange={(e) => updateCurrentPageText(e.target.value)}
              placeholder="Write this page..."
              className={`absolute inset-0 h-full min-h-full w-full resize-none bg-transparent p-6 pl-16 text-lg leading-10 border-none placeholder:text-stone-400 focus:ring-0 sm:p-12 sm:pl-20 ${writingCustomize.code_mode ? "font-mono sm:text-lg" : `sm:text-2xl ${theme.font}`}`}
              style={{ color: "var(--sl-writing-text)", fontFamily: "var(--sl-font)" }}
            />
          </div>
          <DiaryMediaPreview content={currentPage.images} onRemove={removeEntryImage} />
          {writingCustomize.stickers.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-gray-100 bg-white/80 px-4 py-3">
              {writingCustomize.stickers.map((sticker) => (
                <button
                  key={sticker}
                  type="button"
                  onClick={() => updateCurrentPageText(`${currentPage.text}${currentPage.text.trim() ? " " : ""}${STICKER_EMOJI[sticker] || "✨"}`)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm"
                >
                  <span>{STICKER_EMOJI[sticker] || "✨"}</span>
                  <span>{sticker}</span>
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 border-t border-gray-100 bg-white/80 p-4 sm:flex sm:p-6">
            {visibleEditorButtons(writingCustomize).filter((button) => button.id !== "share" && button.id !== "commits").map((button) => {
              if (button.id === "save") return <button key={button.id} onClick={() => onSave({ pages, title, entryDate })} disabled={!hasAnyContent || saving} className={`flex min-h-14 items-center justify-center gap-2 rounded-xl bg-linear-to-r ${theme.btnSave} px-3 py-4 text-sm font-black text-white shadow-lg transition-all hover:opacity-90 disabled:grayscale sm:flex-1`}>{saving ? <><Loader2 className="w-5 h-5 animate-spin" /><span>Saving...</span></> : <><Heart className="w-5 h-5" fill="white" />Save</>}</button>;
              if (button.id === "image") return <button key={button.id} onClick={() => imageInputRef.current?.click()} className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-4 text-sm font-black text-white shadow-lg sm:flex-1"><ImagePlus className="w-5 h-5" />Image</button>;
              if (button.id === "code") return <button key={button.id} onClick={() => updateCurrentPageText(`${currentPage.text}${insertCodeBlock("")}`)} className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-3 py-4 text-sm font-black text-white shadow-lg sm:flex-1"><Code2 className="w-5 h-5" />Code</button>;
              if (button.id === "burn") return <button key={button.id} onClick={handleBurnAction} disabled={!currentPage.text.trim() && currentPage.images.length === 0 || saving} className={`flex min-h-14 items-center justify-center gap-2 rounded-xl bg-linear-to-r ${theme.btnBurn} px-3 py-4 text-sm font-black text-white shadow-lg transition-all hover:opacity-90 disabled:grayscale sm:flex-1`}><Flame className="w-5 h-5" />Burn</button>;
              if (button.id === "reset") return <button key={button.id} onClick={resetWritingCustomize} className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-4 text-sm font-black text-stone-800 shadow-lg sm:flex-1"><RefreshCcw className="w-5 h-5" />Reset</button>;
              return null;
            })}
            <button onClick={downloadBookPdf} disabled={!hasAnyContent} className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-4 text-sm font-black text-white shadow-lg sm:flex-1 hover:bg-amber-600 disabled:opacity-50" type="button">
              <span>Download Book</span>
            </button>
          </div>
        </div>
      </div>
      <DiaryAiHelper
        email={user?.email}
        entryTitle={title || "New diary entry"}
        content={composeDiaryPages(pages)}
        mood={mood.id}
        onInsert={(text) => updateCurrentPageText(`${currentPage.text}${text}`)}
      />
    </div>
  );
}

export default function DiaryApp() {
  const [currentPage, setCurrentPage] = useState('mood');
  const [selectedMood, setSelectedMood] = useState(null);
  const [saving, setSaving] = useState(false);
  const [guestDraft, setGuestDraft] = useState(null);
  const { user, isAuthenticated } = useAuth0();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) return;
    const draft = loadGuestDraft();
    if (draft && (draft.content.trim() || draft.title.trim())) {
      setGuestDraft(draft);
    }
  }, [isAuthenticated]);

  const saveGuestDraftToAccount = async () => {
    if (!guestDraft || !isAuthenticated || !user?.email) return;
    const moodId = MOOD_CONFIG[guestDraft.mood] ? guestDraft.mood : "gratitude";
    try {
      setSaving(true);
      const res = await fetch(apiUrl("/save_entry.php"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...authUserPayload(user),
          entry: guestDraft.content,
          entry_text: guestDraft.content,
          diary_title: guestDraft.title,
          diary_date: guestDraft.entryDate,
          emotion: moodId,
          mood: moodId,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== "success") {
        throw new Error(data.message || `Save failed with status ${res.status}`);
      }
      const newEntry = {
        id: data.id || Date.now(),
        entry_text: guestDraft.content,
        emotion: moodId,
        user_email: user.email,
        user_full_name: user.name || user.nickname || "",
        created_at: new Date().toISOString(),
        diary_title: guestDraft.title,
        diary_date: guestDraft.entryDate,
      };
      const cached = JSON.parse(localStorage.getItem("diary_instant") || "[]");
      localStorage.setItem("diary_instant", JSON.stringify([newEntry, ...cached]));
      clearGuestDraft();
      setGuestDraft(null);
      window.dispatchEvent(new Event("diary-added"));
      navigate("/notes");
    } catch (error) {
      alert(error?.message || "Could not save your guest draft.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (payload) => {
    const pages = typeof payload === "object" ? payload?.pages || [] : [];
    const content = typeof payload === "string" ? payload : payload?.content || "";
    const entryImages = typeof payload === "object" ? payload?.entryImages || [] : [];
    const saveContent = pages.length ? composeDiaryPages(pages) : composeDiaryContent(content, entryImages);
    const title = typeof payload === "object" ? payload?.title || "" : "";
    const entryDate = typeof payload === "object" ? payload?.entryDate || todayIndiaInput() : todayIndiaInput();
    const hasContent = pages.length ? pages.some((page) => page.title || page.text.trim() || page.images.length > 0) : content.trim() || entryImages.length > 0;

    if (!isAuthenticated || !user || !hasContent || !selectedMood) {
      console.warn("Save validation failed:", { isAuthenticated, user: !!user, hasContent, selectedMood: !!selectedMood });
      return;
    }
    try {
      setSaving(true);
      const res = await fetch(apiUrl("/save_entry.php"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...authUserPayload(user),
          entry: saveContent,
          entry_text: saveContent,
          diary_title: title,
          diary_date: entryDate,
          emotion: selectedMood.id,
          mood: selectedMood.id,
        }),
      });

      // console.log("Save response status:", res.status);
      const data = await res.json();
      // console.log("Save response data:", data);

      if (!res.ok || data.status !== "success") {
        throw new Error(data.message || `Save failed with status ${res.status}`);
      }

      const newEntry = {
        id: data.id || Date.now(),
        entry_text: saveContent,
        emotion: selectedMood.id,
        user_email: user.email,
        user_full_name: user.name || user.nickname || "",
        created_at: new Date().toISOString(),
        diary_title: title,
        diary_date: entryDate,
      };

      const cached = JSON.parse(localStorage.getItem("diary_instant")) || [];
      localStorage.setItem("diary_instant", JSON.stringify([newEntry, ...cached]));
      // console.log("Entry saved to cache, dispatching diary-added event");
      
      window.dispatchEvent(new Event("diary-added"));

      setSaving(false);
      
      // Small delay to ensure backend has processed
      setTimeout(() => {
        navigate("/notes");
      }, 300);
    } catch (error) {
      setSaving(false);
      console.error("Save error:", error);
      alert(error?.message || "Server error while saving entry");
    }
  };

  return (
    <div className="font-sans antialiased">
      {guestDraft && (
        <div className="fixed inset-0 z-2600 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-lg border border-amber-200 bg-white p-5 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-widest text-rose-700">Guest draft found</p>
            <h2 className="mt-2 text-2xl font-black text-stone-950">Save the note you wrote before login?</h2>
            <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm font-semibold leading-6 text-stone-600">
              {guestDraft.title ? `${guestDraft.title}\n` : ""}{guestDraft.content}
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <button
                onClick={saveGuestDraftToAccount}
                disabled={saving}
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-stone-950 px-4 text-sm font-black text-white disabled:opacity-50 sm:col-span-2"
              >
                {saving ? "Saving..." : "Save to my diary"}
              </button>
              <button
                onClick={() => setGuestDraft(null)}
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-stone-200 bg-white px-4 text-sm font-black text-stone-700"
              >
                Later
              </button>
            </div>
            <button
              onClick={() => {
                clearGuestDraft();
                setGuestDraft(null);
              }}
              className="mt-3 text-xs font-black uppercase tracking-widest text-stone-400 underline underline-offset-4"
            >
              Discard guest draft
            </button>
          </div>
        </div>
      )}
      {currentPage === "mood" ? (
        <MoodSelectionPage onMoodSelect={(mood) => { setSelectedMood(mood); setCurrentPage("write"); }} />
      ) : (
        <WritingPage
          mood={selectedMood}
          saving={saving}
          onBack={() => setCurrentPage("mood")}
          onSave={handleSave}
          onBurn={() => {}}
        />
      )}

      {saving && (
        <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white px-6 py-4 rounded-xl shadow-xl text-sm font-semibold">
            Saving your thoughts…
          </div>
        </div>
      )}
    </div>
  );
}
