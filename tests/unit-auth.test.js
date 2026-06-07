const { test, describe } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const express = require('express');
const { createAuthMiddleware } = require('../utils/authentication');

describe('Security Middleware Logic', () => {
    
    test('TC-1: Successful Authentication with Mocked Service', async () => {
        // 1. Create a mock auth service
        const mockAuthService = {
            verifyIdToken: async (token, checkRevoked) => {
                if (token === 'valid-token') {
                    return { uid: 'user-123', email: 'test@example.com' };
                }
                throw new Error('Invalid token');
            }
        };

        // 2. Create middleware with mock service
        const testMiddleware = createAuthMiddleware(mockAuthService);

        // 3. Setup a mini express app to test it
        const app = express();
        app.get('/test', testMiddleware, (req, res) => res.json(req.user));

        // 4. Test success
        const response = await request(app)
            .get('/test')
            .set('Authorization', 'Bearer valid-token');

        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.body.uid, 'user-123');
    });

    test('TC-2: Handling Revoked or Disabled Users', async () => {
        const mockAuthService = {
            verifyIdToken: async (token, checkRevoked) => {
                // Simulate Firebase error when user is revoked/disabled
                const error = new Error('The ID token has been revoked');
                error.code = 'auth/id-token-revoked';
                throw error;
            }
        };

        const testMiddleware = createAuthMiddleware(mockAuthService);
        const app = express();
        app.get('/test', testMiddleware, (req, res) => res.status(200).end());

        const response = await request(app)
            .get('/test')
            .set('Authorization', 'Bearer revoked-token');

        assert.strictEqual(response.status, 401);
        assert.match(response.body.error, /Unauthorized/);
    });

    test('TC-3: Rejecting Missing Authorization Header', async () => {
        const testMiddleware = createAuthMiddleware({});
        const app = express();
        app.get('/test', testMiddleware, (req, res) => res.status(200).end());

        const response = await request(app).get('/test');

        assert.strictEqual(response.status, 401);
        assert.match(response.body.error, /Missing or Malformed Bearer token/);
    });
});
