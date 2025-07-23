/**
 * @fileoverview Cloud Functions para gestionar la autenticación, permisos y seguridad financiera.
 * Versión refactorizada con mejoras de seguridad y corrección de errores.
 * * FUNCIONES DE AUTENTICACIÓN Y PERMISOS:
 * - setUserRole: (Segura) Asigna Custom Claims a un usuario, solo ejecutable por administradores.
 * - initializeFirstAdmin: (Segura) Configura el primer administrador del sistema usando una clave secreta.
 * - syncUserClaims: Sincroniza automáticamente Custom Claims del usuario que la llama si están desactualizados.
 * - diagnoseClaimsHealth: Diagnóstico del sistema para que los administradores verifiquen la salud de los claims.
 * - getSystemSecurityStatus: (Nueva) Obtiene un resumen del estado de seguridad del sistema para administradores.
 * * FUNCIONES DE CÁLCULOS FINANCIEROS (TRIGGERS):
 * - recalculateProcedure: Recalcula tiempo y costo de un procedimiento basado en sus actividades.
 * - recalculateProcess: Recalcula tiempo y costo de un proceso basado en sus procedimientos.
 * - triggerRecalcFromActivity: Dispara el recálculo de procedimientos cuando una actividad cambia.
 * - triggerRecalcFromProcedure: (Corregida) Dispara el recálculo de procesos cuando un procedimiento cambia.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initializeApp } from "firebase-admin/app";
import { logger } from "firebase-functions";

// Inicializar Firebase Admin SDK de forma segura
try {
  initializeApp();
} catch (e) {
  // SDK ya inicializado, no hacer nada para prevenir errores en recargas.
}
const db = getFirestore();

// =================================================================
// ===== FUNCIONES DE AUTENTICACIÓN Y PERMISOS (VERSIÓN SEGURA) =====
// =================================================================

/**
 * Cloud Function SEGURA para asignar Custom Claims.
 * SOLO los administradores con Custom Claims válidos pueden cambiar roles.
 */
exports.setUserRole = onCall(async (request) => {
    logger.info("🔧 setUserRole v5 - Versión Segura", { data: request.data });

    const callingUid = request.auth?.uid;
    const { userId, rol, nivelAcceso, puestoId } = request.data;

    // 1. Validar autenticación
    if (!callingUid) {
        throw new HttpsError("unauthenticated", "Usuario no autenticado para realizar esta acción.");
    }

    // 2. Validar datos de entrada
    if (!userId || !rol || !nivelAcceso) {
        logger.error("❌ Datos de entrada inválidos para setUserRole", { data: request.data });
        throw new HttpsError("invalid-argument", "La función debe ser llamada con 'userId', 'rol' y 'nivelAcceso'.");
    }

    try {
        // 3. LÓGICA DE AUTORIZACIÓN SEGURA Y CENTRALIZADA
        const callerClaims = request.auth?.token;
        if (callerClaims?.rol !== "Administrador") {
            logger.warn("❌ Intento no autorizado para cambiar roles.", {
                callingUid,
                currentRole: callerClaims?.rol || "ninguno",
                attemptedTarget: userId
            });
            // Registrar intento fallido para auditoría
            await db.collection("security_events").add({
                type: "unauthorized_role_change_attempt",
                attemptedBy: callingUid,
                targetUser: userId,
                attemptedRole: rol,
                timestamp: new Date().toISOString(),
                userAgent: request.rawRequest?.headers?.["user-agent"] || "unknown"
            });
            throw new HttpsError(
                "permission-denied",
                "No tiene permisos para ejecutar esta acción. Este intento ha sido registrado."
            );
        }

        logger.info("✅ Autorizado por Custom Claims de Administrador", { 
            adminId: callingUid,
            targetUserId: userId 
        });

        // 4. Validación de seguridad: Prevenir que el último administrador se quite su propio rol.
        if (callingUid === userId && rol !== "Administrador") {
            const adminCountSnapshot = await db.collection("users")
                .where("rol", "==", "Administrador")
                .get();
            
            if (adminCountSnapshot.size <= 1) {
                throw new HttpsError(
                    "failed-precondition",
                    "No puede quitarse el rol de Administrador porque es el último que queda."
                );
            }
        }

        // 5. Obtener datos del puesto para sellar en el token
        let departamentoId: string | undefined;
        let areaId: string | undefined;

        if (puestoId) {
            const puestoDoc = await db.collection("puestos").doc(puestoId).get();
            if (puestoDoc.exists) {
                const puestoData = puestoDoc.data()!;
                departamentoId = puestoData.departamentoId;
                areaId = puestoData.areaId;
                logger.info("✅ Datos del puesto obtenidos", { departamentoId, areaId });
            } else {
                logger.warn(`⚠️ Puesto ${puestoId} no encontrado.`);
            }
        }

        // 6. Preparar los claims
        const claimsVersion = Date.now();
        const claimsToSet = {
            rol,
            nivelAcceso,
            departamentoId: departamentoId || null,
            areaId: areaId || null,
            puestoId: puestoId || null,
            lastClaimUpdate: new Date().toISOString(),
            claimsVersion,
        };

        // 7. Asignar Claims y actualizar Firestore
        await getAuth().setCustomUserClaims(userId, claimsToSet);
        logger.info("✅ Custom Claims asignados exitosamente.", { userId, claims: claimsToSet });

        const userDocRef = db.collection("users").doc(userId);
        await userDocRef.update({
            rol,
            nivelAcceso,
            puestoId: puestoId || null,
            lastSyncAt: new Date().toISOString(),
            claimsVersion,
            lastModifiedBy: callingUid, // Rastrear quién hizo el cambio
            lastModifiedAt: Timestamp.now() // Rastrear cuándo se hizo
        });
        logger.info("✅ Perfil en Firestore sincronizado.");

        // 8. Registrar evento de auditoría exitoso
        await db.collection('audit_log').add({
            type: 'role_change_success',
            performedBy: callingUid,
            targetUser: userId,
            changes: { rol, nivelAcceso, puestoId: puestoId || null },
            timestamp: new Date().toISOString(),
            claimsVersion,
        });

        return {
            success: true,
            message: `Permisos actualizados para el usuario ${userId}`,
            claimsVersion,
            requiresRefresh: true,
        };

    } catch (error) {
        logger.error("❌ Error fatal en setUserRole", { error, userId, callingUid });
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError("internal", "Error inesperado al actualizar permisos. Revise los logs.");
    }
});


