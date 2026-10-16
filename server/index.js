
const { Server } = require("socket.io");
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const http = require("http");
const axios = require("axios");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const pool = require("./db");
const authRoutes = require("./auth");
const authenticateToken = require("./authMiddleware");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "DELETE"],
  },
});

const PORT = process.env.PORT || 5000;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

app.use("/api/auth", authRoutes);

// Check server status
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "CodePair server is running!",
  });
});

// Test PostgreSQL connection
app.get("/api/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS time");

    res.json({
      success: true,
      message: "PostgreSQL connected successfully!",
      time: result.rows[0].time,
    });
  } catch (error) {
    console.error("Database connection error:", error.message);

    res.status(500).json({
      success: false,
      message: "Database connection failed.",
    });
  }
});

// Run code using Judge0
app.post("/api/run", async (req, res) => {
  const { code, language, input = "" } = req.body || {};

  const languageIds = {
    cpp: 54,
    java: 62,
    python: 71,
    javascript: 63,
  };

  if (typeof code !== "string" || !code.trim()) {
    return res.status(400).json({
      success: false,
      message: "Please enter some code.",
    });
  }

  if (code.length > 20000) {
    return res.status(400).json({
      success: false,
      message: "Code is too long.",
    });
  }

  if (typeof input !== "string" || input.length > 10000) {
    return res.status(400).json({
      success: false,
      message: "Input is invalid or too long.",
    });
  }

  if (!Object.hasOwn(languageIds, language)) {
    return res.status(400).json({
      success: false,
      message: "Unsupported programming language.",
    });
  }

  try {
    const response = await axios.post(
      "https://ce.judge0.com/submissions?base64_encoded=false&wait=true",
      {
        source_code: code,
        language_id: languageIds[language],
        stdin: input,
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 15000,
      }
    );

    const result = response.data;

    res.json({
      success: true,
      output: result.stdout || "",
      error: result.stderr || result.compile_output || "",
      status: result.status?.description || "Unknown",
      time: result.time,
      memory: result.memory,
    });
  } catch (error) {
    console.error("Run code error:", error.message);

    res.status(502).json({
      success: false,
      message: "Code execution service failed. Please try again.",
    });
  }
});

// Create a room — login required
app.post("/api/rooms", authenticateToken, async (req, res) => {
  const name =
    typeof req.body?.name === "string"
      ? req.body.name.trim()
      : "";

  if (!name) {
    return res.status(400).json({
      success: false,
      message: "Room name is required.",
    });
  }

  if (name.length > 50) {
    return res.status(400).json({
      success: false,
      message: "Room name must be 50 characters or fewer.",
    });
  }

  try {
    let code;
    let exists;

    do {
      code = crypto.randomBytes(3).toString("hex").toUpperCase();

      const result = await pool.query(
        "SELECT id FROM rooms WHERE id = $1",
        [code]
      );

      exists = result.rows.length > 0;
    } while (exists);

    const result = await pool.query(
      `INSERT INTO rooms (id, name)
       VALUES ($1, $2)
       RETURNING id, name`,
      [code, name]
    );

    res.status(201).json({
      success: true,
      room: result.rows[0],
    });
  } catch (error) {
    console.error("Create room error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to create room.",
    });
  }
});

// Get all rooms — login required
app.get("/api/rooms", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name
       FROM rooms
       ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      rooms: result.rows,
    });
  } catch (error) {
    console.error("Get rooms error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch rooms.",
    });
  }
});

// Get one room — login required
app.get("/api/rooms/:code", authenticateToken, async (req, res) => {
  const code = req.params.code.trim().toUpperCase();

  try {
    const result = await pool.query(
      "SELECT id, name FROM rooms WHERE id = $1",
      [code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Room not found.",
      });
    }

    res.json({
      success: true,
      room: result.rows[0],
    });
  } catch (error) {
    console.error("Find room error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch room.",
    });
  }
});

// Delete a room — login required
app.delete("/api/rooms/:code", authenticateToken, async (req, res) => {
  const code = req.params.code.trim().toUpperCase();

  if (!/^[A-F0-9]{6}$/.test(code)) {
    return res.status(400).json({
      success: false,
      message: "Invalid room code.",
    });
  }

  try {
    const result = await pool.query(
      `DELETE FROM rooms
       WHERE id = $1
       RETURNING id, name`,
      [code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Room not found.",
      });
    }

    io.to(code).emit("room-deleted", { roomCode: code });
    io.in(code).socketsLeave(code);

    res.json({
      success: true,
      message: "Room deleted successfully.",
      room: result.rows[0],
    });
  } catch (error) {
    console.error("Delete room error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to delete room.",
    });
  }
});

// Socket.IO authentication — valid JWT required
io.use((socket, next) => {
  if (!process.env.JWT_SECRET) {
    return next(new Error("Authentication is not configured."));
  }

  const token = socket.handshake.auth?.token;

  if (typeof token !== "string" || !token) {
    return next(new Error("Authentication required. Please log in."));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.userId) {
      return next(new Error("Invalid authentication token."));
    }

    socket.user = decoded;
    next();
  } catch (error) {
    next(new Error("Invalid or expired token. Please log in again."));
  }
});

// Collaboration and saved editor state
io.on("connection", (socket) => {
  console.log("Authenticated user connected:", socket.user.userId);

  // Join a room and receive its saved editor state
  socket.on("join-room", async (roomCode) => {
    if (typeof roomCode !== "string") return;

    const room = roomCode.trim().toUpperCase();

    if (!/^[A-F0-9]{6}$/.test(room)) return;

    try {
      const result = await pool.query(
        "SELECT code, language FROM rooms WHERE id = $1",
        [room]
      );

      if (result.rows.length === 0) {
        socket.emit("room-not-found", { roomCode: room });
        return;
      }

      socket.join(room);

      socket.emit("room-state", {
        roomCode: room,
        code: result.rows[0].code ?? "// Start coding here...\n",
        language: result.rows[0].language ?? "cpp",
      });

      console.log(`User joined room: ${room}`);
    } catch (error) {
      console.error("Join room error:", error.message);
    }
  });

  // Save and broadcast code only for rooms this socket has joined
  socket.on("code-change", async ({ roomCode, code } = {}) => {
    if (typeof roomCode !== "string" || typeof code !== "string") return;

    const room = roomCode.trim().toUpperCase();

    if (!/^[A-F0-9]{6}$/.test(room)) return;
    if (code.length > 100000) return;
    if (!socket.rooms.has(room)) return;

    try {
      const result = await pool.query(
        "UPDATE rooms SET code = $1 WHERE id = $2 RETURNING id",
        [code, room]
      );

      if (result.rowCount > 0) {
        socket.to(room).emit("code-update", code);
      }
    } catch (error) {
      console.error("Save code error:", error.message);
    }
  });

  // Save and broadcast language for joined rooms
  socket.on("language-change", async ({ roomCode, language } = {}) => {
    if (typeof roomCode !== "string" || typeof language !== "string") {
      return;
    }

    const room = roomCode.trim().toUpperCase();
    const allowedLanguages = ["cpp", "java", "python", "javascript"];

    if (!/^[A-F0-9]{6}$/.test(room)) return;
    if (!allowedLanguages.includes(language)) return;
    if (!socket.rooms.has(room)) return;

    try {
      const result = await pool.query(
        "UPDATE rooms SET language = $1 WHERE id = $2 RETURNING id",
        [language, room]
      );

      if (result.rowCount > 0) {
        socket.to(room).emit("language-update", language);
      }
    } catch (error) {
      console.error("Save language error:", error.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`CodePair server running on port ${PORT}`);
});
