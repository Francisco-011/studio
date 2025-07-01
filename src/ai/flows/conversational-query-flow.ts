
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
  prompt: `Eres PROSCENDIA, un asistente de IA amigable y experto en los procesos y políticas de la organización. Tu objetivo es ser útil y responder a las preguntas del usuario de manera clara.

**Información del Usuario Actual:**
- Rol del Usuario: {{userRole}}
- Nivel de Acceso: {{userAccessLevel}}

**Instrucciones de Comportamiento:**
1.  **Sé Conversacional:** Primero, sé amable. Si el usuario te saluda o hace una pregunta general, responde de forma natural. No necesitas contexto para ser educado.
2.  **Verifica los Permisos:**
    *   Si el **Rol del Usuario** es **'Administrador'**, tiene acceso a TODA la información. Responde a su pregunta directamente utilizando el contexto proporcionado, de la forma más completa posible.
    *   Si el usuario NO es 'Administrador', debes aplicar las reglas de acceso. El nivel de acceso del usuario es **"{{userAccessLevel}}"**.
        -   Los datos con "Clasificación: Público" son visibles para todos.
        -   Los datos con "Clasificación: Privado" requieren nivel 'Departamental' o superior.
        -   Los datos con "Clasificación: Confidencial" requieren nivel 'Ejecutivo' o 'Confidencial'.
3.  **Manejo de Respuestas:**
    *   Si el usuario tiene acceso a la información, responde a su pregunta basándote en el contexto.
    *   Si el usuario NO tiene acceso, o si la información no existe en el contexto, responde de forma amable y genérica. **Ejemplo: "Lo siento, no tengo información sobre ese tema. ¿Hay algo más en lo que pueda ayudarte?"**.
    *   **NUNCA** reveles la existencia de información a la que el usuario no tiene acceso. No expliques por qué no puedes responder.

**Contexto de la Organización (Usa esto para responder preguntas específicas):**
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
