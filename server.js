const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const fs = require("fs");

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

const certificateSchema = new mongoose.Schema(
  {
    icon: { type: String, required: true },
    name: { type: String, required: true },
    issuer: { type: String, required: true },
    date: { type: String, required: true },
    description: { type: String, required: true },
    skills: { type: String },
    src: { type: String, required: true },
  },
  { timestamps: true },
);

const Certificate = mongoose.model("Certificate", certificateSchema);

const defaultCertsData = [
  {
    icon: "&#127881;",
    name: "45 Days of Code 2024",
    issuer: "Amity Coding Club &mdash; Amity University",
    date: "2024 &bull; Amity University, Gwalior",
    description:
      "Successfully completed the 45 Days of Code 2024 challenge organized by the Amity Coding Club, demonstrating consistent dedication, discipline, and a passion for learning and innovation in programming over 45 continuous days.",
    skills:
      "Problem Solving,Consistent Coding,Programming Logic,Algorithms,Dedication,Innovation",
    src: "/Images/45-days-of-code-certificate.png",
  },
  {
    icon: "&#127919;",
    name: "Google AI Study Jam",
    issuer: "Google Developer Groups on Campus &mdash; Amity University",
    date: "2025 &bull; Study Jam",
    description:
      "Completed Google AI Study Jam, focused on practical AI learning, hands-on exploration, and modern developer workflows.",
    skills: "Generative AI,Prompting,AI Tools,Hands-on Learning",
    src: "/Images/agentic.png",
  },
  {
    icon: "&#128293;",
    name: "Build with AI Certificate of Participation",
    issuer: "Google Developer Groups on Campus &mdash; MITS DU",
    date: "February 10, 2025 &bull; MITS, Gwalior",
    description:
      "Certificate of participation awarded for taking part in the Build with AI event conducted by Google Developer Groups on Campus at MITS DU.",
    skills:
      "AI Fundamentals,Prompt Engineering,Developer Tools,Innovation,Community Participation",
    src: "/Images/build-with-ai-certificate.png",
  },
  {
    icon: "&#127891;",
    name: "Internal SIH 2025",
    issuer: "Hack2Skill",
    date: "2025 &bull; Internal SIH",
    description:
      "Recognized participation in Internal SIH 2025 with active contribution in problem solving and project development.",
    skills: "Teamwork,Ideation,Problem Solving,Presentation",
    src: "/Images/internal-sih-2025-certificate.png",
  },
  {
    icon: "&#127942;",
    name: "Solution Challenge",
    issuer: "Google Developer Groups on Campus &mdash; Hack2Skill",
    date: "2025 &bull; Solution Challenge",
    description:
      "Participated in Solution Challenge by proposing and building technology solutions for real-world impact.",
    skills: "Innovation,Problem Solving,Project Building,Presentation",
    src: "/Images/solution-challenge-certificate.png",
  },
];

async function ensureDbConnection() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (dbConnectPromise) {
    await dbConnectPromise;
    return;
  }

  dbConnectPromise = mongoose
    .connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 })
    .then(async () => {
      console.log("MongoDB connected");
      await seedCertificates();
    })
    .catch((err) => {
      console.warn("MongoDB connection failed, running in fallback mode:", err.message);
    })
    .finally(() => {
      dbConnectPromise = null;
    });

  await dbConnectPromise;
}

async function seedCertificates() {
  try {
    const certCount = await Certificate.countDocuments();
    if (certCount === 0) {
      await Certificate.insertMany(defaultCertsData);
      console.log("Certificates seeded to MongoDB.");
    }
  } catch (err) {
    console.error("Error seeding certificates:", err);
  }
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

app.get("/api/certificates", async (req, res) => {
  try {
    await ensureDbConnection();
    if (mongoose.connection.readyState === 1) {
      const certificates = await Certificate.find().lean();
      if (certificates && certificates.length > 0) {
        return res.json({ ok: true, count: certificates.length, items: certificates });
      }
    }
    // Fallback to defaults
    res.json({ ok: true, count: defaultCertsData.length, items: defaultCertsData, fallback: true });
  } catch (error) {
    res.json({ ok: true, count: defaultCertsData.length, items: defaultCertsData, fallback: true });
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

app.get("*", (req, res) => {
  // Do not return index.html for file-like paths (e.g. /Images/foo.png).
  // This prevents browsers from receiving HTML with a 200 for missing assets.
  if (path.extname(req.path)) {
    return res.status(404).end();
  }

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
