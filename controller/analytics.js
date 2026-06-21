const analyticsRouter = require('express').Router()
const {admin} = require('../utils/config')

const {requireAuth} = require('../middleware/auth')
const {getLocalDateString, 
    sumExpenses,
    buildCurrentWeekBlueprint,
    aggregateExpensesByMap} = require('../utils/analytics')

const db = admin.database()

analyticsRouter.get('/today', requireAuth, async (req, res) => {
    const uid = req.user.uid
    const clientTimezone = req.query.tz || 'Etc/UTC'
    const today = getLocalDateString(clientTimezone, 0)
    console.log(`Calculating today's total for user ${uid} 
        in timezone ${clientTimezone} (date: ${today})...`)

    try {
        const userExpensesRef = db.ref(`users/${uid}/expenses`)
        const snapshot = await userExpensesRef
            .orderByChild('date')
            .equalTo(today)
            .once('value')

        res.status(200).json({
            date: today,
            timeZone: clientTimezone,
            total: sumExpenses(snapshot.val())
        })
    } catch(error) {
        console.error(`Error calculating today's total : ${error}`)
        res.status(500).json({error: `Failed to generate analytics`})
    }
})

analyticsRouter.get('/weekly', requireAuth, async (req, res) => {
    const uid = req.user.uid
    const timeZone = req.query.tz || 'Etc/UTC'
    const {blueprint, dateMap, startDate} = buildCurrentWeekBlueprint(timeZone)
    try {
        const userExpensesRef = db.ref(`users/${uid}/expenses`)
        const snapshot = await userExpensesRef
            .orderByChild('date')
            .startAt(startDate)
            .endAt(getLocalDateString(timeZone, 0))
            .once('value')
        const currentWeekData = aggregateExpensesByMap(snapshot.val(), blueprint, dateMap)
        res.status(200).json(currentWeekData)
    } catch (error) {
        console.log(`Error: ${error}`)
        res.status(500).json({error: `Failed to get this week's stats`})
    }
})

analyticsRouter.get('/monthly', requireAuth, async(req, res) => {
    
})

module.exports = analyticsRouter