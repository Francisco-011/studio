
'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating a high-level textual audit log
 * summarizing when processes were changed and by whom.
 *
 * - generateProcessAudit - A function that generates the process audit.
 * - GenerateProcessAuditInput - The input type for the generateProcessAudit function.
 * - GenerateProcessAuditOutput - The return type for the generateProcessAudit function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateProcessAuditInputSchema = z.object({
  processChanges: z
    .string()
    .describe(
      'A description of process changes, including the process name, the user who made the change, and the timestamp of the change.'
    ),
});
export type GenerateProcessAuditInput = z.infer<typeof GenerateProcessAuditInputSchema>;

const GenerateProcessAuditOutputSchema = z.object({
  auditLog: z
    .string()
    .describe('A high-level textual audit log summarizing process changes.'),
});
export type GenerateProcessAuditOutput = z.infer<typeof GenerateProcessAuditOutputSchema>;

export async function generateProcessAudit(input: GenerateProcessAuditInput): Promise<GenerateProcessAuditOutput> {
  return generateProcessAuditFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateProcessAuditPrompt',
  input: {schema: GenerateProcessAuditInputSchema},
  output: {schema: GenerateProcessAuditOutputSchema},
  prompt: `You are an AI assistant specialized in generating audit logs.
  Based on the provided process changes, generate a concise and readable audit log.
  The audit log should clearly state what was changed, by whom, and when, if this information is available in the input.
  Focus on clarity and chronological order if multiple changes are described.
  Present the output as a clean, textual log.

  Process Changes:
  {{{processChanges}}}

  Generated Audit Log:
  `,
});

const generateProcessAuditFlow = ai.defineFlow(
  {
    name: 'generateProcessAuditFlow',
    inputSchema: GenerateProcessAuditInputSchema,
    outputSchema: GenerateProcessAuditOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

