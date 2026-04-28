// bcrypt hashing, JWT signing/verification
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as usersRepo from '../repositories/users.repository.js';

export async function registerUser({ username, email, password }) {
  // Check uniqueness before inserting so the error message is specific.
  // The DB UNIQUE constraints are a safety net for race conditions.
  const existingEmail = await usersRepo.findByEmail(email);
  if (existingEmail) {
    const err = new Error('Email is already registered');
    err.status = 409;
    throw err;
  }

  const existingUsername = await usersRepo.findByUsername(username);
  if (existingUsername) {
    const err = new Error('Username is already taken');
    err.status = 409;
    throw err;
  }

  // Cost factor 12: slow enough to resist brute-force, fast enough for a web request
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await usersRepo.createUser({ username, email, passwordHash });

  const token = jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return { user, token };
}

export async function loginUser({ email, password }) {
  const user = await usersRepo.findByEmail(email);

  // Use the same generic message whether the email doesn't exist or the
  // password is wrong — revealing which field is incorrect would let an
  // attacker enumerate valid email addresses (AC: US-102).
  if (!user) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  const token = jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  // Never return password_hash — strip it before sending to the client
  const { password_hash, ...safeUser } = user;
  return { user: safeUser, token };
}
