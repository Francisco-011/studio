'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LifeBuoy } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function AyudaPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <LifeBuoy className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl font-headline">Manual de Usuario SIAP</CardTitle>
          </div>
          <CardDescription>
            Una guía completa para entender y operar todas las funcionalidades del Sistema Integral de Análisis de Procesos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-250px)]">
            <Accordion type="single" collapsible className="w-full pr-4" defaultValue="item-intro">
              
              <AccordionItem value="item-intro">
                <AccordionTrigger className="text-lg font-semibold">1. Introducción a SIAP</AccordionTrigger>
                <AccordionContent className="space-y-3 text-sm">
                  <h4 className="font-semibold text-base">¿Qué es SIAP?</h4>
                  <p>SIAP (Sistema Integral de Análisis de Procesos) es una herramienta diseñada para ayudarte a mapear, analizar, optimizar y gestionar los procesos de negocio de tu organización. Desde la captura detallada de un flujo de trabajo hasta el análisis con Inteligencia Artificial para detectar ineficiencias, SIAP te proporciona una visión completa y accionable de cómo opera tu empresa.</p>
                  <h4 className="font-semibold text-base">Objetivos y Beneficios</h4>
                  <ul className="list-disc pl-5 space-y-2">
                    <li><strong>Centralizar la Información:</strong> Crear un repositorio único y estandarizado de todos los procesos. Su beneficio es eliminar la dispersión de documentos (Word, Excel, Visio) y asegurar que todos consulten la misma versión de la verdad, facilitando la capacitación y la consistencia.</li>
                    <li><strong>Mejorar la Eficiencia:</strong> Identificar cuellos de botella, duplicidades de tareas y redundancias de sistemas. El beneficio directo es la reducción de costos operativos y la optimización del tiempo de los empleados.</li>
                    <li><strong>Facilitar la Toma de Decisiones:</strong> Proporcionar datos y métricas claras sobre el rendimiento de los procesos (tiempos, costos, frecuencia). Esto permite a la gerencia tomar decisiones estratégicas basadas en datos reales y no en suposiciones.</li>
                    <li><strong>Impulsar la Mejora Continua:</strong> Gestionar y dar seguimiento a las iniciativas de optimización de principio a fin, cuantificando su impacto. El beneficio es la creación de una cultura de mejora continua en la organización.</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-modules">
                <AccordionTrigger className="text-lg font-semibold">2. Descripción de Módulos</AccordionTrigger>
                <AccordionContent className="space-y-4 text-sm">
                  <div className="pt-4 border-t border-dashed first:pt-0 first:border-t-0">
                    <h5 className="font-bold text-primary">Dashboard (Resumen Ejecutivo)</h5>
                    <p className="mt-1"><strong>Función:</strong> Es la pantalla de bienvenida y el centro de mando. Ofrece una vista rápida de los indicadores clave (KPIs) más importantes del sistema.</p>
                    <p className="mt-1"><strong>Beneficios:</strong> Permite tener un pulso rápido de la salud operativa de la organización y sirve como punto de acceso rápido a los dashboards especializados para un análisis más profundo.</p>
                  </div>
                   <div className="pt-4 border-t border-dashed">
                    <h5 className="font-bold text-primary">Captura</h5>
                    <p className="mt-1"><strong>Función:</strong> El corazón del sistema. En este módulo se registran nuevos procesos, detallando quién lo hace (área/puesto), qué hace (descripción), cómo lo hace (métricas de tiempo/costo), qué necesita (entradas) y qué produce (salidas).</p>
                    <p className="mt-1"><strong>Beneficios:</strong> Estandariza la forma en que se documentan los procesos, asegurando que toda la información relevante sea capturada de manera consistente.</p>
                  </div>
                  <div className="pt-4 border-t border-dashed">
                    <h5 className="font-bold text-primary">Procesos Registrados</h5>
                    <p className="mt-1"><strong>Función:</strong> Un centro de gestión donde puedes buscar, filtrar, ver detalles, editar, activar o inactivar procesos existentes.</p>
                    <p className="mt-1"><strong>Beneficios:</strong> Proporciona un repositorio central y fácilmente consultable de todo el conocimiento de procesos de la empresa. Facilita la gestión del ciclo de vida de cada proceso.</p>
                  </div>
                  <div className="pt-4 border-t border-dashed">
                    <h5 className="font-bold text-primary">Actividades</h5>
                    <p className="mt-1"><strong>Función:</strong> Funciona como un catálogo maestro de todas las tareas o pasos individuales que pueden formar parte de un proceso.</p>
                    <p className="mt-1"><strong>Beneficios:</strong> Permite la estandarización del trabajo a nivel granular. Una misma actividad (ej. "Aprobar factura") puede ser reutilizada en múltiples procesos, asegurando consistencia y facilitando el análisis de duplicidades.</p>
                  </div>
                  <div className="pt-4 border-t border-dashed">
                    <h5 className="font-bold text-primary">Panel Jerárquico</h5>
                    <p className="mt-1"><strong>Función:</strong> Una vista interactiva que muestra la estructura organizativa y los procesos que dependen de cada uno. Permite vincular actividades a procesos arrastrando y soltando (drag & drop).</p>
                    <p className="mt-1"><strong>Beneficios:</strong> Ofrece una visión clara de cómo se distribuye el trabajo en la organización y es la herramienta principal para construir los flujogramas de actividades de cada proceso de manera visual e intuitiva.</p>
                  </div>
                  <div className="pt-4 border-t border-dashed">
                    <h5 className="font-bold text-primary">Análisis IA (Mejoras)</h5>
                    <p className="mt-1"><strong>Función:</strong> Módulo de inteligencia artificial que examina los datos capturados para encontrar posibles duplicidades, sistemas redundantes y otras oportunidades de mejora.</p>
                    <p className="mt-1"><strong>Beneficios:</strong> Automatiza el trabajo de análisis que llevaría semanas a un equipo humano, descubriendo ineficiencias ocultas y sugiriendo mejoras accionables.</p>
                  </div>
                  <div className="pt-4 border-t border-dashed">
                    <h5 className="font-bold text-primary">Acciones</h5>
                    <p className="mt-1"><strong>Función:</strong> Permite crear, asignar, dar seguimiento y cuantificar el impacto de cada iniciativa de mejora, desde su concepción hasta su finalización.</p>
                    <p className="mt-1"><strong>Beneficios:</strong> Convierte las ideas y hallazgos en proyectos concretos y medibles, asegurando que las oportunidades de mejora no se queden en el papel y se pueda demostrar su valor.</p>
                  </div>
                  <div className="pt-4 border-t border-dashed">
                    <h5 className="font-bold text-primary">Auditoría y Cumplimiento</h5>
                    <p className="mt-1"><strong>Función:</strong> Permite realizar auditorías formales sobre procesos, puestos o sistemas. Se pueden registrar hallazgos (conformes, no conformes) y generar planes de acción. También incluye un registro de actividad de todo el sistema.</p>
                    <p className="mt-1"><strong>Beneficios:</strong> Facilita las labores de control interno, auditoría y cumplimiento normativo, manteniendo un registro trazable de las revisiones y sus resultados.</p>
                  </div>
                  <div className="pt-4 border-t border-dashed">
                    <h5 className="font-bold text-primary">Configuración</h5>
                    <p className="mt-1"><strong>Función:</strong> El panel de control administrativo. Aquí se gestionan las listas maestras (Áreas, Departamentos, Puestos, Sistemas) y se realizan cargas masivas de datos.</p>
                    <p className="mt-1"><strong>Beneficios:</strong> Mantiene la integridad de los datos del sistema y permite una configuración y actualización rápida y eficiente de la información base.</p>
                  </div>
                  <div className="pt-4 border-t border-dashed">
                    <h5 className="font-bold text-primary">Usuarios y Permisos</h5>
                    <p className="mt-1"><strong>Función:</strong> Desde aquí, un Administrador puede gestionar los roles de los usuarios y definir qué puede hacer cada rol dentro del sistema.</p>
                    <p className="mt-1"><strong>Beneficios:</strong> Asegura que cada usuario tenga acceso únicamente a la información y funciones que le corresponden, protegiendo la integridad y confidencialidad de los datos.</p>
                  </div>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-how-to">
                <AccordionTrigger className="text-lg font-semibold">3. Guías de Tareas Comunes</AccordionTrigger>
                <AccordionContent className="space-y-4 text-sm">
                  <div className="pt-4 border-t border-dashed first:pt-0 first:border-t-0">
                    <h5 className="font-bold text-primary">Cómo Capturar un Nuevo Proceso</h5>
                    <ol className="list-decimal pl-5 space-y-1 mt-2">
                      <li>Ve al módulo <strong>"Captura"</strong>.</li>
                      <li>Rellena la jerarquía: selecciona el Área, Departamento (opcional) y Puesto responsable.</li>
                      <li>Asigna un nombre claro y descriptivo al proceso.</li>
                      <li>Describe detalladamente su propósito, alcance, inicio y fin.</li>
                      <li>Completa las métricas: frecuencia, tiempos y costos (estimados vs. ideales).</li>
                      <li>Define el flujo de información: qué información recibe (entradas) y de qué procesos, y qué información entrega (salidas) y a qué procesos.</li>
                      <li>Haz clic en "Guardar y Definir Actividades". Al guardar, serás redirigido a una pantalla para detallar las actividades en orden.</li>
                    </ol>
                  </div>
                  <div className="pt-4 border-t border-dashed">
                    <h5 className="font-bold text-primary">Cómo Vincular Actividades en el Panel Jerárquico</h5>
                    <p className="mt-1">Este panel es clave para estandarizar el trabajo.</p>
                    <ol className="list-decimal pl-5 space-y-1 mt-2">
                      <li>Navega por el árbol de la izquierda para encontrar el proceso que quieres detallar. Puedes expandir las áreas y puestos.</li>
                      <li>En el "Pool de Actividades" de la derecha, busca la actividad que quieres asignar. Puedes usar los filtros para encontrarla rápidamente.</li>
                      <li><strong>Arrastra la actividad</strong> desde el pool y <strong>suéltala sobre el nombre del proceso</strong> en el árbol.</li>
                      <li>La actividad ahora está vinculada. Puedes reordenarla arrastrándola por encima o por debajo de otras actividades dentro del mismo proceso.</li>
                    </ol>
                  </div>
                  <div className="pt-4 border-t border-dashed">
                    <h5 className="font-bold text-primary">Cómo Realizar un Análisis con IA</h5>
                    <ol className="list-decimal pl-5 space-y-1 mt-2">
                      <li>Ve a <strong>"Análisis IA"</strong>.</li>
                      <li>Haz clic en el botón "Analizar Ineficiencias con IA".</li>
                      <li>Se abrirá una ventana para que selecciones qué procesos, actividades y sistemas quieres que la IA examine. Para mejores resultados, selecciona un conjunto coherente de elementos (ej. todos los procesos de un área).</li>
                      <li>Tras la selección, ejecuta el análisis. La IA te devolverá un resumen y listas de posibles duplicidades o redundancias.</li>
                      <li>Si los hallazgos son acertados, puedes generar "Acciones de Mejora" directamente desde los resultados, las cuales aparecerán en el módulo de "Acciones" listas para ser gestionadas.</li>
                    </ol>
                  </div>
                </AccordionContent>
              </AccordionItem>

            </Accordion>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
