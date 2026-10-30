require("dotenv").config();

var sabreEnv = process.env.SABRE_ENVIRONMENT || "CERT";

var baseUrls = {
  CERT: "https://api-crt.cert.havail.sabre.com",
  PROD: "https://api.sabre.com",
};

var baseUrl = baseUrls[sabreEnv];

var config = {
  epr: process.env.SABRE_EPR,
  pcc: process.env.SABRE_PCC,
  password: process.env.SABRE_PASSWORD,
  domain: process.env.SABRE_DOMAIN,
  baseUrl: baseUrl,
  tokenUrl: baseUrl + "/v2/auth/token",
  bfmUrl: baseUrl + "/v5/offers/shop",
  manualToken: process.env.SABRE_MANUAL_TOKEN || "",
};

module.exports = config;