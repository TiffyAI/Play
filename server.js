import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 8080;
const EDEN_API_KEY = process.env.EDEN_API_KEY;

if (!EDEN_API_KEY) {
  console.error("❌ Missing EDEN_API_KEY in environment");
  process.exit(1);
}

// Proxy endpoint for text & image generation
app.post("/api/generate", async (req, res) => {
  try {
    const { type, prompt } = req.body;

    if (!type || !prompt) {
      return res.status(400).json({ error: "Missing type or prompt" });
    }

    let url = "";
    let body = {};

    if (type === "text") {
      url = "https://api.edenai.run/v2/text/generation";
      body = {
        providers: ["openai"], // you can switch to cohere, anthropic, etc.
        text: prompt,
        temperature: 0.7,
        max_tokens: 150
      };
    } else if (type === "image") {
      url = "https://api.edenai.run/v2/image/generation";
      body = {
        providers: ["openai"], // or "stabilityai" if you prefer
        text: prompt,
        resolution: "512x512"
      };
    } else {
      return res.status(400).json({ error: "Invalid type" });
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${EDEN_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error("⚠️ Error:", err);
    res.status(500).json({ error: "Failed to generate" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 TiffyAI World Engine listening on :${PORT}`);
});
