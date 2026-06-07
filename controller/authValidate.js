const authValidateRouter = require('express').Router()
const { requireAuth } = require('../middleware/auth')

authValidateRouter.get('/', requireAuth, (req, res) => {
    res.json({ message: 'Authentication successful', user: req.user })
})

module.exports = authValidateRouter