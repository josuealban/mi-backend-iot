import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const alerts = await prisma.alert.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { device: true }
    });
    console.log('--- ÚLTIMAS 5 ALERTAS ---');
    console.log(JSON.stringify(alerts, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
