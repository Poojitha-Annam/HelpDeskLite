const jwt = require('jsonwebtoken')

/**
 * verifyToken — Express middleware
 *
 * How it works:
 *  1. Reads the "Authorization" header sent by the browser.
 *     Expected format:  Authorization: Bearer <token>
 *  2. Strips the "Bearer " prefix to get the raw token string.
 *  3. Uses jsonwebtoken to verify the token hasn't been tampered with
 *     and hasn't expired (we set a 24-hour expiry at login).
 *  4. If valid, attaches the decoded payload { id, full_name, email, role }
 *     to req.user so the route handler can use it.
 *  5. If invalid or missing, sends a 401 response immediately.
 */
function verifyToken(req, res, next) {
  // Read the Authorization header
  const authHeader = req.headers['authorization']

  // Must look like:  Bearer eyJhbGc...
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access denied. Please log in.' })
  }

  // Extract the token part after "Bearer "
  const token = authHeader.split(' ')[1]

  try {
    // Verify signature + expiry using the secret from .env
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Make the user payload available to every route handler
    req.user = decoded

    // Pass control to the next middleware / route handler
    next()
  } catch (error) {
    // Token is expired, tampered with, or otherwise invalid
    return res.status(401).json({ message: 'Session expired. Please log in again.' })
  }
}

module.exports = verifyToken
