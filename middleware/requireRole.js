const db = require('../config/db');

const requireRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      // The organization ID can be in the URL params, body, or query
      const organizationId = req.params.organizationId || req.body.organization_id;
      const userId = req.user.userId;

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Organization ID is required' }
        });
      }

      const result = await db.query(
        'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
        [organizationId, userId]
      );

      // If the user is not a member, return 404 (Not Found) to prevent data leaks
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Organization not found' }
        });
      }

      const userRole = result.rows[0].role;

      // Check if the user's role is in the list of allowed roles
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          error: { code: 'AUTHORIZATION_ERROR', message: 'You do not have permission to perform this action' }
        });
      }

      // Save the role and organization ID to the request object for the next functions
      req.user.role = userRole;
      req.user.organizationId = organizationId;

      next();
    } catch (error) {
      console.error("RBAC ERROR:", error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' }
      });
    }
  };
};

module.exports = requireRole;