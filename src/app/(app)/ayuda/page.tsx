
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
            <Accordion type="single" collapsible className="w-full pr-4">
              
              <AccordionItem value="item-1">
                <AccordionTrigger>1. Introducción a SIAP</AccordionTrigger>
                <AccordionContent className="prose prose-sm max-w-none">
                  <h4>¿Qué es SIAP?</h4>
                  <p>SIAP (Sistema Integral de Análisis de Procesos) es una herramienta diseñada para ayudarte a mapear, analizar, optimizar y gestionar los procesos de negocio de tu organización. Desde la captura detallada de un flujo de trabajo hasta el análisis con Inteligencia Artificial para detectar ineficiencias, SIAP te proporciona una visión completa y accionable de cómo opera tu empresa.</p>
                  <h4>Objetivos del Sistema</h4>
                  <ul className="list-disc pl-5">
                    <li><strong>Centralizar la Información:</strong> Crear un repositorio único y estandarizado de todos los procesos.</li>
                    <li><strong>Mejorar la Eficiencia:</strong> Identificar cuellos de botella, duplicidades y redundancias.</li>
                    <li><strong>Facilitar la Toma de Decisiones:</strong> Proporcionar datos y métricas claras sobre el rendimiento de los procesos.</li>
                    <li><strong>Impulsar la Mejora Continua:</strong> Gestionar y dar seguimiento a las iniciativas de optimización.</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2">
                <AccordionTrigger>2. Módulos Principales</AccordionTrigger>
                <AccordionContent className="prose prose-sm max-w-none">
                  <h4>Dashboard (Resumen Ejecutivo)</h4>
                  <p>Es la pantalla de bienvenida y el centro de mando. Ofrece una vista rápida de los indicadores clave (KPIs) más importantes del sistema, como el número de procesos mapeados, acciones completadas y ahorros generados. También sirve como punto de acceso rápido a los dashboards especializados.</p>

                  <h4>Captura</h4>
                  <p>El corazón del sistema. En este módulo se registran nuevos procesos. Se detalla quién lo hace (área/puesto), qué hace (descripción), cómo lo hace (métricas de tiempo/costo), qué necesita (entradas) y qué produce (salidas).</p>

                  <h4>Procesos Registrados</h4>
                  <p>Una vez capturados, todos los procesos viven aquí. Es un centro de gestión donde puedes buscar, filtrar, ver detalles, editar, activar o inactivar procesos existentes.</p>
                  
                  <h4>Actividades</h4>
                  <p>Funciona como un catálogo maestro de todas las tareas o pasos individuales que pueden formar parte de un proceso. Gestionar las actividades aquí permite estandarizar el trabajo en toda la organización.</p>

                  <h4>Panel Jerárquico</h4>
                  <p>Una vista interactiva que muestra la estructura organizativa (áreas, departamentos, puestos) y los procesos que dependen de cada uno. Su principal función es permitirte vincular las actividades del "Pool de Actividades" a los procesos específicos arrastrando y soltando (drag & drop).</p>

                  <h4>Análisis IA (Mejoras)</h4>
                  <p>Este es el módulo de inteligencia artificial. Seleccionas los procesos, actividades o sistemas que deseas analizar, y la IA los examina para encontrar posibles duplicidades, sistemas redundantes y otras oportunidades de mejora que podrías haber pasado por alto.</p>

                  <h4>Acciones</h4>
                  <p>Aquí es donde las ideas y los hallazgos se convierten en realidad. Este módulo te permite crear, asignar, dar seguimiento y cuantificar el impacto de cada iniciativa de mejora, desde su concepción hasta su finalización.</p>

                  <h4>Auditoría y Cumplimiento</h4>
                  <p>Permite realizar auditorías formales sobre procesos, puestos o sistemas. Puedes registrar hallazgos (conformes, no conformes, oportunidades) y generar planes de acción. También incluye un registro de actividad de todo el sistema.</p>
                  
                  <h4>Configuración</h4>
                  <p>El panel de control administrativo. Aquí se gestionan las listas maestras que alimentan los menús desplegables de todo el sistema, como Áreas, Departamentos, Puestos y Sistemas. También permite la carga masiva de datos mediante archivos CSV.</p>

                  <h4>Usuarios y Permisos</h4>
                  <p>Desde aquí, un Administrador puede gestionar los roles de los usuarios registrados y definir qué puede hacer cada rol dentro del sistema, controlando el acceso a cada módulo y función.</p>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-3">
                <AccordionTrigger>3. Guía de Uso por Módulo</AccordionTrigger>
                <AccordionContent className="prose prose-sm max-w-none">
                  <h5>Dashboard</h5>
                  <p>Al iniciar sesión, serás recibido por el Dashboard. Cada tarjeta es un resumen y un acceso directo. Haz clic en "Procesos y Eficiencia", "Impacto y Mejoras" o "Cumplimiento y Auditoría" para explorar los datos a fondo.</p>
                  
                  <h5>Captura de un Nuevo Proceso</h5>
                  <ol className="list-decimal pl-5">
                    <li>Ve al módulo <strong>"Captura"</strong>.</li>
                    <li>Rellena la jerarquía: selecciona el Área, Departamento (opcional) y Puesto responsable.</li>
                    <li>Asigna un nombre claro y descriptivo al proceso.</li>
                    <li>Describe detalladamente su propósito, alcance, inicio y fin.</li>
                    <li>Completa las métricas: frecuencia, tiempos y costos (estimados vs. ideales).</li>
                    <li>Define el flujo de información: qué información recibe (entradas) y de qué procesos, y qué información entrega (salidas) y a qué procesos.</li>
                    <li>Haz clic en "Guardar y Definir Actividades".</li>
                  </ol>
                  
                  <h5>Definición de Actividades del Proceso</h5>
                  <p>Después de guardar la información general del proceso, serás llevado a la pantalla de actividades. Aquí puedes:</p>
                  <ul className="list-disc pl-5">
                    <li><strong>Agregar Actividad:</strong> Crea una nueva actividad que forma parte de este proceso. Si una actividad similar ya existe en el sistema, recibirás una advertencia para evitar duplicados.</li>
                    <li><strong>Ordenar:</strong> Usa las flechas para secuenciar las actividades en el orden correcto en que se ejecutan.</li>
                    <li><strong>Guardar y Finalizar:</strong> Al terminar, las actividades quedarán vinculadas y ordenadas dentro del proceso.</li>
                  </ul>
                  
                  <h5>Panel Jerárquico y Vinculación de Actividades</h5>
                  <p>Este panel es clave para estandarizar.</p>
                  <ol className="list-decimal pl-5">
                    <li>Navega por el árbol de la izquierda para encontrar el proceso que quieres detallar.</li>
                    <li>En el "Pool de Actividades" de la derecha, busca la actividad que quieres asignar.</li>
                    <li><strong>Arrastra la actividad</strong> desde el pool y <strong>suéltala sobre el nombre del proceso</strong> en el árbol.</li>
                    <li>La actividad ahora está vinculada. Puedes reordenarla arrastrándola por encima o por debajo de otras actividades dentro del mismo proceso.</li>
                  </ol>

                  <h5>Realizar un Análisis con IA</h5>
                  <ol className="list-decimal pl-5">
                    <li>Ve a <strong>"Análisis IA"</strong>.</li>
                    <li>Haz clic en el botón "Analizar Ineficiencias con IA".</li>
                    <li>Se abrirá una ventana para que selecciones qué procesos, actividades y sistemas quieres que la IA examine.</li>
                    <li>Tras la selección, ejecuta el análisis. La IA te devolverá un resumen y listas de posibles duplicidades o redundancias.</li>
                    <li>Si los hallazgos son acertados, puedes generar "Acciones de Mejora" directamente desde los resultados.</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

            </Accordion>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
