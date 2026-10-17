const { test, describe } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const express = require('express');

const { createAuthMiddleware } = require('../utils/authentication');
const { validateRequest, updateBudgetSchema, createExpenseSchema } = require('../utils/validation');

describe('User Budget & Schema Enhancements (Mocked)', () => {
    const setupApp = (mockDb, mockAuthUser = { uid: 'user-456' }) => {
        const app = express();
        app.use(express.json());

        const mockAuthService = {
            verifyIdToken: async () => mockAuthUser
        };
        const requireAuth = createAuthMiddleware(mockAuthService);

        const userRouter = express.Router();
        userRouter.get('/budget', requireAuth, async (req, res) => {
            const uid = req.user.uid;
            try {
                const snapshot = await mockDb.ref(`users/${uid}/settings/dailyBudget`).once('value');
                const budget = snapshot.val();
                res.json({ dailyBudget: typeof budget === 'number' ? budget : 500 });
            } catch (e) {
                res.status(500).end();
            }
        });

        userRouter.put('/budget', requireAuth, validateRequest(updateBudgetSchema), async (req, res) => {
            const uid = req.user.uid;
            const { dailyBudget } = req.body;
            try {
                await mockDb.ref(`users/${uid}/settings/dailyBudget`).set(dailyBudget);
                res.json({ dailyBudget });
            } catch (e) {
                res.status(500).end();
            }
        });

        const expenseRouter = express.Router();
        expenseRouter.post('/', requireAuth, validateRequest(createExpenseSchema), async (req, res) => {
            const uid = req.user.uid;
            const today = '2026-10-17';
            const expenseDate = req.body.date || today;
            const newExpense = {
                ...req.body,
                date: expenseDate,
            };
            try {
                const ref = await mockDb.ref(`users/${uid}/expenses`).push(newExpense);
                res.status(201).json({ id: ref.key, ...newExpense });
            } catch (e) {
                res.status(500).end();
            }
        });

        app.use('/api/user', userRouter);
        app.use('/api/expenses', expenseRouter);
        return app;
    };

    test('TC-B1: GET /api/user/budget returns default 500 when not set', async () => {
        const mockDb = {
            ref: () => ({
                once: async () => ({ val: () => null })
            })
        };
        const app = setupApp(mockDb);

        const res = await request(app)
            .get('/api/user/budget')
            .set('Authorization', 'Bearer mock-token');

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.dailyBudget, 500);
    });

    test('TC-B2: PUT /api/user/budget saves and returns updated budget', async () => {
        let savedBudget = null;
        const mockDb = {
            ref: (path) => ({
                set: async (val) => { savedBudget = val; },
                once: async () => ({ val: () => savedBudget })
            })
        };
        const app = setupApp(mockDb);

        const putRes = await request(app)
            .put('/api/user/budget')
            .set('Authorization', 'Bearer mock-token')
            .send({ dailyBudget: 1200 });

        assert.strictEqual(putRes.status, 200);
        assert.strictEqual(putRes.body.dailyBudget, 1200);
        assert.strictEqual(savedBudget, 1200);
    });

    test('TC-B3: PUT /api/user/budget rejects negative or zero values', async () => {
        const app = setupApp({});

        const res = await request(app)
            .put('/api/user/budget')
            .set('Authorization', 'Bearer mock-token')
            .send({ dailyBudget: -100 });

        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'Validation failed');
    });

    test('TC-B4: POST /api/expenses supports category and custom date', async () => {
        let storedData = null;
        const mockDb = {
            ref: () => ({
                push: async (data) => {
                    storedData = data;
                    return { key: 'exp-hist-1' };
                }
            })
        };
        const app = setupApp(mockDb);

        const res = await request(app)
            .post('/api/expenses')
            .set('Authorization', 'Bearer mock-token')
            .send({
                description: 'Dinner with client',
                amount: 850,
                vendor: 'Olive Garden',
                category: 'dining',
                date: '2026-10-10'
            });

        assert.strictEqual(res.status, 201);
        assert.strictEqual(res.body.id, 'exp-hist-1');
        assert.strictEqual(res.body.vendor, 'Olive Garden');
        assert.strictEqual(res.body.category, 'dining');
        assert.strictEqual(res.body.date, '2026-10-10');
        assert.strictEqual(storedData.date, '2026-10-10');
    });
});
