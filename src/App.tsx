import { useEffect, useState, useRef, useMemo } from "react";
import confetti from "canvas-confetti";
import {
  Volume2,
  VolumeX,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Play,
  Pause,
  HelpCircle,
  CheckCircle2,
  RotateCcw,
  BookOpen,
  ArrowRight,
  BatteryCharging,
  Coins,
  Smile,
  CloudLightning,
  Flame,
  Wifi,
  WifiOff,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import DeviceOptimizer from "./components/DeviceOptimizer";
import AchievementCollection from "./components/AchievementCollection";
import SoundWave from "./components/SoundWave";
import { WordGames } from "./components/WordGames";
import { StoryData, Achievement } from "./types";
import { playChime, playSuccess, playFailure, playSparkle } from "./utils/audio";
import pipRobot from "./assets/images/pip_robot_buddy_1782309179646.jpg";

// Default Story and Quiz defined in the prompt guidelines
const DEFAULT_STORY_DATA: StoryData = {
  storyText: "Once upon a time, a clever little robot named Pip lost his shiny blue gear in the Whispering Woods...",
  quiz: {
    question: "What colour was Pip the Robot's lost gear?",
    options: ["Red", "Green", "Blue", "Yellow"],
    answer: "Blue",
  },
};

// Initial state of achievements/badges
const INITIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_listener",
    title: "Good Listener",
    description: "Listen to Pip tell a full story!",
    icon: "compass",
  },
  {
    id: "gear_finder",
    title: "Gear Finder",
    description: "Solve Pip's lost blue gear quiz!",
    icon: "gear",
  },
  {
    id: "starlight_genius",
    title: "Star Scholar",
    description: "Answer a quiz question correctly!",
    icon: "star",
  },
  {
    id: "explorer",
    title: "AI Explorer",
    description: "Generate a new custom story with Gemini!",
    icon: "wand",
  },
];

// Predefined fun themes for kids to generate new stories
const PLAYFUL_THEMES = [
  { label: "Rocket Adventure 🚀", theme: "building a rocket to visit the moon" },
  { label: "Monkey Friend 🐒", theme: "sharing sweet mangoes with a friendly monkey" },
  { label: "Rainbow River 🌈", theme: "crossing a magical color-changing river" },
  { label: "Deep Sea Dive 🐠", theme: "finding a glowing starfish deep in the ocean" },
];

