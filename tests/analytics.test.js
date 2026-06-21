const { test, describe } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const express = require('express');

const { createAuthMiddleware } = require('../utils/authentication');
// Real analytics logic — imported directly (no Firebase dependency), so these
// tests exercise the actual code used by controller/analytics.js.
const {
    getLocalDateString,
    sumExpenses,
    buildCurrentWeekBlueprint,
    aggregateExpensesByMap,
} = require('../utils/analytics');

// Local en-CA date string for a timezone, computed the same way the helper
// does — used as the expected value to avoid hard-coding "today".
const localDate = (tz) => new Date().toLocaleDateString('en-CA', { timeZone: tz });

describe('getLocalDateString (unit)', () => {
    test('TC-1: returns today in the requested timezone', () => {
        assert.strictEqual(getLocalDateString('Asia/Kolkata'), localDate('Asia/Kolkata'));
        assert.strictEqual(getLocalDateString('America/New_York'), localDate('America/New_York'));
    });

    test('TC-2: matches the YYYY-MM-DD format', () => {
        assert.match(getLocalDateString('Etc/UTC'), /^\d{4}-\d{2}-\d{2}$/);
    });

    test('TC-3: applies offsetDays (yesterday)', () => {
        const expected = new Date();
        expected.setDate(expected.getDate() - 1);
        const expectedStr = expected.toLocaleDateString('en-CA', { timeZone: 'Etc/UTC' });
        assert.strictEqual(getLocalDateString('Etc/UTC', 1), expectedStr);
    });

    test('TC-4: falls back to UTC for an invalid timezone (no throw)', () => {
        // Regression test for the previous bug where the fallback referenced an
        // undefined `timeZone` variable and threw a ReferenceError.
        let result;
        assert.doesNotThrow(() => { result = getLocalDateString('Not/AZone'); });
        assert.strictEqual(result, localDate('UTC'));
    });
});

describe('sumExpenses (unit)', () => {
    test('TC-5: sums numeric amounts', () => {
        assert.strictEqual(
            sumExpenses({ a: { amount: 100 }, b: { amount: 250.5 }, c: { amount: 49.5 } }),
            400
        );
    });

    test('TC-6: coerces string amounts', () => {
        assert.strictEqual(
            sumExpenses({ a: { amount: '100' }, b: { amount: 200 }, c: { amount: '50.25' } }),
            350.25
        );
    });

    test('TC-7: returns 0 for null/undefined/empty', () => {
        assert.strictEqual(sumExpenses(null), 0);
        assert.strictEqual(sumExpenses(undefined), 0);
        assert.strictEqual(sumExpenses({}), 0);
    });
});

describe('Analytics — GET /today (endpoint, mocked DB)', () => {
    // Thin rebuild of the /today route. Only the database is mocked; the date
    // and summing logic come from the real helpers above.
    const setupTestApp = (mockOnceResult, { dbError = false, spy = {} } = {},
        mockAuthUser = { uid: 'user-123' }) => {
        const app = express();
        app.use(express.json());

        const requireAuth = createAuthMiddleware({ verifyIdToken: async () => mockAuthUser });

        const mockDb = {
            ref: (path) => {
                spy.path = path;
                const chain = {
                    orderByChild: (field) => { spy.orderByChild = field; return chain; },
                    equalTo: (value) => { spy.equalTo = value; return chain; },
                    once: async () => {
                        if (dbError) throw new Error('Firebase connection lost');
                        return { val: () => mockOnceResult };
                    },
                };
                return chain;
            },
        };

        const router = express.Router();
        router.get('/today', requireAuth, async (req, res) => {
            const uid = req.user.uid;
            const clientTimezone = req.query.tz || 'Etc/UTC';
            const today = getLocalDateString(clientTimezone, 0);
            try {
                const snapshot = await mockDb.ref(`users/${uid}/expenses`)
                    .orderByChild('date')
                    .equalTo(today)
                    .once('value');
                res.status(200).json({
                    date: today,
                    timeZone: clientTimezone,
                    total: sumExpenses(snapshot.val()),
                });
            } catch (error) {
                res.status(500).json({ error: 'Failed to generate analytics' });
            }
        });

        app.use('/api/analytics', router);
        return app;
    };

    test("TC-8: sums today's expenses and returns date/timeZone/total", async () => {
        const app = setupTestApp({
            'exp-1': { amount: 100, date: '2026-06-20' },
            'exp-2': { amount: 250.5, date: '2026-06-20' },
            'exp-3': { amount: 49.5, date: '2026-06-20' },
        });

        const res = await request(app)
            .get('/api/analytics/today')
            .set('Authorization', 'Bearer mock-token');

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.total, 400);
        assert.strictEqual(res.body.timeZone, 'Etc/UTC');
        assert.strictEqual(res.body.date, localDate('Etc/UTC'));
    });

    test('TC-9: returns total 0 when there are no expenses today', async () => {
        const res = await request(setupTestApp(null))
            .get('/api/analytics/today')
            .set('Authorization', 'Bearer mock-token');

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.total, 0);
    });

    test("TC-10: queries the user's expenses filtered by today's date", async () => {
        const spy = {};
        await request(setupTestApp({}, { spy }))
            .get('/api/analytics/today?tz=Asia/Kolkata')
            .set('Authorization', 'Bearer mock-token');

        assert.strictEqual(spy.path, 'users/user-123/expenses');
        assert.strictEqual(spy.orderByChild, 'date');
        assert.strictEqual(spy.equalTo, localDate('Asia/Kolkata'));
    });

    test('TC-11: defaults to Etc/UTC when no tz param is supplied', async () => {
        const res = await request(setupTestApp({}))
            .get('/api/analytics/today')
            .set('Authorization', 'Bearer mock-token');

        assert.strictEqual(res.body.timeZone, 'Etc/UTC');
        assert.strictEqual(res.body.date, localDate('Etc/UTC'));
    });

    test('TC-12: honors the tz query param', async () => {
        const res = await request(setupTestApp({}))
            .get('/api/analytics/today?tz=America/New_York')
            .set('Authorization', 'Bearer mock-token');

        assert.strictEqual(res.body.timeZone, 'America/New_York');
        assert.strictEqual(res.body.date, localDate('America/New_York'));
    });

    test('TC-13: an invalid tz no longer breaks the request (UTC fallback)', async () => {
        const res = await request(setupTestApp({}))
            .get('/api/analytics/today?tz=Not/AZone')
            .set('Authorization', 'Bearer mock-token');

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.date, localDate('UTC'));
    });

    test('TC-14: rejects requests without an Authorization header (401)', async () => {
        const res = await request(setupTestApp({})).get('/api/analytics/today');

        assert.strictEqual(res.status, 401);
        assert.match(res.body.error, /Unauthorized/);
    });

    test('TC-15: returns 500 when the database read fails', async () => {
        const res = await request(setupTestApp(null, { dbError: true }))
            .get('/api/analytics/today')
            .set('Authorization', 'Bearer mock-token');

        assert.strictEqual(res.status, 500);
        assert.strictEqual(res.body.error, 'Failed to generate analytics');
    });
});

