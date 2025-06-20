
'use client';

import { useState, useEffect, useMemo, type DragEvent, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronRight, ChevronDown, GripVertical, FolderTree, ListChecks, Loader2, Search as SearchIcon, Filter as FilterIcon, XCircle, Eye, Ban, CheckSquare, Share2, ListTree as ListTreeIcon } from "lucide-react";
import { useAreas } from '@/contexts/AreasContext';
import { usePuestos } from '@/contexts/PuestosContext';
import { useActividades, type Actividad } from '@/contexts/ActividadesContext';
import type { CapturedProcess } from '../../procesos-y-flujos-registrados/page';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';


const CAPTURED_DATA_LOCAL_STORAGE_KEY = 'proceza-captured-data';
const PROCESO_PUESTO_ORDER_LOCAL_STORAGE_KEY = 'proceza-puesto-process-order';


interface TreeNode {
  id: string;
  name: string;
  type: 'area' | 'puesto' | 'proceso';
  children?: TreeNode[];
  originalId?: string; 
  activities?: Actividad[]; 
  activo?: boolean; 
}

type AssignmentCountFilterType = 'all' | 'unassigned' | 'assigned_once' | 'assigned_multiple';
type ActivityStatusFilterType = 'all' | 'active' | 'inactive';
type ProcessStatusFilterType = 'all' | 'active' | 'inactive';


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


