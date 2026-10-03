

const db = require('../../config/db');

// POST /organizations
const createOrganization = async (req, res) => {
  const { name, slug } = req.body;
  const userId = req.user.userId; // Comes from the authenticate middleware

  if (!name || !slug) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Name and slug are required' }
    });
  }

  // Get a dedicated connection for the transaction
  const client = await db.connect();

  try {
    await client.query('BEGIN'); // Start transaction

    // 1. Create the organization
    const orgResult = await client.query(
      'INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id, name, slug, created_at',
      [name, slug]
    );
    const newOrg = orgResult.rows[0];

    // 2. Make the creator the org_admin
    await client.query(
      'INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, $3)',
      [newOrg.id, userId, 'org_admin']
    );

    await client.query('COMMIT'); // Save both actions

    res.status(201).json({ success: true, data: newOrg });
  } catch (error) {
    await client.query('ROLLBACK'); // Undo everything if anything failed

    if (error.code === '23505') { // Unique constraint violation (slug exists)
      return res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'Organization slug is already taken.' }
      });
    }

    console.error("CREATE ORG ERROR:", error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' }
    });
  } finally {
    client.release(); // Always release the connection back to the pool
  }
};

module.exports = { createOrganization };