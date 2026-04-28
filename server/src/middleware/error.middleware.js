// Central Express error handler — must be registered last
export function errorHandler(err, req, res, next) {
  // Log in development; in production use a proper logger
  if (process.env.NODE_ENV !== 'production') console.error(err);

  // Handle PostgreSQL unique-constraint violations as a fallback for race conditions
  if (err.code === '23505') {
    const detail = err.detail ?? '';
    const field = detail.includes('username') ? 'Username is already taken'
      : detail.includes('email') ? 'Email is already registered'
      : 'A unique constraint was violated';
    return res.status(409).json({ error: field });
  }

  const status = err.status ?? err.statusCode ?? 500;
  const message = status === 500 ? 'Internal server error' : err.message;
  res.status(status).json({ error: message });
}
