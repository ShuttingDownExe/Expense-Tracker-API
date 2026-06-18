const { z } = require('zod');

const validateRequest = (schema) => {
    return (req, res, next) => {
        try {
            // Validate body, query, and params simultaneously
            const parsed = schema.parse({
                body: req.body,
                query: req.query,
                params: req.params,
            });

            // Reassign the sanitized data to strip out malicious fields
            req.body = parsed.body;
            req.query = parsed.query;
            req.params = parsed.params;

            next();
        } catch (error) {
            // Format Zod errors into a clean, readable JSON response
            const errors = error.issues.map((err) => ({
                field: err.path[0] === 'body' || err.path[0] === 'query' || err.path[0] === 'params'
                    ? err.path.slice(1).join('.')
                    : err.path.join('.'),
                message: err.message,
            }));
            
            return res.status(400).json({ error: 'Validation failed', errors });
        }
    };
};

const createExpenseSchema = z.object({
    body: z.object({
        description: z.string().min(1, 'Description is required').max(100, 'Description must be less than 100 characters'),
        amount: z.number().positive('Amount must be a positive number'),
        vendor: z.string()
            .min(1, 'Vendor is required')
            .max(100, 'Vendor name must be less than 100 characters'),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    }).strict(),
});

const expenseIdSchema = z.object({
    params: z.object({
        id: z.string().regex(/^[a-zA-Z0-9-_]+$/, "Invalid expense ID format")
    }).strict()
});

module.exports = { 
    validateRequest,
    createExpenseSchema,
    expenseIdSchema 
};