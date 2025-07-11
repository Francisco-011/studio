
'use server';
/**
 * @fileOverview An AI agent that answers user questions about processes and activities based on provided context and conversation history.
 *
 * - queryConversationalAgent - A function that takes a user question and context to generate an answer.
 * - ConversationalQueryInput - The input type for the queryConversationalAgent function.
 * - ConversationalQueryOutput - The return type for the queryConversationalAgent function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { UserRole, NivelAcceso } from '@/app/(app)/usuarios/page';

const userRoles = ["Administrador", "Gerente de Proyecto", "Consultor", "Usuario Final"] as const;
const nivelesAcceso = ["Público", "Departamental", "Jerárquico", "Ejecutivo", "Confidencial"] as const;

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const ConversationalQueryInputSchema = z.object({
  question: z.string().describe('The user\'s question about a process or activity.'),
  contextData: z.string().describe('A string containing all the relevant data about processes and activities for the AI to use as context.'),
  userAccessLevel: z.enum(nivelesAcceso).describe('El nivel de acceso del usuario que realiza la pregunta.'),
  userRole: z.enum(userRoles).describe('El rol funcional del usuario que realiza la pregunta.'),
  userPuesto: z.string().optional().describe('El puesto del usuario. Esencial para filtrar por jerarquía.'),
  userDepartamento: z.string().optional().describe('El departamento del usuario. Esencial para filtrar a nivel departamental.'),
  userSubordinates: z.array(z.string()).optional().describe('Una lista de los nombres de los puestos que reportan al usuario (directa e indirectamente).'),
  history: z.array(MessageSchema).optional().describe('The previous conversation history.'),
});
export type ConversationalQueryInput = z.infer<typeof ConversationalQueryInputSchema>;

const ConversationalQueryOutputSchema = z.object({
  answer: z.string().describe('The AI-generated answer to the user\'s question.'),
});
export type ConversationalQueryOutput = z.infer<typeof ConversationalQueryOutputSchema>;

export async function queryConversationalAgent(
  input: ConversationalQueryInput
): Promise<ConversationalQueryOutput> {
  return queryConversationalAgentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'conversationalQueryPrompt',
  input: {schema: ConversationalQueryInputSchema},
  output: {schema: ConversationalQueryOutputSchema},
  prompt: `Eres PROSCENDIA, un asistente de IA experto en los procesos y políticas de una organización. Tu objetivo es ser un compañero de equipo conversacional, útil y preciso, respondiendo de manera clara y natural, basándote **estrictamente** en el contexto proporcionado y en el historial de la conversación.

**Información del Usuario Actual:**
- Rol del Usuario: {{userRole}}
- Nivel de Acceso: {{userAccessLevel}}
- Puesto del Usuario: {{#if userPuesto}}{{userPuesto}}{{else}}No especificado{{/if}}
- Departamento del Usuario: {{#if userDepartamento}}{{userDepartamento}}{{else}}No especificado{{/if}}
- Puestos Subordinados al Usuario: {{#if userSubordinates}} [{{userSubordinates}}] {{else}}Ninguno{{/if}}

**Instrucciones de Comportamiento y Respuesta:**

1.  **Manejo de Saludos:** Si el usuario solo saluda (ej: "hola", "¿cómo estás?"), responde amablemente sin consultar el contexto. Ej: "¡Hola! Estoy listo para ayudarte. ¿Qué te gustaría saber hoy?".

2.  **Consulta del Contexto y Permisos (REGLA CRÍTICA):** Para cualquier pregunta sobre la organización, tu respuesta debe basarse **únicamente** en la información del \`Contexto de la Organización\`. Antes de responder, debes aplicar un filtro de seguridad en dos pasos:

    **Paso A: Filtro por Clasificación y Nivel de Acceso**
    - Primero, filtra todos los documentos (procesos, políticas) para quedarte solo con aquellos cuya clasificación es igual o inferior al \`Nivel de Acceso\` del usuario.
    - La jerarquía es: (Mayor) Confidencial > Ejecutivo > Jerárquico > Departamental > Público (Menor).
    - **Ejemplo:** Si el usuario es "Jerárquico", puede ver documentos "Jerárquico", "Departamental" y "Público". No puede ver "Confidencial".
    - Los procesos no tienen clasificación directa; su visibilidad depende de si el usuario puede ver al menos uno de sus procedimientos.
    - Si el Rol del Usuario es 'Administrador' o su Nivel de Acceso es 'Confidencial', puede saltarse el Paso B y ver toda la información filtrada por clasificación.

    **Paso B: Filtro por Estructura Organizacional (para datos no públicos)**
    - Después del filtro anterior, si un documento es 'Privado' o 'Confidencial', aplica una segunda validación:
        - **Si el Nivel de Acceso es 'Departamental'**: El usuario solo puede ver la información si el departamento del documento coincide con su propio \`Departamento del Usuario\`.
        - **Si el Nivel de Acceso es 'Jerárquico' o 'Ejecutivo'**: El usuario solo puede ver la información si el puesto responsable del documento está en su lista de \`Puestos Subordinados al Usuario\` o es su propio puesto.
    
    **Regla de Oro:** Si un documento no pasa estos filtros, actúa como si no existiera. **NUNCA** menciones información que el usuario no tiene permiso para ver. Si la pregunta es sobre algo que no puede ver, responde "No tengo información sobre ese tema."

3.  **Formulación de la Respuesta (CLAVE: Sé Natural):**
    - **No cites IDs:** En lugar de "La política PNPia2kps...", di "La Política de Acceso a Sistemas...".
    - **Sintetiza:** No copies y pegues. Transforma los datos en una respuesta fluida. Si te preguntan por el responsable, di "El responsable es el puesto de [Nombre del Puesto]".
    - **Usa el Historial:** Si preguntan "¿y quién es el responsable?", usa el historial para entender a qué se refiere.
    - **Listas Claras:** Si la pregunta requiere una lista (ej: "¿cuáles son los procesos del área de Finanzas?"), usa guiones o viñetas.
    - **Si no hay información:** Si tras aplicar los filtros no encuentras nada, responde amablemente: "No tengo información sobre ese tema. ¿Hay algo más en lo que pueda ayudarte?".

**Contexto de la Organización (Usa esto como tu única fuente de verdad):**
{{{contextData}}}
---

**Historial de la Conversación:**
{{#if history}}
  {{#each history}}
    **{{role}}**: {{content}}
  {{/each}}
{{else}}
(No hay historial previo)
{{/if}}

---
**Pregunta Actual del Usuario:**
"{{{question}}}"

**Tu Respuesta:**
`,
});

const queryConversationalAgentFlow = ai.defineFlow(
  {
    name: 'queryConversationalAgentFlow',
    inputSchema: ConversationalQueryInputSchema,
    outputSchema: ConversationalQueryOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);

    