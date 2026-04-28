# Tech Stack Document
## Real-Time Chat Application

---

## Overview

This document records the technology choices for each layer of the real-time chat application, the reasoning behind each choice, the alternatives that were considered, and the consequences of the decision. Each entry should be read alongside the Architecture Decision Records (ADRs), which govern how these technologies interact with one another.

---

## TS-001: Frontend Framework — React

**Status:** Accepted

**Context:**
The application requires a dynamic, component-driven UI that manages multiple concurrent streams of state: the active room, the message list, typing indicators, presence data, and unread badge counts. These state values update frequently and independently, often in response to Socket.io events rather than user actions. A frontend framework is needed that can handle frequent, granular state updates efficiently and has strong library support for the specific UI patterns required — particularly drag-and-drop (if Kanban is added) and data visualization on the dashboard.

**Decision:**
React will be used as the frontend framework. Components will be written as functional components using hooks. State will be split between React Query (server state) and `useState`/Redux Toolkit (ephemeral UI state) as defined in ADR-004. The project will be bootstrapped using Vite for fast local development and optimized production builds.

**Alternatives Considered:**
- *Vue.js:* A strong alternative with a gentler learning curve and excellent documentation. Rejected because React has a larger ecosystem of libraries relevant to this project, particularly for real-time UI patterns, and is more widely encountered in professional settings — giving the project more practical career value.
- *Vanilla JavaScript:* No framework at all. Rejected because manually managing DOM updates in response to frequent Socket.io events would require reimplementing the reactivity system that frameworks provide. The complexity and bug surface would grow quickly.
- *Next.js:* A React meta-framework with server-side rendering. Rejected because the application has no SEO requirements and no need for server-rendered pages. The added complexity of SSR is not justified, and Next.js's server components model would complicate the Socket.io integration.
- *Svelte:* Compiles to vanilla JS with minimal runtime overhead. Rejected primarily due to a smaller ecosystem and less community support for the Socket.io and real-time UI patterns central to this project.

**Consequences:**

*Positive:*
- React's component model maps cleanly onto the feature-based folder structure defined in ADR-003
- Hooks (useEffect, useState, useRef) provide clean patterns for managing Socket.io event listeners and cleanup
- React Query integrates natively with React and handles server state caching with minimal boilerplate
- Large ecosystem means solutions to common problems (scroll management, emoji pickers, badge counters) are readily available as libraries

*Negative:*
- React's flexibility means there is no single canonical way to structure a project; discipline is required to maintain the conventions defined in ADR-003
- Vite + React requires familiarity with the build toolchain; misconfigured environment variables or proxy settings can cause non-obvious bugs during development
- React's rendering model (and when re-renders are triggered) requires understanding to avoid performance issues when many Socket.io events arrive in quick succession

---

## TS-002: Backend Framework — Node.js with Express

**Status:** Accepted

**Context:**
The backend must serve a REST API, manage WebSocket connections via Socket.io, and interact with a PostgreSQL database. It must handle multiple concurrent connections efficiently, as real-time presence and messaging require persistent connections from every active user. The backend language should ideally be consistent with the frontend to reduce context-switching for a solo developer.

**Decision:**
Node.js will be used as the runtime and Express will be used as the HTTP framework. Express will handle all REST routing. Socket.io will be mounted on the same Node.js HTTP server instance, sharing the process with Express as defined in ADR-001. The codebase will use ES Modules with async/await throughout.

**Alternatives Considered:**
- *Python with FastAPI:* A strong alternative with excellent async support and automatic OpenAPI documentation generation. Rejected primarily because Socket.io has its first-class client and server library in the JavaScript ecosystem. Using Python on the backend would require using a different WebSocket library (such as python-socketio) that is less well documented and has a smaller community.
- *Python with Django:* A batteries-included framework with a built-in ORM and admin panel. Rejected because Django's synchronous-first design and opinionated structure are at odds with the event-driven, real-time nature of the application. Django Channels adds WebSocket support but adds significant configuration complexity.
- *Deno:* A modern JavaScript runtime with built-in TypeScript support and improved security defaults. Rejected due to a smaller ecosystem and less mature Socket.io support compared to Node.js.
- *Go with Gorilla WebSocket:* Excellent performance and native concurrency. Rejected because the learning curve of Go, combined with a less mature ecosystem for rapid solo development, would consume sprint time better spent on features.

