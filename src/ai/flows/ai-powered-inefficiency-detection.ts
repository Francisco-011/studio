
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
    .describe('Una lista de descripciones de procesos para analizar, incluyendo IDs, tiempos y costos estimados vs. ideales para el proceso y sus actividades.'),
  systemUsage: z.string().describe('Una descripción del uso de sistemas en toda la organización.'),
  systemCostInformation: z.string().optional().describe('Información detallada sobre los costos asociados a los sistemas utilizados, incluyendo costos anuales estimados y detalles de licenciamiento o uso.'),
  existingActions: z.string().optional().describe('Un resumen de las acciones de mejora existentes que ya están pendientes, en progreso o en revisión. La IA debe evitar sugerir mejoras para estos temas.'),
});
export type AnalyzeProcessesInput = z.infer<typeof AnalyzeProcessesInputSchema>;


const EfficiencyGapSchema = z.object({
  processName: z.string().describe('El nombre del proceso con la brecha de eficiencia.'),
  processId: z.string().optional().describe('El ID del proceso con la brecha de eficiencia.'),
  activityId: z.string().optional().describe('El ID de la actividad específica con la brecha, si aplica.'),
  area: z.string().optional().describe('El área organizacional donde ocurre el proceso.'),
  puesto: z.string().optional().describe('El puesto responsable del proceso.'),
  activityName: z.string().optional().describe('La actividad específica con la brecha, si aplica.'),
  description: z.string().describe('Una breve explicación de la ineficiencia u oportunidad de mejora.'),
  potentialTimeSaving: z.number().optional().describe('El ahorro de tiempo estimado en minutos por instancia/ejecución.'),
  potentialCostSaving: z.number().optional().describe('El ahorro de costo estimado por instancia/ejecución.'),
  currency: z.string().optional().describe('La moneda del ahorro de costo (ej: USD, MXN).'),
  frequency: z.string().optional().describe('La frecuencia del proceso (ej: Diario, Semanal) para contextualizar el ahorro.'),
});

const RedundantSystemSchema = z.object({
  systemName: z.string().describe('El nombre del sistema potencialmente redundante.'),
  area: z.string().optional().describe('El área donde se detectó el uso principal del sistema redundante.'),
  puesto: z.string().optional().describe('El puesto donde se detectó el uso principal del sistema redundante.'),
  processId: z.string().optional().describe('El ID del proceso principal donde se detectó el uso del sistema.'),
  annualCost: z.number().optional().describe('El costo anual estimado del sistema.'),
  currency: z.string().optional().describe('La moneda del costo.'),
  reason: z.string().describe('La razón por la que el sistema se considera redundante.'),
});

const DuplicateProcessSchema = z.object({
    processA: z.string().describe('Nombre del primer proceso en el par duplicado.'),
    processA_Id: z.string().optional().describe('ID del primer proceso.'),
    areaA: z.string().optional().describe('Área del primer proceso.'),
    puestoA: z.string().optional().describe('Puesto del primer proceso.'),
    processB: z.string().describe('Nombre del segundo proceso en el par duplicado.'),
    processB_Id: z.string().optional().describe('ID del segundo proceso.'),
    areaB: z.string().optional().describe('Área del segundo proceso.'),
    puestoB: z.string().optional().describe('Puesto del segundo proceso.'),
    reason: z.string().describe('La razón para sospechar la duplicación.'),
});


const AnalyzeProcessesOutputSchema = z.object({
  efficiencyGaps: z.array(EfficiencyGapSchema).describe('Una lista de ineficiencias identificadas basadas en las brechas de tiempo/costo entre los valores estimados e ideales.'),
  redundantSystems: z.array(RedundantSystemSchema).describe('Una lista de sistemas identificados como potencialmente redundantes, incluyendo su costo anual.'),
  duplicateProcesses: z.array(DuplicateProcessSchema).describe('Una lista de pares de procesos que son potencialmente duplicados.'),
  summary: z.string().describe('Un resumen de alto nivel de los hallazgos más críticos y las oportunidades de mejora generales.'),
});
export type AnalyzeProcessesOutput = z.infer<typeof AnalyzeProcessesOutputSchema>;


