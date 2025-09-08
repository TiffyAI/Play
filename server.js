import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("✅ TiffyAI Image Engine is running");
});

// Generate Image Endpoint
app.post("/api/generate", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "API key missing in server env" });

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"] }
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    // 🔍 Grab the base64 image data
    const base64Data =
      result?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Data) {
      console.error("❌ Unexpected Google response", JSON.stringify(result, null, 2));
      return res.status(500).json({ error: "No image returned from Google API" });
    }

    const imgBuffer = Buffer.from(base64Data, "base64");

    res.set("Content-Type", "image/png");
    res.send(imgBuffer);
  } catch (err) {
    console.error("❌ /api/generate error", err);
    res.status(500).json({ error: err.message || "Image generation failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
