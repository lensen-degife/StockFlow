const db = require('../../config/db');

// GET /audit-logs
const getAuditLogs = async (req, res) => {
  const organizationId = req.user.organizationId;
  const { actor_id, action, resource_type, start_date, end_date } = req.query;

  try {
    // We start with the base query ensuring multi-tenant isolation
    let queryText = `
      SELECT id, actor_id, action, resource_type, resource_id, created_at 
      FROM audit_logs 
      WHERE organization_id = $1
    `;
    const queryParams = [organizationId];
    let paramIndex = 2;

    // Dynamically add filters if they were provided in the URL
    if (actor_id) {
      queryText += ` AND actor_id = $${paramIndex}`;
      queryParams.push(actor_id);
      paramIndex++;
    }
    
    if (action) {
      queryText += ` AND action = $${paramIndex}`;
      queryParams.push(action);
      paramIndex++;
    }

    if (resource_type) {
      queryText += ` AND resource_type = $${paramIndex}`;
      queryParams.push(resource_type);
      paramIndex++;
    }

    if (start_date) {
      queryText += ` AND created_at >= $${paramIndex}`;
      queryParams.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      queryText += ` AND created_at <= $${paramIndex}`;
      queryParams.push(end_date);
      paramIndex++;
    }

    // Always sort newest first
    queryText += ` ORDER BY created_at DESC LIMIT 100`;

    const result = await db.query(queryText, queryParams);

    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("GET AUDIT LOGS ERROR:", error.message);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch audit logs.' }
    });
  }
};

module.exports = { getAuditLogs };