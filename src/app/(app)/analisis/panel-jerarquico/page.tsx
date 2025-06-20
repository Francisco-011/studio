
'use client';

import { useState, useEffect, useMemo, type DragEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, ChevronDown, GripVertical, FolderTree, ListChecks, Loader2, Search as SearchIcon, Filter as FilterIcon, XCircle, CopyCheck, Layers, CheckSquare, Ban } from "lucide-react";
import { useAreas } from '@/contexts/AreasContext';
import { usePuestos } from '@/contexts/PuestosContext';
import { useActividades, type Actividad } from '@/contexts/ActividadesContext';
import type { CapturedProcess } from '../../procesos-y-flujos-registrados/page';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const CAPTURED_DATA_LOCAL_STORAGE_KEY = 'proceza-captured-data';

interface TreeNode {
  id: string;
  name: string;
  type: 'area' | 'puesto' | 'proceso';
  children?: TreeNode[];
  originalId?: string; 
  activities?: Actividad[]; 
}

type AssignmentCountFilterType = 'all' | 'unassigned' | 'assigned_once' | 'assigned_multiple';
type ActivityStatusFilterType = 'all' | 'active' | 'inactive';

export default function PanelJerarquicoPage() {
  const { areas, isLoading: isLoadingAreas } = useAreas();
  const { puestos, isLoadingPuestos } = usePuestos();
  const { actividades, updateActividad, isLoadingActividades } = useActividades();
  
  const [capturedProcesses, setCapturedProcesses] = useState<CapturedProcess[]>([]);
  const [isLoadingProcesses, setIsLoadingProcesses] = useState(true);

  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [draggedActivity, setDraggedActivity] = useState<{ activityId: string; sourceProcessId?: string } | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const [activitySearchTerm, setActivitySearchTerm] = useState('');
  const [assignmentCountFilter, setAssignmentCountFilter] = useState<AssignmentCountFilterType>('all');
  const [activityStatusFilter, setActivityStatusFilter] = useState<ActivityStatusFilterType>('active');


  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('all');
  const [selectedPuestoFilter, setSelectedPuestoFilter] = useState<string>('all');
  const [treeActivitySearchTerm, setTreeActivitySearchTerm] = useState('');
  const [filterByActivityId, setFilterByActivityId] = useState<string | null>(null);
  const [filteredByActivityName, setFilteredByActivityName] = useState<string | null>(null);

  const [repeatedActivitiesCount, setRepeatedActivitiesCount] = useState(0);
  const [repeatedProcessesInMultipleContextsCount, setRepeatedProcessesInMultipleContextsCount] = useState(0);


  useEffect(() => {
    try {
      const storedData = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
      if (storedData) {
        setCapturedProcesses(JSON.parse(storedData).filter((p: CapturedProcess) => !p.deletedAt));
      }
    } catch (error) {
      console.error("Error loading processes from localStorage:", error);
      toast({ title: "Error al cargar procesos", variant: "destructive" });
    } finally {
      setIsLoadingProcesses(false);
    }
  }, []);

  const isLoadingAllData = isLoadingAreas || isLoadingPuestos || isLoadingProcesses || isLoadingActividades;

  useEffect(() => {
    if (isLoadingAllData) return;

    // Calculate repeated activities
    const rptActivities = actividades.filter(act => act.activa && (act.procesosAsociadosCount || 0) > 1).length;
    setRepeatedActivitiesCount(rptActivities);

    // Calculate repeated processes in multiple contexts
    const activeCapturedProcesses = capturedProcesses.filter(p => !p.deletedAt);
    const processContexts = new Map<string, Set<string>>();

    activeCapturedProcesses.forEach(proc => {
        if (!processContexts.has(proc.proceso)) {
            processContexts.set(proc.proceso, new Set());
        }
        processContexts.get(proc.proceso)!.add(`${proc.area}|${proc.puesto}`);
    });

    let rptProcessesCount = 0;
    processContexts.forEach(contexts => {
        if (contexts.size > 1) {
            rptProcessesCount++;
        }
    });
    setRepeatedProcessesInMultipleContextsCount(rptProcessesCount);


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

      capturedProcesses.forEach(proc => {
        if (targetActivityForFiltering && !targetActivityForFiltering.procesosAsociadosIds?.includes(proc.id)) {
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
                return; // Skip if area filter is active and this process doesn't match
            }
             if (filterByActivityId && targetAreaId !== (procAreaObject?.id || 'area-unassigned')) {
                 return; // Skip if filtering by activity and this process's area is not the one being built
             }
        }


        
        const currentAreaNode = areaNodesMap[targetAreaId];
        if (!currentAreaNode) return; // Ensure currentAreaNode exists before proceeding


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
            const originalAssignedActsForSearch = actividades.filter(act => act.procesosAsociadosIds?.includes(proc.id));
            const anyOriginalActivityNameMatches = originalAssignedActsForSearch.some(act => act.nombre.toLowerCase().includes(searchTermLower));
            if (!processNameMatches && !anyOriginalActivityNameMatches) {
                return; 
            }
        }
        
        const targetPuestoIdKey = procPuestoObject?.id || `puesto-unassigned-in-${targetAreaId}`;
        const targetPuestoName = proc.puesto || 'Procesos Sin Puesto Específico';

        if (!currentAreaNode.puestosMap[targetPuestoIdKey]) {
            currentAreaNode.puestosMap[targetPuestoIdKey] = {
                id: `puesto-${currentAreaNode.id}-${procPuestoObject?.id || targetPuestoName.replace(/\s+/g, '-')}`,
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
              if (targetActivityForFiltering) {
                  activitiesForNode = targetActivityForFiltering.procesosAsociadosIds?.includes(proc.id) ? [targetActivityForFiltering] : [];
              } else {
                  activitiesForNode = actividades.filter(act => act.procesosAsociadosIds?.includes(proc.id));
                  if (treeActivitySearchTerm) { 
                    const searchTermLower = treeActivitySearchTerm.toLowerCase();
                    // Filter activities within the process node if tree search term is active
                    const matchingActivities = activitiesForNode.filter(act => act.nombre.toLowerCase().includes(searchTermLower));
                    // If process name also matches, include all its activities, otherwise only matching ones
                    if (proc.proceso.toLowerCase().includes(searchTermLower)) {
                        // Keep all original activitiesForNode if process name matches, then filter those if necessary or add distinct matching ones.
                        // This part can be complex if both process and activity names need to match.
                        // For simplicity now, if process matches, show all its activities; if only activity matches, show only that.
                        // The logic below already filters processes based on name or activity name.
                        // So, here we just ensure the activities are correctly populated or filtered based on the context.
                         activitiesForNode = actividades.filter(act => act.procesosAsociadosIds?.includes(proc.id) && act.nombre.toLowerCase().includes(searchTermLower));
                         if (!proc.proceso.toLowerCase().includes(searchTermLower) && activitiesForNode.length === 0) {
                            // if process name doesnt match and no activities match, this process node shouldn't be here.
                         } else if (proc.proceso.toLowerCase().includes(searchTermLower)) {
                             activitiesForNode = actividades.filter(act => act.procesosAsociadosIds?.includes(proc.id)); // Show all activities for this process
                         }

                    } else {
                         activitiesForNode = activitiesForNode.filter(act => act.nombre.toLowerCase().includes(searchTermLower));
                    }

                  }
              }
              
              return {
                id: `proceso-${proc.id}`, name: proc.proceso, type: 'proceso', originalId: proc.id, activities: activitiesForNode,
              };
            }).sort((a,b) => a.name.localeCompare(b.name));
            
            let finalProcessNodesForPuesto: TreeNode[];
            if (targetActivityForFiltering) {
                finalProcessNodesForPuesto = processTreeNodes.filter(ptn => ptn.activities && ptn.activities.length > 0);
            } else if (treeActivitySearchTerm) {
                const searchTermLower = treeActivitySearchTerm.toLowerCase();
                finalProcessNodesForPuesto = processTreeNodes.filter(ptn => 
                    ptn.name.toLowerCase().includes(searchTermLower) || // Process name matches
                    (ptn.activities && ptn.activities.some(act => act.nombre.toLowerCase().includes(searchTermLower))) // Or any activity name matches
                );
            }
            else {
                finalProcessNodesForPuesto = processTreeNodes;
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
    selectedAreaFilter, selectedPuestoFilter, treeActivitySearchTerm, filterByActivityId
  ]);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>, activityId: string, sourceProcessId?: string) => {
    const activity = actividades.find(a => a.id === activityId);
    if (!activity || !activity.activa) { // Prevent dragging inactive activities
        e.preventDefault();
        toast({ title: "Acción no permitida", description: "Las actividades inactivas no se pueden asignar.", variant: "default" });
        return;
    }
    setDraggedActivity({ activityId, sourceProcessId });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", activityId); 
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  
  const handleDragEnter = (e: DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    setDropTargetId(targetId);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if ((e.target as HTMLElement).id === dropTargetId || (e.relatedTarget && !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node))) {
       setDropTargetId(null);
    }
  };

  const handleDropOnProcess = (targetProcessId: string) => {
    if (!draggedActivity) return;
    const { activityId, sourceProcessId } = draggedActivity;
    const activity = actividades.find(a => a.id === activityId);
    if (!activity || !activity.activa) { // Double check, though dragStart should prevent
        toast({ title: "Acción no permitida", description: "No se pueden asignar actividades inactivas.", variant: "default" });
        setDraggedActivity(null);
        setDropTargetId(null);
        return;
    }

    let newProcesosAsociadosIds = [...(activity.procesosAsociadosIds || [])];

    if (sourceProcessId && sourceProcessId !== targetProcessId) {
      newProcesosAsociadosIds = newProcesosAsociadosIds.filter(id => id !== sourceProcessId);
    }

    if (!newProcesosAsociadosIds.includes(targetProcessId)) {
      newProcesosAsociadosIds.push(targetProcessId);
    }
    
    updateActividad(activityId, { ...activity, procesosAsociadosIds: newProcesosAsociadosIds });
    toast({ title: "Actividad Asignada", description: `"${activity.nombre}" asignada al proceso.` });
    setDraggedActivity(null);
    setDropTargetId(null);
  };

  const handleDropOnPool = () => {
    if (!draggedActivity || !draggedActivity.sourceProcessId) return; 
    const { activityId, sourceProcessId } = draggedActivity;
    const activity = actividades.find(a => a.id === activityId);
    if (!activity) return;

    const newProcesosAsociadosIds = (activity.procesosAsociadosIds || []).filter(id => id !== sourceProcessId);
    
    updateActividad(activityId, { ...activity, procesosAsociadosIds: newProcesosAsociadosIds });
    toast({ title: "Actividad Desasignada", description: `"${activity.nombre}" desasignada del proceso.` });
    setDraggedActivity(null);
    setDropTargetId(null);
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


  const renderTree = (nodes: TreeNode[]): JSX.Element[] => {
    return nodes.map(node => (
      <div key={node.id} className="ml-4">
        <div 
          className={cn(
            "flex items-center py-1 px-2 rounded hover:bg-muted/50",
            node.type === 'proceso' && "border-l-2 border-transparent",
            node.type === 'proceso' && dropTargetId === node.id && "bg-primary/20 border-primary"
          )}
          onDragOver={node.type === 'proceso' ? handleDragOver : undefined}
          onDrop={node.type === 'proceso' ? () => handleDropOnProcess(node.originalId!) : undefined}
          onDragEnter={node.type === 'proceso' ? (e) => handleDragEnter(e, node.id) : undefined}
          onDragLeave={node.type === 'proceso' ? handleDragLeave : undefined}
          id={node.id}
        >
          <Button variant="ghost" size="sm" onClick={() => toggleNode(node.id)} className="p-1 h-auto mr-1">
            {node.children || node.activities ? (expandedNodes[node.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <span className="w-4 inline-block"></span>}
          </Button>
          <span className={cn("text-sm", node.type === 'proceso' && "font-semibold", node.type === 'area' && "font-bold", node.type === 'puesto' && "font-medium")}>{node.name}</span>
        </div>
        {expandedNodes[node.id] && (
          <>
            {node.children && renderTree(node.children)}
            {node.activities && (
              <div className="ml-8 mt-1 space-y-1">
                {node.activities.map(act => (
                  <div 
                    key={act.id} 
                    draggable={act.activa} // Only active activities are draggable from the tree
                    onDragStart={(e) => act.activa ? handleDragStart(e, act.id, node.originalId) : e.preventDefault()}
                    className={cn(
                        "flex items-center p-1.5 bg-secondary/30 rounded text-xs",
                        act.activa ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed opacity-70",
                        !act.activa && "italic text-muted-foreground"
                    )}
                    title={!act.activa ? "Esta actividad está inactiva" : act.nombre}
                  >
                    <GripVertical className={cn("h-3 w-3 mr-1.5", act.activa ? "text-muted-foreground" : "text-transparent")}/>
                    {act.nombre}
                    {!act.activa && <Ban className="h-3 w-3 ml-auto text-destructive" />}
                  </div>
                ))}
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
        // 'all' shows both

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
      .map(procId => capturedProcesses.find(cp => cp.id === procId)?.proceso || `ID: ${procId} (no encontrado)`)
      .join(', ');
  };


  if (isLoadingAllData) {
    return (
        <div className="container mx-auto py-8">
         <Card className="shadow-lg">
            <CardHeader>
                <div className="flex items-center gap-2 mb-1">
                <FolderTree className="h-6 w-6 text-primary" />
                <CardTitle className="text-2xl font-headline">Panel Jerárquico de Procesos y Actividades</CardTitle>
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
            <CardTitle className="text-2xl font-headline">Panel Jerárquico de Procesos y Actividades</CardTitle>
          </div>
          <CardDescription className="mb-4">
            Arrastre actividades activas desde el panel derecho (Pool) hacia los procesos en el árbol izquierdo para asignarlas.
            También puede mover actividades entre procesos o de un proceso de vuelta al pool para desasignarlas.
            Haga clic en el contador de procesos de una actividad en el pool para filtrar el árbol por esa actividad. Las actividades inactivas se muestran con un estilo diferente y no son arrastrables.
          </CardDescription>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Procesos con Variaciones</CardTitle>
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                    <div className="text-2xl font-bold">{repeatedProcessesInMultipleContextsCount}</div>
                    <p className="text-xs text-muted-foreground">
                        Mismo nombre de proceso en &gt;1 Área/Puesto.
                    </p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Actividades Duplicadas</CardTitle>
                    <CopyCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                    <div className="text-2xl font-bold">{repeatedActivitiesCount}</div>
                    <p className="text-xs text-muted-foreground">
                        Asignadas a más de un proceso (activas).
                    </p>
                    </CardContent>
                </Card>
            </div>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6 min-h-[calc(50vh+120px)]">
          <Card>
            <CardHeader className="space-y-3">
              <CardTitle className="text-lg">Árbol de Procesos</CardTitle>
              <CardDescription className="text-xs">Expanda para ver puestos, procesos y actividades asignadas. Filtre por área, puesto o actividad/proceso.</CardDescription>
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
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(40vh)] p-1 border rounded-md">
                {treeData.length > 0 ? renderTree(treeData) : 
                  <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <FolderTree className="h-12 w-12 text-muted-foreground mb-2"/>
                    <p className="text-muted-foreground">
                      No hay procesos para mostrar.
                    </p>
                     <p className="text-xs text-muted-foreground">
                      Verifique filtros o la configuración de áreas, puestos y procesos capturados.
                    </p>
                  </div>
                }
              </ScrollArea>
            </CardContent>
          </Card>
          
          <Card 
            id="activity-pool"
            className={cn("flex flex-col", dropTargetId === 'activity-pool' && "bg-destructive/20 border-destructive")}
            onDragOver={handleDragOver}
            onDrop={handleDropOnPool}
            onDragEnter={(e) => handleDragEnter(e, 'activity-pool')}
            onDragLeave={handleDragLeave}
          >
            <CardHeader>
              <CardTitle className="text-lg">Pool de Actividades</CardTitle>
               <CardDescription className="text-xs">Actividades disponibles para asignar. Filtre o busque para refinar.</CardDescription>
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
                <div className="sm:col-span-2"> {/* Span full width on small screens if only two filters, or adjust as needed */}
                  <Select value={assignmentCountFilter} onValueChange={(value) => setAssignmentCountFilter(value as AssignmentCountFilterType)}>
                    <SelectTrigger className="w-full">
                      <FilterIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Filtrar por asignación" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas (Asignación) ({actividades.filter(a => a.activa).length})</SelectItem>
                      <SelectItem value="unassigned">No asignadas ({unassignedCount})</SelectItem>
                      <SelectItem value="assigned_once">Asignadas a 1 proc. ({assignedOnceCount})</SelectItem>
                      <SelectItem value="assigned_multiple">Asignadas a 2+ proc. ({assignedMultipleCount})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col">
              <ScrollArea className="flex-grow h-[calc(45vh-110px)] p-1 border rounded-md"> {/* Adjusted height */}
                {availableActivities.length > 0 ? (
                  <div className="space-y-2">
                    {availableActivities.map(act => (
                      <div 
                        key={act.id} 
                        draggable={act.activa} // Only active activities are draggable from pool
                        onDragStart={(e) => act.activa ? handleDragStart(e, act.id) : e.preventDefault()}
                        className={cn(
                            "flex items-center p-2 bg-card border rounded shadow-sm text-sm hover:shadow-md",
                            act.activa ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed opacity-60",
                            !act.activa && "italic text-muted-foreground"
                        )}
                        title={!act.activa ? "Esta actividad está inactiva. Actívela para asignarla." : (act.procesosAsociadosCount > 0 ? `Asignada a: ${getProcessNamesForActivity(act)}` : 'No asignada a procesos')}
                      >
                        <GripVertical className={cn("h-4 w-4 mr-2", act.activa ? "text-muted-foreground" : "text-transparent")}/>
                        {act.nombre}
                        {!act.activa && <Ban className="h-3 w-3 ml-1 text-destructive" />}
                        {act.procesosAsociadosCount > 0 && 
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className={cn(
                              "p-1 h-auto text-xs ml-auto",
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
        </CardContent>
      </Card>
       <div className="mt-4 text-xs text-muted-foreground text-center">
        Nota: La funcionalidad de arrastrar y soltar (drag & drop) se implementa con HTML5 nativo.
      </div>
    </div>
  );
}

