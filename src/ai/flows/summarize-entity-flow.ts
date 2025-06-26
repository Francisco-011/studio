
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
  entityType: z.enum(['area', 'puesto', 'departamento']).describe('The type of the organizational entity (e.g., "area", "puesto", "departamento").'),
  entityName: z.string().describe('The name of the area, puesto, or departamento.'),
  processData: z.string().describe('A compiled string of relevant process descriptions, activities, and system usage for the selected entity. For "area" entities, this data is structured by department.'),
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

La entidad a analizar es de tipo: {{entityType}}
Su nombre es: {{entityName}}

Datos detallados de procesos y actividades relacionados con la entidad:
{{{processData}}}

**Instrucciones de Análisis:**

1.  **Análisis por Puesto o Departamento:** Si la entidad es un 'puesto' o 'departamento', genera un resumen conciso pero completo en español de sus principales funciones, responsabilidades, actividades clave y procesos gestionados. Comienza directamente con la descripción, por ejemplo: "El puesto de {{entityName}} tiene como principales responsabilidades..." o "El departamento de {{entityName}} se encarga de...".

2.  **Análisis por Área (Estructurado):** Si la entidad es un 'área', los datos que recibes están agrupados por departamento. Tu resumen debe reflejar esta estructura. Primero, proporciona una visión general del propósito del área. Luego, para cada departamento dentro del área, describe brevemente sus funciones principales basándote en los procesos listados. La estructura del resumen debe ser jerárquica. Comienza con "El área de {{entityName}} supervisa las siguientes operaciones, estructuradas por departamento:".

**Directivas Generales (para todos los tipos):**
- Destaca las interacciones más importantes con otros sistemas o procesos si la información lo permite.
- El resumen debe ser claro, profesional y útil para entender el rol y las operaciones de la entidad.
- Evita frases como "Basado en la información proporcionada..." o "Según los datos...". Simplemente presenta el análisis directo.
- El idioma de toda la respuesta debe ser español.
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
