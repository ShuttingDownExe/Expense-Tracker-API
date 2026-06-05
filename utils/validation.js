const {z} = require('zod');

const expenseSchema = z.object({
    description: z.string().min(1, 'Description is required'),
    amount: z.number().positive('Amount must be a positive number'),
    date: z.string().refine((date) => !isNaN(Date.parse(date)), {
        message: 'Invalid date format',
    }),
    vendor: z.string().min(1, 'Vendor is required').max(100, 'Vendor name must be less than 100 characters'),
    category: z.enum(['Credit', 'Debit'], {
        errorMap: () => ({ message: 'Category must be either "Credit" or "Debit"' }),
    }),
    
});

module.exports = { expenseSchema };