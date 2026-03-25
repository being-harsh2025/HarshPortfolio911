const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hackverse";
let dbConnectPromise = null;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const messageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    message: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

const Message = mongoose.model("Message", messageSchema);

async function ensureDbConnection() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (dbConnectPromise) {
    await dbConnectPromise;
    return;
  }

  dbConnectPromise = mongoose
    .connect(MONGO_URI)
    .then(() => {
      console.log("MongoDB connected");
    })
    .finally(() => {
      dbConnectPromise = null;
    });

  await dbConnectPromise;
}

app.get("/api/health", (_req, res) => {
  const state = mongoose.connection.readyState;
  const labels = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  res.json({
    ok: state === 1,
    database: "mongodb",
    connectionState: labels[state] || "unknown",
  });
});

app.get("/api/messages", async (req, res) => {
  try {
    await ensureDbConnection();
    const limit = Math.min(Number(req.query.limit) || 5, 20);
    const items = await Message.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json({ ok: true, count: items.length, items });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Failed to read messages" });
  }
});

app.post("/api/messages", async (req, res) => {
  try {
    await ensureDbConnection();
    const { name, email, message } = req.body || {};
    if (!name || !email || !message) {
      return res
        .status(400)
        .json({ ok: false, error: "name, email and message are required" });
    }

    const created = await Message.create({ name, email, message });
    return res
      .status(201)
      .json({ ok: true, id: created._id, createdAt: created.createdAt });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "Failed to save message" });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

async function start() {
  try {
    await ensureDbConnection();
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = app;
