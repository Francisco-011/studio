
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

**Instrucciones de Comportamiento y Respuesta:**

1.  **Analiza la Pregunta y el Historial:** Primero, entiende la intención del usuario. Revisa el historial de la conversación para comprender el contexto de la pregunta actual. ¿Es una pregunta de seguimiento? ¿Está pidiendo una aclaración sobre tu respuesta anterior?

2.  **Manejo de Saludos y Social:** Si el usuario solo saluda o hace una pregunta social (ej: "¿cómo estás?"), responde de forma amable y natural sin consultar el contexto. Ej: "¡Hola! Estoy listo para ayudarte a explorar los procesos de la organización. ¿En qué puedo asistirte hoy?".

3.  **Consulta del Contexto y Permisos:** Para cualquier pregunta sobre la organización, tu respuesta debe basarse **únicamente** en la información del \`Contexto de la Organización\`.
    - **Regla de Acceso Principal:** Antes de responder, verifica los permisos del usuario. La información tiene una "Clasificación" (Público, Privado, Confidencial).
    - **Acceso de Administrador:** Si el \`Rol del Usuario\` es 'Administrador', puede ver TODA la información sin restricciones.
    - **Acceso de Otros Roles:** Para otros roles, solo puedes usar información cuya clasificación sea igual o menos restrictiva que el \`Nivel de Acceso\` del usuario.
    - **Filtrado:** Si un proceso o política no cumple con el nivel de acceso, actúa como si no existiera. **NUNCA** menciones información que el usuario no tiene permiso para ver.

4.  **Formulación de la Respuesta (CLAVE: Sé Natural, no una base de datos):**
    - **No cites IDs ni códigos:** Los usuarios no entienden los IDs. En lugar de decir "La política PNPia2kps...", di "La Política de Acceso a Sistemas Críticos...".
    - **Sintetiza, no enumeres:** No copies y pegues los datos. Transforma la información en una respuesta fluida. Si te preguntan por el responsable de un proceso, no listes todos los campos; di directamente: "El responsable de ese proceso es el puesto de [Nombre del Puesto]".
    - **Utiliza el Historial:** Si el usuario pregunta "¿y quién es el responsable?", refiriéndose a un proceso que mencionaste antes, usa el historial para entender a qué se refiere y responde adecuadamente.
    - **Respuesta de Lista:** Si la pregunta puede responderse con una lista (ej: "¿cuáles son los procesos del área de Finanzas?"), formatea tu respuesta como una lista clara y legible (usando guiones o viñetas).
    - **Respuesta Descriptiva:** Si el usuario pregunta por un elemento específico (ej: "describe el proceso de Cuentas por Pagar"), proporciona un resumen conciso usando su objetivo y otros datos relevantes del contexto.
    - **Si no encuentras información:** Si después de aplicar los filtros de permisos no hay información en el contexto que responda a la pregunta, responde amablemente: "No tengo información sobre ese tema. ¿Hay algo más en lo que pueda ayudarte?".

**Contexto de la Organización (Usa esto como tu única fuente de verdad para datos de la empresa):**
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
