const express = require('express')
const cors = require('cors')
const app = express()

const expenseRouter = require('./controller/expenses')

app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 3000

app.use('/api/expenses', expenseRouter)

module.exports = app