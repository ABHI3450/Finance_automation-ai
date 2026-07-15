import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { chromaClient } from '@/lib/chroma';

export async function POST(request: Request) {
  try {
    const { transactions } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key is missing. Check your .env.local file." }, { status: 500 });
    }

    const isChromaConfigured = !!process.env.CHROMA_URL && !!chromaClient;
    const isSupabaseConfigured = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!isChromaConfigured && !isSupabaseConfigured) {
      return NextResponse.json({ 
        message: "No vector database credentials configured (Supabase/Chroma). Reconciled statement locally.",
        success: true,
        fallback: true
      });
    }

    // Process transactions and fetch vector embeddings from Gemini API
    const promises = transactions.map(async (txn: any) => {
      const textToEmbed = `Date: ${txn.date}, Merchant: ${txn.merchant}, Amount: $${txn.amount}, Category: ${txn.category || 'Other'}`;
      
      try {
        const embedRes = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/text-embedding-004:embedContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: { parts: [{ text: textToEmbed }] }
            })
          }
        );

        if (!embedRes.ok) {
          const errData = await embedRes.json();
          throw new Error(errData?.error?.message || `Embedding failed status: ${embedRes.status}`);
        }

        const embedData = await embedRes.json();
        const embedding = embedData?.embedding?.values ?? [];

        return {
          date: txn.date,
          merchant: txn.merchant,
          amount: parseFloat(txn.amount),
          category: txn.category || 'Other',
          embedding
        };
      } catch (e) {
        console.error("Individual embedding generation failed:", e);
        return {
          date: txn.date,
          merchant: txn.merchant,
          amount: parseFloat(txn.amount),
          category: txn.category || 'Other',
          embedding: null
        };
      }
    });

    const rowsToInsert = await Promise.all(promises);
    const validRows = rowsToInsert.filter((r) => r.embedding !== null);

    if (validRows.length > 0) {
      if (isChromaConfigured) {
        console.log("RAG Ingestion: Resetting ChromaDB collection 'bank_statements'...");
        // 1. Clear existing collection
        try {
          await chromaClient!.deleteCollection({ name: "bank_statements" });
        } catch (delErr) {
          // Ignore if empty
        }

        // 2. Create the Chroma collection fresh
        const collection = await chromaClient!.getOrCreateCollection({
          name: "bank_statements"
        });

        // 3. Upsert vectors
        await collection.add({
          ids: validRows.map((_, idx) => `txn_${Date.now()}_${idx}`),
          embeddings: validRows.map((r) => r.embedding),
          metadatas: validRows.map((r) => ({
            date: r.date,
            merchant: r.merchant,
            amount: r.amount,
            category: r.category
          })),
          documents: validRows.map((r) => `Date: ${r.date}, Merchant: ${r.merchant}, Amount: $${r.amount}, Category: ${r.category}`)
        });
        console.log(`ChromaDB Ingestion Success: Indexed ${validRows.length} transactions.`);
      } else if (isSupabaseConfigured) {
        console.log("RAG Ingestion: Inserting to Supabase pgvector...");
        // Clear existing transactions in database before importing new statement
        const { error: deleteError } = await supabase
          .from('transactions')
          .delete()
          .filter('id', 'neq', '00000000-0000-0000-0000-000000000000');
        if (deleteError) {
          console.warn("Delete old Supabase records failed:", deleteError.message);
        }

        const { error: insertError } = await supabase.from('transactions').insert(validRows);
        if (insertError) throw insertError;
        console.log(`Supabase Ingestion Success: Indexed ${validRows.length} transactions.`);
      }
    }

    return NextResponse.json({ success: true, count: validRows.length, target: isChromaConfigured ? "chromadb" : "supabase" });
  } catch (error) {
    console.error("Reconcile API Error:", error);
    const msg = error instanceof Error ? error.message : "Failed to reconcile statement vectors";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
