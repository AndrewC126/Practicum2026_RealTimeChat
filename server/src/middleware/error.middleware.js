/**
 * errorHandler — Central Express Error Handling Middleware
 *
 * Express identifies an error handler by its four-parameter signature: (err, req, res, next).
 * It must be registered LAST in app.js, after all routes, or it won't catch anything.
 *
 * How errors reach here:
 *   - Call next(err) from any middleware or route handler
 *   - Throw inside an async handler wrapped with a try/catch that calls next(err)
 *   - Unhandled promise rejections (if you add a global handler)
 *
 * Implementation:
 *   export function errorHandler(err, req, res, next) {
 *     console.error(err);
 *
 *     const status  = err.status  ?? err.statusCode ?? 500;
 *     const message = err.message ?? 'Internal server error';
 *
 *     res.status(status).json({ error: message });
 *   }
 *
 * Custom error classes:
 *   Create subclasses with a `status` property so controllers can throw
 *   typed errors instead of manually calling res.status() every time:
 *     class NotFoundError extends Error {
 *       constructor(msg) { super(msg); this.status = 404; }
 *     }
 *     throw new NotFoundError('Room not found');
 *   This propagates through next(err) and the handler above returns a 404.
 *
 * Important: In production, don't expose raw error messages (they may
 * contain stack traces or database details). Only return a safe message.
 */

// Central Express error handler — must be registered last
export function errorHandler(err, req, res, next) {}
