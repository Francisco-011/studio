
'use server';

/**
 * @fileOverview An AI agent that analyzes process descriptions and system usage to identify potential duplicate processes or redundant systems.
 *
 * - analyzeProcesses - A function that takes in process descriptions and system usage, and returns an analysis of potential duplicate processes and redundant systems.
 * - AnalyzeProcessesInput - The input type for the analyzeProcesses function.
 * - AnalyzeProcessesOutput - The return type for the analyzeProcesses function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeProcessesInputSchema = z.object({
  processDescriptions: z
    .string()
    .describe('Una lista de descripciones de procesos para analizar.'),
  systemUsage: z.string().describe('Una descripción del uso de sistemas en toda la organización.'),
});
export type AnalyzeProcessesInput = z.infer<typeof AnalyzeProcessesInputSchema>;

const AnalyzeProcessesOutputSchema = z.object({
  duplicateProcesses: z
    .string()
    .describe('Una lista de posibles procesos duplicados identificados por la IA.'),
  redundantSystems: z
    .string()
    .describe('Una lista de posibles sistemas redundantes identificados por la IA.'),
  summary: z.string().describe('Un resumen del análisis.'),
});
export type AnalyzeProcessesOutput = z.infer<typeof AnalyzeProcessesOutputSchema>;

export async function analyzeProcesses(input: AnalyzeProcessesInput): Promise<AnalyzeProcessesOutput> {
  return analyzeProcessesFlow(input);
}

const analyzeProcessesPrompt = ai.definePrompt({
  name: 'analyzeProcessesPrompt',
  input: {schema: AnalyzeProcessesInputSchema},
  output: {schema: AnalyzeProcessesOutputSchema},
  prompt: `Eres un analista de negocios impulsado por IA encargado de identificar ineficiencias en los procesos empresariales.

Se te proporciona una lista de descripciones de procesos y una descripción del uso de sistemas en toda la organización.
Tu objetivo es identificar posibles procesos duplicados y sistemas redundantes.

Descripciones de Procesos:
{{processDescriptions}}

Uso de Sistemas:
{{systemUsage}}

Analiza las descripciones de los procesos y el uso de los sistemas, e identifica cualquier posible proceso duplicado o sistema redundante. Proporciona un resumen de tu análisis.
TODA TU RESPUESTA Y EL ANÁLISIS DEBEN ESTAR EN ESPAÑOL.

Procesos Duplicados:

Sistemas Redundantes:

Resumen:
`,
});

const analyzeProcessesFlow = ai.defineFlow(
  {
    name: 'analyzeProcessesFlow',
    inputSchema: AnalyzeProcessesInputSchema,
    outputSchema: AnalyzeProcessesOutputSchema,
  },
  async input => {
    const {output} = await analyzeProcessesPrompt(input);
    return output!;
  }
);
