import { z } from 'zod';

export const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(2),
    role: z.enum(['ADMIN', 'PARTICIPANT']).optional(),
});

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

export const eventSchema = z.object({
    title: z.string().min(3),
    description: z.string().min(5),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    venue: z.string().optional(),
    maxTeamSize: z.number().int().min(1).optional(),
    capacity: z.number().int().min(1).optional(),
    registrationStart: z.string().datetime(),
    registrationEnd: z.string().datetime(),
    domain: z.string().optional(),
    tags: z.string().optional(),
    schedules: z.array(z.object({
        title: z.string().min(2),
        description: z.string().optional(),
        startTime: z.string().datetime(),
        endTime: z.string().datetime(),
        venue: z.string().optional(),
    })).optional(),
    customFields: z.array(z.object({
        label: z.string().min(1),
        type: z.enum(['TEXT', 'NUMBER', 'BOOLEAN']).default('TEXT'),
        required: z.boolean().default(true),
    })).optional(),
});

export const fieldValuesSchema = z.object({
    fieldId: z.string(),
    value: z.string(),
});

export const registerForEventSchema = z.object({
    fieldValues: z.array(fieldValuesSchema).optional(),
});
export const createTeamSchema = z.object({
    name: z.string().min(2),
});

export const joinTeamSchema = z.object({
    inviteCode: z.string(),
});

export const announcementSchema = z.object({
    message: z.string().min(5),
});
