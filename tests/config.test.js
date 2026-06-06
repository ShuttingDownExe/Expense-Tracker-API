const assert = require('node:assert/strict')
const test = require('node:test')
const Module = require('node:module')
const path = require('node:path')

const configPath = path.join(__dirname, '..', 'utils', 'config.js')

const buildFakeAdmin = () => {
    return {
        initializeAppCalls: [],
        credential: {
            cert: (serviceAccount) => ({ type: 'cert', serviceAccount }),
            applicationDefault: () => ({ type: 'applicationDefault' }),
        },
        initializeApp: function (options) {
            this.initializeAppCalls.push(options)
            return { name: 'fake-app', options }
        },
    }
}

const withStubbedFirebaseAdmin = (env, fn) => {
    const fakeAdmin = buildFakeAdmin()
    const originalEnv = process.env.NODE_ENV
    const originalLoad = Module._load

    delete require.cache[configPath]

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

    let config
    try {
        config = require(configPath)
    } finally {
        Module._load = originalLoad
        delete require.cache[configPath]
        if (originalEnv === undefined) {
            delete process.env.NODE_ENV
        } else {
            process.env.NODE_ENV = originalEnv
        }
    }

    return fn(config, fakeAdmin)
}

test('config initializes dev Firebase app when NODE_ENV=dev', (t) => {
    withStubbedFirebaseAdmin('dev', (config, fakeAdmin) => {
        assert.equal(config.NODE_ENV, 'dev')
        assert.equal(fakeAdmin.initializeAppCalls.length, 1)
        assert.equal(fakeAdmin.initializeAppCalls[0].databaseURL, 'https://expense-tracker-dev.asia-southeast1.firebasedatabase.app/')
        assert.equal(fakeAdmin.initializeAppCalls[0].credential.type, 'cert')
    })
})

test('config initializes test Firebase app when NODE_ENV=test', (t) => {
    withStubbedFirebaseAdmin('test', (config, fakeAdmin) => {
        assert.equal(config.NODE_ENV, 'test')
        assert.equal(fakeAdmin.initializeAppCalls.length, 1)
        assert.equal(fakeAdmin.initializeAppCalls[0].databaseURL, 'https://expense-tracker-uat.asia-southeast1.firebasedatabase.app/')
        assert.equal(fakeAdmin.initializeAppCalls[0].credential.type, 'cert')
    })
})

test('config initializes production Firebase app when NODE_ENV is missing', (t) => {
    withStubbedFirebaseAdmin(undefined, (config, fakeAdmin) => {
        assert.equal(config.NODE_ENV, undefined)
        assert.equal(fakeAdmin.initializeAppCalls.length, 1)
        assert.equal(fakeAdmin.initializeAppCalls[0].databaseURL, 'https://expense-tracker-prod.asia-southeast1.firebasedatabase.app/')
        assert.equal(fakeAdmin.initializeAppCalls[0].credential.type, 'applicationDefault')
    })
})

test('config initializes production Firebase app when NODE_ENV=production', (t) => {
    withStubbedFirebaseAdmin('production', (config, fakeAdmin) => {
        assert.equal(config.NODE_ENV, 'production')
        assert.equal(fakeAdmin.initializeAppCalls.length, 1)
        assert.equal(fakeAdmin.initializeAppCalls[0].databaseURL, 'https://expense-tracker-prod.asia-southeast1.firebasedatabase.app/')
        assert.equal(fakeAdmin.initializeAppCalls[0].credential.type, 'applicationDefault')
    })
})
