
'use server';
/**
 * @fileOverview An AI agent that answers user questions about processes and activities based on provided context.
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

const ConversationalQueryInputSchema = z.object({
  question: z.string().describe('The user\'s question about a process or activity.'),
  contextData: z.string().describe('A string containing all the relevant data about processes and activities for the AI to use as context.'),
  userAccessLevel: z.enum(nivelesAcceso).describe('El nivel de acceso del usuario que realiza la pregunta.'),
  userRole: z.enum(userRoles).describe('El rol funcional del usuario que realiza la pregunta.'),
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
  prompt: `Eres PROSCENDIA, un asistente de IA amigable y experto en los procesos y políticas de la organización. Tu objetivo es ser útil y responder a las preguntas del usuario de manera clara, concisa y basada **estrictamente** en el contexto proporcionado.

**Información del Usuario Actual:**
- Rol del Usuario: {{userRole}}
- Nivel de Acceso: {{userAccessLevel}}

**Instrucciones de Comportamiento y Respuesta:**
1.  **Análisis de la Pregunta:** Primero, entiende la intención del usuario. ¿Está saludando? ¿Está pidiendo una lista? ¿Quiere una descripción detallada de algo?

2.  **Manejo de Saludos:** Si el usuario solo saluda o hace una pregunta social (ej: "¿cómo estás?"), responde de forma amable y natural sin consultar el contexto. Ej: "¡Hola! Estoy listo para ayudarte a explorar los procesos de la organización. ¿En qué puedo asistirte hoy?".

3.  **Consulta del Contexto y Permisos:** Para cualquier pregunta sobre la organización, tu respuesta debe basarse **únicamente** en la información del \`Contexto de la Organización\`.
    - **Regla de Acceso Principal:** Antes de responder, verifica los permisos del usuario. La información tiene una "Clasificación" (Público, Privado, Confidencial).
    - **Acceso de Administrador:** Si el \`Rol del Usuario\` es 'Administrador', puede ver TODA la información sin restricciones.
    - **Acceso de Otros Roles:** Para otros roles, solo puedes usar información cuya clasificación sea igual o menos restrictiva que el \`Nivel de Acceso\` del usuario:
        - \`Público\` es visible para todos.
        - \`Departamental\` y superiores pueden ver \`Privado\`.
        - \`Ejecutivo\` y \`Confidencial\` pueden ver \`Confidencial\`.
    - **Filtrado:** Si un proceso o política no cumple con el nivel de acceso, actúa como si no existiera. **NUNCA** menciones información que el usuario no tiene permiso para ver.

4.  **Formulación de la Respuesta:**
    - **Sé Específico:** Usa los nombres, códigos y descripciones exactas del contexto.
    - **Respuesta de Lista:** Si la pregunta del usuario puede responderse con una lista (ej: "¿cuáles son los procesos de X área?"), formatea tu respuesta como una lista clara (usando guiones o viñetas).
    - **Respuesta Descriptiva:** Si el usuario pregunta por un elemento específico (ej: "describe el proceso Y"), proporciona un resumen conciso usando su descripción, área, puesto, etc., del contexto.
    - **Si no encuentras información:** Si después de aplicar los filtros de permisos no hay información en el contexto que responda a la pregunta, responde amablemente: "No tengo información sobre ese tema. ¿Hay algo más en lo que pueda ayudarte?".

**Contexto de la Organización (Usa esto como tu única fuente de verdad para datos de la empresa):**
{{{contextData}}}

---
**Pregunta del Usuario:**
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