export async function analyzeProcesses(input: AnalyzeProcessesInput): Promise<AnalyzeProcessesOutput> {
  return analyzeProcessesFlow(input);
}

const analyzeProcessesPrompt = ai.definePrompt({
  name: 'analyzeProcessesPrompt',
  input: {schema: AnalyzeProcessesInputSchema},
  output: {schema: AnalyzeProcessesOutputSchema},
  prompt: `Eres un analista de negocios experto en optimización de procesos, impulsado por IA. Tu misión es identificar ineficiencias, duplicidades y oportunidades de ahorro cuantificables.

Se te proporcionan descripciones detalladas de procesos (incluyendo sus IDs), incluyendo tiempos y costos estimados versus ideales, uso de sistemas y, opcionalmente, costos detallados de esos sistemas y una lista de acciones de mejora ya en curso.

**Instrucción CRÍTICA: NO debes generar hallazgos ni sugerencias para problemas que ya están siendo abordados por las "Acciones de Mejora Existentes" que se listan a continuación.**

Tu análisis debe centrarse en TRES áreas clave (evitando los temas ya cubiertos) y debes devolver la salida en el formato JSON estructurado solicitado. Para cada hallazgo, DEBES incluir el contexto de 'área' y 'puesto' del proceso principal relacionado. También DEBES devolver el ID del proceso/actividad asociado ('processId', 'activityId', etc.).

1.  **Brechas de Eficiencia (efficiencyGaps)**: Identifica los procesos y actividades con las mayores discrepancias entre los valores "Estimados" y los "Ideales" (tanto en tiempo como en costo). Para cada brecha significativa, calcula el 'potentialTimeSaving' (Estimado - Ideal) y 'potentialCostSaving' (Estimado - Ideal) por instancia de ejecución. Debes poblar el array 'efficiencyGaps' con esta información, incluyendo el 'area', 'puesto', y los IDs ('processId', 'activityId') del elemento afectado.

2.  **Procesos Duplicados (duplicateProcesses)**: Analiza las descripciones de los procesos para encontrar superposiciones funcionales o redundancias. Pobla el array 'duplicateProcesses' con los pares de procesos que parecen ser redundantes, incluyendo el 'areaA', 'puestoA', 'areaB', 'puestoB' y sus IDs ('processA_Id', 'processB_Id').

3.  **Sistemas Redundantes (redundantSystems)**: Basado en el uso de sistemas en los procesos y la información de costos, identifica sistemas que podrían ser redundantes, subutilizados o particularmente caros. Pobla el array 'redundantSystems', asegurándote de incluir el 'annualCost' y 'currency' si la información de costos fue proporcionada, y el 'area', 'puesto' y 'processId' del proceso principal donde se detectó.

**Datos de Entrada:**

**Descripciones de Procesos (con métricas de tiempo, costo, área, puesto e IDs):**
{{{processDescriptions}}}

**Uso General de Sistemas:**
{{{systemUsage}}}

{{#if systemCostInformation}}
**Información de Costos de Sistemas:**
{{{systemCostInformation}}}
{{/if}}

{{#if existingActions}}
**Acciones de Mejora Existentes (Ignorar estos temas):**
{{{existingActions}}}
{{/if}}


**Instrucciones de Análisis:**
- Prioriza las oportunidades de mejora que presenten el mayor impacto potencial (brechas grandes de tiempo/costo, costos de sistema elevados).
- Al listar sistemas redundantes, DEBES incluir su costo anual estimado ('annualCost') y su moneda ('currency') si se proporcionó en la entrada.
- En tu resumen general ('summary'), destaca las principales oportunidades de optimización, cuantificando el ahorro potencial anual cuando sea posible.
- Estructura tu respuesta estrictamente en el formato JSON de salida solicitado.
- TODA TU RESPUESTA Y EL ANÁLISIS DEBEN ESTAR EN ESPAÑOL.
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
