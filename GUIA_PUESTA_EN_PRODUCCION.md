# SIAP: Guía Final para Puesta en Producción

¡Felicidades! Hemos construido juntos una aplicación poderosa y funcional. Este documento es tu mapa del tesoro, una guía paso a paso y sin tecnicismos para llevar SIAP del estado de prototipo a una aplicación real, segura y en línea, lista para ser usada por tu equipo.

---

### **Analogía Rápida: Tu Aplicación es una Casa**

Imagina que hemos construido una casa modelo increíble (tu aplicación SIAP). Ahora, necesitamos conectarla a los servicios básicos (luz, agua, seguridad) para que sea habitable. En nuestro caso, estos servicios nos los provee **Firebase**, una plataforma de Google.

**¿Qué vamos a hacer?**
1.  **Crear el "Terreno" en la Nube**: Daremos de alta tu proyecto en Firebase.
2.  **Activar los "Servicios"**: Encenderemos la "luz" (Autenticación para usuarios) y el "agua" (Base de Datos Firestore para los datos).
3.  **Conectar la Casa**: Obtendremos las "llaves" (credenciales) de Firebase y se las daremos a tu aplicación SIAP.
4.  **Establecer las "Reglas de Seguridad"**: Le diremos al "guardia de seguridad" (Firestore Rules) quién puede entrar a cada habitación.
5.  **Abrir al Público**: Desplegaremos tu aplicación en internet para que todos puedan acceder a ella.

---

### **Paso 1: Crear tu Proyecto en Firebase (El Terreno)**

