"use strict";
/**
 * @fileoverview Cloud Functions para gestionar la autenticación, permisos y seguridad financiera.
 * - setUserRole: Asigna Custom Claims (rol, nivelAcceso, etc.) a un usuario.
 * - syncUserClaims: Sincroniza automáticamente Custom Claims desincronizados
 * - diagnoseClaimsHealth: Diagnóstico del sistema para administradores
 * - setupFirstAdmin: Configura el primer usuario administrador del sistema.
 * - recalculateFinancialFields: Recalcula automáticamente campos financieros en el servidor
 */
Object.defineProperty(exports, "__esModule", { value: true });
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const auth_1 = require("firebase-admin/auth");
const firestore_2 = require("firebase-admin/firestore");
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
const db = (0, firestore_2.getFirestore)();
/**
 * Cloud Function robusta para asignar Custom Claims
 * SOLUCIÓN #16: Elimina código temporal y mejora sincronización
 */
exports.setUserRole = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    firebase_functions_1.logger.info("🔧 setUserRole v4 - Sincronización mejorada", { data: request.data });
    const callingUid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    const { userId, rol, nivelAcceso, puestoId } = request.data;
    // 1. Validar datos de entrada
    if (!userId || !rol || !nivelAcceso) {
        firebase_functions_1.logger.error("❌ Datos de entrada inválidos", { data: request.data });
        throw new https_1.HttpsError("invalid-argument", "La función debe ser llamada con 'userId', 'rol' y 'nivelAcceso'.");
    }
    // 2. Lógica de autorización SIMPLIFICADA y ROBUSTA
    let isAuthorized = false;
    const isSelfUpdate = callingUid === userId;
    firebase_functions_1.logger.info("🔍 Verificando autorización", { callingUid, targetUserId: userId, isSelfUpdate });
    try {
        // Caso 1: Usuario con token de Administrador
        if (((_c = (_b = request.auth) === null || _b === void 0 ? void 0 : _b.token) === null || _c === void 0 ? void 0 : _c.rol) === "Administrador") {
            isAuthorized = true;
            firebase_functions_1.logger.info("✅ Autorizado por token de Administrador");
        }
        // Caso 2: Auto-actualización para usuarios que son Administradores en DB
        else if (isSelfUpdate) {
            const userDoc = await db.collection("users").doc(callingUid).get();
            if (userDoc.exists && ((_d = userDoc.data()) === null || _d === void 0 ? void 0 : _d.rol) === "Administrador") {
                isAuthorized = true;
                firebase_functions_1.logger.info("✅ Autorizado por auto-actualización de Administrador");
            }
            else {
                firebase_functions_1.logger.warn("❌ Auto-actualización rechazada - No es Administrador en DB");
            }
        }
        // Caso 3: Configuración inicial - usuario sin claims previos pero es Admin en DB
        else if (!((_f = (_e = request.auth) === null || _e === void 0 ? void 0 : _e.token) === null || _f === void 0 ? void 0 : _f.rol)) {
            // Para casos de configuración inicial donde el token aún no tiene claims
            const userDoc = await db.collection("users").doc(userId).get();
            if (userDoc.exists && ((_g = userDoc.data()) === null || _g === void 0 ? void 0 : _g.rol) === "Administrador" && callingUid === userId) {
                isAuthorized = true;
                firebase_functions_1.logger.info("✅ Autorizado por configuración inicial de Administrador");
            }
        }
        if (!isAuthorized) {
            firebase_functions_1.logger.error("❌ Permiso denegado", {
                callingUid,
                targetUserId: userId,
                tokenRol: (_j = (_h = request.auth) === null || _h === void 0 ? void 0 : _h.token) === null || _j === void 0 ? void 0 : _j.rol
            });
            throw new https_1.HttpsError("permission-denied", "No tiene permisos para ejecutar esta acción.");
        }
        // 3. Obtener datos del puesto para sellar en el token
        let departamentoId;
        let areaId;
        if (puestoId) {
            firebase_functions_1.logger.info(`🔍 Buscando datos del puesto: ${puestoId}`);
            const puestoDoc = await db.collection("puestos").doc(puestoId).get();
            if (puestoDoc.exists && puestoDoc.data()) {
                const puestoData = puestoDoc.data();
                departamentoId = puestoData.departamentoId;
                areaId = puestoData.areaId;
                firebase_functions_1.logger.info("✅ Datos del puesto obtenidos", { departamentoId, areaId });
            }
            else {
                firebase_functions_1.logger.warn(`⚠️ Puesto ${puestoId} no encontrado o sin datos`);
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
        firebase_functions_1.logger.info("🔄 Asignando Custom Claims", { userId, claims: claimsToSet });
        // 5. Asignar Claims atómicamente
        await (0, auth_1.getAuth)().setCustomUserClaims(userId, claimsToSet);
        firebase_functions_1.logger.info("✅ Custom Claims asignados exitosamente");
        // 6. Actualizar Firestore para consistencia
        const userDocRef = db.collection("users").doc(userId);
        await userDocRef.update({
            rol,
            nivelAcceso,
            puestoId: puestoId || null,
            lastSyncAt: new Date().toISOString(),
            claimsVersion: claimsToSet.claimsVersion,
        });
        firebase_functions_1.logger.info("✅ Perfil en Firestore sincronizado");
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
    }
    catch (error) {
        firebase_functions_1.logger.error("❌ Error en setUserRole", { error, userId, callingUid });
        // Detectar errores específicos de autorización
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError("internal", "Error inesperado al actualizar permisos. Revise los logs.");
    }
});
/**
 * Función para diagnosticar y reparar problemas de sincronización
 */
