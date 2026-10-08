```markdown
# StockFlow Lite

## Project Description
StockFlow Lite is a secure, multi-tenant inventory and order management API designed with enterprise-level reliability in mind. It allows multiple organizations to manage products, track inventory across different warehouses, and securely process customer orders without data bleed. The system strictly enforces transactional integrity to prevent overselling, race conditions, and duplicate orders.

## Architecture Summary
* **Backend:** Node.js with Express.js (RESTful API v1)
* **Database:** PostgreSQL (using `pg` driver)
* **Multi-Tenancy:** Row-level enforcement via `organization_id` on all queries.
* **Security & Validation:** JWT-based Auth, Role-Based Access Control (Admin/Staff), Helmet, CORS, Express Rate Limiter, and strict schema validation using **Zod**.
* **Testing:** Automated integration testing with Jest and Supertest.
* **Documentation:** Swagger / OpenAPI 3.0 auto-generated UI.

---

## Local Setup Instructions

This project runs natively on your machine without Docker.

**1. Clone and Install Dependencies**
```bash
git clone <your-repo-url>
cd stockflow-lite
npm install
```

**2. Database Setup**  
Ensure you have PostgreSQL installed locally or have a hosted database connection string (e.g., Supabase, Neon, or ElephantSQL). Create an empty database for this project.

**3. Configure Environment Variables**  
Create a `.env` file in the root directory (do not commit this file). See the section below for required variables.

**4. Start the Server**
```bash
npm start
```
The server will start on http://localhost:3000.

## Environment Variables
A sample file named `.env.example` is included in the repository. Your actual `.env` file should contain the following keys:

```env
# Server Configuration
PORT=3000

# Database Configuration (Replace with your actual DB credentials)
DATABASE_URL=postgresql://username:password@localhost:5432/stockflow_db

# Security
JWT_SECRET=your_super_secret_jwt_key_here
```

## Migrations and Seed Data
To set up the database schema and populate it with initial test data (Organizations, Users, Products, and Warehouses):

1. Ensure your `DATABASE_URL` is correctly set in your `.env` file.


The console will confirm that tables have been created and dummy data has been inserted.

## API Documentation

**1. Postman Collection (Primary)**  
A complete, well-organized Postman collection is included in the root of this repository (`StockFlow_Lite.postman_collection.json`). It contains folders for each module, example requests, required headers, and sample responses. Simply import this file into Postman to test the API immediately.

**2. Swagger / OpenAPI (Stretch Goal Implemented)**  
As a Priority 3 stretch goal, interactive web-based documentation has also been generated. Once the server is running, you can explore it in your browser at:  
**[http://localhost:3000/api-docs](http://localhost:3000/api-docs)**

## Concurrency Strategy (Section 9)
Handling concurrent inventory requests is a critical challenge in e-commerce. StockFlow Lite handles high-concurrency environments using the following strategies:

**Transactional Integrity (BEGIN, COMMIT, ROLLBACK):**  
Order creation and inventory deduction are wrapped in strict PostgreSQL transactions. If any step fails (e.g., writing the audit log or reserving inventory), the entire database transaction is rolled back, guaranteeing no orphan records or partial stock deductions.

**Idempotency Keys:**  
The `POST /orders` endpoint requires an `Idempotency-Key` header. This prevents accidental duplicate orders if a client retries a request due to a network timeout. The database enforces a unique constraint on `(organization_id, idempotency_key)`.

**The Reservation Pattern:**  
Instead of immediately deducting stock from `quantity`, orders initially move stock into `quantity_reserved`. A background worker (or manual trigger) confirms or expires these reservations. This prevents overselling while keeping available stock calculations (`quantity - quantity_reserved`) accurate in real-time.

## Known Limitations
To keep the scope of this "Lite" version focused on core transactional logic and multi-tenancy, the following features were deliberately omitted:

* **In-Memory Rate Limiting:** Rate limiting currently uses Express memory. In a multi-server deployment, this would need to be migrated to a Redis store.
* **Basic RBAC:** Roles (`org_admin`, `staff`) are hardcoded. A full enterprise version would require dynamic permission scopes and custom user groups.
* **No External Payment Gateway:** Order processing ends at "Confirmation." Integration with Stripe/PayPal was scoped out.
* **No Database Read-Replicas:** The system assumes a single primary database node. Read-heavy endpoints (like the Low Stock report) query the primary node directly.
* **Pagination:** While filtering is implemented, robust cursor-based pagination on high-volume routes (like Audit Logs and Orders) was deferred.
```