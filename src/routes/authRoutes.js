const express = require("express");
const router = express.Router();
const authController = require("../controller/authController");

// POST /api/auth/token
router.post("/token", authController.getToken);

module.exports = router;