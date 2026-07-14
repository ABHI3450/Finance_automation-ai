import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { transactions } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key is missing. Check your .env.local file." }, { status: 500 });
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // Graceful fallback warning if database isn't linked yet
      return NextResponse.json({ 
        message: "Supabase credentials missing. Transactions parsed locally. Link your Supabase database in .env.local to index vectors.",
        success: true,
        fallback: true
      });
    }

    // Clear existing transaction embeddings
    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .filter('id', 'neq', '00000000-0000-0000-0000-000000000000'); // Delete all
    if (deleteError) {
      console.warn("Delete old records failed, continuing:", deleteError.message);
    }

    // Process transactions and fetch vector embeddings from Gemini API
    const promises = transactions.map(async (txn: any) => {
      const textToEmbed = `Date: ${txn.date}, Merchant: ${txn.merchant}, Amount: $${txn.amount}, Category: ${txn.category || 'Other'}`;
      
      try {
        const embedRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=${apiKey}`,
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

    // Insert only items that have successfully generated embeddings
    const validRows = rowsToInsert.filter((r) => r.embedding !== null);
    if (validRows.length > 0) {
      const { error: insertError } = await supabase.from('transactions').insert(validRows);
      if (insertError) throw insertError;
    }

    return NextResponse.json({ success: true, count: validRows.length });
  } catch (error) {
    console.error("Reconcile API Error:", error);
    const msg = error instanceof Error ? error.message : "Failed to reconcile statement vectors";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
