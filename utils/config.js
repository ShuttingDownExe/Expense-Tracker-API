require('dotenv').config()
const admin = require('firebase-admin')

const { PORT } = process.env
const { NODE_ENV } = process.env

const initDev = () => {
    const serviceAccount = require('../service-account.json')
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://expense-tracker-dev.asia-southeast1.firebasedatabase.app/'
    })
}

const initTest = () => {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        databaseURL: 'https://expense-tracker-uat.asia-southeast1.firebasedatabase.app/'
    })
}

const initProduction = () => {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        databaseURL: 'https://expense-tracker-prod.asia-southeast1.firebasedatabase.app/'
    })
}

if (NODE_ENV === 'dev') {
    console.log('Running in development mode')
    initDev()
} else if (NODE_ENV === 'test') {
    console.log('Running in test mode')
    initTest()
} else {
    console.log('Running in production mode')
    initProduction()
}

module.exports = { PORT, NODE_ENV, admin }