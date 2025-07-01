
'use server';

/**
 * @fileOverview An AI agent that analyzes a job profile based on its assigned activities.
 *
 * - analyzeJobProfile - A function that takes a job title and its activities to generate a profile and analyze alignment.
 * - JobProfileAnalysisInput - The input type for the analyzeJobProfile function.
 * - JobProfileAnalysisOutput - The return type for the analyzeJobProfile function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const JobProfileAnalysisInputSchema = z.object({
  puestoNombre: z.string().describe('El nombre del puesto o rol a analizar.'),
  actividades: z.string().describe('Una lista detallada de todas las actividades asignadas a este puesto.'),
});
export type JobProfileAnalysisInput = z.infer<typeof JobProfileAnalysisInputSchema>;

const JobProfileAnalysisOutputSchema = z.object({
  perfilGenerado: z.string().describe('Una descripción detallada y profesional del perfil del puesto, incluyendo responsabilidades principales, habilidades requeridas y su objetivo dentro de la organización.'),
  actividadesAlineadas: z.array(z.string()).describe('Una lista de las actividades proporcionadas que están claramente alineadas con las responsabilidades del perfil generado.'),
  actividadesNoAlineadas: z.array(z.string()).describe('Una lista de actividades que parecen no corresponder al perfil del puesto, con una breve justificación de por qué (ej. "Parece ser una tarea más administrativa", "Corresponde a un rol de mayor seniority", etc.).'),
  resumenAnalisis: z.string().describe('Un resumen ejecutivo del análisis, destacando la coherencia general del puesto y sugiriendo posibles acciones, como reasignar tareas no alineadas o redefinir el rol.'),
});
export type JobProfileAnalysisOutput = z.infer<typeof JobProfileAnalysisOutputSchema>;


export async function analyzeJobProfile(input: JobProfileAnalysisInput): Promise<JobProfileAnalysisOutput> {
  return analyzeJobProfileFlow(input);
}

const analyzeJobProfilePrompt = ai.definePrompt({
  name: 'analyzeJobProfilePrompt',
  input: {schema: JobProfileAnalysisInputSchema},
  output: {schema: JobProfileAnalysisOutputSchema},
  prompt: `Eres un consultor experto en Recursos Humanos y optimización de procesos organizacionales. Tu tarea es analizar un puesto de trabajo basado en las actividades que realiza.

**Puesto a Analizar:**
{{puestoNombre}}

**Actividades Asignadas:**
{{{actividades}}}

**Instrucciones:**

1.  **Generar Perfil de Puesto (perfilGenerado):** Basándote en el nombre del puesto y la lista de actividades, redacta un perfil de puesto profesional y completo. Debe incluir:
    *   Misión u objetivo principal del puesto.
    *   Lista de 3-5 responsabilidades clave.
    *   Habilidades o conocimientos sugeridos para el rol.

2.  **Analizar Alineación de Actividades:** Compara cada una de las actividades proporcionadas con el perfil que acabas de generar.
    *   **Actividades Alineadas (actividadesAlineadas):** Identifica y lista todas las actividades que son consistentes y esperadas para este rol.
    *   **Actividades No Alineadas (actividadesNoAlineadas):** Identifica actividades que parecen fuera de lugar. Para cada una, añade una breve justificación entre paréntesis. Ejemplos: "Revisar facturas (Parece una tarea más administrativa)", "Definir estrategia de marketing trimestral (Corresponde a un rol de mayor seniority)".

3.  **Crear Resumen del Análisis (resumenAnalisis):** Redacta un párrafo final que resuma tus hallazgos. Evalúa la coherencia general del puesto. Si encontraste actividades no alineadas, sugiere posibles acciones, como "se recomienda reasignar las tareas administrativas a un asistente" o "considerar una redefinición del alcance del puesto para incluir responsabilidades estratégicas".

TODA TU RESPUESTA DEBE ESTAR EN ESPAÑOL Y EN EL FORMATO JSON SOLICITADO.
`,
});

const analyzeJobProfileFlow = ai.defineFlow(
  {
    name: 'analyzeJobProfileFlow',
    inputSchema: JobProfileAnalysisInputSchema,
    outputSchema: JobProfileAnalysisOutputSchema,
  },
  async input => {
    const {output} = await analyzeJobProfilePrompt(input);
    return output!;
  }
);
