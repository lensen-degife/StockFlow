const { z } = require('zod');

const createOrderSchema = z.object({
  body: z.object({
    customer_id: z.string().uuid({ message: "Customer ID must be a valid UUID" }),
    items: z.array(
      z.object({
        product_id: z.string().uuid({ message: "Product ID must be a valid UUID" }),
        warehouse_id: z.string().uuid({ message: "Warehouse ID must be a valid UUID" }),
        // Zod strictly enforces these are numbers, positive, and integers (no decimals for quantity)
        quantity: z.number().int().positive({ message: "Quantity must be 1 or greater" }),
        unit_price: z.number().nonnegative({ message: "Unit price cannot be negative" })
      })
    ).min(1, { message: "An order must contain at least one item" })
  })
});

module.exports = { createOrderSchema };