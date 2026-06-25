import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Gamepad2, 
  RotateCcw, 
  Volume2, 
  Trophy, 
  Sparkles, 
  ArrowRight, 
  HelpCircle, 
  Check, 
  Zap,
  Info
} from "lucide-react";
import confetti from "canvas-confetti";
import { playSuccess, playFailure, playSparkle } from "../utils/audio";

interface WordGamesProps {
  storyText: string;
  isMuted: boolean;
  onUnlockAchievement?: (id: string) => void;
}

interface GameWord {
  word: string;
  emoji: string;
  hint: string;
}

const PRESET_WORDS: GameWord[] = [
  { word: "ROBOT", emoji: "🤖", hint: "A cute shiny metal friend like Pip!" },
  { word: "MAGIC", emoji: "🪄", hint: "Something wondrous, like a wizard's wand" },
  { word: "STAR", emoji: "⭐", hint: "A glowing light far away in the night sky" },
  { word: "HAPPY", emoji: "😊", hint: "The feeling of wearing a big bright smile" },
  { word: "FOREST", emoji: "🌳", hint: "A beautiful land filled with tall green trees" },
  { word: "GEAR", emoji: "⚙️", hint: "A round spiky wheel that helps machines run" },
  { word: "FRIEND", emoji: "🤝", hint: "Someone special you love to play and share with" },
  { word: "SUNNY", emoji: "☀️", hint: "Bright, warm, and beautiful weather" },
  { word: "SPACE", emoji: "🚀", hint: "The infinite starry playground above the earth" },
  { word: "RIVER", emoji: "🌊", hint: "A flowing stream of clear sparkly water" }
];