exports.syncUserClaims = (0, https_1.onCall)(async (request) => {
    var _a;
    firebase_functions_1.logger.info("🔧 syncUserClaims - Diagnóstico y reparación iniciado");
    const callingUid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!callingUid) {
        throw new https_1.HttpsError("unauthenticated", "Usuario no autenticado");
    }
    try {
        // 1. Obtener estado actual del usuario
        const userDoc = await db.collection("users").doc(callingUid).get();
        if (!userDoc.exists) {
            throw new https_1.HttpsError("not-found", "Perfil de usuario no encontrado");
        }
        const userData = userDoc.data();
        const currentUser = await (0, auth_1.getAuth)().getUser(callingUid);
        // 2. Comparar claims actuales vs datos en Firestore
        const tokenClaims = currentUser.customClaims || {};
        const dbVersion = userData.claimsVersion;
        const tokenVersion = tokenClaims.claimsVersion;
        firebase_functions_1.logger.info("🔍 Comparando versiones", {
            dbVersion,
            tokenVersion,
            needsSync: dbVersion !== tokenVersion
        });
        // 3. Si hay desincronización, corregir automáticamente
        if (dbVersion !== tokenVersion || !tokenClaims.rol) {
            firebase_functions_1.logger.info("🔄 Detectada desincronización, corrigiendo...");
            const correctedClaims = {
                rol: userData.rol,
                nivelAcceso: userData.nivelAcceso,
                puestoId: userData.puestoId || null,
                departamentoId: userData.departamentoId || null,
                areaId: userData.areaId || null,
                lastClaimUpdate: new Date().toISOString(),
                claimsVersion: Date.now(),
            };
            await (0, auth_1.getAuth)().setCustomUserClaims(callingUid, correctedClaims);
            // Actualizar versión en Firestore
            await userDoc.ref.update({
                claimsVersion: correctedClaims.claimsVersion,
                lastSyncAt: new Date().toISOString(),
            });
            firebase_functions_1.logger.info("✅ Claims sincronizados automáticamente");
            return {
                success: true,
                wasSynced: true,
                message: "Claims sincronizados automáticamente",
                newClaimsVersion: correctedClaims.claimsVersion,
            };
        }
        return {
            success: true,
            wasSynced: false,
            message: "Claims ya están sincronizados",
            claimsVersion: tokenVersion,
        };
    }
    catch (error) {
        firebase_functions_1.logger.error("❌ Error en syncUserClaims", { error, callingUid });
        throw new https_1.HttpsError("internal", "Error al sincronizar claims");
    }
});
/**
 * Función para administradores para verificar estado de sincronización
 */
