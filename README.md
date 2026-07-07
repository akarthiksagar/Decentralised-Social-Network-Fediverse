# 🌐 Fediverse - Decentralized Social Network

A **federated microblogging platform** built from scratch using the **W3C ActivityPub** protocol. Inspired by platforms like **Mastodon** , this project enables independent servers to communicate while allowing users to own their data and interact seamlessly across the Fediverse.

The project is being developed as a complete ActivityPub-compatible social network, featuring local social networking capabilities, federation, real-time notifications, remote account discovery, and secure cryptographic communication between servers.

---

## ✨ Features

### 🔐 Authentication
- User registration and login
- JWT-based authentication
- Password hashing with bcrypt
- Profile editing
- Server (instance) selection during registration

### 👤 User Management
- User profiles
- Local and remote user discovery
- Edit profile
- Follow / Unfollow users
- Remote account lookup

### 📝 Posts
- Create posts
- Public timelines
- Personalized home timeline
- Infinite scrolling
- Reply support (foundation)
- Visibility levels

### 🌍 Federation (ActivityPub)
- ActivityPub Actor endpoints
- WebFinger discovery
- Inbox / Outbox endpoints
- Remote actor discovery
- Remote account following
- Remote unfollow (`Undo`)
- Remote post ingestion
- Remote timeline integration

### 🔒 Secure Federation
- RSA key pair generation per user
- HTTP Signature verification
- HTTP Signature generation
- SHA-256 Digest verification
- Signed ActivityPub requests

### ⚡ Background Processing
- BullMQ job queues
- Redis-backed asynchronous federation
- Delivery retries
- Background ActivityPub message delivery

### 🔔 Notifications
- Local notifications
- Federation notifications
- Real-time notifications using Server-Sent Events (SSE)
- Mark as read
- Mark all as read

### 🔍 Search
- Local user search
- Remote account lookup
- Cross-instance search
- Post search
- WebFinger-based discovery

### 🎨 Frontend
- Modern React UI
- Responsive layout
- Home feed
- Explore page
- Profile page
- Notifications
- Communities
- Bookmarks
- Settings
- Server selection interface

---

# 🏗 Architecture

```
                   ┌──────────────────────────┐
                   │       React Client       │
                   └────────────┬─────────────┘
                                │
                         REST + SSE APIs
                                │
        ┌───────────────────────┼────────────────────────┐
        │                       │                        │
        ▼                       ▼                        ▼
 Authentication           Post Service          Timeline Service
        │                       │                        │
        └──────────────┬────────┴──────────────┬────────┘
                       │                       │
                       ▼                       ▼
                ActivityPub Layer       Notification Service
                       │
              ┌────────┴────────┐
              ▼                 ▼
        HTTP Signatures     WebFinger
              │                 │
              ▼                 ▼
        BullMQ Worker     Remote Discovery
              │
              ▼
        Remote Instances
```

---

# 🚀 Tech Stack

## Frontend

- React
- React Router
- Tailwind CSS
- Axios
- Zustand

## Backend

- Node.js
- Express.js
- Prisma ORM
- PostgreSQL

## Federation

- ActivityPub
- WebFinger
- HTTP Signatures
- RSA Cryptography

## Queue

- Redis
- BullMQ

## Authentication

- JWT
- bcrypt

---


# 🔄 ActivityPub Implementation

Implemented federation components include:

- ✅ WebFinger
- ✅ ActivityPub Actor
- ✅ Inbox
- ✅ Outbox
- ✅ HTTP Signatures
- ✅ RSA Key Generation
- ✅ Remote Actor Discovery
- ✅ Remote Follow
- ✅ Remote Unfollow (Undo)
- ✅ Remote Post Delivery
- ✅ Signed Federation Requests
- ✅ BullMQ Delivery Queue

---

# 🔌 Implemented API Endpoints

## Authentication

```
POST   /auth/register
POST   /auth/login
GET    /auth/me
PATCH  /auth/me
```

---

## Posts

```
GET    /posts
POST   /posts
```

---

## Timeline

```
GET /timeline/home
```

---

## Follow

```
POST   /follows/:userId
DELETE /follows/:userId

GET    /follows/remote/lookup
POST   /follows/remote
DELETE /follows/remote/:remoteActorId
```

---

## Notifications

```
GET    /notifications
PATCH  /notifications/:id/read
POST   /notifications/read-all
GET    /notifications/stream
```

---

## Search

```
GET /search
```

---

## ActivityPub

```
GET  /.well-known/webfinger

GET  /users/:username

GET  /users/:username/outbox

POST /users/:username/inbox
```

---

# 🔐 Federation Flow

```
Remote Account Search
        │
        ▼
WebFinger Discovery
        │
        ▼
Fetch Actor Document
        │
        ▼
Store Remote Actor
        │
        ▼
Send Signed Follow
        │
        ▼
Remote Inbox
        │
        ▼
Accept Activity
        │
        ▼
Store Relationship
        │
        ▼
Receive Remote Posts
        │
        ▼
Update Home Timeline
```

---

# ⚙️ Getting Started

## Clone

```bash
git clone https://github.com/akarthiksagar/Fediverse.git
cd Fediverse
```

---

## Backend

```bash
cd server

npm install

npx prisma generate

npx prisma db push

npm run dev
```

---

## Frontend

```bash
cd client

npm install

npm run dev
```

---

## Start Redis

```bash
redis-server
```

---

## Start Worker

```bash
cd server

npm run worker
```

---


---


## 👨‍💻 Author

**A. Karthik Sagar**
