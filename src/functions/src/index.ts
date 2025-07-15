
/**
 * @fileoverview Cloud Functions para gestionar la autenticación y permisos de usuarios.
 * - setUserRole: Asigna Custom Claims (rol, nivelAcceso, etc.) a un usuario.
 * - setupFirstAdmin: Configura el primer usuario administrador del sistema.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initializeApp, App } from "firebase-admin/app";

// Inicializar Firebase Admin SDK
let adminApp: App;
try {
  adminApp = initializeApp();
} catch (e) {
  // SDK ya inicializado, no hacer nada.
}
const db = getFirestore();

/**
 * Cloud Function para asignar Custom Claims a un usuario.
 * Solo los administradores pueden ejecutar esta función.
 */
exports.setUserRole = onCall(async (request) => {
  // 1. Validar que quien llama es un Administrador
  if (request.auth?.token?.rol !== "Administrador") {
    throw new HttpsError(
      "permission-denied",
      "Solo los Administradores pueden ejecutar esta acción."
    );
  }

  // 2. Validar los datos de entrada
  const { userId, rol, nivelAcceso, puestoId } = request.data;
  if (!userId || !rol || !nivelAcceso) {
    throw new HttpsError(
      "invalid-argument",
      "La función debe ser llamada con 'userId', 'rol' y 'nivelAcceso'."
    );
  }

  try {
    // 3. Obtener el departamento y área del puesto para sellarlos en el token
    let departamentoId: string | undefined;
    let areaId: string | undefined;

    if (puestoId) {
      const puestoDoc = await db.collection("puestos").doc(puestoId).get();
      if (puestoDoc.exists) {
        const puestoData = puestoDoc.data();
        departamentoId = puestoData?.departamentoId;
        areaId = puestoData?.areaId;
      }
    }

    // 4. Asignar los Custom Claims al usuario
    await getAuth().setCustomUserClaims(userId, {
      rol,
      nivelAcceso,
      departamentoId: departamentoId || null,
      areaId: areaId || null,
      puestoId: puestoId || null,
      lastClaimUpdate: new Date().toISOString(),
    });

    // 5. Opcional: Actualizar también el perfil en Firestore para consistencia
    const userDocRef = db.collection("users").doc(userId);
    await userDocRef.update({
      rol,
      nivelAcceso,
      puestoId: puestoId || null,
    });

    return {
      success: true,
      message: `Permisos actualizados para el usuario ${userId}.`,
    };
  } catch (error) {
    console.error("Error al asignar Custom Claims:", error);
    throw new HttpsError(
      "internal",
      "Ocurrió un error al intentar asignar los permisos."
    );
  }
});


/**
 * Cloud Function para configurar el primer usuario administrador.
 * Esta función es ideal para ser llamada una única vez durante la configuración inicial del sistema.
 */
exports.setupFirstAdmin = onCall(async (request) => {
  // Idealmente, esta función debería tener una lógica para prevenir su uso múltiple,
  // como verificar si ya existe un administrador. Por ahora, se mantiene simple.
  
  const { email } = request.data;
  if (!email) {
      throw new HttpsError('invalid-argument', 'El correo electrónico es requerido.');
  }

  try {
    const userRecord = await getAuth().getUserByEmail(email);
    
    // Asignar los claims de Administrador
    await getAuth().setCustomUserClaims(userRecord.uid, {
      rol: 'Administrador',
      nivelAcceso: 'Confidencial', // El nivel más alto
      isFirstAdmin: true,
      lastClaimUpdate: new Date().toISOString()
    });

    // Actualizar también el documento en Firestore para consistencia
    const userDocRef = db.collection('users').doc(userRecord.uid);
    await userDocRef.update({
        rol: 'Administrador',
        nivelAcceso: 'Confidencial'
    });

    return { success: true, message: `El usuario ${email} ha sido configurado como Administrador.` };
  } catch (error: any) {
    console.error("Error configurando el primer administrador:", error);
    if (error.code === 'auth/user-not-found') {
        throw new HttpsError('not-found', `No se encontró un usuario con el correo ${email}.`);
    }
    throw new HttpsError('internal', 'Ocurrió un error al configurar el administrador.');
  }
});
