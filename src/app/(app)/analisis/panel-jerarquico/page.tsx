
'use client';

import { useState, useEffect, useMemo, type DragEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, ChevronDown, GripVertical, FolderTree, ListChecks, Loader2, Search as SearchIcon, Filter as FilterIcon } from "lucide-react";
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
  originalId?: string; // For procesos, to link back to CapturedProcess
  activities?: Actividad[]; // For proceso nodes
}

type AssignmentCountFilterType = 'all' | 'unassigned' | 'assigned_once' | 'assigned_multiple';

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

  useEffect(() => {
    if (isLoadingAreas || isLoadingPuestos || isLoadingProcesses || isLoadingActividades) return;

    const buildTree = (): TreeNode[] => {
      const areaMap: Record<string, TreeNode & { puestosMap: Record<string, TreeNode & { processList: CapturedProcess[] }> }> = {};

      areas.forEach(area => {
        areaMap[area.nombre] = { 
          id: `area-${area.id}`, 
          name: area.nombre, 
          type: 'area', 
          originalId: area.id, 
          children: [],
          puestosMap: {}
        };
      });
      
      const unassignedAreaNode: TreeNode & { puestosMap: Record<string, TreeNode & { processList: CapturedProcess[] }> } = {
        id: 'area-unassigned', name: 'Procesos Sin Área Específica', type: 'area', children: [], puestosMap: {}
      };

      capturedProcesses.forEach(proc => {
        const targetAreaName = proc.area || 'Procesos Sin Área Específica';
        let currentAreaNode = areaMap[targetAreaName];
        if (!currentAreaNode && targetAreaName === 'Procesos Sin Área Específica') {
             if (!areaMap[targetAreaName]) areaMap[targetAreaName] = unassignedAreaNode;
             currentAreaNode = areaMap[targetAreaName];
        } else if (!currentAreaNode) {
            if (!areaMap['Procesos Sin Área Específica']) areaMap['Procesos Sin Área Específica'] = unassignedAreaNode;
            currentAreaNode = areaMap['Procesos Sin Área Específica'];
        }

        const targetPuestoName = proc.puesto || 'Procesos Sin Puesto Específico';
        let currentPuestoNode = currentAreaNode.puestosMap[targetPuestoName];
        if (!currentPuestoNode) {
          const puestoOriginal = puestos.find(p => p.nombre === targetPuestoName && p.areaId === currentAreaNode.originalId);
          currentPuestoNode = {
            id: `puesto-${currentAreaNode.id}-${puestoOriginal?.id || targetPuestoName.replace(/\s+/g, '-')}`,
            name: targetPuestoName,
            type: 'puesto',
            originalId: puestoOriginal?.id,
            children: [],
            processList: []
          };
          currentAreaNode.puestosMap[targetPuestoName] = currentPuestoNode;
          currentAreaNode.children!.push(currentPuestoNode);
        }
        currentPuestoNode.processList.push(proc);
      });
      
      Object.values(areaMap).forEach(areaNode => {
        Object.values(areaNode.puestosMap).forEach(puestoNode => {
          puestoNode.children = puestoNode.processList.map(proc => {
            const assignedActs = actividades.filter(act => act.procesosAsociadosIds?.includes(proc.id));
            return {
              id: `proceso-${proc.id}`,
              name: proc.proceso,
              type: 'proceso',
              originalId: proc.id,
              activities: assignedActs,
            };
          }).sort((a,b) => a.name.localeCompare(b.name));
           puestoNode.children?.sort((a,b) => a.name.localeCompare(b.name));
        });
        areaNode.children?.sort((a,b) => a.name.localeCompare(b.name));
      });
      
      const finalTree = Object.values(areaMap).filter(areaNode => areaNode.children && areaNode.children.length > 0);
      return finalTree.sort((a,b) => a.name.localeCompare(b.name));
    };

    setTreeData(buildTree());
  }, [areas, puestos, capturedProcesses, actividades, isLoadingAreas, isLoadingPuestos, isLoadingProcesses, isLoadingActividades]);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>, activityId: string, sourceProcessId?: string) => {
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
    if (!activity) return;

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
          <span className={cn("text-sm", node.type === 'proceso' && "font-semibold")}>{node.name}</span>
        </div>
        {expandedNodes[node.id] && (
          <>
            {node.children && renderTree(node.children)}
            {node.activities && (
              <div className="ml-8 mt-1 space-y-1">
                {node.activities.map(act => (
                  <div 
                    key={act.id} 
                    draggable 
                    onDragStart={(e) => handleDragStart(e, act.id, node.originalId)}
                    className="flex items-center p-1.5 bg-secondary/30 rounded text-xs cursor-grab active:cursor-grabbing"
                  >
                    <GripVertical className="h-3 w-3 mr-1.5 text-muted-foreground"/>
                    {act.nombre}
                  </div>
                ))}
                 {node.activities.length === 0 && <p className="text-xs text-muted-foreground italic pl-2">Ninguna actividad asignada</p>}
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

  const availableActivities = useMemo(() => {
    return actividades
      .filter(a => {
        if (!a.activa) return false;

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
  }, [actividades, activitySearchTerm, assignmentCountFilter]);

  const isLoading = isLoadingAreas || isLoadingPuestos || isLoadingProcesses || isLoadingActividades;

  if (isLoading) {
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
          <CardDescription>
            Arrastre actividades desde el panel derecho (Pool) hacia los procesos en el árbol izquierdo para asignarlas.
            También puede mover actividades entre procesos o de un proceso de vuelta al pool para desasignarlas.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6 min-h-[60vh]">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Árbol de Procesos</CardTitle>
              <CardDescription className="text-xs">Expanda para ver puestos, procesos y actividades asignadas.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(45vh+74px)] p-1 border rounded-md"> {/* Adjusted height to match activity pool scroll area */}
                {treeData.length > 0 ? renderTree(treeData) : <p className="text-muted-foreground p-4">No hay procesos para mostrar. Verifique la configuración de áreas, puestos y los procesos capturados.</p>}
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
               <div className="mt-4 space-y-3">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Buscar actividad por nombre..."
                    value={activitySearchTerm}
                    onChange={(e) => setActivitySearchTerm(e.target.value)}
                    className="w-full pl-9"
                  />
                </div>
                <div>
                  <Select value={assignmentCountFilter} onValueChange={(value) => setAssignmentCountFilter(value as AssignmentCountFilterType)}>
                    <SelectTrigger className="w-full">
                      <FilterIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Filtrar por asignación" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas ({actividades.filter(a => a.activa).length})</SelectItem>
                      <SelectItem value="unassigned">No asignadas ({unassignedCount})</SelectItem>
                      <SelectItem value="assigned_once">Asignadas a 1 proc. ({assignedOnceCount})</SelectItem>
                      <SelectItem value="assigned_multiple">Asignadas a 2+ proc. ({assignedMultipleCount})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col">
              <ScrollArea className="flex-grow h-[calc(45vh-74px)] p-1 border rounded-md"> {/* Adjusted height based on filters */}
                {availableActivities.length > 0 ? (
                  <div className="space-y-2">
                    {availableActivities.map(act => (
                      <div 
                        key={act.id} 
                        draggable 
                        onDragStart={(e) => handleDragStart(e, act.id)}
                        className="flex items-center p-2 bg-card border rounded shadow-sm text-sm cursor-grab active:cursor-grabbing hover:shadow-md"
                      >
                        <GripVertical className="h-4 w-4 mr-2 text-muted-foreground"/>
                        {act.nombre}
                        {act.procesosAsociadosCount > 0 && <Badge variant="outline" className="ml-auto text-xs">{act.procesosAsociadosCount}P</Badge>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <ListChecks className="h-12 w-12 text-muted-foreground mb-2"/>
                    <p className="text-muted-foreground">
                      {activitySearchTerm || assignmentCountFilter !== 'all' 
                        ? "No hay actividades que coincidan con los filtros."
                        : "No hay actividades disponibles."
                      }
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {!(activitySearchTerm || assignmentCountFilter !== 'all') && "Agréguelas en 'Gestión de Actividades'."}
                    </p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
       <div className="mt-4 text-xs text-muted-foreground text-center">
        Nota: La funcionalidad de arrastrar y soltar (drag & drop) se implementa con HTML5 nativo. Para una experiencia más pulida, se recomendaría una biblioteca especializada como dnd-kit.
      </div>
    </div>
  );
}

