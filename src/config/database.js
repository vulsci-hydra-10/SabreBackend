
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "sabreflights",

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function connectDatabase() {
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.ping();

    console.log("✅ MySQL connected successfully");
  } catch (error) {
    console.error("❌ MySQL connection failed:", error.message);
    throw error;
  } finally {
    connection?.release();
  }
}

module.exports = {
  connectDatabase,
  pool,
};


// const mongoose = require("mongoose");

// async function connectDatabase() {
//   try {
//     await mongoose.connect(process.env.MONGO_URI);
//     console.log(" MongoDB connected");
//   } catch (error) {
//     console.warn("  MongoDB not available — server continues without DB");
//   }
// }

// module.exports = connectDatabase;