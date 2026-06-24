import { Award, Star, Compass, ShieldAlert } from "lucide-react";
import { Achievement } from "../types";
import { motion } from "motion/react";

interface AchievementCollectionProps {
  achievements: Achievement[];
  onReset: () => void;
}

export default function AchievementCollection({
  achievements,
  onReset,
}: AchievementCollectionProps) {
  const getBadgeIcon = (iconName: string) => {
    switch (iconName) {
      case "gear":
        return <Award className="w-8 h-8 text-blue-500 fill-blue-100" />;
      case "star":
        return <Star className="w-8 h-8 text-amber-500 fill-amber-100 animate-spin-slow" />;
      case "compass":
        return <Compass className="w-8 h-8 text-emerald-500 fill-emerald-100" />;
      default:
        return <Award className="w-8 h-8 text-purple-500 fill-purple-100" />;
    }
  };

  return (
    <div id="achievement-collection-panel" className="bg-white/90 border-4 border-amber-400 rounded-3xl p-5 shadow-lg max-w-md mx-auto mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-black text-amber-950 flex items-center gap-2">
          🏆 My Sticker Book
        </h3>
        <button
          onClick={onReset}
          className="text-[10px] text-amber-800 hover:text-amber-950 font-bold bg-amber-100 px-2 py-1 rounded-lg border-2 border-amber-200 transition-transform active:scale-95"
        >
          Reset Stickers
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {achievements.map((achievement) => {
          const isUnlocked = !!achievement.unlockedAt;
          return (
            <motion.div
              key={achievement.id}
              whileHover={isUnlocked ? { scale: 1.05 } : {}}
              className={`flex flex-col items-center justify-center p-2 rounded-2xl border-2 transition-all text-center relative ${
                isUnlocked
                  ? "bg-amber-50 border-amber-300 shadow-sm opacity-100"
                  : "bg-gray-100/50 border-gray-200/80 grayscale opacity-50"
              }`}
            >
              <div className="relative mb-1">
                {getBadgeIcon(achievement.icon)}
                {isUnlocked && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                  </span>
                )}
              </div>
              <p className="text-[10px] font-black text-amber-950 truncate w-full">
                {achievement.title}
              </p>
              <p className="text-[8px] text-amber-800/80 leading-tight line-clamp-2 mt-0.5">
                {achievement.description}
              </p>

              {!isUnlocked && (
                <div className="absolute inset-0 bg-gray-200/10 rounded-2xl flex items-center justify-center cursor-not-allowed">
                  <span className="sr-only">Locked</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
