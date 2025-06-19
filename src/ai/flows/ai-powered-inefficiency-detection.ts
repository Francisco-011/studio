
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
  systemCostInformation: z.string().optional().describe('Información detallada sobre los costos asociados a los sistemas utilizados, incluyendo costos anuales estimados y detalles de licenciamiento o uso.'),
});
export type AnalyzeProcessesInput = z.infer<typeof AnalyzeProcessesInputSchema>;

const AnalyzeProcessesOutputSchema = z.object({
  duplicateProcesses: z
    .string()
    .describe('Una lista de posibles procesos duplicados identificados por la IA.'),
  redundantSystems: z
    .string()
    .describe('Una lista de posibles sistemas redundantes identificados por la IA, considerando su costo si se proporciona.'),
  summary: z.string().describe('Un resumen del análisis, incluyendo consideraciones de costos si la información fue proporcionada.'),
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

Se te proporciona una lista de descripciones de procesos, una descripción del uso de sistemas en toda la organización, y opcionalmente, información sobre los costos de estos sistemas.
Tu objetivo es identificar posibles procesos duplicados y sistemas redundantes, prestando especial atención a las implicaciones de costos.

Descripciones de Procesos:
{{{processDescriptions}}}

Uso de Sistemas:
{{{systemUsage}}}

{{#if systemCostInformation}}
Información de Costos de Sistemas:
{{{systemCostInformation}}}
{{/if}}

Analiza las descripciones de los procesos, el uso de los sistemas, y la información de costos (si está disponible). Identifica cualquier posible proceso duplicado o sistema redundante. 
Si se proporcionaron datos de costos, considera activamente estos costos en tu análisis para identificar sistemas que son particularmente caros y podrían ser redundantes o subutilizados.
En tu resumen, destaca las oportunidades de optimización que podrían llevar a ahorros de costos.
TODA TU RESPUESTA Y EL ANÁLISIS DEBEN ESTAR EN ESPAÑOL.

Procesos Duplicados:

Sistemas Redundantes (considerando costo si aplica):

Resumen (incluyendo optimizaciones de costos si aplica):
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