/**
 * Cloud Function para inicializar el primer administrador del sistema.
 * SEGURIDAD: Solo puede ejecutarse si NO hay administradores y se proporciona una clave secreta.
 */
exports.initializeFirstAdmin = onCall(async (request) => {
    logger.info("🚀 initializeFirstAdmin - Intento de configuración inicial", { callingUid: request.auth?.uid });

    const callingUid = request.auth?.uid;
    const { secretKey } = request.data;

    // 1. Validar autenticación
    if (!callingUid) {
        throw new HttpsError("unauthenticated", "Usuario no autenticado.");
    }

    try {
        // 2. VERIFICAR QUE NO EXISTAN OTROS ADMINISTRADORES
        const existingAdmins = await db.collection("users").where("rol", "==", "Administrador").limit(1).get();
        if (!existingAdmins.empty) {
            logger.warn("❌ Intento de inicializar admin cuando ya existe uno.", { attemptedBy: callingUid });
            await db.collection("security_events").add({
                type: "suspicious_admin_init_attempt",
                attemptedBy: callingUid,
                timestamp: new Date().toISOString(),
                reason: "Admins already exist"
            });
            throw new HttpsError("failed-precondition", "Ya existe al menos un administrador en el sistema.");
        }

        // 3. VALIDAR CLAVE SECRETA (configurada en variables de entorno de la función)
        const expectedSecretKey = process.env.FIRST_ADMIN_SECRET_KEY;
        if (!expectedSecretKey || secretKey !== expectedSecretKey) {
            logger.error("❌ Clave secreta para inicializar admin es inválida.", { callingUid });
            await db.collection("security_events").add({
                type: "invalid_secret_key_attempt",
                attemptedBy: callingUid,
                timestamp: new Date().toISOString()
            });
            throw new HttpsError("permission-denied", "Clave de inicialización inválida.");
        }
        
        // 4. Asignar rol de administrador
        const userDocRef = db.collection("users").doc(callingUid);
        const userDoc = await userDocRef.get();
        if (!userDoc.exists) {
            throw new HttpsError("not-found", "El perfil de usuario del solicitante no fue encontrado.");
        }

        const claimsVersion = Date.now();
        const adminClaims = {
            rol: "Administrador",
            nivelAcceso: "Confidencial",
            lastClaimUpdate: new Date().toISOString(),
            claimsVersion,
            isFoundingAdmin: true
        };

        await getAuth().setCustomUserClaims(callingUid, adminClaims);
        await userDocRef.update({
            rol: "Administrador",
            nivelAcceso: "Confidencial",
            isFoundingAdmin: true,
            adminSince: Timestamp.now(),
            lastSyncAt: new Date().toISOString(),
            claimsVersion
        });

        logger.info("✅ Primer administrador configurado exitosamente.", { adminId: callingUid });

        return {
            success: true,
            message: "Felicidades, has sido configurado como el primer administrador del sistema.",
            requiresRefresh: true,
        };

    } catch (error) {
        logger.error("❌ Error en initializeFirstAdmin", { error, callingUid });
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError("internal", "Error crítico al configurar el primer administrador.");
    }
});


