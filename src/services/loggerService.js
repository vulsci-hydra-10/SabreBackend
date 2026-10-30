const fs = require("fs");
const path = require("path");

// Make sure logs directory exists
const logsDir = path.join(__dirname, "../../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Log request or response to a file
 * @param {string} type - e.g., "login_Rq", "login_Rs", "search_Rq", "search_Rs"
 * @param {object} data - The data to log
 */
function logToFile(type, data) {
  console.log(`Logging ${data}...`);
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0]; // 2026-01-15
  const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, ""); // 103001
  const filename = `${type}_${dateStr}_${timeStr}.json`;
  const filepath = path.join(logsDir, filename);

  const logEntry = {
    loggedAt: now.toISOString(),
    type: type,
    data: data,
  };

  fs.writeFileSync(filepath, JSON.stringify(logEntry, null, 2), "utf-8");

  console.log(`[Logger] Saved: ${filename}`);
  return filepath;
}

module.exports = { logToFile };