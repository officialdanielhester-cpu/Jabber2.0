const express = require("express");
const path = require("path");

const app = express();

// Serve static files from "public" (adjust folder name if different)
app.use(express.static(path.join(__dirname, "public")));

// Example route (optional)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Use Render's assigned port or default to 10000 locally
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});