'use server';

import { seedDatabase } from '@/lib/seed-data';
import { revalidatePath } from 'next/cache';

export async function runSeed() {
  try {
    await seedDatabase();
    // Revalidate all paths to reflect new data
    revalidatePath('/', 'layout');
    return { success: true, message: 'Base de datos poblada con datos de prueba exitosamente.' };
  } catch (error: any) {
    console.error("Error seeding database:", error);
    return { success: false, message: `Error al poblar la base de datos: ${error.message}` };
  }
}
