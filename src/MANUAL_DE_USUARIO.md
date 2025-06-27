
# Manual de Usuario SIAP

## 1. Introducción a SIAP

### ¿Qué es SIAP?
SIAP (Sistema Integral de Análisis de Procesos) es una herramienta diseñada para ayudarte a mapear, analizar, optimizar y gestionar los procesos de negocio de tu organización. Desde la captura detallada de un flujo de trabajo hasta el análisis con Inteligencia Artificial para detectar ineficiencias, SIAP te proporciona una visión completa y accionable de cómo opera tu empresa.

### Objetivos del Sistema
- **Centralizar la Información:** Crear un repositorio único y estandarizado de todos los procesos. Su beneficio es eliminar la dispersión de documentos (Word, Excel, Visio) y asegurar que todos consulten la misma versión de la verdad, facilitando la capacitación y la consistencia.
- **Mejorar la Eficiencia:** Identificar cuellos de botella, duplicidades de tareas y redundancias de sistemas. El beneficio directo es la reducción de costos operativos y la optimización del tiempo de los empleados.
- **Facilitar la Toma de Decisiones:** Proporcionar datos y métricas claras sobre el rendimiento de los procesos (tiempos, costos, frecuencia). Esto permite a la gerencia tomar decisiones estratégicas basadas en datos reales y no en suposiciones.
- **Impulsar la Mejora Continua:** Gestionar y dar seguimiento a las iniciativas de optimización de principio a fin, cuantificando su impacto. El beneficio es la creación de una cultura de mejora continua en la organización.

---

## 2. Descripción de Módulos

### Dashboard (Resumen Ejecutivo)
**Función:** Es la pantalla de bienvenida y el centro de mando. Ofrece una vista rápida de los indicadores clave (KPIs) más importantes del sistema.
**Beneficios:** Permite tener un pulso rápido de la salud operativa de la organización y sirve como punto de acceso rápido a los dashboards especializados para un análisis más profundo.

### Captura
**Función:** El corazón del sistema. En este módulo se registran nuevos procesos, detallando quién lo hace (área/puesto), qué hace (descripción), cómo lo hace (métricas de tiempo/costo), qué necesita (entradas) y qué produce (salidas).
**Beneficios:** Estandariza la forma en que se documentan los procesos, asegurando que toda la información relevante sea capturada de manera consistente.

### Procesos Registrados
**Función:** Un centro de gestión donde puedes buscar, filtrar, ver detalles, editar, activar o inactivar procesos existentes.
**Beneficios:** Proporciona un repositorio central y fácilmente consultable de todo el conocimiento de procesos de la empresa. Facilita la gestión del ciclo de vida de cada proceso.

### Actividades
**Función:** Funciona como un catálogo maestro de todas las tareas o pasos individuales que pueden formar parte de un proceso.
**Beneficios:** Permite la estandarización del trabajo a nivel granular. Una misma actividad (ej. "Aprobar factura") puede ser reutilizada en múltiples procesos, asegurando consistencia y facilitando el análisis de duplicidades.

### Panel Jerárquico
**Función:** Una vista interactiva que muestra la estructura organizativa y los procesos que dependen de cada uno. Permite vincular actividades a procesos arrastrando y soltando (drag & drop).
**Beneficios:** Ofrece una visión clara de cómo se distribuye el trabajo en la organización y es la herramienta principal para construir los flujogramas de actividades de cada proceso de manera visual e intuitiva.

### Análisis IA (Mejoras)
**Función:** Módulo de inteligencia artificial que examina los datos capturados para encontrar posibles duplicidades, sistemas redundantes y otras oportunidades de mejora.
**Beneficios:** Automatiza el trabajo de análisis que llevaría semanas a un equipo humano, descubriendo ineficiencias ocultas y sugiriendo mejoras accionables.

### Acciones
**Función:** Permite crear, asignar, dar seguimiento y cuantificar el impacto de cada iniciativa de mejora, desde su concepción hasta su finalización.
**Beneficios:** Convierte las ideas y hallazgos en proyectos concretos y medibles, asegurando que las oportunidades de mejora no se queden en el papel y se pueda demostrar su valor.

### Auditoría y Cumplimiento
**Función:** Permite realizar auditorías formales sobre procesos, puestos o sistemas. Se pueden registrar hallazgos (conformes, no conformes) y generar planes de acción. También incluye un registro de actividad de todo el sistema.
**Beneficios:** Facilita las labores de control interno, auditoría y cumplimiento normativo, manteniendo un registro trazable de las revisiones y sus resultados.

### Configuración
**Función:** El panel de control administrativo. Aquí se gestionan las listas maestras (Áreas, Departamentos, Puestos, Sistemas) y se realizan cargas masivas de datos.
**Beneficios:** Mantiene la integridad de los datos del sistema y permite una configuración y actualización rápida y eficiente de la información base.

### Usuarios y Permisos
**Función:** Desde aquí, un Administrador puede gestionar los roles de los usuarios y definir qué puede hacer cada rol dentro del sistema.
**Beneficios:** Asegura que cada usuario tenga acceso únicamente a la información y funciones que le corresponden, protegiendo la integridad y confidencialidad de los datos.

---

## 3. Guía de Uso por Módulo

### Cómo Capturar un Nuevo Proceso
1.  Ve al módulo **"Captura"**.
2.  Rellena la jerarquía: selecciona el Área, Departamento (opcional) y Puesto responsable.
3.  Asigna un nombre claro y descriptivo al proceso.
4.  Describe detalladamente su propósito, alcance, inicio y fin.
5.  Completa las métricas: frecuencia, tiempos y costos (estimados vs. ideales).
6.  Define el flujo de información: qué información recibe (entradas) y de qué procesos, y qué información entrega (salidas) y a qué procesos.
7.  Haz clic en "Guardar y Definir Actividades". Al guardar, serás redirigido a una pantalla para detallar las actividades en orden.

### Cómo Vincular Actividades en el Panel Jerárquico
Este panel es clave para estandarizar el trabajo.
1.  Navega por el árbol de la izquierda para encontrar el proceso que quieres detallar. Puedes expandir las áreas y puestos.
2.  En el "Pool de Actividades" de la derecha, busca la actividad que quieres asignar. Puedes usar los filtros para encontrarla rápidamente.
3.  **Arrastra la actividad** desde el pool y **suéltala sobre el nombre del proceso** en el árbol.
4.  La actividad ahora está vinculada. Puedes reordenarla arrastrándola por encima o por debajo de otras actividades dentro del mismo proceso.

### Cómo Realizar un Análisis con IA
1.  Ve a **"Análisis IA"**.
2.  Haz clic en el botón "Analizar Ineficiencias con IA".
3.  Se abrirá una ventana para que selecciones qué procesos, actividades y sistemas quieres que la IA examine. Para mejores resultados, selecciona un conjunto coherente de elementos (ej. todos los procesos de un área).
4.  Tras la selección, ejecuta el análisis. La IA te devolverá un resumen y listas de posibles duplicidades o redundancias.
5.  Si los hallazgos son acertados, puedes generar "Acciones de Mejora" directamente desde los resultados, las cuales aparecerán en el módulo de "Acciones" listas para ser gestionadas.
