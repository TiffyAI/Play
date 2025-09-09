import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();
app.use(express.json());

// 📂 Public folder for generated images
const __dirname = path.resolve();
const imagesDir = path.join(__dirname, "public", "images");
fs.mkdirSync(imagesDir, { recursive: true });
app.use("/images", express.static(imagesDir));

// ✅ Health check
app.get("/", (req, res) => {
  res.send("✅ TiffyAI Image Engine is running");
});

// 🖼️ Generate Image Endpoint
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

    // 📂 Save image to /public/images
    const filename = prompt.replace(/\s+/g, "_").toLowerCase() + "_" + Date.now() + ".png";
    const filepath = path.join(imagesDir, filename);
    fs.writeFileSync(filepath, Buffer.from(base64Data, "base64"));

    // Send back relative URL
    res.json({ url: "/images/" + filename });
  } catch (err) {
    console.error("❌ /api/generate error", err);
    res.status(500).json({ error: err.message || "Image generation failed" });
  }
});

// 📸 Simple Gallery Page
app.get("/gallery", (req, res) => {
  fs.readdir(imagesDir, (err, files) => {
    if (err) return res.status(500).send("Could not list images");

    const list = files
      .filter(f => f.endsWith(".png"))
      .map(f => `<div style="margin:10px;"><img src="/images/${f}" style="max-width:300px; display:block;"><p>${f}</p></div>`)
      .join("");

    res.send(`
      <html>
        <head><title>TiffyAI Gallery</title></head>
        <body style="background:#111; color:#fff; font-family:sans-serif;">
          <h1>TiffyAI Generated Images</h1>
          <div style="display:flex; flex-wrap:wrap;">${list}</div>
        </body>
      </html>
    `);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
