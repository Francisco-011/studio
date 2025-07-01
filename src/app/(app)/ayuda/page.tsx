'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LifeBuoy } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from '@/components/ui/separator';

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
          <ScrollArea className="h-[calc(100vh-320px)]">
            <Accordion type="single" collapsible className="w-full pr-4" defaultValue="item-intro">
              
              <AccordionItem value="item-intro">
                <AccordionTrigger className="text-lg font-semibold">1. Introducción a SIAP</AccordionTrigger>
                <AccordionContent className="space-y-3 text-sm">
                  <h4 className="font-semibold text-base">¿Qué es SIAP?</h4>
                  <p>SIAP (Sistema Integral de Análisis de Procesos) es una herramienta diseñada para ayudarte a mapear, analizar, optimizar y gobernar los procesos de negocio de tu organización. Desde la captura detallada de un flujo de trabajo hasta el análisis con Inteligencia Artificial para detectar ineficiencias, SIAP te proporciona una visión completa y accionable de cómo opera tu empresa.</p>
                  <h4 className="font-semibold text-base">Objetivos del Sistema</h4>
                  <ul className="list-disc pl-5 space-y-2">
                    <li><strong>Centralizar la Información:</strong> Crear un repositorio único y estandarizado de todos los procesos, procedimientos, actividades y políticas. Su beneficio es eliminar la dispersión de documentos y asegurar que todos consulten la misma versión de la verdad.</li>
                    <li><strong>Mejorar la Eficiencia:</strong> Identificar cuellos de botella, duplicidades de tareas y redundancias de sistemas a través de análisis manual y de IA. El beneficio directo es la reducción de costos operativos y la optimización del tiempo de los empleados.</li>
                    <li><strong>Facilitar la Toma de Decisiones:</strong> Proporcionar datos, métricas y dashboards visuales sobre el rendimiento de los procesos, el impacto de las mejoras y el estado del cumplimiento normativo.</li>
                    <li><strong>Impulsar la Mejora Continua:</strong> Gestionar y dar seguimiento a las iniciativas de optimización de principio a fin, cuantificando su impacto y convirtiendo los hallazgos en proyectos concretos y medibles.</li>
                    <li><strong>Garantizar el Cumplimiento:</strong> Establecer un marco de gobernanza claro, vinculando políticas a cada nivel de la operación y gestionando su ciclo de vida de forma controlada.</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-modules">
                <AccordionTrigger className="text-lg font-semibold">2. Descripción de Módulos</AccordionTrigger>
                <AccordionContent className="space-y-4 text-sm">
                  <div className="pt-4 border-t border-dashed first:pt-0 first:border-t-0">
                    <h5 className="font-bold text-primary">Dashboard (Resumen Ejecutivo)</h5>
                    <p className="mt-1"><strong>Función:</strong> Es la pantalla de bienvenida y el centro de mando. Ofrece una vista rápida de los indicadores clave (KPIs) más importantes del sistema y sirve como punto de acceso a los dashboards especializados.</p>
                    <p className="mt-1"><strong>Beneficios:</strong> Permite tener un pulso rápido de la salud operativa y de cumplimiento de la organización.</p>
                  </div>
                   <div className="pt-4 border-t border-dashed">
                    <h5 className="font-bold text-primary">Captura</h5>
                    <p className="mt-1"><strong>Función:</strong> El corazón del sistema. En este módulo se registran nuevos procesos, detallando quién lo hace (área/puesto), qué hace (descripción), cómo lo hace (métricas de tiempo/costo), qué necesita (entradas) y qué produce (salidas).</p>
                    <p className="mt-1"><strong>Beneficios:</strong> Estandariza la forma en que se documentan los procesos, asegurando que toda la información relevante sea capturada de manera consistente.</p>
                  </div>
                  <div className="pt-4 border-t border-dashed">
                    <h5 className="font-bold text-primary">Procesos Registrados</h5>
                    <p className="mt-1"><strong>Función:</strong> Un centro de gestión donde puedes buscar, filtrar, ver detalles, editar y gestionar el estado (activo/inactivo) de los procesos existentes. Permite expandir cada proceso para ver sus procedimientos y actividades asociadas.</p>
                    <p className="mt-1"><strong>Beneficios:</strong> Proporciona un repositorio central y fácilmente consultable de todo el conocimiento de procesos de la empresa.</p>
                  </div>
                  <div className="pt-4 border-t border-dashed">
                    <h5 className="font-bold text-primary">Actividades</h5>
                    <p className="mt-1"><strong>Función:</strong> Funciona como un catálogo maestro de todas las tareas o pasos individuales que pueden formar parte de un procedimiento.</p>
                    <p className="mt-1"><strong>Beneficios:</strong> Permite la estandarización del trabajo a nivel granular. Una misma actividad (ej. "Aprobar factura") puede ser reutilizada en múltiples procedimientos, asegurando consistencia.</p>
                  </div>
                  <div className="pt-4 border-t border-dashed">
                    <h5 className="font-bold text-primary">Políticas</h5>
                    <p className="mt-1"><strong>Función:</strong> Gestiona el ciclo de vida completo de las políticas de la organización, desde su creación como borrador, pasando por su revisión y aprobación, hasta su archivo.</p>
                    <p className="mt-1"><strong>Beneficios:</strong> Asegura un marco de gobernanza formal y auditable. Solo las políticas aprobadas se consideran activas en el sistema.</p>
                  </div>
                  <div className="pt-4 border-t border-dashed">
                    <h5 className="font-bold text-primary">Panel Jerárquico</h5>
                    <p className="mt-1"><strong>Función:</strong> Una vista interactiva que muestra la estructura completa <strong>Proceso → Procedimiento → Actividad → Política</strong>. Permite arrastrar actividades desde un "pool" para asignarlas a procedimientos y visualizar al instante qué políticas regulan cada parte del flujo.</p>
                    <p className="mt-1"><strong>Beneficios:</strong> Ofrece una visión clara de cómo se distribuye y regula el trabajo en la organización. Es la herramienta principal para construir y auditar flujos.</p>
                  </div>
                   <div className="pt-4 border-t border-dashed">
                    <h5 className="font-bold text-primary">Análisis IA (Mejoras)</h5>
                    <p className="mt-1"><strong>Función:</strong> Este módulo tiene dos sub-funciones:
                        1.  **Análisis de Ineficiencias:** Examina los datos capturados para encontrar posibles duplicidades (de procesos, actividades), sistemas redundantes y gaps de cumplimiento en las políticas.
                        2.  **Análisis de Perfil de Puesto:** Genera un perfil de puesto profesional y valida si las actividades asignadas a un rol están alineadas con sus responsabilidades.</p>
                    <p className="mt-1"><strong>Beneficios:</strong> Automatiza el trabajo de análisis, descubriendo ineficiencias ocultas, sugiriendo mejoras accionables y validando la coherencia de la estructura organizacional.</p>
                  </div>
                  <div className="pt-4 border-t border-dashed">
                    <h5 className="font-bold text-primary">Consulta IA</h5>
                    <p className="mt-1"><strong>Función:</strong> Un asistente de chat conversacional que entiende la estructura de datos de SIAP. Puedes hacerle preguntas en lenguaje natural sobre procesos, políticas y sus relaciones.</p>
                    <p className="mt-1"><strong>Beneficios:</strong> Democratiza el acceso a la información, permitiendo a cualquier usuario obtener respuestas rápidas sin necesidad de navegar por todas las pantallas.</p>
                  </div>
                  <div className="pt-4 border-t border-dashed">
                    <h5 className="font-bold text-primary">Acciones</h5>
                    <p className="mt-1"><strong>Función:</strong> Permite crear, asignar, dar seguimiento y cuantificar el impacto de cada iniciativa de mejora, desde su concepción hasta su finalización.</p>
                    <p className="mt-1"><strong>Beneficios:</strong> Convierte las ideas y hallazgos en proyectos concretos y medibles, asegurando que las oportunidades de mejora no se queden en el papel.</p>
                  </div>
                  <div className="pt-4 border-t border-dashed">
                    <h5 className="font-bold text-primary">Auditoría y Cumplimiento</h5>
                    <p className="mt-1"><strong>Función:</strong> Permite realizar auditorías formales sobre procesos, puestos o sistemas. Se pueden registrar hallazgos y generar planes de acción. Su dashboard muestra **alertas automáticas** para las auditorías que están pendientes o vencidas según la frecuencia programada.</p>
                    <p className="mt-1"><strong>Beneficios:</strong> Facilita las labores de control interno, mantiene un registro trazable y ayuda a gestionar proactivamente el calendario de cumplimiento.</p>
                  </div>
                  <div className="pt-4 border-t border-dashed">
                    <h5 className="font-bold text-primary">Configuración</h5>
                    <p className="mt-1"><strong>Función:</strong> El panel de control administrativo. Aquí se gestionan las listas maestras (Áreas, Departamentos, Puestos, Sistemas y sus costos) y se realizan cargas masivas de datos.</p>
                    <p className="mt-1"><strong>Beneficios:</strong> Mantiene la integridad de los datos del sistema y permite una configuración y actualización rápida y eficiente.</p>
                  </div>
                   <div className="pt-4 border-t border-dashed">
                    <h5 className="font-bold text-primary">Usuarios y Permisos</h5>
                    <p className="mt-1"><strong>Función:</strong> Desde aquí, un Administrador puede gestionar los roles de los usuarios, definir qué puede hacer y ver cada rol dentro del sistema, y gestionar **excepciones de acceso** a documentos específicos para usuarios individuales.</p>
                    <p className="mt-1"><strong>Beneficios:</strong> Asegura un control de acceso granular y flexible, protegiendo la integridad y confidencialidad de los datos.</p>
                  </div>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-how-to">
                <AccordionTrigger className="text-lg font-semibold">3. Guías de Tareas Comunes</AccordionTrigger>
                <AccordionContent className="space-y-4 text-sm">
                  <div className="pt-4 border-t border-dashed first:pt-0 first:border-t-0">
                    <h5 className="font-bold text-primary">Cómo Capturar un Proceso y su Flujo Completo</h5>
                    <ol className="list-decimal pl-5 space-y-1 mt-2">
                      <li>Ve al módulo <strong>"Captura"</strong>.</li>
                      <li>Rellena la información general del proceso (jerarquía, nombre, descripción, métricas, frecuencia de auditoría, etc.).</li>
                      <li>Al guardar, serás redirigido a la página de <strong>"Definir Procedimientos"</strong>. Aquí, añade uno o más procedimientos que componen el proceso.</li>
                      <li>Luego, ve al **"Panel Jerárquico"**. Expande el proceso que acabas de crear hasta ver sus procedimientos.</li>
                      <li>Desde el **"Pool de Actividades"** a la derecha, arrastra y suelta las actividades que necesites sobre el procedimiento correspondiente.</li>
                      <li>Una vez guardado, todo el flujo será visible en **"Procesos Registrados"** y en el **"Panel Jerárquico"**.</li>
                    </ol>
                  </div>
                  <div className="pt-4 border-t border-dashed">
                    <h5 className="font-bold text-primary">Cómo Vincular Políticas y Actividades en el Panel Jerárquico</h5>
                    <ol className="list-decimal pl-5 space-y-1 mt-2">
                      <li>Ve al **"Panel Jerárquico"**.</li>
                      <li>Expande el árbol de la izquierda para encontrar el <strong>procedimiento</strong> al que quieres añadirle trabajo.</li>
                      <li>En el **"Pool de Actividades"** de la derecha, busca la actividad que quieres asignar (puedes usar los filtros).</li>
                      <li><strong>Arrastra la actividad</strong> desde el pool y **suéltala sobre el nombre del procedimiento** o entre dos actividades existentes dentro de un procedimiento.</li>
                      <li>Para vincular una política, ve al módulo <strong>"Políticas"</strong>, edita la política deseada y usa el botón **"Vincular a Elementos"** para asociarla a procesos, procedimientos o actividades, especificando el tipo de relación.</li>
                    </ol>
                  </div>
                  <div className="pt-4 border-t border-dashed">
                    <h5 className="font-bold text-primary">Cómo Realizar un Análisis con IA</h5>
                    <ol className="list-decimal pl-5 space-y-1 mt-2">
                      <li>Ve a <strong>"Análisis IA"</strong> y selecciona la pestaña **"Análisis de Ineficiencias"**.</li>
                      <li>Haz clic en el botón <strong>"Analizar Ineficiencias con IA"</strong>.</li>
                      <li>Se abrirá una ventana para que selecciones los procesos, procedimientos, actividades, puestos y sistemas que la IA debe examinar.</li>
                      <li>La IA devolverá un resumen y listas de posibles **duplicidades, redundancias y gaps de políticas**, evitando sugerir mejoras que ya estén registradas como "Acciones".</li>
                      <li>Si los hallazgos son acertados, puedes generar **"Acciones de Mejora"** directamente desde los resultados.</li>
                    </ol>
                  </div>
                </AccordionContent>
              </AccordionItem>

            </Accordion>
          </ScrollArea>
           <Separator className="my-4" />
           <div className="text-center">
             <Link href="/acerca-de" className="text-sm font-medium text-primary hover:underline">
                Acerca de SIAP
             </Link>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}
