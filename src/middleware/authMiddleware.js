function authMiddleware(req, res, next) {
  // For now, just pass through
  // In the future, we can verify tokens here
  next();
}

module.exports = authMiddleware;