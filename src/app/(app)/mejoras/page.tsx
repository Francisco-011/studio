import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Lightbulb } from "lucide-react";

export default function MejorasPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          <CardTitle className="text-2xl font-headline">Mejoras (Oportunidades)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Detecta automáticamente ineficiencias, duplicidades y oportunidades de mejora dentro de los procesos empresariales.
          </p>
          <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[300px] bg-muted/20">
            <Lightbulb className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold text-foreground">Detección de Oportunidades</p>
            <p className="text-sm text-muted-foreground">Próximamente: alertas de duplicidades, sistemas redundantes, y análisis de costos con IA.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
