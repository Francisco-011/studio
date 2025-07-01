# Proceza: Escenario de Pruebas Funcionales (End-to-End)

## 1. Introducción

Este documento proporciona un conjunto de casos de prueba para validar de manera integral todas las funcionalidades del sistema Proceza. El objetivo es asegurar que cada módulo funcione correctamente de forma individual y en conjunto antes de la puesta en producción.

---

## 2. Prerrequisitos

Antes de comenzar, asegúrate de haber completado los siguientes pasos de la `GUIA_PUESTA_EN_PRODUCCION.md`:
1.  **Proyecto de Firebase Creado:** Tu proyecto está configurado en la consola de Firebase.
2.  **Servicios Activados:** Authentication (con Email/Contraseña) y Firestore Database (en modo producción) están habilitados.
3.  **Credenciales Conectadas:** El archivo `.env` de tu proyecto está lleno con las credenciales de tu aplicación web de Firebase.
4.  **Reglas de Seguridad Aplicadas:** Has copiado y publicado las reglas del archivo `firestore.rules` en tu base de datos de Firestore.
5.  **Usuario Administrador Creado:** Te has registrado en la aplicación y has cambiado tu rol a "Administrador" en la base de datos de Firestore.

---

## 3. Casos de Prueba por Módulo

### **Módulo 1: Configuración (Como Administrador)**

**Objetivo:** Validar la creación, edición y eliminación de los catálogos base del sistema.

*   **Caso de Prueba 1.1: Gestión de Áreas**
    *   **Pasos:**
        1.  Ve al módulo "Configuración".
        2.  En la pestaña "Áreas", crea 3 áreas nuevas (ej: "Finanzas", "Operaciones", "Tecnología").
        3.  Verifica que aparecen en la lista.
        4.  Edita el nombre de una de ellas (ej: "Tecnología" a "TI").
        5.  Intenta eliminar el área "Operaciones".
    *   **Resultado Esperado:** Las áreas se crean y editan correctamente. La eliminación funciona sin problemas.

*   **Caso de Prueba 1.2: Gestión de Departamentos**
    *   **Pasos:**
        1.  Ve a la pestaña "Departamentos".
        2.  Crea un nuevo departamento (ej: "Contabilidad") y asígnalo al área "Finanzas".
        3.  Crea otro (ej: "Soporte Técnico") y asígnalo a "TI".
        4.  Edita el departamento "Contabilidad" para cambiar su nombre.
    *   **Resultado Esperado:** Los departamentos se crean y editan, asociándose correctamente a sus áreas.

*   **Caso de Prueba 1.3: Gestión de Puestos**
    *   **Pasos:**
        1.  Ve a la pestaña "Puestos".
        2.  Crea un puesto "Contador" y asígnalo al área "Finanzas" y departamento "Contabilidad".
        3.  Crea un puesto "Jefe de Contabilidad" y asígnalo también. Edítalo y asígnale como "Jefe Inmediato" a ti mismo (tu usuario Admin).
        4.  Intenta eliminar un puesto.
    *   **Resultado Esperado:** Los puestos se crean, se asocian correctamente y se pueden eliminar. La asignación de jefe inmediato funciona.

*   **Caso de Prueba 1.4: Gestión de Sistemas y Costos**
    *   **Pasos:**
        1.  Ve a la pestaña "Sistemas y Costos".
        2.  Crea un nuevo sistema (ej: "SAP", con alcance "Empresa").
        3.  Expande el sistema "SAP" y agrega un costo (ej: "Licencia Anual", Frecuencia: Anual, Monto: 50000, Moneda: USD).
        4.  Verifica que el costo anual total se actualiza.
        5.  Edita y elimina el costo.
    *   **Resultado Esperado:** El sistema y sus costos asociados se gestionan correctamente. El cálculo del costo anual es correcto.

---

### **Módulo 2: Captura y Gestión de Procesos (Como Administrador o Consultor)**

**Objetivo:** Validar el ciclo completo de vida de un proceso, desde su captura hasta su inactivación.

*   **Caso de Prueba 2.1: Capturar un Proceso Completo**
    *   **Pasos:**
        1.  Ve al módulo "Captura".
        2.  Completa todos los campos para un nuevo proceso, por ejemplo: "Proceso de Cierre Contable Mensual", asignándolo al área "Finanzas" y puesto "Jefe de Contabilidad".
        3.  En "Sistemas", selecciona "SAP".
        4.  Define entradas y salidas, vinculando a procesos si existen o marcando como "Iniciador"/"Finalizador".
        5.  Haz clic en "Guardar y Definir Procedimientos".
        6.  En la siguiente pantalla, agrega un procedimiento llamado "Revisión de Cuentas".
        7.  Guarda y finaliza.
    *   **Resultado Esperado:** El proceso se crea y redirige correctamente. El procedimiento se asocia. El nuevo proceso aparece en la página "Procesos Registrados".

*   **Caso de Prueba 2.2: Gestión en "Procesos Registrados"**
    *   **Pasos:**
        1.  Ve a "Procesos Registrados".
        2.  Busca tu proceso "Cierre Contable".
        3.  Expande el proceso para ver sus detalles y el procedimiento "Revisión de Cuentas".
        4.  Usa el interruptor para "Inactivar" el proceso.
        5.  Usa los filtros de la parte superior para buscar por estado "Inactivo".
    *   **Resultado Esperado:** Los detalles se muestran correctamente. El cambio de estado funciona y los filtros responden como se espera.

