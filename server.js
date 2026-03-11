import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function checkLakera(prompt) {
  const response = await fetch("https://api.lakera.ai/v2/guard", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LAKERA_API_KEY}`,
    },
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      project_id: process.env.LAKERA_PROJECT_ID,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Lakera API error: ${response.status} ${text}`);
  }

  return response.json();
}

app.post("/api/chat", async (req, res) => {
  try {
    const prompt = req.body?.message?.trim();

    if (!prompt) {
      return res.status(400).json({
        blocked: false,
        assistant: "Prompt required.",
        lakera: null,
      });
    }

    const lakeraResult = await checkLakera(prompt);
    const flagged = lakeraResult?.flagged === true;

    if (flagged) {
      return res.json({
        blocked: true,
        assistant:
          "Your message was blocked because Lakera Guard detected a possible prompt injection attempt.",
        lakera: lakeraResult,
      });
    }

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: "You are a helpful assistant. Keep answers brief and clear.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return res.json({
      blocked: false,
      assistant: response.output_text || "No model response returned.",
      lakera: lakeraResult,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      blocked: false,
      assistant: `Server error: ${err.message}`,
      lakera: null,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});