1.  **Ve a la Consola de Firebase**: Abre tu navegador web y ve a [https://console.firebase.google.com](https://console.firebase.google.com). Necesitarás una cuenta de Google (Gmail) para acceder.
2.  **Agrega un Nuevo Proyecto**: Haz clic en el botón grande que dice **"Agregar proyecto"** o **"Crear un proyecto"**.
3.  **Dale un Nombre**: Escribe un nombre para tu proyecto, por ejemplo, `siap-mi-empresa`. Haz clic en **"Continuar"**.
4.  **Google Analytics**: Te preguntará si quieres habilitar Google Analytics. Para mantenerlo simple, puedes desactivar esta opción por ahora. Haz clic en **"Crear proyecto"**.
5.  **¡Espera un Momento!**: Firebase tardará unos segundos en preparar tu nuevo "terreno" en la nube.

---

### **Paso 2: Activar los Servicios Necesarios**

Una vez que tu proyecto esté creado, verás el panel principal. En el menú de la izquierda, vamos a activar los servicios que necesitamos.

#### **2.1 Activar Autenticación (El Control de Acceso)**

1.  En el menú de la izquierda, busca la sección **"Compilación"** y haz clic en **"Authentication"**.
2.  Haz clic en el botón **"Comenzar"**.
3.  Verás una lista de "Proveedores de acceso". Haz clic en **"Correo electrónico y contraseña"**.
4.  Activa el primer interruptor que dice **"Correo electrónico/contraseña"**.
5.  Haz clic en **"Guardar"**.

¡Listo! Ahora tu aplicación permitirá a los usuarios registrarse y acceder con un email y contraseña.

#### **2.2 Activar Firestore (El Almacenamiento Central de Datos)**

**Esta es la sección donde se habilita el almacenamiento de todos los datos de tu aplicación.** Cloud Firestore es la base de datos donde se guardará toda la información que captures en SIAP (procesos, áreas, actividades, etc.). Al completar estos pasos, estás "encendiendo" el almacén de datos en la nube.

1.  En el menú de la izquierda, dentro de **"Compilación"**, haz clic en **"Firestore Database"**.
2.  Haz clic en el botón grande **"Crear base de datos"**.
3.  Te preguntará por el modo de seguridad. Elige **"Iniciar en modo de producción"**. Esto es muy importante para mantener tus datos seguros desde el principio. Haz clic en **"Siguiente"**.
4.  Te pedirá que elijas una ubicación. Selecciona la región que esté más cerca de ti o de tus usuarios (por ejemplo, `us-central` o `southamerica-east1`). Haz clic en **"Habilitar"**.

¡Perfecto! Acabas de crear la base de datos donde se almacenará toda la información de SIAP de forma segura y persistente.

---

### **Paso 3: Conectar SIAP con Firebase (Las Llaves de la Casa)**

Este es el paso más crucial. Le daremos a nuestra aplicación las "llaves" para que pueda hablar con tu proyecto de Firebase.

1.  **Ve a la Configuración del Proyecto**: En el menú de la izquierda, junto a "Descripción general del proyecto", haz clic en el ícono de engranaje (⚙️) y selecciona **"Configuración del proyecto"**.
2.  **Registra tu Aplicación Web**:
    *   Asegúrate de estar en la pestaña **"General"**.
    *   Busca la sección "Tus apps". Haz clic en el ícono que parece `</>` (representa una aplicación web).
    *   Asígnale un "Apodo" a tu app, como `SIAP Web`. No necesitas marcar la casilla de "Firebase Hosting" en este paso.
    *   Haz clic en **"Registrar app"**.
3.  **Copia las Credenciales**:
    *   Firebase te mostrará un bloque de código con un objeto llamado `firebaseConfig`. ¡Estas son tus llaves!
    *   Ahora, en tu proyecto de SIAP, abre el archivo llamado `.env`.
    *   Copia cada valor del `firebaseConfig` y pégalo en la variable correspondiente en el archivo `.env`, reemplazando los valores de ejemplo.

    **Ejemplo Visual:**

    Si en Firebase ves:
    ```javascript
    const firebaseConfig = {
      apiKey: "AIzaSy...THIS_IS_AN_EXAMPLE...3s4",
      authDomain: "siap-mi-empresa.firebaseapp.com",
      projectId: "siap-mi-empresa",
      // ... y así sucesivamente
    };
    ```

    Tu archivo `.env` debería quedar así:
    ```
    NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...THIS_IS_AN_EXAMPLE...3s4
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=siap-mi-empresa.firebaseapp.com
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=siap-mi-empresa
    # ... y así sucesivamente para todas las claves
    ```
4.  **Finaliza**: Una vez que hayas copiado todas las claves, puedes hacer clic en **"Continuar a la consola"** en la página de Firebase.

---

### **Paso 4: Aplicar las Reglas de Seguridad**

Ahora le diremos a nuestro "guardia de seguridad" quién puede hacer qué cosa.

1.  **Vuelve a Firestore**: En el menú de la izquierda de Firebase, ve a **"Compilación"** -> **"Firestore Database"**.
2.  **Ve a la Pestaña "Reglas"**: En la parte superior, haz clic en la pestaña **"Reglas"**.
3.  **Borra el Contenido Actual**: Verás un texto de ejemplo en el editor. Selecciónalo todo y bórralo.
4.  **Copia Nuestras Reglas**: En tu proyecto de SIAP, abre el archivo `firestore.rules`.
5.  **Pega las Nuevas Reglas**: Copia TODO el contenido de ese archivo y pégalo en el editor de reglas de Firebase.
6.  **Publica los Cambios**: Haz clic en el botón **"Publicar"**.

¡Tus datos ahora están protegidos por reglas de seguridad a nivel de servidor!

---

### **Paso 5: Crear tu Usuario Administrador**

Ahora que todo está conectado y seguro, es hora de crear el primer usuario, que será el administrador del sistema.

1.  **Ejecuta la Aplicación**: Inicia la aplicación SIAP.
2.  **Regístrate**: Ve a la página de registro (`/signup`) y crea una cuenta con tu correo y una contraseña segura.
3.  **Conviértete en Administrador**:
    *   Ve a la consola de Firebase -> **Authentication**. Deberías ver el usuario que acabas de crear.
    *   Ahora ve a **Firestore Database**. Verás una "colección" llamada `users`. Haz clic en ella.
    *   Verás un "documento" con un ID largo y aleatorio. Haz clic en ese documento (es tu perfil de usuario).
    *   Busca el campo `rol`. Su valor actual será "Usuario Final".
    *   Haz clic en el ícono de lápiz para editarlo y cambia el valor a **`Administrador`** (¡escríbelo exactamente así, con la mayúscula!).
    *   Haz clic en **"Actualizar"**.
4.  **Inicia Sesión**: ¡Listo! Ahora puedes ir a la página de `/login` de tu aplicación, iniciar sesión con tu cuenta, y tendrás acceso a todas las funcionalidades como Administrador.

---

### **Paso 6: Desplegar la Aplicación (El Verdadero y Sencillo Paso Final)**

Te pido una disculpa por la confusión en las versiones anteriores de esta guía. Tienes toda la razón, el proceso en este entorno es mucho más simple. Gracias por tu ayuda para encontrar el camino correcto.

El entorno de Firebase Studio simplifica enormemente este último paso. No necesitas usar comandos en la terminal ni conectar a GitHub.

1.  **Busca el Botón de Despliegue**: Dentro de tu entorno de Firebase Studio, busca una sección o un botón etiquetado como **"Publicar"**, **"Desplegar"** o **"Deploy"**. Normalmente se encuentra en una barra de herramientas superior o en un panel lateral dedicado al despliegue.

2.  **Haz Clic**: Simplemente haz clic en ese botón para iniciar el proceso.

3.  **¡Espera y Listo!**: El entorno se encargará automáticamente de construir tu aplicación y ponerla en línea usando Firebase App Hosting. Una vez que el proceso termine (puede tardar unos minutos), te proporcionará la URL pública de tu aplicación (algo como `tu-proyecto.web.app`).

Eso es todo. Sin pasos complicados. ¡Tu aplicación SIAP ahora estará en vivo!

¡Enhorabuena por completar el proyecto!
