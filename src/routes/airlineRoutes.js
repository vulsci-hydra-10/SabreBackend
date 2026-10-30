
const express = require("express");
const router = express.Router();

const { pool } = require("../config/database");

// GET /api/airlines
router.get("/", async (req, res) => {
  try {
    const [airlines] = await pool.execute(
      `SELECT airline_code, airline_name, logo_url
       FROM airline_logos
       WHERE is_active = TRUE
       ORDER BY airline_name ASC`
    );

    res.json(airlines);
  } catch (error) {
    console.error("Failed to fetch airlines:", error.message);

    res.status(500).json({
      message: "Failed to fetch airlines",
    });
  }
});

// GET /api/airlines/EK
router.get("/:code", async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();

    const [airlines] = await pool.execute(
      `SELECT airline_code, airline_name, logo_url
       FROM airline_logos
       WHERE airline_code = ? AND is_active = TRUE
       LIMIT 1`,
      [code]
    );

    if (airlines.length === 0) {
      return res.status(404).json({
        message: "Airline not found",
      });
    }

    res.json(airlines[0]);
  } catch (error) {
    console.error("Failed to fetch airline:", error.message);

    res.status(500).json({
      message: "Failed to fetch airline",
    });
  }
});

// POST: Get airline details by airline codes
router.post("/filterCareer", async (req, res) => {
  try {
    const { airlineCodes } = req.body;

    if (!Array.isArray(airlineCodes)) {
      return res.status(400).json({
        success: false,
        message: "airlineCodes must be an array",
      });
    }

    // Remove empty and duplicate airline codes
    const codes = [
      ...new Set(
        airlineCodes
          .filter((code) => typeof code === "string")
          .map((code) => code.trim().toUpperCase())
          .filter(Boolean)
      ),
    ];

    if (codes.length === 0) {
      return res.json({
        success: true,
        airlines: [],
      });
    }

    const placeholders = codes.map(() => "?").join(",");

    const sql = `
      SELECT
        airline_code,
        airline_name,
        logo_url
      FROM airline_logos
      WHERE airline_code IN (${placeholders})
      AND is_active = 1
      ORDER BY airline_name ASC
    `;

    const [airlines] = await pool.execute(sql, codes);

    return res.json({
      success: true,
      airlines,
    });

  } catch (error) {
    console.error("Airline Filter API Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch airlines",
    });
  }
});

module.exports = router;
