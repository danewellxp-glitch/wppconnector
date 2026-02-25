import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Download, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomAudioPlayerProps {
    src: string;
    isOutbound?: boolean;
}

export function CustomAudioPlayer({ src, isOutbound = false }: CustomAudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isMuted, setIsMuted] = useState(false);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const setAudioData = () => {
            setDuration(audio.duration);
            setCurrentTime(audio.currentTime);
        };

        const setAudioTime = () => setCurrentTime(audio.currentTime);

        // Some browsers have bugs with audio.ended not firing consistently if audio is replayable
        const handleEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0);
            if (audio) {
                audio.currentTime = 0;
            }
        };

        audio.addEventListener('loadeddata', setAudioData);
        audio.addEventListener('timeupdate', setAudioTime);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('loadeddata', setAudioData);
            audio.removeEventListener('timeupdate', setAudioTime);
            audio.removeEventListener('ended', handleEnded);
        };
    }, []);

    const togglePlayPause = (e: React.MouseEvent) => {
        e.stopPropagation();
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
        } else {
            audio.play().catch(error => console.error("Error playing audio:", error));
            setIsPlaying(true);
        }
    };

    const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        const audio = audioRef.current;
        if (!audio) return;

        const newTime = Number(e.target.value);
        audio.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        const audio = audioRef.current;
        if (!audio) return;

        audio.muted = !isMuted;
        setIsMuted(!isMuted);
    };

    const formatTime = (time: number) => {
        if (isNaN(time)) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        window.open(src, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className={cn(
            "flex items-center gap-3 p-3 rounded-xl min-w-[280px] max-w-full shadow-sm border transition-all duration-300",
            isOutbound
                ? "bg-green-50 border-green-200"
                : "bg-gray-50 border-gray-200"
        )}>
            <audio ref={audioRef} src={src} preload="metadata" crossOrigin="anonymous" />

            {/* Play/Pause Button */}
            <button
                onClick={togglePlayPause}
                className={cn(
                    "flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition-colors",
                    isOutbound
                        ? "bg-green-500 hover:bg-green-600 text-white shadow-sm"
                        : "bg-blue-500 hover:bg-blue-600 text-white shadow-sm"
                )}
            >
                {isPlaying ? (
                    <Pause className="h-5 w-5 fill-current" />
                ) : (
                    <Play className="h-5 w-5 fill-current ml-1" />
                )}
            </button>

            {/* Progress Bar and Timers */}
            <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
                <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleProgressChange}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                        "w-full h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all",
                        isOutbound
                            ? "bg-green-200 accent-green-600 focus:ring-green-500"
                            : "bg-gray-200 accent-blue-600 focus:ring-blue-500"
                    )}
                    style={{
                        backgroundSize: `${(currentTime / (duration || 1)) * 100}% 100%`,
                    }}
                />
                <div className="flex justify-between items-center text-[11px] font-medium px-0.5 mt-0.5">
                    <span className={isOutbound ? "text-green-700" : "text-gray-500"}>
                        {formatTime(currentTime)}
                    </span>
                    <span className={isOutbound ? "text-green-700/70" : "text-gray-400"}>
                        {formatTime(duration)}
                    </span>
                </div>
            </div>

            {/* Actions (Mute & Download) */}
            <div className="flex-shrink-0 flex items-center gap-1 ml-1">
                <button
                    onClick={toggleMute}
                    className={cn(
                        "p-1.5 rounded-full transition-colors",
                        isOutbound ? "hover:bg-green-200 text-green-700" : "hover:bg-gray-200 text-gray-500"
                    )}
                    title={isMuted ? "Unmute" : "Mute"}
                >
                    {isMuted ? (
                        <VolumeX className="h-4 w-4" />
                    ) : (
                        <Volume2 className="h-4 w-4" />
                    )}
                </button>
            </div>
        </div>
    );
}