/**
 * Función para que un usuario sincronice sus propios claims si están desactualizados.
 */
exports.syncUserClaims = onCall(async (request) => {
    logger.info("🔧 syncUserClaims - Sincronización iniciada por el usuario");
    
    const callingUid = request.auth?.uid;
    if (!callingUid) {
        throw new HttpsError("unauthenticated", "Usuario no autenticado");
    }

    try {
        const userDoc = await db.collection("users").doc(callingUid).get();
        if (!userDoc.exists) {
            throw new HttpsError("not-found", "Perfil de usuario no encontrado");
        }

        const userData = userDoc.data()!;
        const authUser = await getAuth().getUser(callingUid);
        const tokenClaims = authUser.customClaims || {};

        const dbVersion = userData.claimsVersion;
        const tokenVersion = tokenClaims.claimsVersion;

        if (dbVersion !== tokenVersion || !tokenClaims.rol) {
            logger.info("🔄 Desincronización detectada, corrigiendo...", { dbVersion, tokenVersion });
            
            // Re-aplica los claims desde la base de datos como fuente de verdad
            const claimsVersion = Date.now();
            const correctedClaims = {
                rol: userData.rol,
                nivelAcceso: userData.nivelAcceso,
                puestoId: userData.puestoId || null,
                departamentoId: userData.departamentoId || null,
                areaId: userData.areaId || null,
                lastClaimUpdate: new Date().toISOString(),
                claimsVersion,
            };

            await getAuth().setCustomUserClaims(callingUid, correctedClaims);
            await userDoc.ref.update({ claimsVersion, lastSyncAt: new Date().toISOString() });

            logger.info("✅ Claims sincronizados automáticamente para el usuario.", { uid: callingUid });
            return { success: true, wasSynced: true, message: "Tus permisos han sido sincronizados.", newClaimsVersion: claimsVersion };
        }

        logger.info("✅ Claims ya están sincronizados.", { uid: callingUid });
        return { success: true, wasSynced: false, message: "Tus permisos ya están actualizados.", claimsVersion: tokenVersion };

    } catch (error) {
        logger.error("❌ Error en syncUserClaims", { error, callingUid });
        throw new HttpsError("internal", "Error al sincronizar tus permisos.");
    }
});


/**
 * Función para administradores para verificar la salud de los claims en el sistema.
 */
exports.diagnoseClaimsHealth = onCall(async (request) => {
    if (request.auth?.token?.rol !== "Administrador") {
        throw new HttpsError("permission-denied", "Solo los administradores pueden ejecutar esta acción.");
    }

    try {
        const usersSnapshot = await db.collection("users").get();
        const problematicUsers: ProblematicUser[] = [];
        
        const promises = usersSnapshot.docs.map(userDoc => 
            getAuth().getUser(userDoc.id).then(authUser => {
                const userData = userDoc.data();
                const tokenClaims = authUser.customClaims || {};
                const hasProblems = !tokenClaims.rol || 
                                    tokenClaims.rol !== userData.rol || 
                                    tokenClaims.claimsVersion !== userData.claimsVersion;
                
                if (hasProblems) {
                    problematicUsers.push({
                        uid: userDoc.id,
                        email: authUser.email,
                        dbRole: userData.rol,
                        tokenRole: tokenClaims.rol || null,
                        dbVersion: userData.claimsVersion || null,
                        tokenVersion: tokenClaims.claimsVersion || null,
                    });
                }
            }).catch(error => {
                logger.warn(`No se pudo verificar el usuario ${userDoc.id}:`, error.message);
            })
        );
        
        await Promise.all(promises);

        return {
            success: true,
            totalUsers: usersSnapshot.size,
            problematicUsersCount: problematicUsers.length,
            users: problematicUsers,
        };
    } catch (error) {
        logger.error("Error en diagnoseClaimsHealth:", error);
        throw new HttpsError("internal", "Error al diagnosticar estado de claims.");
    }
});

/**
 * Función auxiliar para que un admin verifique el estado de seguridad del sistema.
 */
