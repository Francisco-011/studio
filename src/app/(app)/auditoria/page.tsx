import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History } from "lucide-react";

export default function AuditoriaPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-2">
          <History className="h-6 w-6 text-primary" />
          <CardTitle className="text-2xl font-headline">Módulo de Auditoría</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Mantiene un registro inmutable y completo de todas las acciones significativas realizadas dentro del sistema.
          </p>
          <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[300px] bg-muted/20">
            <History className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold text-foreground">Registro de Auditoría</p>
            <p className="text-sm text-muted-foreground">Próximamente: historial detallado de cambios con filtros por usuario, tipo de acción y fecha.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
