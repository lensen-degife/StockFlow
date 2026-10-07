const db = require('../../config/db');

// GET /reports/low-stock
const getLowStockReport = async (req, res) => {
  const organizationId = req.user.organizationId;
  
  // Let the user specify a threshold, or default to 50 items
  const threshold = parseInt(req.query.threshold) || 50;

  try {
    const reportQuery = `
      SELECT 
        p.id AS product_id, 
        p.name AS product_name, 
        p.sku, 
        SUM(i.quantity - i.quantity_reserved) AS total_available_stock
      FROM products p
      LEFT JOIN inventory_levels i ON p.id = i.product_id
      WHERE p.organization_id = $1
      GROUP BY p.id, p.name, p.sku
      HAVING SUM(i.quantity - i.quantity_reserved) < $2 OR SUM(i.quantity) IS NULL
      ORDER BY total_available_stock ASC;
    `;

    const result = await db.query(reportQuery, [organizationId, threshold]);

    res.status(200).json({
      success: true,
      meta: {
        threshold: threshold,
        total_items_low: result.rows.length
      },
      data: result.rows
    });
  } catch (error) {
    console.error("LOW STOCK REPORT ERROR:", error.message);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to generate report.' }
    });
  }
};

module.exports = { getLowStockReport };