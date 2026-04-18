import { PrismaClient } from '@prisma/client';

const defaultDepartments = [
  { slug: 'administrativo', name: 'Administrativo', isRoot: true, color: '#1E3A5F' },
  { slug: 'laboratorio', name: 'Laboratorio', isRoot: false, color: '#2E86AB' },
  { slug: 'comercial', name: 'Comercial', isRoot: false, color: '#27AE60' },
  { slug: 'financeiro', name: 'Financeiro', isRoot: false, color: '#E67E22' },
];

export async function seedDepartments(prisma: PrismaClient, companyId: string) {
  for (const dept of defaultDepartments) {
    await prisma.department.upsert({
      where: {
        companyId_slug: { companyId, slug: dept.slug },
      },
      update: {},
      create: {
        companyId,
        name: dept.name,
        slug: dept.slug,
        isRoot: dept.isRoot,
        color: dept.color,
        maxAgents: 10,
      },
    });
  }
  console.log(`Departments seeded for company ${companyId}`);
}
