const { admin } = require('../utils/config');
const { createAuthMiddleware } = require('../utils/authentication');

// Standard live middleware
const requireAuth = createAuthMiddleware(admin.auth());

module.exports = { requireAuth, createAuthMiddleware };
