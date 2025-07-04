

'use client';

import { useState, useEffect, useMemo, type DragEvent, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Combobox } from '@/components/ui/combobox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronRight, GripVertical, FolderTree, ListChecks, Loader2, Search as SearchIcon, Filter as FilterIcon, Ban, CheckSquare, Share2, FileText, Edit2, Building, Eye, Users, Workflow, ListOrdered, Building2, Save, CalendarCheck2, X } from "lucide-react";
import { useAreas } from '@/contexts/AreasContext';
import { useDepartamentos, type Departamento } from '@/contexts/DepartamentosContext';
import { usePuestos, type Puesto } from '@/contexts/PuestosContext';
import { useActividades, type Actividad } from '@/contexts/ActividadesContext';
import { useProcesos, type CapturedProcess, type CambioHistorial, capturaFormSchema, type CapturaFormData, auditFrequencyOptions } from '@/contexts/ProcesosContext';
import { useProcedimientos, type Procedimiento } from '@/contexts/ProcedimientosContext';
import { usePoliticas, type Politica } from '@/contexts/PoliticasContext';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


import { toast } from "@/hooks/use-toast";
import { cn, formatMinutesToHours } from '@/lib/utils';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { useActivityLog } from '@/contexts/ActivityLogContext';
import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';


interface TreeNode {
  id: string;
  name: string;
  type: 'area' | 'departamento' | 'puesto' | 'proceso' | 'procedimiento' | 'actividad' | 'politica';
  children?: TreeNode[];
  originalId?: string; 
  activo?: boolean; 
  payload?: any;
}

type DraggedItemType = 'activityFromPool' | 'activityInProcedure' | 'procedureInProcess' | 'processInPuesto' | 'departamentoInArea';
type DropTargetType = 'procedimiento' | 'activity-in-tree' | 'pool' | 'proceso' | 'puesto' | 'area' | 'departamento';

interface DraggedItem {
    type: DraggedItemType;
    id: string; // originalId of the item
    sourceParentId: string; // originalId of the direct parent (procedure, process, or puesto)
    sourceIndex?: number;
}

const reassignFormSchema = z.object({
  puestoId: z.string().optional(),
});
type ReassignFormData = z.infer<typeof reassignFormSchema>;

const NO_DEPARTAMENTO_SELECTED = "__NO_DEPARTAMENTO__";


