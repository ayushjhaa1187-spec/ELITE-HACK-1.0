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

// Environment Validation
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'];
REQUIRED_ENV.forEach(name => {
    if (!process.env[name]) {
        console.error(`[Error] Missing required environment variable: ${name}`);
        if (process.env.NODE_ENV === 'production') process.exit(1);
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

// Static file serving from 'public'
const publicPath = path.resolve(process.cwd(), 'public');
app.use(express.static(publicPath));

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

// Start the server only if not in test environment and not on Vercel
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server is running at http://localhost:${PORT}`);
        console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
    });
}

export default app;
