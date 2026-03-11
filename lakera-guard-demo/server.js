import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

async function checkLakera(prompt) {
  // Replace URL/body fields with the exact Lakera API format from your account docs/dashboard.
  // The assignment only needs a simple injection check.
  const response = await fetch("https://api.lakera.ai/v2/guard/results", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LAKERA_API_KEY}`,
    },
    body: JSON.stringify({
      message: prompt,
      detectors: ["prompt_injection"],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Lakera API error: ${response.status} ${text}`);
  }

  return response.json();
}

function interpretLakeraResult(result) {
  // Adapt this based on Lakera's exact response schema.
  // The goal is to normalize to a simple decision for your UI.
  const flagged =
    result?.flagged === true ||
    result?.results?.some((r) => r?.detector === "prompt_injection" && r?.flagged);

  return {
    flagged,
    raw: result,
  };
}

app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = req.body?.message?.trim();

    if (!userMessage) {
      return res.status(400).json({ error: "Message is required." });
    }

    // 1) Check prompt with Lakera Guard
    const lakeraRaw = await checkLakera(userMessage);
    const lakera = interpretLakeraResult(lakeraRaw);

    // 2) Block if suspicious
    if (lakera.flagged) {
      return res.json({
        blocked: true,
        lakera,
        assistant: "Your message was blocked because it appears to contain a prompt injection attempt.",
      });
    }

    // 3) Send safe prompt to OpenAI
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "You are a helpful assistant. Explain security concepts clearly and briefly.",
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    return res.json({
      blocked: false,
      lakera,
      assistant: response.output_text,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: error.message || "Internal server error",
    });
  }
});

app.listen(port, () => {
  console.log(`Demo running at http://localhost:${port}`);
});