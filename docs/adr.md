# Architecture Decision Records
## Real-Time Chat Application

---

## ADR-001: Dual-Channel Communication Strategy

**Status:** Accepted

**Context:**
The application must support two fundamentally different types of client-server communication. Auth, room management, and message history retrieval are all request/response interactions where the client initiates and waits for a reply. Real-time messaging, typing indicators, and presence updates require the server to push data to connected clients without being asked. No single protocol handles both patterns equally well. A decision is needed on how these two communication needs will be served.

**Decision:**
The application will use two communication channels operating in parallel. REST over HTTP will handle all request/response interactions including authentication, room CRUD operations, and paginated message history. WebSockets via Socket.io will handle all real-time push interactions including message broadcasting, typing indicators, and presence events. The two channels will share the same Node.js/Express server process but will be handled by separate routing and event layers.

**Alternatives Considered:**
- *WebSockets only:* A single WebSocket channel could technically handle all communication including auth and room management by defining custom request/response events. This was rejected because it requires reimplementing reliability, error handling, and request timeouts that HTTP provides for free. It also makes the API harder to test and document.
- *HTTP polling:* The client could poll the server on a short interval to simulate real-time behavior. This was rejected because it introduces artificial latency, wastes server resources on empty responses, and would make the typing indicator (US-303) feel noticeably laggy — directly violating the acceptance criteria.
- *Server-Sent Events (SSE):* SSE supports server-to-client push over HTTP without a full WebSocket handshake. This was rejected because SSE is unidirectional — the client cannot push back over the same channel — which would still require REST for sending messages, adding complexity without the full benefit of WebSockets.

**Consequences:**

*Positive:*
- Each channel is used exactly where it is the right fit, keeping both layers simple and focused
- If the WebSocket connection drops temporarily, auth and room browsing continue to function over HTTP without interruption
- REST endpoints are independently testable with standard tools like Postman or curl without needing a live socket connection
- Socket.io's built-in reconnection logic handles unstable connections gracefully without custom code

*Negative:*
- Developers must maintain familiarity with two different communication paradigms simultaneously
- Auth tokens must be passed during the Socket.io handshake as well as in HTTP headers, requiring a small amount of duplicated auth logic
- Debugging requires monitoring two channels, which adds complexity to tracing bugs that span both layers

---

## ADR-002: Independently Deployed Frontend and Backend

**Status:** Accepted

**Context:**
The application consists of a React frontend and a Node.js backend. A decision is needed on whether these should be deployed as a single unit or as two independently deployable services. The backend requires a persistent process to maintain Socket.io connections and a managed database. The frontend, after building, is a collection of static files that has no server-side runtime requirements. The hosting needs of each unit are therefore fundamentally different.

**Decision:**
The frontend and backend will be deployed as two independent services. The React frontend will be deployed to a static hosting platform (Vercel or Netlify), which serves the built output via a CDN. The Node.js backend will be deployed to a container-friendly platform (Railway or Render), which supports persistent processes and managed PostgreSQL. The two services will communicate over HTTPS for REST calls and WSS for WebSocket connections.

**Alternatives Considered:**
- *Single deployment (Express serves the React build):* The backend could serve the compiled React app as static files from an Express route, making the entire application one deployable unit. This was rejected because it couples the deployment lifecycle of the frontend and backend together, meaning a UI-only change requires redeploying the entire server. It also prevents the frontend from benefiting from CDN distribution.
- *Containerized monolith with Docker:* Both services could be packaged into a single Docker container. This was rejected as unnecessarily complex for a solo project with no need for container orchestration. The operational overhead outweighs the benefits at this scale.
- *Serverless backend (AWS Lambda / Vercel Functions):* Serverless functions were considered for the backend. This was rejected because Socket.io requires a persistent, stateful process. Serverless functions are stateless and short-lived by design, making them fundamentally incompatible with WebSocket connections.

**Consequences:**

*Positive:*
- Frontend and backend can be redeployed independently, meaning a CSS fix does not require touching the server
- The frontend is served via CDN, resulting in fast global load times at no extra cost or configuration
- Each service can be scaled, monitored, and rolled back independently
- Railway and Render both provide managed PostgreSQL, eliminating the need to separately provision or maintain a database server

