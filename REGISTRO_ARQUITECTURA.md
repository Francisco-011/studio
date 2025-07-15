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
Con esta arquitectura, la seguridad de la aplicación es máxima y robusta. Los datos confidenciales son filtrados a nivel de base de datos y nunca llegan al navegador del usuario a menos que este tenga los permisos explícitos para verlos.