**Consequences:**

*Positive:*
- JavaScript on both frontend and backend eliminates language context-switching for a solo developer
- Node.js's event-driven, non-blocking I/O model is well suited to maintaining many concurrent WebSocket connections without threading complexity
- Socket.io is a first-class Node.js library with extensive documentation and active maintenance
- Express is minimal and unopinionated, which pairs well with the layered architecture defined in ADR-003 without fighting the framework's conventions

*Negative:*
- JavaScript's single-threaded nature means a CPU-intensive operation (unlikely in this app but possible) can block the event loop and degrade real-time performance for all connected users
- Express provides no structure by default; all architectural conventions must be self-enforced, which requires the discipline described in ADR-003
- Error handling in async Express routes requires explicit try/catch or a wrapper utility; unhandled promise rejections can silently fail without proper setup

---

## TS-003: Real-Time Communication — Socket.io

**Status:** Accepted

**Context:**
The application requires bidirectional, real-time communication between the server and all connected clients for messaging (US-302), typing indicators (US-303), and presence updates (US-401, US-402). A WebSocket library or abstraction is needed that handles connection management, reconnection, room-based broadcasting, and cross-browser compatibility.

**Decision:**
Socket.io will be used for all real-time communication. The server-side `socket.io` package will be mounted on the Express HTTP server. The client-side `socket.io-client` package will be used in React. Socket.io rooms will map directly to the application's chat rooms, enabling targeted broadcasts to only the users in a given room. JWT auth tokens will be passed during the Socket.io handshake and validated in a middleware function before any events are processed.

**Alternatives Considered:**
- *Native WebSocket API (ws library on server, browser WebSocket on client):* Using raw WebSockets without an abstraction layer is possible and avoids the Socket.io overhead. Rejected because raw WebSockets require manual implementation of reconnection logic, room-based broadcasting, event namespacing, and fallback handling — all of which Socket.io provides out of the box. The time cost of reimplementing these features outweighs the minor performance benefit.
- *Pusher:* A managed WebSocket service that eliminates the need to run Socket.io on the server. Rejected because it introduces a third-party dependency and usage-based pricing, and removes the learning opportunity of implementing real-time communication from scratch, which is a core objective of the practicum project.
- *Firebase Realtime Database:* A managed real-time database that pushes updates to clients automatically. Rejected because it would also replace PostgreSQL as the data layer, making it a much larger architectural shift. It would also obscure the WebSocket mechanics that are central to the project's educational value.

**Consequences:**

*Positive:*
- Socket.io's room abstraction maps directly to the chat room concept, making room-scoped broadcasts a one-line operation
- Automatic reconnection with exponential backoff means temporary network drops are handled without any custom code
- The typing indicator (US-303) and presence (US-401) features are straightforward to implement using Socket.io's event emission model
- Socket.io falls back to HTTP long-polling in environments where WebSockets are blocked, improving reliability across networks

*Negative:*
- Socket.io adds a layer of abstraction over raw WebSockets; the client and server must both use Socket.io — a plain WebSocket client cannot connect to a Socket.io server
- Socket.io's default in-memory adapter stores room and socket state in a single process; if the backend ever needs to scale to multiple server instances, a Redis adapter must be added
- The Socket.io handshake and protocol overhead is slightly larger than a raw WebSocket connection, which is negligible at the scale of this project but worth noting

---

## TS-004: Database — PostgreSQL

**Status:** Accepted

