# RealTimeChat

A full-stack real-time chat application built for the Spring 2026 CS Practicum. Users can register, create and join public chat rooms, exchange messages instantly, and see unread message counts per room.

## Table of Contents

- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [1. Clone the repository](#1-clone-the-repository)
  - [2. Create the database](#2-create-the-database)
  - [3. Configure the server](#3-configure-the-server)
  - [4. Install dependencies](#4-install-dependencies)
  - [5. Start the servers](#5-start-the-servers)
- [Using the Application](#using-the-application)
  - [Register an account](#register-an-account)
  - [Log in](#log-in)
  - [Create a room](#create-a-room)
  - [Join a room and chat](#join-a-room-and-chat)
  - [Load older messages](#load-older-messages)
  - [Unread message badges](#unread-message-badges)
  - [Leave a room](#leave-a-room)
  - [Log out](#log-out)
  - [Mobile layout](#mobile-layout)
- [Data Model](#data-model)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Redux Toolkit, React Query v5, React Router v6 |
| Real-time | Socket.io (client + server) |
| HTTP client | Axios |
| Build tool | Vite |
| Backend | Node.js, Express 4 |
| Database | PostgreSQL |
| Auth | JWT (JSON Web Tokens), bcrypt |

---

## Prerequisites

Make sure the following are installed before you begin:

- **Node.js** v18 or later — [nodejs.org](https://nodejs.org)
- **npm** v9 or later (bundled with Node.js)
- **PostgreSQL** v14 or later — [postgresql.org](https://www.postgresql.org)

To verify your versions:
```bash
node --version
npm --version
psql --version
```

---

## Project Structure

```
Practicum2026_RealTimeChat/
├── db/
│   └── schema.sql          # Full PostgreSQL schema — run once to set up tables
├── server/
│   ├── src/
│   │   ├── app.js          # Express + Socket.io entry point
│   │   ├── routes/         # REST API route definitions
│   │   ├── controllers/    # Request handlers
│   │   ├── services/       # Business logic
│   │   ├── repositories/   # All SQL queries
│   │   ├── socket/         # Socket.io middleware and event handlers
│   │   └── db/             # PostgreSQL connection pool
│   ├── .env.example        # Template for required environment variables
│   └── package.json
├── client/
│   ├── src/
│   │   ├── main.jsx        # React entry point
│   │   ├── App.jsx         # Routes and auth guard
│   │   ├── features/       # Feature modules (auth, rooms, chat)
│   │   ├── shared/         # Reusable components and hooks
│   │   └── store/          # Redux store
│   ├── vite.config.js      # Vite dev server + API proxy config
│   └── package.json
└── README.md
```

---

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd Practicum2026_RealTimeChat
```

### 2. Create the database

Start a PostgreSQL session and create the database and user. You can use either `psql` in your terminal or a GUI tool like pgAdmin.

**Using psql:**

```sql
-- Connect as the postgres superuser
psql -U postgres

-- Create a database for the app
CREATE DATABASE chat;

-- Create a dedicated user (replace 'yourpassword' with a password you choose)
CREATE USER chatuser WITH PASSWORD 'yourpassword';

-- Grant the user full access to the database
GRANT ALL PRIVILEGES ON DATABASE chat TO chatuser;

-- Exit psql
\q
```

**Run the schema to create all tables:**

```bash
psql -U chatuser -d chat -f db/schema.sql
```

This creates the `users`, `rooms`, `room_members`, `messages`, `sessions`, and `contacts` tables along with indexes and helper views. The schema is safe to run on a fresh database — it uses `CREATE TABLE` (not `CREATE TABLE IF NOT EXISTS`), so run it only once.

### 3. Configure the server

Copy the example environment file and fill in your values:

```bash
cd server
```

**Git Bash / macOS / Linux:**
```bash
cp .env.example .env
```

**Windows Command Prompt:**
```cmd
copy .env.example .env
```

**Windows PowerShell:**
```powershell
Copy-Item .env.example .env
```

Open `server/.env` and update the values:

```env
PORT=3001
DATABASE_URL=postgresql://chatuser:yourpassword@localhost:5432/chat
JWT_SECRET=replace_this_with_a_long_random_string
CLIENT_URL=http://localhost:5173
```

| Variable | Description |
|---|---|
| `PORT` | Port the Express server listens on. `3001` is the default. |
| `DATABASE_URL` | PostgreSQL connection string. Format: `postgresql://user:password@host:port/dbname` |
| `JWT_SECRET` | Secret key used to sign and verify JSON Web Tokens. Use a long random string in production. |
| `CLIENT_URL` | URL of the frontend dev server. Used for CORS and Socket.io allowed origins. |

> **Tip:** To generate a strong JWT secret, run:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

### 4. Install dependencies

Install packages for both the server and the client. Run these from the project root:

```bash
# Server dependencies
cd server
npm install

# Client dependencies
cd ../client
npm install
```

### 5. Start the servers

You need **two terminal windows** — one for the server and one for the client.

**Terminal 1 — Server:**
```bash
cd server
npm run dev
```
You should see:
```
Server listening on http://localhost:3001
```

**Terminal 2 — Client:**
```bash
cd client
npm run dev
```
You should see:
```
  VITE v5.x.x  ready in Xms

  ➜  Local:   http://localhost:5173/
```

Open your browser and go to **http://localhost:5173**.

> The Vite dev server automatically proxies all `/api` requests to `http://localhost:3001`, so the frontend and backend communicate without any CORS issues during development.

---

## Using the Application

### Register an account

1. On first visit you are redirected to the **Register** page.
2. Fill in:
   - **Username** — 3 to 50 characters, must be unique across all users.
   - **Email** — must be a valid email address, must be unique.
   - **Password** — any length; stored as a bcrypt hash, never in plain text.
3. Click **Register**. You are logged in automatically and redirected to the main chat screen.

### Log in

1. Go to `/login` (or click the link on the register page).
2. Enter your **email** and **password**.
3. Click **Log in**. Your session token is saved to `localStorage` so you stay logged in across page refreshes.

### Create a room

1. In the left sidebar, click the **+ New** button next to the "Rooms" heading.
2. A modal dialog appears. Fill in:
   - **Room name** — 1 to 50 characters, must be unique. This is how other users find the room.
   - **Description** *(optional)* — a short summary shown under the room name in the sidebar.
3. Click **Create Room**. The room appears in the sidebar immediately.

### Join a room and chat

1. Click any room name in the sidebar. The chat panel opens on the right.
2. The server automatically adds you as a member the first time you open a room. A system message *"[username] has joined the room"* is broadcast to everyone already in the room.
3. Type a message in the text box at the bottom and press **Enter** or click **Send**.
   - Messages are limited to 1000 characters.
   - Your message appears instantly in your own chat panel (optimistic update) and is delivered to all other members in real time via Socket.io.
4. While someone else is composing a message, a *"[username] is typing…"* indicator appears above the input box. It disappears when they send their message or stop typing for 3 seconds.

### Load older messages

The chat panel loads the 50 most recent messages when you open a room. To read earlier history:

1. Scroll to the top of the message list.
2. Click the **Load older messages** button.
3. The previous 50 messages are inserted above the ones already loaded. Your scroll position is preserved — you stay at the same point in the conversation.
4. Repeat until you see **"Beginning of conversation"**, which means you have loaded the full history.

### Unread message badges

When you are **not** in a room and another member sends a message there, a red numeric badge appears on that room's name in the sidebar. The number shows exactly how many messages you have not yet seen.

- The badge updates in real time — no page refresh needed.
- Clicking the room opens it and clears the badge immediately.
- The count is stored on the server, so it persists across page refreshes and new browser sessions.
- If you have the app open in multiple tabs, all tabs update their badges simultaneously.

### Leave a room

Leaving a room removes you from its member list and stops you from receiving new messages from it.

1. Open the room by clicking it in the sidebar.
2. Click the **Leave Room** button in the chat panel header (top right).
3. A confirmation dialog appears. Click **OK** to confirm.
4. A system message *"[username] has left the room"* is broadcast to the remaining members.
5. The room disappears from your sidebar.

> You can rejoin a room at any time by using the **+ New** button... wait — the current version does not yet have a public room browser. To rejoin a room someone must share its exact name and you re-create it, or the feature is extended in a future user story.

### Log out

Click the **Log out** button in the top-right corner of the header bar. Your session token is cleared from `localStorage` and you are redirected to the login page.

### Mobile layout

The application is fully responsive:

- **Desktop (768px and wider):** The sidebar and chat panel are displayed side by side. The sidebar is always visible.
- **Mobile (narrower than 768px):** The sidebar is hidden by default. Tap the **☰** (hamburger) button in the top-left corner to slide it open. Tap a room name to close the sidebar and open the chat. Tap the **✕** button or anywhere on the dark backdrop to close the sidebar without selecting a room. Pressing **Escape** on a keyboard also closes the sidebar.

All buttons and inputs meet the 44 × 44 px minimum touch target size recommended by Apple and Google for touch interfaces.

---

## Data Model

```mermaid
erDiagram

    USERS {
        uuid        id              PK
        varchar     username
        varchar     email
        varchar     password_hash
        timestamp   created_at
        timestamp   last_seen_at
    }

    ROOMS {
        uuid        id              PK
        uuid        owner_id        FK
        varchar     name
        varchar     description
        boolean     is_private
        timestamp   created_at
    }

    ROOM_MEMBERS {
        uuid        id              PK
        uuid        room_id         FK
        uuid        user_id         FK
        timestamp   joined_at
        integer     unread_count
    }

    MESSAGES {
        uuid        id              PK
        uuid        room_id         FK
        uuid        sender_id       FK
        text        body
        boolean     is_system_message
        timestamp   created_at
    }

    CONTACTS {
        uuid        id              PK
        uuid        user_id         FK
        varchar     name
        varchar     email
        varchar     phone
        varchar     linkedin_url
        timestamp   created_at
    }

    SESSIONS {
        uuid        id              PK
        uuid        user_id         FK
        varchar     socket_id
        boolean     is_online
        timestamp   connected_at
        timestamp   disconnected_at
    }

    USERS ||--o{ ROOMS           : "owns"
    USERS ||--o{ ROOM_MEMBERS    : "has"
    USERS ||--o{ MESSAGES        : "sends"
    USERS ||--o{ SESSIONS        : "has"
    USERS ||--o{ CONTACTS        : "has"

    ROOMS ||--o{ ROOM_MEMBERS    : "has"
    ROOMS ||--o{ MESSAGES        : "contains"

    ROOM_MEMBERS }o--|| USERS    : "references"
    ROOM_MEMBERS }o--|| ROOMS    : "references"

    MESSAGES }o--|| USERS        : "sent by"
    MESSAGES }o--|| ROOMS        : "belongs to"

    SESSIONS }o--|| USERS        : "belongs to"

    CONTACTS }o--|| USERS        : "belongs to"
```

---

## Environment Variables

All environment variables live in `server/.env`. The file is not committed to version control. Use `server/.env.example` as the template.

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3001` | Port the Express + Socket.io server listens on |
| `DATABASE_URL` | **Yes** | — | Full PostgreSQL connection string |
| `JWT_SECRET` | **Yes** | — | Secret for signing JWTs. Use a random 64-character string in production |
| `CLIENT_URL` | **Yes** | — | Origin of the frontend (e.g. `http://localhost:5173`). Used for CORS and Socket.io |

---

## Available Scripts

### Server (`cd server`)

| Command | Description |
|---|---|
| `npm run dev` | Start the server with `--watch` (auto-restarts on file save) |
| `npm start` | Start the server without watch mode (for production) |

### Client (`cd client`)

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite development server with hot module replacement |
| `npm run build` | Compile and bundle the app into `client/dist/` for production |
| `npm run preview` | Serve the production build locally to verify it before deploying |
