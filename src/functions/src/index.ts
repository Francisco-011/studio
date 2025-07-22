

/**
 * @fileoverview Cloud Functions para gestionar la autenticación y permisos de usuarios.
 * - setUserRole: Asigna Custom Claims (rol, nivelAcceso, etc.) a un usuario.
 * - setupFirstAdmin: Configura el primer usuario administrador del sistema.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initializeApp, App } from "firebase-admin/app";
import { onDocumentWrite } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";

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
    logger.info("🔧 setUserRole v4 - Sincronización mejorada", { data: request.data });
    
    const callingUid = request.auth?.uid;
    const { userId, rol, nivelAcceso, puestoId } = request.data;
    
    // 1. Validar datos de entrada
    if (!userId || !rol || !nivelAcceso) {
        logger.error("❌ Datos de entrada inválidos", { data: request.data });
        throw new HttpsError("invalid-argument", "La función debe ser llamada con 'userId', 'rol' y 'nivelAcceso'.");
    }

    // 2. Lógica de autorización SIMPLIFICADA y ROBUSTA
    let isAuthorized = false;
    const isSelfUpdate = callingUid === userId;

    logger.info("🔍 Verificando autorización", { callingUid, targetUserId: userId, isSelfUpdate });

    try {
        // Caso 1: Usuario con token de Administrador
        if (request.auth?.token?.rol === "Administrador") {
            isAuthorized = true;
            logger.info("✅ Autorizado por token de Administrador");
        }
        // Caso 2: Auto-actualización para usuarios que son Administradores en DB
        else if (isSelfUpdate) {
            const userDoc = await db.collection("users").doc(callingUid!).get();
            if (userDoc.exists && userDoc.data()?.rol === "Administrador") {
                isAuthorized = true;
                logger.info("✅ Autorizado por auto-actualización de Administrador");
            } else {
                logger.warn("❌ Auto-actualización rechazada - No es Administrador en DB");
            }
        }
        // Caso 3: Configuración inicial - usuario sin claims previos pero es Admin en DB
        else if (!request.auth?.token?.rol) {
            // Para casos de configuración inicial donde el token aún no tiene claims
            const userDoc = await db.collection("users").doc(userId).get();
            if (userDoc.exists && userDoc.data()?.rol === "Administrador" && callingUid === userId) {
                isAuthorized = true;
                logger.info("✅ Autorizado por configuración inicial de Administrador");
            }
        }

        if (!isAuthorized) {
            logger.error("❌ Permiso denegado", { 
                callingUid, 
                targetUserId: userId,
                tokenRol: request.auth?.token?.rol 
            });
            throw new HttpsError("permission-denied", "No tiene permisos para ejecutar esta acción.");
        }

        // 3. Obtener datos del puesto para sellar en el token
        let departamentoId: string | undefined;
        let areaId: string | undefined;

        if (puestoId) {
            logger.info(`🔍 Buscando datos del puesto: ${puestoId}`);
            const puestoDoc = await db.collection("puestos").doc(puestoId).get();
            if (puestoDoc.exists && puestoDoc.data()) {
                const puestoData = puestoDoc.data()!;
                departamentoId = puestoData.departamentoId;
                areaId = puestoData.areaId;
                logger.info("✅ Datos del puesto obtenidos", { departamentoId, areaId });
            } else {
                logger.warn(`⚠️ Puesto ${puestoId} no encontrado o sin datos`);
            }
        }

        // 4. Preparar Claims con timestamp de sincronización
        const claimsToSet = {
            rol,
            nivelAcceso,
            departamentoId: departamentoId || null,
            areaId: areaId || null,
            puestoId: puestoId || null,
            lastClaimUpdate: new Date().toISOString(),
            claimsVersion: Date.now(), // Para detectar actualizaciones
        };

        logger.info("🔄 Asignando Custom Claims", { userId, claims: claimsToSet });

        // 5. Asignar Claims atómicamente
        await getAuth().setCustomUserClaims(userId, claimsToSet);
        logger.info("✅ Custom Claims asignados exitosamente");

        // 6. Actualizar Firestore para consistencia
        const userDocRef = db.collection("users").doc(userId);
        await userDocRef.update({
            rol,
            nivelAcceso,
            puestoId: puestoId || null,
            lastSyncAt: new Date().toISOString(),
            claimsVersion: claimsToSet.claimsVersion,
        });
        logger.info("✅ Perfil en Firestore sincronizado");

        // 7. Registrar evento de sincronización
        await db.collection('sync_events').add({
            type: 'custom_claims_update',
            userId,
            claims: claimsToSet,
            updatedBy: callingUid,
            timestamp: new Date().toISOString(),
        });

        return {
            success: true,
            message: `Permisos actualizados para el usuario ${userId}`,
            claimsVersion: claimsToSet.claimsVersion,
            requiresRefresh: true, // Indica al cliente que debe refrescar
        };

    } catch (error) {
        logger.error("❌ Error en setUserRole", { error, userId, callingUid });
        
        // Detectar errores específicos de autorización
        if (error instanceof HttpsError) {
            throw error;
        }
        
        throw new HttpsError("internal", "Error inesperado al actualizar permisos. Revise los logs.");
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
