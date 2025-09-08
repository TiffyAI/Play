import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("✅ TiffyAI World Engine is running");
});

// Generate Image Endpoint (used by your message handler)
app.post("/api/generate", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "API key missing in server env" });

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }]
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Google API error: ${err}`);
    }

    const result = await response.json();

    // Try to find inlineData (base64 image)
    const base64Data =
      result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;

    if (!base64Data) {
      console.error("⚠️ No image returned:", JSON.stringify(result, null, 2));
      return res.status(500).json({ error: "No image returned from Google API", raw: result });
    }

    const imgBuffer = Buffer.from(base64Data, "base64");

    res.set("Content-Type", "image/png");
    res.send(imgBuffer);
  } catch (err) {
    console.error("❌ /api/generate error", err);
    res.status(500).json({ error: err.message || "Image generation failed" });
  }
});

// 🔹 Temporary debug test route
app.get("/test", async (req, res) => {
  try {
    const prompt = "A glowing neon dragon in glass armor, cyberpunk city at night";
    const apiKey = process.env.GOOGLE_API_KEY;

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }]
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    res.json(result); // 👈 Dump raw JSON so you can inspect
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
