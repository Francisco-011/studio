
'use server';

import { db } from '@/lib/firebase';
import { collection, writeBatch, getDocs, doc, query } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';

const collectionsToClear = [
  'acciones', 'actividades', 'areas', 'departamentos', 'politicas',
  'procedimientos', 'procesos', 'puestos', 'sistemas', 'sistemas_costos',
  'access_exceptions', 'activity_log', 'audits', 'counters', 'sync_events'
  // 'users' and 'permissions' are intentionally excluded
];

async function clearDatabase() {
  console.log('Iniciando limpieza de colecciones operativas...');
  const batch = writeBatch(db);

  for (const collectionName of collectionsToClear) {
    try {
      const q = query(collection(db, collectionName));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        console.log(`Limpiando colección: "${collectionName}"...`);
        querySnapshot.forEach((docSnapshot) => {
          batch.delete(docSnapshot.ref);
        });
      }
    } catch (error) {
        console.warn(`No se pudo acceder a la colección "${collectionName}" para limpiarla (puede que no exista):`, error);
    }
  }
  
  await batch.commit();
  console.log('Las colecciones operativas han sido limpiadas.');
}


export async function runSeed() {
  try {
    await clearDatabase();
    // Revalidate all paths to reflect new data
    revalidatePath('/', 'layout');
    return { success: true, message: 'La base de datos ha sido limpiada exitosamente.' };
  } catch (error: any) {
    console.error("Error clearing the database:", error);
    return { success: false, message: `Error al limpiar la base de datos: ${error.message}` };
  }
}
