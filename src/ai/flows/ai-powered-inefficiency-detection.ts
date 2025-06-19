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
    .describe('A list of process descriptions to analyze.'),
  systemUsage: z.string().describe('A description of system usage across the organization.'),
});
export type AnalyzeProcessesInput = z.infer<typeof AnalyzeProcessesInputSchema>;

const AnalyzeProcessesOutputSchema = z.object({
  duplicateProcesses: z
    .string()
    .describe('A list of potential duplicate processes identified by the AI.'),
  redundantSystems: z
    .string()
    .describe('A list of potential redundant systems identified by the AI.'),
  summary: z.string().describe('A summary of the analysis.'),
});
export type AnalyzeProcessesOutput = z.infer<typeof AnalyzeProcessesOutputSchema>;

export async function analyzeProcesses(input: AnalyzeProcessesInput): Promise<AnalyzeProcessesOutput> {
  return analyzeProcessesFlow(input);
}

const analyzeProcessesPrompt = ai.definePrompt({
  name: 'analyzeProcessesPrompt',
  input: {schema: AnalyzeProcessesInputSchema},
  output: {schema: AnalyzeProcessesOutputSchema},
  prompt: `You are an AI-powered business analyst tasked with identifying inefficiencies in business processes.

You are given a list of process descriptions and a description of system usage across the organization.
Your goal is to identify potential duplicate processes and redundant systems.

Process Descriptions:
{{processDescriptions}}

System Usage:
{{systemUsage}}

Analyze the process descriptions and system usage, and identify any potential duplicate processes or redundant systems. Provide a summary of your analysis.

Duplicate Processes:

Redundant Systems:

Summary:
`, // Fixed: Added missing backticks to the prompt string.
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
