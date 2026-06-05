const express = require('express')
const cors = require('cors')
const app = express()

const expenseRouter = require('./controller/expenses')

app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 3000

app.use('/api/expenses', expenseRouter)

app.use((error, req, res, next) => {
	if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
		return res.status(400).json({ error: 'Invalid JSON payload' })
	}

	return next(error)
})

module.exports = app