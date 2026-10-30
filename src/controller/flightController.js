const sabreService = require("../services/sabreService");

/**
 * Search flights
 * POST /api/flights/search
 * 
 * Request body: { tripType, origin, destination, departureDate, returnDate, adults, children, infants }
 */
async function searchFlights(req, res) {
  try {
    const { tripType, origin, destination, departureDate, returnDate, adults, children, infants } = req.body;

    // Validation (like Laravel's $request->validate())
    if (!origin || !destination || !departureDate) {
      return res.status(400).json({
        success: false,
        message: "Origin, destination, and departure date are required",
      });
    }

    if (tripType === "roundtrip" && !returnDate) {
      return res.status(400).json({
        success: false,
        message: "Return date is required for round trip",
      });
    }

    const searchParams = {
      tripType: tripType || "oneway",
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      departureDate,
      returnDate: tripType === "roundtrip" ? returnDate : null,
      adults: adults || 1,
      children: children || 0,
      infants: infants || 0,
    };

    const results = await sabreService.searchFlights(searchParams);

    res.json(results);
  } catch (error) {
    console.error("[FlightController]", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/**
 * Test endpoint - just return flight routes info
 * GET /api/flights
 */
async function getFlightsInfo(req, res) {
  res.json({
    message: "Flights API is running. Use POST /api/flights/search to search flights.",
    endpoints: {
      search: "POST /api/flights/search",
      body: {
        tripType: "oneway | roundtrip",
        origin: "SIN",
        destination: "SYD",
        departureDate: "2026-11-07",
        returnDate: "2026-11-14 (only for roundtrip)",
        adults: 1,
        children: 0,
        infants: 0,
      },
    },
  });
}

module.exports = { searchFlights, getFlightsInfo };