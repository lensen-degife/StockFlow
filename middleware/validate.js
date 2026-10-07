const validate = (schema) => (req, res, next) => {
  try {
    // Parse the request body, query, and params against the provided schema
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    
    next(); // Data is valid! Proceed to the controller.
  } catch (error) {
    // Data is invalid! Catch Zod's detailed errors and return a 400 response.
    const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
    
    return res.status(400).json({
      success: false,
      error: { 
        code: 'VALIDATION_ERROR', 
        message: 'Invalid request data',
        details: errorMessages
      }
    });
  }
};

module.exports = validate;