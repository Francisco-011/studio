/**
 * @fileoverview Cloud Functions para gestionar la autenticación y permisos de usuarios.
 * - setUserRole: Asigna Custom Claims (rol, nivelAcceso, etc.) a un usuario.
 *   Esta es la función principal que sella los permisos en el token de autenticación.
 * - onUserCreate: (Opcional, futuro) Podría usarse para asignar roles por defecto a nuevos usuarios.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, App } from "firebase-admin/app";

// Inicializar Firebase Admin SDK
let adminApp: App;
try {
  adminApp = initializeApp();
} catch (e) {
  console.warn("Firebase Admin SDK ya inicializado.");
}


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
    const db = getFirestore();
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
    // Esto ya se hace desde la UI, pero es una buena práctica de respaldo.
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
