const { test, describe } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const express = require('express');

// We need a way to inject mock DB and Auth into the routes
// Since the current routes are tightly coupled to the 'admin' singleton in config.js,
// we'll use a helper to create a test version of the router.

const { createAuthMiddleware } = require('../utils/authentication');
const { validateRequest, createExpenseSchema, expenseIdSchema } = require('../utils/validation');

describe('Expense CRUD Functionality (Mocked)', () => {
    
    // Helper to setup a test app with specific mock behaviors
    const setupTestApp = (mockDb, mockAuthUser = { uid: 'user-123' }) => {
        const app = express();
        app.use(express.json());

        const mockAuthService = {
            verifyIdToken: async () => mockAuthUser
        };
        const requireAuth = createAuthMiddleware(mockAuthService);

        // Define a test-specific router that uses our mock DB
        const expenseRouter = express.Router();

        expenseRouter.get('/', requireAuth, async (req, res) => {
            const uid = req.user.uid;
            try {
                const snapshot = await mockDb.ref(`users/${uid}/expenses`).once('value');
                res.json(snapshot.val() || {});
            } catch (e) { res.status(500).end(); }
        });

        expenseRouter.post('/', requireAuth, validateRequest(createExpenseSchema), async (req, res) => {
            const uid = req.user.uid;
            try {
                const ref = await mockDb.ref(`users/${uid}/expenses`).push(req.body);
                res.status(201).json({ id: ref.key, ...req.body });
            } catch (e) { res.status(500).end(); }
        });

        expenseRouter.delete('/:id', requireAuth, validateRequest(expenseIdSchema), async (req, res) => {
            const uid = req.user.uid;
            const expenseId = req.params.id;
            try {
                await mockDb.ref(`users/${uid}/expenses`).child(expenseId).remove();
                res.status(204).end();
            } catch (e) { res.status(500).end(); }
        });

        app.use('/api/expenses', expenseRouter);
        return app;
    };

    test('TC-1: Should create a new expense', async () => {
        const mockDb = {
            ref: (path) => ({
                push: async (data) => ({ key: 'new-id-999' })
            })
        };
        const app = setupTestApp(mockDb);

        const newExpense = {
            description: 'Lunch',
            amount: 15.50,
            vendor: 'Burger King',
        };

        const response = await request(app)
            .post('/api/expenses')
            .set('Authorization', 'Bearer mock-token')
            .send(newExpense);

        assert.strictEqual(response.status, 201);
        assert.strictEqual(response.body.id, 'new-id-999');
        assert.strictEqual(response.body.description, 'Lunch');
    });

    test('TC-2: Should fetch user-specific expenses', async () => {
        const mockData = { 'exp-1': { description: 'Coffee', amount: 5.0 } };
        const mockDb = {
            ref: (path) => ({
                once: async () => ({ val: () => mockData })
            })
        };
        const app = setupTestApp(mockDb);

        const response = await request(app)
            .get('/api/expenses')
            .set('Authorization', 'Bearer mock-token');

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(response.body, mockData);
    });

    test('TC-3: Should reject invalid expense data (Zod validation)', async () => {
        const app = setupTestApp({});
        
        const invalidExpense = {
            description: '', // Too short
            amount: -10,    // Must be positive
            vendor: 'Test',
            date: 'not-a-date'
        };

        const response = await request(app)
            .post('/api/expenses')
            .set('Authorization', 'Bearer mock-token')
            .send(invalidExpense);

        assert.strictEqual(response.status, 400);
        assert.strictEqual(response.body.error, 'Validation failed');
        // Ensure multiple errors are returned
        assert(response.body.errors.length >= 3);
    });

    test('TC-4: Should delete an expense', async () => {
        let deletedId = '';
        const mockDb = {
            ref: (path) => ({
                child: (id) => ({
                    remove: async () => { deletedId = id; }
                })
            })
        };
        const app = setupTestApp(mockDb);

        const response = await request(app)
            .delete('/api/expenses/exp-123')
            .set('Authorization', 'Bearer mock-token');

        assert.strictEqual(response.status, 204);
        assert.strictEqual(deletedId, 'exp-123');
    });
});
