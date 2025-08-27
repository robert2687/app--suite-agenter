import { GoogleGenAI, GenerateContentResponse, Content, Type, Tool, Modality } from "@google/genai";
import type { ChatMessage, AgentConfig, AnalysisResult } from "../types";

// Ensure the API key is available from environment variables
if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// A type representing the stream object returned by the Gemini API
type GeminiStream = AsyncGenerator<GenerateContentResponse, any, unknown> & {
    response: Promise<GenerateContentResponse>;
};

// --- Tool Definitions ---
const calculatorTool: Tool = {
    functionDeclarations: [
        {
            name: "calculator",
            description: "A simple calculator that can perform addition, subtraction, multiplication, and division on two numbers.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    a: { type: Type.NUMBER, description: "The first number." },
                    b: { type: Type.NUMBER, description: "The second number." },
                    operation: { type: Type.STRING, enum: ["add", "subtract", "multiply", "divide"], description: "The operation to perform." }
                },
                required: ["a", "b", "operation"]
            }
        }
    ]
};

const functions = {
    calculator: ({ a, b, operation }: { a: number, b: number, operation: string }) => {
        switch (operation) {
            case "add": return a + b;
            case "subtract": return a - b;
            case "multiply": return a * b;
            case "divide": 
                if (b === 0) return "Error: Cannot divide by zero.";
                return a / b;
            default: return "Error: Unknown operation.";
        }
    }
};


/**
 * Runs the configured AI agent and generates a streaming response.
 * @param config The agent's configuration.
 * @param messages The full conversation history.
 * @param onToolCall A callback invoked when a tool is being called.
 * @param registerToolCallSetter A function to register a setter for the tool call message.
 * @returns A promise that resolves to a GeminiStream object.
 */
export async function runAgentStream(
    config: AgentConfig,
    messages: ChatMessage[],
    onToolCall: (name: string, args: any) => void,
    registerToolCallSetter: (setter: (message: string | null) => void) => void
): Promise<GeminiStream> {
    const contents: Content[] = messages.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }],
    }));

    const tools: Tool[] = [];
    // Per API guidelines, googleSearch cannot be combined with other function-calling tools.
    if (config.tools.useSearch) {
        tools.push({ googleSearch: {} });
    } else if (config.tools.useCalculator) {
        tools.push(calculatorTool);
    }

    const model = 'gemini-2.5-flash';
    const apiConfig: any = {
        systemInstruction: config.systemInstruction,
        ...(tools.length > 0 && { tools }),
    };
    
    // The multi-step process is only required if the calculator is a potential tool and search is not used.
    // Search grounding is handled by the model in a single step.
    if (!config.tools.useSearch && config.tools.useCalculator) {
        const firstResponse = await ai.models.generateContent({
            model,
            contents,
            config: apiConfig,
        });

        const call = firstResponse.candidates?.[0]?.content?.parts?.[0]?.functionCall;

        if (call) {
            onToolCall(call.name, call.args);
            // Call the function and get the result.
            const result = functions[call.name as keyof typeof functions](call.args as { a: number; b: number; operation: string; });
            
            const toolResponseContent: Content[] = [
                {
                    role: 'model',
                    parts: [{ functionCall: call }]
                },
                {
                    role: 'tool',
                    parts: [{ functionResponse: { name: call.name, response: { content: result } } }]
                }
            ];

            // Make the second call to get the final response, which can be streamed.
            // FIX: Cast the result to GeminiStream to match the expected return type, as the library types may not be specific enough.
            return (await ai.models.generateContentStream({
                model,
                contents: [...contents, ...toolResponseContent],
                config: apiConfig
            })) as GeminiStream;
        } else {
             // No tool call was made, but we used the non-streaming API.
             // We can wrap the response in a fake stream to keep the UI logic consistent.
            const stream = (async function*() {
                yield firstResponse;
            })();
            
            // Manually attach the response promise to match the real stream's behavior
            (stream as any).response = Promise.resolve(firstResponse);
            return stream as GeminiStream;
        }
    }

    // Default behavior for agents without a calculator tool (e.g., search-only or no tools).
    // FIX: Cast the result to GeminiStream to match the expected return type.
    return (await ai.models.generateContentStream({
        model,
        contents,
        config: apiConfig,
    })) as GeminiStream;
}

