const expenseRouter = require('express').Router()
const { admin } = require('../utils/config')

const db = admin.database()
const expensesRef = db.ref('expenses')

expenseRouter.get('/', async (req, res) => {
    try {
        const snapshot = await expensesRef.once('value')
        const expenses = snapshot.val() || {}
        res.json(expenses)
    } catch (error) {
        console.error('Error fetching expenses:', error)
        res.status(500).json({ error: 'Failed to fetch expenses' })
    }
})

expenseRouter.post('/', async (req, res) => {
    try {
        const newExpense = req.body
        const newExpenseRef = await expensesRef.push(newExpense)
        res.status(201).json({ id: newExpenseRef.key, ...newExpense })
    } catch (error) {
        console.error('Error adding expense:', error)
        res.status(500).json({ error: 'Failed to add expense' })
    }
})

module.exports = expenseRouter