const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // Add this for API calls
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let uniqueUsers = new Set();

app.post('/api/track-user', (req, res) => {
  const { userId } = req.body;
  if (userId) {
    uniqueUsers.add(userId);
    console.log('Tracked user:', userId);
    res.status(200).json({ success: true });
  } else {
    res.status(400).json({ error: 'Missing userId' });
  }
});

app.get('/api/unique-users', (req, res) => {
  res.json({ count: uniqueUsers.size });
});

app.post('/api/generate', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }
  try {
    const response = await fetch('https://api.deepai.org/api/text2img', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.DEEPAI_API_KEY // Set in Render dashboard
      },
      body: JSON.stringify({ text: prompt })
    });
    if (!response.ok) {
      throw new Error(`DeepAI API error: ${response.statusText}`);
    }
    const data = await response.json();
    res.json({ url: data.output_url });
  } catch (e) {
    console.error('Image generation error:', e.message);
    res.status(500).json({ error: 'Image generation failed' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
