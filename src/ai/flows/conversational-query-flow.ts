
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

const ConversationalQueryInputSchema = z.object({
  question: z.string().describe('The user\'s question about a process or activity.'),
  contextData: z.string().describe('A string containing all the relevant data about processes and activities for the AI to use as context.'),
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
  prompt: `Eres un asistente experto del sistema SIAP (Sistema Integral de Análisis de Procesos). Tu única función es responder preguntas de los usuarios sobre los procesos y actividades de la organización, basándote exclusivamente en la información de contexto que se te proporciona.

**Instrucciones Importantes:**
1.  **Cíñete al Contexto:** NUNCA inventes información. Si la respuesta no se encuentra en el contexto, responde amablemente que no tienes esa información disponible.
2.  **Sé Claro y Conciso:** Proporciona respuestas directas y fáciles de entender en español.
3.  **Identifica Entidades:** Si la pregunta menciona un proceso o actividad, busca la información correspondiente en el contexto y úsala para formular tu respuesta.

**Contexto (Datos de Procesos y Actividades):**
{{{contextData}}}

**Pregunta del Usuario:**
"{{{question}}}"

Genera una respuesta útil basada en el contexto anterior.
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
