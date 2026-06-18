const expenseRouter = require('express').Router()
const { admin} = require('../utils/config')
const { 
    validateRequest, 
    createExpenseSchema, 
    expenseIdSchema 
} = require('../utils/validation')

const { requireAuth } = require('../middleware/auth')

const db = admin.database()

expenseRouter.get('/', requireAuth, async (req, res) => {
    const uid = req.user.uid
    console.log('Fetching expenses from Firebase Realtime Database...')
    try {
        const userExpensesRef = db.ref(`users/${uid}/expenses`)
        const snapshot = await userExpensesRef.once('value')
        const expenses = snapshot.val() || {}
        res.json(expenses)
    } catch (error) {
        console.error('Error fetching expenses:', error)
        res.status(500).json({ error: 'Failed to fetch expenses' })
    }
})

expenseRouter.get('/:id', requireAuth, validateRequest(expenseIdSchema), async (req, res) => {
    const uid = req.user.uid
    const expenseId = req.params.id
    try {
        const userExpensesRef = db.ref(`users/${uid}/expenses`)
        const snapshot = await userExpensesRef.child(expenseId).once('value')
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

expenseRouter.post('/', requireAuth, validateRequest(createExpenseSchema), async (req, res) => {
    try {
        const uid = req.user.uid
        const userExpensesRef = db.ref(`users/${uid}/expenses`)
        const today = new Date().toLocaleDateString('en-CA', {timeZone: 'Asia/Kolkata'})
        const newExpense = {
            date: today,
            ...req.body
        }


        // Inject the server timestamp during the push
        const newExpenseRef = await userExpensesRef.push({
            ...newExpense,
            createdAt: admin.database.ServerValue.TIMESTAMP
        })
        
        res.status(201).json({ id: newExpenseRef.key, ...newExpense })
    } catch (error) {
        console.error('Error adding expense:', error)
        res.status(500).json({ error: 'Failed to add expense' })
    }
})


expenseRouter.delete('/:id', requireAuth, validateRequest(expenseIdSchema), async (req, res) => {
    const expenseId = req.params.id
    const uid = req.user.uid
    const userExpensesRef = db.ref(`users/${uid}/expenses`)
    try {
        await userExpensesRef.child(expenseId).remove()
        res.status(204).end()
    } catch (error) {
        console.error('Error deleting expense:', error)
        res.status(500).json({ error: 'Failed to delete expense' })
    }
})

module.exports = expenseRouter