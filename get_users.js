const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            username: true,
            email: true,
            isActive: true,
            createdAt: true
        }
    });

    console.log("=== USUARIOS REGISTRADOS EN LA BASE DE DATOS ===");
    if (users.length === 0) {
        console.log("No hay usuarios registrados aún.");
    } else {
        console.table(users);
    }
}

main()
    .catch(e => {
        console.error(e);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
