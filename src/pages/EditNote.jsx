import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Save, Flame, ArrowLeft, X, Loader2, CheckCircle2, AlertTriangle, ImagePlus, Code2, RefreshCcw, SlidersHorizontal, BellOff, Crown, UserRound, BookOpen } from "lucide-react";
import { jsPDF } from "jspdf";
import { useAuth0 } from "@auth0/auth0-react";
import MusicPlayer from '../component/MusicPlayer';
import { Users } from "lucide-react"; // For the share icon
import CollaboratorModal from "../component/CollaboratorModal"; // Adjust path if needed
import { apiUrl, authUserPayload, postJson } from "../lib/api";
import DiaryAiHelper from "../component/DiaryAiHelper";
import DiaryCommits from "../component/DiaryCommits";
import WritingStats from "../component/WritingStats";
import DiaryMediaPreview from "../component/DiaryMediaPreview";
import { loadTheme } from "../lib/themes";
import { composeDiaryPages, defaultEditorCustomize, insertCodeBlock, normalizeEditorCustomize, resetEditorCustomize, safeImageId, shrinkImageFile, splitDiaryPages } from "../lib/writingCustomize";
import { dateInputIndia, formatIndiaDateTime, publicUserLabel, publicUsername, todayIndiaInput } from "../lib/format";
const MOOD_CONFIG = {
    angry: {
        label: 'Angry',
        emoji: '😠',
        bg: 'from-red-900 via-orange-950 to-black',
        img: 'https://images.unsplash.com/photo-1578353121530-3c220cc442b1?q=80&w=2070',
        card: 'bg-stone-100 border-red-500',
        text: 'text-red-900',
        btnSave: 'from-red-600 to-red-800',
        btnBurn: 'from-orange-600 to-red-600',
        tracks: [],
        font: 'font-bold'
    },
    confused: {
        label: 'Confused',
        emoji: '🤔',
        bg: 'from-indigo-900 via-purple-900 to-slate-900',
        img: 'https://images.unsplash.com/photo-1533073356960-72e5683d288d?q=80&w=2070',
        card: 'bg-indigo-50 border-indigo-300',
        text: 'text-indigo-900',
        btnSave: 'from-indigo-500 to-purple-600',
        btnBurn: 'from-purple-600 to-indigo-800',
        tracks: [],
        font: 'italic'
    },
    anxiety: {
        label: 'Anxiety',
        emoji: '😰',
        bg: 'from-slate-800 via-gray-900 to-slate-950',
        img: 'https://images.unsplash.com/photo-1499200632172-c51638347987?q=80&w=2071',
        card: 'bg-gray-100 border-slate-400',
        text: 'text-slate-900',
        btnSave: 'from-slate-600 to-slate-800',
        btnBurn: 'from-gray-700 to-slate-900',
        tracks: [],
        font: 'tracking-tight'
    },
    stress: {
        label: 'Stress',
        emoji: '😫',
        bg: 'from-orange-200 via-amber-100 to-orange-50',
        img: 'https://images.unsplash.com/photo-1512438248247-f0f2a5a8b7f0?q=80&w=1964',
        card: 'bg-orange-50 border-orange-300',
        text: 'text-orange-900',
        btnSave: 'from-orange-500 to-amber-600',
        btnBurn: 'from-amber-600 to-orange-700',
        tracks: [],
        font: 'tracking-wide'
    },
    sad: {
        label: 'Sad',
        emoji: '😢',
        bg: 'from-blue-900 via-slate-900 to-black',
        img: 'https://images.unsplash.com/photo-1516585427167-9f4af9627e6c?q=80&w=2080',
        card: 'bg-blue-50/95 border-blue-400',
        text: 'text-blue-900',
        btnSave: 'from-blue-600 to-cyan-700',
        btnBurn: 'from-cyan-700 to-blue-800',
        tracks: [],
        font: 'font-light'
    },
    gratitude: {
        label: 'Gratitude',
        emoji: '😊',
        bg: 'from-rose-200 via-pink-100 to-orange-100',
        img: 'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?q=80&w=2070',
        card: 'bg-white border-pink-200',
        text: 'text-pink-900',
        btnSave: 'from-rose-500 to-pink-600',
        btnBurn: 'from-pink-400 to-rose-400',
        tracks: [],
        font: 'font-normal'
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

export default function EditNote() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation(); // Hook to access passed state
    const { user, isAuthenticated, isLoading } = useAuth0();

    const initialPages = splitDiaryPages(location.state?.entry?.entry_text || "");
    const [pages, setPages] = useState(initialPages.length ? initialPages : [{ title: "", text: "", images: [] }]);
    const [activePage, setActivePage] = useState(0);
    const [pageJump, setPageJump] = useState('1');
    const [selectedMood, setSelectedMood] = useState(location.state?.entry?.emotion || "stress");
    const [title, setTitle] = useState(location.state?.entry?.diary_title || "");
    const [entryDate, setEntryDate] = useState(location.state?.entry?.diary_date || todayIndiaInput());
    // Only show loading if we didn't get data from navigation state
    const [loading, setLoading] = useState(!location.state?.entry);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [isBurning, setIsBurning] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [customError, setCustomError] = useState(""); // State for custom error message
    const fireAudioRef = useRef(null);
    const imageInputRef = useRef(null);
    const pageRef = useRef(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showEntrySettings, setShowEntrySettings] = useState(false);
    const [errorToast, setErrorToast] = useState(null); // Holds the error message
    const [activeEditors, setActiveEditors] = useState([]);
    const [presenceError, setPresenceError] = useState('');
    const [customTheme, setCustomTheme] = useState(loadTheme);
    const [writingCustomize, setWritingCustomize] = useState(defaultEditorCustomize);
    useEffect(() => {
        const fetchEntry = async () => {
            if (!isAuthenticated || !user?.email) {
                setLoading(false);
                return;
            }

            // Using data passed from the navigation state (instant view)
            if (location.state?.entry) {
                const entryData = location.state.entry;
                const pages = splitDiaryPages(entryData.entry_text || "");
                setPages(pages.length ? pages : [{ text: "", images: [] }]);
                setActivePage(0);
                setSelectedMood(entryData.emotion || 'stress');
                setTitle(entryData.diary_title || "");
                setEntryDate(entryData.diary_date || dateInputIndia(entryData.created_at || Date.now()));
                setLoading(false);
                return;
            }

            try {
                const res = await fetch(apiUrl("/get_entry.php"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ entry_id: id, ...authUserPayload(user) }),
                });
                const data = await res.json();
                if (data.status === "success") {
                    const pages = splitDiaryPages(data.entry.entry_text || "");
                    setPages(pages.length ? pages : [{ text: "", images: [] }]);
                    setActivePage(0);
                    setSelectedMood(data.entry.emotion || 'stress');
                    setTitle(data.entry.diary_title || "");
                    setEntryDate(data.entry.diary_date || dateInputIndia(data.entry.created_at || Date.now()));
                } else {
                    setCustomError(data.message || "Entry was not found.");
                }
            } catch {
                setCustomError("Failed to connect to server");
            } finally {
                setLoading(false);
            }
        };

        fetchEntry();
    }, [id, user, isAuthenticated, location.state]);

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

    const currentPage = pages[activePage] || { title: "", text: "", images: [] };
    const cursorHint = currentPage.title || currentPage.text.slice(0, 60).replace(/\s+/g, ' ').trim();

    useEffect(() => {
        if (!user?.email || !id) return;
        let cancelled = false;
        let timerId;

        const reportPresence = async () => {
            try {
                const res = await fetch(apiUrl("/entry_presence.php"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        entry_id: Number(id),
                        current_email: user.email,
                        page: activePage,
                        cursor: cursorHint,
                    }),
                });
                const data = await res.json().catch(() => ({}));
                if (cancelled) return;
                if (data?.status === "success") {
                    const others = (data.active_users || []).filter((editor) => editor.user_email?.toLowerCase() !== user.email.toLowerCase());
                    setActiveEditors(others);
                    setPresenceError('');
                }
            } catch (err) {
                if (!cancelled) setPresenceError('Could not refresh live editing status.');
            }
        };

        reportPresence();
        timerId = window.setInterval(reportPresence, 12000);
        return () => {
            cancelled = true;
            window.clearInterval(timerId);
        };
    }, [id, user?.email, activePage, cursorHint]);

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
            setCustomError(err.message || "Could not insert image.");
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
            setCustomError(err.message || "Could not reset writing customization.");
        }
    };

    const addPage = () => {
        setPages((current) => {
            const next = [...current, { title: "", text: "", images: [] }];
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
        setTimeout(() => handleOverflowSplit(activePage), 40);
    };

    

    const updateCurrentPageTitle = (titleText) => {
        setPages((current) => current.map((page, pageIndex) => pageIndex === activePage ? { ...page, title: titleText } : page));
    };

    const MAX_CHARS_PER_PAGE = 2200;

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
            cur[pageIndex] = { ...page, text: chunks[0] };
            const tailPages = chunks.slice(1).map((t, idx) => ({ title: page.title ? (idx === 0 ? `${page.title} (cont.)` : `${page.title} (cont.${idx+1})`) : '', text: t, images: idx === 0 ? page.images || [] : [] }));
            cur.splice(pageIndex + 1, 0, ...tailPages);
            return cur;
        });
    }

    const goToPageNumber = () => {
        const target = Number(pageJump);
        if (!Number.isFinite(target) || target < 1 || target > pages.length) return;
        setActivePage(target - 1);
    };

    useEffect(() => {
        setPageJump(String(activePage + 1));
    }, [activePage, pages.length]);

    

    const downloadBookPdf = async () => {
        const html2canvas = (await import('html2canvas')).default;
        const doc = new jsPDF({ unit: 'pt', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const coverTitle = title.trim() || 'My Diary Book';
        const exportTheme = loadTheme();
        doc.setFillColor(exportTheme.page || '#fff7ed');
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(exportTheme.text || '#1c1917');
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
            wrapper.style.color = exportTheme.text || '#1c1917';
            wrapper.style.fontFamily = exportTheme.font || 'Georgia, serif';
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
                const canvas = await html2canvas(el, { useCORS: true, backgroundColor: null, scale: 1 });
                const imgData = canvas.toDataURL('image/jpeg', 0.7);
                doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);
                if (i < pages.length - 1) doc.addPage();
            } catch (err) {
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


    const handleSave = async () => {
        const hasContent = pages.some((page) => page.text.trim() || page.images.length > 0);
        if (!hasContent) return;
        setSaving(true);
        try {
            const response = await fetch(apiUrl("/update_entry.php"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    ...authUserPayload(user),
                    entry_id: id,
                    entry: composeDiaryPages(pages),
                    entry_text: composeDiaryPages(pages),
                    diary_title: title,
                    diary_date: entryDate,
                    emotion: selectedMood,
                    mood: selectedMood,
                }),
            });

            const data = await response.json();
            if (data.status !== "success") {
                throw new Error(data.message || "Update failed");
            }

            setSaving(false);
            window.dispatchEvent(new Event("diary-updated"));
            setSaveSuccess(true);
            setTimeout(() => navigate("/notes"), 2500);
        } catch (error) {
            setSaving(false);
            setCustomError(error?.message || "Error saving your feelings.");
        }
    };

    const startBurningProcess = () => {
        setShowConfirm(false);
        setIsBurning(true);
        fireAudioRef.current?.play().catch(() => { });

        setTimeout(async () => {
            try {
                const response = await fetch(apiUrl("/delete_entry.php"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ entry_id: id, ...authUserPayload(user) }),
                });

                const data = await response.json();

                if (data.status === "success") {
                    navigate("/notes");
                } else {
                    // Stop the fire animation because it failed
                    setIsBurning(false);
                    fireAudioRef.current?.pause();
                    // Show the custom error message
                    setErrorToast(data.message);
                    // Hide it automatically after 4 seconds
                    setTimeout(() => setErrorToast(null), 4000);
                }
            } catch {
                setIsBurning(false);
                setErrorToast("Connection lost. Could not delete note.");
            }
        }, 2800);
    };

    if (loading || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-stone-100">
                <Loader2 className="animate-spin w-8 h-8 text-orange-500" />
            </div>
        );
    }

    const theme = MOOD_CONFIG[selectedMood] || MOOD_CONFIG.stress;

    return (
        <div className="relative flex min-h-screen flex-col items-center justify-start overflow-x-hidden px-3 pb-40 pt-5 sm:justify-center sm:px-4 sm:pb-36 sm:pt-4">
            <audio ref={fireAudioRef} src="/sounds/fire.mp3" />
            {customError && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-100 w-[90%] max-w-md">
                    <div className="bg-red-50 border-2 border-red-200 p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                        <div className="bg-red-500 p-2 rounded-full text-white">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <p className="text-red-900 font-bold text-sm">{customError}</p>
                        </div>
                        <button
                            onClick={() => setCustomError("")}
                            className="text-red-400 hover:text-red-600 transition-colors"
                            aria-label="Dismiss error message"
                            title="Dismiss error"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}
            {/* Custom Error Toast */}
            {errorToast && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-1000 w-[90%] max-w-sm animate-bounce">
                    <div className="bg-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border-2 border-white/20">
                        <AlertTriangle className="w-6 h-6 shrink-0" />
                        <p className="font-bold text-sm leading-tight">{errorToast}</p>
                        <button onClick={() => setErrorToast(null)} className="ml-auto" aria-label="Dismiss delete error" title="Dismiss error">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
            {/* BACKGROUND IMAGE LAYER */}
            <div
                className="absolute inset-0 transition-all duration-1000 ease-in-out bg-cover bg-center"
                style={{ backgroundImage: `url(${customTheme.image || theme.img})` }}
            >
                <div className={`absolute inset-0 bg-linear-to-br ${theme.bg} opacity-80 backdrop-blur-[2px]`} />
                {customTheme.image && <div className="absolute inset-0 bg-black/20" />}
            </div>
            {writingCustomize.effects.includes("sparkle") && <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_18%),radial-gradient(circle_at_80%_15%,rgba(255,255,255,0.16),transparent_16%),radial-gradient(circle_at_35%_75%,rgba(255,255,255,0.1),transparent_16%)] opacity-70" />}

            <MusicPlayer moodId={selectedMood} MOOD_CONFIG={MOOD_CONFIG} />

            {/* CUSTOM SAVE SUCCESS DIALOG */}
            {saveSuccess && (
                <div className="fixed inset-0 z-500 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl text-center transform animate-in zoom-in-90 duration-300">
                        <div className="bg-green-50 w-20 h-20 rounded-full flex items-center justify-center mb-6 mx-auto">
                            <CheckCircle2 className="w-10 h-10 text-green-500 animate-bounce" />
                        </div>
                        <h3 className="text-3xl font-black text-gray-900 mb-3 tracking-tighter">Feelings Saved!</h3>
                        <p className="text-gray-500 leading-relaxed font-medium">Your thoughts have been safely archived.</p>
                        <div className="mt-8">
                            <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 animate-[progress_2.5s_linear]" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CUSTOM BURN CONFIRMATION DIALOG */}
            {showConfirm && (
                <div className="fixed inset-0 z-300 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-red-100">
                        <div className="bg-red-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                            <AlertTriangle className="w-8 h-8 text-red-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 text-center mb-2">Burn this memory?</h3>
                        <p className="text-gray-500 text-center mb-8">This action is irreversible. The note will be reduced to ash.</p>
                        <div className="flex flex-col gap-3">
                            <button onClick={startBurningProcess} className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors">Yes, Burn it</button>
                            <button onClick={() => setShowConfirm(false)} className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors">Keep it</button>
                        </div>
                    </div>
                </div>
            )}

            {/* BURNING ANIMATION OVERLAY */}
            {isBurning && (
                <div className="fixed inset-0 z-400 flex items-center justify-center bg-black/90 backdrop-blur-lg">
                    <div className="text-center">
                        <div className="relative">
                            <Flame className="w-48 h-48 text-orange-500 animate-pulse mx-auto filter drop-shadow-[0_0_30px_rgba(249,115,22,0.8)]" />
                        </div>
                        <p className="mt-8 animate-bounce px-4 text-2xl font-serif italic text-white sm:text-4xl">Reducing to ashes...</p>
                    </div>
                </div>
            )}

            <div className={`relative z-10 w-full max-w-5xl ${writingCustomize.effects.includes("glow") ? "drop-shadow-[0_0_24px_rgba(255,255,255,0.18)]" : ""}`}>
                <button onClick={() => navigate("/notes")} className="group mb-4 flex min-h-11 items-center gap-2 rounded-lg bg-black/25 px-3 text-white/90 transition-all hover:text-white sm:mb-6 sm:bg-transparent sm:px-0" aria-label="Return to saved notes">
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    <span className="font-bold tracking-widest uppercase text-xs">Return to Archives</span>
                </button>

                {/* NOTEBOOK UI */}
                <div ref={pageRef} className={`diary-print-area ${theme.card} relative flex min-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-xl border-l-10 border-l-stone-400 shadow-2xl transition-all duration-700 sm:min-h-[calc(100vh-7rem)] sm:border-l-18`}>
                    <div className="flex flex-col gap-4 border-b border-gray-200 bg-white/70 p-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:p-6">
                        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                            <span className="text-3xl">{theme.emoji}</span>
                            <div className="min-w-0">
                                <h2 className={`truncate text-lg font-black ${theme.text} uppercase tracking-widest sm:text-xl`}>Editing Memory</h2>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Draft ID: {id?.slice(0, 8)}</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            {activeEditors.length > 0 && (
                                <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-emerald-900 shadow-sm">
                                    {activeEditors.length === 1 ? "1 other is" : `${activeEditors.length} others are`} editing this page
                                </div>
                            )}
                            <div className="flex items-center gap-3 rounded-xl border border-gray-200/50 bg-stone-100/50 p-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Mood:</label>
                                <select
                                    value={selectedMood}
                                    onChange={(e) => setSelectedMood(e.target.value)}
                                    className="bg-transparent border-none text-xs font-black p-2 uppercase tracking-widest focus:ring-0 cursor-pointer outline-none text-gray-700"
                                >
                                    {Object.keys(MOOD_CONFIG).map(m => <option key={m} value={m}>{MOOD_CONFIG[m].label}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-3 border-b border-gray-100 bg-white/80 p-4 sm:grid-cols-[1fr_180px]">
                        <label className="text-xs font-black uppercase tracking-widest text-gray-500">
                            Title / Caption
                            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Give this memory a title" className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-gray-900 outline-none focus:ring-4 focus:ring-orange-100" />
                        </label>
                        <label className="text-xs font-black uppercase tracking-widest text-gray-500">
                            Diary Date
                            <input type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-gray-900 outline-none focus:ring-4 focus:ring-orange-100" />
                        </label>
                    </div>

                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-stone-200 bg-stone-50 p-4 text-sm uppercase tracking-widest text-stone-600 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        {pages.map((page, pageIndex) => (
                          <button key={`page-tab-${pageIndex}`} type="button" onClick={() => setActivePage(pageIndex)} className={`rounded-full px-4 py-2 text-xs font-black transition ${activePage === pageIndex ? "bg-stone-950 text-white" : "bg-white text-stone-600 hover:bg-stone-100"}`}>
                            {page.title ? `P${pageIndex + 1}: ${page.title}` : `Page ${pageIndex + 1}`}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-stone-100 px-3 py-2 text-xs font-black text-stone-500">{pages.length} pages</span>
                        <button type="button" onClick={addPage} className="rounded-full bg-emerald-100 px-4 py-2 text-xs font-black uppercase tracking-widest text-emerald-800 hover:bg-emerald-200">
                          + Add page
                        </button>
                        {pages.length > 1 && (
                          <button type="button" onClick={() => removePage(activePage)} className="rounded-full bg-rose-100 px-4 py-2 text-xs font-black uppercase tracking-widest text-rose-700 hover:bg-rose-200">
                            Remove page
                          </button>
                        )}
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

                    <div className="relative grow min-h-[calc(100vh-16rem)] sm:min-h-[calc(100vh-14rem)]" style={{ backgroundColor: customTheme.writingBg || '#fffef7', backgroundImage: `linear-gradient(${customTheme.line || 'rgba(148, 163, 184, 0.35)'} 1px, transparent 1px)`, backgroundSize: '100% 2.5rem' }}>
                        <div className="absolute bottom-0 left-8 top-0 w-0.5 bg-slate-300/60 sm:left-14" />
                        <label htmlFor="diary-entry-textarea" className="sr-only">Diary entry text</label>
                        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => insertImage(event.target.files?.[0])} />
                        <textarea
                            id="diary-entry-textarea"
                            autoFocus
                            value={currentPage.text}
                            onChange={(e) => setPages((current) => current.map((page, pageIndex) => pageIndex === activePage ? { ...page, text: e.target.value } : page))}
                            className={`absolute inset-0 h-full min-h-full w-full resize-none border-none bg-transparent p-5 pl-12 text-lg leading-10 focus:ring-0 sm:p-12 sm:pl-20 ${writingCustomize.code_mode ? "font-mono text-base sm:text-lg" : `sm:text-2xl ${theme.font}`}`}
                            style={{ color: customTheme.text || '#0f172a', fontFamily: customTheme.font || 'var(--sl-font)' }}
                            placeholder="Write your feelings here..."
                        />
                    </div>
                    <DiaryMediaPreview content={currentPage.images} onRemove={removeEntryImage} />
                    {writingCustomize.stickers.length > 0 && (
                        <div className="flex flex-wrap gap-2 border-t border-gray-100 bg-stone-50/95 px-4 py-3">
                            {writingCustomize.stickers.map((sticker) => (
                                <button
                                    key={sticker}
                                    type="button"
                                    onClick={() => setPages((current) => current.map((page, pageIndex) => pageIndex === activePage ? { ...page, text: `${page.text}${page.text.trim() ? " " : ""}${STICKER_EMOJI[sticker] || "✨"}` } : page))}
                                    className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm"
                                >
                                    <span>{STICKER_EMOJI[sticker] || "✨"}</span>
                                    <span>{sticker}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 border-t border-gray-100 bg-stone-50/95 p-3 sm:flex sm:gap-4 sm:p-6">
                        <button onClick={handleSave} disabled={!pages.some((page) => page.title || page.text.trim() || page.images.length > 0) || saving || saveSuccess} className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-linear-to-r ${theme.btnSave} px-3 py-4 text-sm font-black text-white shadow-xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 sm:flex-1 sm:py-5`} aria-label={saving ? "Saving diary entry" : "Save diary entry"}>
                            {saving ? <><Loader2 className="w-5 h-5 animate-spin" /><span>Saving</span></> : <><Save className="w-5 h-5" /><span>Save</span></>}
                        </button>
                        <button onClick={() => imageInputRef.current?.click()} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-3 py-4 text-sm font-black text-white shadow-xl sm:flex-1 sm:py-5"><ImagePlus className="w-5 h-5" /><span>Image</span></button>
                        <button onClick={() => setPages((current) => current.map((page, pageIndex) => pageIndex === activePage ? { ...page, text: `${page.text}${insertCodeBlock("")}` } : page))} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-indigo-700 px-3 py-4 text-sm font-black text-white shadow-xl sm:flex-1 sm:py-5"><Code2 className="w-5 h-5" /><span>Code</span></button>
                        <button onClick={() => setShowConfirm(true)} disabled={!currentPage.title && !currentPage.text.trim() && currentPage.images.length === 0 || saving || saveSuccess} className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-linear-to-r ${theme.btnBurn} px-3 py-4 text-sm font-black text-white shadow-xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 sm:flex-1 sm:py-5`} aria-label="Burn and delete diary entry"><Flame className={`w-5 h-5 ${isBurning ? "animate-pulse" : ""}`} /><span>Burn</span></button>
                        <button onClick={downloadBookPdf} disabled={!pages.some((page) => page.title || page.text.trim() || page.images.length > 0)} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-amber-500 px-3 py-4 text-sm font-black text-white shadow-xl sm:flex-1 sm:py-5 disabled:opacity-50" aria-label="Download diary entry PDF">
                            <BookOpen className="w-5 h-5" /><span>Export PDF</span>
                        </button>
                        <button onClick={() => setShowEntrySettings(true)} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 py-4 text-sm font-black text-stone-800 shadow-xl sm:flex-1 sm:py-5" aria-label="Open diary entry settings">
                            <SlidersHorizontal className="w-5 h-5" /><span>Settings</span>
                        </button>
                    </div>
                </div>
            </div>
            <DiaryAiHelper
                email={user?.email}
                entryId={id}
                entryTitle={title}
                content={composeDiaryPages(pages)}
                mood={selectedMood}
                onInsert={(text) => setPages((current) => current.map((page, pageIndex) => pageIndex === activePage ? { ...page, text: `${page.text}${text}` } : page))}
            />
            {showShareModal && (
                <CollaboratorModal
                    entryId={id} // 'id' comes from useParams() in your file
                    ownerEmail={user.email}
                    onClose={() => setShowShareModal(false)}
                />
            )}
            {showEntrySettings && (
                <EntrySettingsModal
                    entryId={id}
                    user={user}
                    currentText={composeDiaryPages(pages)}
                    onClose={() => setShowEntrySettings(false)}
                    onShare={() => setShowShareModal(true)}
                    onReset={resetWritingCustomize}
                    onMessage={setCustomError}
                />
            )}
            {isBurning && (
                <div className="absolute inset-0 z-999 pointer-events-none">
                    {[...Array(25)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute left-0 w-full bg-white"
                            style={{
                                height: "4%",
                                bottom: `${i * 4}%`,
                                animation: `burn-strip 2.5s ease-in forwards`,
                                animationDelay: `${i * 0.08}s`,
                            }}
                        />
                    ))}
                </div>
            )}

            <style>{`
                @keyframes progress {
                    0% { width: 0%; }
                    100% { width: 100%; }
                }
                @keyframes burn-strip {
                    0% { transform: scaleX(1); opacity: 1; background: white; }
                    30% { background: #f97316; }
                    100% { transform: scaleX(0); opacity: 0; background: #000; }
                }
            `}</style>
        </div>
    );
}

function EntrySettingsModal({ entryId, user, currentText, onClose, onShare, onReset, onMessage }) {
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [data, setData] = useState({ collaborators: [], history: [], owner: null, is_owner: false });
    const [muted, setMuted] = useState(false);

    const load = async () => {
        if (!user?.email) return;
        setLoading(true);
        setError("");
        try {
            const collabData = await postJson("/entry_collaborators.php", { email: user.email, entry_id: entryId, action: "list" });
            if (collabData.status === "success") setData(collabData);
        } catch (err) {
            const message = err.message || "Could not load entry settings.";
            setError(message);
            onMessage?.(message);
        } finally {
            setLoading(false);
        }

        try {
            const emailData = await postJson("/email_preferences.php", { email: user.email, action: "get" });
            if (emailData.status === "success") {
                setMuted((emailData.muted_entries || []).some((item) => Number(item.entry_id) === Number(entryId)));
            }
        } catch {
            setMuted(false);
        }
    };

    useEffect(() => {
        load();
    }, [entryId, user?.email]);

    const toggleMute = async () => {
        setBusy(true);
        try {
            const nextAction = muted ? "unmute_entry" : "mute_entry";
            const payload = await postJson("/email_preferences.php", { email: user.email, action: nextAction, entry_id: entryId });
            if (payload.status !== "success") throw new Error(payload.message || "Could not update notification mute.");
            setMuted(!muted);
        } catch (err) {
            onMessage?.(err.message || "Could not update notification mute.");
        } finally {
            setBusy(false);
        }
    };

    const transferOwnership = async (collaborator) => {
        const label = publicUserLabel(collaborator, "this collaborator");
        if (!window.confirm(`Transfer ownership of this diary entry to ${label}?`)) return;
        setBusy(true);
        try {
            const payload = await postJson("/entry_collaborators.php", {
                email: user.email,
                entry_id: entryId,
                action: "transfer",
                new_owner_id: collaborator.id,
            });
            if (payload.status !== "success") throw new Error(payload.message || "Could not transfer ownership.");
            setData(payload);
            onMessage?.("Ownership transferred.");
        } catch (err) {
            onMessage?.(err.message || "Could not transfer ownership.");
        } finally {
            setBusy(false);
        }
    };

    const currentCollaborators = (data.collaborators || []).filter((item) => item.status === "accepted");
    const pastCollaborators = (data.collaborators || []).filter((item) => item.status !== "accepted");

    return (
        <div className="fixed inset-0 z-[650] flex items-stretch justify-center overflow-y-auto bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="entry-settings-title">
            <div className="flex min-h-dvh w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl sm:min-h-0 sm:max-h-[92dvh] sm:rounded-2xl">
                <div className="flex items-center justify-between gap-3 border-b border-stone-100 bg-stone-50 p-5">
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-stone-500">Diary Entry</p>
                        <h2 id="entry-settings-title" className="text-2xl font-black text-stone-950">Settings and collaborators</h2>
                    </div>
                    <button onClick={onClose} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100" aria-label="Close entry settings">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <button onClick={() => { onClose(); onShare(); }} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-black text-white"><Users className="h-4 w-4" /> Share</button>
                        <DiaryCommits entryId={entryId} user={user} currentText={currentText} />
                        <button onClick={onReset} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 text-sm font-black text-stone-800"><RefreshCcw className="h-4 w-4" /> Reset UI</button>
                        <button onClick={toggleMute} disabled={busy} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black ${muted ? "bg-amber-100 text-amber-900" : "bg-stone-950 text-white"} disabled:opacity-60`}>
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />}
                            {muted ? "Unmute emails" : "Mute emails"}
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-rose-600" /></div>
                    ) : error ? (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700" role="alert">
                            {error}
                        </div>
                    ) : (
                        <>
                            <section className="rounded-lg border border-stone-200 p-4">
                                <div className="mb-3 flex items-center gap-2">
                                    <Crown className="h-5 w-5 text-amber-600" />
                                    <h3 className="font-black text-stone-950">Owner</h3>
                                </div>
                                <PersonRow person={data.owner || {}} status="owner" />
                            </section>

                            <section className="rounded-lg border border-stone-200 p-4">
                                <h3 className="font-black text-stone-950">Current collaborators</h3>
                                <div className="mt-3 space-y-2">
                                    {currentCollaborators.length === 0 ? <p className="text-sm font-semibold text-stone-500">No accepted collaborators yet.</p> : currentCollaborators.map((person) => (
                                        <PersonRow key={person.id} person={person} status={person.status} canTransfer={data.is_owner} busy={busy} onTransfer={() => transferOwnership(person)} />
                                    ))}
                                </div>
                            </section>

                            <section className="rounded-lg border border-stone-200 p-4">
                                <h3 className="font-black text-stone-950">Past and pending collaboration</h3>
                                <div className="mt-3 space-y-2">
                                    {pastCollaborators.length === 0 && (data.history || []).length === 0 ? <p className="text-sm font-semibold text-stone-500">No past collaboration history yet.</p> : null}
                                    {pastCollaborators.map((person) => <PersonRow key={`${person.id}-${person.status}`} person={person} status={person.status} />)}
                                    {(data.history || []).slice(0, 20).map((item, index) => (
                                        <div key={`${item.action}-${index}`} className="rounded-lg bg-stone-50 p-3 text-sm font-semibold text-stone-700">
                                            <span className="font-black">{publicUserLabel(item.user, "Someone")}</span> - {String(item.action || "").replace(/_/g, " ")}
                                            <span className="block text-xs text-stone-400">{item.created_at ? formatIndiaDateTime(item.created_at) : ""}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function PersonRow({ person, status, canTransfer = false, busy = false, onTransfer }) {
    const label = publicUserLabel(person, "Unknown user");
    const username = publicUsername(person);
    return (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 p-3">
            <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-stone-700 shadow-sm">
                    <UserRound className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                    <p className="truncate text-sm font-black text-stone-950">{label}</p>
                    {username && <p className="truncate text-xs font-semibold text-stone-500">{username}</p>}
                    {status === "accepted" && (
                        <p className="text-[11px] font-semibold text-stone-400">
                            {person.accepted_at ? `Joined ${formatIndiaDateTime(person.accepted_at)}` : "Join date not recorded"}
                        </p>
                    )}
                    <p className="text-[11px] font-black uppercase tracking-widest text-stone-400">{status}</p>
                </div>
            </div>
            {canTransfer && (
                <button onClick={onTransfer} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-stone-950 px-3 text-xs font-black text-white disabled:opacity-60">
                    <Crown className="h-4 w-4" />
                    Transfer
                </button>
            )}
        </div>
    );
}
