import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';

import authRoutes from './routes/authRoutes';
import eventRoutes from './routes/eventRoutes';
import adminEventRoutes from './routes/adminEventRoutes';
import teamRoutes from './routes/teamRoutes';
import adminRegistrationRoutes from './routes/adminRegistrationRoutes';
import prisma from './utils/prisma';

// Import controllers for additional routes
import { getNotifications } from './controllers/dashboardController';
import { authenticate } from './middlewares/authMiddleware';

// Environment Validation
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'];
REQUIRED_ENV.forEach((name) => {
    if (!process.env[name]) {
        console.error(`[CRITICAL] Missing environment variable: ${name}`);
        // Removed process.exit(1) to prevent Vercel 500 FUNCTION_INVOCATION_FAILED crash
        // if user forgets to set JWT_SECRET immediately.
    }
});

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet({
    contentSecurityPolicy: false,
}));
app.use(cors());
app.use(express.json());

// Load Swagger document
try {
    const swaggerPath = path.join(process.cwd(), 'swagger.yaml');
    const swaggerDocument = YAML.load(swaggerPath);
    // Swagger UI Endpoint
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (error) {
    console.warn('[Warning] Failed to load swagger.yaml. /api-docs will be unavailable.');
}

// Simple Request Logger
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authRoutes); // to match /api/users/me
app.use('/api/events', eventRoutes);
app.use('/api/admin/events', adminEventRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/admin/registrations', adminRegistrationRoutes);

// Additional user routes
app.get('/api/users/me/notifications', authenticate, getNotifications);

// Static file serving from 'public' and 'admin_pages'
const publicPath = path.resolve(process.cwd(), 'public');
const adminPagesPath = path.resolve(process.cwd(), 'admin_pages');
app.use(express.static(publicPath));
app.use(express.static(adminPagesPath));

// Also serve with folder prefix for hardcoded links
app.use('/admin_pages', express.static(adminPagesPath));
app.use('/participant_pages', express.static(path.resolve(process.cwd(), 'participant_pages')));
app.use('/public', express.static(publicPath));

// Explicit Frontend Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(publicPath, 'Dashboard.html'));
});

app.get('/scanner', (req, res) => {
    res.sendFile(path.join(publicPath, 'Scanner.html'));
});

app.get('/events', (req, res) => {
    res.sendFile(path.join(adminPagesPath, 'Events.html'));
});

app.get('/attendees', (req, res) => {
    res.sendFile(path.join(adminPagesPath, 'Attendees.html'));
});

app.get('/analytics', (req, res) => {
    res.sendFile(path.join(adminPagesPath, 'Analytics.html'));
});

app.get('/settings', (req, res) => {
    res.sendFile(path.join(adminPagesPath, 'Settings.html'));
});

app.get('/profile', (req, res) => {
    res.sendFile(path.join(adminPagesPath, 'Profile.html'));
});


// Regulatory & Info Pages
app.get('/privacy', (req, res) => {
    res.sendFile(path.join(publicPath, 'Privacy.html'));
});

app.get('/terms', (req, res) => {
    res.sendFile(path.join(publicPath, 'Terms.html'));
});

app.get('/status', (req, res) => {
    res.sendFile(path.join(publicPath, 'Status.html'));
});

// Participant Pages
app.get('/participant', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'participant_pages', 'MyEvents.html'));
});

// Admin Redirect
app.get('/admin', (req, res) => {
    res.redirect('/dashboard');
});

// Health Check
app.get('/api/health', async (req, res) => {
    try {
        // Simple DB probe
        await prisma.$queryRaw`SELECT 1`;
        res.json({
            status: 'OK',
            message: 'API and Database are healthy',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[HealthCheck Error]', error);
        res.status(503).json({
            status: 'Error',
            message: 'Database connection failed',
            timestamp: new Date().toISOString()
        });
    }
});

// 404 Handler for API
app.use('/api', (req: express.Request, res: express.Response) => {
    res.status(404).json({
        error: 'NotFound',
        message: `Route ${req.method} ${req.url} not found`
    });
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(`[Error] ${err.name}: ${err.message}`);

    // Handle Prisma Errors
    if (err.code && err.code.startsWith('P')) {
        if (err.code === 'P2002') {
            return res.status(409).json({
                error: 'Conflict',
                message: `Unique constraint failed on field: ${err.meta?.target || 'unknown'}`
            });
        }
        if (err.code === 'P2025') {
            return res.status(404).json({
                error: 'NotFound',
                message: 'Record not found'
            });
        }
    }

    const statusCode = err.status || 500;
    res.status(statusCode).json({
        error: err.name || 'InternalServerError',
        message: err.message || 'Something went wrong on our end.',
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// Start local dev server only outside production/test environments.
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Server is running at http://localhost:${PORT}`);
        console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
    });
}

// For Vercel — must export the app
export default app;