describe('buildCurrentWeekBlueprint (unit)', () => {
    // Returns the dates (sorted ascending) covered by the blueprint.
    const sortedDates = (dateMap) =>
        Object.keys(dateMap).sort((a, b) => a.localeCompare(b));

    test('TC-16: blueprint and dateMap describe the same set of days, all zeroed', () => {
        const { blueprint, dateMap } = buildCurrentWeekBlueprint('Asia/Kolkata');
        const dayCount = Object.keys(dateMap).length;

        // One entry per day from the start of the week through today.
        assert.strictEqual(Object.keys(blueprint).length, dayCount);
        // Indices are 0..N and every bucket starts at 0.
        for (let i = 0; i < dayCount; i++) {
            assert.strictEqual(blueprint[i], 0);
        }
    });

    test('TC-17: dateMap maps consecutive days to ascending indices ending today', () => {
        const tz = 'Asia/Kolkata';
        const { dateMap } = buildCurrentWeekBlueprint(tz);
        const dates = sortedDates(dateMap);

        // Earliest date → index 0, latest → highest index.
        dates.forEach((date, i) => assert.strictEqual(dateMap[date], i));

        // Latest date is today in that timezone.
        assert.strictEqual(dates[dates.length - 1], getLocalDateString(tz, 0));

        // Each date is exactly one day after the previous.
        for (let i = 1; i < dates.length; i++) {
            const prev = new Date(`${dates[i - 1]}T00:00:00Z`);
            const curr = new Date(`${dates[i]}T00:00:00Z`);
            assert.strictEqual(curr - prev, 24 * 60 * 60 * 1000);
        }
    });

    test('TC-18: startDate is the first day of the week (index 0)', () => {
        const tz = 'Asia/Kolkata';
        const { startDate, dateMap } = buildCurrentWeekBlueprint(tz);
        const dates = sortedDates(dateMap);

        assert.strictEqual(startDate, dates[0]);
        assert.strictEqual(dateMap[startDate], 0);
    });

    test('TC-19: falls back gracefully for an invalid timezone (no throw)', () => {
        assert.doesNotThrow(() => buildCurrentWeekBlueprint('Not/AZone'));
    });
});

