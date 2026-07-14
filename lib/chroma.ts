import { ChromaClient } from 'chromadb';

const chromaUrl = process.env.CHROMA_URL || '';

if (!chromaUrl) {
  console.warn('ChromaDB URL missing. RAG functionality will use local memory/Supabase fallback.');
}

export const chromaClient = chromaUrl ? new ChromaClient({ path: chromaUrl }) : null;
