
'use server';
/**
 * @fileOverview An AI agent that summarizes the functions, activities, and processes of a given organizational entity (Area or Puesto).
 *
 * - summarizeEntity - A function that takes entity type, name, and related process data to generate a summary.
 * - SummarizeEntityInput - The input type for the summarizeEntity function.
 * - SummarizeEntityOutput - The return type for the summarizeEntity function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeEntityInputSchema = z.object({
  entityType: z.enum(['area', 'puesto']).describe('The type of the organizational entity (e.g., "area", "puesto").'),
  entityName: z.string().describe('The name of the area or puesto.'),
  processData: z.string().describe('A compiled string of relevant process descriptions, activities, and system usage for the selected entity.'),
});
export type SummarizeEntityInput = z.infer<typeof SummarizeEntityInputSchema>;

const SummarizeEntityOutputSchema = z.object({
  summary: z.string().describe('The AI-generated summary of the entity\'s functions, activities, and key processes.'),
});
export type SummarizeEntityOutput = z.infer<typeof SummarizeEntityOutputSchema>;

export async function summarizeEntity(input: SummarizeEntityInput): Promise<SummarizeEntityOutput> {
  return summarizeEntityFlow(input);
}

const summarizeEntityPrompt = ai.definePrompt({
  name: 'summarizeEntityPrompt',
  input: {schema: SummarizeEntityInputSchema},
  output: {schema: SummarizeEntityOutputSchema},
  prompt: `Eres un analista de negocios experto. Se te proporciona información sobre varios procesos y actividades asociados con una entidad específica dentro de una organización.

La entidad es de tipo: {{entityType}}
Nombre de la entidad: {{entityName}}

Datos detallados de procesos y actividades relacionados con la entidad:
{{{processData}}}

Por favor, genera un resumen conciso pero completo en español de las principales funciones, responsabilidades, actividades clave y procesos gestionados por esta {{entityType}} ({{entityName}}).
Destaca las interacciones más importantes con otros sistemas o procesos si la información proporcionada lo permite.
El resumen debe ser claro, profesional y útil para entender el rol y las operaciones de la entidad.
Evita frases como "Basado en la información proporcionada..." o "Según los datos...". Simplemente presenta el análisis.
Comienza directamente con la descripción de la entidad. Por ejemplo: "El área de {{entityName}} se encarga de..." o "El puesto de {{entityName}} tiene como principales responsabilidades...".
`,
});

const summarizeEntityFlow = ai.defineFlow(
  {
    name: 'summarizeEntityFlow',
    inputSchema: SummarizeEntityInputSchema,
    outputSchema: SummarizeEntityOutputSchema,
  },
  async input => {
    const {output} = await summarizeEntityPrompt(input);
    return output!;
  }
);
