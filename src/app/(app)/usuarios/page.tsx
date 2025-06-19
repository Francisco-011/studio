import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function UsuariosPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          <CardTitle className="text-2xl font-headline">Módulo de Usuarios</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Administra las cuentas de usuario, sus roles y los permisos de acceso dentro del sistema.
          </p>
           <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[300px] bg-muted/20">
            <Users className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold text-foreground">Gestión de Cuentas de Usuario</p>
            <p className="text-sm text-muted-foreground">Próximamente: listado de usuarios, creación, edición y asignación de roles.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
