
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { runSeed } from '@/app/actions/seed';
import { Input } from '@/components/ui/input';

export default function CargaMasivaPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [confirmationText, setConfirmationText] = useState("");
    const CONFIRMATION_PHRASE = "LIMPIAR DATOS";

    const handleAction = async () => {
        setIsLoading(true);
        try {
            const result = await runSeed();
            if (result.success) {
                toast({
                    title: "Operación Completada",
                    description: "La base de datos ha sido limpiada exitosamente.",
                });
            } else {
                toast({
                    title: "Error en la Operación",
                    description: result.message,
                    variant: "destructive",
                });
            }
        } catch (error: any) {
            toast({
                title: "Error Crítico",
                description: `Ocurrió un error inesperado: ${error.message}`,
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
            setConfirmationText("");
        }
    };

    return (
        <div className="container mx-auto py-8">
            <Card className="shadow-lg max-w-3xl mx-auto border-destructive">
                <CardHeader>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="flex-shrink-0 bg-destructive/10 text-destructive p-3 rounded-full">
                           <AlertTriangle className="h-6 w-6" />
                        </div>
                        <div>
                           <CardTitle className="text-2xl font-headline text-destructive">Zona de Peligro: Limpiar Base de Datos</CardTitle>
                           <CardDescription className="text-destructive/80">
                                Esta acción es irreversible y eliminará TODOS los datos de TODAS las colecciones.
                           </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm">
                        Utilice esta herramienta únicamente si desea reiniciar completamente el sistema a un estado vacío. Se borrarán permanentemente procesos, usuarios, políticas, configuraciones y cualquier otra información que haya sido registrada.
                    </p>
                    <p className="text-sm font-semibold">
                        Esta acción no se puede deshacer. Proceda con extrema precaución.
                    </p>
                    
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="w-full sm:w-auto">
                                <Trash2 className="mr-2 h-4 w-4" /> Proceder a la Limpieza de Datos
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Está absolutamente seguro?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta acción eliminará permanentemente todos los datos, incluyendo usuarios, procesos y configuraciones. 
                                    Para confirmar, escriba <strong className="text-foreground">{CONFIRMATION_PHRASE}</strong> en el campo de abajo.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <Input
                                value={confirmationText}
                                onChange={(e) => setConfirmationText(e.target.value)}
                                placeholder={`Escriba "${CONFIRMATION_PHRASE}" para confirmar`}
                            />
                            <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setConfirmationText("")}>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleAction}
                                    disabled={isLoading || confirmationText !== CONFIRMATION_PHRASE}
                                    className="bg-destructive hover:bg-destructive/90"
                                >
                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                    Sí, limpiar todos los datos
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                </CardContent>
            </Card>
        </div>
    );
}