**Context:**
The application requires persistent storage for users, rooms, messages, and room membership. The data has clear relational structure: messages belong to rooms, rooms have many members, users have many messages. Data integrity constraints (e.g. a message must reference a valid room and a valid user) are important for correctness. The database must be hostable on a managed platform alongside the Node.js backend without requiring separate infrastructure provisioning.

**Decision:**
PostgreSQL will be used as the primary database. The schema will define four core tables: `users`, `rooms`, `room_members`, and `messages`. Foreign key constraints will enforce referential integrity. The `node-postgres` (`pg`) library will be used to execute queries from the repository layer. Database migrations will be managed using a lightweight migration tool such as `node-pg-migrate` to track schema changes across development and production environments.

**Alternatives Considered:**
- *MongoDB:* A document database that stores data as JSON-like objects without a fixed schema. Rejected because the application's data is inherently relational — messages reference users and rooms, memberships link users to rooms — and a document model would require duplicating data or performing manual joins in application code that a relational database handles natively.
- *SQLite:* A lightweight file-based SQL database that requires no separate server process. Rejected for production use because it does not support concurrent writes well, which would become a bottleneck as multiple users send messages simultaneously. It remains a viable option for local development or testing if needed.
- *MySQL:* A widely used relational database with similar capabilities to PostgreSQL. Rejected in favor of PostgreSQL because PostgreSQL has better support for advanced features (such as JSON columns and full-text search) that may be useful for stretch features like message search, and is the default option on both Railway and Render.
- *Firebase Firestore:* A managed NoSQL document database with built-in real-time sync. Rejected for the same reasons as Firebase Realtime Database in TS-003 — it would replace too much of the backend stack and obscure the learning value of building the data layer manually.

**Consequences:**

*Positive:*
- Foreign key constraints enforce data integrity at the database level, preventing orphaned messages or invalid room memberships without application-level checks
- SQL's expressive query language makes message history pagination (US-501, US-502) straightforward to implement with `LIMIT` and `OFFSET`
- PostgreSQL is available as a managed add-on on Railway and Render, requiring no separate infrastructure setup
- A well-defined relational schema serves as living documentation of the application's data model

*Negative:*
- Schema changes require migrations, which adds a small amount of process overhead compared to a schemaless database — every column addition or table rename must be written as a migration script
- PostgreSQL requires a running server process, which adds a dependency to the local development environment (mitigated by using Docker or a cloud-hosted dev database)
- Raw SQL queries in the repository layer require careful parameterization to prevent SQL injection; an ORM would handle this automatically but was excluded to keep the stack simple and the SQL visible

---

## TS-005: Authentication — JSON Web Tokens (JWT)

**Status:** Accepted

**Context:**
The application requires authentication so that each user's data is private and so that Socket.io connections can be attributed to a specific user for presence and messaging purposes. A mechanism is needed for the server to verify the identity of a client on both HTTP requests and WebSocket connections. The solution must work across the independently deployed frontend and backend defined in ADR-002, where cookie-based sessions would require additional cross-origin configuration.

**Decision:**
Authentication will be implemented using JSON Web Tokens. Upon successful login, the server will sign a JWT containing the user's ID and username using a secret key stored in an environment variable. The token will be returned to the client and stored in memory (not localStorage) during the session. All protected HTTP requests will include the token in the `Authorization: Bearer` header. The token will also be passed in the Socket.io handshake `auth` object and validated in a Socket.io middleware function before any events are processed. Tokens will have an expiry of 24 hours. Passwords will be hashed using bcrypt before storage.

**Alternatives Considered:**
- *Express sessions with server-side session store:* A traditional session-based approach where the server stores session data and the client holds only a session ID cookie. Rejected because cross-origin cookie handling between the separately deployed frontend and backend (ADR-002) requires careful `SameSite` and CORS configuration that adds complexity without benefit. JWTs are stateless and work cleanly across origins.
- *OAuth / third-party auth (Google, GitHub):* Delegating authentication to a third-party provider. Rejected because implementing OAuth is a significant scope addition that is not required by any user story and would consume sprint time. It is a viable stretch feature but not appropriate for the MVP.
- *Passport.js:* A Node.js authentication middleware library that supports many strategies including JWT and OAuth. Rejected in favor of manual JWT implementation using the `jsonwebtoken` library directly. Passport adds abstraction that obscures the authentication flow, which reduces the educational value and makes debugging harder. Manual implementation is straightforward given the single authentication strategy in use.

