import { beforeAll, afterAll, describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../src/index';
import prisma from '../src/utils/prisma';
import crypto from 'crypto';

beforeAll(async () => {
    // wait for any asynchronous loading/connections to cool down if needed
});

afterAll(async () => {
    // clean up — order matters due to FK constraints
    await prisma.announcement.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.fieldValue.deleteMany();
    await prisma.teamMember.deleteMany();
    await prisma.team.deleteMany();
    await prisma.registration.deleteMany();
    await prisma.customField.deleteMany();
    await prisma.scheduleItem.deleteMany();
    await prisma.event.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.user.deleteMany();
});

describe('Integration Tests', () => {
    let adminToken: string;
    let participantToken1: string;
    let participantToken2: string;
    let createdEventId: string;
    let teamInviteCode: string;

    const emailSalt = crypto.randomBytes(4).toString('hex');
    const adminEmail = `admin_${emailSalt}@test.com`;
    const p1Email = `p1_${emailSalt}@test.com`;
    const p2Email = `p2_${emailSalt}@test.com`;

    it('should create users', async () => {
        const adminRes = await request(app).post('/api/auth/register').send({
            name: 'Admin User',
            email: adminEmail,
            password: 'password123',
            role: 'ADMIN' // Only works because we allow it in payload
        });
        expect(adminRes.status).toBe(201);
        adminToken = adminRes.body.token;

        const p1Res = await request(app).post('/api/auth/register').send({
            name: 'P1 User',
            email: p1Email,
            password: 'password123',
            role: 'PARTICIPANT'
        });
        expect(p1Res.status).toBe(201);
        participantToken1 = p1Res.body.token;

        const p2Res = await request(app).post('/api/auth/register').send({
            name: 'P2 User',
            email: p2Email,
            password: 'password123',
            role: 'PARTICIPANT'
        });
        expect(p2Res.status).toBe(201);
        participantToken2 = p2Res.body.token;
    });

    it('Role-based Access Control (Participant cannot access Admin routes)', async () => {
        const eventRes = await request(app)
            .post('/api/admin/events')
            .set('Authorization', `Bearer ${participantToken1}`)
            .send({
                title: 'Secret Event',
                description: 'Only admin can make this',
                startDate: new Date().toISOString(),
                endDate: new Date().toISOString(),
                maxTeamSize: 1
            });

        expect(eventRes.status).toBe(403);
    });

    it('Validation parameters (Required fields for event creation)', async () => {
        const eventRes = await request(app)
            .post('/api/admin/events')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                title: 'Invalid',
                // missing description and dates
            });

        expect(eventRes.status).toBe(400);
    });

    it('Admin can successfully create an event with schedules and custom fields', async () => {
        const registrationStart = new Date();
        const registrationEnd = new Date();
        registrationEnd.setDate(registrationEnd.getDate() + 1);

        const startDate = new Date();
        startDate.setDate(startDate.getDate() + 2);
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 3);

        const eventRes = await request(app)
            .post('/api/admin/events')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                title: 'Tech Hack',
                description: 'Advanced Hackathon',
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                registrationStart: registrationStart.toISOString(),
                registrationEnd: registrationEnd.toISOString(),
                maxTeamSize: 1,
                schedules: [
                    {
                        title: 'Opening Ceremony',
                        startTime: startDate.toISOString(),
                        endTime: new Date(startDate.getTime() + 3600000).toISOString(),
                        venue: 'Main Hall'
                    }
                ],
                customFields: [
                    {
                        label: 'T-Shirt Size',
                        type: 'TEXT',
                        required: true
                    }
                ]
            });

        expect(eventRes.status).toBe(201);
        createdEventId = eventRes.body.id;
        expect(eventRes.body.customFields).toHaveLength(1);
        expect(eventRes.body.schedules).toHaveLength(1);
    });

    it('Registration validation (Fail if required custom fields are missing)', async () => {
        const regRes = await request(app)
            .post(`/api/events/${createdEventId}/register`)
            .set('Authorization', `Bearer ${participantToken2}`)
            .send({ fieldValues: [] });

        expect(regRes.status).toBe(400);
        expect(regRes.body.error).toBe('Missing required registration fields');
    });

    it('Registration validation (Succeed with custom fields)', async () => {
        const fieldId = (await prisma.customField.findFirst({ where: { eventId: createdEventId } }))?.id;

        const regRes = await request(app)
            .post(`/api/events/${createdEventId}/register`)
            .set('Authorization', `Bearer ${participantToken2}`)
            .send({
                fieldValues: [
                    { fieldId, value: 'Large' }
                ]
            });

        expect(regRes.status).toBe(201);
        expect(regRes.body.registration.fieldValues).toHaveLength(1);
    });

    it('Registration window logic (Cannot register if window is closed)', async () => {
        // Create an event with a passed registration window
        const pastStart = new Date();
        pastStart.setDate(pastStart.getDate() - 5);
        const pastEnd = new Date();
        pastEnd.setDate(pastEnd.getDate() - 2);

        const eventRes = await request(app)
            .post('/api/admin/events')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                title: 'Past Event',
                description: 'Registration already closed',
                startDate: new Date().toISOString(),
                endDate: new Date().toISOString(),
                registrationStart: pastStart.toISOString(),
                registrationEnd: pastEnd.toISOString(),
                maxTeamSize: 5
            });

        const pastEventId = eventRes.body.id;

        const regRes = await request(app)
            .post(`/api/events/${pastEventId}/register`)
            .set('Authorization', `Bearer ${participantToken1}`);

        expect(regRes.status).toBe(400);
        expect(regRes.body.error).toBe('Registration is not open for this event');
    });

    it('Participant 1 creates a team within registration window', async () => {
        const createTeamRes = await request(app)
            .post(`/api/events/${createdEventId}/teams`)
            .set('Authorization', `Bearer ${participantToken1}`)
            .send({ name: 'Team Alpha' });

        if (createTeamRes.status !== 201) {
            console.log('Create team failed:', createTeamRes.body);
            console.log('Event ID used:', createdEventId);
        }

        expect(createTeamRes.status).toBe(201);
        teamInviteCode = createTeamRes.body.team.inviteCode;
    });

    it('Team capacity logic (Cannot join a team if maxTeamSize is reached)', async () => {
        const joinRes = await request(app)
            .post(`/api/teams/join`)
            .set('Authorization', `Bearer ${participantToken2}`)
            .send({ inviteCode: teamInviteCode });

        expect(joinRes.status).toBe(400);
        expect(joinRes.body.error).toBe('Team is already full');
    });

    // ───────────────────────────────────────────
    // EDGE CASE TESTS (Ayush — Phase 8)
    // ───────────────────────────────────────────

    it('Duplicate registration (User cannot register for the same event twice)', async () => {
        // participantToken2 already registered in a previous test
        const fieldId = (await prisma.customField.findFirst({ where: { eventId: createdEventId } }))?.id;

        const regRes = await request(app)
            .post(`/api/events/${createdEventId}/register`)
            .set('Authorization', `Bearer ${participantToken2}`)
            .send({
                fieldValues: [{ fieldId, value: 'Medium' }]
            });

        expect(regRes.status).toBe(400);
        expect(regRes.body.error).toBe('User is already registered for this event');
    });

    it('Login with wrong password returns 401', async () => {
        const loginRes = await request(app).post('/api/auth/login').send({
            email: adminEmail,
            password: 'wrong_password'
        });

        expect(loginRes.status).toBe(401);
        expect(loginRes.body.error).toBe('Invalid credentials');
    });

    it('Login with non-existent email returns 401', async () => {
        const loginRes = await request(app).post('/api/auth/login').send({
            email: 'nonexistent@test.com',
            password: 'password123'
        });

        expect(loginRes.status).toBe(401);
        expect(loginRes.body.error).toBe('Invalid credentials');
    });

    it('Unauthenticated request to protected route returns 401', async () => {
        const res = await request(app).get('/api/users/me');
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Authentication required');
    });

    it('Invalid token returns 401', async () => {
        const res = await request(app)
            .get('/api/users/me')
            .set('Authorization', 'Bearer invalid.jwt.token');
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid or expired token');
    });

    it('Get event details returns full event data', async () => {
        const res = await request(app).get(`/api/events/${createdEventId}`);
        expect(res.status).toBe(200);
        expect(res.body.title).toBe('Tech Hack');
        expect(res.body.customFields).toBeDefined();
        expect(res.body.schedules).toBeDefined();
    });

    it('Get event details for non-existent event returns 404', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        const res = await request(app).get(`/api/events/${fakeId}`);
        expect(res.status).toBe(404);
    });

    it('Public events listing returns events as array', async () => {
        const res = await request(app).get('/api/events');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('Admin can view event stats', async () => {
        const res = await request(app)
            .get(`/api/admin/events/${createdEventId}/stats`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.totalRegistrations).toBeGreaterThanOrEqual(1);
        expect(typeof res.body.attendanceRate).toBe('number');
    });

    it('Participant cannot access admin stats', async () => {
        const res = await request(app)
            .get(`/api/admin/events/${createdEventId}/stats`)
            .set('Authorization', `Bearer ${participantToken1}`);

        expect(res.status).toBe(403);
    });

    let registrationIdForCheckIn: string;

    it('Admin can view attendees list', async () => {
        const res = await request(app)
            .get(`/api/admin/events/${createdEventId}/attendees`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.registrations).toBeDefined();
        expect(Array.isArray(res.body.registrations)).toBe(true);

        // Save a registration ID for check-in test
        if (res.body.registrations.length > 0) {
            registrationIdForCheckIn = res.body.registrations[0].id;
        }
    });

    it('Admin can check-in a participant', async () => {
        if (!registrationIdForCheckIn) {
            console.log('Skipping: no registration found for check-in');
            return;
        }

        const res = await request(app)
            .post(`/api/admin/registrations/${registrationIdForCheckIn}/checkin`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.registration.status).toBe('CHECKED_IN');
    });

    it('Admin can create an announcement', async () => {
        const res = await request(app)
            .post(`/api/admin/events/${createdEventId}/announcements`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ message: 'Welcome to the hackathon! Check-in starts at 9am.' });

        expect(res.status).toBe(201);
        expect(res.body.announcement).toBeDefined();
    });

    it('Public can view event announcements', async () => {
        const res = await request(app)
            .get(`/api/events/${createdEventId}/announcements`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('User can fetch their own registrations', async () => {
        const res = await request(app)
            .get('/api/users/me/registrations')
            .set('Authorization', `Bearer ${participantToken2}`);

        expect(res.status).toBe(200);
        expect(res.body.registrations).toBeDefined();
        expect(Array.isArray(res.body.registrations)).toBe(true);
    });

    it('User can fetch their notifications', async () => {
        const res = await request(app)
            .get('/api/users/me/notifications')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('Participant cannot create an event', async () => {
        const res = await request(app)
            .post('/api/admin/events')
            .set('Authorization', `Bearer ${participantToken2}`)
            .send({
                title: 'Hacked Event',
                description: 'Should not work',
                startDate: new Date().toISOString(),
                endDate: new Date().toISOString(),
                registrationStart: new Date().toISOString(),
                registrationEnd: new Date().toISOString(),
                maxTeamSize: 3
            });

        expect(res.status).toBe(403);
    });

    it('Admin can send reminders to registered participants', async () => {
        const res = await request(app)
            .post(`/api/admin/events/${createdEventId}/reminders`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('Reminder sent');
    });

    it('Registration with invalid custom field type returns 400', async () => {
        // Create an event with a NUMBER custom field
        const regStart = new Date();
        const regEnd = new Date();
        regEnd.setDate(regEnd.getDate() + 1);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + 2);
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 3);

        const eventRes = await request(app)
            .post('/api/admin/events')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                title: 'Number Field Event',
                description: 'Event with a number field',
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                registrationStart: regStart.toISOString(),
                registrationEnd: regEnd.toISOString(),
                maxTeamSize: 5,
                customFields: [
                    { label: 'Age', type: 'NUMBER', required: true }
                ]
            });

        expect(eventRes.status).toBe(201);
        const numEventId = eventRes.body.id;
        const numFieldId = eventRes.body.customFields[0].id;

        // Try registering with a non-number value for the NUMBER field
        const regRes = await request(app)
            .post(`/api/events/${numEventId}/register`)
            .set('Authorization', `Bearer ${participantToken1}`)
            .send({
                fieldValues: [{ fieldId: numFieldId, value: 'not-a-number' }]
            });

        expect(regRes.status).toBe(400);
        expect(regRes.body.error).toContain('must be a number');
    });

    it('Admin can get their own profile via /me', async () => {
        const res = await request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.email).toBe(adminEmail);
        expect(res.body.role).toBe('ADMIN');
        expect(res.body.profile).toBeDefined();
    });

    it('Admin can get ticket for registered participant', async () => {
        const res = await request(app)
            .get(`/api/events/${createdEventId}/ticket`)
            .set('Authorization', `Bearer ${participantToken2}`);

        expect(res.status).toBe(200);
        expect(res.body.ticketId).toBeDefined();
        expect(res.body.eventName).toBe('Tech Hack');
    });

    it('Unregistered user cannot get ticket', async () => {
        // participantToken1 never registered individually (only created a team)
        // Let's use a fresh event where p1 has not registered
        const res = await request(app)
            .get(`/api/events/${createdEventId}/ticket`)
            .set('Authorization', `Bearer ${participantToken1}`);

        expect(res.status).toBe(404);
    });

    it('Duplicate user registration (same email) returns 400', async () => {
        const regRes = await request(app).post('/api/auth/register').send({
            name: 'Admin Duplicate',
            email: adminEmail,
            password: 'password123',
            role: 'ADMIN'
        });

        expect(regRes.status).toBe(400);
        expect(regRes.body.error).toBe('User already exists');
    });
});
