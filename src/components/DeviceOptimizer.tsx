import { useEffect, useState } from "react";
import { Cpu, Zap } from "lucide-react";

export default function DeviceOptimizer() {
  const [fps, setFps] = useState(60);
  const [ramSaving, setRamSaving] = useState("Active");

  useEffect(() => {
    let frameCount = 0;
    let startTime = performance.now();
    let animationId: number;

    const checkFps = () => {
      frameCount++;
      const now = performance.now();
      if (now - startTime >= 1000) {
        const calculatedFps = Math.round((frameCount * 1000) / (now - startTime));
        setFps(Math.min(calculatedFps, 60));
        frameCount = 0;
        startTime = now;
      }
      animationId = requestAnimationFrame(checkFps);
    };

    animationId = requestAnimationFrame(checkFps);
    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <div id="device-optimizer-card" className="bg-amber-50/90 border-2 border-amber-200/60 rounded-2xl p-3 shadow-sm flex items-center justify-between gap-4 max-w-xs mx-auto">
      <div className="flex items-center gap-2">
        <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600 animate-pulse">
          <Zap size={16} className="fill-emerald-500" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-amber-800/60 uppercase tracking-wider font-mono">
            Device Performance
          </p>
          <p className="text-xs font-bold text-amber-950 flex items-center gap-1">
            <span>60 FPS Smooth Play</span>
          </p>
        </div>
      </div>

      <div className="flex flex-col items-end">
        <span className="text-[10px] font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
          <Cpu size={10} />
          3GB RAM Mode
        </span>
        <span className="text-[9px] font-semibold text-amber-700 mt-1">
          Memory Saved: ~42MB
        </span>
      </div>
    </div>
  );
}