exports.diagnoseClaimsHealth = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    // Solo administradores pueden ejecutar esto
    if (((_b = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.token) === null || _b === void 0 ? void 0 : _b.rol) !== "Administrador") {
        throw new https_1.HttpsError("permission-denied", "Solo administradores");
    }
    try {
        // Buscar usuarios con problemas de sincronización
        const usersSnapshot = await db.collection("users").get();
        const problematicUsers = [];
        const promises = [];
        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            if (userData.rol) {
                promises.push((0, auth_1.getAuth)().getUser(userDoc.id).then(authUser => {
                    const tokenClaims = authUser.customClaims || {};
                    const hasProblems = !tokenClaims.rol ||
                        tokenClaims.rol !== userData.rol ||
                        tokenClaims.claimsVersion !== userData.claimsVersion;
                    if (hasProblems) {
                        problematicUsers.push({
                            uid: userDoc.id,
                            email: authUser.email,
                            dbRole: userData.rol,
                            tokenRole: tokenClaims.rol,
                            dbVersion: userData.claimsVersion,
                            tokenVersion: tokenClaims.claimsVersion,
                        });
                    }
                }).catch(error => {
                    firebase_functions_1.logger.warn(`Error checking user ${userDoc.id}:`, error);
                }));
            }
        }
        await Promise.all(promises);
        return {
            success: true,
            totalUsers: usersSnapshot.size,
            problematicUsers: problematicUsers.length,
            users: problematicUsers,
        };
    }
    catch (error) {
        firebase_functions_1.logger.error("Error in diagnoseClaimsHealth:", error);
        throw new https_1.HttpsError("internal", "Error al diagnosticar estado de claims");
    }
});
/**
 * Cloud Function para configurar el primer usuario administrador.
 * Esta función es ideal para ser llamada una única vez durante la configuración inicial del sistema.
 */
exports.setupFirstAdmin = (0, https_1.onCall)(async (request) => {
    const { email } = request.data;
    if (!email) {
        throw new https_1.HttpsError('invalid-argument', 'El correo electrónico es requerido.');
    }
    try {
        const userRecord = await (0, auth_1.getAuth)().getUserByEmail(email);
        // Asignar los claims de Administrador
        await (0, auth_1.getAuth)().setCustomUserClaims(userRecord.uid, {
            rol: 'Administrador',
            nivelAcceso: 'Confidencial', // El nivel más alto
            isFirstAdmin: true,
            lastClaimUpdate: new Date().toISOString(),
            claimsVersion: Date.now(),
        });
        // Actualizar también el documento en Firestore para consistencia
        const userDocRef = db.collection('users').doc(userRecord.uid);
        await userDocRef.update({
            rol: 'Administrador',
            nivelAcceso: 'Confidencial',
            claimsVersion: Date.now(),
            lastSyncAt: new Date().toISOString(),
        });
        return { success: true, message: `El usuario ${email} ha sido configurado como Administrador.` };
    }
    catch (error) {
        console.error("Error configurando el primer administrador:", error);
        if (error.code === 'auth/user-not-found') {
            throw new https_1.HttpsError('not-found', `No se encontró un usuario con el correo ${email}.`);
        }
        throw new https_1.HttpsError('internal', 'Ocurrió un error al configurar el administrador.');
    }
});
// ===== FUNCIONES DE SEGURIDAD FINANCIERA =====
// Mapeo de frecuencias a multiplicador mensual
const getMonthlyMultiplier = (frequency) => {
    switch (frequency) {
        case 'Diario': return 22;
        case 'Semanal': return 4.33;
        case 'Quincenal': return 2;
        case 'Mensual': return 1;
        case 'Bimestral': return 1 / 2;
        case 'Trimestral': return 1 / 3;
        case 'Semestral': return 1 / 6;
        case 'Anual': return 1 / 12;
        case 'A demanda': return 1;
        default: return 0;
    }
};
/**
 * Recalcula campos financieros cuando se actualiza un procedimiento
 * SEGURIDAD: Los campos tiempoEstimado y costoEstimado se calculan automáticamente
 * en el servidor para prevenir manipulación desde el cliente
 */
