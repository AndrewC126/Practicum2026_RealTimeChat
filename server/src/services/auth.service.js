/**
 * Auth Service — Business Logic for Authentication
 *
 * Services contain the "what" of the application: rules, validations, and
 * orchestration of repository calls. They are framework-agnostic — no req/res,
 * no SQL. This makes them easy to unit-test.
 *
 * registerUser(data):
 *   data: { username, email, password }
 *   1. Call usersRepository.findByEmail(email) — throw a 409 Conflict error
 *      if the email already exists.
 *   2. Hash the password:
 *        const hash = await bcrypt.hash(password, 12);
 *        The second argument (12) is the "cost factor" — higher is slower but
 *        more secure against brute-force attacks. 10–12 is typical for web apps.
 *   3. Call usersRepository.createUser({ username, email, passwordHash: hash })
 *   4. Sign a JWT:
 *        const token = jwt.sign(
 *          { id: user.id, username: user.username },
 *          process.env.JWT_SECRET,
 *          { expiresIn: '7d' }
 *        );
 *   5. Return { user: { id, username, email }, token }
 *      Never return the password_hash in the user object.
 *
 * loginUser(data):
 *   data: { email, password }
 *   1. Call usersRepository.findByEmail(email) — throw 401 if not found
 *      (use the same generic message for not-found and wrong-password to
 *       prevent email enumeration attacks: "Invalid email or password")
 *   2. Compare the password: await bcrypt.compare(password, user.password_hash)
 *      Returns true if it matches the stored hash.
 *   3. If mismatch: throw a 401 error
 *   4. Sign and return a JWT the same way as registerUser
 */

// bcrypt hashing, JWT signing/verification
export async function registerUser(data) {}
export async function loginUser(data) {}
