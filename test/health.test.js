const request = require('supertest');
const app = require('../server.js');
const db = require('../config/db');

// Close the database connection after all tests finish
// Otherwise, the test runner will hang indefinitely
afterAll(async () => {
  await db.end();
});

describe('System Health Check API', () => {
  it('should return 200 OK and confirm DB connection', async () => {
    // Supertest simulates a GET request to your app
    const response = await request(app).get('/api/v1/health');

    // Jest "expects" certain things to be true
    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('OK');
    expect(response.body.message).toBe('API and Database are running');
  });
});