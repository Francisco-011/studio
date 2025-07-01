
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
  processDescriptions: z.string().describe('Una lista de descripciones de procesos para analizar, incluyendo IDs, área, puesto y sistemas.'),
  systemUsage: z.string().describe('Una descripción del uso de sistemas en toda la organización.'),
  allActivities: z.string().describe('Una lista de todas las actividades definidas en el sistema, incluyendo su nombre, ID, descripción y el procedimiento al que están asociadas.'),
  systemCostInformation: z.string().optional().describe('Información detallada sobre los costos asociados a los sistemas utilizados, incluyendo costos anuales estimados y detalles de licenciamiento o uso.'),
  existingActions: z.string().optional().describe('Un resumen de las acciones de mejora existentes que ya están pendientes, en progreso o en revisión. La IA debe evitar sugerir mejoras para estos temas.'),
  policyData: z.string().optional().describe('Una lista de todas las políticas, incluyendo su título, descripción, estado (ej. "Aprobada") y fecha de revisión.'),
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

const CriticalProcessWithoutPolicySchema = z.object({
  processName: z.string().describe('El nombre del proceso crítico que carece de políticas asociadas.'),
  processId: z.string().describe('El ID del proceso.'),
  area: z.string().describe('El área del proceso.'),
  puesto: z.string().describe('El puesto responsable del proceso.'),
  reason: z.string().describe('La razón por la cual el proceso es considerado crítico y necesita una política (ej: maneja datos sensibles, tiene impacto financiero).'),
});

const ObsoletePolicySchema = z.object({
  policyName: z.string().describe('El nombre de la política que está obsoleta o próxima a vencer.'),
  policyId: z.string().describe('El ID de la política.'),
  reviewDate: z.string().describe('La fecha de revisión de la política.'),
  reason: z.string().describe('La razón por la que se considera obsoleta (ej: fecha de revisión pasada).'),
});

const DuplicatePolicySuggestionSchema = z.object({
  policyA_Name: z.string().describe('Nombre de la primera política en el par duplicado.'),
  policyA_Id: z.string().describe('ID de la primera política.'),
  policyB_Name: z.string().describe('Nombre de la segunda política en el par duplicado.'),
  policyB_Id: z.string().describe('ID de la segunda política.'),
  reason: z.string().describe('La razón para sospechar la duplicación (ej: descripciones o títulos muy similares).'),
});


const AnalyzeProcessesOutputSchema = z.object({
  redundantSystems: z.array(RedundantSystemSchema).describe('Una lista de sistemas identificados como potencialmente redundantes, incluyendo su costo anual.'),
  duplicateProcesses: z.array(DuplicateProcessSchema).describe('Una lista de pares de procesos que son potencialmente duplicados.'),
  duplicateActivities: z.array(DuplicateActivitySchema).describe('Una lista de pares de actividades que son potencialmente duplicadas en diferentes áreas o puestos.'),
  criticalProcessesWithoutPolicies: z.array(CriticalProcessWithoutPolicySchema).describe('Una lista de procesos críticos que no tienen políticas asociadas.'),
  obsoletePolicies: z.array(ObsoletePolicySchema).describe('Una lista de políticas que están obsoletas o cuya fecha de revisión ha pasado.'),
  duplicatePolicySuggestions: z.array(DuplicatePolicySuggestionSchema).describe('Sugerencias para consolidar políticas que parecen ser duplicadas.'),
  summary: z.string().describe('Un resumen de alto nivel de todos los hallazgos, incluyendo los de políticas.'),
});
export type AnalyzeProcessesOutput = z.infer<typeof AnalyzeProcessesOutputSchema>;


export async function analyzeProcesses(input: AnalyzeProcessesInput): Promise<AnalyzeProcessesOutput> {
  return analyzeProcessesFlow(input);
}

const analyzeProcessesPrompt = ai.definePrompt({
  name: 'analyzeProcessesPrompt',
  input: {schema: AnalyzeProcessesInputSchema},
  output: {schema: AnalyzeProcessesOutputSchema},
  prompt: `Eres un analista de negocios experto en optimización de procesos y gobernanza corporativa, impulsado por IA. Tu misión es identificar duplicidades, oportunidades de ahorro cuantificables y gaps de cumplimiento.

Se te proporcionan descripciones detalladas de procesos, actividades, uso de sistemas y políticas.

**Instrucción CRÍTICA: NO debes generar hallazgos ni sugerencias para problemas que ya están siendo abordados por las "Acciones de Mejora Existentes" que se listan a continuación.**

Tu análisis debe centrarse en CUATRO áreas clave y debes devolver la salida en el formato JSON estructurado solicitado.

1.  **Sistemas Redundantes (redundantSystems)**: Basado en el uso de sistemas en los procesos y la información de costos, identifica sistemas que podrían ser redundantes. La redundancia ocurre cuando sistemas diferentes se usan para lograr el mismo resultado de negocio.

2.  **Análisis de Duplicados (Procesos y Actividades)**:
    - **Procesos Duplicados (duplicateProcesses)**: Encuentra procesos que son funcionalmente idénticos aunque tengan nombres diferentes.
    - **Actividades Duplicadas (duplicateActivities)**: Encuentra actividades funcionalmente idénticas, considerando el contexto. Si el contexto (área, puesto, proceso) es diferente, NO lo reportes como duplicado a menos que el resultado sea idéntico.

3.  **Análisis de Gaps de Políticas (Policy Gap Analysis)**: Utilizando la información de políticas proporcionada, identifica las siguientes áreas de riesgo y oportunidad. **IMPORTANTE: Al buscar gaps de cobertura (ej. procesos críticos sin políticas), considera que un proceso solo está 'cubierto' si está vinculado a una política en estado 'Aprobada'.**
    - **Procesos Críticos sin Políticas (criticalProcessesWithoutPolicies)**: Identifica procesos que, por su naturaleza (ej: manejan finanzas, datos sensibles, seguridad), deberían tener políticas asociadas pero no las tienen.
    - **Políticas Obsoletas (obsoletePolicies)**: Revisa las fechas de revisión de las políticas. Identifica y lista aquellas cuya fecha de revisión ya ha pasado.
    - **Sugerencias de Duplicidad de Políticas (duplicatePolicySuggestions)**: Compara los títulos y descripciones de las políticas. Si encuentras dos o más que cubren el mismo tema de forma muy similar, sugiérelas para consolidación.

**Datos de Entrada:**

**Descripciones de Procesos:**
{{{processDescriptions}}}

**Lista Completa de Actividades y su Contexto:**
{{{allActivities}}}

**Uso General de Sistemas:**
{{{systemUsage}}}

{{#if systemCostInformation}}
**Información de Costos de Sistemas:**
{{{systemCostInformation}}}
{{/if}}

{{#if policyData}}
**Información de Políticas:**
{{{policyData}}}
{{/if}}

{{#if existingActions}}
**Acciones de Mejora Existentes (Ignorar estos temas):**
{{{existingActions}}}
{{/if}}

**Instrucciones Adicionales de Análisis:**
- Prioriza las oportunidades de mejora que presenten el mayor impacto potencial.
- En tu resumen general ('summary'), destaca las principales oportunidades de optimización de todas las categorías.
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
