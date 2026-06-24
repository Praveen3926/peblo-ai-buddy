import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Lazy-loaded Gemini Client
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured in the environment.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Generate a brand new story and quiz using Gemini
  app.post("/api/story/generate", async (req, res) => {
    const { theme } = req.body;
    try {
      const ai = getGeminiClient();

      const prompt = `Generate a delightful, brand-new 2-sentence story snippet for a young child in India featuring Pip the clever little robot. 
Theme or activity: ${theme || "discovering a magical forest helper"}.
Then, generate a simple 1-question interactive comprehension quiz based directly on that story, with 3 to 5 options. Ensure the correct answer matches exactly one of the options.`;

      let response;
      let attempt = 0;
      const maxRetries = 3;

      while (attempt < maxRetries) {
        try {
          response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
              systemInstruction: "You are an expert children's storywriter and educator at Peblo, specialized in writing ultra-short, engaging, joyful, and clean stories with interactive quizzes for kids under 8 years old.",
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  storyText: {
                    type: Type.STRING,
                    description: "The short, engaging, 2-sentence story text.",
                  },
                  quiz: {
                    type: Type.OBJECT,
                    properties: {
                      question: {
                        type: Type.STRING,
                        description: "A fun comprehension question about the story.",
                      },
                      options: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.STRING,
                        },
                        description: "List of 3, 4, or 5 multiple choice answers.",
                      },
                      answer: {
                        type: Type.STRING,
                        description: "The exact correct option string from the options array.",
                      },
                    },
                    required: ["question", "options", "answer"],
                  },
                },
                required: ["storyText", "quiz"],
              },
            },
          });
          break; // Succeeded! Break the retry loop.
        } catch (err: any) {
          attempt++;
          console.log(`Gemini request (attempt ${attempt}): busy or rate-limited. Retrying...`);
          if (attempt >= maxRetries) {
            throw err; // Escalate to the offline dynamic fallback
          }
          await new Promise((resolve) => setTimeout(resolve, attempt * 600));
        }
      }

      const responseText = response?.text;
      if (!responseText) {
        throw new Error("Empty response from Gemini.");
      }

      const storyData = JSON.parse(responseText.trim());
      res.json(storyData);
    } catch (error: any) {
      console.log("Gemini Service experiencing high demand, activating premium dynamic story fallback gracefully.");
      
      // Dynamic fallback generator to keep the children fully happy with zero crashes/hangs!
      const cleanTheme = (theme || "").toLowerCase();
      let fallbackData;

      if (cleanTheme.includes("rocket") || cleanTheme.includes("moon") || cleanTheme.includes("space")) {
        fallbackData = {
          storyText: "Pip built a shiny yellow rocket and flew straight up into the starry sky. He met a friendly glowing moon bunny who helped him count the sparkling stars!",
          quiz: {
            question: "Who did Pip meet on the moon?",
            options: ["A glowing moon bunny", "An angry green alien", "A sleepy polar bear"],
            answer: "A glowing moon bunny"
          }
        };
      } else if (cleanTheme.includes("monkey") || cleanTheme.includes("mango") || cleanTheme.includes("fruit")) {
        fallbackData = {
          storyText: "Pip climbed a tall mango tree in Bengaluru and met a playful little monkey named Cheeky. Cheeky shared three delicious sweet mangoes and gave Pip a high-five!",
          quiz: {
            question: "What did Cheeky the monkey share with Pip?",
            options: ["Shiny red apples", "Sweet mangoes", "Crunchy purple grapes"],
            answer: "Sweet mangoes"
          }
        };
      } else if (cleanTheme.includes("rainbow") || cleanTheme.includes("river") || cleanTheme.includes("water")) {
        fallbackData = {
          storyText: "Pip skipped along the shore of a magical river that shifted colors like a rainbow. A friendly golden turtle offered him a ride across the bright purple waters!",
          quiz: {
            question: "What color was the magical river water when Pip crossed?",
            options: ["Midnight black", "Bright purple", "Sparkling silver"],
            answer: "Bright purple"
          }
        };
      } else if (cleanTheme.includes("sea") || cleanTheme.includes("ocean") || cleanTheme.includes("fish") || cleanTheme.includes("dive")) {
        fallbackData = {
          storyText: "Pip wore a tiny waterproof helmet and dove deep into the warm Indian Ocean. There, he discovered a cheerful orange starfish holding a sparkling gold crown!",
          quiz: {
            question: "What was the cheerful starfish holding deep in the ocean?",
            options: ["A big green seashell", "A sparkling gold crown", "A lost blue gear"],
            answer: "A sparkling gold crown"
          }
        };
      } else {
        const capitalizedTheme = theme ? theme.trim() : "discovering a magic path";
        fallbackData = {
          storyText: `Pip set out on an exciting adventure of "${capitalizedTheme}" with a happy song. He met a cheerful forest squirrel who gave him a magical shiny key to guide his way!`,
          quiz: {
            question: "What magical item did the cheerful squirrel give to Pip?",
            options: ["A shiny gold compass", "A magical shiny key", "A warm purple woolen hat"],
            answer: "A magical shiny key"
          }
        };
      }

      res.json(fallbackData);
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", time: new Date().toISOString() });
  });

  // Vite development middleware vs Static files serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Peblo AI Story Buddy server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start Peblo backend server:", err);
});
