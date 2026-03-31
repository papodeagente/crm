/**
 * AudioPlayer — WhatsApp Web style audio player with waveform + speed control
 * Extracted from WhatsAppChat.tsx lines 220-387
 */

import { useState, useRef, useEffect, useCallback, memo } from "react";
import { Mic, Play, Pause } from "lucide-react";

/* ─── Waveform bars generator (deterministic from duration) ─── */
function generateWaveformBars(count: number, seed: number = 42): number[] {
  const bars: number[] = [];
  let s = seed;
  for (let i = 0; i < count; i++) {
    s = (s * 16807 + 0) % 2147483647;
    const normalized = (s % 100) / 100;
    const position = i / count;
    const envelope = Math.sin(position * Math.PI) * 0.6 + 0.4;
    bars.push(Math.max(0.12, normalized * envelope));
  }
  return bars;
}

const AudioPlayer = memo(({ src, duration, isVoice, fromMe, avatarUrl }: {
  src: string; duration?: number | null; isVoice?: boolean; fromMe?: boolean; avatarUrl?: string | null;
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [playbackRate, setPlaybackRate] = useState(1);

  const barCount = 28;
  const [bars] = useState(() => generateWaveformBars(barCount, Math.round((duration || 10) * 137)));

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => { if (audio.duration && isFinite(audio.duration)) setTotalDuration(audio.duration); };
    const onEnded = () => { setIsPlaying(false); setCurrentTime(0); };
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { audio.pause(); } else { audio.playbackRate = playbackRate; audio.play(); }
    setIsPlaying(!isPlaying);
  }, [isPlaying, playbackRate]);

  const cycleSpeed = useCallback(() => {
    const speeds = [1, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const newRate = speeds[nextIdx];
    setPlaybackRate(newRate);
    if (audioRef.current) audioRef.current.playbackRate = newRate;
  }, [playbackRate]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const audio = audioRef.current;
    if (audio && totalDuration > 0) {
      audio.currentTime = pct * totalDuration;
      setCurrentTime(audio.currentTime);
    }
  }, [totalDuration]);

  const formatDur = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const progress = totalDuration > 0 ? currentTime / totalDuration : 0;
  const accentColor = fromMe ? "#53bdeb" : "#00a884";
  const unplayedColor = fromMe ? "rgba(83,189,235,0.3)" : "rgba(0,168,132,0.25)";

  return (
    <div className="flex items-center gap-2.5 min-w-0 sm:min-w-[250px] max-w-full sm:max-w-[340px] py-1">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Avatar */}
      <div className="relative shrink-0">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-[52px] h-[52px] rounded-full object-cover shadow-sm" />
        ) : (
          <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center bg-gradient-to-br shadow-sm"
            style={{ background: fromMe ? "linear-gradient(135deg, #53bdeb 0%, #3a9fd4 100%)" : "linear-gradient(135deg, #25d366 0%, #00a884 100%)" }}>
            <Mic className="w-6 h-6 text-white" />
          </div>
        )}
        {isVoice && (
          <div className="absolute -bottom-0.5 -right-0.5 w-[20px] h-[20px] rounded-full flex items-center justify-center shadow-sm"
            style={{ backgroundColor: accentColor }}>
            <Mic className="w-[11px] h-[11px] text-white" />
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col gap-0.5 min-w-0">
        {/* Play button + Waveform row */}
        <div className="flex items-center gap-2">
          <button onClick={togglePlay}
            className="w-[34px] h-[34px] rounded-full flex items-center justify-center shrink-0 transition-all hover:scale-105 active:scale-95"
            style={{ color: accentColor }}>
            {isPlaying
              ? <Pause className="w-[20px] h-[20px]" fill="currentColor" />
              : <Play className="w-[20px] h-[20px] ml-0.5" fill="currentColor" />
            }
          </button>

          {/* Waveform with seek dot */}
          <div className="flex-1 relative cursor-pointer" onClick={handleSeek}>
            <div className="flex items-center gap-[2px] h-[32px]">
              {bars.map((h, i) => {
                const barProgress = i / barCount;
                const isPlayed = barProgress <= progress;
                return (
                  <div
                    key={i}
                    className="rounded-full transition-colors duration-100 flex-1"
                    style={{
                      minWidth: "3px",
                      maxWidth: "4px",
                      height: `${Math.max(4, h * 30)}px`,
                      backgroundColor: isPlayed ? accentColor : unplayedColor,
                    }}
                  />
                );
              })}
            </div>
            {/* Seek dot */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-[12px] h-[12px] rounded-full shadow-md transition-all duration-75"
              style={{
                left: `calc(${progress * 100}% - 6px)`,
                backgroundColor: accentColor,
              }}
            />
          </div>
        </div>

        {/* Duration + Speed control */}
        <div className="flex items-center justify-between pl-[42px] pr-1">
          <span className="text-[11px] tabular-nums text-muted-foreground/70">
            {isPlaying ? formatDur(currentTime) : formatDur(totalDuration || 0)}
          </span>
          <button
            onClick={cycleSpeed}
            className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full transition-all hover:scale-105"
            style={{
              color: playbackRate !== 1 ? "white" : accentColor,
              backgroundColor: playbackRate !== 1 ? accentColor : "transparent",
              border: `1.5px solid ${accentColor}`,
            }}
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
});
AudioPlayer.displayName = "AudioPlayer";

export default AudioPlayer;
