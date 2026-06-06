const assert = require('node:assert/strict')
const test = require('node:test')
const supertest = require('supertest')
const Module = require('node:module')
const path = require('node:path')

const appPath = path.join(__dirname, '..', 'app.js')
const configPath = path.join(__dirname, '..', 'utils', 'config.js')
const controllerPath = path.join(__dirname, '..', 'controller', 'expenses.js')

const buildFakeAdmin = () => {
    const store = {
        expenses: {},
    }
    let nextIndex = 1

    const createRef = (pathKey) => ({
        path: pathKey,
        once: async () => ({ val: () => store[pathKey] }),
        push: async (data) => {
            const key = `expense-${nextIndex++}`
            store[pathKey][key] = data
            return { key }
        },
        child: (id) => ({
            once: async () => ({ val: () => store[pathKey][id] || null }),
            remove: async () => { delete store[pathKey][id] },
        }),
    })

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
        database: () => ({ ref: createRef }),
    }
}

const withStubbedApp = async (env, fn) => {
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
    delete require.cache[controllerPath]

    try {
        const app = require(appPath)
        await fn(app, fakeAdmin)
    } finally {
        Module._load = originalLoad
        if (originalEnv === undefined) {
            delete process.env.NODE_ENV
        } else {
            process.env.NODE_ENV = originalEnv
        }
        delete require.cache[configPath]
        delete require.cache[appPath]
        delete require.cache[controllerPath]
    }
}

test('GET /api/expenses returns correct number of entries after pushing test entries', async () => {
    await withStubbedApp('test', async (app) => {
        const request = supertest(app)

        await request.post('/api/expenses').send({
            description: 'First expense',
            amount: 10,
            date: '2026-06-06',
            vendor: 'Vendor A',
            type: 'Debit',
        })
        await request.post('/api/expenses').send({
            description: 'Second expense',
            amount: 20,
            date: '2026-06-07',
            vendor: 'Vendor B',
            type: 'Credit',
        })

        const response = await request.get('/api/expenses')

        assert.equal(response.status, 200)
        assert.equal(Object.keys(response.body).length, 2)
    })
})

test('GET /api/expenses/:id returns the correct expense entry', async () => {
    await withStubbedApp('test', async (app) => {
        const request = supertest(app)
        const payload = {
            description: 'Single entry',
            amount: 15,
            date: '2026-06-08',
            vendor: 'Vendor C',
            type: 'Debit',
        }

        const postResponse = await request.post('/api/expenses').send(payload)
        assert.equal(postResponse.status, 201)

        const expenseId = postResponse.body.id
        const getResponse = await request.get(`/api/expenses/${expenseId}`)

        assert.equal(getResponse.status, 200)
        assert.deepEqual(getResponse.body, { id: expenseId, ...payload })
    })
})

test('DELETE /api/expenses/:id deletes a specific entry', async () => {
    await withStubbedApp('test', async (app) => {
        const request = supertest(app)
        const payload = {
            description: 'Delete me',
            amount: 30,
            date: '2026-06-09',
            vendor: 'Vendor D',
            type: 'Credit',
        }

        const postResponse = await request.post('/api/expenses').send(payload)
        assert.equal(postResponse.status, 201)

        const expenseId = postResponse.body.id
        const deleteResponse = await request.delete(`/api/expenses/${expenseId}`)

        assert.equal(deleteResponse.status, 204)

        const getResponse = await request.get(`/api/expenses/${expenseId}`)
        assert.equal(getResponse.status, 404)

        const listResponse = await request.get('/api/expenses')
        assert.equal(Object.keys(listResponse.body).length, 0)
    })
})
