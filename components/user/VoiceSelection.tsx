import { voices } from "@/constants";
import { updateUserVoicePreference } from "@/lib/actions/user";
import { useAuthStore } from "@/store";
import { Check, Mic, Play, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const VoiceSelection = () => {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadedAudioRef = useRef<Record<string, HTMLAudioElement>>({});

  // Preload all audio files on mount
  useEffect(() => {
    voices.forEach((voice) => {
      const audio = new Audio(`/voices/${voice.name}.mp3`);
      audio.preload = "auto";
      preloadedAudioRef.current[voice.id] = audio;
    });

    // Cleanup: pause any playing audio when component unmounts
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      // Clear references
      preloadedAudioRef.current = {};
    };
  }, []);

  const updateVoice = useCallback(
    async (voice: PreferedVoice) => {
      if (!user) return;
      // Auto-play on selection
      // eslint-disable-next-line react-hooks/immutability
      togglePreview(voice.preferedVoiceId);
      try {
        const result = await updateUserVoicePreference(voice, user.id);
        if (result.success) {
          toast.success(result.message, {
            style: {
              background: "green",
            },
          });

          setUser({
            ...user,
            preferedVoice: voice,
          });
        } else {
          toast.error(result.message, {
            style: {
              background: "red",
            },
          });
        }
      } catch (error) {
        toast.error("Failed to update voice preference", {
          style: {
            background: "red",
          },
        });
      }
    },
    [setUser, user],
  );

  const togglePreview = (voiceId: string) => {
    if (playingVoiceId === voiceId) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingVoiceId(null);
      return;
    }

    // Stop current playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    const audio = preloadedAudioRef.current[voiceId];
    if (!audio) return;

    audioRef.current = audio;
    setPlayingVoiceId(voiceId);

    audio.play().catch((err) => {
      console.error("Playback failed:", err);
      setPlayingVoiceId(null);
    });

    audio.onended = () => {
      setPlayingVoiceId(null);
    };
  };

  const selectedVoice = user?.preferedVoice?.preferedVoiceId || "Zephyr";

  return (
    <div className="bg-white dark:bg-slate-900/50 rounded-2xl p-3 md:p-6 shadow-xl border border-slate-100 dark:border-slate-800 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-xl shadow-inner">
            <Mic size={22} className="animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm md:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              AI Voice Persona
            </h3>
            <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-medium">
              Select the voice for your live legal consultations.
            </p>
          </div>
        </div>
        {playingVoiceId && (
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                animate={{
                  height: [4, 16, 4],
                }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.1,
                }}
                className="w-1 bg-orange-500 rounded-full"
              />
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {voices.map((voice) => (
          <motion.div
            key={voice.id}
            onMouseEnter={() => {
              if (playingVoiceId !== voice.id) {
                togglePreview(voice.id);
              }
            }}
            onMouseLeave={() => {
              if (playingVoiceId === voice.id) {
                togglePreview(voice.id);
              }
            }}
            whileHover={{ y: -6, scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="relative group overflow-hidden rounded-2xl"
          >
            <button
              onClick={() =>
                updateVoice({
                  preferedVoiceId: voice.id,
                  preferedVoiceName: voice.name,
                })
              }
              className={`w-full h-full relative p-4 rounded-2xl border text-left transition-all duration-500 z-10 ${
                selectedVoice === voice.id
                  ? "border-orange-500 bg-orange-50/50 dark:bg-orange-500/10 ring-2 ring-orange-500/20 shadow-[0_0_25px_rgba(249,115,22,0.15)]"
                  : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:border-orange-300 dark:hover:border-orange-700/50"
              }`}
            >
              <div className="flex justify-between items-start mb-3 relative z-20">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider backdrop-blur-md shadow-sm ring-1 ring-white/20 ${
                    voice.gender === "Female"
                      ? "bg-pink-100/90 text-pink-700 dark:bg-pink-500/40 dark:text-pink-300"
                      : "bg-blue-100/90 text-blue-700 dark:bg-blue-500/40 dark:text-blue-300"
                  }`}
                >
                  {voice.gender}
                </span>
                <AnimatePresence mode="wait">
                  {selectedVoice === voice.id && (
                    <motion.div
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0 }}
                      className="bg-orange-500 rounded-full p-0.5 shadow-lg shadow-orange-500/40"
                    >
                      <Check size={12} className="text-white" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-1 relative z-20">
                <p className="font-bold text-slate-900 dark:text-white text-base leading-tight tracking-tight">
                  {voice.name}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium line-clamp-1 italic opacity-90">
                  {voice.desc}
                </p>
              </div>

              {/* Decorative background pulse for selected voice */}
              {selectedVoice === voice.id && (
                <motion.div
                  layoutId="selected-ring"
                  className="absolute inset-0 border-2 border-orange-500 rounded-2xl pointer-events-none z-30"
                  initial={false}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}

              {/* Peak Background Visualizer Component */}
              <AnimatePresence>
                {playingVoiceId === voice.id && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    className="absolute inset-0 z-0 flex items-end justify-center gap-[2px] px-1 pb-1"
                  >
                    {[...Array(35)].map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{
                          height: ["20%", `${Math.random() * 75 + 20}%`, "20%"],
                        }}
                        transition={{
                          duration: Math.random() * 0.3 + 0.2,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: i * 0.015,
                        }}
                        className={`w-full max-w-[4px] rounded-full shadow-[0_0_15px_rgba(255,255,255,0.2)] ${
                          voice.gender === "Female"
                            ? "bg-pink-400/60 dark:bg-pink-500/50"
                            : "bg-blue-400/60 dark:bg-blue-500/50"
                        }`}
                      />
                    ))}
                    {/* Inner shadow overlay for depth */}
                    <div className="absolute inset-0 bg-linear-to-t from-white/10 dark:from-black/10 to-transparent pointer-events-none" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>

            {/* Premium Preview Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePreview(voice.id);
              }}
              className={`absolute bottom-3 right-3 p-2.5 rounded-xl backdrop-blur-md transition-all duration-300 shadow-2xl z-20 ${
                playingVoiceId === voice.id
                  ? "bg-orange-500 text-white shadow-orange-500/50 translate-y-0 opacity-100 scale-110"
                  : "bg-white/95 dark:bg-slate-700/95 text-slate-600 dark:text-slate-200 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 hover:bg-orange-500 hover:text-white"
              }`}
            >
              {playingVoiceId === voice.id ? (
                <Square size={16} fill="currentColor" />
              ) : (
                <Play size={16} fill="currentColor" />
              )}
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default VoiceSelection;