exports.recalculateProcedure = (0, firestore_1.onDocumentWrite)("procedimientos/{docId}", async (event) => {
    var _a;
    const docId = event.params.docId;
    const after = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after;
    if (!(after === null || after === void 0 ? void 0 : after.exists)) {
        firebase_functions_1.logger.info(`Documento procedimiento ${docId} eliminado, saltando recálculo.`);
        return;
    }
    const procedureData = after.data();
    const activityOrder = procedureData.activityOrder || [];
    if (activityOrder.length === 0) {
        firebase_functions_1.logger.info(`Procedimiento ${docId} sin actividades, estableciendo valores en 0.`);
        await after.ref.update({
            tiempoEstimado: 0,
            costoEstimado: 0,
            monedaCosto: null
        });
        return;
    }
    try {
        // Obtener todas las actividades del procedimiento
        const activityPromises = activityOrder.map((actId) => db.collection('actividades').doc(actId).get());
        const activityDocs = await Promise.all(activityPromises);
        const activities = activityDocs
            .filter(doc => { var _a; return doc.exists && ((_a = doc.data()) === null || _a === void 0 ? void 0 : _a.activa); })
            .map(doc => (Object.assign({ id: doc.id }, doc.data())));
        let totalTiempo = 0;
        const costosPorMoneda = new Map();
        // Procesar cada actividad
        for (const activity of activities) {
            const monthlyMultiplier = getMonthlyMultiplier(activity.frecuencia);
            const monthlyExecutions = monthlyMultiplier * (activity.ejecucionesPorPeriodo || 1);
            // Calcular tiempo total
            totalTiempo += (activity.tiempoEstimado || 0) * monthlyExecutions;
            // Calcular costo si tiene puesto asignado
            if (activity.puestoId && activity.tiempoEstimado) {
                const puestoDoc = await db.collection('puestos').doc(activity.puestoId).get();
                if (puestoDoc.exists) {
                    const puestoData = puestoDoc.data();
                    if (puestoData === null || puestoData === void 0 ? void 0 : puestoData.costoHora) {
                        const costoPorMinuto = puestoData.costoHora / 60;
                        const costoActividad = activity.tiempoEstimado * costoPorMinuto;
                        const costoMensualActividad = costoActividad * monthlyExecutions;
                        const moneda = puestoData.monedaCosto || 'MXN';
                        costosPorMoneda.set(moneda, (costosPorMoneda.get(moneda) || 0) + costoMensualActividad);
                    }
                }
            }
        }
        // Determinar costo y moneda final
        let totalCosto = 0;
        let monedaFinal = null;
        if (costosPorMoneda.size > 0) {
            monedaFinal = Array.from(costosPorMoneda.keys())[0];
            totalCosto = costosPorMoneda.get(monedaFinal) || 0;
            if (costosPorMoneda.size > 1) {
                firebase_functions_1.logger.warn(`Procedimiento ${docId} tiene múltiples monedas, usando ${monedaFinal}`);
            }
        }
        // Actualizar el procedimiento con valores calculados
        await after.ref.update({
            tiempoEstimado: Math.round(totalTiempo * 100) / 100, // Redondear a 2 decimales
            costoEstimado: Math.round(totalCosto * 100) / 100,
            monedaCosto: monedaFinal
        });
        firebase_functions_1.logger.info(`✅ Procedimiento ${docId} recalculado automáticamente: tiempo=${totalTiempo}, costo=${totalCosto} ${monedaFinal}`);
    }
    catch (error) {
        firebase_functions_1.logger.error(`❌ Error recalculando procedimiento ${docId}:`, error);
    }
});
/**
 * Recalcula campos financieros cuando se actualiza un proceso
 * SEGURIDAD: Los campos tiempoEstimado y costoEstimado se calculan automáticamente
 * en el servidor para prevenir manipulación desde el cliente
 */
exports.recalculateProcess = (0, firestore_1.onDocumentWrite)("procesos/{docId}", async (event) => {
    var _a;
    const docId = event.params.docId;
    const after = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after;
    if (!(after === null || after === void 0 ? void 0 : after.exists)) {
        firebase_functions_1.logger.info(`Documento proceso ${docId} eliminado, saltando recálculo.`);
        return;
    }
    const processData = after.data();
    const procedimientoOrder = processData.procedimientoOrder || [];
    if (procedimientoOrder.length === 0) {
        firebase_functions_1.logger.info(`Proceso ${docId} sin procedimientos, estableciendo valores en 0.`);
        await after.ref.update({
            tiempoEstimado: 0,
            costoEstimado: 0,
            monedaCosto: null
        });
        return;
    }
    try {
        // Obtener todos los procedimientos del proceso
        const procedurePromises = procedimientoOrder.map((procId) => db.collection('procedimientos').doc(procId).get());
        const procedureDocs = await Promise.all(procedurePromises);
        const procedures = procedureDocs
            .filter(doc => { var _a; return doc.exists && ((_a = doc.data()) === null || _a === void 0 ? void 0 : _a.activo); })
            .map(doc => (Object.assign({ id: doc.id }, doc.data())));
        let totalTiempo = 0;
        let totalCosto = 0;
        let monedaFinal = null;
        // Sumar valores de procedimientos
        procedures.forEach(procedure => {
            totalTiempo += procedure.tiempoEstimado || 0;
            totalCosto += procedure.costoEstimado || 0;
            if (procedure.monedaCosto && !monedaFinal) {
                monedaFinal = procedure.monedaCosto;
            }
        });
        // Actualizar el proceso con valores calculados
        await after.ref.update({
            tiempoEstimado: Math.round(totalTiempo * 100) / 100,
            costoEstimado: Math.round(totalCosto * 100) / 100,
            monedaCosto: monedaFinal
        });
        firebase_functions_1.logger.info(`✅ Proceso ${docId} recalculado automáticamente: tiempo=${totalTiempo}, costo=${totalCosto} ${monedaFinal}`);
    }
    catch (error) {
        firebase_functions_1.logger.error(`❌ Error recalculando proceso ${docId}:`, error);
    }
});
/**
 * Trigger para recalcular procedimientos cuando se actualiza una actividad
 * SEGURIDAD: Cualquier cambio en actividades dispara recálculos automáticos
 */
