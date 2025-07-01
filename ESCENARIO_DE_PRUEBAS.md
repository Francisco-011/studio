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
5.  **Creación de Usuarios de Prueba:**
    *   **Usuario Administrador:** Regístrate con tu correo principal. En Firestore, ve a `users/{tu-id}` y asigna:
        *   `rol`: "Administrador"
        *   `nivelAcceso`: "Confidencial"
    *   **Usuario Gerente:** Regístrate con un segundo correo (ej: `gerente@test.com`). Asigna:
        *   `rol`: "Gerente de Proyecto"
        *   `nivelAcceso`: "Jerárquico"
    *   **Usuario Final:** Regístrate con un tercer correo (ej: `empleado@test.com`). Asigna:
        *   `rol`: "Usuario Final"
        *   `nivelAcceso`: "Público"

---

## 3. Casos de Prueba por Módulo

### **Módulo 1: Configuración (Como Administrador)**

**Objetivo:** Validar la creación, edición y eliminación de los catálogos base del sistema.

*   **Caso de Prueba 1.1: Gestión de Áreas**
    *   **Pasos:**
        1.  Inicia sesión como **Administrador**.
        2.  Ve al módulo "Configuración".
        3.  En la pestaña "Áreas", crea 3 áreas nuevas (ej: "Finanzas", "Operaciones", "Tecnología").
        4.  Verifica que aparecen en la lista.
        5.  Edita el nombre de una de ellas (ej: "Tecnología" a "TI").
        6.  Intenta eliminar el área "Operaciones".
    *   **Resultado Esperado:** Las áreas se crean, editan y eliminan correctamente.

*   **Caso de Prueba 1.2: Gestión de Departamentos y Puestos**
    *   **Pasos:**
        1.  Ve a la pestaña "Departamentos". Crea "Contabilidad" (en Finanzas) y "Soporte Técnico" (en TI).
        2.  Ve a la pestaña "Puestos". Crea un puesto "Contador" y "Jefe de Contabilidad" en "Finanzas"/"Contabilidad".
    *   **Resultado Esperado:** Los departamentos y puestos se crean y asocian correctamente.

---

### **Módulo 2: Captura y Gestión de Procesos (Como Administrador)**

**Objetivo:** Validar la captura de procesos con distintas clasificaciones de seguridad.

*   **Caso de Prueba 2.1: Capturar un Proceso Privado**
    *   **Pasos:**
        1.  Ve al módulo "Captura".
        2.  Crea un nuevo proceso: "Cierre Contable Mensual", asignado a "Finanzas" y "Jefe de Contabilidad".
        3.  **Importante:** En "Clasificación de Visibilidad", selecciona **"Privado"**.
        4.  Guarda y en la siguiente pantalla, añade un procedimiento llamado "Revisión de Cuentas".
    *   **Resultado Esperado:** El proceso se crea con clasificación "Privado".

*   **Caso de Prueba 2.2: Capturar un Proceso Público**
    *   **Pasos:**
        1.  Ve a "Captura".
        2.  Crea un nuevo proceso: "Solicitud de Vacaciones", asignado a "Operaciones".
        3.  **Importante:** En "Clasificación de Visibilidad", selecciona **"Público"**.
        4.  Guarda y añade un procedimiento llamado "Aprobación de Solicitud".
    *   **Resultado Esperado:** El proceso se crea con clasificación "Público".

---

### **Módulo 3: Políticas y Cumplimiento (Como Administrador)**

**Objetivo:** Validar el ciclo de vida y la vinculación de las políticas.

*   **Caso de Prueba 3.1: Ciclo de Vida de una Política**
    *   **Pasos:**
        1.  Ve al módulo "Políticas".
        2.  Crea una nueva política: "Política de Acceso a SAP". En "Clasificación", ponla como **"Privado"**. El estado inicial debe ser "Borrador".
        3.  Desde el menú de acciones, envíala **"A Revisión"**. El estado cambia.
        4.  Desde el menú, **"Apruébala"**. El estado cambia a "Aprobada".
        5.  Intenta editar la política aprobada. **Debería estar bloqueado.**
        6.  Desde el menú, regrésala a **"Borrador"** (simulando una nueva versión).
        7.  Ahora sí, edítala y guarda los cambios.
    *   **Resultado Esperado:** El flujo de estados funciona. Las restricciones de edición se aplican.

