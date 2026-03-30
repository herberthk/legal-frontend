import React from "react";
import { motion } from "framer-motion";

interface AmbientGlowProps {
  isDark: boolean;
  isAudioActive: boolean;
  glowColor: string;
  glowOpacityActive: number | number[];
  glowOpacity: number;
}

const AmbientGlow: React.FC<AmbientGlowProps> = ({
  isDark,
  isAudioActive,
  glowColor,
  glowOpacityActive,
  glowOpacity,
}) => {
  return (
    <motion.div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
      style={{
        filter: isDark ? "blur(100px)" : "blur(80px)",
        width: isDark ? 600 : 500,
        height: isDark ? 600 : 500,
      }}
      animate={{
        backgroundColor: glowColor + (isDark ? "55" : "88"),
        scale: isAudioActive ? [1, 1.18, 1] : 0.75,
        opacity: isAudioActive ? glowOpacityActive : glowOpacity * 0.4,
      }}
      transition={{
        backgroundColor: { duration: 0.6 },
        scale: isAudioActive
          ? { duration: 3, repeat: Infinity, ease: "easeInOut" }
          : { duration: 1.2 },
        opacity: isAudioActive
          ? { duration: 3, repeat: Infinity, ease: "easeInOut" }
          : { duration: 1.2 },
      }}
    />
  );
};

export default React.memo(AmbientGlow);
