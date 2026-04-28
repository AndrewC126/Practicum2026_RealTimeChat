import * as authService from '../services/auth.service.js';

export async function register(req, res, next) {
  try {
    const { username, email, password } = req.body;

    // Basic presence check — the service validates business rules
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email, and password are required' });
    }

    const result = await authService.registerUser({ username, email, password });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const result = await authService.loginUser({ email, password });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
