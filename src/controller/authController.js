const sabreService = require("../services/sabreService");

/**
 * Get a Sabre access token
 * POST /api/auth/token
 */
async function getToken(req, res) {
  try {
    const token = await sabreService.getAccessToken();
    res.json({
      success: true,
      message: "Token obtained successfully",
      // Don't send the full token to frontend for security
      tokenLength: token.length,
    });
  } catch (error) {
    console.error("[AuthController]", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = { getToken };