export function WordGames({ storyText, isMuted, onUnlockAchievement }: WordGamesProps) {
  const [activeGame, setActiveGame] = useState<"spelling" | "balloon">("spelling");
  const [score, setScore] = useState<number>(0);
  const [streakCount, setStreakCount] = useState<number>(0);
  
  // Dynamic Game State variables
  const [currentWordObj, setCurrentWordObj] = useState<GameWord>(PRESET_WORDS[0]);
  const [scrambledLetters, setScrambledLetters] = useState<{ id: number; char: string; used: boolean }[]>([]);
  const [userSpelling, setUserSpelling] = useState<string[]>([]);
  const [gameStatus, setGameStatus] = useState<"playing" | "success" | "wrong">("playing");
  const [showHint, setShowHint] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  
  // Balloon pop game variables
  const [balloonLetters, setBalloonLetters] = useState<{ id: number; char: string; color: string; popped: boolean }[]>([]);
  const [balloonIndex, setBalloonIndex] = useState<number>(0); // which index we need to pop next

  // Dynamic extraction of words from the story text!
  const extractedWords = useMemo(() => {
    if (!storyText) return [];
    
    // Clean story text and extract unique words of length 3 to 7
    const words = storyText
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()""“’”]/g, "")
      .toUpperCase()
      .split(/\s+/)
      .filter((w) => w.length >= 3 && w.length <= 8);

    // Deduplicate
    const uniqueWords = Array.from(new Set(words));

    // Map to game word structure, checking for existing emoji/hint mappings, or generate simple defaults
    return uniqueWords.map((word) => {
      const existing = PRESET_WORDS.find((pw) => pw.word === word);
      if (existing) return existing;

      // Cute standard defaults based on word content
      let emoji = "📝";
      let hint = `Can you spell this fun word from today's story?`;
      if (word.includes("GEAR")) { emoji = "⚙️"; hint = "A round wheel that turns and drives motors!"; }
      else if (word.includes("WOOD") || word.includes("TREE")) { emoji = "🌲"; hint = "A green wood filled with fresh clean air"; }
      else if (word.includes("BLUE")) { emoji = "🔵"; hint = "The color of the high clear sky"; }
      else if (word.includes("GREEN")) { emoji = "🟢"; hint = "The color of growing grass and spring leaves"; }
      else if (word.includes("RED")) { emoji = "🔴"; hint = "The color of a fresh ripe strawberry"; }
      else if (word.includes("GOLD") || word.includes("YELLOW")) { emoji = "🟡"; hint = "Bright color of the golden summer sunshine"; }
      else if (word.includes("CLEVER")) { emoji = "🧠"; hint = "Smart, quick-thinking, and solving puzzles!"; }
      else if (word.includes("WIND") || word.includes("WHISPER")) { emoji = "💨"; hint = "A gentle breeze blowing through the woods"; }
      else if (word.includes("ROCKET")) { emoji = "🚀"; hint = "Fly high into the galaxy!"; }
      else if (word.includes("RAINBOW")) { emoji = "🌈"; hint = "Seven beautiful bands of color in the sky"; }
      else if (word.includes("MONKEY")) { emoji = "🐒"; hint = "A playful climbing animal that loves bananas"; }
      else if (word.includes("MANGO")) { emoji = "🥭"; hint = "A delicious sweet golden tropical fruit"; }
      else if (word.includes("OCEAN") || word.includes("SEA")) { emoji = "🐠"; hint = "A deep blue water playground with sea stars"; }
      else if (word.includes("STAR")) { emoji = "⭐"; hint = "A bright diamond in the night sky"; }

      return { word, emoji, hint };
    });
  }, [storyText]);

  // Combined pool of words
  const availableWords = useMemo(() => {
    const combined = [...extractedWords, ...PRESET_WORDS];
    // Deduplicate by word value
    const uniqueMap = new Map<string, GameWord>();
    combined.forEach((w) => uniqueMap.set(w.word, w));
    return Array.from(uniqueMap.values());
  }, [extractedWords]);

  // Set up a new round
  const startNewRound = () => {
    if (availableWords.length === 0) return;
    
    // Pick a random word
    const randomWordObj = availableWords[Math.floor(Math.random() * availableWords.length)];
    setCurrentWordObj(randomWordObj);
    setUserSpelling([]);
    setGameStatus("playing");
    setShowHint(false);

    const targetWord = randomWordObj.word;

    // Scramble logic
    const letters = targetWord.split("").map((char, index) => ({
      id: index,
      char,
      used: false
    }));

    // Perform non-trivial shuffle
    let shuffled = [...letters].sort(() => Math.random() - 0.5);
    while (shuffled.map(s => s.char).join("") === targetWord && targetWord.length > 1) {
      shuffled = [...letters].sort(() => Math.random() - 0.5);
    }
    setScrambledLetters(shuffled);

    // Balloon pop letters logic
    // We add some extra random distraction letters to make it a bit of a hunt!
    const extraChars = "AEIOURSTN";
    const distractionCount = Math.max(2, 8 - targetWord.length);
    const distractions: string[] = [];
    for (let i = 0; i < distractionCount; i++) {
      distractions.push(extraChars[Math.floor(Math.random() * extraChars.length)]);
    }

    const balloonPool = [
      ...targetWord.split("").map((char, idx) => ({ char, isTarget: true, targetIdx: idx })),
      ...distractions.map((char) => ({ char, isTarget: false, targetIdx: -1 }))
    ];

    // Shuffle balloon list
    const shuffledBalloons = balloonPool
      .sort(() => Math.random() - 0.5)
      .map((item, idx) => {
        const colors = [
          "bg-rose-400 border-rose-500 shadow-rose-200 text-white",
          "bg-sky-400 border-sky-500 shadow-sky-200 text-white",
          "bg-emerald-400 border-emerald-500 shadow-emerald-200 text-white",
          "bg-amber-400 border-amber-500 shadow-amber-200 text-white",
          "bg-fuchsia-400 border-fuchsia-500 shadow-fuchsia-200 text-white",
          "bg-violet-400 border-violet-500 shadow-violet-200 text-white"
        ];
        return {
          id: idx,
          char: item.char,
          color: colors[idx % colors.length],
          popped: false
        };
      });

    setBalloonLetters(shuffledBalloons);
    setBalloonIndex(0);
    
    // Auto speak the target word so the child knows what to look for!
    speakWord(randomWordObj.word);
  };

  // Run initial round setup
  useEffect(() => {
    startNewRound();
  }, [availableWords]);

  // Speech helper
  const speakWord = (txt: string) => {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(txt.toLowerCase());
      u.pitch = 1.45; // Pip style voice
      u.rate = 0.95;
      u.volume = isMuted ? 0 : 1.0;
      window.speechSynthesis.speak(u);
    } catch (e) {
      console.error(e);
    }
  };

  // Speak letter sound
  const speakLetter = (letter: string) => {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(letter.toLowerCase());
      u.pitch = 1.6;
      u.rate = 1.1;
      u.volume = isMuted ? 0 : 1.0;
      window.speechSynthesis.speak(u);
    } catch (e) {
      console.error(e);
    }
  };

  // Handle letter click in SCRAMBLE mode
  const handleLetterClick = (letterObj: { id: number; char: string; used: boolean }) => {
    if (gameStatus !== "playing" || isCompleting) return;
    if (letterObj.used) return;

    speakLetter(letterObj.char);

    // Mark as used
    setScrambledLetters((prev) =>
      prev.map((item) => (item.id === letterObj.id ? { ...item, used: true } : item))
    );

    const nextSpelling = [...userSpelling, letterObj.char];
    setUserSpelling(nextSpelling);

    // Verify spelling
    const target = currentWordObj.word;
    const isCompleted = nextSpelling.length === target.length;

    if (isCompleted) {
      const formedWord = nextSpelling.join("");
      if (formedWord === target) {
        handleSuccess();
      } else {
        handleFailure();
      }
    }
  };

  // Undo last spelled letter in SCRAMBLE mode
  const handleUndo = () => {
    if (gameStatus !== "playing" || userSpelling.length === 0) return;
    
    // Find the last added character
    const lastChar = userSpelling[userSpelling.length - 1];
    
    // Remove it from the spelling list
    setUserSpelling((prev) => prev.slice(0, -1));

    // Mark the letter tile in scrambled letters as unused again
    // We match the character and make sure to restore the first "used" match
    setScrambledLetters((prev) => {
      let restored = false;
      return prev.map((item) => {
        if (!restored && item.char === lastChar && item.used) {
          restored = true;
          return { ...item, used: false };
        }
        return item;
      });
    });
  };

  // Handle Balloon click in BALLOON POP mode
  const handleBalloonClick = (balloon: { id: number; char: string; popped: boolean; color: string }) => {
    if (gameStatus !== "playing" || isCompleting) return;
    if (balloon.popped) return;

    // Pop the balloon!
    setBalloonLetters((prev) =>
      prev.map((b) => (b.id === balloon.id ? { ...b, popped: true } : b))
    );

    // Verify if it is the correct next character in our word
    const targetWord = currentWordObj.word;
    const expectedChar = targetWord[balloonIndex];

    if (balloon.char === expectedChar) {
      // Good job! Place the letter
      const nextSpelling = [...userSpelling, balloon.char];
      setUserSpelling(nextSpelling);
      
      speakLetter(balloon.char);
      playSparkle(isMuted);

      const nextIdx = balloonIndex + 1;
      setBalloonIndex(nextIdx);

      // Did we spell the entire word?
      if (nextIdx === targetWord.length) {
        handleSuccess();
      }
    } else {
      // Incorrect balloon popped!
      playFailure(isMuted);
      setGameStatus("wrong");
      
      // Temporary warning, reset balloon status shortly after so kid can keep hunting!
      setTimeout(() => {
        setGameStatus("playing");
        // Restore the popped incorrect balloon so they can try again
        setBalloonLetters((prev) =>
          prev.map((b) => (b.id === balloon.id ? { ...b, popped: false } : b))
        );
      }, 1000);
    }
  };

  // Success Handler
  const handleSuccess = () => {
    setIsCompleting(true);
    playSuccess(isMuted);

    // Confetti pop!
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.7 }
    });

    // Special badge unlock if streak reaches 3
    if (streakCount + 1 >= 3 && onUnlockAchievement) {
      onUnlockAchievement("starlight_genius");
    }

    // Delay the success screen layout change so last letter/balloon zoom animation finishes beautifully
    setTimeout(() => {
      setGameStatus("success");
      setScore((prev) => prev + 10);
      setStreakCount((prev) => prev + 1);
      setIsCompleting(false);
    }, 600);
  };

  // Failure Handler
  const handleFailure = () => {
    setGameStatus("wrong");
    setStreakCount(0);
    playFailure(isMuted);

    // Auto-reset current round after 1.5s so they can try again easily
    setTimeout(() => {
      setUserSpelling([]);
      setScrambledLetters((prev) => prev.map((item) => ({ ...item, used: false })));
      setGameStatus("playing");
    }, 1500);
  };

  return (
    <div className="bg-gradient-to-r from-amber-50/90 to-amber-100/90 border-3 border-amber-300 rounded-3xl p-4 shadow-sm w-full select-none">
      
      {/* Word Game Headers */}
      <div className="flex items-center justify-between mb-3 border-b-2 border-amber-200/50 pb-2">
        <div className="flex items-center gap-2">
          <Gamepad2 className="text-amber-500 fill-amber-100 animate-bounce" size={20} />
          <h4 className="text-sm font-black text-amber-950 uppercase tracking-tight">
            Pip's Word Arcade 🎮
          </h4>
        </div>
        
        {/* Game Mode Selector */}
        <div className="flex bg-amber-200/40 rounded-xl p-0.5 border border-amber-300">
          <button
            onClick={() => {
              setActiveGame("spelling");
              playSparkle(isMuted);
              startNewRound();
            }}
            className={`px-2 py-1 text-[9px] font-black rounded-lg transition-all ${
              activeGame === "spelling"
                ? "bg-amber-400 text-amber-950 shadow-sm"
                : "text-amber-800/80 hover:bg-amber-300/30"
            }`}
          >
            Spell quest
          </button>
          <button
            onClick={() => {
              setActiveGame("balloon");
              playSparkle(isMuted);
              startNewRound();
            }}
            className={`px-2 py-1 text-[9px] font-black rounded-lg transition-all ${
              activeGame === "balloon"
                ? "bg-amber-400 text-amber-950 shadow-sm"
                : "text-amber-800/80 hover:bg-amber-300/30"
            }`}
          >
            Balloon pop
          </button>
        </div>
      </div>

      {/* Arcade Stats Tracker */}
      <div className="flex items-center justify-between mb-4 px-3 py-1.5 bg-amber-50/80 rounded-xl border border-amber-200">
        <div className="flex items-center gap-1">
          <Trophy size={14} className="text-yellow-500 fill-yellow-200" />
          <span className="text-[10px] font-black text-amber-950">
            ARCADE POINTS: <span className="text-amber-600 text-xs font-black">{score}</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Zap size={14} className={`text-orange-500 ${streakCount > 0 ? "animate-pulse" : ""}`} />
          <span className="text-[10px] font-black text-amber-950">
            STREAK: <span className="text-orange-600 text-xs font-black">{streakCount}</span>
          </span>
        </div>
      </div>

      {/* Main Game Stage */}
      <div className="bg-white border-2 border-amber-200/60 rounded-2xl p-4 shadow-inner relative overflow-hidden min-h-[220px] flex flex-col justify-between">
        
        {/* Decorative Floating Background Circles */}
        <div className="absolute top-2 left-2 w-12 h-12 bg-sky-100 rounded-full blur-xl opacity-40 pointer-events-none" />
        <div className="absolute bottom-4 right-4 w-16 h-16 bg-pink-100 rounded-full blur-xl opacity-40 pointer-events-none" />

        {/* Current Target Word Emoji & Voice Trigger */}
        <div className="flex items-center justify-between gap-2 z-10">
          <div className="flex items-center gap-2">
            <span className="text-3xl animate-bounce leading-none select-none">
              {currentWordObj.emoji}
            </span>
            <div>
              <p className="text-[10px] font-black text-amber-900/60 uppercase tracking-widest leading-none">
                {activeGame === "spelling" ? "Spell the Word" : "Pop Letters in Order"}
              </p>
              <h3 className="text-sm font-black text-amber-950">
                {currentWordObj.hint}
              </h3>
            </div>
          </div>
          
          <button
            onClick={() => speakWord(currentWordObj.word)}
            className="p-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl border border-amber-300/40 shadow-sm transition-all active:scale-90"
            title="Hear Pip speak this word!"
          >
            <Volume2 size={16} />
          </button>
        </div>

        {/* Spelling Slots Container */}
        <div className="my-4 flex items-center justify-center gap-1.5 flex-wrap z-10">
          {currentWordObj.word.split("").map((letter, index) => {
            const spelledLetter = userSpelling[index];
            const isFilled = !!spelledLetter;
            
            return (
              <motion.div
                key={index}
                animate={
                  gameStatus === "success"
                    ? { scale: [1, 1.18, 1], rotate: [0, 5, -5, 0] }
                    : gameStatus === "wrong"
                    ? { x: [-4, 4, -4, 4, 0] }
                    : isFilled && index === userSpelling.length - 1
                    ? { scale: [1, 1.3, 1] }
                    : {}
                }
                transition={
                  gameStatus === "success" || gameStatus === "wrong"
                    ? { delay: index * 0.05, duration: 0.35 }
                    : { type: "spring", stiffness: 500, damping: 15 }
                }
                className={`w-10 h-11 rounded-xl border-2 flex items-center justify-center font-black text-lg shadow-sm uppercase ${
                  gameStatus === "success"
                    ? "bg-emerald-400 border-emerald-500 text-white"
                    : isFilled
                    ? "bg-amber-50 border-amber-400 text-amber-950"
                    : "bg-amber-50/20 border-dashed border-amber-200 text-transparent"
                }`}
              >
                {spelledLetter || ""}
              </motion.div>
            );
          })}
        </div>

        {/* INTERACTION AREA FOR GAME 1: SPELLING SCRAMBLE */}
        {activeGame === "spelling" && gameStatus === "playing" && (
          <div className="z-10 flex flex-col gap-3">
            {/* Scrambled input buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <AnimatePresence>
                {scrambledLetters.map((letterObj) => (
                  <motion.button
                    key={letterObj.id}
                    layout
                    onClick={() => handleLetterClick(letterObj)}
                    disabled={letterObj.used}
                    className={`w-9 h-9 rounded-xl border-2 font-black text-base shadow flex items-center justify-center uppercase transition-all ${
                      letterObj.used
                        ? "bg-slate-100 border-slate-200 text-slate-300 opacity-30 cursor-not-allowed scale-90"
                        : "bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-950 hover:-translate-y-0.5"
                    }`}
                  >
                    {letterObj.char}
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>

            {/* Backspace / Delete last letter */}
            {userSpelling.length > 0 && (
              <div className="flex justify-center">
                <button
                  onClick={handleUndo}
                  className="px-3 py-1 text-[10px] font-black text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all active:scale-95"
                >
                  ↩️ Oops, take last letter back
                </button>
              </div>
            )}
          </div>
        )}

        {/* INTERACTION AREA FOR GAME 2: BALLOON POP */}
        {activeGame === "balloon" && gameStatus === "playing" && (
          <div className="z-10 grid grid-cols-4 gap-2.5 justify-items-center max-w-sm mx-auto">
            <AnimatePresence>
              {balloonLetters.map((balloon) => (
                <motion.button
                  key={balloon.id}
                  onClick={() => handleBalloonClick(balloon)}
                  disabled={balloon.popped}
                  animate={balloon.popped ? { scale: 0, opacity: 0 } : { y: [0, -3, 0, 3, 0] }}
                  transition={{
                    y: {
                      repeat: Infinity,
                      duration: 1.5 + (balloon.id % 3) * 0.4,
                      ease: "easeInOut"
                    }
                  }}
                  className={`w-10 h-12 rounded-t-full rounded-b-xl border-2 font-extrabold text-base flex flex-col items-center justify-center uppercase shadow-md relative ${
                    balloon.popped
                      ? "opacity-0 cursor-not-allowed pointer-events-none"
                      : balloon.color
                  }`}
                >
                  <span>{balloon.char}</span>
                  {/* Balloon knot string detail */}
                  <div className="absolute -bottom-1.5 w-0.5 h-1.5 bg-slate-400/60" />
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* SUCCESS STATE CELEBRATION OVERLAY */}
        {gameStatus === "success" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 bg-emerald-50/95 flex flex-col items-center justify-center text-center p-4 z-20"
          >
            <div className="text-4xl animate-bounce mb-1">🎉 🏆 🎉</div>
            <h3 className="text-base font-black text-emerald-950">
              Pip says: MAGNIFICENT! ⭐
            </h3>
            <p className="text-[11px] font-bold text-emerald-800 leading-tight mb-3">
              You correctly spelled <strong>{currentWordObj.word}</strong>! Keep up the brilliant reading adventure!
            </p>
            <button
              onClick={() => {
                playSparkle(isMuted);
                startNewRound();
              }}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-xs rounded-xl shadow hover:from-emerald-600 hover:to-teal-600 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <span>Next word</span>
              <ArrowRight size={12} className="animate-bounce" />
            </button>
          </motion.div>
        )}

        {/* FAILURE ERROR OVERLAY */}
        {gameStatus === "wrong" && activeGame === "spelling" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-rose-50/95 flex flex-col items-center justify-center text-center p-4 z-20"
          >
            <div className="text-3xl animate-pulse mb-1">🤖💔</div>
            <h3 className="text-sm font-black text-rose-950">
              Oops! Let's try again!
            </h3>
            <p className="text-[10px] text-rose-700 font-bold max-w-[200px]">
              No worries, magic spelling takes practice. Pip is resetting the tiles for you...
            </p>
          </motion.div>
        )}

        {/* WRONG BALLOON POP WARNING */}
        {gameStatus === "wrong" && activeGame === "balloon" && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-rose-500 text-white px-4 py-2 rounded-2xl shadow-xl z-30 font-black text-xs text-center border-2 border-white animate-bounce">
            🎈 POPPED WRONG BALLOON! 🎈
            <p className="text-[9px] font-bold opacity-90 mt-0.5">Let's keep spelling {currentWordObj.word}!</p>
          </div>
        )}

      </div>

      {/* Mini Tips / Switch Word Helper */}
      <div className="mt-3 flex items-center justify-between text-[10px] font-black text-amber-900/70 gap-2 px-1">
        <span className="flex items-center gap-1">
          <Info size={11} className="text-amber-600" />
          <span>Tap speakers to hear letters phonetically!</span>
        </span>
        <button
          onClick={() => {
            playSparkle(isMuted);
            startNewRound();
          }}
          className="text-amber-800 hover:text-amber-950 hover:scale-105 active:scale-95 flex items-center gap-1 cursor-pointer transition-transform bg-amber-200/40 border border-amber-300/60 px-2 py-0.5 rounded-lg"
        >
          <RotateCcw size={10} />
          <span>Skip word</span>
        </button>
      </div>

    </div>
  );
}
