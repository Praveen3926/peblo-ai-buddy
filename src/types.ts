export interface QuizData {
  question: string;
  options: string[];
  answer: string;
}

export interface StoryData {
  storyText: string;
  quiz: QuizData;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
}

export interface DeviceStats {
  ramAllocated: string;
  fps: number;
  renderTimeMs: number;
}
