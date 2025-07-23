
'use server';

import { db } from '@/lib/firebase';
import { collection, writeBatch, getDocs, doc, query } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';

const collectionsToClear = [
  'acciones', 'actividades', 'areas', 'departamentos', 'politicas',
  'procedimientos', 'procesos', 'puestos', 'sistemas', 'sistemas_costos',
  'access_exceptions', 'activity_log', 'audits', 'counters', 'sync_events'
];

async function clearDatabase() {
  console.log('Iniciando limpieza de colecciones operativas...');

  for (const collectionName of collectionsToClear) {
    try {
      console.log(`Procesando colección: "${collectionName}"...`);
      const q = query(collection(db, collectionName));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log(`Colección "${collectionName}" ya está vacía.`);
        continue;
      }

      let batch = writeBatch(db);
      let count = 0;

      for (const docSnapshot of querySnapshot.docs) {
        batch.delete(docSnapshot.ref);
        count++;
        if (count === 500) {
          console.log(`Confirmando lote de 500 eliminaciones para "${collectionName}"...`);
          await batch.commit();
          // Iniciar un nuevo lote para las siguientes operaciones
          batch = writeBatch(db);
          count = 0;
        }
      }

      // Confirmar cualquier operación restante en el último lote
      if (count > 0) {
        console.log(`Confirmando lote final de ${count} eliminaciones para "${collectionName}".`);
        await batch.commit();
      }
      
      console.log(`Colección "${collectionName}" limpiada exitosamente.`);

    } catch (error) {
        console.warn(`Error al limpiar la colección "${collectionName}":`, error);
    }
  }
  
  console.log('Limpieza de todas las colecciones operativas completada.');
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
