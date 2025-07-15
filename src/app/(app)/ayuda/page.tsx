

'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LifeBuoy, ChevronRight, LayoutDashboard, ClipboardEdit, ListOrdered, ListChecks, Database, FileText, FolderTree, TrendingUp, MessageCircleQuestion, Target, ClipboardCheck, Settings, Users, Info, PlusCircle, Search, Edit2, Trash2, RotateCcw, Link2, Ban, CheckSquare, Share2, Save, CalendarCheck2, X, PlayCircle, History, Calculator, Eye, DollarSign, Factory, AlertTriangle, HardDrive, ShieldAlert } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from '@/components/ui/separator';

const DetailItem = ({ icon, term, description }: { icon: React.ElementType, term: string, description: React.ReactNode }) => (
  <div className="flex items-start gap-3">
    <div className="flex-shrink-0">
      <div className="bg-primary/10 text-primary rounded-md h-8 w-8 flex items-center justify-center">
          {React.createElement(icon, { className: "h-5 w-5" })}
      </div>
    </div>
    <div>
      <dt className="font-semibold">{term}</dt>
      <dd className="mt-1 text-muted-foreground">{description}</dd>
    </div>
  </div>
);

const FormulaBox = ({ children }: { children: React.ReactNode }) => (
    <div className="mt-2 p-3 bg-muted/50 border rounded-md text-xs font-mono text-foreground/80">
        {children}
    </div>
);


