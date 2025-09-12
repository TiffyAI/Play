// server.js
'use strict';

import express from "express";
import fetch from "node-fetch";   // make sure this is in package.json
import bodyParser from "body-parser";

const app = express();
const port = process.env.PORT || 10000;

app.use(bodyParser.json());

// Health check
app.get("/", (req, res) => {
  res.send("🌍 World Engine API is live ✅");
});

// Image generation
app.post("/api/generate", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    // Call the Eden/AI (or OpenAI if that’s the key you pasted) endpoint
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.API_KEY}`, // env set in Render
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "512x512"
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    const imageUrl = data.data?.[0]?.url;
    if (!imageUrl) {
      return res.status(500).json({ error: "No image returned" });
    }

    res.json({ url: imageUrl });
  } catch (err) {
    console.error("Image error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
