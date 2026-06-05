require('dotenv').config()
const admin = require('firebase-admin')

const { PORT } = process.env
const {NODE_ENV} = process.env

const initDev = () => {
    // Workaround for "unable to get local issuer certificate" in some dev environments
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    
    const serviceAccount = require('../service-account.json')
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://expense-tracker-a9ebd-default-rtdb.asia-southeast1.firebasedatabase.app/'
    })
}

if (NODE_ENV === 'dev') {
    console.log('Running in development mode')
    initDev()
} else {
    console.log('Running in production mode')
}

module.exports = { PORT, NODE_ENV, admin }