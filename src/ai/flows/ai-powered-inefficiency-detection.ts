
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
  departamento: z.string().optional().describe('El departamento donde se detectó el uso principal del sistema redundante.'),
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
    departamentoA: z.string().optional().describe('Departamento del primer proceso.'),
    puestoA: z.string().optional().describe('Puesto del primer proceso.'),
    processB: z.string().describe('Nombre del segundo proceso en el par duplicado.'),
    processB_Id: z.string().optional().describe('ID del segundo proceso.'),
    areaB: z.string().optional().describe('Área del segundo proceso.'),
    departamentoB: z.string().optional().describe('Departamento del segundo proceso.'),
    puestoB: z.string().optional().describe('Puesto del segundo proceso.'),
    reason: z.string().describe('La razón para sospechar la duplicación.'),
});

const DuplicateActivitySchema = z.object({
    activityA: z.string().describe('Nombre de la primera actividad en el par duplicado.'),
    activityA_Id: z.string().optional().describe('ID de la primera actividad.'),
    areaA: z.string().optional().describe('Área donde se ejecuta la primera actividad.'),
    departamentoA: z.string().optional().describe('Departamento donde se ejecuta la primera actividad.'),
    puestoA: z.string().optional().describe('Puesto que ejecuta la primera actividad.'),
    activityB: z.string().describe('Nombre de la segunda actividad en el par duplicado.'),
    activityB_Id: z.string().optional().describe('ID de la segunda actividad.'),
    areaB: z.string().optional().describe('Área donde se ejecuta la segunda actividad.'),
    departamentoB: z.string().optional().describe('Departamento donde se ejecuta la segunda actividad.'),
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

Se te proporcionan descripciones detalladas de procesos (incluyendo sus IDs, entradas, salidas y actividades), una lista de todas las actividades, uso de sistemas y, opcionalmente, costos detallados de esos sistemas y una lista de acciones de mejora ya en curso.

**Instrucción CRÍTICA: NO debes generar hallazgos ni sugerencias para problemas que ya están siendo abordados por las "Acciones de Mejora Existentes" que se listan a continuación.**

Tu análisis debe centrarse en TRES áreas clave y debes devolver la salida en el formato JSON estructurado solicitado. Para cada hallazgo, DEBES incluir el contexto completo de 'área', 'departamento' (si aplica) y 'puesto' del proceso principal relacionado. También DEBES devolver el ID del proceso/actividad asociado ('processId', 'activityId', etc.).

1.  **Sistemas Redundantes (redundantSystems)**: Basado en el uso de sistemas en los procesos y la información de costos, identifica sistemas que podrían ser redundantes. **Un sistema NO es redundante solo por usarse en muchos procesos**. La redundancia real ocurre cuando **sistemas diferentes se usan para lograr el mismo resultado de negocio en contextos similares**. Por ejemplo, si se usa "Sistema CRM A" en Ventas y "Sistema CRM B" en Marketing para gestionar clientes, podría ser una redundancia. Pero usar un CRM en Ventas y un ERP en Finanzas no lo es, aunque ambos manejen datos de clientes. Analiza la función que cumplen. Pobla el array 'redundantSystems', asegurándote de incluir el 'annualCost' y 'currency' si la información de costos fue proporcionada, y el 'area', 'departamento', 'puesto' y 'processId' del proceso principal donde se detectó.

**Análisis de Duplicados (CRÍTICO):**
Tu tarea más importante es diferenciar entre **variaciones legítimas** y **duplicaciones reales**. Tu análisis debe ser estricto.

- Una **variación legítima** es cuando dos procesos o actividades tienen nombres o acciones similares (ej: "bajar información"), pero su propósito de negocio, entradas, salidas y contexto (área, departamento, puesto, proceso) son claramente diferentes. Por ejemplo, "Bajar información del sistema" por un agente de cobranza (para contactar clientes) y "Bajar información del sistema" por un analista de inventarios (para análisis de stock) son variaciones, **NO son duplicados**. **NO DEBES reportar variaciones como duplicados, incluso si usan el mismo sistema.**

- Una **duplicación real** ocurre solo cuando dos procesos o actividades, a pesar de tener nombres potencialmente diferentes, describen funcionalmente el **mismo trabajo** (mismas entradas, misma transformación, mismas salidas) y producen un **resultado de negocio idéntico o casi idéntico**. Esto representa un esfuerzo redundante que se podría consolidar. Por ejemplo, "Generar reporte de ventas semanal" en un área y "Crear informe de ventas de la semana" en otra, si ambos reportes son idénticos.

Para los arrays 'duplicateProcesses' y 'duplicateActivities', solo incluye las **duplicaciones reales y probadas**. En el campo 'reason', explica claramente por qué son funcionalmente idénticos y no solo una variación contextual.

2.  **Procesos Duplicados (duplicateProcesses)**: Analiza las descripciones de los procesos, sus entradas, salidas y actividades para encontrar superposiciones funcionales o redundancias. Pobla el array 'duplicateProcesses' con los pares de procesos que parecen ser redundantes, incluyendo el 'areaA', 'departamentoA', 'puestoA', 'areaB', 'departamentoB', 'puestoB' y sus IDs ('processA_Id', 'processB_Id').

3.  **Actividades Duplicadas (duplicateActivities)**: Analiza la lista completa de actividades. Tu objetivo es encontrar **duplicaciones funcionales genuinas**, no simples similitudes en la descripción. **Pondera fuertemente el contexto completo**: el nombre de la actividad, su descripción detallada, el área, el departamento, el puesto y los procesos a los que está asociada. Si el contexto (área, departamento, puesto, descripción del proceso, entradas/salidas del proceso) es diferente, **NO lo reportes como duplicado**, a menos que las descripciones detalladas y los resultados de negocio sean **idénticos**.


**Datos de Entrada:**

**Descripciones de Procesos (con métricas de área, departamento, puesto, entradas, salidas e IDs):**
{{{processDescriptions}}}

**Lista Completa de Actividades y su Contexto (Área/Departamento/Puesto):**
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
