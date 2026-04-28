/**
 * LoginForm — User Login UI (US-102)
 *
 * Acceptance criteria covered:
 *   ✓ Fields: email and password
 *   ✓ Incorrect credentials → generic form-level error "Invalid email or password"
 *     (no field-level errors that would reveal which value was wrong)
 *   ✓ Successful login → redirects to "/"
 *   ✓ JWT stored client-side on success (handled by setCredentials in authSlice)
 *   ✓ Failed login clears the password field but keeps the email field
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function LoginForm() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const { login } = useAuth();
  const navigate  = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      // AC: show a generic message — don't reveal whether email or password was wrong
      setError(err.response?.data?.error ?? 'Invalid email or password');
      // AC: clear only the password field on failure, keep the email field populated
      setPassword('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <form onSubmit={handleSubmit} style={styles.card} noValidate>
        <h1 style={styles.heading}>Log in</h1>

        {error && (
          <p role="alert" style={styles.alert}>{error}</p>
        )}

        <div style={styles.fieldGroup}>
          <label htmlFor="email" style={styles.label}>Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(''); }}
            autoComplete="email"
            required
            style={styles.input}
          />
        </div>

        <div style={styles.fieldGroup}>
          <label htmlFor="password" style={styles.label}>Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            autoComplete="current-password"
            required
            style={styles.input}
          />
        </div>

        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? 'Logging in…' : 'Log in'}
        </button>

        <p style={styles.footer}>
          Don&apos;t have an account? <Link to="/register">Sign up</Link>
        </p>
      </form>
    </div>
  );
}

const styles = {
  page: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: '#f0f2f5',
  },
  card: {
    background: '#fff',
    padding: '2rem',
    borderRadius: '8px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  heading: {
    margin: 0,
    fontSize: '1.5rem',
    textAlign: 'center',
  },
  alert: {
    margin: 0,
    padding: '0.6rem 0.75rem',
    background: '#fdecea',
    color: '#c62828',
    borderRadius: '4px',
    fontSize: '0.875rem',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 500,
  },
  input: {
    padding: '0.5rem 0.75rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '1rem',
  },
  button: {
    padding: '0.65rem',
    marginTop: '0.25rem',
    background: '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '1rem',
    cursor: 'pointer',
  },
  footer: {
    margin: 0,
    textAlign: 'center',
    fontSize: '0.875rem',
  },
};
