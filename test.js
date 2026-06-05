const admin = require('firebase-admin')

const serviceAccount = require('./service-account.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://expense-tracker-a9ebd-default-rtdb.asia-southeast1.firebasedatabase.app/'
})

