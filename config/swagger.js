const swaggerJsDoc = require('swagger-jsdoc');

const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'StockFlow Lite API',
      version: '1.0.0',
      description: 'Multi-tenant inventory and order management system',
    },
    servers: [
      { url: 'http://localhost:3000' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  // Tells Swagger where to find your route documentation
  apis: ['./modules/**/*.routes.js', './server.js'], 
};

module.exports = swaggerJsDoc(swaggerOptions);