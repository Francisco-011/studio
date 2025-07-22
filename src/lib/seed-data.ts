
'use server';

import { db } from './firebase';
import { collection, writeBatch, getDocs, doc, query } from 'firebase/firestore';

const collectionsToClear = [
  'acciones', 'actividades', 'areas', 'departamentos', 'politicas',
  'procedimientos', 'procesos', 'puestos', 'sistemas', 'sistemas_costos',
  'access_exceptions', 'activity_log', 'audits', 'counters'
  // 'users' and 'permissions' are intentionally excluded
];

async function clearCollections() {
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

export async function seedDatabase() {
  // Esta función ahora solo limpia la base de datos y no carga datos nuevos.
  await clearCollections();
  console.log('La base de datos ha sido limpiada exitosamente.');
}
