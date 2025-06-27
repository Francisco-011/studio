
'use client';

import { useState, type ChangeEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { UploadCloud, Download, Loader2, FileText, Building, Users, Laptop, ListChecks, Database } from "lucide-react";
import { useAreas } from '@/contexts/AreasContext';
import { usePuestos, type PuestoCreationData } from '@/contexts/PuestosContext';
import { useSistemasCostos, type SistemaCreationData } from '@/contexts/SistemasCostosContext';
import { useActividades, type Actividad } from '@/contexts/ActividadesContext';
import { useProcesos } from '@/contexts/ProcesosContext';
import type { CapturaFormData } from '../../captura/page';

interface ImportResult {
    success: number;
    skipped: number;
    failed: number;
    errors: string[];
}

const entityConfigs = {
    areas: {
        name: "Áreas",
        icon: Building,
        headers: ["nombre"],
        description: "Una columna: 'nombre'. Cada fila representa un área nueva. Los nombres de área duplicados serán omitidos.",
    },
    puestos: {
        name: "Puestos",
        icon: Users,
        headers: ["nombre", "areaNombre", "jefePuestoNombre", "nivelOrganizacional", "numeroPersonas"],
        description: "Columnas: 'nombre', 'areaNombre' (opcional), 'jefePuestoNombre' (opcional), 'nivelOrganizacional', 'numeroPersonas' (opcional). El nombre de puesto debe ser único. Los nombres de área y jefe deben existir previamente.",
    },
    sistemas: {
        name: "Sistemas",
        icon: Laptop,
        headers: ["nombre", "scope", "scopeNombre"],
        description: "Columnas: 'nombre', 'scope' (Empresa, Área, o Puesto), 'scopeNombre' (opcional, requerido si el scope no es 'Empresa'). El nombre del sistema debe ser único. El scopeNombre debe existir.",
    },
    actividades: {
        name: "Actividades",
        icon: ListChecks,
        headers: ["nombre", "descripcionBreve", "sistemaUtilizado", "tiempoEstimadoActividad", "tiempoIdealActividad", "costoEstimadoActividad", "costoIdealActividad", "monedaCostoActividad", "frecuenciaActividad"],
        description: "Columnas: 'nombre', 'descripcionBreve', 'sistemaUtilizado', etc. Los nombres de actividad duplicados serán omitidos. 'sistemaUtilizado' debe existir previamente si se especifica.",
    },
    procesos: {
        name: "Procesos",
        icon: Database,
        headers: ["proceso", "area", "puesto", "descripcion", "frecuencia", "tiempoEstimado", "tiempoIdeal", "costoEstimado", "costoIdeal", "monedaCosto", "sistemas", "informacionRecibe", "procesosEntrada", "informacionEntrega", "procesosSalida"],
        description: "Múltiples columnas que coinciden con el formulario de captura. 'area' y 'puesto' deben existir. Para campos de selección múltiple como 'sistemas', separe los valores con punto y coma (;).",
    }
};

type EntityKey = keyof typeof entityConfigs;

export default function CargaMasivaPage() {
    const [files, setFiles] = useState<Record<EntityKey, File | null>>({ areas: null, puestos: null, sistemas: null, actividades: null, procesos: null });
    const [results, setResults] = useState<Record<EntityKey, ImportResult | null>>({ areas: null, puestos: null, sistemas: null, actividades: null, procesos: null });
    const [isLoading, setIsLoading] = useState<Record<EntityKey, boolean>>({ areas: false, puestos: false, sistemas: false, actividades: false, procesos: false });

    const { areas, addArea, isLoading: isLoadingAreas } = useAreas();
    const { puestos, addPuesto, isLoadingPuestos } = usePuestos();
    const { sistemas, addSistema, isLoadingSistemasCostos } = useSistemasCostos();
    const { actividades, addActividad, isLoadingActividades } = useActividades();
    const { procesos, addProceso: addContextProceso } = useProcesos();

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>, entity: EntityKey) => {
        const file = e.target.files?.[0] || null;
        setFiles(prev => ({ ...prev, [entity]: file }));
        setResults(prev => ({ ...prev, [entity]: null }));
    };

    const downloadTemplate = (entity: EntityKey) => {
        const headers = entityConfigs[entity].headers.join(',');
        const blob = new Blob(["\uFEFF" + headers], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `plantilla_${entity}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const parseCSV = (text: string): Record<string, string>[] => {
        const lines = text.trim().replace(/\r/g, '').split('\n');
        if (lines.length < 2) return [];
        const header = lines[0].split(',').map(h => h.trim());
        return lines.slice(1).map(line => {
            const values = line.split(',');
            const obj: Record<string, string> = {};
            header.forEach((key, i) => {
                obj[key] = values[i] ? values[i].trim().replace(/^"|"$/g, '') : '';
            });
            return obj;
        });
    };

    const handleImport = async (entity: EntityKey) => {
        const file = files[entity];
        if (!file) {
            toast({ title: "No se ha seleccionado archivo", variant: "destructive" });
            return;
        }

        setIsLoading(prev => ({ ...prev, [entity]: true }));
        setResults(prev => ({ ...prev, [entity]: null }));

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            const data = parseCSV(text);
            const result: ImportResult = { success: 0, skipped: 0, failed: 0, errors: [] };
            
            // This is a simplified import logic. A real-world app would need more robust validation.
            switch (entity) {
                case 'areas':
                    for (const row of data) {
                        const nombre = row.nombre?.trim();
                        if (!nombre) {
                            result.failed++;
                            result.errors.push(`Fila inválida, falta el nombre: ${JSON.stringify(row)}`);
                            continue;
                        }
                        if (areas.some(a => a.nombre.toLowerCase() === nombre.toLowerCase())) {
                            result.skipped++;
                        } else {
                            await addArea(nombre);
                            result.success++;
                        }
                    }
                    break;
                case 'puestos':
                    for (const row of data) {
                        const nombre = row.nombre?.trim();
                        if (!nombre || !row.nivelOrganizacional) {
                            result.failed++;
                            result.errors.push(`Fila inválida, faltan datos requeridos (nombre, nivelOrganizacional): ${JSON.stringify(row)}`);
                            continue;
                        }
                        const area = areas.find(a => a.nombre === row.areaNombre);
                        const jefe = puestos.find(p => p.nombre === row.jefePuestoNombre);

                        if(puestos.some(p => p.nombre.toLowerCase() === nombre.toLowerCase())) {
                            result.skipped++;
                            continue;
                        }

                        const newPuesto: PuestoCreationData = {
                            nombre,
                            areaId: area?.id || '',
                            jefeInmediato: jefe?.id,
                            nivelOrganizacional: row.nivelOrganizacional as any,
                            numeroPersonas: row.numeroPersonas ? parseInt(row.numeroPersonas) : undefined
                        };
                        await addPuesto(newPuesto);
                        result.success++;
                    }
                    break;
                case 'sistemas':
                    for (const row of data) {
                        const nombre = row.nombre?.trim();
                        if (!nombre || !row.scope) {
                            result.failed++;
                            result.errors.push(`Fila inválida, faltan datos requeridos (nombre, scope): ${JSON.stringify(row)}`);
                            continue;
                        }

                        if(sistemas.some(s => s.nombre.toLowerCase() === nombre.toLowerCase())) {
                            result.skipped++;
                            continue;
                        }

                        let scopeId: string | undefined;
                        if (row.scope === "Área") {
                            scopeId = areas.find(a => a.nombre === row.scopeNombre)?.id;
                        } else if (row.scope === "Puesto") {
                            scopeId = puestos.find(p => p.nombre === row.scopeNombre)?.id;
                        }

                        const newSistema: SistemaCreationData = {
                            nombre,
                            scope: row.scope as any,
                            scopeId,
                        };
                        await addSistema(newSistema);
                        result.success++;
                    }
                    break;
                case 'actividades':
                     for (const row of data) {
                        const nombre = row.nombre?.trim();
                        if (!nombre) {
                            result.failed++;
                            result.errors.push(`Fila inválida, falta nombre: ${JSON.stringify(row)}`);
                            continue;
                        }

                        if(actividades.some(a => a.nombre.toLowerCase() === nombre.toLowerCase())) {
                            result.skipped++;
                            continue;
                        }
                        
                        const newActividad: Omit<Actividad, 'id' | 'createdAt' | 'updatedAt' | 'procesosAsociadosCount'> = {
                            nombre,
                            descripcionBreve: row.descripcionBreve,
                            sistemaUtilizado: row.sistemaUtilizado,
                            activa: true,
                            procesosAsociadosIds: [],
                        };
                        await addActividad(newActividad);
                        result.success++;
                    }
                    break;
                case 'procesos':
                    for (const row of data) {
                         const nombreProceso = row.proceso?.trim();
                         if (!nombreProceso || !row.area || !row.puesto || !row.descripcion || !row.frecuencia) {
                             result.failed++;
                             result.errors.push(`Fila de proceso inválida, faltan datos requeridos: ${JSON.stringify(row)}`);
                             continue;
                         }

                         if (procesos.some(p => p.proceso.toLowerCase() === nombreProceso.toLowerCase())) {
                             result.skipped++;
                             continue;
                         }
                         
                         const newProcess: CapturaFormData = {
                             proceso: nombreProceso,
                             area: row.area,
                             puesto: row.puesto,
                             departamento: row.departamento || undefined,
                             descripcion: row.descripcion,
                             frecuencia: row.frecuencia as any,
                             tiempoEstimado: row.tiempoEstimado ? parseInt(row.tiempoEstimado) : undefined,
                             tiempoIdeal: row.tiempoIdeal ? parseInt(row.tiempoIdeal) : undefined,
                             costoEstimado: row.costoEstimado ? parseFloat(row.costoEstimado) : undefined,
                             costoIdeal: row.costoIdeal ? parseFloat(row.costoIdeal) : undefined,
                             monedaCosto: row.monedaCosto as any,
                             sistemas: row.sistemas?.split(';').map(s => s.trim()).filter(Boolean) || [],
                             informacionRecibe: row.informacionRecibe,
                             procesosEntrada: row.procesosEntrada?.split(';').map(s => s.trim()).filter(Boolean) || [],
                             informacionEntrega: row.informacionEntrega,
                             procesosSalida: row.procesosSalida?.split(';').map(s => s.trim()).filter(Boolean) || [],
                             activityOrder: [],
                         };
                         await addContextProceso(newProcess);
                         result.success++;
                    }
                    break;
                default:
                    toast({ title: "Tipo de entidad no soportado", variant: "destructive" });
            }

            setResults(prev => ({ ...prev, [entity]: result }));
            toast({ title: "Importación completada", description: `${result.success} agregado(s), ${result.skipped} omitido(s), ${result.failed} fallido(s).` });
            setIsLoading(prev => ({ ...prev, [entity]: false }));
        };
        reader.readAsText(file);
    };

    return (
        <div className="container mx-auto py-8">
            <Card className="shadow-lg">
                <CardHeader>
                    <div className="flex items-center gap-2 mb-1">
                        <UploadCloud className="h-6 w-6 text-primary" />
                        <CardTitle className="text-2xl font-headline">Carga Masiva de Datos</CardTitle>
                    </div>
                    <CardDescription>
                        Utilice esta herramienta para importar datos en el sistema a través de archivos CSV. Descargue la plantilla, complete los datos y luego cargue el archivo.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="areas" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
                            {Object.entries(entityConfigs).map(([key, config]) => (
                                <TabsTrigger key={key} value={key}><config.icon className="mr-2 h-4 w-4" />{config.name}</TabsTrigger>
                            ))}
                        </TabsList>
                        
                        {Object.entries(entityConfigs).map(([key, config]) => (
                            <TabsContent key={key} value={key}>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Importar {config.name}</CardTitle>
                                        <CardDescription className="text-xs">
                                            {config.description}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <Button variant="outline" onClick={() => downloadTemplate(key as EntityKey)} className="w-full sm:w-auto">
                                                <Download className="mr-2 h-4 w-4" /> Descargar Plantilla
                                            </Button>
                                        </div>
                                        <div className="space-y-2">
                                            <Input
                                                type="file"
                                                accept=".csv"
                                                onChange={(e) => handleFileChange(e, key as EntityKey)}
                                                className="max-w-sm"
                                            />
                                             <Button onClick={() => handleImport(key as EntityKey)} disabled={!files[key as EntityKey] || isLoading[key as EntityKey]} className="w-full sm:w-auto">
                                                {isLoading[key as EntityKey] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                                                {isLoading[key as EntityKey] ? "Importando..." : `Importar ${config.name}`}
                                            </Button>
                                        </div>
                                        
                                        {results[key as EntityKey] && (
                                            <div className="mt-4 p-4 border rounded-md bg-muted/50 text-sm">
                                                <h4 className="font-semibold mb-2">Resultados de la Importación:</h4>
                                                <p>Éxito: <span className="font-bold text-green-600">{results[key as EntityKey]?.success}</span></p>
                                                <p>Omitidos (duplicados): <span className="font-bold text-amber-600">{results[key as EntityKey]?.skipped}</span></p>
                                                <p>Fallidos: <span className="font-bold text-red-600">{results[key as EntityKey]?.failed}</span></p>
                                                {results[key as EntityKey]!.errors.length > 0 && (
                                                    <div className="mt-2">
                                                        <h5 className="font-semibold">Errores:</h5>
                                                        <ul className="list-disc pl-5 text-xs max-h-24 overflow-y-auto">
                                                            {results[key as EntityKey]!.errors.map((err, i) => <li key={i}>{err}</li>)}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        ))}
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
