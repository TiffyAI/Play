const express = require("express");
const fetch = require("node-fetch");
const app = express();

// Enable CORS for mobile clients
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get("/api/count", async (req, res) => {
  try {
    const workspaceKey = process.env.COUNTERAPI_KEY; // From Render environment
    const counterName = "user-visits";
    const response = await fetch(`https://api.counterapi.dev/v1/${workspaceKey}/${counterName}/up`);
    const result = await response.json();
    res.json({ count: result.count });
  } catch (error) {
    res.status(500).json({ error: "Failed to increment counter" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
