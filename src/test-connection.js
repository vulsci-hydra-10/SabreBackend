require("dotenv").config();
const https = require("https");
const dns = require("dns");

const urls = [
  { name: "api-cert.sabre.com", url: "https://api-cert.sabre.com" },
  { name: "sws-crt.cert.havail.sabre.com", url: "https://sws-crt.cert.havail.sabre.com" },
  { name: "api-crt.cert.havail.sabre.com", url: "https://api-crt.cert.havail.sabre.com" },
  { name: "api.sabre.com", url: "https://api.sabre.com" },
];

console.log("🔍 Testing Sabre API connectivity...\n");

urls.forEach(({ name, url }) => {
  // DNS lookup
  dns.lookup(name, (err, address) => {
    if (err) {
      console.log(`❌ ${name} — DNS FAILED: ${err.message}`);
    } else {
      console.log(`✅ ${name} — DNS OK (IP: ${address})`);
      
      // HTTP test
      const req = https.get(`${url}/v2/auth/token`, (res) => {
        console.log(`   → HTTP ${res.statusCode} (reachable!)`);
      });
      
      req.on("error", (e) => {
        console.log(`   → HTTP FAILED: ${e.message}`);
      });
      
      req.setTimeout(5000, () => {
        console.log(`   → HTTP TIMEOUT (5s)`);
        req.destroy();
      });
    }
  });
});