*Negative:*
- CORS must be explicitly configured on the backend to allow requests from the frontend's domain
- Environment variables must be managed in two separate deployment dashboards
- Local development requires running two processes simultaneously, which adds minor friction to the development workflow
- WebSocket connections must use WSS (secure) in production, requiring correct SSL configuration on the backend host

---

## ADR-003: Feature-Based Frontend Structure with Layered Backend Architecture

**Status:** Accepted

**Context:**
As the codebase grows across eight development sprints, files will need to be consistently organized so that related code is easy to locate and modify. Two organizational decisions are required: one for the React frontend and one for the Node.js backend. Without a deliberate structure established early, codebases on solo projects tend to accumulate logic in the wrong layers, making features increasingly difficult to add or change as the project progresses.

**Decision:**
The React frontend will be organized by feature. Each feature (auth, rooms, chat, presence) will have its own folder containing its components, state slices, and hooks. Shared UI primitives and cross-cutting hooks will live in a separate `shared/` directory. The Node.js backend will follow a strict layered architecture where dependencies point in only one direction: Routes → Controllers → Services → Repositories → Database. All SQL queries will be confined to the repository layer. All business logic will live exclusively in the service layer. Routes and controllers will contain no logic beyond parsing requests and formatting responses.

**Alternatives Considered:**
- *Type-based frontend organization (all components together, all slices together):* This is the default structure in many tutorials. It was rejected because it requires navigating multiple directories to work on a single feature. When implementing US-303 (typing indicator), for example, a developer would need to touch files in `/components`, `/slices`, `/hooks`, and `/services` simultaneously — a disorienting experience on a solo project.
- *Flat backend structure (all files in one directory):* Simple to start but rejected because it provides no guidance on where new logic should go. As the backend grows, business logic inevitably bleeds into routes and database calls appear in controllers, making the codebase progressively harder to test and reason about.
- *Domain-Driven Design (DDD) with bounded contexts:* A more sophisticated approach that mirrors the feature-based frontend structure on the backend. Rejected as over-engineered for the current scale. The application does not have enough cross-domain complexity to justify the abstraction overhead that DDD introduces.

**Consequences:**

*Positive:*
- All code related to a user story is colocated, making sprint-by-sprint development faster and more intuitive
- The service layer can be unit tested in isolation without a running database or HTTP server
- The repository layer provides a single place to audit, optimize, or replace all database interactions
- New features follow an obvious pattern, reducing decision fatigue during implementation

*Negative:*
- Shared state or logic that spans multiple features (e.g. a notification that involves both rooms and chat) does not have an obvious home and requires a judgment call on placement
- The layered backend structure introduces more files and indirection than a flat structure, which can feel like overhead during the early sprints when the codebase is small
- Strict enforcement of dependency direction requires discipline; there is no automated tooling configured to prevent a service from accidentally importing a controller

---

## ADR-004: Server as Source of Truth with Client-Side State Split by Volatility

**Status:** Accepted

**Context:**
The application manages two fundamentally different kinds of state. Persistent state — users, rooms, messages, and membership — must survive page refreshes and be consistent across all connected clients. Ephemeral UI state — typing indicators, online presence, and unread badge counts — is short-lived, client-derived, and has no meaningful existence outside of an active session. A decision is needed on where each kind of state lives and how the client manages the combination of both.

**Decision:**
PostgreSQL on the server will be the single source of truth for all persistent application data. No client will treat its local copy of persistent data as authoritative; all writes go through the server and the client updates its local copy only after server confirmation or upon receiving a server-pushed event. On the client, state will be divided into two categories managed by different tools. Server state — room lists, message history, and user profiles — will be managed by React Query, which handles caching, background refetching, and cache invalidation. Ephemeral UI state — typing indicators, presence maps, and active room selection — will be managed by React's `useState` or a Redux slice and will be considered disposable. Socket.io events will update ephemeral state directly on arrival without a round-trip confirmation.

