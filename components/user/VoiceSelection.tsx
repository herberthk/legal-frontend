import { voices } from "@/constants";
import { updateUserVoicePreference } from "@/lib";
import { useAuthStore } from "@/store";
import { Check, Mic } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";

const VoiceSelection = () => {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const updateVoice = useCallback(
    async (voiceName: string) => {
      if (!user) return;
      try {
        const result = await updateUserVoicePreference(voiceName, user.id);
        if (result.success) {
          toast.success(result.message, {
            style: {
              background: "green",
            },
          });

          setUser({
            ...user,
            voicePreference: voiceName,
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
  const selectedVoice = user?.voicePreference || "Blake";
  console.log("voice preference", selectedVoice);
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-500 rounded-lg">
          <Mic size={20} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            AI Voice Persona
          </h3>
          <p className="text-xs text-slate-500">
            Select the voice for your live legal consultations.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {voices.map((voice) => (
          <button
            key={voice.id}
            onClick={() => updateVoice(voice.name)}
            className={`relative p-3 rounded-xl border text-left transition-all duration-300 hover:shadow-md ${
              selectedVoice === voice.name
                ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20 ring-1 ring-orange-500"
                : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:border-orange-300 dark:hover:border-orange-700"
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <span
                className={`text-xs font-bold px-1.5 py-0.5 rounded uppercase ${
                  voice.gender === "Female"
                    ? "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                }`}
              >
                {voice.gender}
              </span>
              {selectedVoice === voice.name && (
                <Check
                  size={16}
                  className="text-orange-600 dark:text-orange-500"
                />
              )}
            </div>
            <p className="font-bold text-slate-900 dark:text-white text-sm mb-0.5">
              {voice.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
              {voice.desc}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default VoiceSelection;