exports.getSystemSecurityStatus = onCall(async (request) => {
    if (request.auth?.token?.rol !== "Administrador") {
        throw new HttpsError("permission-denied", "Solo los administradores pueden ejecutar esta acción.");
    }

    try {
        const activeAdmins = await db.collection("users").where("rol", "==", "Administrador").get();
        const configDoc = await db.collection("system_config").doc("security").get();
        const recentEvents = await db.collection("security_events").orderBy("timestamp", "desc").limit(5).get();

        return {
            activeAdminCount: activeAdmins.size,
            firstAdminInitialized: configDoc.data()?.firstAdminInitialized || false,
            recentSecurityEvents: recentEvents.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        };
    } catch (error) {
        logger.error("Error getting security status", { error });
        throw new HttpsError("internal", "Error al obtener estado de seguridad.");
    }
});


// =================================================================
// ===== FUNCIONES DE SEGURIDAD Y CÁLCULOS FINANCIEROS (TRIGGERS) =====
// =================================================================

const getMonthlyMultiplier = (frequency?: string): number => {
    const multipliers: { [key: string]: number } = {
        'Diario': 22, 'Semanal': 4.33, 'Quincenal': 2, 'Mensual': 1,
        'Bimestral': 1 / 2, 'Trimestral': 1 / 3, 'Semestral': 1 / 6,
        'Anual': 1 / 12, 'A demanda': 1,
    };
    return multipliers[frequency || ''] || 0;
};

/**
 * Recalcula campos de un procedimiento cuando se escribe en él.
 * Se basa en las actividades que contiene.
 */
exports.recalculateProcedure = onDocumentWritten("procedimientos/{docId}", async (event) => {
    const docId = event.params.docId;
    const after = event.data?.after;

    if (!after?.exists) {
        logger.info(`Procedimiento ${docId} eliminado, no se recalcula.`);
        return;
    }

    const procedureData = after.data();
    const activityOrder = procedureData?.activityOrder || [];

    if (activityOrder.length === 0) {
        await after.ref.update({ tiempoEstimado: 0, costoEstimado: 0, monedaCosto: null });
        return;
    }

    try {
        const activityDocs = await Promise.all(
            activityOrder.map((actId: string) => db.collection('actividades').doc(actId).get())
        );
        const activities = activityDocs.filter(doc => doc.exists && doc.data()?.activa).map(doc => doc.data()!);

        let totalTiempo = 0;
        const costosPorMoneda = new Map<string, number>();

        for (const activity of activities) {
            const monthlyMultiplier = getMonthlyMultiplier(activity.frecuencia);
            const monthlyExecutions = monthlyMultiplier * (activity.ejecucionesPorPeriodo || 1);
            totalTiempo += (activity.tiempoEstimado || 0) * monthlyExecutions;

            if (activity.puestoId && activity.tiempoEstimado) {
                const puestoDoc = await db.collection('puestos').doc(activity.puestoId).get();
                if (puestoDoc.exists) {
                    const puestoData = puestoDoc.data()!;
                    if (puestoData.costoHora) {
                        const costoActividad = (activity.tiempoEstimado * (puestoData.costoHora / 60)) * monthlyExecutions;
                        const moneda = puestoData.monedaCosto || 'MXN';
                        costosPorMoneda.set(moneda, (costosPorMoneda.get(moneda) || 0) + costoActividad);
                    }
                }
            }
        }

        let totalCosto = 0;
        let monedaFinal: string | null = null;
        if (costosPorMoneda.size > 0) {
            // CORRECCIÓN: Se usa Array.from para obtener la primera moneda de forma segura.
            const primeraMoneda = Array.from(costosPorMoneda.keys())[0];
            monedaFinal = primeraMoneda;
            totalCosto = costosPorMoneda.get(primeraMoneda) || 0;
            
            if (costosPorMoneda.size > 1) {
                logger.warn(`Procedimiento ${docId} tiene múltiples monedas. Usando ${monedaFinal}.`);
            }
        }

        await after.ref.update({
            tiempoEstimado: Math.round(totalTiempo * 100) / 100,
            costoEstimado: Math.round(totalCosto * 100) / 100,
            monedaCosto: monedaFinal
        });
        logger.info(`✅ Procedimiento ${docId} recalculado: tiempo=${totalTiempo}, costo=${totalCosto} ${monedaFinal}`);
    } catch (error) {
        logger.error(`❌ Error recalculando procedimiento ${docId}:`, error);
    }
    // CORRECCIÓN: Se añade un return para asegurar que todos los caminos de código devuelvan un valor.
    return;
});

