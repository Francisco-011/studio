
'use server';

import { db } from './firebase';
import { collection, writeBatch, getDocs, doc, serverTimestamp, query, deleteDoc, arrayUnion } from 'firebase/firestore';

const collectionsToClear = [
  'acciones', 'actividades', 'areas', 'departamentos', 'politicas',
  'procedimientos', 'procesos', 'puestos', 'sistemas', 'sistemas_costos',
  'access_exceptions', 'activity_log', 'audits',
];

async function clearCollections() {
  console.log('Clearing all collections...');
  for (const collectionName of collectionsToClear) {
    try {
      const q = query(collection(db, collectionName));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        console.log(`Collection "${collectionName}" is already empty.`);
        continue;
      }
      const deletePromises: Promise<void>[] = [];
      querySnapshot.forEach((docSnapshot) => {
        deletePromises.push(deleteDoc(docSnapshot.ref));
      });
      await Promise.all(deletePromises);
      console.log(`Collection "${collectionName}" cleared.`);
    } catch (error) {
        console.warn(`Could not clear collection "${collectionName}":`, error);
    }
  }
  console.log('All collections cleared.');
}

export async function seedDatabase() {
  await clearCollections();

  const batch = writeBatch(db);

  // --- AREAS ---
  const seedAreas = [{ nombre: 'Finanzas' }, { nombre: 'Operaciones' }, { nombre: 'Tecnología' }, { nombre: 'Recursos Humanos' }];
  const areaRefs: { [key: string]: string } = {};
  for (const area of seedAreas) {
    const areaRef = doc(collection(db, 'areas'));
    batch.set(areaRef, { ...area, createdAt: serverTimestamp() });
    areaRefs[area.nombre] = areaRef.id;
  }
  
  // --- DEPARTAMENTOS ---
  const seedDepartamentos = [
    { nombre: 'Contabilidad', area: 'Finanzas' },
    { nombre: 'Tesorería', area: 'Finanzas' },
    { nombre: 'Logística', area: 'Operaciones' },
    { nombre: 'Infraestructura', area: 'Tecnología' },
    { nombre: 'Desarrollo', area: 'Tecnología' },
    { nombre: 'Reclutamiento y Selección', area: 'Recursos Humanos' },
  ];
  const deptoRefs: { [key: string]: string } = {};
  for (const depto of seedDepartamentos) {
    const areaId = areaRefs[depto.area];
    if (!areaId) {
        console.warn(`Skipping depto "${depto.nombre}" because area "${depto.area}" was not found.`);
        continue;
    }
    const deptoRef = doc(collection(db, 'departamentos'));
    batch.set(deptoRef, { nombre: depto.nombre, areaId: areaId, createdAt: serverTimestamp() });
    deptoRefs[depto.nombre] = deptoRef.id;
  }

  // --- PUESTOS ---
  const seedPuestos = [
    { nombre: 'Director de Finanzas', area: 'Finanzas', nivelOrganizacional: 'Directivo', costoHora: 500, monedaCosto: 'MXN', numeroPersonas: 1, auditFrequencyInDays: 365 },
    { nombre: 'Jefe de Contabilidad', area: 'Finanzas', departamento: 'Contabilidad', nivelOrganizacional: 'Gerencial', jefeInmediato: 'Director de Finanzas', costoHora: 350, monedaCosto: 'MXN', numeroPersonas: 1 },
    { nombre: 'Contador Senior', area: 'Finanzas', departamento: 'Contabilidad', nivelOrganizacional: 'Operativo', jefeInmediato: 'Jefe de Contabilidad', costoHora: 200, monedaCosto: 'MXN', numeroPersonas: 3, auditFrequencyInDays: 180 },
    { nombre: 'Director de Operaciones', area: 'Operaciones', nivelOrganizacional: 'Directivo', costoHora: 500, monedaCosto: 'MXN', numeroPersonas: 1 },
    { nombre: 'Gerente de TI', area: 'Tecnología', nivelOrganizacional: 'Gerencial', costoHora: 400, monedaCosto: 'USD', numeroPersonas: 1, auditFrequencyInDays: 180 },
    { nombre: 'Técnico de Soporte', area: 'Tecnología', departamento: 'Infraestructura', nivelOrganizacional: 'Operativo', jefeInmediato: 'Gerente de TI', costoHora: 150, monedaCosto: 'USD', numeroPersonas: 5 },
    { nombre: 'Reclutador', area: 'Recursos Humanos', departamento: 'Reclutamiento y Selección', nivelOrganizacional: 'Operativo', costoHora: 180, monedaCosto: 'MXN', numeroPersonas: 2 }
  ];
  const puestoRefs: { [key: string]: string } = {};
  for (const puesto of seedPuestos) {
    const areaId = areaRefs[puesto.area];
    const deptoId = puesto.departamento ? deptoRefs[puesto.departamento] : undefined;
    
    const puestoRef = doc(collection(db, 'puestos'));
    
    const data: any = {
      nombre: puesto.nombre,
      areaId: areaId,
      nivelOrganizacional: puesto.nivelOrganizacional,
      createdAt: serverTimestamp(),
    };
    
    if (deptoId) data.departamentoId = deptoId;
    if (puesto.costoHora !== undefined) data.costoHora = puesto.costoHora;
    if (puesto.monedaCosto) data.monedaCosto = puesto.monedaCosto;
    if (puesto.numeroPersonas !== undefined) data.numeroPersonas = puesto.numeroPersonas;
    if (puesto.auditFrequencyInDays !== undefined) data.auditFrequencyInDays = puesto.auditFrequencyInDays;

    batch.set(puestoRef, data);
    puestoRefs[puesto.nombre] = puestoRef.id;
  }
  // Second loop to assign jefeInmediato
  for (const puesto of seedPuestos) {
      if (puesto.jefeInmediato) {
          const puestoId = puestoRefs[puesto.nombre];
          const jefeId = puestoRefs[puesto.jefeInmediato];
          if (puestoId && jefeId) {
              const puestoRef = doc(db, 'puestos', puestoId);
              batch.update(puestoRef, { jefeInmediato: jefeId });
          }
      }
  }
  
  // --- SISTEMAS ---
  const seedSistemas = [
    { nombre: 'SAP S/4HANA', scope: 'Área', scopeNombre: 'Finanzas' },
    { nombre: 'Microsoft Office 365', scope: 'Empresa' },
    { nombre: 'Jira', scope: 'Departamento', scopeNombre: 'Desarrollo' },
    { nombre: 'Slack', scope: 'Empresa' },
  ];
  const sistemaRefs: { [key: string]: string } = {};
  for (const sistema of seedSistemas) {
    const sistemaRef = doc(collection(db, 'sistemas'));
    let scopeId: string | undefined;
    if (sistema.scope === 'Área') {
        scopeId = areaRefs[sistema.scopeNombre];
    } else if (sistema.scope === 'Departamento') {
        scopeId = deptoRefs[sistema.scopeNombre];
    } else if (sistema.scope === 'Puesto') {
        scopeId = puestoRefs[sistema.scopeNombre];
    }

    if (sistema.scope !== 'Empresa' && !scopeId) {
        console.warn(`Skipping sistema "${sistema.nombre}" because scope entity "${sistema.scopeNombre}" not found.`);
        continue;
    }

    batch.set(sistemaRef, {
        nombre: sistema.nombre,
        scope: sistema.scope,
        scopeId: scopeId || null,
        createdAt: serverTimestamp()
    });
    sistemaRefs[sistema.nombre] = sistemaRef.id;
  }
  
  // --- SISTEMAS COSTOS ---
  const seedSistemasCostos = [
    { sistema: 'SAP S/4HANA', descripcion: 'Licenciamiento Anual', costoPorLicencia: 1200, numeroLicencias: 10, frecuencia: 'Anual', moneda: 'USD' },
    { sistema: 'Microsoft Office 365', descripcion: 'Suscripción E3 Mensual', costoPorLicencia: 36, numeroLicencias: 50, frecuencia: 'Mensual', moneda: 'USD' },
    { sistema: 'Jira', descripcion: 'Suscripción Cloud Standard', montoUso: 815, frecuencia: 'Mensual', moneda: 'USD' },
    { sistema: 'Slack', descripcion: 'Plan Pro Anual', costoPorLicencia: 81, numeroLicencias: 50, frecuencia: 'Anual', moneda: 'USD' },
  ];

  for (const costo of seedSistemasCostos) {
      const sistemaId = sistemaRefs[costo.sistema];
      if (!sistemaId) {
          console.warn(`Skipping cost for "${costo.sistema}" because the system was not found.`);
          continue;
      }
      const costoRef = doc(collection(db, 'sistemas_costos'));
      batch.set(costoRef, {
          sistemaId: sistemaId,
          descripcion: costo.descripcion,
          costoPorLicencia: costo.costoPorLicencia || null,
          numeroLicencias: costo.numeroLicencias || null,
          montoUso: costo.montoUso || null,
          frecuencia: costo.frecuencia,
          moneda: costo.moneda
      });
  }

  // --- ACTIVIDADES ---
  const seedActividades = [
    // Proceso 1: Pago a Proveedores
    { nombre: 'Revisar Facturas de Proveedores', puesto: 'Contador Senior', sistema: 'SAP S/4HANA', tiempoEstimado: 15, tiempoIdeal: 10, frecuencia: 'Diario', ejecucionesPorPeriodo: 20, descripcionBreve: 'Validar que la factura del proveedor cumpla con los requisitos fiscales y de la orden de compra.' },
    { nombre: 'Programar Pago a Proveedor', puesto: 'Contador Senior', sistema: 'SAP S/4HANA', tiempoEstimado: 10, tiempoIdeal: 8, frecuencia: 'Semanal', ejecucionesPorPeriodo: 1, descripcionBreve: 'Registrar la factura en el sistema y programar la fecha de pago según las condiciones pactadas.' },
    { nombre: 'Aprobar Pago Mayor a 50k', puesto: 'Jefe de Contabilidad', tiempoEstimado: 5, tiempoIdeal: 5, frecuencia: 'A demanda', ejecucionesPorPeriodo: 5, descripcionBreve: 'Realizar la aprobación final en el sistema para pagos que exceden el umbral de 50,000 MXN.' },
    // Proceso 2: Soporte Técnico
    { nombre: 'Atender Ticket de Soporte Nivel 1', puesto: 'Técnico de Soporte', sistema: 'Jira', tiempoEstimado: 25, tiempoIdeal: 20, frecuencia: 'Diario', ejecucionesPorPeriodo: 10, descripcionBreve: 'Proporcionar primera línea de soporte a usuarios con problemas técnicos comunes.' },
    // Proceso 3: Reclutamiento
    { nombre: 'Publicar Vacante', puesto: 'Reclutador', tiempoEstimado: 30, tiempoIdeal: 25, frecuencia: 'A demanda', ejecucionesPorPeriodo: 1, descripcionBreve: 'Redactar y publicar ofertas de empleo en diversas plataformas y redes sociales.' },
    { nombre: 'Entrevistar Candidato', puesto: 'Reclutador', tiempoEstimado: 60, tiempoIdeal: 45, frecuencia: 'A demanda', ejecucionesPorPeriodo: 3, descripcionBreve: 'Conducir entrevistas por competencias para evaluar la idoneidad de los candidatos.' },
    { nombre: 'Elaborar reporte mensual de gastos', puesto: 'Contador Senior', sistema: 'Microsoft Office 365', tiempoEstimado: 240, tiempoIdeal: 180, frecuencia: 'Mensual', ejecucionesPorPeriodo: 1, descripcionBreve: 'Consolidar y analizar los gastos del mes para generar el reporte para la dirección.' },
    
    // Nuevas Actividades
    // Proceso 4: Gestión de Presupuesto Anual
    { nombre: 'Diseñar formato de presupuesto', puesto: 'Director de Finanzas', sistema: 'Microsoft Office 365', tiempoEstimado: 480, tiempoIdeal: 360, frecuencia: 'Anual', ejecucionesPorPeriodo: 1 },
    { nombre: 'Distribuir plantillas a áreas', puesto: 'Director de Finanzas', sistema: 'Microsoft Office 365', tiempoEstimado: 120, tiempoIdeal: 90, frecuencia: 'Anual', ejecucionesPorPeriodo: 1 },
    { nombre: 'Recopilar presupuestos de áreas', puesto: 'Jefe de Contabilidad', sistema: 'Microsoft Office 365', tiempoEstimado: 240, tiempoIdeal: 180, frecuencia: 'Anual', ejecucionesPorPeriodo: 1 },
    { nombre: 'Analizar desviaciones vs año anterior', puesto: 'Jefe de Contabilidad', sistema: 'SAP S/4HANA', tiempoEstimado: 960, tiempoIdeal: 720, frecuencia: 'Anual', ejecucionesPorPeriodo: 1 },
    { nombre: 'Presentar presupuesto consolidado a dirección', puesto: 'Director de Finanzas', tiempoEstimado: 120, tiempoIdeal: 90, frecuencia: 'Anual', ejecucionesPorPeriodo: 1 },
    { nombre: 'Cargar presupuesto aprobado en SAP', puesto: 'Jefe de Contabilidad', sistema: 'SAP S/4HANA', tiempoEstimado: 180, tiempoIdeal: 120, frecuencia: 'Anual', ejecucionesPorPeriodo: 1 },
    
    // Proceso 5: Mantenimiento de Infraestructura TI
    { nombre: 'Revisar logs de servidores', puesto: 'Técnico de Soporte', tiempoEstimado: 60, tiempoIdeal: 45, frecuencia: 'Diario', ejecucionesPorPeriodo: 1 },
    { nombre: 'Aplicar parches de seguridad', puesto: 'Gerente de TI', tiempoEstimado: 240, tiempoIdeal: 180, frecuencia: 'Mensual', ejecucionesPorPeriodo: 1 },
    { nombre: 'Realizar respaldo de información crítica', puesto: 'Técnico de Soporte', sistema: 'SAP S/4HANA', tiempoEstimado: 120, tiempoIdeal: 90, frecuencia: 'Semanal', ejecucionesPorPeriodo: 1 },
    { nombre: 'Auditar inventario físico vs sistema', puesto: 'Técnico de Soporte', tiempoEstimado: 480, tiempoIdeal: 360, frecuencia: 'Semestral', ejecucionesPorPeriodo: 1 },
    
    // Proceso 6: Onboarding
    { nombre: 'Solicitar equipo de cómputo', puesto: 'Reclutador', sistema: 'Jira', tiempoEstimado: 15, tiempoIdeal: 10, frecuencia: 'A demanda', ejecucionesPorPeriodo: 1 },
    { nombre: 'Crear cuentas de usuario', puesto: 'Técnico de Soporte', tiempoEstimado: 30, tiempoIdeal: 20, frecuencia: 'A demanda', ejecucionesPorPeriodo: 1 },
    { nombre: 'Preparar kit de bienvenida', puesto: 'Reclutador', tiempoEstimado: 20, tiempoIdeal: 15, frecuencia: 'A demanda', ejecucionesPorPeriodo: 1 },
    
    // Proceso 7: Gestión de Activos Fijos
    { nombre: 'Dar de alta activo fijo', puesto: 'Contador Senior', sistema: 'SAP S/4HANA', tiempoEstimado: 20, tiempoIdeal: 15, frecuencia: 'A demanda', ejecucionesPorPeriodo: 1 },
    { nombre: 'Calcular depreciación mensual', puesto: 'Contador Senior', sistema: 'SAP S/4HANA', tiempoEstimado: 180, tiempoIdeal: 120, frecuencia: 'Mensual', ejecucionesPorPeriodo: 1 },

    // Proceso 8: Desarrollo de Software
    { nombre: 'Planificar sprint', puesto: 'Gerente de TI', sistema: 'Jira', tiempoEstimado: 120, tiempoIdeal: 90, frecuencia: 'Quincenal', ejecucionesPorPeriodo: 1 },
    { nombre: 'Desarrollar nueva funcionalidad', puesto: 'Gerente de TI', tiempoEstimado: 1920, tiempoIdeal: 1600, frecuencia: 'Quincenal', ejecucionesPorPeriodo: 1 }, // 40h
  ];
  const actividadRefs: { [key: string]: string } = {};
  for (const act of seedActividades) {
    const actRef = doc(collection(db, 'actividades'));
    const puestoId = act.puesto ? puestoRefs[act.puesto] : undefined;
    
    const data: any = {
      nombre: act.nombre,
      activa: true,
      codigo: `AC-${Date.now().toString().slice(-5)}-${Math.random().toString(16).slice(2,5)}`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (puestoId) data.puestoId = puestoId;
    if (act.descripcionBreve) data.descripcionBreve = act.descripcionBreve;
    if (act.sistema) data.sistemaUtilizado = act.sistema;
    if (act.tiempoEstimado) data.tiempoEstimado = act.tiempoEstimado;
    if (act.tiempoIdeal) data.tiempoIdeal = act.tiempoIdeal;
    if (act.frecuencia) data.frecuencia = act.frecuencia;
    if (act.ejecucionesPorPeriodo) data.ejecucionesPorPeriodo = act.ejecucionesPorPeriodo;

    batch.set(actRef, data);
    actividadRefs[act.nombre] = actRef.id;
  }

  // --- PROCEDIMIENTOS ---
  const seedProcedimientos = [
    // Proceso 1
    { nombre: 'Pago a Proveedores', procesoPadre: 'Cuentas por Pagar', clasificacion: 'Privado', activityOrder: ['Revisar Facturas de Proveedores', 'Programar Pago a Proveedor', 'Aprobar Pago Mayor a 50k'], descripcion: 'Flujo operativo para la gestión y liquidación de facturas de proveedores.', sistemasUtilizados: ['SAP S/4HANA', 'Microsoft Office 365'] },
    // Proceso 2
    { nombre: 'Resolución de Incidencias de TI', procesoPadre: 'Soporte Técnico a Usuarios', clasificacion: 'Público', activityOrder: ['Atender Ticket de Soporte Nivel 1'], descripcion: 'Protocolo para atender y resolver las solicitudes de soporte técnico de los empleados.', sistemasUtilizados: ['Jira', 'Slack'] },
    // Proceso 3
    { nombre: 'Reclutamiento de Personal', procesoPadre: 'Atracción de Talento', clasificacion: 'Confidencial', activityOrder: ['Publicar Vacante', 'Entrevistar Candidato'], descripcion: 'Define los pasos a seguir para reclutar y seleccionar nuevo personal.' },
    // Proceso 4
    { nombre: 'Elaboración de Plantillas de Presupuesto', procesoPadre: 'Gestión de Presupuesto Anual', clasificacion: 'Confidencial', activityOrder: ['Diseñar formato de presupuesto', 'Distribuir plantillas a áreas'] },
    { nombre: 'Consolidación y Revisión de Presupuesto', procesoPadre: 'Gestión de Presupuesto Anual', clasificacion: 'Confidencial', activityOrder: ['Recopilar presupuestos de áreas', 'Analizar desviaciones vs año anterior'] },
    { nombre: 'Aprobación Final de Presupuesto', procesoPadre: 'Gestión de Presupuesto Anual', clasificacion: 'Confidencial', activityOrder: ['Presentar presupuesto consolidado a dirección', 'Cargar presupuesto aprobado en SAP'] },
    // Proceso 5
    { nombre: 'Mantenimiento Preventivo de Servidores', procesoPadre: 'Mantenimiento de Infraestructura de TI', clasificacion: 'Privado', activityOrder: ['Revisar logs de servidores', 'Aplicar parches de seguridad', 'Realizar respaldo de información crítica'] },
    // Proceso 6
    { nombre: 'Preparación de Ingreso de Personal', procesoPadre: 'Onboarding de Nuevos Empleados', clasificacion: 'Privado', activityOrder: ['Solicitar equipo de cómputo', 'Crear cuentas de usuario', 'Preparar kit de bienvenida'] },
    // Proceso 7
    { nombre: 'Contabilidad de Activos', procesoPadre: 'Gestión de Activos Fijos', clasificacion: 'Privado', activityOrder: ['Dar de alta activo fijo', 'Calcular depreciación mensual'] },
    // Proceso 8
    { nombre: 'Ciclo de Desarrollo', procesoPadre: 'Desarrollo de Nuevas Funcionalidades', clasificacion: 'Privado', activityOrder: ['Planificar sprint', 'Desarrollar nueva funcionalidad'] },
  ];
  const procedimientoRefs: { [key: string]: string } = {};
  for (const proc of seedProcedimientos) {
    const procRef = doc(collection(db, 'procedimientos'));
    
    const data: any = {
      nombre: proc.nombre,
      clasificacion: proc.clasificacion,
      activityOrder: proc.activityOrder.map(name => actividadRefs[name]).filter(id => !!id),
      activo: true,
      codigo: `PC-${Date.now().toString().slice(-5)}-${Math.random().toString(16).slice(2,5)}`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (proc.descripcion) data.descripcion = proc.descripcion;
    if (proc.sistemasUtilizados) data.sistemasUtilizados = proc.sistemasUtilizados;

    batch.set(procRef, data);
    procedimientoRefs[proc.nombre] = procRef.id;
  }
  
  // --- PROCESOS ---
  const seedProcesos = [
    { nombre: 'Cuentas por Pagar', area: 'Finanzas', puesto: 'Jefe de Contabilidad', descripcion: 'Gestiona el flujo completo de pagos a proveedores, asegurando la precisión y el cumplimiento de las políticas financieras.', auditFrequencyInDays: 365, sistemas: ['SAP S/4HANA'] },
    { nombre: 'Soporte Técnico a Usuarios', area: 'Tecnología', puesto: 'Gerente de TI', descripcion: 'Provee asistencia técnica a todos los empleados para resolver incidencias de hardware y software.', sistemas: ['Jira', 'Slack'] },
    { nombre: 'Atracción de Talento', area: 'Recursos Humanos', puesto: 'Reclutador', descripcion: 'Ciclo completo de reclutamiento para nuevas posiciones.', auditFrequencyInDays: 365 },
    { nombre: 'Gestión de Presupuesto Anual', area: 'Finanzas', puesto: 'Director de Finanzas', descripcion: 'Coordina la creación, consolidación y aprobación del presupuesto anual de la compañía.', auditFrequencyInDays: 365 },
    { nombre: 'Mantenimiento de Infraestructura de TI', area: 'Tecnología', puesto: 'Gerente de TI', descripcion: 'Asegura la disponibilidad y seguridad de la infraestructura tecnológica de la empresa.', auditFrequencyInDays: 180 },
    { nombre: 'Onboarding de Nuevos Empleados', area: 'Recursos Humanos', puesto: 'Reclutador', descripcion: 'Proceso para integrar a los nuevos empleados a la cultura y herramientas de la empresa.' },
    { nombre: 'Gestión de Activos Fijos', area: 'Finanzas', puesto: 'Jefe de Contabilidad', descripcion: 'Control y seguimiento contable de los activos fijos de la empresa.', auditFrequencyInDays: 180 },
    { nombre: 'Desarrollo de Nuevas Funcionalidades', area: 'Tecnología', puesto: 'Gerente de TI', descripcion: 'Ciclo de vida para el desarrollo e implementación de nuevas características en el software interno.' }
  ];
  const procesoRefs: { [key: string]: string } = {};
  for (const proc of seedProcesos) {
    const puestoId = proc.puesto ? puestoRefs[proc.puesto] : undefined;
    if (!puestoId) {
        console.warn(`Skipping proceso "${proc.nombre}" due to missing puesto: "${proc.puesto}"`);
        continue;
    }

    const procRef = doc(collection(db, 'procesos'));
    const linkedProcedimientos = seedProcedimientos
        .filter(p => p.procesoPadre === proc.nombre)
        .map(p => procedimientoRefs[p.nombre])
        .filter(id => !!id);
        
    const data: any = {
        proceso: proc.nombre,
        area: proc.area,
        puesto: proc.puesto,
        puestoId: puestoId,
        descripcion: proc.descripcion,
        activo: true,
        codigo: `PR-${Date.now().toString().slice(-6)}`,
        capturedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        procedimientoOrder: linkedProcedimientos,
    };
    if (proc.sistemas) data.sistemas = proc.sistemas;
    if (proc.auditFrequencyInDays) data.auditFrequencyInDays = proc.auditFrequencyInDays;

    batch.set(procRef, data);
    procesoRefs[proc.nombre] = procRef.id;
    
    // Link back from procedimiento to proceso
    for(const procManualId of linkedProcedimientos) {
      const procManualRef = doc(db, 'procedimientos', procManualId);
      batch.update(procManualRef, { procesoId: procRef.id });
    }
  }

  // --- POLÍTICAS ---
  const seedPoliticas = [
    { titulo: 'Política de Acceso a Sistemas Críticos', area: 'Tecnología', departamento: 'Infraestructura', nivel: 'Obligatorio', clasificacion: 'Privado', procesoVinculado: 'Cuentas por Pagar', procedimientoVinculado: 'Pago a Proveedores', consecuenciasIncumplimiento: 'Suspensión de acceso y posibles sanciones disciplinarias.', descripcion: 'Define los roles y responsabilidades para el acceso a sistemas que manejan información financiera sensible, como SAP.' },
    { titulo: 'Política de Gastos de Viaje', area: 'Finanzas', nivel: 'Recomendado', clasificacion: 'Público', procesoVinculado: 'Cuentas por Pagar', procedimientoVinculado: 'Pago a Proveedores', consecuenciasIncumplimiento: 'No reembolso de gastos no autorizados.', descripcion: 'Establece los lineamientos y topes para los gastos de viaje de los empleados.' },
  ];
  for (const pol of seedPoliticas) {
    const polRef = doc(collection(db, 'politicas'));
    const procesoId = pol.procesoVinculado ? procesoRefs[pol.procesoVinculado] : undefined;
    const procedimientoId = pol.procedimientoVinculado ? procedimientoRefs[pol.procedimientoVinculado] : undefined;
    const deptoId = pol.departamento ? deptoRefs[pol.departamento] : undefined;

    const data: any = {
      titulo: pol.titulo,
      descripcion: pol.descripcion,
      areaResponsable: pol.area,
      nivelCompliance: pol.nivel,
      clasificacion: pol.clasificacion,
      estado: 'Aprobada',
      fechaVigencia: new Date().toISOString(),
      fechaRevision: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
      codigo: `PO-${Date.now().toString().slice(-5)}-${Math.random().toString(16).slice(2,5)}`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      procesosAsociadosIds: procesoId ? [procesoId] : [],
      procedimientosAsociadosIds: procedimientoId ? [procedimientoId] : [],
    };
    if (deptoId) data.departamentoResponsable = deptoId;
    if (pol.consecuenciasIncumplimiento) data.consecuenciasIncumplimiento = pol.consecuenciasIncumplimiento;
    
    batch.set(polRef, data);

    if (procesoId) {
        const procesoDocRef = doc(db, 'procesos', procesoId);
        batch.update(procesoDocRef, {
            politicasAsociadas: arrayUnion({ policyId: polRef.id, linkType: 'Regula' })
        });
    }

    if (procedimientoId) {
        const procedimientoDocRef = doc(db, 'procedimientos', procedimientoId);
        batch.update(procedimientoDocRef, {
            politicasAsociadasIds: arrayUnion(polRef.id)
        });
    }
  }

  // Update activities with their procedimientoId
  for (const proc of seedProcedimientos) {
    const procId = procedimientoRefs[proc.nombre];
    if (procId && proc.activityOrder) {
      for (const actName of proc.activityOrder) {
        const actId = actividadRefs[actName];
        if (actId) {
          const actRef = doc(db, 'actividades', actId);
          batch.update(actRef, { procedimientoId: procId });
        }
      }
    }
  }

  await batch.commit();
  console.log('Database seeded successfully!');
}
    
