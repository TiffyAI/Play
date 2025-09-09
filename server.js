import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();
app.use(express.json());

// Serve saved images as static files
app.use("/images", express.static(path.join(process.cwd(), "images")));

// Ensure images/ exists
const imagesDir = path.join(process.cwd(), "images");
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir);

// Generate Image Endpoint
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
    const base64Data =
      result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;

    if (!base64Data) {
      return res.status(500).json({ error: "No image returned from Google API" });
    }

    // Save image to disk
    const imgBuffer = Buffer.from(base64Data, "base64");
    const filename = `img_${Date.now()}.png`;
    const filepath = path.join(imagesDir, filename);
    fs.writeFileSync(filepath, imgBuffer);

    // Return the public URL
    const imageUrl = `/images/${filename}`;
    res.json({ url: imageUrl });

  } catch (err) {
    console.error("❌ /api/generate error", err);
    res.status(500).json({ error: err.message || "Image generation failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
