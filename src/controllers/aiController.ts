import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../utils/prisma';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const generateBroadcast = async (req: Request, res: Response) => {
    const { raw_intent, event } = req.body;

    if (!raw_intent) {
        return res.status(400).json({ error: 'Raw intent is required' });
    }

    try {
        const prompt = `
      You are a professional event communications writer for '${event.name}'.
      Event Date: ${event.date} | Venue: ${event.venue}.

      Admin's raw intent: "${raw_intent}"

      Generate a broadcast message based on the admin's intent.
      Respond ONLY in this JSON format (no markdown, no extra text):
      {
        "subject": "<email subject line>",
        "email_body": "<full email body with greeting and sign-off>",
        "whatsapp_body": "<concise WhatsApp message with emojis, max 200 chars>"
      }
    `;

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // Strip markdown code fences if Gemini wraps in ```json ... ```
        const clean = text.replace(/^```json|```$/gm, '').trim();
        const parsed = JSON.parse(clean);

        res.json(parsed);
    } catch (error: any) {
        console.error('[AI] Broadcast generation error:', error);
        res.status(500).json({ error: 'AI unavailable, please type manually' });
    }
};

export const generateEventReport = async (req: Request, res: Response) => {
    const { eventId } = req.body;

    if (!eventId) {
        return res.status(400).json({ error: 'Event ID is required' });
    }

    try {
        // STEP 1: Pull all data from DB
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: {
                registrations: {
                    include: {
                        user: true
                    }
                }
            }
        });

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const attendees = event.registrations;
        const checkins = attendees.filter(a => a.status === 'CHECKED_IN');
        const noShows = attendees.filter(a => a.status !== 'CHECKED_IN');

        // Compute peak check-in hour (mocked as we don't have checkedAt in schema yet, using updatedAt as proxy)
        const hourBuckets: Record<number, number> = {};
        checkins.forEach(a => {
            const hour = new Date(a.updatedAt).getHours();
            hourBuckets[hour] = (hourBuckets[hour] || 0) + 1;
        });
        const peakHourEntry = Object.entries(hourBuckets)
            .sort((a, b) => b[1] - a[1])[0];

        // STEP 3: Build metrics object
        const metrics = {
            event_name: event.title,
            event_date: event.startDate,
            venue: event.venue,
            total_registered: attendees.length,
            total_checked_in: checkins.length,
            attendance_rate: attendees.length > 0 ? ((checkins.length / attendees.length) * 100).toFixed(1) + '%' : '0%',
            no_shows: noShows.length,
            peak_hour: peakHourEntry ? `${peakHourEntry[0]}:00 (${peakHourEntry[1]} check-ins)` : 'N/A'
        };

        // STEP 4: Build Gemini prompt
        const prompt = `
      You are a professional event analyst for the platform 'Circles'.
      Write a post-event summary report for the following event data.
      Use a professional tone.
      Structure the report into exactly 4 sections:
        1. Event Overview
        2. Attendance Analysis
        3. Key Insights
        4. Recommendations for Next Event

      Event Data:
      ${JSON.stringify(metrics, null, 2)}
    `;

        // STEP 5: Call Gemini API
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(prompt);
        const report_text = result.response.text();

        res.json({ report: report_text, metrics });
    } catch (error: any) {
        console.error('[AI] Report generation error:', error);
        res.status(500).json({ error: 'Failed to generate AI report' });
    }
};