export default function AyudaPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <LifeBuoy className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl font-headline">Manual de Usuario PROSCENDIA</CardTitle>
          </div>
          <CardDescription>
            Una guía completa para entender y operar todas las funcionalidades de PROSCENDIA.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-320px)]">
            <Accordion type="single" collapsible className="w-full pr-4" defaultValue="item-intro">
              
              <AccordionItem value="item-intro">
                <AccordionTrigger className="text-lg font-semibold">1. Introducción a PROSCENDIA</AccordionTrigger>
                <AccordionContent className="space-y-3 text-sm">
                  <h4 className="font-semibold text-base">¿Qué es PROSCENDIA?</h4>
                  <p>El nombre **PROSCENDIA** nace de la unión de "Process" (Proceso) y "Ascend" (Ascender), reflejando su misión principal: **elevar tus procesos de negocio**. Es una herramienta integral diseñada para ayudarte a mapear, analizar, optimizar y gobernar las operaciones de tu organización. Desde la captura detallada de un flujo de trabajo hasta el análisis con Inteligencia Artificial para detectar ineficiencias, PROSCENDIA te proporciona una visión completa y accionable de cómo opera tu empresa.</p>
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
                <AccordionTrigger className="text-lg font-semibold">2. Descripción Detallada de Módulos</AccordionTrigger>
                <AccordionContent className="space-y-4 text-sm">
                  
                  <Accordion type="multiple" className="w-full space-y-2">
                      <AccordionItem value="dashboard">
                          <AccordionTrigger className="text-base font-medium bg-muted/50 px-4 rounded-md"><LayoutDashboard className="mr-2 h-5 w-5 text-primary"/>Dashboard</AccordionTrigger>
                          <AccordionContent className="p-4 space-y-2">
                              <p><strong>Función:</strong> Es la pantalla de bienvenida y el centro de mando. Ofrece una vista de alto nivel de los indicadores clave (KPIs) de la organización y sirve como punto de acceso rápido a los dashboards especializados.</p>
                              <dl className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
                                  <DetailItem icon={Database} term="Procesos Mapeados" description="Número total de procesos activos en el sistema."/>
                                  <DetailItem icon={CheckSquare} term="Acciones Completadas" description="Total de iniciativas de mejora que han sido finalizadas."/>
                                  <DetailItem icon={Target} term="Ahorro Realizado" description="Suma de los ahorros (en costo y tiempo) generados por las acciones completadas."/>
                                  <DetailItem icon={ClipboardCheck} term="Auditorías Completadas" description="Número total de auditorías finalizadas."/>
                              </dl>
                              <p className="mt-2"><strong>Acceso a Dashboards Especializados:</strong> Use los botones en la parte inferior para navegar a los paneles de control detallados de cada área (Procesos, Mejoras, Sistemas, etc.).</p>
                          </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="captura">
                          <AccordionTrigger className="text-base font-medium bg-muted/50 px-4 rounded-md"><ClipboardEdit className="mr-2 h-5 w-5 text-primary"/>Captura Integral</AccordionTrigger>
                          <AccordionContent className="p-4 space-y-2">
                              <p><strong>Función:</strong> El corazón del sistema para el registro de información. Este módulo permite capturar un proceso completo, incluyendo sus procedimientos y actividades, desde una única pantalla, asegurando la integridad y la relación entre los datos desde el inicio.</p>
                              <h5 className="font-semibold pt-2">Flujo de Trabajo:</h5>
                              <ol className="list-decimal pl-5 space-y-1">
                                <li><strong>Datos del Proceso:</strong> Complete la información general del proceso, como su nombre, área/puesto responsable y objetivo.</li>
                                <li><strong>Definir Procedimientos:</strong> Haga clic en "Definir Procedimientos y Flujo". Esto expandirá la sección para agregar los pasos secuenciales (procedimientos) del proceso.</li>
                                <li><strong>Detallar Procedimientos:</strong> Para cada procedimiento, defina su nombre, descripción, clasificación, sistemas que utiliza, y políticas asociadas.</li>
                                <li><strong>Agregar Actividades:</strong> Dentro de cada procedimiento, agregue las actividades específicas, detallando su nombre, tiempo y puesto que la ejecuta.</li>
                                <li><strong>Guardar Todo:</strong> Al finalizar, haga clic en "Guardar Proceso Completo". El sistema creará todas las entidades y sus relaciones automáticamente.</li>
                              </ol>
                          </AccordionContent>
                      </AccordionItem>
                      
                      <AccordionItem value="procedimientos">
                          <AccordionTrigger className="text-base font-medium bg-muted/50 px-4 rounded-md"><ListOrdered className="mr-2 h-5 w-5 text-primary"/>Procedimientos</AccordionTrigger>
                          <AccordionContent className="p-4 space-y-2">
                              <p><strong>Función:</strong> Es el catálogo maestro de todos los procedimientos del sistema. Un procedimiento es una secuencia de actividades para llevar a cabo una parte de un proceso. Este módulo permite gestionarlos de forma centralizada.</p>
                              <dl className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
                                <DetailItem icon={PlusCircle} term="Agregar Procedimiento" description="Crea un nuevo procedimiento, asignándolo a un proceso padre y definiendo sus características (clasificación, sistemas, etc.)."/>
                                <DetailItem icon={Edit2} term="Editar" description="Modifica los detalles de un procedimiento existente."/>
                                <DetailItem icon={Trash2} term="Eliminar" description="Borra un procedimiento. Solo es posible si no tiene actividades asignadas."/>
                                <DetailItem icon={Calculator} term="Recalcular Totales" description="Calcula y actualiza el tiempo y costo mensual estimado del procedimiento, sumando los de sus actividades activas."/>
                              </dl>
                          </AccordionContent>
                      </AccordionItem>
                      
                      <AccordionItem value="actividades">
                          <AccordionTrigger className="text-base font-medium bg-muted/50 px-4 rounded-md"><ListChecks className="mr-2 h-5 w-5 text-primary"/>Actividades</AccordionTrigger>
                          <AccordionContent className="p-4 space-y-2">
                              <p><strong>Función:</strong> Funciona como un catálogo maestro de todas las tareas o pasos individuales que pueden formar parte de un procedimiento. Permite la estandarización del trabajo a nivel granular. Una misma actividad puede ser reutilizada en múltiples procedimientos.</p>
                          </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="procesos-registrados">
                          <AccordionTrigger className="text-base font-medium bg-muted/50 px-4 rounded-md"><Database className="mr-2 h-5 w-5 text-primary"/>Procesos Registrados</AccordionTrigger>
                          <AccordionContent className="p-4 space-y-2">
                              <p><strong>Función:</strong> Un centro de gestión donde puedes buscar, filtrar, ver detalles, editar y gestionar el estado (activo/inactivo) de los procesos existentes. Permite expandir cada proceso para ver sus procedimientos y actividades asociadas.</p>
                              <dl className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
                                <DetailItem icon={Search} term="Filtros" description="Utilice los filtros superiores para acotar la búsqueda por área, puesto, estado o contenido (si tiene o no procedimientos/actividades)."/>
                                <DetailItem icon={ChevronRight} term="Expandir" description="Haga clic en la flecha a la izquierda de cada proceso para ver sus procedimientos y actividades en detalle."/>
                                <DetailItem icon={Edit2} term="Editar Proceso" description="Permite modificar los datos generales de un proceso."/>
                                <DetailItem icon={Trash2} term="Eliminar Proceso" description="Mueve un proceso a la papelera (borrado lógico). Solo se puede si no tiene procedimientos."/>
                              </dl>
                          </AccordionContent>
                      </AccordionItem>
                      
                      <AccordionItem value="politicas">
                          <AccordionTrigger className="text-base font-medium bg-muted/50 px-4 rounded-md"><FileText className="mr-2 h-5 w-5 text-primary"/>Políticas</AccordionTrigger>
                          <AccordionContent className="p-4 space-y-2">
                              <p><strong>Función:</strong> Gestiona el ciclo de vida completo de las políticas de la organización, desde su creación como borrador, pasando por su revisión y aprobación, hasta su publicación. Asegura un marco de gobernanza formal y auditable.</p>
                              <h5 className="font-semibold pt-2">Ciclo de Vida de una Política:</h5>
                              <ol className="list-decimal pl-5 space-y-1">
                                <li><strong>Borrador:</strong> La política puede ser editada libremente.</li>
                                <li><strong>En Revisión:</strong> Se envía a revisión. Ya no es editable.</li>
                                <li><strong>Aprobada:</strong> La política es oficial y está bloqueada para edición. Ahora puede ser vinculada a procesos, procedimientos y actividades.</li>
                                <li><strong>Publicada:</strong> Una política aprobada y vigente que se considera estable y está en uso general.</li>
                              </ol>
                               <p className="mt-2"><strong>Nota:</strong> Para editar una política Aprobada o Publicada, primero se debe regresar al estado de "Borrador" usando la acción "Crear Nueva Versión".</p>
                          </AccordionContent>
                      </AccordionItem>
                      
                       <AccordionItem value="panel-jerarquico">
                          <AccordionTrigger className="text-base font-medium bg-muted/50 px-4 rounded-md"><FolderTree className="mr-2 h-5 w-5 text-primary"/>Panel Jerárquico</AccordionTrigger>
                          <AccordionContent className="p-4 space-y-2">
                              <p><strong>Función:</strong> Una vista interactiva que muestra la estructura completa **Área → Departamento → Puesto → Proceso → Procedimiento → Actividad**. Es la herramienta principal para construir y auditar los flujos de trabajo.</p>
                               <dl className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
                                <DetailItem icon={FolderTree} term="Árbol Jerárquico" description="Explore la estructura completa de la organización expandiendo cada nivel."/>
                                <DetailItem icon={ListChecks} term="Pool de Actividades" description="A la derecha, encontrará un catálogo de todas las actividades disponibles en el sistema."/>
                                <DetailItem icon={Share2} term="Arrastrar y Soltar (Drag & Drop)" description="Arrastre una actividad desde el 'Pool' y suéltela sobre un procedimiento en el árbol para asignarla."/>
                                <DetailItem icon={Eye} term="Ver Detalles" description="Haga clic en el icono del ojo para ver los detalles completos de un proceso o actividad."/>
                              </dl>
                          </AccordionContent>
                      </AccordionItem>
                      
                       <AccordionItem value="mejoras">
                          <AccordionTrigger className="text-base font-medium bg-muted/50 px-4 rounded-md"><TrendingUp className="mr-2 h-5 w-5 text-primary"/>Análisis de Mejoras (IA)</AccordionTrigger>
                          <AccordionContent className="p-4 space-y-2">
                              <p><strong>Función:</strong> Este módulo utiliza Inteligencia Artificial para analizar la información del sistema y proponer mejoras.</p>
                              <h5 className="font-semibold pt-2">Pestañas:</h5>
                              <ul className="list-disc pl-5 space-y-1">
                                <li><strong>Análisis de Ineficiencias:</strong> Seleccione los elementos que desea analizar (procesos, sistemas, etc.) y la IA buscará duplicidades, sistemas redundantes, procesos sin políticas, y otras oportunidades de optimización. Puede generar "Acciones de Mejora" directamente desde los resultados.</li>
                                <li><strong>Análisis de Perfil de Puesto:</strong> Seleccione un puesto y la IA generará una descripción profesional del rol basándose en las actividades que tiene asignadas. También identificará qué actividades parecen estar alineadas y cuáles no, sugiriendo posibles reasignaciones.</li>
                              </ul>
                          </AccordionContent>
                      </AccordionItem>
                      
                      <AccordionItem value="consulta-ia">
                          <AccordionTrigger className="text-base font-medium bg-muted/50 px-4 rounded-md"><MessageCircleQuestion className="mr-2 h-5 w-5 text-primary"/>Consulta IA</AccordionTrigger>
                          <AccordionContent className="p-4 space-y-2">
                              <p><strong>Función:</strong> Un asistente de chat conversacional que entiende la estructura de datos de PROSCENDIA. Puedes hacerle preguntas en lenguaje natural sobre procesos, políticas y sus relaciones. El asistente respeta los niveles de acceso del usuario, por lo que solo responderá con información que el usuario tiene permitido ver.</p>
                          </AccordionContent>
                      </AccordionItem>

                       <AccordionItem value="acciones">
                          <AccordionTrigger className="text-base font-medium bg-muted/50 px-4 rounded-md"><Target className="mr-2 h-5 w-5 text-primary"/>Acciones de Mejora</AccordionTrigger>
                          <AccordionContent className="p-4 space-y-2">
                              <p><strong>Función:</strong> Permite crear, asignar, dar seguimiento y cuantificar el impacto de cada iniciativa de mejora, desde su concepción hasta su finalización. Convierte las ideas y hallazgos en proyectos concretos y medibles.</p>
                               <dl className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
                                <DetailItem icon={PlusCircle} term="Agregar" description="Registra una nueva acción de mejora, especificando su objetivo, responsable, fechas y ahorros estimados (en costo y tiempo)."/>
                                <DetailItem icon={History} term="Ver Historial" description="Muestra un registro de todos los cambios realizados en una acción, especialmente útil para ver las mejoras cuantificadas al completarse."/>
                                <DetailItem icon={FileText} term="Exportar" description="Descarga la lista de acciones filtradas a un archivo CSV."/>
                              </dl>
                          </AccordionContent>
                      </AccordionItem>

                       <AccordionItem value="auditoria">
                          <AccordionTrigger className="text-base font-medium bg-muted/50 px-4 rounded-md"><ClipboardCheck className="mr-2 h-5 w-5 text-primary"/>Auditoría y Cumplimiento</AccordionTrigger>
                          <AccordionContent className="p-4 space-y-2">
                              <p><strong>Función:</strong> Facilita las labores de control interno. Permite realizar auditorías formales, registrar hallazgos y generar planes de acción. Mantiene un registro trazable y ayuda a gestionar proactivamente el cumplimiento.</p>
                              <h5 className="font-semibold pt-2">Pestañas:</h5>
                              <ul className="list-disc pl-5 space-y-1">
                                <li><strong>Alertas de Auditoría:</strong> Muestra automáticamente qué procesos, puestos o procedimientos requieren una auditoría porque su fecha de revisión programada ha vencido.</li>
                                <li><strong>Historial de Auditorías:</strong> Un registro de todas las auditorías pasadas, permitiendo consultar sus resultados.</li>
                                <li><strong>Registro de Actividad:</strong> Una bitácora detallada de todas las acciones importantes realizadas por los usuarios en el sistema.</li>
                              </ul>
                               <p className="mt-2"><strong>Flujo de Auditoría:</strong> Al iniciar una auditoría, se entra a una "sesión" donde se revisan los detalles del elemento auditado y se registran "hallazgos". Un hallazgo puede ser "Conforme", "No Conforme" o "Oportunidad de Mejora". Para los dos últimos, se pueden generar "Acciones de Mejora" directamente.</p>
                          </AccordionContent>
                      </AccordionItem>
                      
                       <AccordionItem value="configuracion">
                          <AccordionTrigger className="text-base font-medium bg-muted/50 px-4 rounded-md"><Settings className="mr-2 h-5 w-5 text-primary"/>Configuración</AccordionTrigger>
                          <AccordionContent className="p-4 space-y-2">
                              <p><strong>Función:</strong> El panel de control administrativo. Aquí se gestionan las listas maestras (Áreas, Departamentos, Puestos, Sistemas y sus costos) y se realizan cargas masivas de datos.</p>
                          </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="usuarios">
                          <AccordionTrigger className="text-base font-medium bg-muted/50 px-4 rounded-md"><Users className="mr-2 h-5 w-5 text-primary"/>Usuarios y Permisos</AccordionTrigger>
                          <AccordionContent className="p-4 space-y-2">
                              <p><strong>Función:</strong> Desde aquí, un Administrador puede gestionar los roles de los usuarios, definir qué puede hacer y ver cada rol dentro del sistema, y gestionar **excepciones de acceso** a documentos específicos para usuarios individuales.</p>
                              <h5 className="font-semibold pt-2">Pestañas:</h5>
                              <ul className="list-disc pl-5 space-y-1">
                                <li><strong>Gestión de Usuarios:</strong> Permite editar el rol, nivel de acceso y puesto de cada usuario.</li>
                                <li><strong>Roles y Permisos:</strong> Una matriz detallada para configurar qué puede hacer cada rol en cada módulo del sistema.</li>
                                <li><strong>Excepciones de Acceso:</strong> Permite dar o quitar acceso a un documento específico (ej. un proceso confidencial) a un usuario individual, sin cambiar su nivel de acceso general.</li>
                              </ul>
                          </AccordionContent>
                      </AccordionItem>

                  </Accordion>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-metrics">
                <AccordionTrigger className="text-lg font-semibold">3. Entendiendo las Métricas del Dashboard</AccordionTrigger>
                <AccordionContent className="space-y-6 text-sm">
                    <p>Esta sección desglosa cómo se calculan los indicadores clave (KPIs) en los diferentes dashboards para máxima transparencia.</p>

                    <Accordion type="multiple" className="w-full space-y-2">
                        {/* DASHBOARD MEJORAS */}
                        <AccordionItem value="metrics-mejoras">
                            <AccordionTrigger className="text-base font-medium bg-muted/50 px-4 rounded-md"><TrendingUp className="mr-2 h-5 w-5 text-primary"/>Dashboard: Impacto y Mejoras</AccordionTrigger>
                            <AccordionContent className="p-4 space-y-4">
                                <DetailItem 
                                    icon={DollarSign} 
                                    term="Ahorro Anual Realizado / Ahorro de Tiempo" 
                                    description={
                                        <div>
                                            <p>Cuantifica el impacto real de las acciones de mejora que han sido marcadas como **"Completada"**.</p>
                                            <p className="mt-1"><strong>Lógica de Cálculo:</strong></p>
                                            <ol className="list-decimal pl-5 mt-1 space-y-1">
                                                <li><strong>Prioridad 1 (Historial de Cambios):</strong> Si al completar una acción, se modificaron campos de tiempo o costo en el sistema (ej. se redujo el tiempo de una actividad), el sistema busca en el **historial de la acción** la diferencia entre el valor "Antes" y "Después". Este es el ahorro más preciso.</li>
                                                <li><strong>Prioridad 2 (Estimación Inicial):</strong> Si no hay cambios registrados en el historial, el sistema utiliza el valor que se ingresó en los campos "Ahorro Estimado" al crear o editar la acción.</li>
                                            </ol>
                                            <p className="mt-1 text-xs text-muted-foreground">Nota: El ahorro se anualiza si el cambio fue en una métrica mensual, semanal, etc.</p>
                                        </div>
                                    }
                                />
                            </AccordionContent>
                        </AccordionItem>

                        {/* DASHBOARD PROCESOS */}
                        <AccordionItem value="metrics-procesos">
                            <AccordionTrigger className="text-base font-medium bg-muted/50 px-4 rounded-md"><Factory className="mr-2 h-5 w-5 text-primary"/>Dashboard: Procesos y Eficiencia</AccordionTrigger>
                            <AccordionContent className="p-4 space-y-4">
                                <DetailItem 
                                    icon={Calculator} 
                                    term="Costo Operativo Mensual (en Análisis de Carga de Trabajo)" 
                                    description={
                                        <div>
                                            <p>Estima el costo mensual de las actividades asignadas a un puesto, basándose en el **Costo/hr** del puesto y la **Frecuencia** y **Tiempo** de sus actividades.</p>
                                            <FormulaBox>Costo Mensual Actividad = (Costo/hr del Puesto / 60) * Tiempo Estimado (min) * Ejecuciones por Mes</FormulaBox>
                                            <p className="mt-1"><strong>Ejecuciones por Mes:</strong> Se calcula usando la "Frecuencia" y "Veces por Periodo" de la actividad. Por ejemplo, una actividad "Semanal" que se ejecuta "2" veces, se calcularía como `4.33 * 2 = 8.66` ejecuciones al mes.</p>
                                        </div>
                                    }
                                />
                                <DetailItem 
                                    icon={Calculator} 
                                    term="% de Carga vs Sueldo (en Análisis de Carga de Trabajo)" 
                                    description={
                                        <div>
                                            <p>Compara el costo operativo de las actividades mapeadas contra un sueldo mensual estimado para determinar qué porcentaje del tiempo (y costo) de un puesto está dedicado a esas tareas.</p>
                                            <FormulaBox>% Carga = (Costo Operativo Mensual / Sueldo Mensual Estimado) * 100</FormulaBox>
                                            <p className="mt-1">El **Sueldo Mensual Estimado** se calcula como `Costo/hr del Puesto * 173.2` (horas laborables promedio en un mes).</p>
                                            <p className="mt-1 text-xs text-muted-foreground">Un % alto puede indicar una alta carga de trabajo mapeada o que el puesto está correctamente documentado. Un % bajo puede indicar que muchas de sus actividades aún no se han capturado en el sistema.</p>
                                        </div>
                                    }
                                />
                                <DetailItem 
                                    icon={Calculator} 
                                    term="Tiempo/Costo Estimado (Mes) (en tablas de Procesos y Procedimientos)" 
                                    description={
                                        <div>
                                            <p>Es la suma total de los tiempos y costos de todos sus elementos hijos **activos**. Para un Proceso, es la suma de sus Procedimientos. Para un Procedimiento, es la suma de sus Actividades.</p>
                                            <p className="mt-1">Estos valores no se actualizan en tiempo real. Se deben recalcular usando el botón <Calculator className="inline-block h-3 w-3"/> en las páginas de **Procesos Registrados** o **Procedimientos**.</p>
                                        </div>
                                    }
                                />
                            </AccordionContent>
                        </AccordionItem>
                        
                        {/* DASHBOARD SISTEMAS */}
                         <AccordionItem value="metrics-sistemas">
                            <AccordionTrigger className="text-base font-medium bg-muted/50 px-4 rounded-md"><HardDrive className="mr-2 h-5 w-5 text-primary"/>Dashboard: Sistemas y Costos</AccordionTrigger>
                            <AccordionContent className="p-4 space-y-4">
                                <DetailItem 
                                    icon={DollarSign} 
                                    term="Análisis de Costos de Sistemas" 
                                    description={
                                        <div>
                                            <p>Calcula el costo anual de cada sistema basándose en los datos del módulo de **Configuración &gt; Sistemas y Costos**.</p>
                                            <FormulaBox>Costo Anual Sistema = Suma de (Costo por Uso) + (Costo/Licencia * #Licencias)</FormulaBox>
                                            <p className="mt-1">Si la frecuencia de un costo es "Mensual", se multiplica por 12 para anualizarlo. Si es "Anual", se toma el valor directo. La fuente de estos datos es el módulo de Configuración.</p>
                                        </div>
                                    }
                                />
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-faq">
                <AccordionTrigger className="text-lg font-semibold">4. Preguntas Frecuentes y Aclaraciones</AccordionTrigger>
                <AccordionContent className="space-y-6 text-sm">
                   <Accordion type="multiple" className="w-full space-y-2">
                        <AccordionItem value="faq-active-items">
                            <AccordionTrigger className="text-base font-medium bg-muted/50 px-4 rounded-md">¿Los dashboards solo muestran información de elementos activos?</AccordionTrigger>
                            <AccordionContent className="p-4 space-y-3">
                                <p>En general, sí. Los dashboards están diseñados para reflejar la operativa actual, por lo que priorizan los elementos activos. Sin embargo, hay algunas diferencias clave:</p>
                                <ul className="list-disc pl-5 space-y-2">
                                    <li>
                                        <strong>Dashboard Principal y de Procesos:</strong> Los contadores de "Procesos Mapeados" y otras métricas relacionadas **solo cuentan procesos activos**. Si un proceso se marca como inactivo, dejará de aparecer en estos cálculos.
                                    </li>
                                     <li>
                                        <strong>Dashboard de Procesos (Carga de Trabajo):</strong> El análisis de carga de trabajo considera todas las actividades asignadas a los puestos, pero **excluye las actividades que han sido marcadas como inactivas** en el módulo de Actividades.
                                    </li>
                                    <li>
                                        <strong>Dashboard de Mejoras y Auditoría:</strong> Estos se basan en el estado del evento en sí (la acción de mejora o la auditoría). Por ejemplo, un ahorro de una "Acción Completada" se seguirá contando aunque el proceso que la originó se inactive después. Esto permite un seguimiento histórico del impacto.
                                    </li>
                                     <li>
                                        <strong>Dashboard de Políticas:</strong> Se enfoca en políticas con estado **"Aprobada"**. No incluye borradores ni políticas en revisión para sus métricas de cobertura.
                                    </li>
                                </ul>
                                <p><strong>En resumen:</strong> Para los contadores operativos, solo lo activo cuenta. Para los registros históricos (mejoras, auditorías), el estado del evento es lo que importa.</p>
                            </AccordionContent>
                        </AccordionItem>
                   </Accordion>
                </AccordionContent>
              </AccordionItem>


              <AccordionItem value="item-security">
                <AccordionTrigger className="text-lg font-semibold">5. Roles y Niveles de Acceso: ¿Quién ve qué?</AccordionTrigger>
                <AccordionContent className="space-y-4 text-sm">
                  <p>PROSCENDIA utiliza un sistema de seguridad de dos capas para proteger la información: los **Niveles de Acceso** y los **Roles**. Es crucial entender cómo interactúan.</p>
                  
                  <div className="pt-4 border-t border-dashed first:pt-0 first:border-t-0">
                    <h4 className="font-semibold text-base">Capa 1: Nivel de Acceso y Clasificación del Documento</h4>
                    <p>
                        Tu **Nivel de Acceso** (`Público`, `Departamental`, `Jerárquico`, etc.) se compara con la **Clasificación del Documento** (`Público`, `Privado`, `Confidencial`).
                        Solo puedes ver documentos con una clasificación igual o inferior a tu nivel.
                    </p>
                    <div className="mt-2">
                        <h5 className="font-semibold">Analogía de la Llave y la Cerradura:</h5>
                        <p>Imagina que tu Nivel de Acceso es una **llave** y la Clasificación del documento es una **cerradura**.</p>
                        <ul className="list-disc pl-5 space-y-1 mt-2">
                          <li>La **Cerradura "Pública"** es la más simple; todas las llaves (`Público`, `Departamental`, etc.) pueden abrirla.</li>
                          <li>La **Cerradura "Privada"** requiere una llave de mayor nivel. Es abierta por las llaves `Departamental`, `Jerárquico`, `Ejecutivo` y `Confidencial`, pero no por la llave `Público`.</li>
                          <li>La **Cerradura "Confidencial"** es la más segura y solo puede ser abierta por las llaves más altas: `Ejecutivo` y `Confidencial`.</li>
                        </ul>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-dashed">
                    <h4 className="font-semibold text-base">Capa 2: Estructura Organizacional (Filtro Adicional)</h4>
                    <p>Si un documento **NO es Público** (es decir, es `Privado` o `Confidencial`), el sistema realiza una segunda comprobación basada en tu puesto y departamento, una vez que ya pasaste el primer filtro de clasificación:</p>
                    <ul className="list-disc pl-5 space-y-2 mt-2">
                        <li><strong>Nivel Departamental:</strong> Solo verás los documentos `Privados` que pertenezcan a **tu propio departamento**. No podrás ver documentos privados de otros departamentos.</li>
                        <li><strong>Nivel Jerárquico o Ejecutivo:</strong> Verás los documentos `Privados` de **tu departamento** y de **todos los departamentos que te reportan** (directa e indirectamente), según la estructura definida en "Jefe Inmediato" en el catálogo de Puestos.</li>
                        <li><strong>Nivel Confidencial y Rol Administrador:</strong> Tienen acceso a toda la información, sin importar el departamento o la jerarquía. Este nivel omite el filtro de estructura organizacional.</li>
                    </ul>
                  </div>
                  
                  <div className="pt-4 border-t border-dashed">
                    <h4 className="font-semibold text-base">Excepciones de Acceso</h4>
                    <p>El módulo de "Usuarios y Permisos" permite crear excepciones. Una excepción puede otorgar acceso a un documento específico a un usuario que normalmente no podría verlo, o viceversa, denegar el acceso a un documento que sí podría ver. Esto ofrece un control de seguridad aún más granular.</p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-architecture">
                <AccordionTrigger className="text-lg font-semibold">6. Registro de Cambios de Arquitectura</AccordionTrigger>
                <AccordionContent className="space-y-4 text-sm">
                  <div className="pt-4 border-t border-dashed first:pt-0 first:border-t-0">
                    <h4 className="font-semibold text-base flex items-center gap-2"><ShieldAlert className="text-amber-500" />Migración de Seguridad a Nivel de Servidor</h4>
                    <p className="font-medium text-muted-foreground text-xs">Implementado el 15 de Julio, 2025</p>
                    <p className="mt-2">
                      Para robustecer la seguridad y asegurar que los datos sensibles nunca lleguen al navegador del usuario, se ha realizado una migración completa del modelo de permisos. El filtrado de datos ya no se realiza en el navegador, sino en el servidor, utilizando la infraestructura de Firebase.
                    </p>
                    <h5 className="font-semibold mt-3">Paso 1: Delegación de Seguridad a Firestore</h5>
                    <ul className="list-disc pl-5 space-y-1 mt-2">
                      <li>
                        <strong>Actualización de Reglas de Seguridad:</strong> Se han modificado las reglas de Firestore para que utilicen los "Custom Claims" (atributos personalizados como rol y nivel de acceso) del token de autenticación de cada usuario. Esto permite que la base de datos misma valide si un usuario puede leer un documento antes de enviarlo.
                      </li>
                      <li>
                        <strong>Simplificación de Contexts:</strong> Se eliminó la lógica de filtrado de seguridad del lado del cliente (en archivos como `ProcesosContext.tsx`) para confiar en que Firestore solo enviará los datos a los que el usuario tiene permiso.
                      </li>
                    </ul>
                    <h5 className="font-semibold mt-3">Paso 2: Preparación de Contextos y Simplificación</h5>
                    <ul className="list-disc pl-5 space-y-1 mt-2">
                      <li>
                        <strong>Réplica del Patrón:</strong> La misma simplificación aplicada a `ProcesosContext` se extendió a otros contextos como `PoliticasContext` y `ExceptionsContext`, eliminando el filtrado en el cliente y preparando la aplicación para un modelo de seguridad centralizado.
                      </li>
                      <li>
                        <strong>Actualización de AuthContext:</strong> Se modificó el `AuthContext` para que, al iniciar sesión, comience a leer los Custom Claims directamente desde el token de autenticación del usuario, preparando a toda la aplicación para consumir los permisos de forma segura.
                      </li>
                    </ul>
                     <h5 className="font-semibold mt-3">Paso 3: Implementación de Cloud Functions</h5>
                    <ul className="list-disc pl-5 space-y-1 mt-2">
                       <li>
                        <strong>Gestión de Permisos Centralizada:</strong> Se ha creado una Cloud Function (`setUserRole`) que se ejecuta en el servidor. Es la única autorizada para "sellar" los permisos (`rol`, `nivelAcceso`, `departamentoId`, etc.) en el token de autenticación de un usuario.
                      </li>
                       <li>
                        <strong>Integración con la UI:</strong> El módulo de "Usuarios y Permisos" fue actualizado. En lugar de modificar los perfiles directamente, ahora llama a la Cloud Function `setUserRole` para que el servidor aplique los cambios de permisos de forma segura.
                      </li>
                    </ul>
                    <p className="mt-2"><strong>Impacto Final:</strong> Con esta arquitectura, la seguridad es máxima. Los datos sensibles son filtrados a nivel de base de datos y nunca llegan al navegador del usuario a menos que este tenga los permisos explícitos para verlos.</p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </ScrollArea>
           <Separator className="my-4" />
           <div className="text-center">
             <Link href="/acerca-de" className="text-sm font-medium text-primary hover:underline">
                Acerca de PROSCENDIA
             </Link>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}

