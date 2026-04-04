# ELITE HACK 1.0

> Full-stack hackathon management platform with participant registration, admin panels, and real-time event coordination.

![build](https://img.shields.io/badge/build-passing-brightgreen) ![license](https://img.shields.io/badge/license-MIT-blue) ![stack](https://img.shields.io/badge/stack-Node.js%20%7C%20Prisma%20%7C%20Express-green)

## 🌐 Live Demo
**[Launch ELITE HACK →](https://elite-hack-1-0.vercel.app/)**

## 📖 The Story
> *"The hackathon registration was chaos — Google Forms, scattered spreadsheets, lost submissions. ELITE HACK brought order. One portal for registration. One dashboard for admins. Every team, every submission, every timeline—managed. The hackathon ran itself."*

## ✨ Features
| Feature | Description |
| :--- | :--- |
| **Participant Portal** | Self-service registration, team formation, and submission upload |
| **Admin Dashboard** | Real-time participant management, judging workflows, and analytics |
| **Swagger API Docs** | Fully documented REST API with OpenAPI specification |
| **Role-Based Access** | Separate views and permissions for participants, judges, and organizers |
| **Prisma ORM** | Type-safe database access with migration support |

## 🛠 Tech Stack
| Layer | Technology |
| :--- | :--- |
| Backend | Node.js, Express, TypeScript |
| ORM | Prisma |
| API Docs | Swagger / OpenAPI |
| Testing | Jest |
| Deployment | Vercel |

## 🚀 Quick Start
```bash
git clone https://github.com/ayushjhaa1187-spec/ELITE-HACK-1.0.git
cd ELITE-HACK-1.0
npm install
npx prisma db push
npm run dev
```

## 📁 Project Structure
```
├── api/                # Express route handlers
├── admin_pages/        # Admin dashboard views
├── participant_pages/  # Participant-facing pages
├── prisma/             # Database schema
├── src/                # Core business logic
├── tests/              # Jest test suites
├── swagger.yaml        # API documentation
└── vercel.json         # Deployment config
```

## 📄 License
MIT — Built by **ayushjhaa1187-spec**
