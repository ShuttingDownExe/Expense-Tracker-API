const assert = require('node:assert/strict')
const test = require('node:test')
const Module = require('node:module')
const path = require('node:path')

const configPath = path.join(__dirname, '..', 'utils', 'config.js')

const buildFakeAdmin = () => {
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

    try {
        const config = require(configPath)
        await fn(config, fakeAdmin)
    } finally {
        Module._load = originalLoad
        if (originalEnv === undefined) {
            delete process.env.NODE_ENV
        } else {
            process.env.NODE_ENV = originalEnv
        }
        delete require.cache[configPath]
    }
}

test('config initializes dev Firebase app when NODE_ENV=dev', async () => {
    await withStubbedFirebaseAdmin('dev', async (config, fakeAdmin) => {
        assert.equal(config.NODE_ENV, 'dev')
        assert.equal(fakeAdmin.initializeAppCalls.length, 1)
        assert.equal(fakeAdmin.initializeAppCalls[0].databaseURL, 'https://expense-tracker-dev.asia-southeast1.firebasedatabase.app/')
        assert.equal(fakeAdmin.initializeAppCalls[0].credential.type, 'cert')
    })
})

test('config initializes uat Firebase app when NODE_ENV=test', async () => {
    await withStubbedFirebaseAdmin('test', async (config, fakeAdmin) => {
        assert.equal(config.NODE_ENV, 'test')
        assert.equal(fakeAdmin.initializeAppCalls.length, 1)
        assert.equal(fakeAdmin.initializeAppCalls[0].databaseURL, 'https://expense-tracker-uat.asia-southeast1.firebasedatabase.app/')
        assert.equal(fakeAdmin.initializeAppCalls[0].credential.type, 'cert')
    })
})

test('config initializes prod Firebase app when NODE_ENV=production', async () => {
    await withStubbedFirebaseAdmin('production', async (config, fakeAdmin) => {
        assert.equal(config.NODE_ENV, 'production')
        assert.equal(fakeAdmin.initializeAppCalls.length, 1)
        assert.equal(fakeAdmin.initializeAppCalls[0].databaseURL, 'https://expense-tracker-prod.asia-southeast1.firebasedatabase.app/')
        assert.equal(fakeAdmin.initializeAppCalls[0].credential.type, 'applicationDefault')
    })
})
