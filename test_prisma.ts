import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('Available models in prisma:', Object.keys(prisma).filter(k => (prisma as any)[k] && typeof (prisma as any)[k] === 'object' && 'findFirst' in (prisma as any)[k]));
    process.exit(0);
}

main().catch(err => {
    console.error('Error starting prisma:', err);
    process.exit(1);
});
