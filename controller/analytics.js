analyticsRouter = require('express').Router()
const {admin} = require('../utils/config')

const {requireAuth} = require('../middleware/auth')

const db = admin.database()

analyticsRouter.get('/today', requireAuth, async (req, res) => {
    
})

analyticsRouter.get('/weekly', requireAuth, async (req, res) => {
    
})

analyticsRouter.get('/monthly', requireAuth, async(req, res) => {

})