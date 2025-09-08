/***********************
 * Send message handler
 ***********************/
async function sendMessage() {
  const box = document.getElementById('messageBox');
  const msg = (box.value || "").trim();
  if (!msg) return;
  box.value = "";

  history.push({ role: userName || "user", text: msg });
  saveMemory();

  let found = false;
  const msgLow = msg.toLowerCase();

  // 🔹 Background keyword logic (keep as is)
  for (const key in backgrounds) {
    if (msgLow.includes(key)) {
      const arr = backgrounds[key].responses || [backgrounds[key].response];
      const reply = arr[Math.floor(Math.random() * arr.length)];
      swapBackground(backgrounds[key].url);
      speak(reply);
      history.push({ role: "tiffy", text: reply });
      saveMemory();
      saveClaim(reply);

      setContext({
        lastTopic: key,
        lastLinkHint: backgrounds[key].link || "",
        lastAction: "background",
        lastCommand: key
      });

      setTimeout(() => {
        try { window.open(backgrounds[key].link, "_blank"); } catch (e) {}
      }, 4000);
      found = true;
      break;
    }
  }
  if (found) return;

  // 🔹 Normal reply logic (keep as is)
  const reply = smartReply(msg);
  speak(reply);
  history.push({ role: "tiffy", text: reply });
  saveMemory();
  saveClaim(reply);

  // 🔹 EXTRA STEP: Generate Image for every message
  try {
    const resp = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: msg })
    });

    if (resp.ok) {
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);

      // Swap background live
      swapBackground(url);

      // Optional: Auto-open in new tab
      // window.open(url, "_blank");
    } else {
      console.error("Image generation failed", await resp.text());
    }
  } catch (e) {
    console.error("❌ Error generating image", e);
  }
}
