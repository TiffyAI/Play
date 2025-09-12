import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

// Serve your index.html directly from root
import { readFileSync } from "fs";
app.get("/", (req, res) => {
  res.type("html").send(readFileSync("./index.html", "utf8"));
});

// POST route for text + image
app.post("/api/generate-both", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  try {
    // 1. Generate text
    const chatResp = await fetch("https://api.edenai.run/v2/text/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.EDEN_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        providers: "openai",
        text: prompt,
        chatbot_global_action: "You are TiffyAI, a cosmic character that describes and narrates scenes.",
        temperature: 0.8,
        max_tokens: 200
      })
    });
    const chatData = await chatResp.json();
    const text = chatData.openai?.generated_text || "[No text response]";

    // 2. Generate image
    const imgResp = await fetch("https://api.edenai.run/v2/image/generation", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.EDEN_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        providers: "openai",
        text: prompt + " futuristic neon cosmic scene with a character",
        resolution: "512x512"
      })
    });
    const imgData = await imgResp.json();

    const imageUrl = imgData.openai?.items?.[0]?.image_resource_url || null;
    const imageBase64 = imgData.openai?.items?.[0]?.image_base64
      ? "data:image/png;base64," + imgData.openai.items[0].image_base64
      : null;

    res.json({ text, imageUrl, imageBase64 });
  } catch (err) {
    console.error("Upstream error", err);
    res.status(500).json({ error: "Generation failed", details: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
