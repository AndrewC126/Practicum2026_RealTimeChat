1. Authentication

US-101 — Register an account

As a new user, I want to create an account so that I can access the chat app.

Acceptance Criteria:

Registration form includes fields for username, email, and password
All fields are required; submitting with any empty field shows an inline error
Username must be unique; duplicate usernames show an error message
Email must be valid format; invalid format shows an error message
Password must be at least 8 characters
Successful registration redirects the user to the main chat page and logs them in automatically
Password is stored hashed (bcrypt), never in plain text


US-102 — Log in

As a returning user, I want to log in so that I can access my account and chat history.

Acceptance Criteria:

Login form includes fields for email and password
Submitting with incorrect credentials shows a generic error ("Invalid email or password") without revealing which field is wrong
Successful login redirects the user to the main chat page
A session token or JWT is issued and stored client-side on success
Failed login does not clear the email field, only the password field


US-103 — Log out

As a logged-in user, I want to log out so that my account is secured when I'm done.

Acceptance Criteria:

A logout button is visible and accessible from any page while logged in
Clicking logout clears the session/token and redirects the user to the login page
After logout, navigating back via the browser does not grant access to protected pages