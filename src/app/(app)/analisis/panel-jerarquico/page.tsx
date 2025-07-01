

'use client';

import { useState, useEffect, useMemo, type DragEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronRight, ChevronDown, GripVertical, FolderTree, ListChecks, Loader2, Search as SearchIcon, Filter as FilterIcon, XCircle, Eye, Ban, CheckSquare, Share2, ListTree as ListTreeIcon, FileText, Edit2, Building } from "lucide-react";
import { useAreas } from '@/contexts/AreasContext';
import { useDepartamentos } from '@/contexts/DepartamentosContext';
import { usePuestos } from '@/contexts/PuestosContext';
import { useActividades, type Actividad } from '@/contexts/ActividadesContext';
import { useProcesos, type CapturedProcess, type CambioHistorial } from '@/contexts/ProcesosContext';
import { useProcedimientos, type Procedimiento } from '@/contexts/ProcedimientosContext';
import { usePoliticas, type Politica } from '@/contexts/PoliticasContext';

import { toast } from "@/hooks/use-toast";
import { cn, formatMinutesToHours } from '@/lib/utils';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { useActivityLog } from '@/contexts/ActivityLogContext';


const PROCESO_PUESTO_ORDER_LOCAL_STORAGE_KEY = 'proceza-puesto-process-order';


interface TreeNode {
  id: string;
  name: string;
  type: 'area' | 'departamento' | 'puesto' | 'proceso' | 'procedimiento' | 'actividad' | 'politica';
  children?: TreeNode[];
  originalId?: string; 
  activo?: boolean; 
  payload?: any;
}

type AssignmentCountFilterType = 'all' | 'assigned' | 'unassigned';
type ActivityStatusFilterType = 'all' | 'active' | 'inactive';
type ProcessStatusFilterType = 'all' | 'active' | 'inactive';
type DropTargetType = 'procedimiento' | 'activity-in-tree' | 'pool' | 'processNodeInPuesto' | 'puesto';


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


