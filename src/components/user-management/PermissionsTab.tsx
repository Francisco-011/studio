
'use client';

import { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from '@/hooks/use-toast';
import { Loader2, Save } from "lucide-react";

import { useActivityLog } from '@/contexts/ActivityLogContext';
import { usePermissions, PERMISSION_CONFIG } from '@/contexts/PermissionsContext';

const userRoles = ["Administrador", "Gerente de Proyecto", "Consultor", "Usuario Final"] as const;
type UserRole = typeof userRoles[number];
type ModuleKey = keyof typeof PERMISSION_CONFIG;

export default function PermissionsTab() {
  const { addLogEntry } = useActivityLog();
  const { rolePermissions, setRolePermissions, isLoadingPermissions } = usePermissions();
  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState<UserRole>('Gerente de Proyecto');

  const handlePermissionChange = (moduleKey: string, permissionKey: string, checked: boolean) => {
    setRolePermissions(prev => ({
      ...prev,
      [selectedRoleForPerms]: {
        ...prev[selectedRoleForPerms],
        [`${moduleKey}:${permissionKey}`]: checked,
      },
    }));
  };

  const handleSavePermissions = async () => {
    if (!rolePermissions[selectedRoleForPerms]) {
      toast({ title: "Error", description: `No hay permisos definidos para el rol ${selectedRoleForPerms}`, variant: "destructive" });
      return;
    }
    try {
      const roleDocRef = doc(db, 'permissions', selectedRoleForPerms);
      await setDoc(roleDocRef, rolePermissions[selectedRoleForPerms]);
      toast({ title: 'Permisos Guardados', description: `Los permisos para el rol '${selectedRoleForPerms}' han sido actualizados.` });
      addLogEntry({ action: 'update', entityType: 'Permisos de Rol', entityName: selectedRoleForPerms, details: `Se actualizaron los permisos para el rol "${selectedRoleForPerms}".` });
    } catch (e) {
      console.error("Error saving permissions:", e);
      toast({ title: "Error al Guardar", description: "No se pudieron guardar los permisos.", variant: "destructive" });
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-6">
        <div className="flex-grow">
          <Label htmlFor="role-select">Seleccionar Rol a Editar</Label>
          <Select value={selectedRoleForPerms} onValueChange={(value) => setSelectedRoleForPerms(value as UserRole)}>
            <SelectTrigger id="role-select"><SelectValue placeholder="Seleccione un rol..." /></SelectTrigger>
            <SelectContent>{userRoles.map(role => (<SelectItem key={role} value={role}>{role}</SelectItem>))}</SelectContent>
          </Select>
        </div>
        <Button onClick={handleSavePermissions}><Save className="mr-2 h-4 w-4" /> Guardar Permisos para este Rol</Button>
      </div>

      {isLoadingPermissions ? (<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>) : (
        <Accordion type="multiple" className="w-full" defaultValue={Object.keys(PERMISSION_CONFIG)}>
          {(Object.keys(PERMISSION_CONFIG) as ModuleKey[]).map(moduleKey => (
            <AccordionItem value={moduleKey} key={moduleKey}>
              <AccordionTrigger>{PERMISSION_CONFIG[moduleKey].label}</AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-2">
                  {Object.entries(PERMISSION_CONFIG[moduleKey].permissions).map(([permissionKey, permissionLabel]) => (
                    <div key={`${moduleKey}-${permissionKey}`} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${moduleKey}-${permissionKey}`}
                        checked={rolePermissions[selectedRoleForPerms]?.[`${moduleKey}:${permissionKey}`] || false}
                        onCheckedChange={(checked) => handlePermissionChange(moduleKey, permissionKey, !!checked)}
                        disabled={selectedRoleForPerms === 'Administrador'}
                      />
                      <label htmlFor={`${moduleKey}-${permissionKey}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{permissionLabel}</label>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </>
  );
}
