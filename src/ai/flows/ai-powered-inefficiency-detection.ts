
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
    .describe('Una lista de descripciones de procesos para analizar, incluyendo IDs, área, puesto y sistemas.'),
  systemUsage: z.string().describe('Una descripción del uso de sistemas en toda la organización.'),
  allActivities: z.string().describe('Una lista de todas las actividades definidas en el sistema, incluyendo su nombre, ID, descripción y los procesos, áreas y puestos a los que están asociadas.'),
  systemCostInformation: z.string().optional().describe('Información detallada sobre los costos asociados a los sistemas utilizados, incluyendo costos anuales estimados y detalles de licenciamiento o uso.'),
  existingActions: z.string().optional().describe('Un resumen de las acciones de mejora existentes que ya están pendientes, en progreso o en revisión. La IA debe evitar sugerir mejoras para estos temas.'),
});
export type AnalyzeProcessesInput = z.infer<typeof AnalyzeProcessesInputSchema>;

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

const DuplicateActivitySchema = z.object({
    activityA: z.string().describe('Nombre de la primera actividad en el par duplicado.'),
    activityA_Id: z.string().optional().describe('ID de la primera actividad.'),
    areaA: z.string().optional().describe('Área donde se ejecuta la primera actividad.'),
    puestoA: z.string().optional().describe('Puesto que ejecuta la primera actividad.'),
    activityB: z.string().describe('Nombre de la segunda actividad en el par duplicado.'),
    activityB_Id: z.string().optional().describe('ID de la segunda actividad.'),
    areaB: z.string().optional().describe('Área donde se ejecuta la segunda actividad.'),
    puestoB: z.string().optional().describe('Puesto que ejecuta la segunda actividad.'),
    reason: z.string().describe('La razón para sospechar la duplicación (ej: nombres similares, misma descripción).'),
});


const AnalyzeProcessesOutputSchema = z.object({
  redundantSystems: z.array(RedundantSystemSchema).describe('Una lista de sistemas identificados como potencialmente redundantes, incluyendo su costo anual.'),
  duplicateProcesses: z.array(DuplicateProcessSchema).describe('Una lista de pares de procesos que son potencialmente duplicados.'),
  duplicateActivities: z.array(DuplicateActivitySchema).describe('Una lista de pares de actividades que son potencialmente duplicadas en diferentes áreas o puestos.'),
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
  prompt: `Eres un analista de negocios experto en optimización de procesos, impulsado por IA. Tu misión es identificar duplicidades y oportunidades de ahorro cuantificables.

Se te proporcionan descripciones detalladas de procesos (incluyendo sus IDs), una lista de todas las actividades, uso de sistemas y, opcionalmente, costos detallados de esos sistemas y una lista de acciones de mejora ya en curso.

**Instrucción CRÍTICA: NO debes generar hallazgos ni sugerencias para problemas que ya están siendo abordados por las "Acciones de Mejora Existentes" que se listan a continuación.**

Tu análisis debe centrarse en TRES áreas clave y debes devolver la salida en el formato JSON estructurado solicitado. Para cada hallazgo, DEBES incluir el contexto de 'área' y 'puesto' del proceso principal relacionado. También DEBES devolver el ID del proceso/actividad asociado ('processId', 'activityId', etc.).

1.  **Sistemas Redundantes (redundantSystems)**: Basado en el uso de sistemas en los procesos y la información de costos, identifica sistemas que podrían ser redundantes, subutilizados o particularmente caros. Pobla el array 'redundantSystems', asegurándote de incluir el 'annualCost' y 'currency' si la información de costos fue proporcionada, y el 'area', 'puesto' y 'processId' del proceso principal donde se detectó.

**Análisis de Duplicados (CRÍTICO):**
Tu tarea más importante es diferenciar entre **variaciones legítimas** y **duplicaciones reales**. El contexto organizacional (área, puesto, proceso asociado) es tan importante como la descripción.

- Una **variación legítima** es cuando dos procesos o actividades tienen nombres o descripciones similares, pero su propósito de negocio es claramente diferente debido al contexto en el que se ejecutan. Por ejemplo, "Bajar información del sistema" por un agente de cobranza (para contactar clientes) y "Bajar información del sistema" por un analista de inventarios (para análisis de stock) son variaciones, NO duplicados, porque sus objetivos son distintos. **NO reportes variaciones como duplicados.**

- Una **duplicación real** es cuando dos procesos o actividades, a pesar de tener nombres potencialmente diferentes, describen funcionalmente el mismo trabajo, usan los mismos sistemas y producen un resultado de negocio idéntico o muy similar. Esto representa un esfuerzo redundante que se podría consolidar. Por ejemplo, "Generar reporte de ventas semanal" en un área y "Crear informe de ventas de la semana" en otra.

Para los arrays 'duplicateProcesses' y 'duplicateActivities', solo incluye las **duplicaciones reales**. En el campo 'reason', explica claramente por qué crees que son funcionalmente idénticos y no solo una variación contextual, considerando el impacto en el negocio.

2.  **Procesos Duplicados (duplicateProcesses)**: Analiza las descripciones de los procesos para encontrar superposiciones funcionales o redundancias. Pobla el array 'duplicateProcesses' con los pares de procesos que parecen ser redundantes, incluyendo el 'areaA', 'puestoA', 'areaB', 'puestoB' y sus IDs ('processA_Id', 'processB_Id').

3.  **Actividades Duplicadas (duplicateActivities)**: Analiza la lista completa de actividades. Tu objetivo es encontrar **duplicaciones funcionales genuinas**, no simples similitudes en la descripción. **Pondera fuertemente el contexto completo**: el nombre de la actividad, su descripción detallada, el área, el puesto y los procesos a los que está asociada. Si el contexto (área, puesto) es muy diferente, sé extremadamente escéptico sobre si es una duplicación real, a menos que las descripciones y resultados sean idénticos. Pobla el array 'duplicateActivities' con los pares de actividades que sospechas son redundantes, incluyendo su ID, área y puesto para contextualizar dónde ocurre la duplicidad.

**Datos de Entrada:**

**Descripciones de Procesos (con métricas de área, puesto e IDs):**
{{{processDescriptions}}}

**Lista Completa de Actividades y su Contexto (Área/Puesto):**
{{{allActivities}}}

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


**Instrucciones Adicionales de Análisis:**
- Prioriza las oportunidades de mejora que presenten el mayor impacto potencial (costos de sistema elevados).
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
