# SIAP: Roadmap to Production

This document outlines the necessary steps to transition the SIAP prototype into a secure, multi-user, production-ready application using the Firebase platform.

---

### Step 1: Data Persistence with Cloud Firestore

**The Challenge:**
Currently, all application data (processes, areas, activities, etc.) is stored in the browser's `localStorage`. This is not suitable for production as data is not shared between users, is not persistent, and is insecure.

**The Solution:**
Migrate all data management from the React Contexts (`/src/contexts/*.tsx`) to use **Cloud Firestore**, a secure, real-time, and scalable NoSQL database.

**Action Items:**
1.  **Set up Firestore:** Create a Cloud Firestore database in your Firebase project console.
2.  **Refactor Contexts:** Modify each context file (e.g., `AreasContext.tsx`, `PuestosContext.tsx`) to read from and write to Firestore collections.
    -   Replace `localStorage.getItem` with `onSnapshot` from the Firebase SDK to listen for real-time data changes.
    -   Replace logic that modifies the local state array with `addDoc`, `updateDoc`, and `deleteDoc` to change data directly in Firestore.

---

### Step 2: User Access Control with Firebase Authentication

**The Challenge:**
The current user management system is a simulation. There is no real login, and permissions are handled on the client-side, which is not secure.

**The Solution:**
Implement **Firebase Authentication** to handle user sign-up, sign-in, and session management securely.

**Action Items:**
1.  **Enable Auth Provider:** In the Firebase console, enable an authentication method (e.g., Email/Password, Google Sign-In).
2.  **Create Login Flow:** Build a dedicated login page and the UI for user registration.
3.  **Protect Routes:** Wrap the application layout to ensure only authenticated users can access the system.
4.  **User Profile Collection:** Create a `users` collection in Firestore. When a new user signs up via Firebase Auth, create a document for them in this collection, storing their role (`Administrador`, `Consultor`, etc.). This document's ID should be the user's UID from Firebase Auth.

---

### Step 3: Server-Side Security with Firestore Security Rules

**The Challenge:**
The permissions defined in `usuarios/page.tsx` are purely cosmetic. A savvy user could bypass them since they are only enforced in the browser.

**The Solution:**
Implement **Firestore Security Rules**. These are rules you write on the Firebase server that are the ultimate, non-bypassable authority on who can access data.

**Action Items:**
1.  **Write Rules:** Define access controls in the `firestore.rules` file in your project.
2.  **Rule Logic:** The rules will use `request.auth.uid` to get the current user's ID and then check their role in the `users` collection in Firestore.
3.  **Example Rules:**
    -   *Allow any signed-in user to read a process:*
        ```
        match /procesos/{processId} {
          allow read: if request.auth != null;
        }
        ```
    -   *Only allow users with the 'Administrador' role to delete a process:*
        ```
        match /procesos/{processId} {
          allow delete: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.rol == 'Administrador';
        }
        ```

---

### Step 4: Deployment & Hosting

**The Challenge:**
The application is currently running in a local development environment.

**The Solution:**
Deploy the application using **Firebase App Hosting**.

**Action Items:**
1.  **Configuration:** The `apphosting.yaml` file is already set up for a basic deployment.
2.  **Follow the Wizard**: In the Firebase console, navigate to App Hosting and follow the on-screen wizard. It will guide you through connecting your codebase and initiating the deployment.
3.  **Benefits:** This provides secure (HTTPS), scalable, and globally-distributed hosting for the SIAP application with minimal configuration.

---
### **(Detailed) Step 6: Deploying the Application (Going Live)**

This is the final step to make your application accessible from anywhere via a public URL. Deployment is done using commands in your development environment's terminal (like the one integrated in Firebase Studio).

1.  **Go to App Hosting**: In the Firebase menu on the left, go to **"Build"** -> **"App Hosting"**.
2.  **Start Deployment**: Click the blue button to create your first backend (it might say "Get started", "Create backend", etc.).
3.  **Follow the Initial Wizard**:
    *   You will be asked to **enable some APIs**. Click "Continue" or "Enable".
    *   You will be asked to select a **code repository**. This is the important part: **Ignore the GitHub/GitLab options**. Look for a link or text that says **"Set up manually"** or **"Deploy from the CLI"**.
4.  **Copy the Terminal Commands**: When you select the manual setup, the Firebase console will display a series of **commands to run in your terminal**. Follow these steps carefully:
    *   **Command 1: `gcloud auth login`**
        *   Copy this command and paste it into your terminal.
        *   A browser window will open asking you to log in with your Google account. Do so.
        *   Return to the terminal when finished.
    *   **Command 2: `gcloud config set project [YOUR_PROJECT_ID]`**
        *   **Important!** The console will give you this command with your project ID already filled in.
        *   Copy the entire command (with your ID) and paste it into the terminal.
    *   **Command 3: `gcloud apphosting backends deploy [BACKEND_ID] --source=.`**
        *   This is the final command. The console will provide it with the correct name for your backend.
        *   Copy the full command and paste it into the terminal.
5.  **Wait for Deployment**: This last command will start uploading your code, building the application in the cloud, and deploying it. This process can take several minutes. You'll see a lot of text in your terminal; this is normal.
6.  **Your Application is Live!**: Once the terminal finishes, the Firebase console will update and show you the public URL of your application (something like `your-project.web.app`). That's the live address of your SIAP application!