export default function PanelJerarquicoPage() {
  const router = useRouter();
  const { areas, isLoading: isLoadingAreas } = useAreas();
  const { departamentos, isLoading: isLoadingDepartamentos } = useDepartamentos();
  const { puestos, isLoading: isLoadingPuestos } = usePuestos();
  const { actividades, updateActividad: updateGlobalActivity, isLoadingActividades } = useActividades();
  const { procesos: capturedProcesses, updateProceso, isLoadingProcesos } = useProcesos();
  const { procedimientos, updateProcedimiento, isLoading: isLoadingProcedimientos } = useProcedimientos();
  const { politicas, isLoading: isLoadingPoliticas } = usePoliticas();
  const { addLogEntry } = useActivityLog();
  
  const [puestoProcessOrders, setPuestoProcessOrders] = useState<Record<string, string[]>>({});


  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  
  const [draggedItem, setDraggedItem] = useState<{ 
    type: 'activityFromPool' | 'activityInProcedure';
    id: string; 
    sourceProcedureId?: string; 
    sourceIndexInProcedure?: number;
    sourceParentPuestoNodeId?: string;
  } | null>(null);

  const [dropTargetInfo, setDropTargetInfo] = useState<{ 
    id: string; 
    type: DropTargetType;
    targetProcedureId?: string;
    targetActivityId?: string;
  } | null>(null);


  const [activitySearchTerm, setActivitySearchTerm] = useState('');
  const [assignmentCountFilter, setAssignmentCountFilter] = useState<AssignmentCountFilterType>('all');
  const [activityStatusFilter, setActivityStatusFilter] = useState<ActivityStatusFilterType>('active');


  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('all');
  const [selectedDeptoFilter, setSelectedDeptoFilter] = useState<string>('all');
  const [selectedPuestoFilter, setSelectedPuestoFilter] = useState<string>('all');
  const [treeGeneralSearchTerm, setTreeGeneralSearchTerm] = useState('');
  const [policySearchTerm, setPolicySearchTerm] = useState('');
  const [treeProcessStatusFilter, setTreeProcessStatusFilter] = useState<ProcessStatusFilterType>('active');


  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedItemForDetail, setSelectedItemForDetail] = useState<CapturedProcess | Actividad | Procedimiento | Politica | null>(null);
  const [detailItemType, setDetailItemType] = useState<'process' | 'activity' | 'procedure' | 'policy' | null>(null);

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


  useEffect(() => {
    try {
      const storedPuestoOrders = localStorage.getItem(PROCESO_PUESTO_ORDER_LOCAL_STORAGE_KEY);
      if (storedPuestoOrders) {
        setPuestoProcessOrders(JSON.parse(storedPuestoOrders));
      }
    } catch (error) {
      console.error("Error loading puesto order from localStorage:", error);
    }
  }, []);
  
  const isLoadingAllData = isLoadingAreas || isLoadingDepartamentos || isLoadingPuestos || isLoadingProcesos || isLoadingActividades || isLoadingProcedimientos || isLoadingPoliticas;

  useEffect(() => {
    if (!isLoadingAllData && Object.keys(puestoProcessOrders).length > 0) {
        try {
            localStorage.setItem(PROCESO_PUESTO_ORDER_LOCAL_STORAGE_KEY, JSON.stringify(puestoProcessOrders));
        } catch (error) {
            console.error("Error saving puesto-process order to localStorage:", error);
        }
    }
  }, [puestoProcessOrders, isLoadingAllData]);


  useEffect(() => {
    if (isLoadingAllData) return;

    const buildTree = (): TreeNode[] => {
        let finalTreeNodes: TreeNode[] = [];
        let areaNodesMap: Record<string, TreeNode & { deptosMap: Record<string, TreeNode & { puestosMap: Record<string, TreeNode & { processList: CapturedProcess[] }> }> }> = {};

        let filteredProcesses = capturedProcesses.filter(proc => 
            treeProcessStatusFilter === 'all' || 
            (treeProcessStatusFilter === 'active' && proc.activo !== false) || 
            (treeProcessStatusFilter === 'inactive' && proc.activo === false)
        );
        
        let areasToDisplay = selectedAreaFilter === 'all' ? areas : areas.filter(a => a.nombre === selectedAreaFilter);
        
        filteredProcesses.forEach(proc => {
            const areaObj = areas.find(a => a.nombre === proc.area);
            if (selectedAreaFilter !== 'all' && proc.area !== selectedAreaFilter) return;

            const deptoObj = departamentos.find(d => d.nombre === proc.departamento && d.areaId === areaObj?.id);
            if (selectedDeptoFilter !== 'all' && proc.departamento !== selectedDeptoFilter) return;

            const puestoObj = puestos.find(p => p.nombre === proc.puesto && p.areaId === areaObj?.id);
            if (selectedPuestoFilter !== 'all' && proc.puesto !== selectedPuestoFilter) return;
            
            const areaId = areaObj?.id || 'unassigned-area';
            if (!areaNodesMap[areaId]) {
                areaNodesMap[areaId] = { id: `area-${areaId}`, name: areaObj?.nombre || 'Sin Área', type: 'area', originalId: areaId, deptosMap: {} };
            }

            const deptoId = deptoObj?.id || 'unassigned-depto';
            if (!areaNodesMap[areaId].deptosMap[deptoId]) {
                areaNodesMap[areaId].deptosMap[deptoId] = { id: `depto-${deptoId}`, name: deptoObj?.nombre || 'Sin Departamento', type: 'departamento', originalId: deptoId, puestosMap: {} };
            }

            const puestoId = puestoObj?.id || 'unassigned-puesto';
            if (!areaNodesMap[areaId].deptosMap[deptoId].puestosMap[puestoId]) {
                areaNodesMap[areaId].deptosMap[deptoId].puestosMap[puestoId] = { id: `puesto-${puestoId}`, name: puestoObj?.nombre || 'Sin Puesto', type: 'puesto', originalId: puestoId, processList: [] };
            }
            
            areaNodesMap[areaId].deptosMap[deptoId].puestosMap[puestoId].processList.push(proc);
        });

        Object.values(areaNodesMap).forEach(areaNode => {
            let deptoChildren: TreeNode[] = [];
            Object.values(areaNode.deptosMap).forEach(deptoNode => {
                let puestoChildren: TreeNode[] = [];
                Object.values(deptoNode.puestosMap).forEach(puestoNode => {

                    let processTreeNodes = puestoNode.processList.map(proc => {
                        const processPolicies = (proc.politicasAsociadas || [])
                            .map(link => {
                                const pol = politicas.find(p => p.id === link.policyId);
                                return pol ? { ...pol, linkType: link.linkType } : null;
                            })
                            .filter((p): p is Politica & { linkType: string } => !!p)
                            .map(p => ({
                                id: `politica-${p.id}-proc-${proc.id}`,
                                name: `${p.codigo} (${p.linkType})`,
                                type: 'politica' as const, originalId: p.id, payload: p,
                            }));

                        const procedureNodes = (proc.procedimientoOrder || [])
                            .map(procId => procedimientos.find(p => p.id === procId)).filter((p): p is Procedimiento => !!p)
                            .map(procedure => {
                                const procedurePolicies = (procedure.politicasAsociadasIds || [])
                                  .map(polId => politicas.find(p => p.id === polId)).filter((p): p is Politica => !!p)
                                  .map(p => ({ id: `politica-${p.id}-pc-${procedure.id}`, name: `${p.codigo}`, type: 'politica' as const, originalId: p.id, payload: p, }));
                                
                                const activityNodes = (procedure.activityOrder || [])
                                  .map(actId => actividades.find(a => a.id === actId)).filter((a): a is Actividad => !!a)
                                  .map(activity => {
                                      const activityPolicies = (activity.politicasAsociadas || [])
                                        .map(link => {
                                            const pol = politicas.find(p => p.id === link.policyId);
                                            return pol ? { ...pol, linkType: link.linkType } : null;
                                        })
                                        .filter((p): p is Politica & { linkType: string } => !!p)
                                        .map(p => ({ id: `politica-${p.id}-ac-${activity.id}`, name: `${p.codigo} (${p.linkType})`, type: 'politica' as const, originalId: p.id, payload: p }));
                                      return {
                                        id: `activity-${activity.id}-from-procedure-${procedure.id}`,
                                        name: activity.nombre, type: 'actividad' as const, originalId: activity.id, activo: activity.activa,
                                        children: activityPolicies, payload: activity
                                      };
                                  });
                                return {
                                  id: `procedure-${procedure.id}`,
                                  name: procedure.nombre, type: 'procedimiento' as const, originalId: procedure.id, activo: true,
                                  children: [...procedurePolicies, ...activityNodes], payload: procedure
                                };
                            });
                        
                        return {
                            id: `proceso-${proc.id}`,
                            name: proc.proceso, type: 'proceso' as const, originalId: proc.id, activo: proc.activo,
                            children: [...processPolicies, ...procedureNodes], payload: proc
                        };
                    });
                    
                    if (treeGeneralSearchTerm) {
                        const lowerTerm = treeGeneralSearchTerm.toLowerCase();
                        processTreeNodes = processTreeNodes.filter(procNode => {
                            if (procNode.name.toLowerCase().includes(lowerTerm)) return true;
                            procNode.children = (procNode.children || []).filter(procedureNode => {
                                if (procedureNode.name.toLowerCase().includes(lowerTerm)) return true;
                                if (procedureNode.type === 'procedimiento') {
                                    procedureNode.children = (procedureNode.children || []).filter(activityNode => {
                                        return activityNode.name.toLowerCase().includes(lowerTerm);
                                    });
                                    return procedureNode.children.length > 0;
                                }
                                return false;
                            });
                            return procNode.children.length > 0;
                        });
                    }

                    if (policySearchTerm) {
                        const lowerTerm = policySearchTerm.toLowerCase();
                        processTreeNodes = processTreeNodes.filter(procNode => {
                            const hasMatchingPolicy = (node: TreeNode) => {
                                if (node.type === 'politica' && (node.name.toLowerCase().includes(lowerTerm) || node.payload.codigo.toLowerCase().includes(lowerTerm))) return true;
                                return (node.children || []).some(hasMatchingPolicy);
                            };
                            return hasMatchingPolicy(procNode);
                        });
                    }

                    const orderForThisPuesto = puestoProcessOrders[puestoNode.id];
                    let sortedProcessNodes = orderForThisPuesto 
                        ? processTreeNodes.sort((a,b) => orderForThisPuesto.indexOf(a.originalId!) - orderForThisPuesto.indexOf(b.originalId!))
                        : processTreeNodes.sort((a,b) => a.name.localeCompare(b.name));
                    
                    if (sortedProcessNodes.length > 0) {
                        puestoNode.children = sortedProcessNodes;
                        puestoChildren.push(puestoNode);
                    }
                });
                if (puestoChildren.length > 0) {
                    deptoNode.children = puestoChildren.sort((a,b) => a.name.localeCompare(b.name));
                    deptoChildren.push(deptoNode);
                }
            });
            if (deptoChildren.length > 0) {
                areaNode.children = deptoChildren.sort((a,b) => a.name.localeCompare(b.name));
                finalTreeNodes.push(areaNode);
            }
        });

        return finalTreeNodes.sort((a,b) => a.name.localeCompare(b.name));
    };

    const newTreeData = buildTree();
    setTreeData(newTreeData);

    if (policySearchTerm && newTreeData.length > 0) {
        const allNodeIds: Record<string, boolean> = {};
        const expand = (nodes: TreeNode[]) => {
            nodes.forEach(node => {
                allNodeIds[node.id] = true;
                if (node.children) expand(node.children);
            });
        };
        expand(newTreeData);
        setExpandedNodes(allNodeIds);
    } else if (!policySearchTerm) {
        setExpandedNodes({});
    }

}, [
    areas, departamentos, puestos, capturedProcesses, procedimientos, actividades, politicas,
    isLoadingAllData, 
    selectedAreaFilter, selectedDeptoFilter, selectedPuestoFilter, treeGeneralSearchTerm, policySearchTerm, treeProcessStatusFilter,
    puestoProcessOrders
]);


  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const handleDragStart = (
    e: DragEvent<HTMLDivElement>, 
    itemId: string, 
    itemType: 'activityFromPool' | 'activityInProcedure',
    sourceDetails?: { procedureId?: string; indexInProcedure?: number }
  ) => {
    const activity = itemType.startsWith('activity') ? actividades.find(a => a.id === itemId) : null;
    if (activity && !activity.activa) { 
        e.preventDefault();
        toast({ title: "Acción no permitida", description: "Las actividades inactivas no se pueden asignar o mover.", variant: "default" });
        return;
    }
    
    setDraggedItem({ 
        type: itemType, 
        id: itemId, 
        sourceProcedureId: sourceDetails?.procedureId, 
        sourceIndexInProcedure: sourceDetails?.indexInProcedure
    });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", itemId); 
  };
  
  const handleDragOver = (e: DragEvent<HTMLDivElement>, targetType: DropTargetType, targetId?: string) => {
    e.preventDefault();
    let allowDrop = false;

    if (draggedItem?.type.startsWith('activity')) {
        if (targetType === 'procedimiento' || targetType === 'activity-in-tree' || targetType === 'pool') {
            allowDrop = true;
        }
    }

    if (!allowDrop) {
        e.dataTransfer.dropEffect = "none";
        return;
    }
    
    e.dataTransfer.dropEffect = allowDrop ? "move" : "none";
  };
  
  const handleDragEnter = (
    e: DragEvent<HTMLDivElement>, 
    targetId: string, 
    targetType: DropTargetType,
    additionalTargetInfo?: { procedureId?: string; activityId?: string }
  ) => {
    e.preventDefault();
    let canDropOnTarget = true;

    if (draggedItem?.type.startsWith('activity')) {
        if (targetType !== 'procedimiento' && targetType !== 'activity-in-tree' && targetType !== 'pool') {
            canDropOnTarget = false;
        }
    }
    
    if (canDropOnTarget) {
      setDropTargetInfo({ 
        id: targetId, 
        type: targetType,
        targetProcedureId: additionalTargetInfo?.procedureId,
        targetActivityId: additionalTargetInfo?.activityId
      });
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

    const { type: draggedItemType, id: draggedItemId, sourceProcedureId } = draggedItem;
    const { type: targetType, id: dropTargetNodeId, targetProcedureId: actualTargetProcedureId, targetActivityId: actualTargetActivityId } = dropTargetInfo;
    
    if (draggedItemType.startsWith('activity')) {
        const activity = actividades.find(a => a.id === draggedItemId);
        if (!activity || !activity.activa) {
            toast({ title: "Acción no permitida", description: "No se pueden asignar actividades inactivas.", variant: "default" });
            setDraggedItem(null); setDropTargetInfo(null); return;
        }
    
        const handleProcedureUpdate = async (procedureId: string, updateFn: (order: string[]) => string[]) => {
            const originalProcedure = procedimientos.find(p => p.id === procedureId);
            if (originalProcedure) {
                const newOrder = updateFn(originalProcedure.activityOrder || []);
                await updateProcedimiento(procedureId, { activityOrder: newOrder });
            }
        };

        if (targetType === 'pool') { 
            if (!sourceProcedureId) { setDraggedItem(null); setDropTargetInfo(null); return; }
            
            await updateGlobalActivity(draggedItemId, { procedimientoId: undefined });
            await handleProcedureUpdate(sourceProcedureId, (order) => order.filter(id => id !== draggedItemId));
            toast({ title: "Actividad Desasignada", description: `"${activity.nombre}" desasignada.` });

        } else if ((targetType === 'procedimiento' || targetType === 'activity-in-tree') && actualTargetProcedureId) {
            
            await updateGlobalActivity(draggedItemId, { procedimientoId: actualTargetProcedureId });

            if (sourceProcedureId && sourceProcedureId !== actualTargetProcedureId) {
                await handleProcedureUpdate(sourceProcedureId, (order) => order.filter(id => id !== draggedItemId));
            }
            await handleProcedureUpdate(actualTargetProcedureId, (order) => {
                const tempOrder = order.filter(id => id !== draggedItemId);
                if (actualTargetActivityId) {
                    const dropIndex = tempOrder.indexOf(actualTargetActivityId);
                    tempOrder.splice(dropIndex !== -1 ? dropIndex : tempOrder.length, 0, draggedItemId);
                } else {
                    tempOrder.push(draggedItemId);
                }
                return tempOrder;
            });
            toast({ title: "Operación completada", description: `Actividad "${activity.nombre}" gestionada.` });
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
    if (type === 'process') router.push(`/procesos-y-flujos-registrados?search=${encodeURIComponent(item.proceso)}`);
    if (type === 'activity') router.push(`/actividades?search=${encodeURIComponent(item.nombre)}`);
    if (type === 'procedure') router.push(`/procesos-y-flujos-registrados`); // No direct link yet
    if (type === 'policy') router.push(`/politicas?search=${encodeURIComponent(item.codigo)}`);
  };

  const unassignedCount = useMemo(() => actividades.filter(a => a.activa && !a.procedimientoId).length, [actividades]);
  const assignedCount = useMemo(() => actividades.filter(a => a.activa && !!a.procedimientoId).length, [actividades]);
  
  const activeActivitiesCount = useMemo(() => actividades.filter(a => a.activa).length, [actividades]);
  const inactiveActivitiesCount = useMemo(() => actividades.filter(a => !a.activa).length, [actividades]);


  const availableActivities = useMemo(() => {
    return actividades
      .filter(a => {
        if (activityStatusFilter === 'active' && !a.activa) return false;
        if (activityStatusFilter === 'inactive' && a.activa) return false;
        
        if (activitySearchTerm && !a.nombre.toLowerCase().includes(activitySearchTerm.toLowerCase())) {
          return false;
        }

        if (assignmentCountFilter === 'unassigned' && a.procedimientoId) return false;
        if (assignmentCountFilter === 'assigned' && !a.procedimientoId) return false;
        
        return true;
      })
      .sort((a,b) => a.nombre.localeCompare(b.nombre));
  }, [actividades, activitySearchTerm, assignmentCountFilter, activityStatusFilter]);
  
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
    return nodes.map(node => {
        let nodeContent;
        const baseClasses = "flex items-center py-1 px-2 rounded group hover:bg-muted/50";
        switch (node.type) {
          case 'procedimiento':
             nodeContent = (
              <div 
                className={cn(baseClasses, "ml-4 border-l-2", dropTargetInfo?.type === 'procedimiento' && dropTargetInfo.id === node.id && "bg-primary/20 border-primary")}
                onDragOver={(e) => handleDragOver(e, 'procedimiento', node.originalId)}
                onDrop={(e) => handleDrop(e)}
                onDragEnter={(e) => handleDragEnter(e, node.id, 'procedimiento', { procedureId: node.originalId })}
                onDragLeave={handleDragLeave}
                id={node.id}
              >
                <Button variant="ghost" size="sm" onClick={() => toggleNode(node.id)} className="p-1 h-auto mr-1"><ChevronRight className={cn("h-4 w-4 transition-transform", expandedNodes[node.id] && "rotate-90")} /></Button>
                <span className="font-medium text-sm flex-grow">{node.name}</span>
                 <div className="flex items-center ml-auto opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openDetailDialog(node.payload, 'procedure')} title="Ver detalles"><Eye className="h-4 w-4 text-muted-foreground" /></Button>
                </div>
              </div>
            );
            break;
          case 'actividad':
            nodeContent = (
              <div 
                id={`activity-in-tree-${node.originalId}`}
                draggable={node.activo} 
                onDragStart={(e) => node.activo ? handleDragStart(e, node.originalId!, 'activityInProcedure', { procedureId: node.payload.procedimientoId }) : e.preventDefault()}
                onDragOver={(e) => handleDragOver(e, 'activity-in-tree', `activity-in-tree-${node.originalId}`)}
                onDrop={(e) => handleDrop(e)}
                onDragEnter={(e) => handleDragEnter(e, `activity-in-tree-${node.originalId}`, 'activity-in-tree', { procedureId: node.payload.procedimientoId, activityId: node.originalId })}
                onDragLeave={handleDragLeave}
                className={cn(baseClasses, "ml-8 bg-secondary/30", node.activo ? "cursor-grab" : "cursor-not-allowed opacity-70", !node.activo && "italic text-muted-foreground", dropTargetInfo?.type === 'activity-in-tree' && dropTargetInfo.targetActivityId === node.originalId && "ring-2 ring-primary")}
                title={!node.activo ? "Esta actividad está inactiva" : node.name}
              >
                <GripVertical className={cn("h-3 w-3 mr-1.5", node.activo ? "text-muted-foreground" : "text-transparent")}/>
                <span className="flex-grow text-xs">{node.name}</span>
                 {!node.activo && <Ban className="h-3 w-3 ml-auto text-destructive" />}
                 <div className="flex items-center ml-auto opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditItem(node.payload, 'activity')} title="Editar"><Edit2 className="h-4 w-4 text-muted-foreground" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openDetailDialog(node.payload, 'activity')} title="Ver detalles"><Eye className="h-4 w-4 text-muted-foreground" /></Button>
                </div>
              </div>
            );
            break;
          case 'politica':
             nodeContent = (
              <div className={cn(baseClasses, "ml-8 text-xs text-muted-foreground cursor-pointer")} onClick={() => openDetailDialog(node.payload, 'policy')}>
                <FileText className="h-3 w-3 mr-1.5 shrink-0" />
                <span className="flex-grow truncate">{node.name}</span>
              </div>
            );
            break;
          default: // Puesto, Area, Depto, Proceso
            nodeContent = (
              <div 
                className={cn(baseClasses, node.type === 'proceso' && "border-l-2 border-transparent", node.type === 'proceso' && node.activo === false && "opacity-60",
                {'ml-4': node.type === 'departamento', 'ml-8': node.type === 'puesto' || node.type === 'proceso'}
                )}
                id={node.id}
              >
                <Button variant="ghost" size="sm" onClick={() => toggleNode(node.id)} className="p-1 h-auto mr-1">
                  {node.children && node.children.length > 0 ? <ChevronRight className={cn("h-4 w-4 transition-transform", expandedNodes[node.id] && "rotate-90")} /> : <span className="w-4 inline-block"></span>}
                </Button>
                <span className={cn( "flex-grow", 
                    { 'font-bold': node.type === 'area', 'font-medium': node.type === 'departamento' || node.type === 'puesto', 'font-semibold text-sm': node.type === 'proceso', 'italic text-muted-foreground': node.activo === false }
                )}>{node.name}{node.type === 'proceso' && node.activo === false && <Ban className="h-3 w-3 ml-1.5 inline-block text-destructive" />}</span>
                 {node.type === 'proceso' && node.originalId && (
                  <div className="flex items-center ml-auto opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditItem(node.payload, 'process')} title="Editar proceso"><Edit2 className="h-4 w-4 text-muted-foreground" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openDetailDialog(node.payload, 'process')} title="Ver detalles del proceso"><Eye className="h-4 w-4 text-muted-foreground" /></Button>
                  </div>
                )}
              </div>
            );
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
          <CardDescription className="mb-4">Explore la estructura organizativa y de procesos. Arrastre actividades al árbol para asignarlas a un procedimiento.</CardDescription>
        </CardHeader>
        <CardContent>
              <div className="space-y-3 mb-6 p-4 border rounded-lg bg-muted/30">
                <div className="flex justify-between items-center"><CardTitle className="text-lg">Filtros del Árbol</CardTitle></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <Select value={selectedAreaFilter} onValueChange={v => { setSelectedAreaFilter(v); setSelectedDeptoFilter('all'); setSelectedPuestoFilter('all'); }} disabled={isLoadingAreas}><SelectTrigger><FilterIcon className="h-4 w-4 mr-2" /><SelectValue placeholder="Filtrar por Área" /></SelectTrigger><SelectContent><SelectItem value="all">Todas las Áreas</SelectItem>{areas.map(area => (<SelectItem key={area.id} value={area.nombre}>{area.nombre}</SelectItem>))}</SelectContent></Select>
                  <Select value={selectedDeptoFilter} onValueChange={v => { setSelectedDeptoFilter(v); setSelectedPuestoFilter('all'); }} disabled={isLoadingDepartamentos || selectedAreaFilter === 'all'}><SelectTrigger><FilterIcon className="h-4 w-4 mr-2" /><SelectValue placeholder={selectedAreaFilter === 'all' ? "Seleccione un área" : "Filtrar por Depto."} /></SelectTrigger><SelectContent><SelectItem value="all">Todos los Deptos.</SelectItem>{availableDepartamentos.map(depto => (<SelectItem key={depto.id} value={depto.nombre}>{depto.nombre}</SelectItem>))}</SelectContent></Select>
                  <Select value={selectedPuestoFilter} onValueChange={setSelectedPuestoFilter} disabled={isLoadingPuestos || selectedAreaFilter === 'all'}><SelectTrigger><FilterIcon className="h-4 w-4 mr-2" /><SelectValue placeholder={selectedAreaFilter === 'all' ? "Seleccione un área" : "Filtrar por Puesto"} /></SelectTrigger><SelectContent><SelectItem value="all">Todos los Puestos</SelectItem>{availablePuestos.map(puesto => (<SelectItem key={puesto.id} value={puesto.nombre}>{puesto.nombre}</SelectItem>))}</SelectContent></Select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <Select value={treeProcessStatusFilter} onValueChange={(value) => setTreeProcessStatusFilter(value as ProcessStatusFilterType)}><SelectTrigger><FilterIcon className="h-4 w-4 mr-2" /><SelectValue placeholder="Estado del proceso" /></SelectTrigger><SelectContent><SelectItem value="active"><CheckSquare className="h-4 w-4 mr-2 text-green-500" />Procesos Activos</SelectItem><SelectItem value="inactive"><Ban className="h-4 w-4 mr-2 text-red-500" />Procesos Inactivos</SelectItem><SelectItem value="all">Todos los Estados</SelectItem></SelectContent></Select>
                  <div className="relative"><SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input type="search" placeholder="Buscar en árbol..." value={treeGeneralSearchTerm} onChange={(e) => setTreeGeneralSearchTerm(e.target.value)} className="w-full pl-9"/></div>
                  <div className="relative"><FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input type="search" placeholder="Buscar por política..." value={policySearchTerm} onChange={(e) => setPolicySearchTerm(e.target.value)} className="w-full pl-9"/></div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 min-h-[calc(50vh+120px)]">
                <Card><CardHeader><CardTitle className="text-lg">Árbol de Procesos, Procedimientos y Políticas</CardTitle></CardHeader><CardContent><ScrollArea className="h-[calc(50vh-30px)] p-1 border rounded-md">{treeData.length > 0 ? renderTree(treeData) : <div className="flex flex-col items-center justify-center h-full text-center p-4"><FolderTree className="h-12 w-12 text-muted-foreground mb-2"/><p className="text-muted-foreground">No hay procesos para mostrar.</p><p className="text-xs text-muted-foreground">Verifique filtros o la configuración.</p></div>}</ScrollArea></CardContent></Card>
                
                <Card id="activity-pool" className={cn("flex flex-col", dropTargetInfo?.type === 'pool' && dropTargetInfo.id === 'activity-pool' && "bg-destructive/20 border-destructive")} onDragOver={(e) => handleDragOver(e, 'pool')} onDrop={(e) => handleDrop(e)} onDragEnter={(e) => handleDragEnter(e, 'activity-pool', 'pool')} onDragLeave={handleDragLeave}>
                  <CardHeader><CardTitle className="text-lg">Pool de Actividades</CardTitle><CardDescription className="text-xs">Actividades disponibles para asignar. Las inactivas no se pueden arrastrar.</CardDescription>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="relative"><SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" /><Input type="search" placeholder="Buscar actividad..." value={activitySearchTerm} onChange={(e) => setActivitySearchTerm(e.target.value)} className="w-full pl-9"/></div>
                      <Select value={activityStatusFilter} onValueChange={(v) => setActivityStatusFilter(v as ActivityStatusFilterType)}><SelectTrigger><FilterIcon className="h-4 w-4 mr-2" /><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Todas ({actividades.length})</SelectItem><SelectItem value="active">Activas ({activeActivitiesCount})</SelectItem><SelectItem value="inactive">Inactivas ({inactiveActivitiesCount})</SelectItem></SelectContent></Select>
                      <div className="sm:col-span-2"> <Select value={assignmentCountFilter} onValueChange={(v) => setAssignmentCountFilter(v as AssignmentCountFilterType)}><SelectTrigger><FilterIcon className="h-4 w-4 mr-2" /><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Todas (Asignación)</SelectItem><SelectItem value="unassigned">No asignadas ({unassignedCount})</SelectItem><SelectItem value="assigned">Asignadas ({assignedCount})</SelectItem></SelectContent></Select></div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col"><ScrollArea className="flex-grow h-[calc(55vh-110px)] p-1 border rounded-md">{availableActivities.length > 0 ? (<div className="space-y-2">{availableActivities.map((act, index) => (<div key={`${act.id}-${index}`} draggable={act.activa} onDragStart={(e) => act.activa ? handleDragStart(e, act.id, 'activityFromPool') : e.preventDefault()} className={cn("flex items-center p-2 bg-card border rounded shadow-sm text-sm hover:shadow-md group", act.activa ? "cursor-grab" : "cursor-not-allowed opacity-60", !act.activa && "italic text-muted-foreground")} title={!act.activa ? "Actividad inactiva" : (act.procedimientoId ? `Asignada a: ${procedimientos.find(p=>p.id===act.procedimientoId)?.nombre}` : 'No asignada')}><GripVertical className={cn("h-4 w-4 mr-2", act.activa ? "text-muted-foreground" : "text-transparent")}/><span className="flex-grow">{act.nombre}</span> {!act.activa && <Ban className="h-3 w-3 ml-1" />}</div>))}</div>) : (<div className="flex flex-col items-center justify-center h-full text-center p-4"><ListChecks className="h-12 w-12 text-muted-foreground mb-2"/><p className="text-muted-foreground">No hay actividades que coincidan con los filtros.</p></div>)}</ScrollArea></CardContent>
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
                        <DetailSectionDisplay title="Descripción" value={(selectedItemForDetail as CapturedProcess).descripcion} isTextarea />
                        <DetailSectionDisplay title="Área" value={(selectedItemForDetail as CapturedProcess).area} />
                        <DetailSectionDisplay title="Puesto" value={(selectedItemForDetail as CapturedProcess).puesto} />
                        <DetailSectionDisplay title="Frecuencia" value={(selectedItemForDetail as CapturedProcess).frecuencia} />
                        <DetailSectionDisplay title="Tiempo Estimado" value={formatMinutesToHours((selectedItemForDetail as CapturedProcess).tiempoEstimado || 0)} />
                        <DetailSectionDisplay title="Costo Estimado" value={`${(selectedItemForDetail as CapturedProcess).costoEstimado || 0} ${(selectedItemForDetail as CapturedProcess).monedaCosto || ''}`} />
                    </div>
                )}
                {detailItemType === 'activity' && selectedItemForDetail && (
                    <div className="space-y-3">
                        <DetailSectionDisplay title="Actividad" value={(selectedItemForDetail as Actividad).nombre} />
                        <DetailSectionDisplay title="Descripción" value={(selectedItemForDetail as Actividad).descripcionBreve} isTextarea />
                        <DetailSectionDisplay title="Sistema Utilizado" value={(selectedItemForDetail as Actividad).sistemaUtilizado} />
                    </div>
                )}
                {detailItemType === 'procedure' && selectedItemForDetail && (
                    <div className="space-y-3">
                        <DetailSectionDisplay title="Procedimiento" value={(selectedItemForDetail as Procedimiento).nombre} />
                        <DetailSectionDisplay title="Descripción" value={(selectedItemForDetail as Procedimiento).descripcion} isTextarea />
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
                        <DetailSectionDisplay title="Fecha de Vigencia" value={format(parseISO((selectedItemForDetail as Politica).fechaVigencia), "PPP", { locale: es })} />
                        <DetailSectionDisplay title="Fecha de Revisión" value={format(parseISO((selectedItemForDetail as Politica).fechaRevision), "PPP", { locale: es })} />
                    </div>
                )}
            </div>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cerrar</Button></DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
