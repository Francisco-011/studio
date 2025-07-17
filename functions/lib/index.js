"use strict";
/**
 * @fileoverview Cloud Functions para gestionar la autenticación y permisos de usuarios.
 * - setUserRole: Asigna Custom Claims (rol, nivelAcceso, etc.) a un usuario.
 *   Esta es la función principal que sella los permisos en el token de autenticación.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const https_1 = require("firebase-functions/v2/https");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const app_1 = require("firebase-admin/app");
const firebase_functions_1 = require("firebase-functions");
// Inicializar Firebase Admin SDK de forma segura
try {
    (0, app_1.initializeApp)();
}
catch (e) {
    // SDK ya inicializado, no hacer nada.
    // Esto previene errores en entornos de recarga en caliente.
}
const db = (0, firestore_1.getFirestore)();
/**
 * Cloud Function para asignar Custom Claims a un usuario.
 * Permite a un Administrador (según su token) cambiar a otros,
 * o a un usuario auto-asignarse el rol si su perfil en la DB es de Administrador.
 */
exports.setUserRole = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c, _d, _e;
    firebase_functions_1.logger.info("Iniciando setUserRole v3 con datos:", { data: request.data });
    const callingUid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    const { userId, rol, nivelAcceso, puestoId } = request.data;
    firebase_functions_1.logger.info(`Llamada realizada por UID: ${callingUid}`, { structuredData: true });
    // 1. Validar datos de entrada
    if (!userId || !rol || !nivelAcceso) {
        firebase_functions_1.logger.error("Datos de entrada inválidos.", { data: request.data });
        throw new https_1.HttpsError("invalid-argument", "La función debe ser llamada con 'userId', 'rol' y 'nivelAcceso'.");
    }
    // 2. Lógica de permisos - TEMPORAL: permitir primera ejecución
    const isSelfUpdate = callingUid === userId;
    let isAuthorized = false;
    firebase_functions_1.logger.info("Verificando autorización...", { callingUid, targetUserId: userId });
    if (((_c = (_b = request.auth) === null || _b === void 0 ? void 0 : _b.token) === null || _c === void 0 ? void 0 : _c.rol) === "Administrador") {
        isAuthorized = true;
        firebase_functions_1.logger.info("Autorizado por token de Administrador.");
    }
    else if (isSelfUpdate) {
        firebase_functions_1.logger.info("Realizando chequeo de auto-actualización...");
        const userDoc = await db.collection("users").doc(callingUid).get();
        if (userDoc.exists && ((_d = userDoc.data()) === null || _d === void 0 ? void 0 : _d.rol) === "Administrador") {
            isAuthorized = true;
            firebase_functions_1.logger.info("Autorizado por rol de 'Administrador' en la base de datos para auto-actualización.");
        }
        else {
            firebase_functions_1.logger.warn("Auto-actualización no autorizada. Rol en DB no es 'Administrador' o el documento no existe.", { userDocExists: userDoc.exists, userRoleInDb: (_e = userDoc.data()) === null || _e === void 0 ? void 0 : _e.rol });
        }
    }
    else if (userId === '4G6tICl00VXpEmGTx0ZgbhaHYKL2') {
        // TEMPORAL: permitir configuración inicial para este usuario específico
        isAuthorized = true;
        firebase_functions_1.logger.info("Autorizado temporalmente para configuración inicial.");
    }
    if (!isAuthorized) {
        firebase_functions_1.logger.error("Permiso denegado.", { callingUid });
        throw new https_1.HttpsError("permission-denied", "No tiene permisos para ejecutar esta acción.");
    }
    try {
        firebase_functions_1.logger.info("Autorización concedida. Procediendo a obtener datos del puesto.");
        // 3. Obtener el departamento y área del puesto para sellarlos en el token
        let departamentoId;
        let areaId;
        if (puestoId) {
            firebase_functions_1.logger.info(`Buscando puesto con ID: ${puestoId}`);
            const puestoDoc = await db.collection("puestos").doc(puestoId).get();
            if (puestoDoc.exists) {
                const puestoData = puestoDoc.data();
                firebase_functions_1.logger.info("Puesto encontrado:", { puestoData });
                if (puestoData) {
                    departamentoId = puestoData.departamentoId;
                    areaId = puestoData.areaId;
                }
                else {
                    firebase_functions_1.logger.warn("El documento del puesto existe, pero data() está vacío.");
                }
            }
            else {
                firebase_functions_1.logger.warn(`Puesto con ID ${puestoId} no fue encontrado en la base de datos.`);
            }
        }
        else {
            firebase_functions_1.logger.info("No se proporcionó puestoId. Se asignarán claims sin información de puesto.");
        }
        const claimsToSet = {
            rol,
            nivelAcceso,
            departamentoId: departamentoId || null,
            areaId: areaId || null,
            puestoId: puestoId || null,
            lastClaimUpdate: new Date().toISOString(),
        };
        firebase_functions_1.logger.info("Asignando los siguientes Custom Claims:", { userId, claims: claimsToSet });
        // 4. Asignar los Custom Claims al usuario
        await (0, auth_1.getAuth)().setCustomUserClaims(userId, claimsToSet);
        firebase_functions_1.logger.info("Custom Claims asignados exitosamente.");
        // 5. Opcional: Actualizar también el perfil en Firestore para consistencia
        const userDocRef = db.collection("users").doc(userId);
        await userDocRef.update({
            rol,
            nivelAcceso,
            puestoId: puestoId || null,
        });
        firebase_functions_1.logger.info("Perfil de usuario en Firestore actualizado.");
        return {
            success: true,
            message: `Permisos actualizados para el usuario ${userId}.`,
        };
    }
    catch (error) {
        firebase_functions_1.logger.error("Error catastrófico en el bloque try/catch de setUserRole:", { error });
        throw new https_1.HttpsError("internal", "Ocurrió un error inesperado al intentar asignar los permisos. Revise los logs de la función para más detalles.");
    }
});
//# sourceMappingURL=index.js.map