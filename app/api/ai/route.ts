import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { chromaClient } from '@/lib/chroma';

export async function POST(request: Request) {
  try {
    const { prompt, context } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key is missing. Check your .env.local file." }, { status: 500 });
    }

    let finalContext = context;
    let matchedRows: any[] | null = null;
    
    const isChromaConfigured = !!process.env.CHROMA_URL && !!chromaClient;
    const isSupabaseConfigured = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (isChromaConfigured || isSupabaseConfigured) {
      try {
        console.log("RAG Pipeline Active: Generating query vector...");
        // 1. Generate embedding for user query
        const embedRes = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/gemini-embedding-2:embedContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: { parts: [{ text: prompt }] },
              outputDimensionality: 768
            })
          }
        );

        if (!embedRes.ok) {
          const errData = await embedRes.json();
          throw new Error("Failed to embed user query: " + (errData?.error?.message || embedRes.statusText));
        }

        const embedData = await embedRes.json();
        const queryEmbedding = embedData?.embedding?.values ?? [];

        // 2. Query either ChromaDB or Supabase depending on what is configured
        if (isChromaConfigured) {
          console.log("Querying ChromaDB vector database for similar transactions...");
          const collection = await chromaClient!.getCollection({
            name: "bank_statements"
          });

          const queryResponse = await collection.query({
            queryEmbeddings: [queryEmbedding],
            nResults: 15
          });

          const metadatas = queryResponse.metadatas[0] || [];
          const distances = queryResponse.distances?.[0] || [];

          matchedRows = metadatas.map((m: any, idx: number) => {
            const dist = distances[idx] ?? 0.1;
            // Cosine distance is usually 0 to 2. Similarity = 1 - distance
            const similarity = Math.max(0, Math.min(1, 1 - dist));
            return {
              date: m.date,
              merchant: m.merchant,
              amount: m.amount,
              category: m.category,
              similarity
            };
          });

          console.log(`ChromaDB RAG Success: Retrieved ${matchedRows.length} relevant transactions.`);
        } else if (isSupabaseConfigured) {
          console.log("Querying Supabase pgvector database for similar transactions...");
          const { data, error: searchError } = await supabase.rpc('match_transactions', {
            query_embedding: queryEmbedding,
            match_threshold: 0.1,
            match_count: 15
          });

          if (searchError) throw searchError;
          matchedRows = data;
          console.log(`Supabase RAG Success: Retrieved ${matchedRows?.length || 0} relevant transactions.`);
        }

        if (matchedRows && matchedRows.length > 0) {
          finalContext = `Here are the retrieved relevant transactions matching the user query from the vector database:\n` +
            matchedRows
              .map((r: any) => `Date: ${r.date}, Merchant: ${r.merchant}, Amount: $${r.amount}, Category: ${r.category}`)
              .join("\n") +
            `\n\n(Context retrieved via database similarity vector search)`;
        } else {
          console.log("RAG Match: No similar transactions found in database. Using default fallback context.");
        }
      } catch (dbErr) {
        console.error("Vector database search failed, falling back to local context:", dbErr);
      }
    } else {
      console.log("RAG Fallback Mode: No database keys set. Processing query via client-provided context.");
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${finalContext}\n\nSystem Instructions: You are a smart financial advisor AI inside a finance dashboard. Be concise, friendly, and actionable. Use bullet points. Keep replies under 120 words.\n\nUser question: ${prompt}`
                }
              ]
            }
          ]
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error?.message || "Error from Gemini API");
    }

    // Extracting the text response from Gemini's payload structure
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response received.";

    return NextResponse.json({ 
      text, 
      matchedSources: (isChromaConfigured || isSupabaseConfigured) ? (matchedRows || []) : null 
    });
  } catch (error) {
    console.error("AI Route Error:", error);
    const message = error instanceof Error ? error.message : "Failed to connect to AI";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
