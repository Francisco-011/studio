import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivitySquare } from "lucide-react";

export default function AnalisisPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-2">
          <ActivitySquare className="h-6 w-6 text-primary" />
          <CardTitle className="text-2xl font-headline">Matriz de Análisis Transversal</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Visualiza las relaciones entre actividades y áreas, identificando patrones y posibles superposiciones.
          </p>
          <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[300px] bg-muted/20">
            <ActivitySquare className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold text-foreground">Matriz de Actividades</p>
            <p className="text-sm text-muted-foreground">Próximamente: tabla interactiva con áreas y actividades, resaltado de duplicidades y filtros.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