**Alternatives Considered:**
- *Single global Redux store for all state:* Redux could hold both server state and UI state in one place. This was rejected because server state in Redux requires manual cache invalidation logic that React Query handles automatically. Mixing the two also obscures which state is persistent and which is disposable, making bugs harder to diagnose.
- *Local-first with client-side database (IndexedDB):* The client could maintain a local database and sync with the server. This was rejected as significantly over-engineered for the feature set. The acceptance criteria do not require offline support, and local-first architecture introduces substantial complexity around conflict resolution that is not justified here.
- *Session storage for ephemeral state:* Browser session storage could persist ephemeral state across page reloads within a tab. This was rejected because ephemeral state like typing indicators and presence is meaningless after a reconnection — stale presence data is actively harmful to the user experience and should be rebuilt fresh from the server on each session.

**Consequences:**

*Positive:*
- There is never ambiguity about where to find the canonical version of any piece of data — it is always the server
- Ephemeral state can be reset at any time without data loss, making reconnection logic straightforward
- React Query's automatic cache invalidation and background refetching keep server state fresh without manual management
- The clear split makes it easy to reason about what survives a page refresh and what does not

*Negative:*
- Two state management tools (React Query and Redux/useState) must be understood and used correctly side by side
- React Query's cache must be explicitly invalidated after mutations (e.g. after creating a room, the room list cache must be marked stale), which requires careful coordination between REST and Socket.io event handlers
- Ephemeral state is rebuilt from scratch on every reconnection, meaning a user who loses and regains their connection will see cleared typing indicators and a refreshed presence list rather than the prior state

---

## ADR-005: Optimistic Updates for Real-Time Interactions, Pessimistic Updates for Authoritative Writes

**Status:** Accepted

**Context:**
User actions in the application fall into two categories with different latency requirements. Some actions — particularly sending messages, typing indicators, and joining rooms — must feel instantaneous to maintain the perception of real-time communication. Other actions — creating rooms, registering, and logging in — depend on server-generated data (IDs, tokens) or validation that the client cannot perform independently. A decision is needed on how the UI responds to user actions before receiving server confirmation.

**Decision:**
The application will apply optimistic updates to all interactions where the action is highly likely to succeed and the user expects immediate feedback. Specifically, sent messages will appear in the chat panel immediately upon submission with a pending visual state, and will be confirmed or flagged with an error upon server response. Typing indicators and presence changes will be reflected immediately on socket event arrival without a separate confirmation step. Pessimistic updates will be applied to all interactions where the server response determines what the UI must show next. Room creation, user registration, login, and leaving a room will all wait for server confirmation before updating the UI, displaying a loading state in the interim.

**Alternatives Considered:**
- *Pessimistic updates for all interactions:* Waiting for server confirmation on every action is the simplest implementation and eliminates the need for rollback logic. This was rejected for messaging and presence because the round-trip latency — even at 100ms — would make typing indicators and message delivery feel noticeably delayed, directly violating the spirit of the real-time acceptance criteria.
- *Optimistic updates for all interactions:* Applying optimistic updates universally would make every action feel instant. This was rejected for room creation and auth because these responses contain server-generated data the client does not have. Rendering a new room before it has a real database ID would require fabricating an ID on the client, creating a class of synchronization bugs that are difficult to detect and reproduce.
- *Eventual consistency with background sync:* The client could render all actions optimistically and reconcile with the server in the background. This was rejected as significantly more complex than the feature set requires and inappropriate for an academic project where correctness is more important than maximum perceived performance.

**Consequences:**

*Positive:*
- Message sending and typing indicators feel instantaneous, meeting the real-time experience expectations of the acceptance criteria
- Pessimistic updates on room creation and auth prevent the UI from ever rendering with fabricated or invalid server-generated identifiers
- The distinction between the two models provides a clear, teachable decision framework that can be explained and defended during the final presentation

*Negative:*
- Optimistic message rendering requires rollback logic for the failure case, adding implementation complexity to the message sending flow
- The pending visual state for optimistic messages must be designed and implemented, adding UI work beyond simply rendering confirmed messages
- Developers must make a deliberate per-feature judgment call about which model applies, and an incorrect choice (applying optimism where pessimism is needed) can produce subtle and hard-to-reproduce bugs

