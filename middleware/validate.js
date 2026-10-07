const validate = (schema) => (req, res, next) => {
  try {
    // Parse the request
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    
    next(); 
  } catch (error) {
    // 1. If it IS a Zod validation error, format it nicely
    if (error.name === 'ZodError') {
      // Use .issues (the standard Zod array)
      const errorMessages = error.issues.map(err => `${err.path.join('.')}: ${err.message}`);
      
      return res.status(400).json({
        success: false,
        error: { 
          code: 'VALIDATION_ERROR', 
          message: 'Invalid request data',
          details: errorMessages
        }
      });
    }

    // 2. If it is NOT a Zod error, log the real problem so we can fix it
    console.error("🚨 MIDDLEWARE CRASH:", error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Something broke in the validation middleware' }
    });
  }
};

module.exports = validate;