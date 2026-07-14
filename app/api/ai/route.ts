import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { prompt, context } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key is missing. Check your .env.local file." }, { status: 500 });
    }

    let finalContext = context;
    const isSupabaseConfigured = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (isSupabaseConfigured) {
      try {
        console.log("RAG Pipeline Active: Generating query vector...");
        // 1. Generate embedding for user query
        const embedRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: { parts: [{ text: prompt }] }
            })
          }
        );

        if (!embedRes.ok) {
          const errData = await embedRes.json();
          throw new Error("Failed to embed user query: " + (errData?.error?.message || embedRes.statusText));
        }

        const embedData = await embedRes.json();
        const queryEmbedding = embedData?.embedding?.values ?? [];

        // 2. Query Supabase vector database using similarity RPC function
        console.log("Querying Supabase pgvector database for similar transactions...");
        const { data: matchedRows, error: searchError } = await supabase.rpc('match_transactions', {
          query_embedding: queryEmbedding,
          match_threshold: 0.1, // Retrieve loose matches so LLM has broad context
          match_count: 15
        });

        if (searchError) throw searchError;

        if (matchedRows && matchedRows.length > 0) {
          console.log(`RAG Match Success: Retrieved ${matchedRows.length} relevant transactions from Supabase.`);
          finalContext = `Here are the retrieved relevant transactions matching the user query from the database:\n` +
            matchedRows
              .map((r: any) => `Date: ${r.date}, Merchant: ${r.merchant}, Amount: $${r.amount}, Category: ${r.category}`)
              .join("\n") +
            `\n\n(Context retrieved via database similarity vector search)`;
        } else {
          console.log("RAG Match: No similar transactions found in database. Using default fallback context.");
        }
      } catch (dbErr) {
        console.error("Supabase RAG Vector Search failed, falling back to local context:", dbErr);
      }
    } else {
      console.log("RAG Fallback Mode: Supabase keys not set. Processing query via client-provided context.");
    }

    // 3. Request Gemini completion with retrieved context
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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

    return NextResponse.json({ text, matchedSources: isSupabaseConfigured ? (matchedRows || []) : null });
  } catch (error) {
    console.error("AI Route Error:", error);
    const message = error instanceof Error ? error.message : "Failed to connect to AI";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
