import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";

export default function ConfiguracionPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          <CardTitle className="text-2xl font-headline">Módulo de Configuración</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Centraliza la gestión de las listas maestras y parámetros fundamentales que el sistema utiliza en toda su operativa.
          </p>
          <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[300px] bg-muted/20">
            <Settings className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold text-foreground">Gestión de Listas Maestras</p>
            <p className="text-sm text-muted-foreground">Próximamente: secciones para Áreas, Puestos, Sistemas, Actividades, Costos y Fuentes de Información.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
