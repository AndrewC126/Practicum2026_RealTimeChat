/**
 * LoginForm — User Login UI
 *
 * A controlled form that collects email and password, calls useAuth().login(),
 * and navigates to "/" on success.
 *
 * Controlled vs. uncontrolled forms in React:
 *   A "controlled" form stores each field's value in component state (useState)
 *   and passes it back to the input via the `value` prop. React becomes the
 *   single source of truth for the input's content.
 *     const [email, setEmail] = useState('');
 *     <input value={email} onChange={e => setEmail(e.target.value)} />
 *
 * Error handling:
 *   - Local state: const [error, setError] = useState(null)
 *   - Wrap the login call in try/catch; on failure set the error message
 *   - Display the error to the user above the submit button
 *   - Clear the error when the user starts typing again
 *
 * Loading state:
 *   - Local state: const [loading, setLoading] = useState(false)
 *   - Set to true before the API call, false in the finally block
 *   - Disable the submit button while loading to prevent double-submits
 *
 * Navigation after login:
 *   - import { useNavigate } from 'react-router-dom'
 *   - const navigate = useNavigate()
 *   - After successful login: navigate('/')
 *
 * Implementation checklist:
 *   - useState for email, password, error, loading
 *   - useAuth() for the login function
 *   - useNavigate() for post-login redirect
 *   - <form onSubmit={handleSubmit}>
 *       <input type="email" ... />
 *       <input type="password" ... />
 *       {error && <p>{error}</p>}
 *       <button type="submit" disabled={loading}>Log in</button>
 *     </form>
 *   - Link to /register for new users
 */
export default function LoginForm() {}
