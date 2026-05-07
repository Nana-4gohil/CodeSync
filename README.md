# CodeSync — Collaborative Code Editor

A **production-grade**, real-time collaborative code editor inspired by VS Code.

Built with React, TypeScript, Monaco Editor, Node.js, Socket.IO, and PostgreSQL.

---

## ✨ Features

| Feature | Details |
|---|---|
| 🔐 Auth | JWT access + refresh token rotation, logout-all sessions |
| 👥 Collaboration | Real-time multi-cursor editing, presence indicators |
| 💬 Chat | In-room chat with typing indicators and message history |
| 📁 File System | Create, rename, delete files with auto-save |
| ▶ Execution | Sandboxed JavaScript execution with output terminal |
| 🎨 UI | VS Code-inspired dark theme, resizable panels |
| 🚀 DevOps | Docker + Compose production setup |

---

## 🏗️ Architecture

```
codesync/
├── client/                     # React + TypeScript + Tailwind + Monaco
│   └── src/
│       ├── config/             # Axios instance, Socket.IO client
│       ├── features/
│       │   ├── auth/           # Login, Signup, ProtectedRoute
│       │   ├── room/           # RoomList dashboard, RoomPage
│       │   ├── editor/         # CodeEditor (Monaco), EditorTabs
│       │   ├── filesystem/     # FileExplorer
│       │   ├── chat/           # ChatPanel
│       │   └── execution/      # TerminalPanel
│       ├── store/              # Zustand: auth, editor, room
│       ├── types/              # TypeScript interfaces
│       └── components/ui/      # Shared UI components
│
├── server/                     # Node.js + Express + Socket.IO
│   └── src/
│       ├── config/             # env, db, jwt
│       ├── db/                 # schema.sql, migrate.ts
│       ├── middleware/         # auth, error, rateLimit, validate
│       ├── features/
│       │   ├── auth/           # signup/login/refresh/logout
│       │   ├── rooms/          # CRUD + invite codes
│       │   ├── files/          # CRUD + content update
│       │   ├── chat/           # message history
│       │   └── execution/      # VM2 sandboxed JS
│       └── socket/
│           ├── socket.manager.ts
│           └── events/         # room, editor, chat events
│
├── docker/
│   ├── Dockerfile.server       # Multi-stage Node build
│   └── Dockerfile.client       # Multi-stage Nginx build
└── docker-compose.yml
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- npm / pnpm

### 1. Clone & setup environment

```bash
git clone <repo>
cd codesync

# Server env
cp server/.env.example server/.env
# Edit server/.env — set DATABASE_URL and JWT secrets

# Client env
cp client/.env.example client/.env
```

### 2. Database setup

```bash
# Create DB
psql -U postgres -c "CREATE USER codesync WITH PASSWORD 'codesync_pass';"
psql -U postgres -c "CREATE DATABASE codesync_db OWNER codesync;"

# Run migrations
cd server
npm install
npm run db:migrate
```

### 3. Start the server

```bash
cd server
npm run dev
# Server: http://localhost:4000
# Socket: ws://localhost:4000
```

### 4. Start the client

```bash
cd client
npm install
npm run dev
# Client: http://localhost:5173
```

---

## 🐳 Docker (Production)

```bash
# Set secrets
export JWT_ACCESS_SECRET="your_very_long_random_secret_here"
export JWT_REFRESH_SECRET="your_other_very_long_random_secret"
export CLIENT_ORIGIN="http://your-domain.com"

# Build and run all services
docker-compose up --build -d

# Services:
#   Client  → http://localhost:80
#   Server  → http://localhost:4000
#   Postgres → localhost:5432
#   Redis   → localhost:6379
```

---

## 🔌 Socket Event Architecture

### Client → Server
| Event | Payload |
|---|---|
| `room:join` | `{ roomId }` |
| `room:leave` | `{ roomId }` |
| `editor:change` | `{ roomId, fileId, content, version }` |
| `editor:cursor` | `{ roomId, fileId, position }` |
| `editor:selection` | `{ roomId, fileId, selection }` |
| `editor:typing` | `{ roomId, fileId }` |
| `chat:send` | `{ roomId, content }` |
| `chat:typing-start` | `{ roomId }` |
| `chat:typing-stop` | `{ roomId }` |

### Server → Client
| Event | Payload |
|---|---|
| `room:members` | `{ members[] }` |
| `room:user-joined` | `{ user, members[] }` |
| `room:presence` | `{ userId, status }` |
| `editor:remote-change` | `{ userId, fileId, content, version }` |
| `editor:remote-cursor` | `{ userId, fileId, position, color }` |
| `chat:message` | `{ id, userId, username, content, createdAt }` |
| `chat:typing-users` | `{ userIds[], usernames[] }` |

---

## 📡 API Reference

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | ❌ | Register |
| POST | `/api/auth/login` | ❌ | Login |
| POST | `/api/auth/refresh` | ❌ | Rotate refresh token |
| POST | `/api/auth/logout` | ❌ | Revoke one token |
| POST | `/api/auth/logout-all` | ✅ | Revoke all tokens |
| GET | `/api/auth/me` | ✅ | Current user |

### Rooms
| Method | Path | Description |
|---|---|---|
| GET | `/api/rooms` | User's rooms |
| POST | `/api/rooms` | Create room |
| POST | `/api/rooms/join` | Join by invite code |
| GET | `/api/rooms/:id` | Room detail |
| PATCH | `/api/rooms/:id` | Update room |
| DELETE | `/api/rooms/:id` | Delete room |
| GET | `/api/rooms/:id/members` | Room members |
| POST | `/api/rooms/:id/regenerate-invite` | New invite code |

### Files
| Method | Path | Description |
|---|---|---|
| GET | `/api/rooms/:roomId/files` | List files |
| POST | `/api/rooms/:roomId/files` | Create file |
| GET | `/api/rooms/:roomId/files/:id` | Get file |
| PATCH | `/api/rooms/:roomId/files/:id/content` | Update content |
| PATCH | `/api/rooms/:roomId/files/:id/rename` | Rename file |
| DELETE | `/api/rooms/:roomId/files/:id` | Delete file |

### Chat & Execution
| Method | Path | Description |
|---|---|---|
| GET | `/api/rooms/:roomId/messages` | Message history |
| POST | `/api/execute` | Execute JS code |

---

## 🔒 Security

- Passwords hashed with **bcrypt** (12 rounds)
- JWT refresh token **rotation + family revocation** (reuse detection)
- Code execution in **VM2 sandbox** — no file system, no require(), 5s timeout
- **Helmet** for HTTP security headers
- **Rate limiting** — 100 req/15min global, 10 req/15min for auth, 20 req/min for execution
- **Zod** validation on all API inputs

---

## 🧪 Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS, Monaco Editor, Zustand, React Router v6 |
| Backend | Node.js 20, Express, Socket.IO 4, TypeScript |
| Database | PostgreSQL 16 |
| Auth | JWT (access + refresh), bcryptjs |
| Realtime | Socket.IO WebSocket + polling fallback |
| Execution | VM2 sandboxed runtime |
| DevOps | Docker, Docker Compose, Nginx |
