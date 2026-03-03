import { beforeAll, afterAll, describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../src/index';
import prisma from '../src/utils/prisma';
import crypto from 'crypto';

beforeAll(async () => {
    // wait for any asynchronous loading/connections to cool down if needed
});

afterAll(async () => {
    // clean up
    await prisma.announcement.deleteMany();
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
});
