import { motion } from "motion/react";

interface SoundWaveProps {
  isPlaying: boolean;
}

export default function SoundWave({ isPlaying }: SoundWaveProps) {
  const bars = Array.from({ length: 9 });

  if (!isPlaying) {
    return (
      <div className="flex items-center justify-center gap-1 h-8">
        {bars.map((_, i) => (
          <div
            key={i}
            className="w-1 h-2 bg-amber-300 rounded-full transition-all duration-300"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-1 h-8 px-2">
      {bars.map((_, i) => {
        // Vary durations to make it look organic
        const duration = 0.5 + (i % 3) * 0.2;
        return (
          <motion.div
            key={i}
            animate={{
              height: [8, 28, 8],
            }}
            transition={{
              duration: duration,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.05,
            }}
            className="w-1 bg-amber-500 rounded-full"
            style={{ height: "8px" }}
          />
        );
      })}
    </div>
  );
}
