# 🚀 CodeSync — Real-Time Collaborative Code Editor

<p align="center">
  A modern real-time collaborative code editor inspired by VS Code.  
  Built with the MERN stack, Socket.IO, and Monaco Editor.
</p>

---

## ✨ Features

* 🔐 JWT Authentication & Protected Routes
* 👥 Real-Time Collaborative Editing
* ⚡ Live Cursor & Typing Indicators
* 💬 Room-Based Realtime Chat
* 📁 File Explorer & Multi-File Support
* 🧠 Monaco Editor Integration
* 🌙 VS Code Inspired Dark UI
* 🔄 Auto Save Functionality
* 🚀 Socket.IO Real-Time Architecture
* 🐳 Docker Support
* 📱 Responsive Design

---

# 🛠️ Tech Stack

## Frontend

* React.js
* TypeScript
* Tailwind CSS
* Monaco Editor
* Zustand
* React Router DOM
* Axios
* Socket.IO Client

## Backend

* Node.js
* Express.js
* Socket.IO
* MongoDB
* Mongoose
* JWT Authentication
* bcryptjs

## DevOps & Tools

* Docker
* Docker Compose
* Git & GitHub

---

# 📂 Project Structure

```bash
codesync/
│
├── client/                         # React Frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── features/
│   │   ├── store/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── layouts/
│   │   └── utils/
│
├── server/                         # Node + Express Backend
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── sockets/
│   │   ├── services/
│   │   └── utils/
│
├── docker/
├── docker-compose.yml
└── README.md
```

---

# ⚡ Real-Time Features

## Collaborative Editing

* Multiple users can edit simultaneously
* Live code synchronization
* Real-time cursor tracking
* Presence indicators

## Chat System

* Room-based messaging
* Typing indicators
* Realtime communication

## File Management

* Create files
* Rename files
* Delete files
* Auto-save support

---

# 🔌 Socket Events

## Client → Server

| Event           | Description             |
| --------------- | ----------------------- |
| `room:join`     | Join collaborative room |
| `room:leave`    | Leave room              |
| `editor:change` | Sync code changes       |
| `editor:cursor` | Sync cursor position    |
| `chat:send`     | Send message            |

---

## Server → Client

| Event                  | Description              |
| ---------------------- | ------------------------ |
| `room:user-joined`     | User joined room         |
| `room:members`         | Active room members      |
| `editor:remote-change` | Receive code updates     |
| `editor:remote-cursor` | Receive cursor updates   |
| `chat:message`         | Receive realtime message |

---

# 🔒 Authentication & Security

* JWT Access & Refresh Tokens
* Password Hashing using bcrypt
* Protected API Routes
* Socket Authentication Middleware
* Rate Limiting
* Environment Variable Protection

---

# 🚀 Getting Started

## 1️⃣ Clone Repository

```bash
git clone https://github.com/yourusername/codesync.git
cd codesync
```

---

## 2️⃣ Setup Backend

```bash
cd server
npm install
```

Create `.env`

```env
PORT=4000
MONGO_URI=your_mongodb_connection
JWT_SECRET=your_secret
CLIENT_URL=http://localhost:5173
```

Run Backend

```bash
npm run dev
```

---

## 3️⃣ Setup Frontend

```bash
cd client
npm install
npm run dev
```

---

# 🐳 Docker Setup

```bash
docker-compose up --build
```

---

# 🌍 Environment Variables

## Server `.env`

```env
PORT=4000
MONGO_URI=
JWT_SECRET=
CLIENT_URL=
```

---

# 📸 Screenshots

> Add screenshots of:

* Editor UI
* Collaborative editing
* Chat panel
* File explorer

---

# 🎯 Future Improvements

* Video Calling
* Voice Chat
* AI Code Suggestions
* Multi-language Execution
* Operational Transform / CRDT
* Room Permissions
* Git Integration

---

# 🧠 Learning Outcomes

This project helped in understanding:

* WebSocket Architecture
* Real-Time Systems
* MERN Stack Development
* State Management
* Authentication Flows
* Scalable Backend Architecture
* Collaborative Systems Design

---

# 📜 License

This project is licensed under the MIT License.

---

# 👨‍💻 Author

### Shivam (Nana) Gohil

* Full Stack Developer
* Interested in Realtime Systems & Backend Engineering
* Passionate about scalable collaborative applications
