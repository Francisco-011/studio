import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database } from "lucide-react";

export default function DatosCapturadosPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          <CardTitle className="text-2xl font-headline">Datos Capturados</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Proporciona una vista unificada de todos los procesos y flujos de información registrados en el sistema.
          </p>
          <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[300px] bg-muted/20">
            <Database className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold text-foreground">Vista de Procesos y Flujos</p>
            <p className="text-sm text-muted-foreground">Próximamente: tabla de datos con filtros avanzados, edición, y opciones de exportación.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
