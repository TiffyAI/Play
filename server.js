import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// 🔑 Hugging Face key
const HF_API_KEY = process.env.HF_API_KEY;

// Routes
app.post("/api/generate-both", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  try {
    // --- TEXT GENERATION ---
    const textResp = await fetch(
      "https://api-inference.huggingface.co/models/gpt2",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: prompt }),
      }
    );

    const textData = await textResp.json();
    const text =
      Array.isArray(textData) && textData[0]?.generated_text
        ? textData[0].generated_text
        : JSON.stringify(textData);

    // --- IMAGE GENERATION ---
    const imgResp = await fetch(
      "https://api-inference.huggingface.co/models/CompVis/stable-diffusion-v1-4",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: prompt }),
      }
    );

    const imgBuffer = await imgResp.arrayBuffer();
    const imgBase64 = `data:image/png;base64,${Buffer.from(
      imgBuffer
    ).toString("base64")}`;

    res.json({ text, imageBase64: imgBase64 });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Failed to generate", details: err.message });
  }
});

// Serve frontend (index.html in same folder)
app.use(express.static("."));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Server running on port " + PORT));
