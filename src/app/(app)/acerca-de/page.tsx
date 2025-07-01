
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, Copyright, Building, User } from "lucide-react";

export default function AcercaDePage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <Info className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl font-headline">Acerca de PROSCENDIA</CardTitle>
          </div>
          <CardDescription>
            Process + Ascend: Eleva tus Procesos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          <div className="space-y-2">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Building className="h-5 w-5 text-muted-foreground" />
              Propósito del Sistema
            </h3>
            <p>
              <strong>PROSCENDIA</strong> es una herramienta de software diseñada y desarrollada a medida para el uso exclusivo e interno de <strong>STUFFACTORY</strong>. Su objetivo principal es centralizar, estandarizar y optimizar la gestión de los procesos de negocio de la organización.
            </p>
            <p>
              PROSCENDIA facilita la captura de conocimiento, el análisis de ineficiencias, la gobernanza de políticas y la toma de decisiones basada en datos, impulsando la mejora continua en todas las áreas de la compañía.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              Desarrollo
            </h3>
            <p>
              Este sistema fue conceptualizado, diseñado y desarrollado por <strong>Francisco Rivera Almazán</strong> como una solución estratégica para las necesidades operativas de STUFFACTORY.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Copyright className="h-5 w-5 text-muted-foreground" />
              Derechos de Autor
            </h3>
            <p>
              <strong>PROSCENDIA v1.0</strong><br />
              © 2025 Francisco Rivera Almazán. Todos los derechos reservados.<br />
              Desarrollado para uso interno de STUFFACTORY.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
