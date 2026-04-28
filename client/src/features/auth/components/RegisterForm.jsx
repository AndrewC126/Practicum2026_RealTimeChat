/**
 * RegisterForm — New User Registration UI
 *
 * Mirrors LoginForm but adds a username field and calls useAuth().register().
 * After successful registration the server should auto-log the user in
 * (return a token), so you can dispatch setCredentials and navigate to "/".
 *
 * Additional validation to consider (client-side, before the API call):
 *   - Username: 3–50 characters (matches the DB CHECK constraint)
 *   - Email: basic format check
 *   - Password: minimum length (e.g., 8 characters)
 *   - Confirm password field: must match password
 *
 * Why validate client-side if the server also validates?
 *   Client validation gives instant feedback without a round trip. Server
 *   validation is the safety net — never trust the client alone. Both are needed.
 *
 * Implementation checklist:
 *   - useState for username, email, password, confirmPassword, error, loading
 *   - Validate fields on submit before calling register()
 *   - Same error/loading/navigate pattern as LoginForm
 *   - Link to /login for existing users
 */
export default function RegisterForm() {}
