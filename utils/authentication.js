/**
 * @param {import('firebase-admin').auth.Auth} authService
 */
const createAuthMiddleware = (authService) => {
    return async (req, res, next) => {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: Missing or Malformed Bearer token' })
        }

        const idToken = authHeader.split('Bearer ')[1];

        try {
            // Passing true as the second argument checks if the token has been revoked 
            // or if the user is disabled.
            const decodedToken = await authService.verifyIdToken(idToken, true)
            req.user = decodedToken
            next()
        } catch (error) {
            console.error('Error verifying ID token:', error)
            return res.status(401).json({ error: 'Unauthorized: Invalid or Expired token' })
        }
    }
}

module.exports = { createAuthMiddleware }
