import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface Article {
  id: string;
  topic: string;
  title: string;
  content: string;
  seoKeywords: string[];
  metaDescription: string;
  sources: string[];
  imageUrl: string;
  imageSearchQuery?: string;
  status: 'generating' | 'reviewing' | 'ready';
  wordCount: number;
  createdAt: string;
  reviewNotes?: string;
}

const GENERATOR_PROMPT = `
You are a professional medical writer and SEO expert. 
Generate a comprehensive medical article based on the topic: {topic}.
The article must be in Arabic.

Requirements:
1. SEO-friendly title.
2. Structured with H2 and H3 subheadings.
3. Include relevant keywords naturally.
4. Provide a meta description (max 160 chars).
5. Include at least 3 reliable medical sources (WHO, Mayo Clinic, etc.) with URLs.
6. Suggest a high-quality image search query for Unsplash.

Output format must be JSON.
`;

const EDITOR_PROMPT = `
You are a senior medical editor. Review the following medical article for:
1. Medical accuracy and safety.
2. Linguistic errors and style.
3. SEO optimization.
4. Clarity and flow.

Provide the corrected article and a summary of changes.
Output format must be JSON.
`;

export async function generateMedicalArticle(topic: string): Promise<Partial<Article>> {
  const model = ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: GENERATOR_PROMPT.replace("{topic}", topic),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          content: { type: Type.STRING, description: "Markdown formatted article body" },
          seoKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          metaDescription: { type: Type.STRING },
          sources: { type: Type.ARRAY, items: { type: Type.STRING } },
          imageSearchQuery: { type: Type.STRING }
        },
        required: ["title", "content", "seoKeywords", "metaDescription", "sources", "imageSearchQuery"]
      }
    }
  });

  const result = await model;
  const data = JSON.parse(result.text);
  
  return {
    ...data,
    imageUrl: '', // Will be selected by user
    wordCount: data.content.split(/\s+/).length,
    createdAt: new Date().toISOString(),
  };
}

export async function reviewArticle(article: Partial<Article>): Promise<Partial<Article>> {
  const model = ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `${EDITOR_PROMPT}\n\nArticle Title: ${article.title}\nContent: ${article.content}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          correctedContent: { type: Type.STRING },
          reviewNotes: { type: Type.STRING }
        },
        required: ["correctedContent", "reviewNotes"]
      }
    }
  });

  const result = await model;
  const data = JSON.parse(result.text);

  return {
    content: data.correctedContent,
    reviewNotes: data.reviewNotes,
    wordCount: data.correctedContent.split(/\s+/).length,
  };
}

export async function generateArticleImage(prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: `A professional, high-quality medical illustration or photograph for an article about: ${prompt}. Clean, clinical, and modern style.`,
        },
      ],
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      const base64EncodeString: string = part.inlineData.data;
      return `data:image/png;base64,${base64EncodeString}`;
    }
  }
  
  throw new Error("No image data returned from Gemini");
}
