const expenseRouter = require('express').Router()
const { admin, NODE_ENV } = require('../utils/config')
const { expenseSchema } = require('../utils/validation')

const db = admin.database()
const expensesRef = db.ref('expenses')

expenseRouter.get('/', async (req, res) => {
    console.log('Fetching expenses from Firebase Realtime Database...')
    try {
        const snapshot = await expensesRef.once('value')
        const expenses = snapshot.val() || {}
        res.json(expenses)
    } catch (error) {
        console.error('Error fetching expenses:', error)
        res.status(500).json({ error: 'Failed to fetch expenses' })
    }
})

expenseRouter.get('/:id', async (req, res) => {
    const expenseId = req.params.id
    try {
        const snapshot = await expensesRef.child(expenseId).once('value')
        const expense = snapshot.val()
        if (expense) {
            res.json({ id: expenseId, ...expense })
        } else {
            res.status(404).json({ error: 'Expense not found' })
        }
    } catch (error) {
        console.error('Error fetching expense:', error)
        res.status(500).json({ error: 'Failed to fetch expense' })
    }
})

expenseRouter.post('/', async (req, res) => {
    try {
        const result = expenseSchema.safeParse(req.body)
        if (!result.success) {
            const errors = result.error.issues.map((err) => ({
                field: err.path.join('.'),
                message: err.message,
            }))
            return res.status(400).json({ error: 'Validation failed', errors })
        }

        const newExpense = result.data
        const newExpenseRef = await expensesRef.push(newExpense)
        res.status(201).json({ id: newExpenseRef.key, ...newExpense })
    } catch (error) {
        console.error('Error adding expense:', error)
        res.status(500).json({ error: 'Failed to add expense' })
    }
})


expenseRouter.delete('/:id', async (req, res) => {
    const expenseId = req.params.id
    try {
        await expensesRef.child(expenseId).remove()
        res.status(204).end()
    } catch (error) {
        console.error('Error deleting expense:', error)
        res.status(500).json({ error: 'Failed to delete expense' })
    }
})

module.exports = expenseRouter