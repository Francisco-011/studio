import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListChecks } from "lucide-react";

export default function ActividadesPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-2">
          <ListChecks className="h-6 w-6 text-primary" />
          <CardTitle className="text-2xl font-headline">Gestión de Actividades</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Proporciona una administración centralizada de todas las actividades granulares utilizadas en los procesos.
          </p>
          <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[300px] bg-muted/20">
            <ListChecks className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold text-foreground">Listado y Gestión de Actividades</p>
            <p className="text-sm text-muted-foreground">Próximamente: creación, edición, activación/inactivación y filtros de actividades.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
