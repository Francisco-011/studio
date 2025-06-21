
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
    .describe('Una lista de descripciones de procesos para analizar, incluyendo tiempos y costos estimados vs. ideales.'),
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
  summary: z.string().describe('Un resumen del análisis, incluyendo consideraciones de costos si la información fue proporcionada, y destacando las brechas entre valores estimados e ideales.'),
});
export type AnalyzeProcessesOutput = z.infer<typeof AnalyzeProcessesOutputSchema>;

export async function analyzeProcesses(input: AnalyzeProcessesInput): Promise<AnalyzeProcessesOutput> {
  return analyzeProcessesFlow(input);
}

const analyzeProcessesPrompt = ai.definePrompt({
  name: 'analyzeProcessesPrompt',
  input: {schema: AnalyzeProcessesInputSchema},
  output: {schema: AnalyzeProcessesOutputSchema},
  prompt: `Eres un analista de negocios experto en optimización de procesos, impulsado por IA. Tu misión es identificar ineficiencias, duplicidades y oportunidades de ahorro.

Se te proporcionan descripciones detalladas de procesos, incluyendo tiempos y costos estimados versus ideales, uso de sistemas y, opcionalmente, costos detallados de esos sistemas.

Tu análisis debe centrarse en tres áreas clave:
1.  **Brechas de Eficiencia**: Identifica los procesos y actividades con las mayores discrepancias entre los valores "Estimados" y los "Ideales" (tanto en tiempo como en costo). Estos son los principales candidatos para la mejora.
2.  **Procesos Duplicados**: Analiza las descripciones de los procesos para encontrar superposiciones funcionales o redundancias.
3.  **Sistemas Redundantes**: Basado en el uso de sistemas en los procesos y la información de costos, identifica sistemas que podrían ser redundantes, subutilizados o particularmente caros.

**Datos de Entrada:**

**Descripciones de Procesos (con métricas de tiempo y costo):**
{{{processDescriptions}}}

**Uso General de Sistemas:**
{{{systemUsage}}}

{{#if systemCostInformation}}
**Información de Costos de Sistemas:**
{{{systemCostInformation}}}
{{/if}}

**Instrucciones de Análisis:**
- Prioriza las oportunidades de mejora que presenten el mayor impacto potencial (brechas grandes de tiempo/costo, costos de sistema elevados).
- Al listar sistemas redundantes, DEBES incluir su costo anual estimado (si se proporcionó) para resaltar el impacto financiero.
- En tu resumen, destaca las principales oportunidades de optimización, cuantificando el ahorro potencial cuando sea posible (ej. "reducir el tiempo del proceso X en Y minutos", "ahorrar Z anualmente al consolidar el sistema Y").
- Estructura tu respuesta claramente en las secciones solicitadas.
- TODA TU RESPUESTA Y EL ANÁLISIS DEBEN ESTAR EN ESPAÑOL.

**Salida Requerida:**

**Procesos Duplicados:**
(Lista los procesos que parecen redundantes, explicando brevemente por qué)

**Sistemas Redundantes (considerando costo si aplica):**
(Lista los sistemas que son redundantes o subutilizados, incluyendo su costo anual)

**Resumen y Oportunidades Clave de Mejora:**
(Resume los hallazgos más importantes, enfocándote en las mayores brechas entre lo estimado y lo ideal, y las oportunidades de ahorro más significativas)
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
