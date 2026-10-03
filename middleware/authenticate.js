const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  // Check if the Authorization header exists
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTHENTICATION_ERROR', message: 'Missing or invalid authentication token' }
    });
  }

  // Extract the token (format is "Bearer <token>")
  const token = authHeader.split(' ')[1];

  try {
    // Verify the token using your secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach the decoded payload (which contains userId) to the request object
    req.user = decoded;
    
    // Move to the next function (the actual route)
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTHENTICATION_ERROR', message: 'Token is invalid or expired' }
    });
  }
};

module.exports = authenticate;