const DetailSectionDisplay = ({ title, value, isList = false, isTextarea = false }: { title: string, value?: string | string[] | number | null, isList?: boolean, isTextarea?: boolean }) => {
  if (value === undefined || value === null || (isList && Array.isArray(value) && value.length === 0) || (typeof value === 'string' && value.trim() === '' && !isTextarea && !isList)) {
    return (
      <div>
        <h4 className="font-semibold text-sm">{title}:</h4>
        <p className="text-sm text-muted-foreground">No especificado.</p>
      </div>
    );
  }

  if (isList && Array.isArray(value)) {
    return (
      <div>
        <h4 className="font-semibold text-sm">{title}:</h4>
        {value.length > 0 ? (
          <div className="flex flex-wrap gap-1 mt-1">
            {value.map((item, idx) => (
              <Badge key={idx} variant="secondary">{item}</Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Ninguno.</p>
        )}
      </div>
    );
  }
  
  return (
    <div>
      <h4 className="font-semibold text-sm">{title}:</h4>
      <p className={cn("text-sm text-foreground", isTextarea && "whitespace-pre-wrap")}>{typeof value === 'number' ? value.toString() : value}</p>
    </div>
  );
};

const escapeCsvCell = (cellData: string | number | undefined | null): string => {
  if (cellData === undefined || cellData === null) {
    return '';
  }
  const stringValue = String(cellData);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const Legend = () => (
    <div className="mb-4 p-3 border rounded-lg bg-muted/30">
      <h4 className="text-sm font-semibold mb-2">Leyenda de Iconos</h4>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
        <div className="flex items-center gap-1.5"><Building className="h-4 w-4 text-purple-600" /><span>Área</span></div>
        <div className="flex items-center gap-1.5"><Building2 className="h-4 w-4 text-teal-600" /><span>Departamento</span></div>
        <div className="flex items-center gap-1.5"><Users className="h-4 w-4 text-purple-400" /><span>Puesto</span></div>
        <div className="flex items-center gap-1.5"><Workflow className="h-4 w-4 text-blue-600" /><span>Proceso</span></div>
        <div className="flex items-center gap-1.5"><ListOrdered className="h-4 w-4 text-green-600" /><span>Procedimiento</span></div>
        <div className="flex items-center gap-1.5"><ListChecks className="h-4 w-4 text-amber-600" /><span>Actividad</span></div>
        <div className="flex items-center gap-1.5"><FileText className="h-4 w-4 text-orange-500" /><span>Política</span></div>
      </div>
    </div>
);

export default function PanelJerarquicoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { areas, isLoading: isLoadingAreas } = useAreas();
  const { departamentos, updateDepartamento, isLoading: isLoadingDepartamentos } = useDepartamentos();
  const { puestos, updatePuesto, isLoading: isLoadingPuestos } = usePuestos();
  const { actividades, isLoadingActividades, updateActividad } = useActividades();
  const { procesos: capturedProcesses, updateProceso, isLoadingProcesos } = useProcesos();
  const { procedimientos, updateProcedimiento, isLoading: isLoadingProcedimientos } = useProcedimientos();
  const { politicas, isLoading: isLoadingPoliticas } = usePoliticas();
  const { addLogEntry } = useActivityLog();
  

  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  
  const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);

  const [dropTargetInfo, setDropTargetInfo] = useState<{ 
    id: string; // The unique ID of the node being hovered over
    type: DropTargetType;
    parentId?: string; // The originalId of the parent container
    index?: number; // The index where the item would be dropped
  } | null>(null);


  const [activitySearchTerm, setActivitySearchTerm] = useState('');
  const [assignmentCountFilter, setAssignmentCountFilter] = useState<AssignmentCountFilterType>('all');
  const [activityStatusFilter, setActivityStatusFilter] = useState<ActivityStatusFilterType>('active');
  const [filteredActivityId, setFilteredActivityId] = useState<string | null>(null);
  const [poolLimit, setPoolLimit] = useState(20);


  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('all');
  const [selectedDeptoFilter, setSelectedDeptoFilter] = useState<string>('all');
  const [selectedPuestoFilter, setSelectedPuestoFilter] = useState<string>('all');
  const [treeGeneralSearchTerm, setTreeGeneralSearchTerm] = useState('');
  const [treeProcessStatusFilter, setTreeProcessStatusFilter] = useState<ProcessStatusFilterType>('active');


  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedItemForDetail, setSelectedItemForDetail] = useState<CapturedProcess | Actividad | Procedimiento | Politica | null>(null);
  const [detailItemType, setDetailItemType] = useState<'process' | 'activity' | 'procedure' | 'policy' | null>(null);
  
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);
  const [activityToReassign, setActivityToReassign] = useState<Actividad | null>(null);
  
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<CapturedProcess | null>(null);

  const reassignForm = useForm<ReassignFormData>({
    resolver: zodResolver(reassignFormSchema),
  });

  const editForm = useForm<CapturaFormData>({
    resolver: zodResolver(capturaFormSchema),
  });
  const { watch: watchEditForm, setValue: setEditValue } = editForm;
  const watchedEditAreaName = watchEditForm('area');
  const watchedEditDepartamentoName = watchEditForm('departamento');

  const filteredEditDepartamentos = useMemo(() => {
    if (!watchedEditAreaName || isLoadingDepartamentos || isLoadingAreas) return [];
    const areaId = areas.find(a => a.nombre === watchedEditAreaName)?.id;
    if (!areaId) return [];
    return departamentos.filter(d => d.areaId === areaId);
  }, [watchedEditAreaName, areas, departamentos, isLoadingDepartamentos, isLoadingAreas]);

  const filteredEditPuestos = useMemo(() => {
    if (!watchedEditAreaName || isLoadingPuestos || isLoadingAreas) return [];
    const areaId = areas.find(a => a.nombre === watchedEditAreaName)?.id;
    if (!areaId) return [];
    const puestosInArea = puestos.filter(p => p.areaId === areaId);
    if (watchedEditDepartamentoName && watchedEditDepartamentoName !== NO_DEPARTAMENTO_SELECTED) {
      const deptoId = departamentos.find(d => d.nombre === watchedEditDepartamentoName && d.areaId === areaId)?.id;
      if (deptoId) return puestosInArea.filter(p => p.departamentoId === deptoId);
    }
    if (watchedEditDepartamentoName === NO_DEPARTAMENTO_SELECTED) {
       return puestosInArea.filter(p => !p.departamentoId);
    }
    return puestosInArea;
  }, [watchedEditAreaName, watchedEditDepartamentoName, areas, departamentos, puestos, isLoadingPuestos, isLoadingAreas, isLoadingDepartamentos]);

  useEffect(() => {
    if (editingProcess) {
      editForm.reset({
        ...editingProcess,
        departamento: editingProcess.departamento || NO_DEPARTAMENTO_SELECTED
      });
    }
  }, [editingProcess, editForm]);

  function handleEditSubmit(values: CapturaFormData) {
    if (!editingProcess) return;
    
    const puestoSeleccionado = puestos.find(p => p.nombre === values.puesto);

    const dataToUpdate: Partial<Omit<CapturedProcess, 'id'>> = {
      ...values,
      puestoId: puestoSeleccionado?.id || undefined,
      departamento: values.departamento === NO_DEPARTAMENTO_SELECTED ? undefined : values.departamento,
    };
    updateProceso(editingProcess.id, dataToUpdate);
    setIsEditDialogOpen(false);
    setEditingProcess(null);
  }


  useEffect(() => {
    if (activityToReassign) {
        reassignForm.reset({
            puestoId: activityToReassign.puestoId || undefined,
        });
    }
  }, [activityToReassign, reassignForm]);

  const handleOpenReassignDialog = (activity: Actividad) => {
    setActivityToReassign(activity);
    setIsReassignDialogOpen(true);
  };

  const handleReassignPuestoSubmit = async (data: ReassignFormData) => {
    if (!activityToReassign) return;
    
    await updateActividad(activityToReassign.id, {
        puestoId: data.puestoId === 'none' ? undefined : data.puestoId
    });

    toast({
        title: "Puesto Reasignado",
        description: `Se ha actualizado el puesto para la actividad "${activityToReassign.nombre}".`,
    });

    setIsReassignDialogOpen(false);
    setActivityToReassign(null);
  };


  const availableDepartamentos = useMemo(() => {
    if (isLoadingDepartamentos || selectedAreaFilter === 'all') return departamentos;
    const area = areas.find(a => a.nombre === selectedAreaFilter);
    return area ? departamentos.filter(d => d.areaId === area.id) : [];
  }, [selectedAreaFilter, areas, departamentos, isLoadingDepartamentos]);

  const availablePuestos = useMemo(() => {
    if (isLoadingPuestos || selectedAreaFilter === 'all') return puestos;

    const areaId = areas.find(a => a.nombre === selectedAreaFilter)?.id;
    if (!areaId) return [];
    
    let areaPuestos = puestos.filter(p => p.areaId === areaId);

    if (selectedDeptoFilter !== 'all') {
      const deptoId = departamentos.find(d => d.nombre === selectedDeptoFilter && d.areaId === areaId)?.id;
      if (deptoId) {
        return areaPuestos.filter(p => p.departamentoId === deptoId);
      }
      return []; 
    }
    
    return areaPuestos;
  }, [puestos, areas, departamentos, selectedAreaFilter, selectedDeptoFilter, isLoadingPuestos]);


  const isLoadingAllData = isLoadingAreas || isLoadingDepartamentos || isLoadingPuestos || isLoadingProcesos || isLoadingActividades || isLoadingProcedimientos || isLoadingPoliticas;

  useEffect(() => {
    if (isLoadingAllData) return;
    
    const areaParam = searchParams.get('area');
    const deptoParam = searchParams.get('depto');
    const puestoParam = searchParams.get('puesto');
    const procesoIdParam = searchParams.get('procesoId');
    const procedimientoIdParam = searchParams.get('procedimientoId');

    if (areaParam) setSelectedAreaFilter(areaParam);
    if (deptoParam) setSelectedDeptoFilter(deptoParam);
    if (puestoParam) setSelectedPuestoFilter(puestoParam);

    if (procesoIdParam || procedimientoIdParam) {
        const targetProcessId = procesoIdParam || procedimientos.find(p => p.id === procedimientoIdParam)?.procesoId;
        if (targetProcessId) {
            const targetProcess = capturedProcesses.find(p => p.id === targetProcessId);
            if (targetProcess) {
                const areaNode = areas.find(a => a.nombre === targetProcess.area);
                const deptoNode = departamentos.find(d => d.nombre === targetProcess.departamento && d.areaId === areaNode?.id);
                const puestoNode = puestos.find(p => p.id === targetProcess.puestoId);

                const nodesToExpand: Record<string, boolean> = {};
                if (areaNode) nodesToExpand[`area-${areaNode.id}`] = true;
                if (deptoNode) nodesToExpand[`depto-${deptoNode.id}`] = true;
                if (puestoNode) nodesToExpand[`puesto-${puestoNode.id}`] = true;
                if (targetProcess) nodesToExpand[`proceso-${targetProcess.id}`] = true;

                setExpandedNodes(prev => ({...prev, ...nodesToExpand}));
            }
        }
    }
  }, [searchParams, areas, departamentos, puestos, capturedProcesses, procedimientos, isLoadingAllData]);


  useEffect(() => {
    if (isLoadingAllData) return;

    const buildTree = (): TreeNode[] => {
        let finalTreeNodes: TreeNode[] = [];
        let areaNodesMap: Record<string, TreeNode & { deptosMap: Record<string, TreeNode & { puestosMap: Record<string, TreeNode & { processList: CapturedProcess[] } & { payload: any } > }> }> = {};

        const activeAreas = areas.filter(a => selectedAreaFilter === 'all' || a.nombre === selectedAreaFilter);
        activeAreas.forEach(area => {
            if (!areaNodesMap[area.id]) {
                areaNodesMap[area.id] = { id: `area-${area.id}`, name: area.nombre, type: 'area', originalId: area.id, deptosMap: {} };
            }

            const deptsInArea = departamentos.filter(d => d.areaId === area.id && (selectedDeptoFilter === 'all' || d.nombre === selectedDeptoFilter));
            deptsInArea.forEach(depto => {
                if (!areaNodesMap[area.id].deptosMap[depto.id]) {
                    areaNodesMap[area.id].deptosMap[depto.id] = { id: `depto-${depto.id}`, name: depto.nombre, type: 'departamento', originalId: depto.id, puestosMap: {}, payload: depto };
                }

                const puestosInDepto = puestos.filter(p => p.departamentoId === depto.id && (selectedPuestoFilter === 'all' || p.id === selectedPuestoFilter));
                puestosInDepto.forEach(puesto => {
                     if (!areaNodesMap[area.id].deptosMap[depto.id].puestosMap[puesto.id]) {
                        areaNodesMap[area.id].deptosMap[depto.id].puestosMap[puesto.id] = { id: `puesto-${puesto.id}`, name: puesto.nombre, type: 'puesto', originalId: puesto.id, processList: [], payload: puesto };
                    }
                });
            });
            
            const puestosWithoutDepto = puestos.filter(p => p.areaId === area.id && !p.departamentoId && (selectedPuestoFilter === 'all' || p.id === selectedPuestoFilter) && (selectedDeptoFilter === 'all'));
            if(puestosWithoutDepto.length > 0) {
                const unassignedDeptoId = `unassigned-depto-${area.id}`;
                if (!areaNodesMap[area.id].deptosMap[unassignedDeptoId]) {
                    areaNodesMap[area.id].deptosMap[unassignedDeptoId] = { id: `depto-${unassignedDeptoId}`, name: 'Sin Departamento', type: 'departamento', originalId: unassignedDeptoId, puestosMap: {}, payload: {} };
                }
                puestosWithoutDepto.forEach(puesto => {
                     if (!areaNodesMap[area.id].deptosMap[unassignedDeptoId].puestosMap[puesto.id]) {
                        areaNodesMap[area.id].deptosMap[unassignedDeptoId].puestosMap[puesto.id] = { id: `puesto-${puesto.id}`, name: puesto.nombre, type: 'puesto', originalId: puesto.id, processList: [], payload: puesto };
                    }
                });
            }
        });

        let filteredProcesses = capturedProcesses.filter(proc => 
            treeProcessStatusFilter === 'all' || 
            (treeProcessStatusFilter === 'active' && proc.activo !== false) || 
            (treeProcessStatusFilter === 'inactive' && proc.activo === false)
        );
        
        filteredProcesses.forEach(proc => {
            const puestoObj = puestos.find(p => p.id === proc.puestoId);
            if (!puestoObj) return;

            const areaObj = areas.find(a => a.id === puestoObj.areaId);
            if (!areaObj || !areaNodesMap[areaObj.id]) return;

            const deptoObj = puestoObj.departamentoId ? departamentos.find(d => d.id === puestoObj.departamentoId) : null;
            
            const deptoId = deptoObj ? deptoObj.id : `unassigned-depto-${areaObj.id}`;
            const deptoNode = areaNodesMap[areaObj.id].deptosMap[deptoId];
            if (!deptoNode) return;

            const puestoNode = deptoNode.puestosMap[puestoObj.id];
            if (puestoNode) {
                puestoNode.processList.push(proc);
            }
        });
        
        Object.values(areaNodesMap).forEach(areaNode => {
            let deptoChildren: TreeNode[] = [];
            Object.values(areaNode.deptosMap).forEach(deptoNode => {
                let puestoChildren: TreeNode[] = [];
                Object.values(deptoNode.puestosMap).forEach(puestoNode => {
                    const puestoData = puestos.find(p => p.id === puestoNode.originalId);
                    if (puestoData) {
                        puestoNode.payload = {
                            ...puestoData,
                            sourceParentId: deptoNode.originalId
                        };
                    }
                    
                    const orderForThisPuesto = puestoData?.procesoOrder || [];
                    const orderedProcesses = [...puestoNode.processList].sort((a, b) => {
                        const indexA = orderForThisPuesto.indexOf(a.id);
                        const indexB = orderForThisPuesto.indexOf(b.id);
                        if (indexA === -1 && indexB === -1) return a.proceso.localeCompare(b.proceso);
                        if (indexA === -1) return 1;
                        if (indexB === -1) return -1;
                        return indexA - indexB;
                    });
                    
                    const processWithIndices = orderedProcesses.map((proc, index) => ({...proc, sourceIndex: index}));
                     
                    const processTreeNodes = processWithIndices.map((proc) => {
                         const processPolicies = (proc.politicasAsociadas || [])
                            .map(link => {
                                const pol = politicas.find(p => p.id === link.policyId);
                                return pol ? { ...pol, linkType: link.linkType } : null;
                            })
                            .filter((p): p is Politica & { linkType: string } => !!p)
                            .map(p => ({
                                id: `politica-${p.id}-proc-${proc.id}`,
                                name: `${p.titulo} (${p.linkType})`,
                                type: 'politica' as const, originalId: p.id, payload: p,
                            }));

                        const procedureNodes = (proc.procedimientoOrder || [])
                            .map(procId => procedimientos.find(p => p.id === procId)).filter((p): p is Procedimiento => !!p)
                            .filter(procedure => {
                                if (!filteredActivityId) return true;
                                return procedure.activityOrder?.includes(filteredActivityId);
                            })
                            .map((procedure, procIdx) => {
                                const procedurePolicies = (procedure.politicasAsociadasIds || [])
                                  .map(polId => politicas.find(p => p.id === polId)).filter((p): p is Politica => !!p)
                                  .map(p => ({ id: `politica-${p.id}-pc-${procedure.id}`, name: p.titulo, type: 'politica' as const, originalId: p.id, payload: p, }));
                                
                                const activityNodes = (procedure.activityOrder || [])
                                  .map((actId, index) => {
                                      const activity = actividades.find(a => a.id === actId);
                                      return activity ? { activity, index } : null;
                                  })
                                  .filter((a): a is { activity: Actividad, index: number } => !!a)
                                  .map(({ activity, index }) => {
                                      const activityPolicies = (activity.politicasAsociadas || [])
                                        .map(link => {
                                            const pol = politicas.find(p => p.id === link.policyId);
                                            return pol ? { ...pol, linkType: link.linkType } : null;
                                        })
                                        .filter((p): p is Politica & { linkType: string } => !!p)
                                        .map(p => ({ id: `politica-${p.id}-ac-${activity.id}`, name: `${p.titulo} (${p.linkType})`, type: 'politica' as const, originalId: p.id, payload: p }));
                                      return {
                                        id: `activity-${activity.id}-proc-${procedure.id}-idx-${index}`,
                                        name: activity.nombre, type: 'actividad' as const, originalId: activity.id, activo: activity.activa,
                                        children: activityPolicies, payload: { ...activity, sourceIndex: index, sourceParentId: procedure.id }
                                      };
                                  });
                                return {
                                  id: `procedure-${procedure.id}`,
                                  name: procedure.nombre, type: 'procedimiento' as const, originalId: procedure.id, activo: procedure.activo,
                                  children: [...procedurePolicies, ...activityNodes], payload: { ...procedure, sourceIndex: procIdx, sourceParentId: proc.id }
                                };
                            });

                        if (filteredActivityId && procedureNodes.length === 0) {
                            return null;
                        }
                        
                        return {
                            id: `proceso-${proc.id}`,
                            name: proc.proceso, type: 'proceso' as const, originalId: proc.id, activo: proc.activo,
                            children: [...processPolicies, ...procedureNodes], payload: { ...proc, sourceParentId: puestoNode.originalId, sourceIndex: proc.sourceIndex }
                        };
                    }).filter((node): node is TreeNode => node !== null);
                    
                    puestoNode.children = processTreeNodes;
                    if(processTreeNodes.length > 0) puestoChildren.push(puestoNode);
                });
                
                deptoNode.children = puestoChildren.sort((a,b) => a.name.localeCompare(b.name));
                if(puestoChildren.length > 0) deptoChildren.push(deptoNode);
            });
            
            areaNode.children = deptoChildren.sort((a,b) => a.name.localeCompare(b.name));
            if(deptoChildren.length > 0) finalTreeNodes.push(areaNode);
        });

        return finalTreeNodes.sort((a,b) => a.name.localeCompare(b.name));
    };

    let finalTree = buildTree();
    
    if (treeGeneralSearchTerm) {
        const lowerTerm = treeGeneralSearchTerm.toLowerCase();
    
        const recursiveFilter = (nodes: TreeNode[]): TreeNode[] => {
            return nodes.map(node => {
                const selfMatches = node.name.toLowerCase().includes(lowerTerm) || 
                                    (node.type === 'politica' && node.payload?.codigo && node.payload.codigo.toLowerCase().includes(lowerTerm));

                if (node.children) {
                    const filteredChildren = recursiveFilter(node.children);
                    if (filteredChildren.length > 0 || selfMatches) {
                        return { ...node, children: filteredChildren };
                    }
                }
                
                if (selfMatches) return { ...node, children: [] };
                return null;
            }).filter((node): node is TreeNode => node !== null);
        };
        
        finalTree = recursiveFilter(finalTree);
    }
    
    setTreeData(finalTree);

}, [
    areas, departamentos, puestos, capturedProcesses, procedimientos, actividades, politicas,
    isLoadingAllData, 
    selectedAreaFilter, selectedDeptoFilter, selectedPuestoFilter, treeGeneralSearchTerm, treeProcessStatusFilter, filteredActivityId
]);

useEffect(() => {
    if (filteredActivityId && treeData.length > 0) {
        const newExpanded: Record<string, boolean> = {};
        const expandNodes = (nodes: TreeNode[]) => {
            nodes.forEach(node => {
                if (node.children && node.children.length > 0) {
                    newExpanded[node.id] = true;
                    expandNodes(node.children);
                }
            });
        };
        expandNodes(treeData);
        setExpandedNodes(newExpanded);
    }
}, [treeData, filteredActivityId]);


  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>, item: DraggedItem) => {
      let payloadObject;
      if (item.type === 'activityInProcedure') payloadObject = actividades.find(a => a.id === item.id);
      else if (item.type === 'procedureInProcess') payloadObject = procedimientos.find(p => p.id === item.id);
      else if (item.type === 'processInPuesto') payloadObject = capturedProcesses.find(p => p.id === item.id);
        
      if (payloadObject && (payloadObject as any).activo === false) {
          e.preventDefault();
          toast({ title: "Acción no permitida", description: "Los elementos inactivos no se pueden mover.", variant: "default" });
          return;
      }
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.id); 
  };
  
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };
  
  const handleDragEnter = (e: DragEvent<HTMLDivElement>, type: DropTargetType, parentId?: string, index?: number) => {
    e.preventDefault();
    if (!draggedItem) return;

    let canDrop = false;
    if (draggedItem.type.startsWith('activity') && (type === 'procedimiento' || type === 'activity-in-tree' || type === 'pool')) {
      canDrop = true;
    } else if (draggedItem.type === 'procedureInProcess' && (type === 'proceso' || type === 'procedimiento')) {
        canDrop = true;
    } else if (draggedItem.type === 'processInPuesto') {
        if (type === 'proceso' && draggedItem.sourceParentId === parentId) {
            canDrop = true;
        } else if (type === 'puesto' && draggedItem.sourceParentId !== parentId) {
            canDrop = true;
        }
    } else if (draggedItem.type === 'puestoInDepto') {
        if (type === 'departamento' && draggedItem.sourceParentId !== parentId) {
            canDrop = true;
        } else if (type === 'area') {
            const puesto = puestos.find(p => p.id === draggedItem.id);
            if (puesto && puesto.areaId !== parentId) canDrop = true;
        }
    }

    if (canDrop) {
      setDropTargetInfo({ id: e.currentTarget.id, type, parentId, index });
    } else {
      setDropTargetInfo(null);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setDropTargetInfo(null);
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!draggedItem || !dropTargetInfo) return;
    
    if (draggedItem.type === 'puestoInDepto') {
        const puestoId = draggedItem.id;
        const originalPuesto = puestos.find(p => p.id === puestoId);
        if (!originalPuesto) return;

        let newAreaId: string | undefined;
        let newDepartamentoId: string | null = null;
        
        if (dropTargetInfo.type === 'departamento' && dropTargetInfo.parentId) {
            const newDepto = departamentos.find(d => d.id === dropTargetInfo.parentId);
            if (newDepto) {
                newAreaId = newDepto.areaId;
                newDepartamentoId = newDepto.id;
            }
        } else if (dropTargetInfo.type === 'area' && dropTargetInfo.parentId) {
            newAreaId = dropTargetInfo.parentId;
            newDepartamentoId = null;
        }
        
        if (newAreaId) {
            await updatePuesto(puestoId, { areaId: newAreaId, departamentoId: newDepartamentoId === null ? undefined : newDepartamentoId });
            addLogEntry({ action: 'update', entityType: 'Puesto', entityName: originalPuesto.nombre, details: `Se movió el puesto "${originalPuesto.nombre}" a una nueva ubicación.` });
            toast({ title: "Puesto Reasignado", description: `"${originalPuesto.nombre}" ha sido movido.` });
        }
    }
    else if (draggedItem.type.startsWith('activity')) {
        const activity = actividades.find(a => a.id === draggedItem.id);
        if (!activity || !activity.activa) {
            toast({ title: "Acción no permitida", description: "No se pueden asignar actividades inactivas.", variant: "default" });
            setDraggedItem(null); setDropTargetInfo(null); return;
        }

        if (dropTargetInfo.type === 'pool' && draggedItem.type === 'activityInProcedure') {
            const sourceProc = procedimientos.find(p => p.id === draggedItem.sourceParentId);
            if(sourceProc) {
                const newOrder = (sourceProc.activityOrder || []).filter(id => id !== draggedItem.id);
                await updateProcedimiento(draggedItem.sourceParentId, { activityOrder: newOrder });
                toast({ title: "Actividad Desasignada", description: `"${activity.nombre}" fue removida.` });
            }
        } 
        else if ((dropTargetInfo.type === 'procedimiento' || dropTargetInfo.type === 'activity-in-tree') && dropTargetInfo.parentId) {
            const targetProcedureId = dropTargetInfo.parentId;
            const sourceProcedureId = draggedItem.sourceParentId;
            const isReorder = sourceProcedureId === targetProcedureId;

            const targetProcedure = procedimientos.find(p => p.id === targetProcedureId);
            if (!targetProcedure) return;

            const batch = writeBatch(db);

            const targetProcedureRef = doc(db, 'procedimientos', targetProcedureId);
            let targetOrder = [...(targetProcedure.activityOrder || [])];

            if (isReorder && draggedItem.sourceIndex !== undefined) {
                targetOrder.splice(draggedItem.sourceIndex, 1);
            }

            const dropIndex = dropTargetInfo.index ?? targetOrder.length;
            targetOrder.splice(dropIndex, 0, draggedItem.id);

            batch.update(targetProcedureRef, { activityOrder: Array.from(new Set(targetOrder)), updatedAt: serverTimestamp() });
            
            if (!isReorder && sourceProcedureId !== 'pool') {
                const sourceProcedure = procedimientos.find(p => p.id === sourceProcedureId);
                if (sourceProcedure) {
                    const sourceProcedureRef = doc(db, 'procedimientos', sourceProcedureId);
                    const sourceOrder = (sourceProcedure.activityOrder || []).filter(id => id !== draggedItem.id);
                    batch.update(sourceProcedureRef, { activityOrder: sourceOrder, updatedAt: serverTimestamp() });
                }
            }
            
            await batch.commit();

            if (isReorder) {
                addLogEntry({ action: 'update', entityType: 'Flujo de Actividades', entityName: targetProcedure.nombre, details: `Se reordenó la actividad "${activity.nombre}".` });
            } else {
                 const sourceProcedure = procedimientos.find(p => p.id === sourceProcedureId);
                 addLogEntry({ action: 'update', entityType: 'Flujo de Actividades', entityName: targetProcedure.nombre, details: `Actividad "${activity.nombre}" movida desde "${sourceProcedure?.nombre || 'Pool'}" hacia "${targetProcedure.nombre}".` });
            }
            toast({ title: "Flujo Actualizado", description: `Actividad "${activity.nombre}" gestionada.` });
        }
    }
    
    else if (draggedItem.type === 'procedureInProcess') {
        const procedureId = draggedItem.id;
        const sourceProcessId = draggedItem.sourceParentId;
        const targetProcessId = dropTargetInfo.parentId;

        if (!targetProcessId) return;

        if (sourceProcessId === targetProcessId) {
            const parentProcess = capturedProcesses.find(p => p.id === sourceProcessId);
            if (!parentProcess) return;

            let currentOrder = [...(parentProcess.procedimientoOrder || [])];
            if (draggedItem.sourceIndex !== undefined) {
                const [removedItem] = currentOrder.splice(draggedItem.sourceIndex, 1);
                const dropIndex = dropTargetInfo.index ?? currentOrder.length;
                currentOrder.splice(dropIndex, 0, removedItem);

                await updateProceso(parentProcess.id, { procedimientoOrder: currentOrder });
                toast({ title: "Flujo Actualizado", description: "Se ha reordenado un procedimiento." });
            }
        } 
        else {
            const sourceProcess = capturedProcesses.find(p => p.id === sourceProcessId);
            const targetProcess = capturedProcesses.find(p => p.id === targetProcessId);
            const procedure = procedimientos.find(p => p.id === procedureId);

            if (!sourceProcess || !targetProcess || !procedure) {
                toast({ title: "Error de Datos", description: "No se encontró información para completar el movimiento." });
                return;
            }
            
            const batch = writeBatch(db);

            const sourceProcessRef = doc(db, 'procesos', sourceProcessId);
            const newSourceOrder = (sourceProcess.procedimientoOrder || []).filter(id => id !== procedureId);
            batch.update(sourceProcessRef, { procedimientoOrder: newSourceOrder });

            const targetProcessRef = doc(db, 'procesos', targetProcessId);
            let newTargetOrder = [...(targetProcess.procedimientoOrder || [])];
            const dropIndex = dropTargetInfo.index ?? newTargetOrder.length;
            newTargetOrder.splice(dropIndex, 0, procedureId);
            batch.update(targetProcessRef, { procedimientoOrder: newTargetOrder });

            const procedureRef = doc(db, 'procedimientos', procedureId);
            batch.update(procedureRef, { procesoId: targetProcessId, updatedAt: serverTimestamp() });

            await batch.commit();

            addLogEntry({ action: 'update', entityType: 'Procedimiento', entityName: procedure.nombre, details: `Procedimiento "${procedure.nombre}" movido al proceso "${targetProcess.proceso}".` });
            toast({ title: "Procedimiento Reasignado", description: "El procedimiento ha sido movido al nuevo proceso." });
        }
    }

    else if (draggedItem.type === 'processInPuesto') {
        if (dropTargetInfo.type === 'puesto' && dropTargetInfo.parentId && draggedItem.sourceParentId !== dropTargetInfo.parentId) {
            const procesoId = draggedItem.id;
            const newPuestoId = dropTargetInfo.parentId;
    
            const proceso = capturedProcesses.find(p => p.id === procesoId);
            const sourcePuesto = puestos.find(p => p.id === draggedItem.sourceParentId);
            const targetPuesto = puestos.find(p => p.id === newPuestoId);
            const targetArea = areas.find(a => a.id === targetPuesto?.areaId);
            const targetDepto = departamentos.find(d => d.id === targetPuesto?.departamentoId);
    
            if (!proceso || !targetPuesto || !targetArea) {
                toast({ title: "Error de Datos", description: "No se encontró información para completar el movimiento." });
            } else {
                const batch = writeBatch(db);
                
                const procesoDocRef = doc(db, 'procesos', procesoId);
                batch.update(procesoDocRef, {
                    puesto: targetPuesto.nombre,
                    area: targetArea.nombre,
                    departamento: targetDepto?.nombre || null,
                    puestoId: targetPuesto.id,
                    updatedAt: serverTimestamp(),
                });
    
                if (sourcePuesto) {
                    const sourcePuestoDocRef = doc(db, 'puestos', sourcePuesto.id);
                    const newSourceOrder = (sourcePuesto.procesoOrder || []).filter(id => id !== procesoId);
                    batch.update(sourcePuestoDocRef, { procesoOrder: newSourceOrder });
                }
    
                const targetPuestoDocRef = doc(db, 'puestos', targetPuesto.id);
                const newTargetOrder = [...(targetPuesto.procesoOrder || []), procesoId];
                batch.update(targetPuestoDocRef, { procesoOrder: newTargetOrder });
    
                await batch.commit();
    
                addLogEntry({ action: 'update', entityType: 'Proceso', entityName: proceso.proceso, details: `Proceso "${proceso.proceso}" reasignado al puesto "${targetPuesto.nombre}".` });
                toast({ title: "Proceso Reasignado", description: "El proceso ha sido movido al nuevo puesto." });
            }
        } else if (dropTargetInfo.type === 'proceso' && dropTargetInfo.parentId === draggedItem.sourceParentId) {
            const parentPuestoId = draggedItem.sourceParentId;
            const parentPuestoData = puestos.find(p => p.id === parentPuestoId);
            if (!parentPuestoData) return;
    
            let currentOrder = [...(parentPuestoData.procesoOrder || [])];
            
            const fromIndex = draggedItem.sourceIndex;
            if (fromIndex !== undefined && fromIndex >= 0 && currentOrder.length > fromIndex) {
                 const [removedItem] = currentOrder.splice(fromIndex, 1);
                 
                let toIndex = dropTargetInfo.index;
                if(toIndex === undefined || toIndex < 0 || toIndex > currentOrder.length) {
                    toIndex = currentOrder.length;
                }
                
                currentOrder.splice(toIndex, 0, removedItem);

                await updatePuesto(parentPuestoId, { procesoOrder: currentOrder });
                toast({ title: "Orden de Procesos Guardado", description: "Se ha actualizado el orden de los procesos para este puesto." });
            }
        }
    }
    
    setDraggedItem(null);
    setDropTargetInfo(null);
  };

  const openDetailDialog = (item: any, type: 'process' | 'activity' | 'procedure' | 'policy') => {
    setSelectedItemForDetail(item);
    setDetailItemType(type);
    setIsDetailDialogOpen(true);
  };

  const handleEditItem = (item: any, type: 'process' | 'activity' | 'procedure' | 'policy') => {
    if (type === 'process') {
        handleOpenEditDialog(item);
    }
    if (type === 'activity') router.push(`/actividades?search=${encodeURIComponent(item.nombre)}`);
    if (type === 'procedure') {
      router.push(`/procedimientos?search=${encodeURIComponent(item.codigo)}`);
    }
    if (type === 'policy') router.push(`/politicas?search=${encodeURIComponent(item.codigo)}`);
  };

  const handleOpenEditDialog = (proc: CapturedProcess) => {
    setEditingProcess(proc);
    setIsEditDialogOpen(true);
  };

  const assignmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    procedimientos.forEach(proc => {
        (proc.activityOrder || []).forEach(actId => {
            counts.set(actId, (counts.get(actId) || 0) + 1);
        });
    });
    return counts;
  }, [procedimientos]);

  const activeActivitiesCount = useMemo(() => actividades.filter(a => a.activa).length, [actividades]);
  const inactiveActivitiesCount = useMemo(() => actividades.filter(a => !a.activa).length, [actividades]);
  const unassignedCount = useMemo(() => actividades.filter(a => a.activa && (assignmentCounts.get(a.id) || 0) === 0).length, [actividades, assignmentCounts]);
  const assignedCount = useMemo(() => actividades.filter(a => a.activa && (assignmentCounts.get(a.id) || 0) > 0).length, [actividades, assignmentCounts]);
  
  const availableActivities = useMemo(() => {
    return actividades
      .filter(a => {
        if (activityStatusFilter === 'active' && !a.activa) return false;
        if (activityStatusFilter === 'inactive' && a.activa) return false;
        
        if (activitySearchTerm && !a.nombre.toLowerCase().includes(activitySearchTerm.toLowerCase())) {
          return false;
        }

        const count = assignmentCounts.get(a.id) || 0;
        if (assignmentCountFilter === 'unassigned' && count > 0) return false;
        if (assignmentCountFilter === 'assigned' && count === 0) return false;
        
        return true;
      })
      .sort((a,b) => a.nombre.localeCompare(b.nombre));
  }, [actividades, activitySearchTerm, assignmentCountFilter, activityStatusFilter, assignmentCounts]);
  
  useEffect(() => {
    setPoolLimit(20);
  }, [activitySearchTerm, assignmentCountFilter, activityStatusFilter]);

  const visiblePoolActivities = useMemo(() => {
      return availableActivities.slice(0, poolLimit);
  }, [availableActivities, poolLimit]);

  const handleExport = () => {
    if (treeData.length === 0) {
      toast({ title: "Nada que exportar", description: "El árbol está vacío o no hay datos que coincidan con los filtros.", variant: "default" });
      return;
    }

    const headers = ['Nombre del Elemento', 'Tipo', 'Puesto Asignado', 'Estado'];
    const csvRows = [headers.join(',')];

    const flattenTreeForExport = (nodes: TreeNode[], level: number) => {
      nodes.forEach(node => {
        const indentation = '  '.repeat(level);
        const estado = node.activo === undefined ? 'N/A' : (node.activo ? 'Activo' : 'Inactivo');
        
        let puestoAsignado = '';
        if (node.type === 'actividad' && node.payload?.puestoId) {
            const puesto = puestos.find(p => p.id === node.payload.puestoId);
            puestoAsignado = puesto ? puesto.nombre : 'No encontrado';
        }

        const row = [
          escapeCsvCell(`${indentation}${node.name}`),
          escapeCsvCell(node.type),
          escapeCsvCell(puestoAsignado),
          escapeCsvCell(estado)
        ];
        csvRows.push(row.join(','));

        if (node.children && node.children.length > 0) {
          flattenTreeForExport(node.children, level + 1);
        }
      });
    };

    flattenTreeForExport(treeData, 0);

    const csvString = csvRows.join('\n');
    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `panel_jerarquico_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Exportación Iniciada", description: "El archivo CSV se está descargando." });
    } else {
      toast({ title: "Exportación Fallida", description: "Su navegador no soporta la descarga directa.", variant: "destructive" });
    }
  };

  if (isLoadingAllData) {
    return (
        <div className="container mx-auto py-8">
         <Card className="shadow-lg">
            <CardHeader>
                <div className="flex items-center gap-2 mb-1">
                <FolderTree className="h-6 w-6 text-primary" />
                <CardTitle className="text-2xl font-headline">Panel de Análisis Interconectado</CardTitle>
                </div>
                <CardDescription>Cargando datos...</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-16 w-16 text-primary animate-spin" />
            </CardContent>
         </Card>
        </div>
    );
  }

  const renderTree = (nodes: TreeNode[]): JSX.Element[] => {
    return nodes.map((node) => {
        let nodeContent;
        const baseClasses = "flex items-center py-1 px-2 rounded group hover:bg-muted/50";
        switch (node.type) {
          case 'area':
            nodeContent = (
              <div className={cn(baseClasses, "font-bold", dropTargetInfo?.type === 'area' && dropTargetInfo.id === node.id && "bg-primary/20")} 
                id={node.id}
                onDragOver={(e) => handleDragOver(e)}
                onDrop={(e) => handleDrop(e)}
                onDragEnter={(e) => handleDragEnter(e, 'area', node.originalId)}
                onDragLeave={handleDragLeave}
              >
                <Button variant="ghost" size="sm" onClick={() => toggleNode(node.id)} className="p-1 h-auto mr-1">
                  {node.children && node.children.length > 0 ? <ChevronRight className={cn("h-4 w-4 transition-transform", expandedNodes[node.id] && "rotate-90")} /> : <span className="w-4 inline-block"></span>}
                </Button>
                <Building className="h-4 w-4 mr-2 text-purple-600" />
                <span className="flex-grow">{node.name}</span>
              </div>
            );
            break;
          case 'departamento':
            nodeContent = (
              <div 
                className={cn(baseClasses, "ml-4 font-medium", dropTargetInfo?.type === 'departamento' && dropTargetInfo.id === node.id && "bg-primary/20")} 
                id={node.id}
                onDragOver={(e) => handleDragOver(e)}
                onDrop={(e) => handleDrop(e)}
                onDragEnter={(e) => handleDragEnter(e, 'departamento', node.originalId)}
                onDragLeave={handleDragLeave}
              >
                <Button variant="ghost" size="sm" onClick={() => toggleNode(node.id)} className="p-1 h-auto mr-1">
                  {node.children && node.children.length > 0 ? <ChevronRight className={cn("h-4 w-4 transition-transform", expandedNodes[node.id] && "rotate-90")} /> : <span className="w-4 inline-block"></span>}
                </Button>
                <Building2 className="h-4 w-4 mr-2 text-teal-600" />
                <span className="flex-grow">{node.name}</span>
              </div>
            );
            break;
          case 'puesto':
            nodeContent = (
              <div 
                className={cn(baseClasses, "ml-8 font-medium", dropTargetInfo?.type === 'puesto' && dropTargetInfo.id === node.id && "bg-primary/20")}
                id={node.id}
                draggable={!!node.payload}
                onDragStart={(e) => {
                  if (node.payload && node.payload.departamentoId) {
                    handleDragStart(e, { type: 'puestoInDepto', id: node.originalId!, sourceParentId: node.payload.departamentoId! })
                  }
                }}
                onDragOver={(e) => handleDragOver(e)}
                onDrop={(e) => handleDrop(e)}
                onDragEnter={(e) => handleDragEnter(e, 'puesto', node.originalId)}
                onDragLeave={handleDragLeave}
              >
                <GripVertical className="h-3 w-3 mr-1.5 shrink-0 text-muted-foreground group-hover:text-foreground"/>
                <Button variant="ghost" size="sm" onClick={() => toggleNode(node.id)} className="p-1 h-auto mr-1">
                  {node.children && node.children.length > 0 ? <ChevronRight className={cn("h-4 w-4 transition-transform", expandedNodes[node.id] && "rotate-90")} /> : <span className="w-4 inline-block"></span>}
                </Button>
                <Users className="h-4 w-4 mr-2 text-purple-400" />
                <span className="flex-grow">{node.name}</span>
              </div>
            );
            break;
          case 'proceso':
            nodeContent = (
              <div 
                className={cn(baseClasses, "ml-8 border-l-2", node.activo === false && "opacity-60", dropTargetInfo?.type === 'proceso' && dropTargetInfo.id === node.id && "bg-primary/20 border-primary")}
                id={node.id}
                draggable={node.activo}
                onDragStart={(e) => node.activo && handleDragStart(e, { type: 'processInPuesto', id: node.originalId!, sourceParentId: node.payload.sourceParentId, sourceIndex: node.payload.sourceIndex })}
                onDragOver={(e) => handleDragOver(e)}
                onDrop={(e) => handleDrop(e)}
                onDragEnter={(e) => handleDragEnter(e, 'proceso', node.payload.sourceParentId, node.payload.sourceIndex)}
                onDragLeave={handleDragLeave}
              >
                <GripVertical className={cn("h-3 w-3 mr-1.5", node.activo ? "text-muted-foreground group-hover:text-foreground" : "text-transparent")}/>
                <Button variant="ghost" size="sm" onClick={() => toggleNode(node.id)} className="p-1 h-auto mr-1"><ChevronRight className={cn("h-4 w-4 transition-transform", expandedNodes[node.id] && "rotate-90")} /></Button>
                <Workflow className="h-4 w-4 mr-2 text-blue-600" />
                <span className={cn("font-semibold text-sm flex-grow", node.activo === false && "italic text-muted-foreground")}>{node.name}{node.activo === false && <Ban className="h-3 w-3 ml-1.5 inline-block text-destructive" />}</span>
                 <div className="flex items-center ml-auto opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => {e.stopPropagation(); handleEditItem(node.payload, 'process')}} title="Editar proceso"><Edit2 className="h-4 w-4 text-muted-foreground" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => {e.stopPropagation(); openDetailDialog(node.payload, 'process')}} title="Ver detalles del proceso"><Eye className="h-4 w-4 text-muted-foreground" /></Button>
                </div>
              </div>
            );
            break;
          case 'procedimiento':
             const isInactiveProcedure = node.activo === false;
             nodeContent = (
              <div 
                className={cn(baseClasses, "ml-12 border-l-2", dropTargetInfo?.type === 'procedimiento' && dropTargetInfo.id === node.id && "bg-primary/20 border-primary", isInactiveProcedure && "opacity-60")}
                onDragOver={(e) => handleDragOver(e)}
                onDrop={(e) => handleDrop(e)}
                onDragEnter={(e) => handleDragEnter(e, 'procedimiento', node.originalId, undefined)}
                onDragLeave={handleDragLeave}
                id={node.id}
                draggable={!isInactiveProcedure}
                onDragStart={(e) => !isInactiveProcedure && handleDragStart(e, { type: 'procedureInProcess', id: node.originalId!, sourceParentId: node.payload.sourceParentId, sourceIndex: node.payload.sourceIndex })}
              >
                <GripVertical className="h-3 w-3 mr-1.5 shrink-0 text-muted-foreground group-hover:text-foreground"/>
                <Button variant="ghost" size="sm" onClick={() => toggleNode(node.id)} className="p-1 h-auto mr-1"><ChevronRight className={cn("h-4 w-4 transition-transform", expandedNodes[node.id] && "rotate-90")} /></Button>
                <ListOrdered className="h-4 w-4 mr-2 text-green-600" />
                <span className={cn("font-medium text-sm flex-grow", isInactiveProcedure && "italic text-muted-foreground")}>{node.name}{isInactiveProcedure && <Badge variant="destructive" className="ml-2 bg-slate-500 hover:bg-slate-600 text-white border-transparent">Inactivo</Badge>}</span>
                <div className="flex items-center ml-auto opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleEditItem(node.payload, 'procedure') }} title="Editar procedimiento"><Edit2 className="h-4 w-4 text-muted-foreground" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openDetailDialog(node.payload, 'procedure') }} title="Ver detalles"><Eye className="h-4 w-4 text-muted-foreground" /></Button>
                </div>
              </div>
            );
            break;
          case 'actividad':
            const actividadCompleta = actividades.find(a => a.id === node.originalId);
            const puestoActual = actividadCompleta?.puestoId ? puestos.find(p => p.id === actividadCompleta.puestoId) : null;
            nodeContent = (
              <div 
                id={node.id}
                draggable={node.activo} 
                onDragStart={(e) => node.activo && handleDragStart(e, { type: 'activityInProcedure', id: node.originalId!, sourceParentId: node.payload.sourceParentId, sourceIndex: node.payload.sourceIndex })}
                onDragOver={(e) => handleDragOver(e)}
                onDrop={(e) => handleDrop(e)}
                onDragEnter={(e) => handleDragEnter(e, 'activity-in-tree', node.payload.sourceParentId, node.payload.sourceIndex)}
                onDragLeave={handleDragLeave}
                className={cn(baseClasses, "ml-16 bg-secondary/30", node.activo ? "cursor-grab" : "cursor-not-allowed opacity-70", !node.activo && "italic text-muted-foreground", dropTargetInfo?.type === 'activity-in-tree' && dropTargetInfo.id === node.id && "ring-2 ring-primary")}
                title={!node.activo ? "Esta actividad está inactiva" : node.name}
              >
                <GripVertical className={cn("h-3 w-3 mr-1.5", node.activo ? "text-muted-foreground" : "text-transparent")}/>
                <ListChecks className="h-3 w-3 mr-1.5 shrink-0 text-amber-600" />
                <span className="flex-grow text-xs">{node.name}</span>
                {puestoActual && (
                  <Badge variant="outline" className="ml-2 text-xs font-normal border-dashed">{puestoActual.nombre}</Badge>
                )}
                 {!node.activo && <Ban className="h-3 w-3 ml-auto text-destructive" />}
                 <div className="flex items-center ml-auto opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                    {actividadCompleta && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleOpenReassignDialog(actividadCompleta) }} title="Reasignar Puesto Responsable">
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openDetailDialog(node.payload, 'activity') }} title="Ver detalles"><Eye className="h-4 w-4 text-muted-foreground" /></Button>
                </div>
              </div>
            );
            break;
          case 'politica':
             nodeContent = (
              <div className={cn(baseClasses, "ml-12 text-xs text-muted-foreground cursor-pointer")} onClick={() => openDetailDialog(node.payload, 'policy')}>
                <FileText className="h-3 w-3 mr-1.5 shrink-0 text-orange-500" />
                <span className="flex-grow truncate">{node.payload.titulo}</span>
              </div>
            );
            break;
           default:
            nodeContent = <div className={baseClasses}>{node.name}</div>
        }

        return (
          <div key={node.id}>
            {nodeContent}
            {expandedNodes[node.id] && node.children && renderTree(node.children)}
          </div>
        );
    });
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1"><FolderTree className="h-6 w-6 text-primary" /><CardTitle className="text-2xl font-headline">Panel de Análisis Interconectado</CardTitle></div>
          <CardDescription className="mb-4">Explore la estructura organizativa y de procesos. Arrastre elementos para reordenar los flujos o asignar actividades.</CardDescription>
        </CardHeader>
        <CardContent>
              <div className="space-y-3 mb-6 p-4 border rounded-lg bg-muted/30">
                <div className="flex justify-between items-center"><CardTitle className="text-lg">Filtros del Árbol</CardTitle> <Button variant="outline" onClick={handleExport}><FileText className="mr-2 h-4 w-4"/>Exportar Vista a CSV</Button></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Select value={selectedAreaFilter} onValueChange={v => { setSelectedAreaFilter(v); setSelectedDeptoFilter('all'); setSelectedPuestoFilter('all'); }} disabled={isLoadingAreas}><SelectTrigger><FilterIcon className="h-4 w-4 mr-2" /><SelectValue placeholder="Filtrar por Área" /></SelectTrigger><SelectContent><SelectItem value="all">Todas las Áreas</SelectItem>{areas.map(area => (<SelectItem key={area.id} value={area.nombre}>{area.nombre}</SelectItem>))}</SelectContent></Select>
                  <Select value={selectedDeptoFilter} onValueChange={v => { setSelectedDeptoFilter(v); setSelectedPuestoFilter('all'); }} disabled={isLoadingDepartamentos || selectedAreaFilter === 'all'}><SelectTrigger><FilterIcon className="h-4 w-4 mr-2" /><SelectValue placeholder={selectedAreaFilter === 'all' ? "Seleccione un área" : "Filtrar por Depto."} /></SelectTrigger><SelectContent><SelectItem value="all">Todos los Deptos.</SelectItem>{availableDepartamentos.map(depto => (<SelectItem key={depto.id} value={depto.nombre}>{depto.nombre}</SelectItem>))}</SelectContent></Select>
                  <Select value={selectedPuestoFilter} onValueChange={setSelectedPuestoFilter} disabled={isLoadingPuestos || selectedAreaFilter === 'all'}><SelectTrigger><FilterIcon className="h-4 w-4 mr-2" /><SelectValue placeholder={selectedAreaFilter === 'all' ? "Seleccione un área" : "Filtrar por Puesto"} /></SelectTrigger><SelectContent><SelectItem value="all">Todos los Puestos</SelectItem>{availablePuestos.map(puesto => (<SelectItem key={puesto.id} value={puesto.id}>{puesto.nombre}</SelectItem>))}</SelectContent></Select>
                  <Select value={treeProcessStatusFilter} onValueChange={(value) => setTreeProcessStatusFilter(value as ProcessStatusFilterType)}><SelectTrigger><FilterIcon className="h-4 w-4 mr-2" /><SelectValue placeholder="Estado del proceso" /></SelectTrigger><SelectContent><SelectItem value="active"><CheckSquare className="h-4 w-4 mr-2 text-green-500" />Procesos Activos</SelectItem><SelectItem value="inactive"><Ban className="h-4 w-4 mr-2 text-red-500" />Procesos Inactivos</SelectItem><SelectItem value="all">Todos los Estados</SelectItem></SelectContent></Select>
                  <div className="relative lg:col-span-4">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="search" placeholder="Buscar en árbol (proceso, política, etc.)..." value={treeGeneralSearchTerm} onChange={(e) => setTreeGeneralSearchTerm(e.target.value)} className="w-full pl-9"/>
                  </div>
                </div>
              </div>
              <Legend />
              <div className="grid md:grid-cols-2 gap-6 min-h-[calc(50vh+120px)]">
                <Card><CardHeader><CardTitle className="text-lg">Árbol de Procesos, Procedimientos y Políticas</CardTitle></CardHeader><CardContent>
                  {filteredActivityId && (
                      <Alert variant="default" className="mb-4 bg-primary/10 border-primary/20">
                          <FilterIcon className="h-4 w-4" />
                          <AlertTitle>Filtro Activo</AlertTitle>
                          <AlertDescription className="flex justify-between items-center">
                              <span className="truncate">Mostrando actividad: <span className="font-semibold mx-1">"{actividades.find(a => a.id === filteredActivityId)?.nombre}"</span></span>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFilteredActivityId(null)}>
                                  <X className="h-4 w-4" />
                              </Button>
                          </AlertDescription>
                      </Alert>
                  )}
                  <ScrollArea className="h-[calc(50vh-30px)] p-1 border rounded-md">{treeData.length > 0 ? renderTree(treeData) : <div className="flex flex-col items-center justify-center h-full text-center p-4"><FolderTree className="h-12 w-12 text-muted-foreground mb-2"/><p className="text-muted-foreground">No hay procesos para mostrar.</p><p className="text-xs text-muted-foreground">Verifique filtros o la configuración.</p></div>}</ScrollArea>
                </CardContent></Card>
                
                <Card id="activity-pool" className={cn("flex flex-col", dropTargetInfo?.type === 'pool' && dropTargetInfo.id === 'activity-pool' && "bg-destructive/20 border-destructive")} onDragOver={(e) => handleDragOver(e)} onDrop={(e) => handleDrop(e)} onDragEnter={(e) => handleDragEnter(e, 'pool')} onDragLeave={handleDragLeave}>
                  <CardHeader>
                    <CardTitle className="text-lg">Pool de Actividades</CardTitle>
                    <CardDescription className="text-xs">Actividades disponibles para asignar. Las inactivas no se pueden arrastrar.</CardDescription>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="relative"><SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" /><Input type="search" placeholder="Buscar actividad..." value={activitySearchTerm} onChange={(e) => setActivitySearchTerm(e.target.value)} className="w-full pl-9"/></div>
                      <Select value={activityStatusFilter} onValueChange={(v) => setActivityStatusFilter(v as ActivityStatusFilterType)}><SelectTrigger><FilterIcon className="h-4 w-4 mr-2" /><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Todas ({actividades.length})</SelectItem><SelectItem value="active">Activas ({activeActivitiesCount})</SelectItem><SelectItem value="inactive">Inactivas ({inactiveActivitiesCount})</SelectItem></SelectContent></Select>
                      <div className="sm:col-span-2"> <Select value={assignmentCountFilter} onValueChange={(v) => setAssignmentCountFilter(v as AssignmentCountFilterType)}><SelectTrigger><FilterIcon className="h-4 w-4 mr-2" /><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Todas (Asignación)</SelectItem><SelectItem value="unassigned">No asignadas ({unassignedCount})</SelectItem><SelectItem value="assigned">Asignadas ({assignedCount})</SelectItem></SelectContent></Select></div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col"><ScrollArea className="flex-grow h-[calc(55vh-110px)] p-1 border rounded-md">{visiblePoolActivities.length > 0 ? (<div className="space-y-2">{visiblePoolActivities.map((act) => (<div key={act.id} draggable={act.activa} onDragStart={(e) => act.activa && handleDragStart(e, {type: 'activityFromPool', id: act.id, sourceParentId: 'pool' })} className={cn("flex items-center p-2 bg-card border rounded shadow-sm text-sm hover:shadow-md group", act.activa ? "cursor-grab" : "cursor-not-allowed opacity-60", !act.activa && "italic text-muted-foreground")} title={!act.activa ? "Actividad inactiva" : `${assignmentCounts.get(act.id) || 0} asignaciones`}><GripVertical className={cn("h-4 w-4 mr-2", act.activa ? "text-muted-foreground" : "text-transparent")}/><span className="flex-grow">{act.nombre}</span>
                    <div className="flex items-center ml-auto opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openDetailDialog(act, 'activity') }} title="Ver detalles"><Eye className="h-4 w-4 text-muted-foreground" /></Button>
                    </div>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button size="sm" variant={filteredActivityId === act.id ? "default" : "secondary"} className="ml-2 font-mono h-6 px-2" onClick={() => setFilteredActivityId(prev => prev === act.id ? null : act.id)}>
                                    {assignmentCounts.get(act.id) || 0}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Filtrar árbol por esta actividad</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    {!act.activa && <Ban className="h-3 w-3 ml-1" />}</div>))}</div>) : (<div className="flex flex-col items-center justify-center h-full text-center p-4"><ListChecks className="h-12 w-12 text-muted-foreground mb-2"/><p className="text-muted-foreground">No hay actividades que coincidan con los filtros.</p></div>)}</ScrollArea>
                    {availableActivities.length > poolLimit && (
                        <div className="pt-2 text-center">
                            <Button variant="link" onClick={() => setPoolLimit(prev => prev + 20)}>
                                Mostrar más ({availableActivities.length - poolLimit} restantes)
                            </Button>
                        </div>
                    )}
                  </CardContent>
                </Card>
              </div>
        </CardContent>
      </Card>

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>Detalles de {detailItemType}</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto pr-4">
                {detailItemType === 'process' && selectedItemForDetail && (
                    <div className="space-y-3">
                        <DetailSectionDisplay title="Proceso" value={(selectedItemForDetail as CapturedProcess).proceso} />
                        <DetailSectionDisplay title="Objetivo" value={(selectedItemForDetail as CapturedProcess).descripcion} isTextarea />
                        <DetailSectionDisplay title="Área" value={(selectedItemForDetail as CapturedProcess).area} />
                        <DetailSectionDisplay title="Puesto" value={(selectedItemForDetail as CapturedProcess).puesto} />
                    </div>
                )}
                {detailItemType === 'activity' && selectedItemForDetail && (
                    <div className="space-y-3">
                        <DetailSectionDisplay title="Actividad" value={(selectedItemForDetail as Actividad).nombre} />
                        <DetailSectionDisplay title="Descripción" value={(selectedItemForDetail as Actividad).descripcionBreve} isTextarea />
                        <DetailSectionDisplay title="Tiempo Estimado (min)" value={(selectedItemForDetail as Actividad).tiempoEstimado} />
                        <DetailSectionDisplay title="Costo Estimado" value={formatMejorasCurrency((selectedItemForDetail as Actividad).costoEstimado, (selectedItemForDetail as Actividad).monedaCosto)} />
                    </div>
                )}
                {detailItemType === 'procedure' && selectedItemForDetail && (
                    <div className="space-y-3">
                        <DetailSectionDisplay title="Procedimiento" value={(selectedItemForDetail as Procedimiento).nombre} />
                        <DetailSectionDisplay title="Descripción" value={(selectedItemForDetail as Procedimiento).descripcion} isTextarea />
                        <DetailSectionDisplay title="Clasificación" value={(selectedItemForDetail as Procedimiento).clasificacion} />
                        <DetailSectionDisplay title="Sistemas Utilizados" value={(selectedItemForDetail as Procedimiento).sistemasUtilizados} isList />
                    </div>
                )}
                {detailItemType === 'policy' && selectedItemForDetail && (
                    <div className="space-y-3">
                        <DetailSectionDisplay title="Política" value={(selectedItemForDetail as Politica).titulo} />
                        <DetailSectionDisplay title="Código" value={(selectedItemForDetail as Politica).codigo} />
                        <DetailSectionDisplay title="Estado" value={(selectedItemForDetail as Politica).estado} />
                        <DetailSectionDisplay title="Descripción" value={(selectedItemForDetail as Politica).descripcion} isTextarea />
                        <DetailSectionDisplay title="Nivel de Cumplimiento" value={(selectedItemForDetail as Politica).nivelCompliance} />
                        <DetailSectionDisplay title="Clasificación" value={(selectedItemForDetail as Politica).clasificacion} />
                        <DetailSectionDisplay title="Fecha de Vigencia" value={(selectedItemForDetail as Politica).fechaVigencia ? format(parseISO((selectedItemForDetail as Politica).fechaVigencia), "PPP", { locale: es }) : 'N/A'} />
                        <DetailSectionDisplay title="Fecha de Revisión" value={(selectedItemForDetail as Politica).fechaRevision ? format(parseISO((selectedItemForDetail as Politica).fechaRevision), "PPP", { locale: es }) : 'N/A'} />
                    </div>
                )}
            </div>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cerrar</Button></DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isReassignDialogOpen} onOpenChange={setIsReassignDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Reasignar Puesto Responsable</DialogTitle>
                <DialogDescription>
                    Seleccione el nuevo puesto que ejecutará la actividad: <span className="font-semibold">{activityToReassign?.nombre}</span>.
                </DialogDescription>
            </DialogHeader>
            <Form {...reassignForm}>
                <form onSubmit={reassignForm.handleSubmit(handleReassignPuestoSubmit)} className="space-y-4 py-4">
                    <FormField
                        control={reassignForm.control}
                        name="puestoId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Puesto Responsable</FormLabel>
                                <FormControl>
                                    <Combobox
                                        value={field.value}
                                        onChange={(value) => field.onChange(value === 'none' ? undefined : value)}
                                        options={[
                                            { value: 'none', label: 'Sin Puesto Específico' },
                                            ...puestos.map(p => ({ value: p.id, label: p.nombre }))
                                        ]}
                                        placeholder="Seleccione un puesto..."
                                        searchPlaceholder="Buscar puesto..."
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                        <Button type="submit">Guardar Cambio</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Editar Proceso: {editingProcess?.proceso}</DialogTitle>
            <DialogDescription>
              Modifique los detalles del proceso. Los cambios se guardarán directamente.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-6 py-4 max-h-[75vh] overflow-y-auto pr-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField control={editForm.control} name="area" render={({ field }) => (<FormItem><FormLabel>Área</FormLabel><Select onValueChange={(v) => { field.onChange(v); setEditValue('departamento', undefined); setEditValue('puesto', undefined); }} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{areas.map(a => <SelectItem key={a.id} value={a.nombre}>{a.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={editForm.control} name="departamento" render={({ field }) => (<FormItem><FormLabel>Departamento</FormLabel><Select onValueChange={(v) => { field.onChange(v); setEditValue('puesto', undefined); }} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Opcional"/></SelectTrigger></FormControl><SelectContent><SelectItem value={NO_DEPARTAMENTO_SELECTED}>Sin Departamento</SelectItem>{filteredEditDepartamentos.map(d => <SelectItem key={d.id} value={d.nombre}>{d.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={editForm.control} name="puesto" render={({ field }) => (<FormItem><FormLabel>Puesto</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{filteredEditPuestos.map(p => <SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              </div>
              <FormField control={editForm.control} name="proceso" render={({ field }) => (<FormItem><FormLabel>Nombre Proceso</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={editForm.control} name="descripcion" render={({ field }) => (<FormItem><FormLabel>Objetivo</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={editForm.control} name="auditFrequencyInDays" render={({ field }) => (<FormItem><FormLabel>Frecuencia de Auditoría</FormLabel><Select onValueChange={(value) => field.onChange(value ? Number(value) : undefined)} value={field.value?.toString()}><FormControl><SelectTrigger><CalendarCheck2 className="mr-2 h-4 w-4" /><SelectValue placeholder="Opcional: Seleccione frecuencia"/></SelectTrigger></FormControl><SelectContent>{auditFrequencyOptions.map(opt => (<SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>))}</SelectContent></Select><FormMessage/></FormItem>)}/>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                <Button type="submit"><Save className="mr-2 h-4 w-4" />Guardar Cambios</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatMejorasCurrency(costoEstimado: number | undefined, monedaCosto?: string): React.ReactNode {
    if (costoEstimado === undefined || isNaN(costoEstimado)) return "-";
    try {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: monedaCosto || 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(costoEstimado);
    } catch (e) {
        return `${costoEstimado.toFixed(2)} ${monedaCosto || ''}`;
    }
}

    
type AssignmentCountFilterType = 'all' | 'assigned' | 'unassigned';
type ActivityStatusFilterType = 'all' | 'active' | 'inactive';
type ProcessStatusFilterType = 'all' | 'active' | 'inactive';
    

    













