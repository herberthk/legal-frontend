import { FC } from "react";
type Props = {
  encodingProgress: number;
};
const Recorder: FC<Props> = ({ encodingProgress }) => {
  return (
    <div className="absolute inset-0 z-60 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative flex flex-col items-center gap-5 bg-white/10 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/20 dark:border-slate-700/50 rounded-3xl px-10 py-8 shadow-2xl max-w-xs w-full mx-4">
        {/* Spinning progress ring */}
        <div className="relative w-20 h-20 flex items-center justify-center">
          {/* Track circle */}
          <svg
            className="absolute inset-0 w-full h-full -rotate-90"
            viewBox="0 0 80 80"
          >
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-white/10 dark:text-slate-700"
            />
            {/* Progress arc — strokeDashoffset drives the fill */}
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke="url(#encProgressGrad)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 34}`}
              strokeDashoffset={`${2 * Math.PI * 34 * (1 - encodingProgress / 100)}`}
              style={{ transition: "stroke-dashoffset 0.3s ease" }}
            />
            <defs>
              <linearGradient
                id="encProgressGrad"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
          </svg>
          {/* Percentage label in centre */}
          <span className="text-white font-bold text-lg tabular-nums">
            {encodingProgress}%
          </span>
        </div>

        {/* Labels */}
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-white font-semibold text-sm tracking-wide">
            Preparing Recording
          </p>
          <p className="text-white/60 text-xs leading-relaxed">
            Encoding your conversation as WAV.
            <br />
            Download will start automatically.
          </p>
        </div>

        {/* Linear progress bar — secondary visual cue */}
        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-linear-to-r from-indigo-400 to-cyan-400 transition-all duration-300"
            style={{ width: `${encodingProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default Recorder;
