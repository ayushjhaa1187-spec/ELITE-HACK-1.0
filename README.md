# Circles 🚀

![Circles Logo](./cocreate_logo.png)

> **One platform. Every event. Zero chaos. No excuses.**

**CoCreate** is a full-stack Multi-Event Management Platform built for **Elite Hack 1.0 — Web Track at IIT Madras**. It centralizes event creation, participant registrations, team formation, notifications, and organiser dashboards into a single system — so every hackathon, fest, and workshop at an institute runs from the same place.

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](./LICENSE)

---

## 🧩 The Problem

Managing events at an institute is broken. Organisers juggle Google Forms, WhatsApp groups, and spreadsheets. Participants miss deadlines buried in chat threads. Teams get formed over DMs, eligibility is checked by hand, and attendance is tracked on paper.

**CoCreate fixes all of that — in one place.**

| 🏗️ For Organisers & Admins | 🎓 For Participants |
|:--- |:--- |
| **Fragmented Control**: Every event lives in its own form and group. | **Discovery Issues**: Events found through posters/spam, not a feed. |
| **Manual Verification**: Team eligibility is checked by hand. | **Registration Chaos**: No single "My Events" view. |
| **Outdated Tracking**: Manual attendance and reporting. | **Missing Updates**: Reschedules get buried in chat threads. |

---

## ✨ Core Features (MVP)

### 🗓️ Event Engine
Create and manage events end-to-end — schedules, venues, capacity, tags, and registration windows, all in one form. Participants can filter and discover events by domain (Web, AI, Blockchain, etc.).

### 👥 Team System
Generate unique invite codes, enforce team size rules, and handle join requests cleanly — no more losing codes over chat. Validation is fully automatic.

### 🔔 Smart Notifications
Email confirmations on registration plus an in-app notification centre for announcements, reminders, and team updates. Admins get alerts on new registrations in real time.

### 📊 Admin Dashboard
A real-time console for organisers — registration counts, attendance toggles, participant data, custom field responses, and QR-based check-in, all from one screen.

### 🎫 QR Check-in
Participants carry a QR code. Organisers scan it. The live dashboard count updates instantly. No clipboards, no spreadsheets.

### 🛡️ Role-based Access
JWT authentication with separate flows for `ADMIN` and `PARTICIPANT` roles. Organisers get creation and management rights; participants get discovery and registration.

---

## 🔁 User Flow

```mermaid
graph LR
    A[Admin creates event] --> B[Student browses feed]
    B --> C[Registers & forms team]
    C --> D[Email & Notification sent]
    D --> E[Reminders before deadline]
    E --> F[QR check-in at event]
```

---

## 🚀 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 / React — routing, shared components, fully responsive |
| **Backend** | Node.js + Express + TypeScript — REST APIs for auth, events, teams, notifications |
| **Database** | PostgreSQL via Supabase — relational schema for users, events, teams, registrations |
| **ORM** | Prisma |
| **Validation** | Zod |
| **API Docs** | Swagger / OpenAPI 3.0 |
| **Testing** | Jest + Supertest |

---

## 🛠️ Getting Started

### Prerequisites

- Node.js v18+
- npm
- A Supabase project (or local PostgreSQL instance)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/ayushjhaa1187-spec/ELITE-HACK-1.0.git
cd ELITE-HACK-1.0

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Fill in your DATABASE_URL, JWT_SECRET, etc.

# 4. Push the database schema
npx prisma db push

# 5. Start the development server
npm run dev
```

> 🌐 Server starts at `http://localhost:5000`  
> 📖 API docs available at `http://localhost:5000/api-docs`

---

## 📖 API Reference

Full interactive documentation is served via Swagger UI at `/api-docs`. Key route groups:

| Endpoint | Description |
|---|---|
| `POST /auth/register` · `POST /auth/login` | Authentication — admin & participant |
| `GET /events` · `POST /events` | Event listing and creation |
| `POST /events/:id/register` | Participant registration with custom fields |
| `POST /teams` · `POST /teams/join` | Team creation and invite-code join |
| `GET /admin/dashboard` | Live registrations and attendance stats |
| `POST /checkin/:eventId` | QR-based check-in, updates live count |
| `GET /notifications` | In-app notification feed |

---

## 🧪 Running Tests

```bash
npm test
```

Integration tests cover all critical user flows — auth, event CRUD, team operations, registration validation, and check-in.

---

## 📁 Project Structure

```text
├── prisma/
│   └── schema.prisma          # DB schema — users, events, teams, registrations, check-ins
├── src/
│   ├── routes/                # Route definitions (.ts)
│   ├── controllers/           # Business logic & controllers
│   ├── middlewares/           # JWT auth, role guards, error handling
│   ├── utils/                 # Security, Notifications, Services
│   ├── validators/            # Zod schemas for all request bodies
│   └── index.ts               # Server entry point
├── Frontend/                  # Static HTML/CSS files
├── tests/                      # Jest + Supertest integration tests
├── swagger.yaml                # OpenAPI 3.0 spec
├── vercel.json                 # Vercel deployment configuration
└── .env.example
```

---

## ✅ Project Status

### Shipped — MVP (Elite Hack 1.0)

- [x] Role-based JWT authentication (Admin / Participant)
- [x] Event creation, listing, search and domain filtering
- [x] Participant registration with custom dynamic fields
- [x] Team creation, invite codes, join flow, size validation
- [x] Email confirmation + in-app notification centre
- [x] Admin dashboard — live registration counts and participant data
- [x] QR check-in with real-time attendance toggle
- [x] Swagger / OpenAPI documentation
- [x] Full integration test suite (Jest + Supertest)

### 🔜 Roadmap

- [ ] Next.js frontend conversion
- [ ] Skill-based team discovery
- [ ] Cross-event participant graph
- [ ] Analytics dashboard
- [ ] Mobile app

## 🚀 Vercel Deployment

This project is configured for seamless deployment on **Vercel**.

1. **Connect your GitHub repo** to Vercel.
2. **Environment Variables**: Add `DATABASE_URL` (PostgreSQL) and `JWT_SECRET` in the Vercel Dashboard.
3. **Build Settings**: Vercel will automatically use the settings in `vercel.json` and `package.json`.
4. **Prisma**: The `postinstall` script handles Prisma client generation automatically.

---

> The MVP is the foundation. Every roadmap feature builds directly on top of what's already shipped — nothing gets thrown away.

---

## 👥 The Team — IIT Madras

Built at **IIT Madras** for **Elite Hack 1.0 — Web Track**.

| Name | Role |
|---|---|
| **Ayush Kumar Jha** | Backend & Databases — API design, schema, authentication, deployment |
| **Jahnvi Chauhan** | Frontend, UX & Presentation — screens, user flows, responsive UI, submission docs |

---

*Built with ❤️ for Elite Hack 1.0 · IIT Madras*

