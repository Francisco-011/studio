
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
    { nombre: 'Director de Finanzas', area: 'Finanzas', nivelOrganizacional: 'Directivo', costoHora: 500, monedaCosto: 'MXN' },
    { nombre: 'Jefe de Contabilidad', area: 'Finanzas', departamento: 'Contabilidad', nivelOrganizacional: 'Gerencial', jefeInmediato: 'Director de Finanzas', costoHora: 350, monedaCosto: 'MXN' },
    { nombre: 'Contador Senior', area: 'Finanzas', departamento: 'Contabilidad', nivelOrganizacional: 'Operativo', jefeInmediato: 'Jefe de Contabilidad', costoHora: 200, monedaCosto: 'MXN' },
    { nombre: 'Director de Operaciones', area: 'Operaciones', nivelOrganizacional: 'Directivo', costoHora: 500, monedaCosto: 'MXN' },
    { nombre: 'Gerente de TI', area: 'Tecnología', nivelOrganizacional: 'Gerencial', costoHora: 400, monedaCosto: 'USD' },
    { nombre: 'Técnico de Soporte', area: 'Tecnología', departamento: 'Infraestructura', nivelOrganizacional: 'Operativo', jefeInmediato: 'Gerente de TI', costoHora: 150, monedaCosto: 'USD' },
    { nombre: 'Reclutador', area: 'Recursos Humanos', departamento: 'Reclutamiento y Selección', nivelOrganizacional: 'Operativo', costoHora: 180, monedaCosto: 'MXN' }
  ];
  const puestoRefs: { [key: string]: string } = {};
  for (const puesto of seedPuestos) {
    const areaId = areaRefs[puesto.area];
    if (!areaId) {
        console.warn(`Skipping puesto "${puesto.nombre}" due to missing area: "${puesto.area}"`);
        continue;
    }

    const puestoRef = doc(collection(db, 'puestos'));
    
    const jefeId = puesto.jefeInmediato ? puestoRefs[puesto.jefeInmediato] : undefined;

    const data: any = {
      nombre: puesto.nombre,
      areaId: areaId,
      nivelOrganizacional: puesto.nivelOrganizacional,
      costoHora: puesto.costoHora,
      monedaCosto: puesto.monedaCosto,
      createdAt: serverTimestamp(),
    };
    
    if (puesto.departamento) {
      const deptoId = deptoRefs[puesto.departamento];
      if (deptoId) {
        data.departamentoId = deptoId;
      }
    }
    if (jefeId) {
      data.jefeInmediato = jefeId;
    }
    if (puesto.numeroPersonas) {
      data.numeroPersonas = puesto.numeroPersonas;
    }

    batch.set(puestoRef, data);
    puestoRefs[puesto.nombre] = puestoRef.id;
  }
  
  // --- ACTIVIDADES ---
  const seedActividades = [
    { nombre: 'Revisar Facturas de Proveedores', puesto: 'Contador Senior' },
    { nombre: 'Programar Pago a Proveedor', puesto: 'Contador Senior' },
    { nombre: 'Aprobar Pago Mayor a 50k', puesto: 'Jefe de Contabilidad' },
    { nombre: 'Atender Ticket de Soporte Nivel 1', puesto: 'Técnico de Soporte' },
    { nombre: 'Publicar Vacante', puesto: 'Reclutador' },
    { nombre: 'Entrevistar Candidato', puesto: 'Reclutador' },
  ];
  const actividadRefs: { [key: string]: string } = {};
  for (const act of seedActividades) {
    const actRef = doc(collection(db, 'actividades'));
    const puestoId = puestoRefs[act.puesto];
    
    const data: any = {
      nombre: act.nombre,
      activa: true,
      codigo: `AC-${Date.now().toString().slice(-5)}-${Math.random().toString(16).slice(2,5)}`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (puestoId) {
        data.puestoId = puestoId;
    }

    batch.set(actRef, data);
    actividadRefs[act.nombre] = actRef.id;
  }

  // --- PROCEDIMIENTOS ---
  const seedProcedimientos = [
    {
      nombre: 'Proceso de Pago a Proveedores',
      procesoPadre: 'Cuentas por Pagar',
      clasificacion: 'Privado',
      activityOrder: ['Revisar Facturas de Proveedores', 'Programar Pago a Proveedor', 'Aprobar Pago Mayor a 50k']
    },
    {
      nombre: 'Resolución de Incidencias de TI',
      procesoPadre: 'Soporte Técnico a Usuarios',
      clasificacion: 'Público',
      activityOrder: ['Atender Ticket de Soporte Nivel 1']
    },
    {
      nombre: 'Reclutamiento de Personal',
      procesoPadre: 'Atracción de Talento',
      clasificacion: 'Confidencial',
      activityOrder: ['Publicar Vacante', 'Entrevistar Candidato']
    }
  ];
  const procedimientoRefs: { [key: string]: string } = {};
  for (const proc of seedProcedimientos) {
    const procRef = doc(collection(db, 'procedimientos'));
    batch.set(procRef, {
      nombre: proc.nombre,
      clasificacion: proc.clasificacion,
      activityOrder: proc.activityOrder.map(name => actividadRefs[name]).filter(id => !!id),
      activo: true,
      codigo: `PC-${Date.now().toString().slice(-5)}-${Math.random().toString(16).slice(2,5)}`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    procedimientoRefs[proc.nombre] = procRef.id;
  }
  
  // --- PROCESOS ---
  const seedProcesos = [
    { nombre: 'Cuentas por Pagar', area: 'Finanzas', puesto: 'Jefe de Contabilidad', descripcion: 'Gestiona el flujo completo de pagos a proveedores.' },
    { nombre: 'Soporte Técnico a Usuarios', area: 'Tecnología', puesto: 'Gerente de TI', descripcion: 'Provee asistencia técnica a todos los empleados.' },
    { nombre: 'Atracción de Talento', area: 'Recursos Humanos', puesto: 'Reclutador', descripcion: 'Ciclo completo de reclutamiento para nuevas posiciones.' },
  ];
  const procesoRefs: { [key: string]: string } = {};
  for (const proc of seedProcesos) {
    const puestoId = puestoRefs[proc.puesto];
    if (!puestoId) {
        console.warn(`Skipping proceso "${proc.nombre}" due to missing puesto: "${proc.puesto}"`);
        continue;
    }

    const procRef = doc(collection(db, 'procesos'));
    const linkedProcedimientos = seedProcedimientos
        .filter(p => p.procesoPadre === proc.nombre)
        .map(p => procedimientoRefs[p.nombre])
        .filter(id => !!id);
        
    batch.set(procRef, {
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
    });
    procesoRefs[proc.nombre] = procRef.id;
    
    // Link back from procedimiento to proceso
    for(const procManualId of linkedProcedimientos) {
      const procManualRef = doc(db, 'procedimientos', procManualId);
      batch.update(procManualRef, { procesoId: procRef.id });
    }
  }

  // --- POLÍTICAS ---
  const seedPoliticas = [
    { titulo: 'Política de Acceso a Sistemas Críticos', area: 'Tecnología', nivel: 'Obligatorio', clasificacion: 'Privado', procesoVinculado: 'Cuentas por Pagar' },
    { titulo: 'Política de Gastos de Viaje', area: 'Finanzas', nivel: 'Recomendado', clasificacion: 'Público', procesoVinculado: 'Cuentas por Pagar' },
  ];
  for (const pol of seedPoliticas) {
    const polRef = doc(collection(db, 'politicas'));
    const procesoId = procesoRefs[pol.procesoVinculado];
    batch.set(polRef, {
      titulo: pol.titulo,
      descripcion: `Descripción de ejemplo para ${pol.titulo}`,
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
    });

    if (procesoId) {
        const procesoDocRef = doc(db, 'procesos', procesoId);
        batch.update(procesoDocRef, {
            politicasAsociadas: arrayUnion({ policyId: polRef.id, linkType: 'Regula' })
        });
    }
  }

  await batch.commit();
  console.log('Database seeded successfully!');
}
