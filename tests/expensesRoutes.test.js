const assert = require('node:assert/strict')
const test = require('node:test')
const supertest = require('supertest')
const Module = require('node:module')
const path = require('node:path')

const configPath = path.join(__dirname, '..', 'utils', 'config.js')
const appPath = path.join(__dirname, '..', 'app.js')

const buildFakeAdmin = () => {
    const fakeDb = {
        ref: (path) => {
            const ref = {
                path,
                once: async () => ({ val: () => ({}) }),
                push: async (data) => ({ key: 'fake-id', ...data }),
                child: (id) => ({
                    once: async () => ({ val: () => null }),
                    remove: async () => undefined,
                }),
            }
            return ref
        },
    }

    return {
        initializeAppCalls: [],
        credential: {
            cert: () => ({ type: 'cert' }),
            applicationDefault: () => ({ type: 'applicationDefault' }),
        },
        initializeApp: function (options) {
            this.initializeAppCalls.push(options)
            return { name: 'fake-app', options }
        },
        database: () => fakeDb,
    }
}

const withStubbedFirebaseAdmin = async (env, fn) => {
    const fakeAdmin = buildFakeAdmin()
    const originalEnv = process.env.NODE_ENV
    const originalLoad = Module._load

    Module._load = function (request, parent, isMain) {
        if (request === 'firebase-admin') {
            return fakeAdmin
        }

        if (request === '../service-account.json' && parent && parent.filename === configPath) {
            return { project_id: 'dummy' }
        }

        return originalLoad.apply(this, arguments)
    }

    if (env === undefined) {
        delete process.env.NODE_ENV
    } else {
        process.env.NODE_ENV = env
    }

    delete require.cache[configPath]
    delete require.cache[appPath]

    try {
        const app = require(appPath)
        return await fn(app, fakeAdmin)
    } finally {
        Module._load = originalLoad
        if (originalEnv === undefined) {
            delete process.env.NODE_ENV
        } else {
            process.env.NODE_ENV = originalEnv
        }
        delete require.cache[configPath]
        delete require.cache[appPath]
    }
}

test('POST /api/expenses returns 400 for invalid payload', async () => {
    await withStubbedFirebaseAdmin('test', async (app) => {
        const request = supertest(app)

        const response = await request.post('/api/expenses').send({ amount: -5 })

        assert.equal(response.status, 400)
        assert.equal(response.body.error, 'Validation failed')
        assert.ok(Array.isArray(response.body.errors))
        assert.ok(response.body.errors.some((err) => err.field === 'description'))
    })
})

test('POST /api/expenses returns 201 for valid payload', async () => {
    await withStubbedFirebaseAdmin('test', async (app) => {
        const request = supertest(app)

        const payload = {
            description: 'Test expense',
            amount: 25.5,
            date: '2026-06-06',
            vendor: 'Test vendor',
            type: 'Debit',
        }

        const response = await request.post('/api/expenses').send(payload)

        assert.equal(response.status, 201)
        assert.equal(response.body.id, 'fake-id')
        assert.equal(response.body.description, payload.description)
        assert.equal(response.body.amount, payload.amount)
        assert.equal(response.body.vendor, payload.vendor)
        assert.equal(response.body.type, payload.type)
    })
})

test('GET /api/expenses returns expenses list', async () => {
    await withStubbedFirebaseAdmin('test', async (app) => {
        const request = supertest(app)

        const response = await request.get('/api/expenses')

        assert.equal(response.status, 200)
        assert.deepEqual(response.body, {})
    })
})