/**
 * Recalcula campos de un proceso cuando se escribe en él.
 * Se basa en los procedimientos que contiene.
 */
exports.recalculateProcess = onDocumentWritten("procesos/{docId}", async (event) => {
    const docId = event.params.docId;
    const after = event.data?.after;

    if (!after?.exists) {
        logger.info(`Proceso ${docId} eliminado, no se recalcula.`);
        return;
    }

    const processData = after.data();
    const procedimientoOrder = processData?.procedimientoOrder || [];

    if (procedimientoOrder.length === 0) {
        await after.ref.update({ tiempoEstimado: 0, costoEstimado: 0, monedaCosto: null });
        return;
    }

    try {
        const procedureDocs = await Promise.all(
            procedimientoOrder.map((procId: string) => db.collection('procedimientos').doc(procId).get())
        );
        const procedures = procedureDocs.filter(doc => doc.exists && doc.data()?.activo).map(doc => doc.data()!);

        let totalTiempo = 0;
        let totalCosto = 0;
        const monedas = new Set<string>();
        
        procedures.forEach(proc => {
            totalTiempo += proc.tiempoEstimado || 0;
            totalCosto += proc.costoEstimado || 0;
            if (proc.monedaCosto) monedas.add(proc.monedaCosto);
        });
        
        // CORRECCIÓN: Se asegura que el valor sea string o null.
        const monedaFinal = monedas.size === 1 ? (monedas.values().next().value || null) : null;

        await after.ref.update({
            tiempoEstimado: Math.round(totalTiempo * 100) / 100,
            costoEstimado: Math.round(totalCosto * 100) / 100,
            monedaCosto: monedaFinal
        });
        logger.info(`✅ Proceso ${docId} recalculado: tiempo=${totalTiempo}, costo=${totalCosto} ${monedaFinal}`);
    } catch (error) {
        logger.error(`❌ Error recalculando proceso ${docId}:`, error);
    }
    // CORRECCIÓN: Se añade un return para asegurar que todos los caminos de código devuelvan un valor.
    return;
});

/**
 * Dispara el recálculo de procedimientos cuando una actividad relevante cambia.
 */
exports.triggerRecalcFromActivity = onDocumentWritten("actividades/{docId}", async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    const relevantFields = ['tiempoEstimado', 'frecuencia', 'ejecucionesPorPeriodo', 'puestoId', 'activa', 'procedimientoId'];
    const hasRelevantChanges = !event.data?.before.exists || !event.data?.after.exists || relevantFields.some(field => beforeData?.[field] !== afterData?.[field]);

    if (!hasRelevantChanges) return;

    const affectedProcedureIds = new Set<string>();
    if (beforeData?.procedimientoId) affectedProcedureIds.add(beforeData.procedimientoId);
    if (afterData?.procedimientoId) affectedProcedureIds.add(afterData.procedimientoId);

    for (const procedureId of affectedProcedureIds) {
        try {
            const procedureRef = db.collection('procedimientos').doc(procedureId);
            // Forzar trigger del procedimiento actualizando un timestamp
            await procedureRef.update({ updatedAt: new Date() });
            logger.info(`✅ Disparado recálculo para procedimiento ${procedureId}`);
        } catch (error) {
            logger.error(`❌ Error al disparar recálculo para proc ${procedureId}:`, error);
        }
    }
});

/**
 * (NOMBRE CORREGIDO) Dispara el recálculo de procesos cuando un procedimiento relevante cambia.
 */
exports.triggerRecalcFromProcedure = onDocumentWritten("procedimientos/{docId}", async (event) => {
    const docId = event.params.docId;
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    const financialFields = ['tiempoEstimado', 'costoEstimado', 'monedaCosto', 'activo'];
    const hasFinancialChanges = !event.data?.before.exists || !event.data?.after.exists || financialFields.some(field => beforeData?.[field] !== afterData?.[field]);

    if (!hasFinancialChanges) return;

    const processesQuery = await db.collection('procesos').where('procedimientoOrder', 'array-contains', docId).get();
    for (const processDoc of processesQuery.docs) {
        try {
            await processDoc.ref.update({ updatedAt: new Date() });
            logger.info(`✅ Disparado recálculo para proceso ${processDoc.id}`);
        } catch (error) {
            logger.error(`❌ Error al disparar recálculo para proceso ${processDoc.id}:`, error);
        }
    }
});

// Interfaz para el diagnóstico
interface ProblematicUser {
    uid: string;
    email: string | undefined;
    dbRole: string;
    tokenRole: string | null;
    dbVersion: number | null;
    tokenVersion: number | null;
}

    