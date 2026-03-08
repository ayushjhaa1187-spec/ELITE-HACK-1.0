import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
    return new PrismaClient();
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClientSingleton | undefined;
};

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

// Build Version: 1.0.1 (Unified Attendees & Share Logic)
export default prisma;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
