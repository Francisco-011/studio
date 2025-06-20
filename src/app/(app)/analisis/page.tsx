
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ActivitySquare } from "lucide-react";

export default function AnalisisMatrizPageRemoved() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-2">
          <ActivitySquare className="h-6 w-6 text-muted-foreground" />
          <CardTitle className="text-2xl font-headline text-muted-foreground">Matriz de Análisis Transversal (Módulo Eliminado)</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="mb-6">
            Este módulo ha sido eliminado. El contenido anterior ya no está disponible.
          </CardDescription>
          <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[300px] bg-muted/20">
            <ActivitySquare className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold text-muted-foreground">
              Módulo "Matriz de Análisis Transversal" no disponible.
            </p>
            <p className="text-sm text-muted-foreground text-center">
              Esta funcionalidad ha sido removida del sistema.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
