const logger = (req, res, next) => {
  const start = Date.now();

  // res.on('finish') waits until the server has sent the response back to Postman
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - ${duration}ms`);
  });

  next();
};

module.exports = logger;