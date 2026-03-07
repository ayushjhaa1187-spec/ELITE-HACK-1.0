# TODO: ELITE-HACK-1.0 Implementation

## Phase 1 — Make Backend Actually Reachable (Vercel Config)

- [x] 1.1 Fix vercel.json - ✅ Fixed: removed filesystem handler, added scanner route
- [x] 1.2 Fix src/index.ts Entry Point - ✅ Already exports default app for Vercel
- [x] 1.3 Fix package.json - ✅ Already has postinstall: "prisma generate"
- [ ] 1.4 Set Vercel Environment Variables (USER ACTION REQUIRED)
- [x] 1.5 Update schema.prisma - ✅ Already has directUrl configured
- [ ] 1.6 Test Backend is Alive

## Phase 2 — Wire Authentication (Fixes Bugs #3, #4, #5)

- [x] 2.1 Create /public/register.html - ✅ Already exists
- [x] 2.2 Fix Sign-In Modal to call API properly - ✅ Calls /api/auth/login
- [x] 2.3 Remove "Full Name" from Sign-In Modal - ✅ Login-only modal
- [x] 2.4 Fix the Register Link - ✅ Points to /register.html