exports.triggerRecalcFromActivity = (0, firestore_1.onDocumentWrite)("actividades/{docId}", async (event) => {
    var _a, _b;
    const docId = event.params.docId;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before;
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after;
    // Determinar si hubo cambios relevantes
    const beforeData = before === null || before === void 0 ? void 0 : before.data();
    const afterData = after === null || after === void 0 ? void 0 : after.data();
    if (!beforeData && !afterData)
        return;
    // Campos que afectan los cálculos
    const relevantFields = ['tiempoEstimado', 'frecuencia', 'ejecucionesPorPeriodo', 'puestoId', 'activa', 'procedimientoId'];
    const hasRelevantChanges = relevantFields.some(field => (beforeData === null || beforeData === void 0 ? void 0 : beforeData[field]) !== (afterData === null || afterData === void 0 ? void 0 : afterData[field]));
    if (!hasRelevantChanges) {
        firebase_functions_1.logger.info(`Actividad ${docId} actualizada sin cambios relevantes para cálculos.`);
        return;
    }
    firebase_functions_1.logger.info(`🔄 Actividad ${docId} modificada, disparando recálculos de procedimientos...`);
    // Obtener IDs de procedimientos afectados (antes y después)
    const affectedProcedureIds = new Set();
    if (beforeData === null || beforeData === void 0 ? void 0 : beforeData.procedimientoId) {
        affectedProcedureIds.add(beforeData.procedimientoId);
    }
    if (afterData === null || afterData === void 0 ? void 0 : afterData.procedimientoId) {
        affectedProcedureIds.add(afterData.procedimientoId);
    }
    // Trigger recálculo de procedimientos afectados
    for (const procedureId of affectedProcedureIds) {
        try {
            const procedureDoc = await db.collection('procedimientos').doc(procedureId).get();
            if (procedureDoc.exists) {
                // Forzar trigger del procedimiento actualizando timestamp
                await procedureDoc.ref.update({
                    updatedAt: new Date()
                });
                firebase_functions_1.logger.info(`✅ Disparado recálculo automático para procedimiento ${procedureId}`);
            }
        }
        catch (error) {
            firebase_functions_1.logger.error(`❌ Error disparando recálculo para procedimiento ${procedureId}:`, error);
        }
    }
});
/**
 * Trigger para recalcular procesos cuando se actualiza un procedimiento
 * SEGURIDAD: Propaga cambios financieros automáticamente hacia arriba en la jerarquía
 */
exports.triggerRecalcFromProcedure = (0, firestore_1.onDocumentWrite)("procedimientos/{docId}", async (event) => {
    var _a, _b;
    const docId = event.params.docId;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before;
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after;
    // Solo proceder si hubo cambios en campos financieros
    const beforeData = before === null || before === void 0 ? void 0 : before.data();
    const afterData = after === null || after === void 0 ? void 0 : after.data();
    const financialFields = ['tiempoEstimado', 'costoEstimado', 'monedaCosto', 'activo'];
    const hasFinancialChanges = financialFields.some(field => (beforeData === null || beforeData === void 0 ? void 0 : beforeData[field]) !== (afterData === null || afterData === void 0 ? void 0 : afterData[field]));
    if (!hasFinancialChanges) {
        firebase_functions_1.logger.info(`Procedimiento ${docId} actualizado sin cambios financieros.`);
        return;
    }
    firebase_functions_1.logger.info(`🔄 Procedimiento ${docId} con cambios financieros, disparando recálculos de procesos...`);
    // Buscar procesos que contengan este procedimiento
    const processesQuery = await db.collection('procesos')
        .where('procedimientoOrder', 'array-contains', docId)
        .get();
    for (const processDoc of processesQuery.docs) {
        try {
            // Forzar trigger del proceso actualizando timestamp
            await processDoc.ref.update({
                updatedAt: new Date()
            });
            firebase_functions_1.logger.info(`✅ Disparado recálculo automático para proceso ${processDoc.id}`);
        }
        catch (error) {
            firebase_functions_1.logger.error(`❌ Error disparando recálculo para proceso ${processDoc.id}:`, error);
        }
    }
});
//# sourceMappingURL=index.js.map