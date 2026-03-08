# Círcles 🚀 — Intelligent Multi-Event Management Platform

![Circles Banner](./public/circles.png)

> **Círcles** is a high-performance, enterprise-ready event management ecosystem. Designed for speed, scalability, and seamless user experience, it replaces fragmented spreadsheets and manual tracking with a unified, real-time command center.

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com/)

---

## 🏗️ System Architecture

Círcles follows a modern **decoupled architecture** optimized for cloud-native deployment:

-   **Business Logic Layer**: A robust Node.js/Express backend written in TypeScript, ensuring type safety across all API boundaries.
-   **Data Persistence**: A relational PostgreSQL database managed via Prisma ORM for efficient schema migrations and type-safe queries.
-   **Frontend Layer**: A lightweight, performant UI built with Vanilla JS and CSS, utilizing a multipage architecture to minimize bundle size and maximize SEO/performance.
-   **Security Architecture**: Stateless authentication using JWT (JSON Web Tokens) with a layered Role-Based Access Control (RBAC) system.

---

## ⚙️ Core Technical Capabilities

### 📊 Real-Time Analytics Engine
Admins gain instant insights through a live-updating dashboard. 
-   **Metric Correlation**: Real-time aggregation of registration trends vs. check-in rates.
-   **Time-Series Tracking**: Growth analytics visualized via Chart.js, powered by optimized backend SQL aggregations.
-   **Live Pulse**: A low-latency activity feed tracking attendee interactions as they happen.

### 🎫 Operations & QR Workflow
The check-in process is digitized for zero-friction event entry:
1.  **Generation**: Unique, encrypted QR codes generated for every registration.
2.  **Verification**: Mobile-responsive scanner interface for ground staff.
3.  **Synchronization**: Instant database state updates that reflect globally on admin dashboards.

### 👥 Advanced Team Management
-   **Invite Logic**: Secure invite codes for private team formation.
-   **Constraint Enforcement**: Automated validation of team size and eligibility rules.
-   **Dynamic Fields**: Support for event-specific custom registration data (e.g., dietary needs, skill levels).

---

## 🛣️ Workflow & Technical Logic

```mermaid
sequenceDiagram
    participant Admin
    participant System
    participant Database
    participant Participant

    Admin->>System: Create Event (Settings, Custom Fields)
    System->>Database: Persist Event Schema
    Participant->>System: Register / Form Team
    System->>Database: Validate & Commit Registration
    System-->>Participant: Issue Ticket (QR Code)
    Participant->>Admin: Entry Scan
    Admin->>System: Scan QR (Auth & Check-in)
    System->>Database: Update Check-in State
    System-->>Admin: Update Analytics (Live Pulse)
```

---

## 🚀 Deployment & Feasibility

### Cloud Edge Readiness
The system is fully optimized for **Vercel** and **Edge Runtime**. Static assets are served via a global CDN, while the API logic handles thousands of concurrent requests with minimal cold-start overhead.

### Technical Feasibility
-   **Scalability**: The use of PostgreSQL with indexing on `eventId` and `userId` ensures performance even with 10k+ attendees.
-   **Portability**: Docker-ready environment and Prisma-based portability mean it can run on AWS, GCP, or on-premise with zero code changes.

---

## 🛠️ Implementation Details

| Stack Component | Implementation |
|:--- |:--- |
| **Language** | TypeScript (Strict Mode) |
| **Framework** | Express.js 5.x |
| **ORM** | Prisma (PostgreSQL) |
| **Validation** | Zod (Runtime Schema Validation) |
| **Auth** | JWT + BcryptJS |
| **Testing** | Jest + Supertest (End-to-End) |
| **Documentation** | Swagger / OpenAPI 3.0 |

---

## 🏃 Getting Started

### 1. Environment Configuration
Create a `.env` file based on `.env.example`:
```bash
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
JWT_SECRET="your_secure_secret"
```

### 2. Manual Installation
```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

---

## ⚖️ Security & Feasibility

-   **Data Integrity**: Enforced via relational constraints and Prisma-managed transactions.
-   **Stateless Scaling**: JWT-based auth allows services to scale horizontally without session synchronization.
-   **CSRF/XSS Protection**: Implemented via `helmet` and strict input sanitization.

---

*Círcles — Built for the next generation of event management.*
