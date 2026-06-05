const app = require('./app')
const {PORT, NODE_ENV} = require('./utils/config')

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT} in ${NODE_ENV} mode`)
})