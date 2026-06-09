import { googleAI } from '@genkit-ai/google-genai';
import { genkit } from 'genkit';

const createInstance = (key: string | undefined) => {
  if (!key) return null;
  return genkit({
    plugins: [googleAI({ apiKey: key })],
    model: 'googleai/gemini-2.5-flash', //gemini-2.5-flash-lite gemini-2.5-pro
  });
};

export const aiInstances = [
  createInstance(process.env.MODEL_API_KEY_1),
  createInstance(process.env.MODEL_API_KEY_2),
  createInstance(process.env.MODEL_API_KEY_3),
  createInstance(process.env.MODEL_API_KEY_4),
  createInstance(process.env.MODEL_API_KEY_5),
].filter((inst): inst is NonNullable<typeof inst> => inst !== null);

// Fallback export for other files
export const ai = aiInstances[0];