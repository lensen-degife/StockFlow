require('dotenv').config();
const http = require('http');
const authRoutes = require('./modules/auth/auth.routes');
const orgRoutes = require('./modules/organizations/organizations.routes');
const productRoutes = require('./modules/products/products.routes');
const warehouseRoutes = require('./modules/warehouses/warehouses.routes');
const customerRoutes = require('./modules/customers/customers.routes');
const inventoryRoutes = require('./modules/inventory/inventory.routes');

const express = require('express');
const db = require('./config/db'); // This tests the DB connection on startup

const app = express();
app.use(express.json());

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

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});



