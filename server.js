// server.js
'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { nanoid } = require('nanoid');
const path = require('path');

const app = express();
app.use(morgan('tiny'));
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 10000;
const EDEN_API_KEY = (process.env.EDEN_API_KEY || '').trim();

if (!EDEN_API_KEY) {
  console.error('❌ Missing EDEN_API_KEY environment variable (set in Render). Exiting.');
  process.exit(1);
}

// Defaults (override in Render env if you want)
const TEXT_MODEL = process.env.TEXT_MODEL || 'openai/gpt-4o';
const IMAGE_PROVIDER = process.env.IMAGE_PROVIDER || 'stabilityai';
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'stable-diffusion-v1-6';
const EDEN_BASE = 'https://api.edenai.run';

// small helpers
function findLongestText(obj) {
  let best = '';
  function walk(x) {
    if (!x) return;
    if (typeof x === 'string') { if (x.length > best.length) best = x; return; }
    if (Array.isArray(x)) { for (const v of x) walk(v); return; }
    if (typeof x === 'object') { for (const k of Object.keys(x)) walk(x[k]); }
  }
  walk(obj);
  return best;
}

function findBase64Image(obj) {
  let found = null;
  function walk(x) {
    if (found) return;
    if (!x) return;
    if (typeof x === 'string') {
      const s = x.replace(/\s/g,'');
      if ((s.startsWith('/9j/') || s.startsWith('iVBOR') || s.length > 200) && /^[A-Za-z0-9+/=]+$/.test(s)) {
        found = s;
        return;
      }
      return;
    }
    if (Array.isArray(x)) { for (const v of x) walk(v); return; }
    if (typeof x === 'object') { for (const k of Object.keys(x)) walk(x[k]); }
  }
  walk(obj);
  return found;
}

function findFirstUrl(obj) {
  let u = null;
  function walk(x) {
    if (u) return;
    if (!x) return;
    if (typeof x === 'string' && /^https?:\/\//.test(x)) { u = x; return; }
    if (Array.isArray(x)) { for (const v of x) walk(v); return; }
    if (typeof x === 'object') { for (const k of Object.keys(x)) walk(x[k]); }
  }
  walk(obj);
  return u;
}

// Serve static files (index.html) if you put it alongside server.js or in 'public'
app.use(express.static(path.join(__dirname)));

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.post('/api/generate-both', async (req, res) => {
  const reqId = nanoid(8);
  res.setHeader('X-Request-Id', reqId);

  try {
    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Missing prompt', reqId });
    }

    console.log(`[${reqId}] generate-both prompt:`, prompt.slice(0, 300));

    // build eden endpoints
    const chatUrl = `${EDEN_BASE}/v2/llm/chat`;
    const imageUrl = `${EDEN_BASE}/v2/image/generation/`;

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${EDEN_API_KEY}`
    };

    // text payload (chat)
    const chatPayload = {
      model: TEXT_MODEL,
      messages: [
        { role: 'system', content: 'You are TiffyAI — a stylish, space-age poet and interactive NPC. Keep responses vivid and characterful.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 400,
      temperature: 0.9
    };

    // image payload (provider + model)
    const imagePayload = {
      text: prompt,
      provider: IMAGE_PROVIDER,
      model: IMAGE_MODEL,
      resolution: process.env.IMAGE_RESOLUTION || '512x512',
      number_of_images: Number(process.env.IMAGE_COUNT || '1')
    };

    // parallel requests to Eden (chat + image)
    const [chatResP, imageResP] = await Promise.allSettled([
      fetch(chatUrl, { method: 'POST', headers, body: JSON.stringify(chatPayload) }),
      fetch(imageUrl, { method: 'POST', headers, body: JSON.stringify(imagePayload) })
    ]);

    // handle chat
    let finalText = null;
    if (chatResP.status === 'fulfilled') {
      const chatRes = chatResP.value;
      if (!chatRes.ok) {
        const txt = await chatRes.text().catch(()=>'<no-body>');
        console.warn(`[${reqId}] eden chat non-ok ${chatRes.status}: ${txt.substring(0,400)}`);
      } else {
        const chatJson = await chatRes.json().catch(async () => {
          const t = await chatRes.text().catch(()=>'<no-text>');
          console.warn(`[${reqId}] eden chat returned non-json:`, t.substring(0,400));
          return null;
        });
        if (chatJson) {
          finalText = findLongestText(chatJson) || null;
        }
      }
    } else {
      console.warn(`[${reqId}] eden chat request failed:`, String(chatResP.reason).slice(0,300));
    }

    // handle image
    let finalImageBase64 = null;
    let finalImageUrl = null;
    if (imageResP.status === 'fulfilled') {
      const imageRes = imageResP.value;
      if (!imageRes.ok) {
        const txt = await imageRes.text().catch(()=>'<no-body>');
        console.warn(`[${reqId}] eden image non-ok ${imageRes.status}: ${txt.substring(0,400)}`);
      } else {
        const imageJson = await imageRes.json().catch(async () => {
          const t = await imageRes.text().catch(()=>'<no-text>');
          console.warn(`[${reqId}] eden image returned non-json:`, t.substring(0,600));
          return null;
        });
        if (imageJson) {
          finalImageBase64 = findBase64Image(imageJson);
          if (!finalImageBase64) {
            // if no base64, pick first http url in response
            finalImageUrl = findFirstUrl(imageJson);
          }
        }
      }
    } else {
      console.warn(`[${reqId}] eden image request failed:`, String(imageResP.reason).slice(0,300));
    }

    // Build response
    const out = {
      reqId,
      text: finalText,
      imageBase64: finalImageBase64 ? `data:image/png;base64,${finalImageBase64}` : null,
      imageUrl: finalImageUrl || null
    };

    // If nothing usable, include a helpful note
    if (!out.text && !out.imageBase64 && !out.imageUrl) {
      out.note = 'No usable text or image returned from provider. Check Render logs for upstream HTML/errors.';
    }

    console.log(`[${reqId}] respond: text=${!!out.text} imageBase64=${!!out.imageBase64} imageUrl=${!!out.imageUrl}`);
    return res.json(out);

  } catch (err) {
    console.error('[server] unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error', details: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 TiffyAI (Eden proxy) listening on :${PORT}`);
});
