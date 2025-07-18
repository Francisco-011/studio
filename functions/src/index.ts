
/**
 * @fileoverview Cloud Functions para gestionar la autenticación y permisos de usuarios.
 * - setUserRole: Asigna Custom Claims (rol, nivelAcceso, etc.) a un usuario.
 *   Esta es la función principal que sella los permisos en el token de autenticación.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initializeApp, App } from "firebase-admin/app";
import { logger } from "firebase-functions";

// Inicializar Firebase Admin SDK de forma segura
try {
  initializeApp();
} catch (e) {
  // SDK ya inicializado, no hacer nada.
  // Esto previene errores en entornos de recarga en caliente.
}
const db = getFirestore();

/**
 * Cloud Function para asignar Custom Claims a un usuario.
 * Permite a un Administrador (según su token) cambiar a otros,
 * o a un usuario auto-asignarse el rol si su perfil en la DB es de Administrador.
 */
exports.setUserRole = onCall(async (request) => {
    logger.info("Iniciando setUserRole v3 con datos:", { data: request.data });
    const callingUid = request.auth?.uid;
    const { userId, rol, nivelAcceso, puestoId } = request.data;
    
    logger.info(`Llamada realizada por UID: ${callingUid}`, { structuredData: true });

// 1. Validar datos de entrada
if (!userId || !rol || !nivelAcceso) {
    logger.error("Datos de entrada inválidos.", { data: request.data });
    throw new HttpsError("invalid-argument", "La función debe ser llamada con 'userId', 'rol' y 'nivelAcceso'.");
}

// 1.1 Validar formato UID
if (typeof userId !== 'string' || userId.length < 10) {
    throw new HttpsError('invalid-argument', 'userId inválido');
}

// 1.2 Validar valores permitidos
const rolesPermitidos = ['Administrador', 'Gerente de Proyecto', 'Consultor', 'Usuario Final'];
const nivelesPermitidos = ['Público', 'Departamental', 'Jerárquico', 'Ejecutivo', 'Confidencial'];

if (!rolesPermitidos.includes(rol)) {
    throw new HttpsError('invalid-argument', `Rol no válido: ${rol}`);
}

if (!nivelesPermitidos.includes(nivelAcceso)) {
    throw new HttpsError('invalid-argument', `Nivel de acceso no válido: ${nivelAcceso}`);
}

    // 2. Lógica de permisos - TEMPORAL: permitir primera ejecución
    const isSelfUpdate = callingUid === userId;
    let isAuthorized = false;

    logger.info("Verificando autorización...", { callingUid, targetUserId: userId });

    if (request.auth?.token?.rol === "Administrador") {
        isAuthorized = true;
        logger.info("Autorizado por token de Administrador.");
    } else if (isSelfUpdate) {
        logger.info("Realizando chequeo de auto-actualización...");
        const userDoc = await db.collection("users").doc(callingUid!).get();
        if (userDoc.exists && userDoc.data()?.rol === "Administrador") {
            isAuthorized = true;
            logger.info("Autorizado por rol de 'Administrador' en la base de datos para auto-actualización.");
        } else {
             logger.warn("Auto-actualización no autorizada. Rol en DB no es 'Administrador' o el documento no existe.", { userDocExists: userDoc.exists, userRoleInDb: userDoc.data()?.rol });
        }
    }
    
    if (!isAuthorized) {
      if (callingUid) {
        logger.error(`Permiso denegado para UID: ${callingUid}. Rol en token: ${request.auth?.token?.rol}`);
      } else {
        logger.error("Permiso denegado: usuario no autenticado intentando llamar a la función.");
      }
      throw new HttpsError("permission-denied", "No tiene permisos para ejecutar esta acción.");
    }
    
    try {
        logger.info("Autorización concedida. Procediendo a obtener datos del puesto.");
        // 3. Obtener el departamento y área del puesto para sellarlos en el token
        let departamentoId: string | undefined;
        let areaId: string | undefined;

        if (puestoId) {
            logger.info(`Buscando puesto con ID: ${puestoId}`);
            const puestoDoc = await db.collection("puestos").doc(puestoId).get();
            if (puestoDoc.exists) {
                const puestoData = puestoDoc.data();
                logger.info("Puesto encontrado:", { puestoData });
                if(puestoData) {
                    departamentoId = puestoData.departamentoId;
                    areaId = puestoData.areaId;
                } else {
                    logger.warn("El documento del puesto existe, pero data() está vacío.");
                }
            } else {
                logger.warn(`Puesto con ID ${puestoId} no fue encontrado en la base de datos.`);
            }
        } else {
            logger.info("No se proporcionó puestoId. Se asignarán claims sin información de puesto.");
        }

        const claimsToSet = {
            rol,
            nivelAcceso,
            departamentoId: departamentoId || null,
            areaId: areaId || null,
            puestoId: puestoId || null,
            lastClaimUpdate: new Date().toISOString(),
        };

        logger.info("Asignando los siguientes Custom Claims:", { userId, claims: claimsToSet });
        
        // 4. Asignar los Custom Claims al usuario
        await getAuth().setCustomUserClaims(userId, claimsToSet);
        logger.info("Custom Claims asignados exitosamente.");

        // 5. Opcional: Actualizar también el perfil en Firestore para consistencia
        const userDocRef = db.collection("users").doc(userId);
        await userDocRef.update({
            rol,
            nivelAcceso,
            puestoId: puestoId || null,
        });
        logger.info("Perfil de usuario en Firestore actualizado.");

        return {
            success: true,
            message: `Permisos actualizados para el usuario ${userId}.`,
        };
    } catch (error) {
        logger.error("Error catastrófico en el bloque try/catch de setUserRole:", { errorMessage: error.message });
        throw new HttpsError("internal", "Ocurrió un error inesperado al intentar asignar los permisos. Revise los logs de la función para más detalles.");
    }
});
