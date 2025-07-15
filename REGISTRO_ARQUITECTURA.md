# Registro de Decisiones de Arquitectura de PROSCENDIA

Este documento sirve como una bitácora para registrar las decisiones técnicas y cambios arquitectónicos significativos que se han implementado en la aplicación. Su objetivo es mantener un registro claro del "porqué" de la estructura actual del sistema para facilitar el mantenimiento y futuras evoluciones.

---

## 1. Migración de Seguridad a Nivel de Servidor (Julio 2025)

### Contexto del Problema:
Inicialmente, la seguridad de la aplicación (quién puede ver qué documento) se gestionaba en el lado del cliente (en el navegador del usuario) a través de los React Contexts (`ProcesosContext`, etc.). Este enfoque presentaba una vulnerabilidad de seguridad crítica: todos los datos se enviaban al navegador y un usuario con conocimientos técnicos podría inspeccionar el tráfico de red o modificar el código JavaScript para acceder a información confidencial.

### Decisión de Arquitectura:
Se decidió migrar a un modelo de seguridad "server-side" (lado del servidor), utilizando las capacidades nativas de Firebase para garantizar que los datos sensibles nunca abandonen el entorno del servidor a menos que el usuario esté explícitamente autorizado.

### Fases de Implementación:

#### **Paso 1: Delegación de Seguridad a Firestore**
*   **Acción:** Se actualizaron las `firestore.rules` (disponibles en el archivo `firestore.rules` y replicadas en `GUIA_PUESTA_EN_PRODUCCION.md`) para que utilicen los "Custom Claims" (atributos personalizados como `rol` y `nivelAcceso`) del token de autenticación de cada usuario. Se introdujo una función `canAccessDocument` que centraliza la lógica de permisos y se aplica a las reglas de lectura de las colecciones principales (`procesos`, `politicas`, etc.). Esto asegura que la propia base de datos valida los permisos antes de enviar cualquier dato.
*   **Impacto:** Se simplificó el `ProcesosContext`, eliminando la lógica de filtrado del lado del cliente y confiando en que Firestore solo enviará los datos a los que el usuario tiene permiso.

#### **Paso 2: Preparación de Contexts y Simplificación**
*   **Acción:** Se replicó el patrón de simplificación a otros contextos como `PoliticasContext` y `ExceptionsContext`, eliminando también el filtrado del lado del cliente.
*   **Impacto:** Se actualizó el `AuthContext` para que, al iniciar sesión, comience a leer los "Custom Claims" directamente desde el token de autenticación del usuario, preparando a toda la aplicación para consumir los permisos de forma segura.

#### **Paso 3: Implementación de Cloud Functions**
*   **Acción:** Se creó una Cloud Function (`setUserRole`) que se ejecuta en el servidor de Google. Esta es ahora la única entidad autorizada para "sellar" los permisos (`rol`, `nivelAcceso`, etc.) en el token de autenticación de un usuario.
*   **Impacto:** La gestión de permisos se centraliza y se vuelve segura. Un usuario no puede modificar sus propios permisos; solo una llamada autorizada desde la aplicación (realizada por un administrador) puede invocar esta función.

#### **Paso 4: Integración con la Interfaz de Usuario**
*   **Acción:** Se modificó la página de "Usuarios y Permisos" (`usuarios/page.tsx`). En lugar de escribir directamente en la base de datos, ahora llama a la Cloud Function `setUserRole` para que el servidor aplique los cambios de permisos de forma segura.
*   **Impacto:** Se completa el flujo de seguridad. La interfaz de usuario inicia una solicitud, pero la lógica de negocio y la aplicación de permisos se ejecutan íntegramente en el servidor, protegiendo la integridad del sistema.

### Resultado Final:
Con esta arquitectura, la seguridad de la aplicación es máxima y robusta. Los datos confidenciales son filtrados a nivel de base de datos y nunca llegan al navegador del usuario a menos que este tenga los permisos explícitos para verlos. La implementación se completó actualizando el archivo `firestore.rules` con la lógica de validación `canAccessDocument` y desplegando las Cloud Functions necesarias.

---

## 2. Mejora del Ciclo de Vida de Acciones (Julio 2025)

### Contexto del Problema:
Al completar una "Acción de Mejora", el sistema dependía de que el usuario recordara manualmente ir a otros módulos (como Actividades) para actualizar los tiempos o costos que se habían optimizado. Esto era propenso a errores, olvidos y resultaba en una cuantificación de ahorros imprecisa, basada en estimaciones iniciales en lugar de en el impacto real.

### Decisión de Arquitectura:
Se decidió integrar el registro del impacto de una mejora directamente en el flujo de trabajo de completado de la acción. Esto asegura que la materialización de la mejora (la actualización de los datos operativos) y su cuantificación sean un paso obligatorio y guiado, en lugar de uno manual y opcional.

### Fases de Implementación:
*   **Paso 1: Interceptación del Flujo de Completado:** En el módulo de "Acciones", se modificó la lógica para que al cambiar el estado de una acción a "Completada", en lugar de guardar directamente, se active un nuevo flujo de trabajo.
*   **Paso 2: Identificación de Actividades Afectadas:** El sistema ahora identifica automáticamente todas las actividades que están jerárquicamente relacionadas con la acción (a través de su vínculo con un proceso, procedimiento o actividad específica).
*   **Paso 3: Creación de Diálogo de Registro de Impacto:** Se implementó un nuevo diálogo modal que se presenta al usuario. Este diálogo lista las actividades afectadas y muestra sus valores actuales de tiempo y/o costo, junto con campos para ingresar el **ahorro** obtenido (no el nuevo valor final).
*   **Paso 4: Actualización Atómica y Cuantificación Automática:** Al guardar desde este nuevo diálogo, el sistema:
    1.  Calcula el ahorro total sumando los ahorros individuales ingresados.
    2.  Registra este ahorro total en el historial (`historialDeCambios`) de la acción completada para trazabilidad.
    3.  Actualiza los documentos de las actividades afectadas en la base de datos con sus nuevos valores (valor antiguo - ahorro).
    4.  Finalmente, marca la acción como "Completada".

### Resultado Final:
El ciclo de mejora continua ahora está completamente cerrado. Los ahorros que se muestran en los dashboards ya no son estimaciones, sino **datos calculados y precisos** basados en el impacto real registrado en las operaciones. Esto aumenta drásticamente la integridad de los datos del sistema y el valor de las métricas de eficiencia.