**Consequences:**

*Positive:*
- JWTs are stateless — the server does not need to store session data, which simplifies the backend and eliminates the need for a session store
- The same token works for both HTTP and WebSocket authentication, avoiding duplicated auth mechanisms
- Token expiry (24 hours) provides a basic security boundary without requiring the user to log in repeatedly during normal use
- bcrypt password hashing with an appropriate cost factor protects user credentials if the database is ever compromised

*Negative:*
- JWTs cannot be invalidated before expiry without implementing a token denylist, meaning a logged-out token technically remains valid until it expires — acceptable for this use case but a known limitation
- Storing the JWT in memory (rather than localStorage or a cookie) means it is lost on page refresh, requiring the user to log in again — mitigated by storing in `sessionStorage` as a fallback, with the trade-off of slightly reduced security
- Manual JWT implementation requires careful attention to signing secret management, token expiry validation, and error handling for malformed tokens

---

## TS-006: Frontend State Management — React Query and Redux Toolkit

**Status:** Accepted

**Context:**
As defined in ADR-004, client-side state is divided into two categories: server state (room lists, message history, user profiles) and ephemeral UI state (typing indicators, presence, active room). These two categories have different update patterns, different lifetimes, and different invalidation strategies. A single state management approach that treats all state identically would either over-engineer ephemeral state or under-serve server state.

**Decision:**
React Query will be used to manage all server state. It will handle fetching, caching, background refetching, and cache invalidation for REST API responses. Redux Toolkit will be used to manage ephemeral UI state that must be shared across multiple components — specifically the active room, the online presence map, typing indicator state, and unread badge counts. Simple local component state (input field values, modal open/closed) will use React's built-in `useState` and will not be placed in either library.

**Alternatives Considered:**
- *Redux Toolkit for all state:* Redux could manage both server and UI state in a single store. Rejected because managing server state in Redux requires manually writing fetch logic, loading states, error states, and cache invalidation — all of which React Query provides automatically. The boilerplate cost is not justified.
- *React Query alone:* React Query could theoretically manage ephemeral state using its mutation and cache APIs. Rejected because React Query is designed for asynchronous server state and using it for synchronous UI state (like "which room is active") is an unnatural fit that produces confusing cache key management.
- *Zustand:* A lightweight alternative to Redux for global UI state. A valid choice that would reduce boilerplate compared to Redux Toolkit. Rejected in favor of Redux Toolkit because Redux DevTools provides better visibility into state changes over time, which is useful for debugging real-time event flows during development.
- *React Context API alone:* React's built-in context could replace both libraries for a simpler setup. Rejected because Context re-renders all consumers on every update, which would cause unnecessary re-renders across the component tree as Socket.io events arrive frequently.

**Consequences:**

*Positive:*
- React Query eliminates manual loading/error state management for all REST API calls, reducing boilerplate significantly
- React Query's automatic background refetching keeps room lists and user data fresh without polling logic
- Redux DevTools provide a complete timeline of state changes, making it straightforward to trace how a Socket.io event propagated through the application
- The clear separation between the two libraries reflects the ADR-004 distinction between persistent and ephemeral state, making the codebase easier to reason about

*Negative:*
- Two state management libraries must be understood, configured, and used correctly alongside each other
- React Query cache invalidation must be coordinated with Socket.io events — for example, when a new room is created via a socket event, the React Query room list cache must be manually invalidated, which requires careful wiring
- Redux Toolkit's slice/action/reducer pattern has more boilerplate than simpler alternatives like Zustand, which may feel like overhead for the relatively small amount of ephemeral state in this application

