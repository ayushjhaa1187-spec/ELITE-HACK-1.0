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

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Load Swagger document
const swaggerDocument = YAML.load(path.join(__dirname, '../swagger.yaml'));

// Swagger UI Endpoint
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authRoutes); // to match /api/users/me
app.use('/api/events', eventRoutes);
app.use('/api/admin/events', adminEventRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/admin/registrations', adminRegistrationRoutes);

app.get('/', (req, res) => {
    res.send('Multi-Event Management Platform API is running. Docs are available at /api-docs');
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(`[Error] ${err.name}: ${err.message}`);
    const statusCode = err.status || 500;
    res.status(statusCode).json({
        error: err.name || 'InternalServerError',
        message: err.message || 'Something went wrong on our end.',
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// Start the server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Server is running at http://localhost:${PORT}`);
        console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
    });
}

export default app;