export default function App() {
  // Application Data States
  const [currentStory, setCurrentStory] = useState<StoryData>(DEFAULT_STORY_DATA);
  const [achievements, setAchievements] = useState<Achievement[]>(() => {
    const saved = localStorage.getItem("peblo_achievements");
    return saved ? JSON.parse(saved) : INITIAL_ACHIEVEMENTS;
  });

  // Daily Streak Counter State (tracks consecutive days story & quiz completed)
  const [streak, setStreak] = useState<{ count: number; lastCompletedDate: string | null }>(() => {
    const savedStreak = localStorage.getItem("peblo_streak_count");
    const savedLastDate = localStorage.getItem("peblo_last_completed_date");
    
    let count = savedStreak ? parseInt(savedStreak, 10) : 0;
    if (savedLastDate) {
      const getLocalDateString = (d: Date = new Date()): string => {
        const offset = d.getTimezoneOffset();
        const localDate = new Date(d.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split("T")[0];
      };
      const todayStr = getLocalDateString();
      
      if (savedLastDate !== todayStr) {
        // Parse dates to calculate difference
        const todayDate = new Date(todayStr + "T00:00:00");
        const lastDate = new Date(savedLastDate + "T00:00:00");
        const diffTime = todayDate.getTime() - lastDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 1) {
          count = 0; // Streak broken!
        }
      }
    }
    return { count, lastCompletedDate: savedLastDate };
  });

  // UI Flow States
  const [isMuted, setIsMuted] = useState(false);
  const [isLoadingSpeech, setIsLoadingSpeech] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSpeechPaused, setIsSpeechPaused] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [quizUnlocked, setQuizUnlocked] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [quizState, setQuizState] = useState<"unanswered" | "wrong" | "correct">("unanswered");
  const [shakeTrigger, setShakeTrigger] = useState(0);
  const [hintUsed, setHintUsed] = useState(false);
  const [dimmedOptions, setDimmedOptions] = useState<string[]>([]);

  // Gemini Generation States
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [customTheme, setCustomTheme] = useState("");
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Zoom Level State for Reading Highlight ("medium" | "large" | "giant")
  const [zoomLevel, setZoomLevel] = useState<"medium" | "large" | "giant">("large");

  // Narration Speed State ("slow" | "normal" | "fast")
  const [narrationSpeed, setNarrationSpeed] = useState<"slow" | "normal" | "fast">("normal");

  // Toast Notifications State
  const [toasts, setToasts] = useState<{ id: string; message: string; type: "info" | "success" | "warning" | "error" }[]>([]);

  // Add toast helper
  const addToast = (message: string, type: "info" | "success" | "warning" | "error" = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Audio Progress
  const [speechProgress, setSpeechProgress] = useState(0);

  // Word-by-word tracking
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(-1);
  const [isFullNarrating, setIsFullNarrating] = useState(false);
  const [elapsedSpeechMs, setElapsedSpeechMs] = useState(0);

  // Parse story text into words with index bounds
  const storyWords = useMemo(() => {
    const words: { text: string; start: number; end: number }[] = [];
    const regex = /\S+/g;
    let match;
    while ((match = regex.exec(currentStory.storyText)) !== null) {
      words.push({
        text: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }
    return words;
  }, [currentStory.storyText]);

  // Compute expected duration (ms) for each word in the story
  const wordTimings = useMemo(() => {
    if (storyWords.length === 0) return [];
    
    // Average character speaking duration in milliseconds
    let msPerChar = 52; // normal: ~140 WPM, ~5 chars per word -> ~250ms per word + pause
    if (narrationSpeed === "slow") msPerChar = 85;
    if (narrationSpeed === "fast") msPerChar = 38;
    
    let cumulativeTime = 0;
    return storyWords.map((word) => {
      // Base duration proportional to word length + some minimum padding for transitions
      const wordLength = word.text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").length || 1;
      const duration = (wordLength * msPerChar) + 160; // weight by char length plus minimum base pause
      const startMs = cumulativeTime;
      cumulativeTime += duration;
      return {
        word,
        startMs,
        duration,
        endMs: cumulativeTime,
      };
    });
  }, [storyWords, narrationSpeed]);

  const totalStoryDuration = useMemo(() => {
    if (wordTimings.length === 0) return 0;
    return wordTimings[wordTimings.length - 1].endMs;
  }, [wordTimings]);

  // TTS References
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechTimerRef = useRef<number | null>(null);
  const isFirstRender = useRef(true);

  // Sync Achievements to LocalStorage
  useEffect(() => {
    localStorage.setItem("peblo_achievements", JSON.stringify(achievements));
  }, [achievements]);

  const isGeneratingRef = useRef(isGeneratingStory);
  useEffect(() => {
    isGeneratingRef.current = isGeneratingStory;
  }, [isGeneratingStory]);

  // Detect network connectivity changes
  useEffect(() => {
    const handleOnline = () => {
      addToast("Woohoo! Connection restored. Back online!", "success");
    };

    const handleOffline = () => {
      if (isGeneratingRef.current) {
        addToast("Oh no! You went offline while generating a new story! Reconnect to try again.", "error");
      } else {
        addToast("Oops! It looks like you've gone offline.", "warning");
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Auto-play narration when story is generated or changed
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    
    setIsSpeaking(false);
    setIsSpeechPaused(false);
    setIsLoadingSpeech(false);
    setSpeechProgress(0);
    setCurrentWordIndex(-1);

    const timer = setTimeout(() => {
      startStorySpeech();
    }, 150);

    return () => clearTimeout(timer);
  }, [currentStory]);

  // Handle Speech Progress & Word Highlight Simulation (to ensure it works flawlessly in all browsers/iframes)
  useEffect(() => {
    let timer: number | null = null;
    if (isFullNarrating && isSpeaking && !isSpeechPaused) {
      const startTime = Date.now() - elapsedSpeechMs;
      timer = window.setInterval(() => {
        const elapsed = Date.now() - startTime;
        setElapsedSpeechMs(elapsed);
        
        // Find current word based on elapsed time
        const currentWordIdx = wordTimings.findIndex(
          (t) => elapsed >= t.startMs && elapsed < t.endMs
        );
        
        if (currentWordIdx !== -1) {
          setCurrentWordIndex(currentWordIdx);
          setSpeechProgress(Math.min(100, Math.round(((currentWordIdx + 1) / storyWords.length) * 100)));
        } else if (elapsed >= totalStoryDuration && totalStoryDuration > 0) {
          // Finished standard estimation, auto-complete if browser TTS was quiet/blocked
          setSpeechProgress(100);
          setCurrentWordIndex(-1);
          setIsSpeaking(false);
          setIsFullNarrating(false);
          setQuizUnlocked(true);
          unlockAchievement("first_listener");
          if (timer) clearInterval(timer);
        }
      }, 50);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isFullNarrating, isSpeaking, isSpeechPaused, elapsedSpeechMs, wordTimings, totalStoryDuration, storyWords.length]);

  // TTS Engine Functions
  const startStorySpeech = () => {
    try {
      if (!("speechSynthesis" in window)) {
        throw new Error("Text-to-speech is not supported in this browser.");
      }

      // If already speaking, pause or resume instead of restarting
      if (isSpeaking) {
        if (isSpeechPaused) {
          window.speechSynthesis.resume();
          setIsSpeechPaused(false);
        } else {
          window.speechSynthesis.pause();
          setIsSpeechPaused(true);
        }
        return;
      }

      // Reset states
      window.speechSynthesis.cancel();
      setIsLoadingSpeech(true);
      setSpeechError(null);
      setSpeechProgress(0);
      setCurrentWordIndex(-1);
      setElapsedSpeechMs(0);
      setIsFullNarrating(true);

      playChime(isMuted);

      const utterance = new SpeechSynthesisUtterance(currentStory.storyText);
      utteranceRef.current = utterance;

      // Kid-friendly voice customization
      const voices = window.speechSynthesis.getVoices();
      // Look for a friendly, natural sounding English voice
      const preferredVoice =
        voices.find((v) => v.name.includes("Google") && v.lang.startsWith("en")) ||
        voices.find((v) => v.name.includes("Natural") && v.lang.startsWith("en")) ||
        voices.find((v) => v.lang.startsWith("en-IN")) || // English (India)
        voices.find((v) => v.lang.startsWith("en"));

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      // Slightly higher pitch and cheerful speed to simulate Pip the cute robot
      utterance.pitch = isMuted ? 0 : 1.35;
      
      let rateFactor = 1.02;
      if (narrationSpeed === "slow") rateFactor = 0.72;
      else if (narrationSpeed === "fast") rateFactor = 1.32;
      
      utterance.rate = rateFactor;
      utterance.volume = isMuted ? 0 : 1.0;

      // TTS event callbacks
      utterance.onstart = () => {
        setIsLoadingSpeech(false);
        setIsSpeaking(true);
        setIsSpeechPaused(false);
        setCurrentWordIndex(0);
        setElapsedSpeechMs(0);
        setIsFullNarrating(true);
      };

      // Real-time boundary event to highlight current word (keeps as fallback if it fires)
      utterance.onboundary = (event) => {
        if (event.name === "word") {
          const charIndex = event.charIndex;
          const matchIndex = storyWords.findIndex(
            (w) => charIndex >= w.start && charIndex < w.end
          );
          if (matchIndex !== -1) {
            setCurrentWordIndex(matchIndex);
            setSpeechProgress(Math.min(100, Math.round(((matchIndex + 1) / storyWords.length) * 100)));
          } else {
            let closestIdx = -1;
            for (let i = 0; i < storyWords.length; i++) {
              if (storyWords[i].start <= charIndex) {
                closestIdx = i;
              } else {
                break;
              }
            }
            if (closestIdx !== -1) {
              setCurrentWordIndex(closestIdx);
              setSpeechProgress(Math.min(100, Math.round(((closestIdx + 1) / storyWords.length) * 100)));
            }
          }
        }
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setIsSpeechPaused(false);
        setIsFullNarrating(false);
        setElapsedSpeechMs(0);
        setSpeechProgress(100);
        setCurrentWordIndex(-1);
        setQuizUnlocked(true);
        unlockAchievement("first_listener");
      };

      utterance.onerror = (e) => {
        console.error("Speech Synthesis Error:", e);
        setIsLoadingSpeech(false);
        setIsSpeaking(false);
        setIsFullNarrating(false);
        setElapsedSpeechMs(0);
        setCurrentWordIndex(-1);
        // Fallback for iframe restrictions or muted tabs: immediately unlock the quiz so the child isn't stuck
        setSpeechProgress(100);
        setQuizUnlocked(true);
        setSpeechError("Sound was played quietly, you can now play the quiz! 🌟");
      };

      window.speechSynthesis.speak(utterance);
    } catch (err: any) {
      console.error(err);
      setIsLoadingSpeech(false);
      setIsSpeaking(false);
      setIsFullNarrating(false);
      setElapsedSpeechMs(0);
      setCurrentWordIndex(-1);
      setQuizUnlocked(true);
      setSpeechError("Oh! Pip's speakers are resting, but you can read the story below! 📖");
    }
  };

  const stopStorySpeech = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsSpeechPaused(false);
    setIsLoadingSpeech(false);
    setIsFullNarrating(false);
    setElapsedSpeechMs(0);
    setSpeechProgress(0);
    setCurrentWordIndex(-1);
  };

  // Mute / Unmute
  const toggleMute = () => {
    setIsMuted((prev) => {
      const nextMuted = !prev;
      if (utteranceRef.current && "speechSynthesis" in window) {
        // Unfortunately standard Synthesis doesn't support changing volume mid-speech in all browsers,
        // so we cancel and play from where we were, or toggle standard browser audio state representation.
        if (isSpeaking) {
          window.speechSynthesis.cancel();
          setTimeout(() => {
            startStorySpeech();
          }, 50);
        }
      }
      return nextMuted;
    });
  };

  // Handle Quiz Submissions
  const handleOptionClick = (option: string) => {
    if (quizState === "correct") return; // Completed
    setSelectedOption(option);

    const isCorrect = option.toLowerCase() === currentStory.quiz.answer.toLowerCase();

    if (isCorrect) {
      setQuizState("correct");
      playSuccess(isMuted);
      triggerSuccessCelebration();
    } else {
      setQuizState("wrong");
      playFailure(isMuted);
      setShakeTrigger((prev) => prev + 1);
      // Native vibration simulation
      if ("vibrate" in navigator) {
        navigator.vibrate(150);
      }
      // Simple automated reset for kid to try again after a brief moment
      setTimeout(() => {
        setQuizState("unanswered");
      }, 1000);
    }
  };

  const triggerSuccessCelebration = () => {
    // Canvas Confetti explosive burst
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#FBBF24", "#60A5FA", "#34D399", "#F87171", "#A78BFA"],
    });

    // Increment daily streak
    incrementStreak();

    // Unlocks corresponding badges
    unlockAchievement("starlight_genius");
    if (currentStory.quiz.answer === "Blue") {
      unlockAchievement("gear_finder");
    }
  };

  const incrementStreak = () => {
    const getLocalDateString = (d: Date = new Date()): string => {
      const offset = d.getTimezoneOffset();
      const localDate = new Date(d.getTime() - (offset * 60 * 1000));
      return localDate.toISOString().split("T")[0];
    };
    const todayStr = getLocalDateString();
    
    setStreak((prev) => {
      if (prev.lastCompletedDate === todayStr) {
        // Already completed today, streak remains the same
        return prev;
      }
      
      let newCount = prev.count;
      if (prev.lastCompletedDate) {
        const todayDate = new Date(todayStr + "T00:00:00");
        const lastDate = new Date(prev.lastCompletedDate + "T00:00:00");
        const diffTime = todayDate.getTime() - lastDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          newCount += 1; // Consecutive day!
        } else {
          newCount = 1; // Broke streak, but starting a new one today
        }
      } else {
        newCount = 1; // First completion ever
      }
      
      localStorage.setItem("peblo_streak_count", newCount.toString());
      localStorage.setItem("peblo_last_completed_date", todayStr);
      
      return { count: newCount, lastCompletedDate: todayStr };
    });
  };

  const unlockAchievement = (id: string) => {
    setAchievements((prev) => {
      const target = prev.find((ach) => ach.id === id);
      if (target && !target.unlockedAt) {
        setTimeout(() => playSparkle(isMuted), 150);
        return prev.map((ach) =>
          ach.id === id
            ? { ...ach, unlockedAt: new Date().toLocaleTimeString() }
            : ach
        );
      }
      return prev;
    });
  };

  const resetStickers = () => {
    setAchievements(INITIAL_ACHIEVEMENTS);
  };

  // Generate New Custom Story with Gemini API
  const [isOnlineSimulated, setIsOnlineSimulated] = useState(true); // Added for simulation support if needed

  const generateNewStory = async (themeName: string) => {
    if (!navigator.onLine) {
      addToast("Oh no! You are offline. Pip cannot fetch a new story right now.", "error");
      setGenerationError("Offline mode: Please check your internet connection and try again.");
      return;
    }

    setIsGeneratingStory(true);
    setGenerationError(null);
    stopStorySpeech();

    try {
      const response = await fetch("/api/story/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ theme: themeName }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate custom story from Peblo AI server.");
      }

      const data: StoryData = await response.json();
      if (!data.storyText || !data.quiz) {
        throw new Error("Invalid story structure returned from AI.");
      }

      // Load new story & quiz dynamically!
      setCurrentStory(data);
      setQuizUnlocked(false);
      setSelectedOption(null);
      setQuizState("unanswered");
      setSpeechProgress(0);
      setCurrentWordIndex(-1);
      setSpeechError(null);
      setHintUsed(false);
      setDimmedOptions([]);

      // Award achievement for custom AI exploration
      unlockAchievement("explorer");
    } catch (err: any) {
      console.error(err);
      setGenerationError(err.message || "Pip lost signal in the woods! Try clicking again.");
    } finally {
      setIsGeneratingStory(false);
    }
  };

  // Get Hint helper for the quiz
  const handleGetHint = () => {
    if (hintUsed || quizState === "correct") return;

    const correctAnswer = currentStory.quiz.answer;
    const incorrectOptions = currentStory.quiz.options.filter(
      (opt) => opt.toLowerCase() !== correctAnswer.toLowerCase()
    );

    // Randomly shuffle incorrect options and select 2 of them to dim
    const shuffled = [...incorrectOptions].sort(() => 0.5 - Math.random());
    const toDim = shuffled.slice(0, 2);

    setDimmedOptions(toDim);
    setHintUsed(true);
    playSparkle(isMuted); // Play magic sparkle sound for hint
  };

  // Return to Default Story
  const resetToDefault = () => {
    stopStorySpeech();
    setCurrentStory(DEFAULT_STORY_DATA);
    setQuizUnlocked(false);
    setSelectedOption(null);
    setQuizState("unanswered");
    setSpeechProgress(0);
    setCurrentWordIndex(-1);
    setSpeechError(null);
    setHintUsed(false);
    setDimmedOptions([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-200 via-amber-100 to-emerald-100 py-6 px-4 flex flex-col items-center justify-start select-none font-sans overflow-x-hidden">
      {/* Toast Notifications */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-xs sm:max-w-sm px-4 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl shadow-xl border-3 text-xs font-bold leading-tight select-none relative ${
                toast.type === "success"
                  ? "bg-emerald-50 border-emerald-300 text-emerald-950 shadow-emerald-200/50"
                  : toast.type === "error"
                  ? "bg-rose-50 border-rose-300 text-rose-950 shadow-rose-200/50"
                  : toast.type === "warning"
                  ? "bg-amber-50 border-amber-300 text-amber-950 shadow-amber-200/50"
                  : "bg-sky-50 border-sky-300 text-sky-950 shadow-sky-200/50"
              }`}
            >
              <span className="text-lg flex-shrink-0 leading-none mt-0.5">
                {toast.type === "success" && "🎉"}
                {toast.type === "error" && "🚨"}
                {toast.type === "warning" && "⚠️"}
                {toast.type === "info" && "✨"}
              </span>
              <div className="flex-1 pr-4">
                {toast.message}
              </div>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="absolute right-3 top-3 hover:scale-110 active:scale-95 text-slate-400 hover:text-slate-600 transition-transform cursor-pointer"
              >
                ✕
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Decorative Cloud elements */}
      <div className="absolute top-10 left-10 w-24 h-8 bg-white/60 rounded-full blur-sm pointer-events-none animate-pulse" />
      <div className="absolute top-24 right-12 w-32 h-10 bg-white/50 rounded-full blur-sm pointer-events-none" />

      {/* Title & Brand Header */}
      <header className="text-center mb-4 max-w-md w-full relative">
        <div className="flex items-center justify-between px-2 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-2xl font-black text-amber-500 bg-amber-100 border-2 border-amber-300 w-10 h-10 rounded-full flex items-center justify-center shadow-sm">
              P
            </span>
            <span className="text-xl font-black text-amber-950 tracking-tight">
              peblo <span className="text-amber-500 font-extrabold text-xs bg-amber-100 px-1.5 py-0.5 rounded-full uppercase">Buddy</span>
            </span>
          </div>

          {/* Sound Controls & Streak */}
          <div className="flex items-center gap-2">
            {/* Streak Counter */}
            <motion.div 
              animate={{ scale: streak.count > 0 ? [1, 1.08, 1] : 1 }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className={`flex items-center gap-1.5 px-3 py-1 border-2 rounded-full shadow-sm ${
                streak.count > 0 
                  ? "bg-orange-100 border-orange-300 text-orange-600" 
                  : "bg-slate-100 border-slate-300 text-slate-400"
              }`}
              title={streak.count > 0 ? `${streak.count} Day Streak!` : "Start your adventure streak today!"}
            >
              <Flame size={16} className={streak.count > 0 ? "fill-orange-500 text-orange-500 animate-pulse" : "text-slate-400"} />
              <span className="text-xs font-black">{streak.count}</span>
            </motion.div>

            {/* Sound Controls */}
            <button
              onClick={toggleMute}
              className={`p-2.5 rounded-full border-2 transition-all duration-300 ${
                isMuted
                  ? "bg-rose-100 border-rose-300 text-rose-500"
                  : "bg-amber-100 border-amber-300 text-amber-600 hover:bg-amber-200"
              }`}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>
        </div>

        {/* Dynamic Performance Optimization Banner */}
        <DeviceOptimizer />
      </header>

      {/* Main Container simulating an elegant kid-friendly mobile wrapper */}
      <main className="w-full max-w-md bg-white border-[6px] border-amber-400 rounded-[38px] shadow-2xl p-5 relative overflow-hidden flex flex-col gap-4">
        {/* Playful Top Status notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-5 bg-amber-400 rounded-b-2xl flex items-center justify-around px-4">
          <span className="w-2.5 h-2.5 bg-white/70 rounded-full" />
          <div className="flex gap-1">
            <BatteryCharging size={11} className="text-white/80" />
            <span className="text-[9px] font-bold text-white/80">98%</span>
          </div>
        </div>

        {/* Buddy Character Area */}
        <section className="mt-4 flex flex-col items-center">
          <div className="relative">
            {/* Pulsating back glow */}
            <div
              className={`absolute -inset-2 rounded-full blur-md transition-all duration-500 ${
                isSpeaking
                  ? "bg-amber-400/50 scale-105 animate-pulse"
                  : "bg-sky-200/40"
              }`}
            />

            {/* Character image frame */}
            <motion.div
              animate={
                isSpeaking
                  ? { y: [0, -6, 0] }
                  : quizState === "correct"
                  ? { scale: [1, 1.2, 1], y: [0, -15, 0] }
                  : {}
              }
              transition={
                isSpeaking
                  ? { repeat: Infinity, duration: 0.8, ease: "easeInOut" }
                  : quizState === "correct"
                  ? { duration: 0.6, ease: "easeOut" }
                  : {}
              }
              className="relative w-36 h-36 rounded-full border-4 border-amber-400 overflow-hidden bg-sky-50 shadow-md flex items-center justify-center z-10"
            >
              <img
                src={pipRobot}
                alt="Pip the Robot"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />

              {/* Talking status indicator bar */}
              {isSpeaking && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-amber-500 text-[10px] font-black text-white px-2 py-0.5 rounded-full shadow-md">
                  SPEAKING 🎙️
                </div>
              )}
            </motion.div>
          </div>

          {/* Dynamic sound waves during speaking */}
          <div className="mt-2 h-8 w-full flex items-center justify-center">
            <SoundWave isPlaying={isSpeaking && !isSpeechPaused} />
          </div>
        </section>

        {/* Story Text Card */}
        <section className="bg-amber-50/95 border-3 border-amber-200 rounded-3xl p-5 pt-9 shadow-inner relative">
          {/* Interactive Floating Word Pop-up Bubble */}
          <AnimatePresence>
            {isSpeaking && currentWordIndex >= 0 && storyWords[currentWordIndex] && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -10 }}
                className="absolute top-2 left-1/2 -translate-x-1/2 bg-amber-400 border-2 border-amber-500 text-amber-950 px-3 py-1 rounded-xl shadow-md flex items-center gap-1.5 z-40 font-black text-xs select-none whitespace-nowrap"
              >
                <span>💬 Pip reads:</span>
                <span className="bg-white text-orange-600 px-2 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider inline-block shadow-sm">
                  {storyWords[currentWordIndex]?.text?.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()""“’”]/g, "") || ""}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <span className="absolute -top-3 left-4 bg-amber-400 text-amber-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider">
            Today's Story Snippet
          </span>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStory.storyText}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="text-base md:text-lg text-amber-950 leading-relaxed text-center mt-2 flex flex-wrap gap-x-1.5 justify-center items-center"
            >
              <span className="text-amber-400 font-extrabold font-serif text-xl">“</span>
              {storyWords.map((word, index) => {
                const isCurrent = isSpeaking && index === currentWordIndex;
                const zoomFactor = zoomLevel === "medium" ? 1.28 : zoomLevel === "large" ? 1.55 : 1.85;
                const translateYFactor = zoomLevel === "medium" ? -4 : zoomLevel === "large" ? -7 : -11;

                return (
                  <motion.span
                    key={index}
                    animate={{
                      scale: isCurrent ? zoomFactor : 1,
                      y: isCurrent ? translateYFactor : 0,
                      color: isCurrent ? "#ea580c" : "#451a03", // orange-600 or amber-950
                      backgroundColor: isCurrent ? "#ffedd5" : "transparent", // warm orange-100/amber-100 or transparent
                    }}
                    style={{
                      zIndex: isCurrent ? 30 : 1,
                    }}
                    transition={{ type: "spring", stiffness: 350, damping: 18 }}
                    className={`inline-block px-1 py-0.5 rounded-lg select-none ${
                      isCurrent 
                        ? "font-black shadow-md border-2 border-amber-300" 
                        : "font-bold hover:text-amber-700 hover:scale-105 transition-transform duration-200 cursor-pointer"
                    }`}
                    onClick={() => {
                      try {
                        setCurrentWordIndex(index);
                        setIsSpeaking(true);
                        
                        const u = new SpeechSynthesisUtterance(word.text);
                        u.pitch = 1.35;
                        let wordRateFactor = 1.0;
                        if (narrationSpeed === "slow") wordRateFactor = 0.7;
                        else if (narrationSpeed === "fast") wordRateFactor = 1.3;
                        u.rate = wordRateFactor;
                        u.volume = isMuted ? 0 : 1.0;
                        
                        u.onend = () => {
                          setIsSpeaking(false);
                          setCurrentWordIndex(-1);
                        };
                        u.onerror = () => {
                          setIsSpeaking(false);
                          setCurrentWordIndex(-1);
                        };
                        
                        window.speechSynthesis.cancel();
                        window.speechSynthesis.speak(u);
                      } catch (e) {
                        console.error(e);
                        setIsSpeaking(false);
                        setCurrentWordIndex(-1);
                      }
                    }}
                  >
                    {word.text}
                  </motion.span>
                );
              })}
              <span className="text-amber-400 font-extrabold font-serif text-xl">”</span>
            </motion.div>
          </AnimatePresence>

          {/* Sound playbar progress */}
          <div className="mt-4 bg-amber-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-amber-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${speechProgress}%` }}
            />
          </div>

          {/* Word Zoom Magnifier Controls */}
          <div className="mt-4 pt-3 border-t border-amber-200/60 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold text-amber-900/80 flex items-center gap-1">
              <span>🔍 Kids Word Zoom:</span>
            </span>
            <div className="flex bg-amber-100/50 rounded-xl p-1 gap-1 border border-amber-200">
              {(["medium", "large", "giant"] as const).map((level) => {
                const label = level === "medium" ? "Standard" : level === "large" ? "Big Pop 🚀" : "Super Zoom 🔍";
                const isActive = zoomLevel === level;
                return (
                  <button
                    key={level}
                    onClick={() => {
                      setZoomLevel(level);
                      playSparkle(isMuted); // Play a lovely sound cue!
                    }}
                    className={`px-2 py-1 text-[10px] font-black rounded-lg transition-all ${
                      isActive
                        ? "bg-amber-400 text-amber-950 shadow-sm"
                        : "text-amber-800/80 hover:bg-amber-200/40"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Narration Speed Controls */}
          <div className="mt-3 pt-3 border-t border-amber-200/60 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold text-amber-900/80 flex items-center gap-1">
              <span>🐢 Narration Speed:</span>
            </span>
            <div className="flex bg-amber-100/50 rounded-xl p-1 gap-1 border border-amber-200">
              {(["slow", "normal", "fast"] as const).map((speed) => {
                const label = speed === "slow" ? "Slow 🐢" : speed === "normal" ? "Normal 🚶" : "Fast ⚡";
                const isActive = narrationSpeed === speed;
                return (
                  <button
                    key={speed}
                    onClick={() => {
                      setNarrationSpeed(speed);
                      playSparkle(isMuted); // Play a lovely sound cue!
                      
                      // If currently speaking, restart narration at the new speed
                      if (isSpeaking && !isSpeechPaused) {
                        setTimeout(() => {
                          startStorySpeech();
                        }, 100);
                      }
                    }}
                    className={`px-2 py-1 text-[10px] font-black rounded-lg transition-all ${
                      isActive
                        ? "bg-amber-400 text-amber-950 shadow-sm"
                        : "text-amber-800/80 hover:bg-amber-200/40"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Read Me a Story Primary Button */}
          <div className="mt-4 flex flex-col items-center justify-center gap-2">
            <button
              onClick={startStorySpeech}
              disabled={isLoadingSpeech}
              className={`w-full py-3.5 px-6 rounded-2xl font-black text-lg shadow-lg flex items-center justify-center gap-3 transition-transform active:scale-95 ${
                isSpeaking
                  ? isSpeechPaused
                    ? "bg-amber-400 text-amber-950 hover:bg-amber-500"
                    : "bg-amber-500 text-white"
                  : "bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-amber-950"
              }`}
            >
              {isLoadingSpeech ? (
                <>
                  <RefreshCw className="animate-spin" size={20} />
                  <span>Preparing Voice...</span>
                </>
              ) : isSpeaking ? (
                <>
                  {isSpeechPaused ? <Play size={20} /> : <Pause size={20} />}
                  <span>{isSpeechPaused ? "Resume Narration" : "Pause Narration"}</span>
                </>
              ) : (
                <>
                  <BookOpen size={22} className="animate-bounce" />
                  <span>Read Me a Story!</span>
                </>
              )}
            </button>

            {isSpeaking && (
              <button
                onClick={stopStorySpeech}
                className="text-xs font-bold text-amber-700/80 hover:text-amber-900 bg-amber-200/50 px-3 py-1.5 rounded-full transition-all"
              >
                Stop Story ⏹️
              </button>
            )}

            {speechError && (
              <p className="text-[11px] font-bold text-amber-800 text-center mt-2 flex items-center gap-1">
                <Smile size={12} className="text-amber-600 shrink-0" />
                <span>{speechError}</span>
              </p>
            )}
          </div>
        </section>

        {/* Data-driven Interactive Quiz Section */}
        <section className="relative">
          <AnimatePresence>
            {!quizUnlocked ? (
              <motion.div
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-sky-50/50 border-2 border-dashed border-sky-200 rounded-3xl p-6 text-center"
              >
                <HelpCircle size={24} className="mx-auto text-sky-400 animate-pulse mb-2" />
                <p className="text-xs font-bold text-sky-950/70">
                  Listen to Pip read the story snippet aloud first to unlock the interactive quiz!
                </p>
                <button
                  onClick={() => setQuizUnlocked(true)}
                  className="text-[10px] font-extrabold text-sky-500 hover:text-sky-700 underline mt-2"
                >
                  Skip listening & play quiz
                </button>
              </motion.div>
            ) : (
              <motion.div
                key={currentStory.quiz.question}
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 100 }}
                className="bg-sky-50 border-3 border-sky-200 rounded-3xl p-5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-sky-400 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-black">
                      ?
                    </span>
                    <h4 className="text-sm font-black text-sky-950">
                      Pip's Question
                    </h4>
                  </div>

                  {/* Get a Hint Button */}
                  {quizState !== "correct" && (
                    <button
                      onClick={handleGetHint}
                      disabled={hintUsed}
                      className={`text-[11px] font-black px-3 py-1 rounded-full border-2 transition-all duration-200 flex items-center gap-1.5 shadow-sm active:scale-95 ${
                        hintUsed
                          ? "bg-sky-100 border-sky-200 text-sky-400 cursor-not-allowed"
                          : "bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200"
                      }`}
                    >
                      <span>🪄</span>
                      <span>{hintUsed ? "Hint Used" : "Get a Hint"}</span>
                    </button>
                  )}
                </div>

                {/* Question */}
                <h3 className="text-base font-black text-amber-950 leading-tight mb-3">
                  {currentStory.quiz.question}
                </h3>

                {/* Hint Used Magic Banner Visual Feedback */}
                {hintUsed && quizState !== "correct" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mb-3 px-3 py-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-800 flex items-center gap-1.5 shadow-sm"
                  >
                    <span className="animate-bounce">🪄</span>
                    <span><strong>Magic Spell Cast!</strong> Two tricky answers have been dimmed.</span>
                  </motion.div>
                )}

                {/* Multiple choice options */}
                <motion.div
                  key={shakeTrigger}
                  animate={
                    quizState === "wrong"
                      ? { x: [-10, 10, -10, 10, -5, 5, 0] }
                      : {}
                  }
                  transition={{ duration: 0.4 }}
                  className="flex flex-col gap-2.5"
                >
                  {currentStory.quiz.options.map((option, index) => {
                    const isSelected = selectedOption === option;
                    const isDimmed = dimmedOptions.includes(option);
                    let optionStyle = "bg-white border-sky-200 text-sky-950 hover:bg-sky-100/50";

                    if (isDimmed) {
                      optionStyle = "bg-slate-100/60 border-slate-200 text-slate-400/80 opacity-45 cursor-not-allowed scale-95 shadow-none";
                    } else if (isSelected) {
                      if (quizState === "correct") {
                        optionStyle = "bg-emerald-400 border-emerald-500 text-white font-black scale-102 shadow-emerald-200";
                      } else if (quizState === "wrong") {
                        optionStyle = "bg-rose-400 border-rose-500 text-white font-black scale-98 animate-shake";
                      }
                    }

                    return (
                      <button
                        key={option}
                        onClick={() => !isDimmed && handleOptionClick(option)}
                        disabled={quizState === "correct" || isDimmed}
                        className={`w-full py-3 px-4 rounded-2xl border-2 text-sm font-bold text-left flex items-center justify-between transition-all active:scale-98 ${optionStyle}`}
                      >
                        <span className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black transition-colors ${
                            isDimmed ? "bg-slate-200 text-slate-400" : "bg-amber-100 text-amber-800"
                          }`}>
                            {String.fromCharCode(65 + index)}
                          </span>
                          <span className={isDimmed ? "line-through decoration-slate-300 decoration-1" : ""}>{option}</span>
                        </span>

                        {isSelected && quizState === "correct" && (
                          <CheckCircle2 size={18} className="text-white fill-emerald-600" />
                        )}
                        {isSelected && quizState === "wrong" && (
                          <span className="text-[10px] font-black bg-rose-600 text-white px-2 py-0.5 rounded-full">
                            Oops!
                          </span>
                        )}
                        {isDimmed && (
                          <span className="text-[10px] font-black bg-slate-200 text-slate-500 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            Dimmed 🪄
                          </span>
                        )}
                      </button>
                    );
                  })}
                </motion.div>

                {/* Quiz Success State */}
                {quizState === "correct" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 bg-emerald-100 border-2 border-emerald-300 rounded-2xl text-center flex flex-col gap-2.5"
                  >
                    <div>
                      <p className="text-sm font-black text-emerald-950 flex items-center justify-center gap-1.5">
                        🎉 Super Job! Correct answer is {currentStory.quiz.answer}!
                      </p>
                      <p className="text-[10px] text-emerald-800/80 font-bold mt-0.5">
                        You unlocked a new sticker in your book below! 🌟
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        // Pick a random theme and generate next story
                        const randomTheme = PLAYFUL_THEMES[Math.floor(Math.random() * PLAYFUL_THEMES.length)];
                        generateNewStory(randomTheme.theme);
                      }}
                      disabled={isGeneratingStory}
                      className="w-full py-3 px-5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
                    >
                      {isGeneratingStory ? (
                        <>
                          <RefreshCw className="animate-spin" size={16} />
                          <span>Writing next adventure...</span>
                        </>
                      ) : (
                        <>
                          <ArrowRight size={16} className="animate-bounce" />
                          <span>Next Story & Quiz! 🚀</span>
                        </>
                      )}
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Dynamic & Fun Word Games Arcade Section */}
        <section className="relative">
          <WordGames 
            storyText={currentStory.storyText} 
            isMuted={isMuted} 
            onUnlockAchievement={unlockAchievement} 
          />
        </section>

        {/* Gamified AI Custom Story Generator */}
        <section className="bg-gradient-to-r from-emerald-50 to-sky-50 border-3 border-emerald-200 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="text-emerald-500 fill-emerald-100 animate-pulse" size={18} />
              <h4 className="text-sm font-black text-emerald-950">
                Peblo AI Adventure Maker
              </h4>
            </div>
            {currentStory !== DEFAULT_STORY_DATA && (
              <button
                onClick={resetToDefault}
                className="text-[10px] font-black text-amber-800 bg-amber-100 px-2 py-1 rounded-lg border border-amber-300 flex items-center gap-1"
              >
                <RotateCcw size={10} />
                Reset Original
              </button>
            )}
          </div>

          {/* Network Status & Simulator Control */}
          <div className="mb-4 flex items-center justify-between bg-white/80 backdrop-blur-sm border-2 border-emerald-100/60 rounded-2xl px-3 py-2 text-[11px] font-bold shadow-sm">
            <div className="flex items-center gap-1.5 text-emerald-950">
              {navigator.onLine ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <Wifi size={14} className="text-emerald-500" />
                  <span>Online & Connected</span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <WifiOff size={14} className="text-rose-500" />
                  <span className="text-rose-600">Offline Mode</span>
                </>
              )}
            </div>
            
            <button
              onClick={() => {
                const isCurrentlyOnline = navigator.onLine;
                const eventName = isCurrentlyOnline ? "offline" : "online";
                const nextState = !isCurrentlyOnline;
                
                Object.defineProperty(navigator, 'onLine', {
                  value: nextState,
                  configurable: true
                });
                
                window.dispatchEvent(new Event(eventName));
                setIsOnlineSimulated(nextState);
              }}
              className="px-2.5 py-1 text-[10px] font-extrabold bg-emerald-100/60 hover:bg-emerald-100 text-emerald-800 rounded-xl border border-emerald-200/50 active:scale-95 transition-all shadow-sm flex items-center gap-1"
            >
              <span>{navigator.onLine ? "🔌 Go Offline" : "⚡ Go Online"}</span>
            </button>
          </div>

          <p className="text-xs text-amber-900/80 leading-relaxed mb-4">
            Click any magical adventure theme below, and our server-side Gemini AI will custom-write a brand new story and interactive quiz just for you!
          </p>

          {/* Quick theme buttons for children */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {PLAYFUL_THEMES.map((theme) => (
              <button
                key={theme.label}
                disabled={isGeneratingStory}
                onClick={() => generateNewStory(theme.theme)}
                className="text-xs font-bold text-emerald-900 bg-white hover:bg-emerald-100/50 border-2 border-emerald-100 py-2.5 px-3 rounded-2xl shadow-sm text-center transition-all duration-300 active:scale-95 disabled:opacity-50"
              >
                {theme.label}
              </button>
            ))}
          </div>

          {/* Manual Input Theme option */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Or write custom adventure..."
              value={customTheme}
              onChange={(e) => setCustomTheme(e.target.value)}
              disabled={isGeneratingStory}
              className="flex-1 bg-white border-2 border-emerald-100 rounded-2xl px-3 py-2 text-xs font-semibold text-emerald-950 placeholder:text-emerald-900/50 focus:outline-none focus:border-emerald-300"
            />
            <button
              onClick={() => generateNewStory(customTheme)}
              disabled={isGeneratingStory || !customTheme.trim()}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-4 py-2 rounded-2xl shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1"
            >
              {isGeneratingStory ? (
                <RefreshCw className="animate-spin" size={12} />
              ) : (
                <ArrowRight size={14} />
              )}
              Go!
            </button>
          </div>

          {generationError && (
            <p className="text-[10px] font-bold text-rose-600 mt-2 flex items-center gap-1">
              <CloudLightning size={10} />
              <span>{generationError}</span>
            </p>
          )}

          {isGeneratingStory && (
            <div className="mt-3 text-center">
              <p className="text-xs font-black text-emerald-600 animate-pulse">
                🪄 Writing magic words...
              </p>
              <p className="text-[10px] text-emerald-800/60 mt-0.5">
                (This runs in server-side safe environment!)
              </p>
            </div>
          )}
        </section>

        {/* Sticker Book Rewards Widget */}
        <AchievementCollection
          achievements={achievements}
          onReset={resetStickers}
        />
      </main>

      {/* Humble, honest footer optimized for mobile users */}
      <footer className="text-center mt-6 max-w-md w-full">
        <p className="text-xs font-black text-amber-950/60 tracking-tight">
          Peblo Learning Systems, Bangalore 🇮🇳
        </p>
        <p className="text-[10px] font-medium text-amber-900/50 mt-1">
          Designed for high-performance and absolute safety on India's mid-range devices.
        </p>
      </footer>
    </div>
  );
}