---

## TS-007: Hosting — Vercel (Frontend) and Railway (Backend)

**Status:** Accepted

**Context:**
As defined in ADR-002, the frontend and backend will be deployed as two independent services. Each requires a hosting platform appropriate to its runtime characteristics. The frontend is a static build artifact that benefits from CDN distribution. The backend is a persistent Node.js process that requires a long-running server environment and a managed PostgreSQL database. Both platforms must be free or low-cost for an academic project and must support deployment from a Git repository with minimal configuration.

**Decision:**
The React frontend will be deployed to Vercel. Vercel detects Vite projects automatically, runs the build on each push to the main branch, and distributes the output via its global CDN. The Node.js backend and PostgreSQL database will be deployed to Railway. Railway supports persistent Node.js processes, provides a one-click managed PostgreSQL add-on, and exposes environment variables through its dashboard. All sensitive configuration (JWT secret, database URL) will be stored as environment variables on each platform and never committed to the repository.

**Alternatives Considered:**
- *Netlify (frontend):* A direct alternative to Vercel with nearly identical capabilities for static frontend hosting. Either would work; Vercel is preferred for this project due to its tighter Vite integration and slightly faster cold build times.
- *Render (backend):* A strong alternative to Railway with managed PostgreSQL and persistent Node.js support. Either would work; Railway is preferred for its simpler dashboard and faster deployment pipeline. Render's free tier spins down inactive services after 15 minutes, which would cause the first WebSocket connection after inactivity to fail while the server restarts — a poor experience for a demo.
- *Heroku (backend):* A long-established platform for Node.js hosting. Rejected because Heroku eliminated its free tier, making it a cost-bearing option without meaningful advantages over Railway for this use case.
- *AWS / GCP / Azure:* Full cloud providers offer maximum flexibility and scalability. Rejected as unnecessarily complex for a solo practicum project. Configuring EC2 instances, VPCs, security groups, and managed RDS databases would consume significant sprint time that should be spent on features.
- *Self-hosted VPS (DigitalOcean Droplet, Linode):* A low-cost virtual server with full control. Rejected because managing a server (installing Node.js, configuring nginx, handling SSL certificates) is operationally complex and outside the scope of the practicum's learning objectives.

**Consequences:**

*Positive:*
- Both platforms deploy automatically on every push to the main branch, enabling continuous delivery without manual steps
- Vercel's CDN ensures fast frontend load times globally with zero configuration
- Railway's managed PostgreSQL eliminates database server provisioning and maintenance
- Environment variable management is handled by each platform's dashboard, keeping secrets out of the repository

*Negative:*
- Railway's free tier has monthly usage limits; a heavily used demo could exceed them, though this is unlikely for a practicum project
- Vercel and Railway are separate dashboards, meaning environment variable updates and deployment logs must be checked in two places
- WebSocket connections in production must use `wss://` (secure WebSocket), which requires ensuring the Railway-provided domain has SSL — it does by default, but the client must be configured to use the correct protocol in production vs. development

---

## Summary

| ID | Layer | Choice | Key Reason |
|---|---|---|---|
| TS-001 | Frontend Framework | React + Vite | Component model, ecosystem, hooks for socket management |
| TS-002 | Backend Framework | Node.js + Express | JavaScript consistency, event-driven I/O, Socket.io first-class support |
| TS-003 | Real-Time Communication | Socket.io | Room broadcasting, reconnection, cross-browser fallback |
| TS-004 | Database | PostgreSQL | Relational data model, managed hosting, referential integrity |
| TS-005 | Authentication | JWT + bcrypt | Stateless, works across HTTP and WebSocket, cross-origin friendly |
| TS-006 | State Management | React Query + Redux Toolkit | Separation of server vs. ephemeral state as defined in ADR-004 |
| TS-007 | Hosting | Vercel + Railway | Zero-config CDN for frontend, persistent process + managed DB for backend |

