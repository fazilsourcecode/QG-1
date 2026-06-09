"use server"

/**
 * @fileOverview Extracts handwritten marks and RRN from an image of a marksheet.
 *
 * - extractHandwrittenMarks - A function that executes the Genkit Flow for mark extraction.
 * - ExtractHandwrittenMarksInput - The input type for the extraction process.
 * - ExtractHandwrittenMarksOutput - The return type for the extraction process.
 */

import { ai, aiInstances } from "@/ai/ai-instance"
import { z } from "genkit"

// --- KEY USAGE TRACKER ---
// This stays in server memory and dynamically updates in your terminal.
const keyStats = [
  { key: 1, processed: 0, estimatedRemaining: 20, status: "ACTIVE" },
  { key: 2, processed: 0, estimatedRemaining: 20, status: "STANDBY" },
  { key: 3, processed: 0, estimatedRemaining: 20, status: "STANDBY" },
  { key: 4, processed: 0, estimatedRemaining: 20, status: "STANDBY" },
  { key: 5, processed: 0, estimatedRemaining: 20, status: "STANDBY" },
];

const ExtractHandwrittenMarksInputSchema = z.object({
  photoUrl: z.string().describe("The URL of the marksheet image."),
})
export type ExtractHandwrittenMarksInput = z.infer<typeof ExtractHandwrittenMarksInputSchema>

const ExtractHandwrittenMarksOutputSchema = z.object({
  rollNumber: z.string().describe("The Roll Registration Number (RRN) of the student."),
  name: z.string().describe("The name of the student."),
  courseCode: z.string().describe("The course code of the marksheet."),
  marks: z
    .array(
      z.object({
        questionNumber: z.string().describe("The question number."),
        mark: z.string().describe("The mark obtained for the question."),
      }),
    )
    .describe("An array of marks for each question."),
  totalMarks: z.string().describe("The total marks obtained by the student."),
})
export type ExtractHandwrittenMarksOutput = z.infer<typeof ExtractHandwrittenMarksOutputSchema>

// Define the prompt configuration
const promptConfig = {
  name: "extractMarksPrompt",
  input: {
    schema: ExtractHandwrittenMarksInputSchema,
  },
  output: {
    schema: ExtractHandwrittenMarksOutputSchema,
  },
  prompt: `You are an AI expert in extracting data from mark sheets.

You will be given an image of a mark sheet. Extract the roll number, student name, course code, marks for each question, and the total marks.

Question numbers can appear in various formats like "1", "Q2", "6a(i)", "11A", "12b(iii)", etc.
- For simple numeric questions (e.g., "1", "2"), extract the number as the question identifier.
- For questions with parts (e.g., "6 a i", "6a(i)"), standardize them to a format like "6a(i)".
- For questions like "11A", "12C", extract them as they appear.

Ensure all extracted marks are associated with their precise question identifiers.

Marksheet Image: {{media url=photoUrl}}

Output the result in JSON format, including:
- rollNumber (string)
- name (string)
- courseCode (string)
- marks (an array of objects, each with questionNumber (string) and mark (string))
- totalMarks (string)

Do not provide any additional explanation or commentary outside the JSON output.
`,
}

// Generate an array of prompts, one for each AI instance/key
const prompts = aiInstances.map((instance) => instance.definePrompt(promptConfig));

// --- THE GENKIT FLOW ---
// Wrapping the logic in a flow allows for better tracking in Genkit Studio.
const extractHandwrittenMarksFlow = ai.defineFlow(
  {
    name: "extractHandwrittenMarksFlow",
    inputSchema: ExtractHandwrittenMarksInputSchema,
    outputSchema: ExtractHandwrittenMarksOutputSchema,
  },
  async (input) => {
    // Loop through all available AI instances (keys)
    for (let i = 0; i < prompts.length; i++) {
      try {
        // Only update status if it wasn't exhausted
        if (keyStats[i].status !== "EXHAUSTED") {
          keyStats[i].status = "ACTIVE";
        }
        
        const { output } = await prompts[i](input);
        
        // --- UPDATE STATS ON SUCCESS ---
        keyStats[i].processed += 1;
        keyStats[i].estimatedRemaining = Math.max(0, 20 - keyStats[i].processed); 
        
        console.log(`\n[SERVER] ✅ Processed successfully with Key ${i + 1}`);
        console.table(keyStats); 

        return output!;
      } catch (error: any) {
        // LOG REAL ERROR IN TERMINAL FOR DEVELOPER
        console.error(`[SERVER] Attempt with Key ${i + 1} failed.`);
        console.error(`[SERVER] Technical Error:`, error);
        
        const isQuotaError = error.status === 'RESOURCE_EXHAUSTED' || error.code === 429;
        const isSuspendedOrForbidden = error.status === 'PERMISSION_DENIED' || error.code === 403 || (error.message && error.message.includes('suspended')) || (error.originalMessage && error.originalMessage.includes('suspended'));

        if (isQuotaError) {
          keyStats[i].status = "EXHAUSTED";
          console.warn(`\n[SERVER] ⚠️ Quota hit on Key ${i + 1}. Rotating to next available key...`);
        } else if (isSuspendedOrForbidden) {
          keyStats[i].status = "SUSPENDED";
          console.warn(`\n[SERVER] 🚫 Key ${i + 1} is suspended or forbidden. Rotating to next available key...`);
        } else {
          keyStats[i].status = "FAILED";
          console.warn(`\n[SERVER] ⚠️ Key ${i + 1} failed with error. Rotating to next available key...`);
        }
        
        keyStats[i].estimatedRemaining = 0; 
        console.table(keyStats);

        // If we have more keys to try, continue to next key
        if (i < prompts.length - 1) {
          continue; 
        }

        // If we reach here, it's either a final key failure or a non-quota error
        console.error("[SERVER] Fatal extraction error or all available keys exhausted.");
        throw new Error("MARK_EXTRACTION_FAILED");
      }
    }
    
    throw new Error("MARK_EXTRACTION_FAILED");
  }
);

/**
 * Executes the mark extraction process using the Genkit Flow.
 */
export async function extractHandwrittenMarks(
  input: ExtractHandwrittenMarksInput,
): Promise<ExtractHandwrittenMarksOutput> {
  return extractHandwrittenMarksFlow(input);
}