*   **Caso de Prueba 3.2: Vinculación de Política**
    *   **Pasos:**
        1.  Edita la política "Política de Acceso a SAP".
        2.  Haz clic en "Vincular a Elementos".
        3.  En la pestaña "Procesos", selecciona "Proceso de Cierre Contable Mensual" y asígnale el tipo de vínculo "Regula".
        4.  Guarda y ve al "Panel Jerárquico".
    *   **Resultado Esperado:** La política aparece vinculada al proceso en el Panel Jerárquico.

---

### **Módulo 4: Flujos de Trabajo (Panel Jerárquico) (Como Administrador)**

**Objetivo:** Validar la construcción de flujos y la correcta visualización de la gobernanza.

*   **Caso de Prueba 4.1: Asignar Actividades y Ver Políticas**
    *   **Pasos:**
        1.  Primero, ve a "Actividades" y crea "Validar Saldos de Cuentas".
        2.  Ve al "Panel Jerárquico". Expande hasta encontrar "Proceso de Cierre Contable Mensual" -> "Revisión de Cuentas".
        3.  Arrastra la actividad "Validar Saldos" desde el pool y suéltala sobre el procedimiento.
        4.  Expande el proceso y verifica que puedes ver la "Política de Acceso a SAP" vinculada con la insignia "Regula".
    *   **Resultado Esperado:** La actividad se asigna y la política vinculada es visible.

---

### **Módulo 5: Usuarios y Permisos (Validación Multinivel)**

**Objetivo:** Validar que los niveles de acceso a la información funcionen correctamente.

*   **Caso de Prueba 5.1: Vista del Usuario Final**
    *   **Pasos:**
        1.  Cierra sesión de Administrador.
        2.  Inicia sesión como **Usuario Final** (`empleado@test.com`).
        3.  Ve a "Procesos Registrados".
    *   **Resultado Esperado:**
        *   **DEBES** ver el proceso "Solicitud de Vacaciones" (Público).
        *   **NO DEBES** ver el proceso "Cierre Contable Mensual" (Privado).

*   **Caso de Prueba 5.2: Vista del Gerente**
    *   **Pasos:**
        1.  Cierra sesión.
        2.  Inicia sesión como **Usuario Gerente** (`gerente@test.com`).
        3.  Ve a "Procesos Registrados".
    *   **Resultado Esperado:**
        *   **DEBES** ver el proceso "Solicitud de Vacaciones" (Público).
        *   **DEBES** ver el proceso "Cierre Contable Mensual" (Privado).

---

### **Módulo 6: Inteligencia Artificial (Validación con Permisos)**

**Objetivo:** Validar que la IA respete los niveles de acceso.

*   **Caso de Prueba 6.1: Consulta IA como Usuario Final**
    *   **Pasos:**
        1.  Inicia sesión como **Usuario Final**.
        2.  Ve a "Consulta IA".
        3.  Escribe la pregunta: **"¿Qué políticas regulan el Proceso de Cierre Contable Mensual?"**.
    *   **Resultado Esperado:** El asistente de IA debe responder con un mensaje genérico como **"No tengo información sobre ese tema"**, porque el proceso es privado y el usuario es público.

*   **Caso de Prueba 6.2: Consulta IA como Gerente**
    *   **Pasos:**
        1.  Inicia sesión como **Usuario Gerente**.
        2.  Ve a "Consulta IA".
        3.  Escribe la misma pregunta: **"¿Qué políticas regulan el Proceso de Cierre Contable Mensual?"**.
    *   **Resultado Esperado:** El asistente de IA **DEBE** responder mencionando la "Política de Acceso a SAP" que vinculaste anteriormente.

*   **Caso de Prueba 6.3: Análisis IA como Administrador**
    *   **Pasos:**
        1.  Inicia sesión como **Administrador**.
        2.  Ve a "Análisis IA" y ejecuta el análisis.
    *   **Resultado Esperado:** La IA debe procesar toda la información sin errores y podría sugerir gaps de políticas si los hubiera (ej: proceso público sin política asociada).

¡Felicidades por llegar hasta aquí! Completar este escenario de pruebas te dará una gran confianza en la calidad, seguridad y robustez de tu aplicación.