export default function PanelJerarquicoPage() {
  const { areas, isLoading: isLoadingAreas } = useAreas();
  const { puestos, isLoadingPuestos } = usePuestos();
  const { actividades, updateActividad, isLoadingActividades } = useActividades();
  
  const [capturedProcesses, setCapturedProcesses] = useState<CapturedProcess[]>([]);
  const [isLoadingProcesses, setIsLoadingProcesses] = useState(true);
  const [puestoProcessOrders, setPuestoProcessOrders] = useState<Record<string, string[]>>({});


  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  
  const [draggedItem, setDraggedItem] = useState<{ 
    type: 'activityFromPool' | 'activityInProcess' | 'processNodeInPuesto';
    id: string; 
    sourceProcessId?: string; 
    sourceIndexInProcess?: number;
    sourceParentPuestoNodeId?: string;
  } | null>(null);

  const [dropTargetInfo, setDropTargetInfo] = useState<{ 
    id: string; 
    type: 'proceso' | 'activity-in-tree' | 'pool' | 'processNodeInPuesto';
    targetProcessId?: string;
    targetActivityId?: string;
  } | null>(null);


  const [activitySearchTerm, setActivitySearchTerm] = useState('');
  const [assignmentCountFilter, setAssignmentCountFilter] = useState<AssignmentCountFilterType>('all');
  const [activityStatusFilter, setActivityStatusFilter] = useState<ActivityStatusFilterType>('active');


  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('all');
  const [selectedPuestoFilter, setSelectedPuestoFilter] = useState<string>('all');
  const [treeActivitySearchTerm, setTreeActivitySearchTerm] = useState('');
  const [filterByActivityId, setFilterByActivityId] = useState<string | null>(null);
  const [filteredByActivityName, setFilteredByActivityName] = useState<string | null>(null);
  const [treeProcessStatusFilter, setTreeProcessStatusFilter] = useState<ProcessStatusFilterType>('active');


  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedItemForDetail, setSelectedItemForDetail] = useState<CapturedProcess | Actividad | null>(null);
  const [detailItemType, setDetailItemType] = useState<'process' | 'activity' | null>(null);


  useEffect(() => {
    setIsLoadingProcesses(true);
    try {
      const storedData = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
      if (storedData) {
        const parsedData: CapturedProcess[] = JSON.parse(storedData);
        const dataWithStatusAndOrder = parsedData.map(proc => ({
          ...proc,
          activo: proc.activo === undefined ? true : proc.activo,
          activityOrder: proc.activityOrder || [],
        }));
        setCapturedProcesses(dataWithStatusAndOrder.filter(p => !p.deletedAt));
      }
      const storedPuestoOrders = localStorage.getItem(PROCESO_PUESTO_ORDER_LOCAL_STORAGE_KEY);
      if (storedPuestoOrders) {
        setPuestoProcessOrders(JSON.parse(storedPuestoOrders));
      }
    } catch (error) {
      console.error("Error loading data from localStorage:", error);
      toast({ title: "Error al cargar datos", variant: "destructive" });
    } finally {
      setIsLoadingProcesses(false);
    }
  }, []);
  
  const isLoadingAllData = isLoadingAreas || isLoadingPuestos || isLoadingProcesses || isLoadingActividades;

  useEffect(() => {
    if (!isLoadingAllData) {
      const synchronizedProcesses = capturedProcesses.map(proc => {
        const associatedActivityIds = actividades
          .filter(act => act.procesosAsociadosIds?.includes(proc.id))
          .map(act => act.id);
  
        let currentActivityOrder = proc.activityOrder || [];
        const validOrderedIds = currentActivityOrder.filter(id => associatedActivityIds.includes(id));
        const orderedSet = new Set(validOrderedIds);
        associatedActivityIds.forEach(id => {
          if (!orderedSet.has(id)) {
            validOrderedIds.push(id);
          }
        });
        return { ...proc, activityOrder: validOrderedIds };
      });
      
      if (JSON.stringify(synchronizedProcesses) !== JSON.stringify(capturedProcesses)) {
        setCapturedProcesses(synchronizedProcesses);
      }
    }
  }, [actividades, capturedProcesses, isLoadingAllData]);


  useEffect(() => {
    if (!isLoadingAllData && capturedProcesses.length > 0) { 
        try {
            localStorage.setItem(CAPTURED_DATA_LOCAL_STORAGE_KEY, JSON.stringify(capturedProcesses));
        } catch (error) {
            console.error("Error saving processes to localStorage from Panel Jerarquico:", error);
        }
    }
  }, [capturedProcesses, isLoadingAllData]);

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
      const finalTreeNodes: TreeNode[] = [];
      const areaNodesMap: Record<string, TreeNode & { puestosMap: Record<string, TreeNode & { processList: CapturedProcess[] }> }> = {};

      let areasToFilterOn = areas;
      if (!filterByActivityId && selectedAreaFilter !== 'all' && selectedAreaFilter !== 'area-unassigned') {
        areasToFilterOn = areas.filter(a => a.id === selectedAreaFilter);
      }
      
      if (!filterByActivityId) {
          areasToFilterOn.forEach(area => {
            areaNodesMap[area.id] = {
                id: `area-${area.id}`, name: area.nombre, type: 'area', originalId: area.id, children: [], puestosMap: {}
            };
          });
          if (selectedAreaFilter === 'all' || selectedAreaFilter === 'area-unassigned') {
             if (!areaNodesMap['area-unassigned']) {
                areaNodesMap['area-unassigned'] = {
                    id: 'area-unassigned', name: 'Procesos Sin Área Específica', type: 'area', originalId: 'area-unassigned', children: [], puestosMap: {}
                };
             }
          }
      }
      
      const targetActivityForFiltering = filterByActivityId ? actividades.find(act => act.id === filterByActivityId) : null;

      const processesForTree = capturedProcesses.filter(proc => {
        if (treeProcessStatusFilter === 'active') {
            return proc.activo !== false;
        }
        if (treeProcessStatusFilter === 'inactive') {
            return proc.activo === false;
        }
        return true; 
      });


      processesForTree.forEach(proc => {
        if (targetActivityForFiltering && !(proc.activityOrder?.includes(targetActivityForFiltering.id) || targetActivityForFiltering.procesosAsociadosIds?.includes(proc.id))) {
            return; 
        }

        const procAreaObject = areas.find(a => a.nombre === proc.area);
        let targetAreaId = procAreaObject ? procAreaObject.id : 'area-unassigned';

        if (filterByActivityId && !areaNodesMap[targetAreaId]) {
             areaNodesMap[targetAreaId] = {
                id: `area-${targetAreaId}`, 
                name: procAreaObject ? procAreaObject.nombre : 'Procesos Sin Área Específica',
                type: 'area',
                originalId: targetAreaId,
                children: [],
                puestosMap: {}
             };
        }
        
        if (!areaNodesMap[targetAreaId]) {
           if (!filterByActivityId && (selectedAreaFilter !== 'all' && selectedAreaFilter !== 'area-unassigned' && targetAreaId !== selectedAreaFilter)) {
                return; 
            }
             if (filterByActivityId && targetAreaId !== (procAreaObject?.id || 'area-unassigned')) {
                 return; 
             }
        }

        const currentAreaNode = areaNodesMap[targetAreaId];
        if (!currentAreaNode) return; 


        const procPuestoObject = puestos.find(p => p.nombre === proc.puesto && ((p.areaId === procAreaObject?.id) || (!p.areaId && !procAreaObject)));
        
        if (!filterByActivityId && selectedPuestoFilter !== 'all') {
            if (selectedPuestoFilter === 'puesto-unassigned') {
                if (procPuestoObject) return; 
            } else {
                if (!procPuestoObject || procPuestoObject.id !== selectedPuestoFilter) return;
            }
        }
        
        if (!filterByActivityId && treeActivitySearchTerm) {
            const searchTermLower = treeActivitySearchTerm.toLowerCase();
            const processNameMatches = proc.proceso.toLowerCase().includes(searchTermLower);
            
            const activitiesInOrder = (proc.activityOrder || [])
                .map(actId => actividades.find(a => a.id === actId))
                .filter((act): act is Actividad => !!act);
            const anyActivityNameMatches = activitiesInOrder.some(act => act.nombre.toLowerCase().includes(searchTermLower));
            
            if (!processNameMatches && !anyActivityNameMatches) {
                return; 
            }
        }
        
        const targetPuestoIdKey = procPuestoObject?.id || `puesto-unassigned-in-${targetAreaId}`;
        const targetPuestoName = proc.puesto || 'Procesos Sin Puesto Específico';
        const puestoNodeId = `puesto-${currentAreaNode.id}-${procPuestoObject?.id || targetPuestoName.replace(/\s+/g, '-')}`;


        if (!currentAreaNode.puestosMap[targetPuestoIdKey]) {
            currentAreaNode.puestosMap[targetPuestoIdKey] = {
                id: puestoNodeId,
                name: targetPuestoName,
                type: 'puesto',
                originalId: procPuestoObject?.id,
                children: [],
                processList: []
            };
        }
        
        const currentPuestoNode = currentAreaNode.puestosMap[targetPuestoIdKey];
        currentPuestoNode.processList.push(proc);
      });

      Object.values(areaNodesMap).forEach(areaNode => {
        const puestoChildren: TreeNode[] = [];
        Object.values(areaNode.puestosMap).forEach(puestoNode => {
          if (puestoNode.processList && puestoNode.processList.length > 0) {
            
            const processTreeNodes = puestoNode.processList.map(proc => {
              let activitiesForNode: Actividad[];
              const orderedActivityIds = proc.activityOrder || [];

              if (targetActivityForFiltering) {
                  activitiesForNode = orderedActivityIds.includes(targetActivityForFiltering.id) ? [targetActivityForFiltering] : [];
              } else {
                  activitiesForNode = orderedActivityIds
                    .map(actId => actividades.find(a => a.id === actId))
                    .filter((act): act is Actividad => !!act);
                  
                  if (treeActivitySearchTerm) { 
                    const searchTermLower = treeActivitySearchTerm.toLowerCase();
                    if (proc.proceso.toLowerCase().includes(searchTermLower)) {
                        // Keep all ordered activities if process name matches
                    } else {
                        // Filter activities if process name doesn't match
                        activitiesForNode = activitiesForNode.filter(act => act.nombre.toLowerCase().includes(searchTermLower));
                    }
                  }
              }
              
              return {
                id: `proceso-${proc.id}`, name: proc.proceso, type: 'proceso', originalId: proc.id, activities: activitiesForNode, activo: proc.activo,
              };
            });
            
            const currentPuestoNodeId = puestoNode.id;
            const orderForThisPuesto = puestoProcessOrders[currentPuestoNodeId];
            let sortedProcessTreeNodes;

            if (orderForThisPuesto) {
                sortedProcessTreeNodes = processTreeNodes.sort((a, b) => {
                    const indexA = orderForThisPuesto.indexOf(a.originalId!);
                    const indexB = orderForThisPuesto.indexOf(b.originalId!);
                    if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name);
                    if (indexA === -1) return 1; 
                    if (indexB === -1) return -1;
                    return indexA - indexB;
                });
            } else {
                sortedProcessTreeNodes = processTreeNodes.sort((a, b) => a.name.localeCompare(b.name));
            }

            let finalProcessNodesForPuesto: TreeNode[];
            if (targetActivityForFiltering) {
                finalProcessNodesForPuesto = sortedProcessTreeNodes.filter(ptn => ptn.activities && ptn.activities.length > 0);
            } else if (treeActivitySearchTerm) {
                const searchTermLower = treeActivitySearchTerm.toLowerCase();
                finalProcessNodesForPuesto = sortedProcessTreeNodes.filter(ptn => 
                    ptn.name.toLowerCase().includes(searchTermLower) || 
                    (ptn.activities && ptn.activities.some(act => act.nombre.toLowerCase().includes(searchTermLower))) 
                );
            }
            else {
                finalProcessNodesForPuesto = sortedProcessTreeNodes;
            }
            
            if (finalProcessNodesForPuesto.length > 0) {
                puestoNode.children = finalProcessNodesForPuesto;
                puestoChildren.push(puestoNode);
            }
          }
        });
        areaNode.children = puestoChildren.sort((a,b) => a.name.localeCompare(b.name));
        if (areaNode.children.length > 0) { 
            finalTreeNodes.push(areaNode);
        }
      });
      
      return finalTreeNodes.sort((a,b) => a.name.localeCompare(b.name));
    };

    setTreeData(buildTree());
  }, [
    areas, puestos, capturedProcesses, actividades, 
    isLoadingAllData, 
    selectedAreaFilter, selectedPuestoFilter, treeActivitySearchTerm, filterByActivityId, treeProcessStatusFilter,
    puestoProcessOrders
  ]);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const handleDragStart = (
    e: DragEvent<HTMLDivElement>, 
    itemId: string, 
    itemType: 'activityFromPool' | 'activityInProcess' | 'processNodeInPuesto',
    sourceDetails?: { processId?: string; indexInProcess?: number; parentPuestoNodeId?: string }
  ) => {
    const activity = itemType.startsWith('activity') ? actividades.find(a => a.id === itemId) : null;
    if (itemType.startsWith('activity') && activity && !activity.activa) { 
        e.preventDefault();
        toast({ title: "Acción no permitida", description: "Las actividades inactivas no se pueden asignar o mover.", variant: "default" });
        return;
    }
    if (itemType === 'activityInProcess' && sourceDetails?.processId) {
        const process = capturedProcesses.find(p => p.id === sourceDetails.processId);
        if (process && process.activo === false) {
            e.preventDefault();
            toast({ title: "Acción no permitida", description: "No se pueden mover actividades de procesos inactivos.", variant: "default" });
            return;
        }
    }
    if (itemType === 'processNodeInPuesto') {
        const processNode = capturedProcesses.find(p => p.id === itemId);
        if (processNode && processNode.activo === false) {
            e.preventDefault();
            toast({ title: "Acción no permitida", description: "No se pueden reordenar procesos inactivos.", variant: "default"});
            return;
        }
    }
    setDraggedItem({ 
        type: itemType, 
        id: itemId, 
        sourceProcessId: sourceDetails?.processId, 
        sourceIndexInProcess: sourceDetails?.indexInProcess,
        sourceParentPuestoNodeId: sourceDetails?.parentPuestoNodeId
    });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", itemId); 
  };
  
  const handleDragOver = (e: DragEvent<HTMLDivElement>, targetType: 'proceso' | 'activity-in-tree' | 'pool' | 'processNodeInPuesto', targetId?: string) => {
    e.preventDefault();
    let allowDrop = true;

    const checkProcessStatus = (processId?: string) => {
        if (!processId) return true;
        const process = capturedProcesses.find(p => p.id === processId);
        return process ? process.activo !== false : true;
    };

    if (targetType === 'proceso' && targetId) {
        if (!checkProcessStatus(targetId.replace('proceso-', ''))) allowDrop = false;
    } else if (targetType === 'activity-in-tree' && targetId) {
        const procId = targetId.split('-proc-').pop();
        if (!checkProcessStatus(procId)) allowDrop = false;
    } else if (targetType === 'processNodeInPuesto' && targetId) {
        const procId = targetId.replace('proceso-', '');
        if (!checkProcessStatus(procId)) allowDrop = false;
    }

    if (draggedItem?.type === 'processNodeInPuesto' && targetType !== 'processNodeInPuesto') {
      allowDrop = false; 
    }
    if (draggedItem?.type !== 'processNodeInPuesto' && targetType === 'processNodeInPuesto') {
      allowDrop = false; 
    }


    e.dataTransfer.dropEffect = allowDrop ? "move" : "none";
  };
  
  const handleDragEnter = (
    e: DragEvent<HTMLDivElement>, 
    targetId: string, 
    targetType: 'proceso' | 'activity-in-tree' | 'pool' | 'processNodeInPuesto',
    additionalTargetInfo?: { processId?: string; activityId?: string }
  ) => {
    e.preventDefault();
    let canDropOnTarget = true;

    const getProcessStatus = (processId?: string) => {
        if (!processId) return true; 
        const process = capturedProcesses.find(p => p.id === processId);
        return process ? process.activo !== false : true; 
    };
    
    if (targetType === 'proceso') {
        if (!getProcessStatus(targetId.replace('proceso-', ''))) canDropOnTarget = false;
    } else if (targetType === 'activity-in-tree') {
        const procId = targetId.split('-proc-').pop();
        if (!getProcessStatus(procId)) canDropOnTarget = false;
    } else if (targetType === 'processNodeInPuesto') {
         const procId = targetId.replace('proceso-', '');
         if (!getProcessStatus(procId)) canDropOnTarget = false;
    }
    
    if (draggedItem?.type === 'processNodeInPuesto') {
      if (targetType !== 'processNodeInPuesto') {
        canDropOnTarget = false;
      }
    }
    
    if (canDropOnTarget) {
      setDropTargetInfo({ 
        id: targetId, 
        type: targetType,
        targetProcessId: additionalTargetInfo?.processId,
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

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!draggedItem || !dropTargetInfo) return;

    const { type: draggedItemType, id: draggedItemId, sourceProcessId, sourceParentPuestoNodeId } = draggedItem;
    const { type: targetType, id: dropTargetNodeId, targetProcessId: actualTargetProcessId, targetActivityId: actualTargetActivityId } = dropTargetInfo;

    if (draggedItemType === 'processNodeInPuesto' && targetType === 'processNodeInPuesto') {
        const targetProcessOriginalId = dropTargetNodeId.replace('proceso-', '');
        
        let parentPuestoNodeOfTarget: TreeNode | undefined;
        const findPuestoNode = (nodes: TreeNode[]): TreeNode | undefined => {
            for (const node of nodes) {
                if (node.type === 'puesto' && node.children?.some(child => child.id === dropTargetNodeId)) {
                    return node;
                }
                if (node.children) {
                    const found = findPuestoNode(node.children);
                    if (found) return found;
                }
            }
            return undefined;
        };
        parentPuestoNodeOfTarget = findPuestoNode(treeData);
        
        if (!parentPuestoNodeOfTarget || sourceParentPuestoNodeId !== parentPuestoNodeOfTarget.id) {
            toast({ title: "Movimiento no válido", description: "Los procesos solo se pueden reordenar dentro del mismo puesto." });
            setDraggedItem(null);
            setDropTargetInfo(null);
            return;
        }
        const currentPuestoNodeId = parentPuestoNodeOfTarget.id;
        const currentOrder = puestoProcessOrders[currentPuestoNodeId] || parentPuestoNodeOfTarget.children?.map(c => c.originalId!) || [];
        
        const newOrder = [...currentOrder];
        const draggedIndex = newOrder.indexOf(draggedItemId);
        if (draggedIndex > -1) newOrder.splice(draggedIndex, 1);

        const targetIndex = newOrder.indexOf(targetProcessOriginalId);
        if (targetIndex > -1) {
            newOrder.splice(targetIndex, 0, draggedItemId);
        } else {
            newOrder.push(draggedItemId);
        }

        setPuestoProcessOrders(prev => ({ ...prev, [currentPuestoNodeId]: newOrder }));
        toast({ title: "Proceso Reordenado", description: "El orden del proceso ha sido actualizado." });
        setDraggedItem(null);
        setDropTargetInfo(null);
        return;
    }

    if (draggedItemType === 'activityFromPool' || draggedItemType === 'activityInProcess') {
        const activity = actividades.find(a => a.id === draggedItemId);
        if (!activity || !activity.activa) {
            toast({ title: "Acción no permitida", description: "No se pueden asignar actividades inactivas.", variant: "default" });
            setDraggedItem(null);
            setDropTargetInfo(null);
            return;
        }

        if (targetType === 'pool') { 
            if (!sourceProcessId) { 
              setDraggedItem(null);
              setDropTargetInfo(null);
              return;
            }
            const newProcesosAsociadosIds = (activity.procesosAsociadosIds || []).filter(id => id !== sourceProcessId);
            updateActividad(draggedItemId, { ...activity, procesosAsociadosIds: newProcesosAsociadosIds });
            setCapturedProcesses(prevProcesses => prevProcesses.map(proc => {
                if (proc.id === sourceProcessId) {
                    return { ...proc, activityOrder: (proc.activityOrder || []).filter(id => id !== draggedItemId) };
                }
                return proc;
            }));
            toast({ title: "Actividad Desasignada", description: `"${activity.nombre}" desasignada del proceso.` });
        } else if ((targetType === 'proceso' || targetType === 'activity-in-tree') && actualTargetProcessId) {
             const targetProcess = capturedProcesses.find(p => p.id === actualTargetProcessId);
             if (targetProcess && targetProcess.activo === false) {
                 toast({ title: "Acción no permitida", description: "No se pueden asignar actividades a procesos inactivos.", variant: "default" });
                 setDraggedItem(null);
                 setDropTargetInfo(null);
                 return;
             }

            let newProcesosAsociadosIds = [...(activity.procesosAsociadosIds || [])];
            let finalCapturedProcesses = [...capturedProcesses];

            if (sourceProcessId) {
                finalCapturedProcesses = finalCapturedProcesses.map(proc => {
                    if (proc.id === sourceProcessId) {
                        return { ...proc, activityOrder: (proc.activityOrder || []).filter(id => id !== draggedItemId) };
                    }
                    return proc;
                });
                if (sourceProcessId !== actualTargetProcessId) {
                    newProcesosAsociadosIds = newProcesosAsociadosIds.filter(id => id !== sourceProcessId);
                }
            }

            finalCapturedProcesses = finalCapturedProcesses.map(proc => {
                if (proc.id === actualTargetProcessId) {
                    let newOrder = (proc.activityOrder || []).filter(id => id !== draggedItemId); 
                    
                    if (actualTargetActivityId) { 
                        const targetIdx = newOrder.indexOf(actualTargetActivityId);
                        if (targetIdx !== -1) {
                            newOrder.splice(targetIdx, 0, draggedItemId);
                        } else {
                            newOrder.push(draggedItemId); 
                        }
                    } else { 
                        newOrder.push(draggedItemId); 
                    }
                    return { ...proc, activityOrder: newOrder };
                }
                return proc;
            });
            
            if (!newProcesosAsociadosIds.includes(actualTargetProcessId)) {
                newProcesosAsociadosIds.push(actualTargetProcessId);
            }
            
            updateActividad(draggedItemId, { ...activity, procesosAsociadosIds: newProcesosAsociadosIds });
            setCapturedProcesses(finalCapturedProcesses);
            toast({ title: "Operación completada", description: `Actividad "${activity.nombre}" gestionada en proceso.` });
        }
    }
    
    setDraggedItem(null);
    setDropTargetInfo(null);
  };

  const handleActivityBadgeClick = (activity: Actividad) => {
    if (filterByActivityId === activity.id) {
        setFilterByActivityId(null);
        setFilteredByActivityName(null);
    } else {
        setFilterByActivityId(activity.id);
        setFilteredByActivityName(activity.nombre);
        setSelectedAreaFilter('all');
        setSelectedPuestoFilter('all');
        setTreeActivitySearchTerm('');
        setTreeProcessStatusFilter('active'); 
    }
  };
   useEffect(() => {
    if (filterByActivityId && treeData.length > 0) {
        const allNodeIds: Record<string, boolean> = {};
        const expand = (nodes: TreeNode[]) => {
            nodes.forEach(node => {
                allNodeIds[node.id] = true;
                if (node.children) expand(node.children);
            });
        };
        expand(treeData);
        setExpandedNodes(allNodeIds);
    }
  }, [filterByActivityId, treeData]);

  const openDetailDialog = (item: CapturedProcess | Actividad, type: 'process' | 'activity') => {
    setSelectedItemForDetail(item);
    setDetailItemType(type);
    setIsDetailDialogOpen(true);
  };

  const renderTree = (nodes: TreeNode[], parentPuestoNodeId?: string): JSX.Element[] => {
    return nodes.map(node => (
      <div key={node.id} className="ml-4">
        <div 
          className={cn(
            "flex items-center py-1 px-2 rounded group hover:bg-muted/50",
            node.type === 'proceso' && "border-l-2 border-transparent",
             dropTargetInfo?.type === 'proceso' && dropTargetInfo.id === node.id && node.activo !== false && draggedItem?.type.startsWith('activity') && "bg-primary/20 border-primary",
            dropTargetInfo?.type === 'processNodeInPuesto' && dropTargetInfo.id === node.id && node.activo !== false && draggedItem?.type === 'processNodeInPuesto' && "ring-2 ring-accent",
            node.type === 'proceso' && node.activo === false && "opacity-60"
          )}
          draggable={node.type === 'proceso' && node.activo !== false}
          onDragStart={node.type === 'proceso' && node.activo !== false ? (e) => handleDragStart(e, node.originalId!, 'processNodeInPuesto', { parentPuestoNodeId: parentPuestoNodeId }) : undefined}
          onDragOver={node.type === 'proceso' && node.activo !== false ? (e) => handleDragOver(e, draggedItem?.type === 'processNodeInPuesto' ? 'processNodeInPuesto' : 'proceso', node.originalId) : undefined}
          onDrop={node.type === 'proceso' && node.activo !== false ? (e) => handleDrop(e) : undefined}
          onDragEnter={node.type === 'proceso' && node.activo !== false ? (e) => handleDragEnter(e, node.id, draggedItem?.type === 'processNodeInPuesto' ? 'processNodeInPuesto' : 'proceso', { processId: node.originalId }) : undefined}
          onDragLeave={handleDragLeave}
          id={node.id}
          title={node.type === 'proceso' && node.activo === false ? "Este proceso está inactivo" : node.name}
        >
          {node.type === 'proceso' && node.activo !== false && <GripVertical className="h-4 w-4 mr-1 text-muted-foreground cursor-grab" />}
          <Button variant="ghost" size="sm" onClick={() => toggleNode(node.id)} className="p-1 h-auto mr-1">
            {node.children || node.activities ? (expandedNodes[node.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <span className="w-4 inline-block"></span>}
          </Button>
          <span className={cn(
              "text-sm flex-grow", 
              node.type === 'proceso' && "font-semibold", 
              node.type === 'area' && "font-bold", 
              node.type === 'puesto' && "font-medium",
              node.type === 'proceso' && node.activo === false && "italic text-muted-foreground"
            )}
          >
            {node.name}
            {node.type === 'proceso' && node.activo === false && <Ban className="h-3 w-3 ml-1.5 inline-block text-destructive" />}
          </span>
          {node.type === 'proceso' && node.originalId && (
            <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => openDetailDialog(capturedProcesses.find(p => p.id === node.originalId)!, 'process')} title="Ver detalles del proceso">
              <Eye className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
        </div>
        {expandedNodes[node.id] && (
          <>
            {node.children && renderTree(node.children, node.type === 'puesto' ? node.id : parentPuestoNodeId)}
            {node.activities && node.type === 'proceso' && node.originalId && (node.type !== 'proceso' || node.activo !== false) && ( 
              <div className="ml-8 mt-1 space-y-1">
                {node.activities.map((act, index) => {
                  const activityInTreeId = `tree-activity-${act.id}-proc-${node.originalId!}`;
                  return (
                  <div 
                    key={activityInTreeId} 
                    id={activityInTreeId}
                    draggable={act.activa && node.activo !== false}
                    onDragStart={(e) => (act.activa && node.activo !== false) ? handleDragStart(e, act.id, 'activityInProcess', { processId: node.originalId, indexInProcess: index }) : e.preventDefault()}
                    onDragOver={(e) => handleDragOver(e, 'activity-in-tree', activityInTreeId)}
                    onDrop={(e) => handleDrop(e)}
                    onDragEnter={(e) => handleDragEnter(e, activityInTreeId, 'activity-in-tree', { processId: node.originalId, activityId: act.id })}
                    onDragLeave={handleDragLeave}
                    className={cn(
                        "flex items-center p-1.5 bg-secondary/30 rounded text-xs group",
                        (act.activa && node.activo !== false) ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed opacity-70",
                        !act.activa && "italic text-muted-foreground",
                        dropTargetInfo?.type === 'activity-in-tree' && dropTargetInfo.id === activityInTreeId && "ring-2 ring-primary"
                    )}
                    title={!act.activa ? "Esta actividad está inactiva" : (node.activo === false ? "El proceso padre está inactivo" : act.nombre)}
                  >
                    <GripVertical className={cn("h-3 w-3 mr-1.5", (act.activa && node.activo !== false) ? "text-muted-foreground" : "text-transparent")}/>
                    <span className="flex-grow">{act.nombre}</span>
                    {!act.activa && <Ban className="h-3 w-3 ml-auto text-destructive" />}
                     <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => openDetailDialog(act, 'activity')} title="Ver detalles de la actividad">
                        <Eye className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                )})}
                 {node.activities.length === 0 && <p className="text-xs text-muted-foreground italic pl-2">Ninguna actividad asignada (o visible con filtros)</p>}
              </div>
            )}
          </>
        )}
      </div>
    ));
  };

  const unassignedCount = useMemo(() => actividades.filter(a => a.activa && (a.procesosAsociadosCount || 0) === 0).length, [actividades]);
  const assignedOnceCount = useMemo(() => actividades.filter(a => a.activa && (a.procesosAsociadosCount || 0) === 1).length, [actividades]);
  const assignedMultipleCount = useMemo(() => actividades.filter(a => a.activa && (a.procesosAsociadosCount || 0) > 1).length, [actividades]);
  
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

        const count = a.procesosAsociadosCount || 0;
        if (assignmentCountFilter === 'unassigned' && count !== 0) return false;
        if (assignmentCountFilter === 'assigned_once' && count !== 1) return false;
        if (assignmentCountFilter === 'assigned_multiple' && count <= 1) return false;
        
        return true;
      })
      .sort((a,b) => a.nombre.localeCompare(b.nombre));
  }, [actividades, activitySearchTerm, assignmentCountFilter, activityStatusFilter]);

  const getProcessNamesForActivity = (activity: Actividad): string => {
    if (!activity.procesosAsociadosIds || activity.procesosAsociadosIds.length === 0) {
      return "No asignada a procesos.";
    }
    return activity.procesosAsociadosIds
      .map(procId => {
          const proc = capturedProcesses.find(cp => cp.id === procId);
          return proc ? `${proc.proceso}${proc.activo === false ? ' (Inactivo)' : ''}` : `ID: ${procId} (no encontrado)`;
      })
      .join(', ');
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

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <FolderTree className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl font-headline">Panel de Análisis Interconectado</CardTitle>
          </div>
          <CardDescription className="mb-4">
            Explore la estructura organizativa y las relaciones de procesos mediante vistas jerárquicas y diagramas de flujo. 
            La vista de árbol permite arrastrar actividades activas desde el pool hacia procesos activos, moverlas entre procesos, reordenarlas, o devolverlas al pool. Los procesos activos también pueden reordenarse dentro de su puesto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="arbol" className="w-full">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 mb-4">
              <TabsTrigger value="arbol"><ListTreeIcon className="mr-2 h-4 w-4"/>Vista de Árbol</TabsTrigger>
              <TabsTrigger value="diagrama"><Share2 className="mr-2 h-4 w-4"/>Diagrama de Relaciones</TabsTrigger>
            </TabsList>

            <TabsContent value="arbol">
              <div className="space-y-3 mb-6 p-4 border rounded-lg bg-muted/30">
                <CardTitle className="text-lg">Filtros del Árbol de Procesos</CardTitle>
                <CardDescription className="text-xs">Filtre la vista de árbol por área, puesto, estado del proceso o actividad/proceso. Los procesos inactivos se muestran atenuados y no permiten interacciones de asignación o reordenamiento.</CardDescription>
                {filteredByActivityName && (
                  <div className="p-2 text-sm text-primary border-b bg-primary/10 rounded-md flex items-center justify-between">
                    <span>Filtrando por actividad: <strong>{filteredByActivityName}</strong></span>
                    <Button variant="ghost" size="sm" className="p-1 h-auto text-primary hover:bg-primary/20" onClick={() => handleActivityBadgeClick({id: filterByActivityId!} as Actividad)}>
                        <XCircle className="h-4 w-4 mr-1" /> Limpiar
                    </Button>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Select value={selectedAreaFilter} onValueChange={setSelectedAreaFilter} disabled={isLoadingAreas || !!filterByActivityId}>
                      <SelectTrigger className="w-full">
                        <FilterIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Filtrar por Área" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las Áreas</SelectItem>
                        <SelectItem value="area-unassigned">Procesos Sin Área Específica</SelectItem>
                        {areas.map(area => (
                          <SelectItem key={area.id} value={area.id}>{area.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Select value={selectedPuestoFilter} onValueChange={setSelectedPuestoFilter} disabled={isLoadingPuestos || !!filterByActivityId}>
                      <SelectTrigger className="w-full">
                        <FilterIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Filtrar por Puesto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los Puestos</SelectItem>
                        <SelectItem value="puesto-unassigned">Procesos Sin Puesto Específico</SelectItem>
                        {puestos.map(puesto => (
                          <SelectItem key={puesto.id} value={puesto.id}>{puesto.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Select value={treeProcessStatusFilter} onValueChange={(value) => setTreeProcessStatusFilter(value as ProcessStatusFilterType)} disabled={!!filterByActivityId}>
                      <SelectTrigger className="w-full">
                          <FilterIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                          <SelectValue placeholder="Filtrar por estado del proceso" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="active"><CheckSquare className="h-4 w-4 mr-2 inline-block text-green-500" /> Procesos Activos</SelectItem>
                          <SelectItem value="inactive"><Ban className="h-4 w-4 mr-2 inline-block text-red-500" /> Procesos Inactivos</SelectItem>
                          <SelectItem value="all">Todos los Estados</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="relative pt-2">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                      type="search"
                      placeholder="Buscar actividad o proceso en árbol..."
                      value={treeActivitySearchTerm}
                      onChange={(e) => setTreeActivitySearchTerm(e.target.value)}
                      className="w-full pl-9"
                      disabled={!!filterByActivityId}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 min-h-[calc(50vh+120px)]">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Árbol de Procesos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[calc(50vh-30px)] p-1 border rounded-md">
                      {treeData.length > 0 ? renderTree(treeData) : 
                        <div className="flex flex-col items-center justify-center h-full text-center p-4">
                          <FolderTree className="h-12 w-12 text-muted-foreground mb-2"/>
                          <p className="text-muted-foreground">No hay procesos para mostrar.</p>
                          <p className="text-xs text-muted-foreground">Verifique filtros o la configuración.</p>
                        </div>
                      }
                    </ScrollArea>
                  </CardContent>
                </Card>
                
                <Card 
                  id="activity-pool"
                  className={cn("flex flex-col", dropTargetInfo?.type === 'pool' && dropTargetInfo.id === 'activity-pool' && "bg-destructive/20 border-destructive")}
                  onDragOver={(e) => handleDragOver(e, 'pool')}
                  onDrop={(e) => handleDrop(e)}
                  onDragEnter={(e) => handleDragEnter(e, 'activity-pool', 'pool')}
                  onDragLeave={handleDragLeave}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">Pool de Actividades</CardTitle>
                    <CardDescription className="text-xs">Actividades disponibles para asignar. Filtre o busque. Las inactivas no se pueden arrastrar.</CardDescription>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="relative">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="search"
                          placeholder="Buscar actividad..."
                          value={activitySearchTerm}
                          onChange={(e) => setActivitySearchTerm(e.target.value)}
                          className="w-full pl-9"
                        />
                      </div>
                      <div>
                        <Select value={activityStatusFilter} onValueChange={(value) => setActivityStatusFilter(value as ActivityStatusFilterType)}>
                          <SelectTrigger className="w-full">
                              <FilterIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                              <SelectValue placeholder="Filtrar por estado actividad" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="all">Todas ({actividades.length})</SelectItem>
                              <SelectItem value="active"><CheckSquare className="h-4 w-4 mr-2 inline-block text-green-500" /> Activas ({activeActivitiesCount})</SelectItem>
                              <SelectItem value="inactive"><Ban className="h-4 w-4 mr-2 inline-block text-red-500" /> Inactivas ({inactiveActivitiesCount})</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2"> 
                        <Select value={assignmentCountFilter} onValueChange={(value) => setAssignmentCountFilter(value as AssignmentCountFilterType)}>
                          <SelectTrigger className="w-full">
                            <FilterIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                            <SelectValue placeholder="Filtrar por asignación" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas (Asignación) ({actividades.filter(a => a.activa || activityStatusFilter !== 'active').length})</SelectItem>
                            <SelectItem value="unassigned">No asignadas ({unassignedCount})</SelectItem>
                            <SelectItem value="assigned_once">Asignadas a 1 proc. ({assignedOnceCount})</SelectItem>
                            <SelectItem value="assigned_multiple">Asignadas a 2+ proc. ({assignedMultipleCount})</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col">
                    <ScrollArea className="flex-grow h-[calc(55vh-110px)] p-1 border rounded-md"> 
                      {availableActivities.length > 0 ? (
                        <div className="space-y-2">
                          {availableActivities.map((act, index) => (
                            <div 
                              key={`${act.id}-${index}`} 
                              draggable={act.activa} 
                              onDragStart={(e) => act.activa ? handleDragStart(e, act.id, 'activityFromPool') : e.preventDefault()}
                              className={cn(
                                  "flex items-center p-2 bg-card border rounded shadow-sm text-sm hover:shadow-md group", 
                                  act.activa ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed opacity-60",
                                  !act.activa && "italic text-muted-foreground"
                              )}
                              title={!act.activa ? "Esta actividad está inactiva. Actívela para asignarla." : (act.procesosAsociadosCount > 0 ? `Asignada a: ${getProcessNamesForActivity(act)}` : 'No asignada a procesos')}
                            >
                              <GripVertical className={cn("h-4 w-4 mr-2", act.activa ? "text-muted-foreground" : "text-transparent")}/>
                              <span className="flex-grow">{act.nombre}</span> 
                              {!act.activa && <Ban className="h-3 w-3 ml-1 text-destructive" />}
                              <Button variant="ghost" size="icon" className="h-6 w-6 ml-2 opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => openDetailDialog(act, 'activity')} title="Ver detalles de la actividad">
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              {act.procesosAsociadosCount > 0 && 
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className={cn(
                                    "p-1 h-auto text-xs ml-1", 
                                    filterByActivityId === act.id && "bg-primary/20 text-primary border-primary"
                                  )} 
                                  onClick={() => handleActivityBadgeClick(act)}
                                  title={`Filtrar árbol por esta actividad (${act.procesosAsociadosCount} procesos)`}
                                >
                                  {act.procesosAsociadosCount}P
                                </Button>
                              }
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center p-4">
                          <ListChecks className="h-12 w-12 text-muted-foreground mb-2"/>
                          <p className="text-muted-foreground">
                            {activitySearchTerm || assignmentCountFilter !== 'all' || activityStatusFilter !== 'all'
                              ? "No hay actividades que coincidan con los filtros."
                              : "No hay actividades disponibles."
                            }
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {!(activitySearchTerm || assignmentCountFilter !== 'all' || activityStatusFilter !== 'all') && "Agréguelas en 'Gestión de Actividades'."}
                          </p>
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="diagrama">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Diagrama de Relaciones de Procesos</CardTitle>
                  <CardDescription>Visualización gráfica de las interconexiones entre áreas, puestos, procesos y actividades.</CardDescription>
                </CardHeader>
                <CardContent className="min-h-[calc(60vh)]"> {/* Adjusted height to match tree view area */}
                  <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center h-full bg-muted/20">
                      <Share2 className="h-16 w-16 text-muted-foreground mb-4" />
                      <p className="text-lg font-semibold text-foreground">Visualización de Diagrama (Conceptual)</p>
                      <p className="text-sm text-muted-foreground text-center max-w-md">
                          Esta sección está diseñada para mostrar un diagrama interactivo de las relaciones entre entidades (áreas, puestos, procesos, actividades).
                          La implementación de un componente de diagramación dinámica (ej: usando bibliotecas como React Flow o Mermaid.js)
                          requiere desarrollo adicional y está fuera del alcance de las modificaciones actuales.
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">Un futuro desarrollo podría permitir filtrar y visualizar flujos de trabajo interconectados aquí.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Detalles de {detailItemType === 'process' ? 'Proceso' : 'Actividad'}: {selectedItemForDetail?.nombre}
            </DialogTitle>
            <DialogDescription>
              Información completa del elemento seleccionado.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3 max-h-[70vh] overflow-y-auto pr-2">
            {selectedItemForDetail && detailItemType === 'process' && (() => {
              const process = selectedItemForDetail as CapturedProcess;
              const processActivities = (process.activityOrder || [])
                .map(actId => actividades.find(a => a.id === actId)?.nombre)
                .filter(Boolean) as string[];
              return (
                <>
                  <DetailSectionDisplay title="Nombre del Proceso" value={process.proceso} />
                  <DetailSectionDisplay title="Área" value={process.area} />
                  <DetailSectionDisplay title="Puesto Principal" value={process.puesto} />
                  <DetailSectionDisplay title="Descripción Detallada" value={process.descripcion} isTextarea />
                  <DetailSectionDisplay title="Tiempo Estimado" value={process.tiempoEstimado !== undefined ? `${process.tiempoEstimado} minutos` : undefined} />
                  <DetailSectionDisplay title="Frecuencia" value={process.frecuencia} />
                  <DetailSectionDisplay title="Sistemas Utilizados" value={process.sistemas} isList />
                  <DetailSectionDisplay title="Información que Recibe (Entradas)" value={process.informacionRecibe} isTextarea />
                  <DetailSectionDisplay title="Procesos de Entradas" value={process.procesosEntrada} isList />
                  <DetailSectionDisplay title="Información que Entrega (Salidas)" value={process.informacionEntrega} isTextarea />
                  <DetailSectionDisplay title="Procesos de Salida" value={process.procesosSalida} isList />
                  <DetailSectionDisplay title="Estado" value={process.activo !== false ? 'Activo' : 'Inactivo'} />
                  <DetailSectionDisplay title="Actividades en Orden" value={processActivities} isList />
                  <DetailSectionDisplay title="Fecha de Captura" value={process.capturedAt && isValid(parseISO(process.capturedAt)) ? format(parseISO(process.capturedAt), 'dd MMMM yyyy, HH:mm', { locale: es }) : undefined} />
                  <DetailSectionDisplay title="Última Modificación" value={process.updatedAt && isValid(new Date(process.updatedAt)) ? format(new Date(process.updatedAt), 'dd MMMM yyyy, HH:mm', { locale: es }) : undefined} />
                </>
              );
            })()}
            {selectedItemForDetail && detailItemType === 'activity' && (() => {
              const activity = selectedItemForDetail as Actividad;
              const associatedProcessNames = (activity.procesosAsociadosIds || [])
                .map(procId => capturedProcesses.find(cp => cp.id === procId)?.proceso)
                .filter(Boolean);
              return (
                <>
                  <DetailSectionDisplay title="Nombre de la Actividad" value={activity.nombre} />
                  <DetailSectionDisplay title="Descripción Breve" value={activity.descripcionBreve} isTextarea />
                  <DetailSectionDisplay title="Sistema Utilizado" value={activity.sistemaUtilizado} />
                  <DetailSectionDisplay title="Tiempo Estimado (min)" value={activity.tiempoEstimadoActividad} />
                  <DetailSectionDisplay title="Frecuencia de la Actividad" value={activity.frecuenciaActividad} />
                  <DetailSectionDisplay title="Estado" value={activity.activa ? 'Activa' : 'Inactiva'} />
                  <DetailSectionDisplay title="Procesos Asociados" value={associatedProcessNames} isList />
                  <DetailSectionDisplay title="Fecha de Creación" value={activity.createdAt && isValid(new Date(activity.createdAt)) ? format(new Date(activity.createdAt), 'dd MMMM yyyy, HH:mm', { locale: es }) : undefined} />
                  <DetailSectionDisplay title="Última Modificación" value={activity.updatedAt && isValid(new Date(activity.updatedAt)) ? format(new Date(activity.updatedAt), 'dd MMMM yyyy, HH:mm', { locale: es }) : undefined} />
                </>
              );
            })()}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cerrar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

       <div className="mt-4 text-xs text-muted-foreground text-center">
        Nota: La funcionalidad de arrastrar y soltar (drag & drop) se implementa con HTML5 nativo.
      </div>
    </div>
  );
}


    