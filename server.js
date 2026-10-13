require('dotenv').config();
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const db = require('./config/db');
const startReservationTimer = require('./jobs/expireReservations');
const apiLimiter = require('./middleware/rateLimiter');
const logger = require('./middleware/logger');

// Route Imports
const authRoutes = require('./modules/auth/auth.routes');
const orgRoutes = require('./modules/organizations/organizations.routes');
const productRoutes = require('./modules/products/products.routes');
const warehouseRoutes = require('./modules/warehouses/warehouses.routes');
const customerRoutes = require('./modules/customers/customers.routes');
const inventoryRoutes = require('./modules/inventory/inventory.routes');
const orderRoutes = require('./modules/orders/orders.routes');
const auditRoutes = require('./modules/audit/audit.routes');
const reportRoutes = require('./modules/reports/reports.routes');

const swaggerUi = require('swagger-ui-express');
const swaggerDocs = require('./config/swagger');

const app = express();

app.set('trust proxy', 1);

// Security & Parsing Middleware
app.use(helmet()); // Secures HTTP headers
app.use(cors(
  'https://stockflow-frontend-woad.vercel.app/'
)); // Allows browser clients to access your API
app.use(express.json());

app.use(logger);

// Apply the rate limiting middleware to all /api/ requests
app.use('/api/', apiLimiter);


// Basic health check endpoint
app.get('/api/v1/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.status(200).json({ status: 'OK', message: 'API and Database are running' });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: 'Database unreachable' });
  }
});

app.use('/api/v1/auth', authRoutes);

app.use('/api/v1/organizations', orgRoutes);

app.use('/api/v1/products', productRoutes);

app.use('/api/v1/warehouses', warehouseRoutes);

app.use('/api/v1/customers', customerRoutes);

app.use('/api/v1/inventory', inventoryRoutes);

app.use('/api/v1/orders', orderRoutes);

app.use('/api/v1/audit-logs', auditRoutes);

app.use('/api/v1/reports', reportRoutes);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));



const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// Only start the server AND the background job if run directly (node server.js)
if (require.main === module) {
  
  startReservationTimer();

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;