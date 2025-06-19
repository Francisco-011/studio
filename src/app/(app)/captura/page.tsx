import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardEdit } from "lucide-react";

export default function CapturaPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-2">
          <ClipboardEdit className="h-6 w-6 text-primary" />
          <CardTitle className="text-2xl font-headline">Módulo de Captura</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Este es el punto de entrada principal para registrar de forma detallada todos los procesos operativos y sus flujos de información asociados.
          </p>
          <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[300px] bg-muted/20">
            <ClipboardEdit className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold text-foreground">Formulario de Captura de Procesos</p>
            <p className="text-sm text-muted-foreground">Próximamente: campos para Área, Puesto, Proceso, Descripción, Sistemas, Actividades y Flujo de Información.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
