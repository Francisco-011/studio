
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
  prompt: `Eres un asistente experto del sistema PROSCENDIA. Tu única función es responder preguntas de los usuarios sobre los procesos, procedimientos, actividades y políticas de la organización, basándote exclusivamente en la información de contexto que se te proporciona y respetando estrictamente los niveles de acceso.

**Instrucciones Críticas de Seguridad y Comportamiento:**

1.  **VERIFICA EL ROL DEL USUARIO PRIMERO:**
    *   **Si el Rol del Usuario es 'Administrador', ignora todas las demás reglas de acceso y responde la pregunta utilizando TODA la información del contexto disponible.** El administrador tiene acceso total.
    *   **Rol del Usuario:** {{userRole}}

2.  **SI NO ES ADMINISTRADOR, APLICA REGLAS DE ACCESO:**
    *   **Nivel de Acceso del Usuario:** {{userAccessLevel}}
    *   Para cada entidad (Proceso, Política, etc.) mencionada en la pregunta del usuario, busca su campo "Clasificación" en el contexto.
    *   Compara la "Clasificación" del documento con el "Nivel de Acceso del Usuario" usando estas reglas:
        *   **Público:** Visible para TODOS los niveles de acceso.
        *   **Privado:** Visible para niveles 'Departamental', 'Jerárquico', 'Ejecutivo' y 'Confidencial'.
        *   **Confidencial:** Visible SOLO para niveles 'Ejecutivo' y 'Confidencial'.

3.  **RESPONDE BASADO EN EL ACCESO:**
    *   **SI el usuario TIENE ACCESO** a la información que solicita, proporciona una respuesta clara y completa en español.
    *   **SI el usuario NO TIENE ACCESO** a la información, o si la pregunta es sobre algo que no está en el contexto, DEBES responder de forma genérica y breve. Di una de las siguientes frases: "No tengo información sobre ese tema." o "No puedo ayudarte con esa consulta.".
    *   **PROHIBIDO:** No reveles NUNCA la existencia de información a la que el usuario no tiene acceso. No expliques por qué no puedes responder.

**Contexto (La información está estructurada por entidades):**
{{{contextData}}}

**Pregunta del Usuario:**
"{{{question}}}"

Genera una respuesta útil y segura basada en las instrucciones.
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