---

### **Módulo 3: Políticas y Cumplimiento (Como Administrador)**

**Objetivo:** Validar el ciclo de vida y la vinculación de las políticas.

*   **Caso de Prueba 3.1: Ciclo de Vida de una Política**
    *   **Pasos:**
        1.  Ve al módulo "Políticas".
        2.  Crea una nueva política (ej: "Política de Acceso a SAP"). Rellena todos los campos, incluyendo consecuencias y referencias. El estado inicial debe ser "Borrador".
        3.  Desde el menú de acciones, envíala "A Revisión".
        4.  Desde el menú de acciones, "Apruébala".
        5.  Intenta editar la política aprobada (debería estar bloqueado).
        6.  Desde el menú de acciones, regrésala a "Borrador" (simulando una nueva versión).
        7.  Ahora sí, edítala y guarda los cambios.
    *   **Resultado Esperado:** El flujo de estados funciona correctamente. Las restricciones de edición para políticas aprobadas se aplican.

*   **Caso de Prueba 3.2: Vinculación de Política**
    *   **Pasos:**
        1.  Edita la política "Política de Acceso a SAP".
        2.  Haz clic en "Vincular a Elementos".
        3.  En la pestaña "Procesos", selecciona "Proceso de Cierre Contable Mensual" y asígnale el tipo de vínculo "Regula".
        4.  Guarda los cambios.
        5.  Ve al "Panel Jerárquico" y expande hasta ver tu proceso.
    *   **Resultado Esperado:** La política aparece vinculada al proceso en el Panel Jerárquico con la insignia "Regula".

---

### **Módulo 4: Flujos de Trabajo (Panel Jerárquico)**

**Objetivo:** Validar la construcción de flujos de trabajo y la visualización de la gobernanza.

*   **Caso de Prueba 4.1: Asignar Actividades a Procedimientos**
    *   **Pasos:**
        1.  Primero, ve a "Actividades" y crea una nueva actividad llamada "Validar Saldos de Cuentas".
        2.  Ve al "Panel Jerárquico".
        3.  En el árbol de la izquierda, expande hasta encontrar "Proceso de Cierre Contable Mensual" y su procedimiento "Revisión de Cuentas".
        4.  En el "Pool de Actividades" de la derecha, busca "Validar Saldos de Cuentas".
        5.  Arrastra la actividad desde el pool y suéltala sobre el procedimiento "Revisión de Cuentas".
    *   **Resultado Esperado:** La actividad aparece anidada dentro del procedimiento en el árbol, indicando que ha sido asignada correctamente.

---

### **Módulo 5: Inteligencia Artificial (Como Administrador o Consultor)**

**Objetivo:** Validar que los módulos de IA procesan la información y generan resultados coherentes.

*   **Caso de Prueba 5.1: Análisis de Ineficiencias**
    *   **Pasos:**
        1.  Ve a "Análisis IA".
        2.  Haz clic en "Analizar Ineficiencias con IA".
        3.  Selecciona el proceso, actividades y sistemas que creaste en los pasos anteriores.
        4.  Ejecuta el análisis.
    *   **Resultado Esperado:** La IA devuelve un resumen. No debería encontrar duplicados (ya que todo es nuevo), pero debería procesar la información sin errores.

*   **Caso de Prueba 5.2: Consulta Conversacional**
    *   **Pasos:**
        1.  Ve a "Consulta IA".
        2.  Escribe la pregunta: "¿Qué políticas regulan el Proceso de Cierre Contable Mensual?".
    *   **Resultado Esperado:** El asistente de IA debe responder mencionando la "Política de Acceso a SAP" que vinculaste anteriormente.

---

### **Módulo 6: Usuarios y Permisos (Como Administrador y Usuario Final)**

**Objetivo:** Validar que el sistema de roles y permisos funciona correctamente.

*   **Caso de Prueba 6.1: Gestión de Permisos (Admin)**
    *   **Pasos:**
        1.  Ve a "Usuarios y Permisos".
        2.  Selecciona la pestaña "Roles y Permisos".
        3.  Elige el rol "Usuario Final".
        4.  Desmarca el permiso "Ver Dash. Procesos" dentro de la sección "Dashboards".
        5.  Guarda los cambios.
    *   **Resultado Esperado:** El cambio de permiso se guarda.

*   **Caso de Prueba 6.2: Verificación de Permisos (Usuario Final)**
    *   **Pasos:**
        1.  Cierra la sesión de Administrador.
        2.  Regístrate como un nuevo usuario (ej: `usuario.final@test.com`).
        3.  Inicia sesión con esta nueva cuenta.
        4.  Navega al menú lateral y expande la sección "Dashboard".
    *   **Resultado Esperado:** El sub-menú "Procesos y Eficiencia" NO debe ser visible para este usuario, confirmando que el sistema de permisos está funcionando.

¡Felicidades por llegar hasta aquí! Completar este escenario de pruebas te dará una gran confianza en la calidad y robustez de tu aplicación.