/** For ChatView */
export async function generateChatResponseStream(
    messages: ChatMessage[],
    useSearch: boolean,
    useTools: boolean,
    onToolCall: (name: string, args: any) => void
): Promise<GeminiStream> {
    const config: AgentConfig = {
        name: 'Chat Assistant',
        systemInstruction: 'You are a helpful assistant.',
        tools: {
            useCalculator: useTools,
            useSearch: useSearch,
        }
    };
    // The 4th argument (registerToolCallSetter) is not used in the current implementation of runAgentStream,
    // but we pass a no-op function to satisfy the signature.
    return runAgentStream(config, messages, onToolCall, () => {});
}

/** For ImageView */
export async function generateImages(prompt: string): Promise<string[]> {
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 4,
          outputMimeType: 'image/jpeg',
          aspectRatio: '1:1',
        },
    });

    return response.generatedImages.map(img => img.image.imageBytes);
}

/** For ImageView - Editing */
export async function editImage(base64ImageData: string, prompt: string): Promise<{ image: string; text: string | null }> {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: {
            parts: [
                {
                    inlineData: {
                        data: base64ImageData,
                        mimeType: 'image/jpeg', // The generation function creates JPEGs
                    },
                },
                {
                    text: prompt,
                },
            ],
        },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    let newImage: string | null = null;
    let newText: string | null = null;

    // The response can contain multiple parts (image, text)
    for (const part of response.candidates[0].content.parts) {
        if (part.text) {
            newText = part.text;
        } else if (part.inlineData) {
            newImage = part.inlineData.data;
        }
    }
    
    if (!newImage) {
        throw new Error("The model did not return an edited image. It may have refused the request. Response: " + (newText || "No text response."));
    }

    return { image: newImage, text: newText };
}

/** For DataAnalysisView */
export async function analyzeData(csvData: string, question: string): Promise<AnalysisResult> {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Analyze the following CSV data and answer the user's question.
        
        CSV Data:
        \`\`\`csv
        ${csvData}
        \`\`\`
        
        Question: ${question}`,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    answer: {
                        type: Type.STRING,
                        description: "A direct, concise answer to the user's question based on the data."
                    },
                    summary: {
                        type: Type.STRING,
                        description: "A brief summary of the data analysis performed."
                    },
                    keyFindings: {
                        type: Type.ARRAY,
                        description: "A list of key findings or interesting observations from the data.",
                        items: { type: Type.STRING }
                    }
                },
                required: ["answer", "summary", "keyFindings"]
            }
        }
    });
    
    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as AnalysisResult;
}

/** For AgentView */
export async function generateAgentResponseStream(goal: string): Promise<AsyncGenerator<GenerateContentResponse, any, unknown>> {
    return await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: goal,
        config: {
            systemInstruction: "You are a world-class agent that can break down a complex goal into a series of steps and then execute them. Provide a clear, well-structured response.",
        },
    });
}

/** For CodeEditorView */
export async function generateCodeSuggestion(code: string, instruction: string): Promise<{ newCode: string }> {
    const response = await ai.models.generateContent({
       model: "gemini-2.5-flash",
       contents: `Instruction: "${instruction}"\n\nCode:\n\`\`\`\n${code}\n\`\`\``,
       config: {
            systemInstruction: "You are an expert code assistant. Your task is to modify the user-provided code based on their instruction. You must return a JSON object containing the complete, modified code. Do not omit any part of the original code that was not meant to be changed. The user should be able to take your output and replace their entire file with it.",
            responseMimeType: "application/json",
            responseSchema: {
               type: Type.OBJECT,
               properties: {
                   newCode: {
                       type: Type.STRING,
                       description: "The full, modified source code."
                   }
               },
               required: ["newCode"]
           }
       },
    });
    
    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);
    
    if (result.newCode) {
      result.newCode = result.newCode.replace(/^```(tsx|jsx|javascript|typescript)?\n/,'').replace(/\n```$/,'');
    }

    return result as { newCode: string };
}