describe('aggregateExpensesByMap (unit)', () => {
    // A fixed three-day week: Mon/Tue/Wed → indices 0/1/2.
    const dateMap = { '2026-06-15': 0, '2026-06-16': 1, '2026-06-17': 2 };
    const blueprint = { 0: 0, 1: 0, 2: 0 };

    test('TC-20: buckets amounts by day index', () => {
        const result = aggregateExpensesByMap(
            {
                a: { date: '2026-06-15', amount: 100 },
                b: { date: '2026-06-15', amount: 50 },
                c: { date: '2026-06-17', amount: 200 },
            },
            blueprint,
            dateMap
        );
        assert.deepStrictEqual(result, { 0: 150, 1: 0, 2: 200 });
    });

    test('TC-21: ignores expenses whose date is outside the week', () => {
        const result = aggregateExpensesByMap(
            { a: { date: '2026-06-15', amount: 100 }, b: { date: '2099-01-01', amount: 999 } },
            blueprint,
            dateMap
        );
        assert.deepStrictEqual(result, { 0: 100, 1: 0, 2: 0 });
    });

    test('TC-22: coerces string amounts and treats invalid ones as 0', () => {
        const result = aggregateExpensesByMap(
            {
                a: { date: '2026-06-16', amount: '75.5' },
                b: { date: '2026-06-16', amount: 'abc' },
            },
            blueprint,
            dateMap
        );
        assert.deepStrictEqual(result, { 0: 0, 1: 75.5, 2: 0 });
    });

    test('TC-23: returns a zeroed copy for null/undefined expenses', () => {
        assert.deepStrictEqual(
            aggregateExpensesByMap(null, blueprint, dateMap),
            { 0: 0, 1: 0, 2: 0 }
        );
    });

    test('TC-24: does not mutate the input blueprint', () => {
        const fresh = { 0: 0, 1: 0, 2: 0 };
        aggregateExpensesByMap({ a: { date: '2026-06-15', amount: 100 } }, fresh, dateMap);
        assert.deepStrictEqual(fresh, { 0: 0, 1: 0, 2: 0 });
    });
});

describe('Analytics — GET /weekly (endpoint, mocked DB)', () => {
    // Mirrors the /weekly route; only the DB is mocked, the date/aggregation
    // logic is the real code.
    const setupTestApp = (mockOnceResult, { dbError = false, spy = {} } = {},
        mockAuthUser = { uid: 'user-123' }) => {
        const app = express();
        app.use(express.json());

        const requireAuth = createAuthMiddleware({ verifyIdToken: async () => mockAuthUser });

        const mockDb = {
            ref: (path) => {
                spy.path = path;
                const chain = {
                    orderByChild: (f) => { spy.orderByChild = f; return chain; },
                    startAt: (v) => { spy.startAt = v; return chain; },
                    endAt: (v) => { spy.endAt = v; return chain; },
                    once: async () => {
                        if (dbError) throw new Error('Firebase connection lost');
                        return { val: () => mockOnceResult };
                    },
                };
                return chain;
            },
        };

        const router = express.Router();
        router.get('/weekly', requireAuth, async (req, res) => {
            const uid = req.user.uid;
            const timeZone = req.query.tz || 'Etc/UTC';
            const { blueprint, dateMap, startDate } = buildCurrentWeekBlueprint(timeZone);
            try {
                const snapshot = await mockDb.ref(`users/${uid}/expenses`)
                    .orderByChild('date')
                    .startAt(startDate)
                    .endAt(getLocalDateString(timeZone, 0))
                    .once('value');
                res.status(200).json(aggregateExpensesByMap(snapshot.val(), blueprint, dateMap));
            } catch (error) {
                res.status(500).json({ error: "Failed to get this week's stats" });
            }
        });

        app.use('/api/analytics', router);
        return app;
    };

    test("TC-25: returns 200 with this week's totals keyed by day index", async () => {
        const tz = 'Asia/Kolkata';
        const today = getLocalDateString(tz, 0);
        const res = await request(setupTestApp({ a: { date: today, amount: 300 } }))
            .get(`/api/analytics/weekly?tz=${encodeURIComponent(tz)}`)
            .set('Authorization', 'Bearer mock-token');

        assert.strictEqual(res.status, 200);
        // Today is the last bucket; its total should be 300.
        const lastIndex = Object.keys(res.body).length - 1;
        assert.strictEqual(res.body[lastIndex], 300);
    });

    test('TC-26: queries by date bounded to the current week', async () => {
        const tz = 'Asia/Kolkata';
        const spy = {};
        await request(setupTestApp({}, { spy }))
            .get(`/api/analytics/weekly?tz=${encodeURIComponent(tz)}`)
            .set('Authorization', 'Bearer mock-token');

        assert.strictEqual(spy.path, 'users/user-123/expenses');
        assert.strictEqual(spy.orderByChild, 'date');
        assert.strictEqual(spy.startAt, getLocalDateString(tz, new Date(getLocalDateString(tz, 0)).getDay()));
        assert.strictEqual(spy.endAt, getLocalDateString(tz, 0));
    });

    test('TC-27: rejects requests without an Authorization header (401)', async () => {
        const res = await request(setupTestApp({})).get('/api/analytics/weekly');
        assert.strictEqual(res.status, 401);
        assert.match(res.body.error, /Unauthorized/);
    });

    test('TC-28: returns 500 when the database read fails', async () => {
        const res = await request(setupTestApp(null, { dbError: true }))
            .get('/api/analytics/weekly')
            .set('Authorization', 'Bearer mock-token');
        assert.strictEqual(res.status, 500);
        assert.match(res.body.error, /Failed to get this week's stats/);
    });
});

describe('Analytics — pending endpoints', () => {
    test('GET /monthly', { skip: 'Not yet implemented in controller/analytics.js' }, () => {});
});
