/**
 * RegisterForm — User Registration UI (US-101)
 *
 * Acceptance criteria covered:
 *   ✓ Fields: username, email, password
 *   ✓ All fields required — inline error on empty submit
 *   ✓ Email format validated client-side and mapped from server errors
 *   ✓ Password minimum 8 characters
 *   ✓ Duplicate username/email shows a field-level error from the server
 *   ✓ Success redirects to "/" and logs in automatically (token stored by useAuth)
 *   ✓ Clearing a field's error as soon as the user starts typing again
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function validate(fields) {
  const errors = {};

  if (!fields.username.trim()) {
    errors.username = 'Username is required';
  }

  if (!fields.email.trim()) {
    errors.email = 'Email is required';
  } else if (!EMAIL_RE.test(fields.email)) {
    errors.email = 'Enter a valid email address';
  }

  if (!fields.password) {
    errors.password = 'Password is required';
  } else if (fields.password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }

  return errors;
}

export default function RegisterForm() {
  const [fields, setFields]       = useState({ username: '', email: '', password: '' });
  const [errors, setErrors]       = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading]     = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  function handleChange(e) {
    const { name, value } = e.target;
    setFields(prev => ({ ...prev, [name]: value }));
    // Clear the inline error for this field as soon as the user edits it
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    if (serverError)  setServerError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const validationErrors = validate(fields);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setServerError('');
    setLoading(true);

    try {
      await register(fields.username.trim(), fields.email.trim(), fields.password);
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.error ?? 'Registration failed. Please try again.';

      // Map server duplicate-key errors back to the relevant field
      if (msg.toLowerCase().includes('username')) {
        setErrors(prev => ({ ...prev, username: msg }));
      } else if (msg.toLowerCase().includes('email')) {
        setErrors(prev => ({ ...prev, email: msg }));
      } else {
        setServerError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <form onSubmit={handleSubmit} style={styles.card} noValidate>
        <h1 style={styles.heading}>Create an account</h1>

        {serverError && (
          <p role="alert" style={styles.alert}>{serverError}</p>
        )}

        <Field
          id="username"
          label="Username"
          type="text"
          name="username"
          value={fields.username}
          onChange={handleChange}
          error={errors.username}
          autoComplete="username"
        />

        <Field
          id="email"
          label="Email"
          type="email"
          name="email"
          value={fields.email}
          onChange={handleChange}
          error={errors.email}
          autoComplete="email"
        />

        <Field
          id="password"
          label="Password"
          type="password"
          name="password"
          value={fields.password}
          onChange={handleChange}
          error={errors.password}
          autoComplete="new-password"
        />

        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? 'Creating account…' : 'Sign up'}
        </button>

        <p style={styles.footer}>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}

// Small helper so each field label+input+error doesn't repeat the same markup
function Field({ id, label, type, name, value, onChange, error, autoComplete }) {
  return (
    <div style={styles.fieldGroup}>
      <label htmlFor={id} style={styles.label}>{label}</label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={!!error}
        style={{ ...styles.input, ...(error ? styles.inputInvalid : {}) }}
      />
      {error && (
        <span id={`${id}-error`} role="alert" style={styles.fieldError}>
          {error}
        </span>
      )}
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
    outline: 'none',
  },
  inputInvalid: {
    borderColor: '#c62828',
  },
  fieldError: {
    color: '#c62828',
    fontSize: '0.8rem',
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
