const express = require("express");
const router = express.Router();
const flightController = require("../controller/flightController");

// GET /api/flights — info endpoint
router.get("/", flightController.getFlightsInfo);

// POST /api/flights/search — the actual search
router.post("/search", flightController.searchFlights);

module.exports = router;