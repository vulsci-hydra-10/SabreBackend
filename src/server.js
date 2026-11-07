const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// ============ Import Routes (REGISTRY) ============
const flightRoutes = require("./routes/flightRoutes");
const authRoutes = require("./routes/authRoutes");
const airlineRoutes = require("./routes/airlineRoutes");

// ============ Import Database ============
// const connectDatabase = require("./config/database");
const { connectDatabase, } = require("./config/database");

// ============ Middleware (registered ONCE) ============
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

// ============ Routes (registered ONCE) ============
app.use("/api/auth", authRoutes);
app.use("/api/flights", flightRoutes);
app.use("/api/airlines", airlineRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Sabre Flights API is running",
    endpoints: {
      auth: "POST /api/auth/token",
      search: "POST /api/flights/search",
    },
  });
});

// ============ Test Routes ============
app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from Node.js!" });
});

// ============ Start Server (DB is non-blocking) ============
async function startServer() {
  try {
    await connectDatabase();
  } catch (error) {
    console.warn("⚠️ MySQL unavailable; starting without database:", error.message);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
  });
}

startServer();
