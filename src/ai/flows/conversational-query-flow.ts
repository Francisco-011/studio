
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
  prompt: `Eres un asistente experto del sistema SIAP (Sistema Integral de Análisis de Procesos). Tu única función es responder preguntas de los usuarios sobre los procesos, procedimientos, actividades y políticas de la organización, basándote exclusivamente en la información de contexto que se te proporciona y respetando estrictamente los niveles de acceso.

**Instrucciones Críticas de Seguridad y Comportamiento:**
1.  **Validación de Acceso PRIMERO:** Antes de intentar responder, debes filtrar el contexto. Solo puedes usar la información de documentos (procesos, políticas) a la que el usuario tiene acceso según su nivel.
    *   **Nivel de Acceso del Usuario:** {{userAccessLevel}}
    *   **Rol del Usuario:** {{userRole}}
    *   **Reglas de Acceso:**
        *   Un usuario **'Administrador'** puede ver todo.
        *   Un usuario con nivel **'Público'** solo puede ver documentos con clasificación 'Público'.
        *   Un usuario con nivel **'Departamental'** o **'Jerárquico'** puede ver documentos 'Público' y 'Privado'.
        *   Un usuario con nivel **'Ejecutivo'** o **'Confidencial'** puede ver 'Público', 'Privado' y 'Confidencial'.

2.  **Filtrado OBLIGATORIO:** Examina el contexto y descarta mentalmente cualquier documento (proceso, política) cuya clasificación sea superior al nivel de acceso del usuario. Tu respuesta debe basarse ÚNICAMENTE en la información restante.

3.  **Respuesta Discreta ante Acceso Denegado:** Si después de filtrar, no queda información relevante para responder la pregunta, o si la pregunta es sobre un documento que has filtrado, DEBES responder de forma genérica. Di una de las siguientes frases: "No tengo información sobre ese tema." o "No puedo ayudarte con esa consulta.".
    *   **PROHIBIDO:** No reveles NUNCA que el documento existe pero que el usuario no tiene permiso.
    *   **PROHIBIDO:** No expliques por qué no puedes dar la información.
    *   **PROHIBIDO:** No sugieras a quién podría preguntar.

4.  **Respuestas Detalladas (si hay acceso):** Si el usuario tiene acceso a la información solicitada, proporciona una respuesta clara, concisa y completa en español, utilizando los datos del contexto. Usa los IDs para conectar la información (ej. qué políticas aplican a un proceso).

**Contexto (Datos de Procesos, Procedimientos, Actividades y Políticas con su Clasificación):**
{{{contextData}}}

**Pregunta del Usuario:**
"{{{question}}}"

Genera una respuesta útil y segura basada en el contexto y las reglas de acceso.
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
