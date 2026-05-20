import { LockKeyhole, UnlockKeyhole, KeyRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const DIARY_SNIPPETS = [
  "Dear Diary...", 
  "The sky was heavy today.", 
  "I finally spoke up.", 
  "A quiet afternoon.", 
  "Memories fade...", 
  "But these lines stay.", 
  "Almost there..."
];

export default function DiarySplash({ onDone, isAuthenticated = false }) {
  const [currentPage, setCurrentPage] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const [showLock, setShowLock] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    // Initialize Audio
    audioRef.current = new Audio("/pageflip.mp3"); 
    audioRef.current.volume = 0.4;

    let count = 0;
    const interval = setInterval(() => {
      if (count < DIARY_SNIPPETS.length - 1) {
        count++;
        setCurrentPage(count);
        
        // Play sound effect for every flip
        if (audioRef.current) {
          const soundClone = audioRef.current.cloneNode();
          soundClone.volume = 0.2;
          soundClone.play().catch(() => {});
        }
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setShowLock(true);
          setTimeout(() => {
            setIsClosing(true);
            setTimeout(onDone, 1000);
          }, 1500);
        }, 800);
      }
    }, 400); // Slightly slower to appreciate the rotation animation

    return () => clearInterval(interval);
  }, [onDone]);

  return (
    <div className={`fixed inset-0 z-[9999] bg-[#121210] flex items-center justify-center transition-opacity duration-1000 ${isClosing ? "opacity-0" : "opacity-100"}`}>
      
      {/* 3D Notebook Wrapper */}
      <div className="relative" style={{ perspective: "2000px" }}>
        
        {/* Book Shadow */}
        <div className="absolute -bottom-10 left-10 right-[-10px] h-8 bg-black/50 blur-2xl rounded-[50%] opacity-60" />

        {/* The Main Diary Structure */}
        <div className="relative w-[340px] h-[460px] bg-[#f4f1ea] rounded-r-xl shadow-2xl border-l-[18px] border-[#2c1e14] flex">
          
          {/* Paper Edge Stack (Right Side Thickness) */}
          <div className="absolute right-0 top-0 bottom-0 w-3 bg-stone-300 rounded-r-xl border-r border-stone-400" />

          {/* BACKGROUND PAGE (The one appearing next) */}
          <div className="absolute inset-0 p-10 overflow-hidden bg-[#f4f1ea] rounded-r-xl">
             <div className="absolute left-14 top-0 bottom-0 w-[1px] bg-red-200" />
             <div className="absolute inset-0 bg-[linear-gradient(transparent_34px,#e5e7eb_1px)] bg-[size:100%_35px] mt-12 opacity-60" />
             <p className="relative z-0 font-serif italic text-stone-400 text-xl leading-[35px] mt-8">
                {DIARY_SNIPPETS[currentPage + 1] || ""}
             </p>
          </div>

          {/* THE FLIPPING PAGE */}
          <div 
            key={currentPage} 
            className="absolute inset-0 bg-[#fdfbf7] rounded-r-xl origin-left animate-page-flip shadow-2xl"
            style={{ backfaceVisibility: "hidden" }}
          >
            {/* Page Content */}
            <div className="relative w-full h-full p-10 pt-16">
               <div className="absolute left-14 top-0 bottom-0 w-[2px] bg-red-200" />
               <div className="absolute inset-0 bg-[linear-gradient(transparent_34px,#e2e8f0_1px)] bg-[size:100%_35px] mt-12" />

               <p className="relative z-10 font-serif italic text-stone-700 text-xl leading-[35px] select-none">
                {DIARY_SNIPPETS[currentPage]}
               </p>
            </div>

            {/* Shine/Shadow overlay during the turn */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/10 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* Spine Gutter Shadow */}
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-black/30 via-black/5 to-transparent z-50" />
        </div>

        {/* Progress Text */}
        <div className="absolute -bottom-24 left-0 right-0 text-center space-y-3">
          <div className="flex justify-center gap-2">
             {[...Array(3)].map((_, i) => (
               <div key={i} className="w-2 h-2 bg-stone-600 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
             ))}
          </div>
          <p className="text-stone-500 font-serif text-xs tracking-[0.4em] uppercase">{showLock ? (isAuthenticated ? "Unlocking Vault" : "Diary Locked") : "Opening Journal"}</p>
        </div>

        {showLock && (
          <div className="absolute inset-0 z-[80] flex items-center justify-center rounded-r-xl bg-black/45 backdrop-blur-[2px]">
            <div className="relative flex h-28 w-28 items-center justify-center rounded-lg border border-amber-200 bg-[#fdf8ea] shadow-2xl">
              <div className={`absolute left-1/2 top-0 h-14 w-16 -translate-x-1/2 -translate-y-8 rounded-t-full border-[8px] border-[#2c1e14] border-b-0 transition-all duration-700 ${isAuthenticated ? "-rotate-12 -translate-y-11 translate-x-[-35%]" : ""}`} />
              {isAuthenticated ? <UnlockKeyhole className="h-12 w-12 animate-pulse text-emerald-700" /> : <LockKeyhole className="h-12 w-12 text-amber-900" />}
              <KeyRound className={`absolute -right-7 top-1/2 h-8 w-8 -translate-y-1/2 text-amber-400 transition-transform duration-700 ${isAuthenticated ? "-translate-x-8 rotate-45" : ""}`} />
            </div>
          </div>
        )}
      </div>

      <style>
        {`
          @keyframes page-flip {
            0% { 
              transform: rotateY(0deg);
            }
            100% { 
              transform: rotateY(-130deg); 
              filter: brightness(0.7);
            }
          }

          .animate-page-flip {
            animation: page-flip 0.5s ease-in-out forwards;
          }
        `}
      </style>
    </div>
  );
}
