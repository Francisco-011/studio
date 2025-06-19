import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";

export default function AccionesPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-2">
          <Target className="h-6 w-6 text-primary" />
          <CardTitle className="text-2xl font-headline">Acciones de Mejora</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Módulo dedicado al seguimiento y gestión de las acciones de mejora, desde su planificación hasta su resolución.
          </p>
          <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[300px] bg-muted/20">
            <Target className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold text-foreground">Seguimiento de Acciones</p>
            <p className="text-sm text-muted-foreground">Próximamente: registro de acciones, asignación de responsables, estados y cuantificación de ahorros.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
