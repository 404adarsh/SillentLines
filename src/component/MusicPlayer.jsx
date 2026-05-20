import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ListMusic,
  Music,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Trash2,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import { apiUrl } from "../lib/api";

const PLAYER_SETTINGS_KEY = "silentlines_music_player_v1";

export default function MusicPlayer({ moodId, MOOD_CONFIG }) {
  const config = MOOD_CONFIG[moodId] || MOOD_CONFIG.stress;
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [serverTracks, setServerTracks] = useState([]);
  const [userTracks, setUserTracks] = useState([]);
  const [settings, setSettings] = useState(() => {
    try {
      return { volume: 0.65, ...JSON.parse(localStorage.getItem(PLAYER_SETTINGS_KEY) || "{}") };
    } catch {
      return { volume: 0.65 };
    }
  });

  const playlist = useMemo(
    () => [...(config.tracks || []), ...serverTracks, ...userTracks],
    [config.tracks, serverTracks, userTracks]
  );
  const currentTrack = playlist[currentIndex];

  useEffect(() => {
    fetch(apiUrl("/get_mood_songs.php"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mood: moodId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "success" && Array.isArray(data.songs)) setServerTracks(data.songs);
      })
      .catch(() => setServerTracks([]));
  }, [moodId]);

  useEffect(() => {
    try {
      setUserTracks(JSON.parse(localStorage.getItem(`user_tracks_${moodId}`) || "[]"));
    } catch {
      setUserTracks([]);
    }
    setCurrentIndex(0);
    setIsPlaying(false);
  }, [moodId]);

  useEffect(() => {
    localStorage.setItem(PLAYER_SETTINGS_KEY, JSON.stringify(settings));
    if (audioRef.current) audioRef.current.volume = Number(settings.volume || 0.65);
  }, [settings]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying && currentTrack) {
      audioRef.current.play().catch(() => setIsPlaying(false));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, currentIndex, currentTrack]);

  const togglePlay = (event) => {
    event?.stopPropagation();
    if (!currentTrack) return;
    setIsPlaying((value) => !value);
  };

  const playNext = (event) => {
    event?.stopPropagation();
    if (!playlist.length) return;
    setCurrentIndex((index) => (index + 1) % playlist.length);
    setIsPlaying(true);
  };

  const playPrev = (event) => {
    event?.stopPropagation();
    if (!playlist.length) return;
    setCurrentIndex((index) => (index - 1 + playlist.length) % playlist.length);
    setIsPlaying(true);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("audio/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const next = [...userTracks, { label: file.name, url: String(reader.result || ""), isUser: true }];
      setUserTracks(next);
      localStorage.setItem(`user_tracks_${moodId}`, JSON.stringify(next));
      setCurrentIndex(playlist.length);
      setIsPlaying(true);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const removeUserTrack = (track) => {
    const next = userTracks.filter((item) => item.url !== track.url);
    setUserTracks(next);
    localStorage.setItem(`user_tracks_${moodId}`, JSON.stringify(next));
    setCurrentIndex(0);
    setIsPlaying(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-[900] mx-auto max-w-4xl sm:bottom-5">
      <audio ref={audioRef} src={currentTrack?.url} onEnded={playNext} />

      <div className="overflow-hidden rounded-lg border border-white/25 bg-slate-950/92 text-white shadow-2xl backdrop-blur-xl" role="region" aria-label="Mood music player">
        <div className="flex min-h-16 items-center gap-2 p-2 sm:gap-3 sm:p-3">
          <button
            onClick={togglePlay}
            disabled={!currentTrack}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-slate-950 transition hover:scale-105 disabled:opacity-50"
            aria-label={isPlaying ? "Pause music" : "Play music"}
          >
            {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
          </button>

          <button onClick={playPrev} className="hidden rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white sm:block" aria-label="Previous track">
            <SkipBack className="h-5 w-5" />
          </button>
          <button onClick={playNext} className="hidden rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white sm:block" aria-label="Next track">
            <SkipForward className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black">{currentTrack?.label || "Add calm music for writing"}</p>
            <p className="truncate text-[10px] font-black uppercase tracking-widest text-white/45">{moodId} writing mix</p>
          </div>

          <label className="hidden min-w-[150px] items-center gap-2 rounded-lg bg-white/10 px-3 py-2 md:flex">
            <Volume2 className="h-4 w-4 text-white/60" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.volume}
              onChange={(event) => setSettings((current) => ({ ...current, volume: Number(event.target.value) }))}
              className="w-full accent-white"
              aria-label="Music volume"
            />
          </label>

          <button onClick={() => fileInputRef.current?.click()} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 py-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Upload local music">
            <Upload className="h-5 w-5" />
            <span className="text-[10px] font-black uppercase sm:hidden">Upload</span>
          </button>
          <button onClick={() => setIsOpen((value) => !value)} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 py-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label={isOpen ? "Hide playlist" : "Open playlist"}>
            {isOpen ? <ChevronDown className="h-5 w-5" /> : <ListMusic className="h-5 w-5" />}
            <span className="text-[10px] font-black uppercase sm:hidden">{isOpen ? "Hide" : "List"}</span>
          </button>
        </div>

        {isOpen && (
          <div className="grid max-h-[55dvh] gap-3 overflow-auto border-t border-white/10 p-3 sm:max-h-80 sm:grid-cols-[1fr_220px]">
            <div className="grid gap-1">
              {playlist.length === 0 ? (
                <p className="rounded-lg bg-white/10 p-4 text-sm font-semibold text-white/70">Upload a song to make this mood yours.</p>
              ) : (
                playlist.map((track, index) => (
                  <div key={`${track.label}-${index}`} className={`flex items-center gap-2 rounded-lg p-2 ${index === currentIndex ? "bg-white/15" : "hover:bg-white/10"}`}>
                    <button
                      onClick={() => {
                        setCurrentIndex(index);
                        setIsPlaying(true);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <Music className="h-4 w-4 shrink-0 text-white/50" />
                      <span className="truncate text-sm font-semibold text-white/85">{track.label}</span>
                    </button>
                    {track.isUser && (
                      <button onClick={() => removeUserTrack(track)} className="rounded-md p-1 text-white/45 hover:bg-red-500/20 hover:text-red-200" aria-label="Remove uploaded track">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="rounded-lg bg-white/10 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-widest text-white/60">Player</p>
                <button onClick={() => setIsOpen(false)} className="rounded-md p-1 text-white/50 hover:bg-white/10" aria-label="Close playlist">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <label className="flex items-center gap-2 md:hidden">
                <Volume2 className="h-4 w-4 text-white/60" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={settings.volume}
                  onChange={(event) => setSettings((current) => ({ ...current, volume: Number(event.target.value) }))}
                  className="w-full accent-white"
                  aria-label="Music volume"
                />
              </label>
              <p className="mt-3 text-xs font-semibold leading-5 text-white/55">
                The player stays below the diary controls, so Save, Burn, Share, and Commits remain reachable.
              </p>
            </div>
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
    </div>
  );
}
