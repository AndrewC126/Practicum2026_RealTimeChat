/**
 * Auth Controller — HTTP Request Handlers for Authentication
 *
 * Controllers are the bridge between routes and services. They:
 *   1. Parse the request (body, params, query, user from req.user)
 *   2. Call the service layer (which contains business logic)
 *   3. Send the HTTP response
 *   4. Pass errors to next(err) for the error handler
 *
 * They do NOT contain business logic (that's in the service) or SQL
 * (that's in the repository). This layered architecture makes each layer
 * independently testable and replaceable.
 *
 * register(req, res, next):
 *   - Read { username, email, password } from req.body
 *   - Basic validation (presence check — deeper validation is in the service)
 *   - Call authService.registerUser({ username, email, password })
 *   - Respond with 201 and { user, token }
 *   - On error: call next(err)
 *
 * login(req, res, next):
 *   - Read { email, password } from req.body
 *   - Call authService.loginUser({ email, password })
 *   - Respond with 200 and { user, token }
 *   - On error: call next(err)
 *     (loginUser throws a 401 error if credentials are wrong)
 *
 * Async controller pattern:
 *   Express does not automatically catch thrown errors from async functions.
 *   Wrap each handler in try/catch and call next(err):
 *     export async function register(req, res, next) {
 *       try { ... } catch (err) { next(err); }
 *     }
 *   OR install the `express-async-errors` package which patches Express
 *   to catch async errors automatically.
 */
export async function register(req, res, next) {}
export async function login(req, res, next) {}
