const userRouter = require('express').Router();
const { admin } = require('../utils/config');
const { validateRequest, updateBudgetSchema } = require('../utils/validation');
const { requireAuth } = require('../middleware/auth');

const db = admin.database();

userRouter.get('/budget', requireAuth, async (req, res) => {
    const uid = req.user.uid;
    try {
        const snapshot = await db.ref(`users/${uid}/settings/dailyBudget`).once('value');
        const budget = snapshot.val();
        res.json({ dailyBudget: typeof budget === 'number' ? budget : 500 });
    } catch (error) {
        console.error('Error fetching budget:', error);
        res.status(500).json({ error: 'Failed to fetch budget' });
    }
});

userRouter.put('/budget', requireAuth, validateRequest(updateBudgetSchema), async (req, res) => {
    const uid = req.user.uid;
    const { dailyBudget } = req.body;
    try {
        await db.ref(`users/${uid}/settings/dailyBudget`).set(dailyBudget);
        res.json({ dailyBudget });
    } catch (error) {
        console.error('Error updating budget:', error);
        res.status(500).json({ error: 'Failed to update budget' });
    }
});

module.exports = userRouter;
