const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const { default: rateLimit, ipKeyGenerator } = require('express-rate-limit')
const morgan = require('morgan')

const expenseRouter = require('./controller/expenses')
const authValidateRouter = require('./controller/authValidate')
const analyticsRouter = require('./controller/analytics')
const { PORT, NODE_ENV } = require('./utils/config')

const app = express()
app.set('trust proxy',1)
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // limit each IP to 100 requests per windowMs
	message: { error: 'Too many requests, please try again later.' },
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
	keyGenerator: (req, res) => ipKeyGenerator(req)
})

app.use(cors())
app.use(express.json())
app.use(helmet())
app.use(limiter)

if (NODE_ENV === 'dev') {
	app.use(morgan('dev'))
} else {
	app.use(morgan('combined'))
}

app.use('/api/expenses', expenseRouter)
app.use('/api/auth', authValidateRouter)
app.use('/api/analytics', analyticsRouter)

app.use((error, req, res, next) => {
	if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
		return res.status(400).json({ error: 'Invalid JSON payload' })
	}

	return next(error)
})

module.exports = app