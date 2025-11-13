
'use client';

import { useState, useMemo, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, Loader2, CalendarIcon, AlertTriangle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

import { useProcesos } from '@/contexts/ProcesosContext';
import { usePoliticas } from '@/contexts/PoliticasContext';
import { useExceptions, type AccessException } from '@/contexts/ExceptionsContext';
import { onSnapshot, collection, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';

import type { ExceptionFormData } from '@/types/users';
import { exceptionFormSchema } from '@/types/users';

interface UserForSelect {
  id: string;
  nombreCompleto: string;
}

export default function ExceptionsTab() {
  const { exceptions, addException, deleteException, isLoadingExceptions } = useExceptions();
  const { procesos, isLoadingProcesos } = useProcesos();
  const { politicas, isLoadingPoliticas } = usePoliticas();
  const [usersForSelect, setUsersForSelect] = useState<UserForSelect[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  const [isExceptionDialogOpen, setIsExceptionDialogOpen] = useState(false);
  const [exceptionToDelete, setExceptionToDelete] = useState<AccessException | null>(null);
  const [isConfirmDeleteExceptionOpen, setIsConfirmDeleteExceptionOpen] = useState(false);

  useEffect(() => {
    setIsLoadingUsers(true);
    const q = query(collection(db, "users"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsersForSelect(snapshot.docs.map(doc => ({ id: doc.id, nombreCompleto: doc.data().nombreCompleto })));
      setIsLoadingUsers(false);
    });
    return () => unsubscribe();
  }, []);

  const exceptionForm = useForm<ExceptionFormData>({ resolver: zodResolver(exceptionFormSchema) });
  const watchedDocType = exceptionForm.watch('documentType');

  const availableDocuments = useMemo(() => {
    if (watchedDocType === 'politica') return politicas.map(p => ({ id: p.id, name: `${p.codigo} - ${p.titulo}` }));
    if (watchedDocType === 'proceso') return procesos.filter(p => !p.deletedAt).map(p => ({ id: p.id, name: p.proceso }));
    return [];
  }, [watchedDocType, politicas, procesos]);

  useEffect(() => {
    exceptionForm.reset({ ...exceptionForm.getValues(), documentId: undefined });
  }, [watchedDocType, exceptionForm]);

  async function handleExceptionSubmit(data: ExceptionFormData) {
    await addException({
      ...data,
      expiresAt: data.expiresAt ? data.expiresAt.toISOString() : undefined,
    });
    setIsExceptionDialogOpen(false);
    exceptionForm.reset();
  }

  function promptDeleteException(exception: AccessException) {
    setExceptionToDelete(exception);
    setIsConfirmDeleteExceptionOpen(true);
  }

  function executeDeleteException() {
    if (!exceptionToDelete) return;
    deleteException(exceptionToDelete.id);
    setExceptionToDelete(null);
    setIsConfirmDeleteExceptionOpen(false);
  }

  const isLoading = isLoadingExceptions || isLoadingProcesos || isLoadingPoliticas || isLoadingUsers;

  return (
    <>
      <div className="flex justify-end mb-4"><Button onClick={() => setIsExceptionDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Crear Excepción</Button></div>
      {isLoading ? (<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Usuario</TableHead><TableHead>Tipo Excepción</TableHead><TableHead>Documento</TableHead><TableHead>Vence el</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
            <TableBody>
              {exceptions.length > 0 ? exceptions.map(ex => {
                const user = usersForSelect.find(u => u.id === ex.userId);
                const docName = ex.documentType === 'politica' ? politicas.find(p => p.id === ex.documentId)?.titulo : procesos.find(p => p.id === ex.documentId)?.proceso;
                return (
                  <TableRow key={ex.id}>
                    <TableCell>{user?.nombreCompleto || ex.userId}</TableCell>
                    <TableCell><Badge variant={ex.exceptionType === 'INCLUDE' ? 'default' : 'destructive'}>{ex.exceptionType === 'INCLUDE' ? 'Permitir' : 'Denegar'}</Badge></TableCell>
                    <TableCell><p className="font-medium">{docName || ex.documentId}</p><p className="text-xs text-muted-foreground capitalize">{ex.documentType}</p></TableCell>
                    <TableCell>{ex.expiresAt ? format(parseISO(ex.expiresAt), 'dd MMM yyyy', { locale: es }) : 'Permanente'}</TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => promptDeleteException(ex)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                )
              }) : (<TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No hay excepciones de acceso definidas.</TableCell></TableRow>)}
            </TableBody>
          </Table>
        </div>
      )}
      <Dialog open={isExceptionDialogOpen} onOpenChange={setIsExceptionDialogOpen}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Crear Excepción de Acceso</DialogTitle><DialogDescription>Otorgue o revoque acceso a un documento para un usuario.</DialogDescription></DialogHeader>
          <Form {...exceptionForm}><form onSubmit={exceptionForm.handleSubmit(handleExceptionSubmit)} className="space-y-4 py-4">
            <FormField control={exceptionForm.control} name="userId" render={({ field }) => (<FormItem><FormLabel>Usuario</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger></FormControl><SelectContent>{usersForSelect.map(u => <SelectItem key={u.id} value={u.id}>{u.nombreCompleto}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={exceptionForm.control} name="documentType" render={({ field }) => (<FormItem><FormLabel>Tipo Documento</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="politica">Política</SelectItem><SelectItem value="proceso">Proceso</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={exceptionForm.control} name="documentId" render={({ field }) => (<FormItem><FormLabel>Documento</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!watchedDocType}><FormControl><SelectTrigger><SelectValue placeholder={!watchedDocType ? "Tipo primero" : "Seleccione..."} /></SelectTrigger></FormControl><SelectContent>{availableDocuments.map(doc => <SelectItem key={doc.id} value={doc.id}>{doc.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            </div>
            <FormField control={exceptionForm.control} name="exceptionType" render={({ field }) => (<FormItem><FormLabel>Tipo Excepción</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="INCLUDE">Permitir Acceso</SelectItem><SelectItem value="EXCLUDE">Denegar Acceso</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={exceptionForm.control} name="expiresAt" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Vencimiento (Opcional)</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className="font-normal">{field.value ? format(field.value, 'PPP', { locale: es }) : <span>Permanente</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
            <FormField control={exceptionForm.control} name="justification" render={({ field }) => (<FormItem><FormLabel>Justificación</FormLabel><FormControl><Textarea placeholder="Ej: Acceso temporal para proyecto X." {...field} /></FormControl><FormMessage /></FormItem>)} />
            <DialogFooter><Button type="button" variant="outline" onClick={() => setIsExceptionDialogOpen(false)}>Cancelar</Button><Button type="submit">Crear Excepción</Button></DialogFooter>
          </form></Form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isConfirmDeleteExceptionOpen} onOpenChange={setIsConfirmDeleteExceptionOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle><div className="flex items-center"><AlertTriangle className="h-5 w-5 mr-2 text-destructive" />Confirmar Eliminación</div></AlertDialogTitle><AlertDialogDescription>¿Seguro que desea eliminar esta regla de excepción?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setExceptionToDelete(null)}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={executeDeleteException} className={buttonVariants({ variant: "destructive" })}>Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </>
  );
}
