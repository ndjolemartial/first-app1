const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const db = new PrismaClient();

async function main() {
  try {
    const prospects = await db.prospect.findMany({
      take: 10,
      include: { tags: { include: { tag: true } } },
      orderBy: { createdAt: 'desc' },
    });
    console.log('Prospects trouvés:', prospects.length);
    console.log(JSON.stringify(prospects.map(p => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      status: p.status,
      source: p.source,
      deletedAt: p.deletedAt,
    })), null, 2));
  } catch (e) {
    console.error('ERREUR Prisma:', e.message);
  } finally {
    await db.$disconnect();
  }
}

main();
