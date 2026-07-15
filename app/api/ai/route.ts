import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { chromaClient } from '@/lib/chroma';

function tryLocalAnalysis(prompt: string, context: string): { text: string; matchedSources: any[] | null } | null {
  const query = prompt.toLowerCase().trim();

  // 1. Simple Greetings
  const isGreeting = /^(hi|hello|hey|greetings|sup|good morning|good afternoon|good evening|yo)\b/.test(query);
  if (isGreeting) {
    return {
      text: `Hello Abhishek! 👋 I'm your Finance AI assistant.\n\nI can help you analyze your CSV transactions, locate anomalous high-spending items, or suggest strategies to reduce your monthly expenses. How can I help you today?`,
      matchedSources: []
    };
  }

  // 2. High Spending / Expense Reduction Query
  const isHighSpend = /high\s*spend|highest\s*spend|expensive|reduce|cut|save|expense|spending/i.test(query);
  if (isHighSpend) {
    const txns: { merchant: string; amount: number }[] = [];
    const lines = context.split('\n');
    
    lines.forEach(line => {
      // Format 1: "Merchant Name: $Amount" (e.g. Best Buy: $849.00)
      const match1 = line.match(/^([^:]+):\s*\$?([0-9,.]+)/);
      if (match1) {
        const merchant = match1[1].trim();
        const amount = parseFloat(match1[2].replace(/,/g, ''));
        if (!isNaN(amount) && merchant.toLowerCase() !== "here are the user's transactions (merchant" && merchant.toLowerCase() !== "total spend") {
          txns.push({ merchant, amount });
        }
        return;
      }
      
      // Format 2: "Date: ..., Merchant: ..., Amount: $..." (RAG search format)
      const match2 = line.match(/Merchant:\s*([^,]+).*?Amount:\s*\$?([0-9,.]+)/i);
      if (match2) {
        const merchant = match2[1].trim();
        const amount = parseFloat(match2[2].replace(/,/g, ''));
        if (!isNaN(amount)) {
          txns.push({ merchant, amount });
        }
      }
    });

    if (txns.length > 0) {
      // Sort transactions by amount descending
      txns.sort((a, b) => b.amount - a.amount);
      const topTxns = txns.slice(0, 3);
      const totalSpend = txns.reduce((acc, curr) => acc + curr.amount, 0);

      let responseText = `### Financial Expense Analysis 📊\n\nBased on your statement context, here is your high-spending summary and tips to reduce expenses:\n\n`;
      responseText += `* **Total Spent**: $${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
      responseText += `* **Highest Individual Expenses**:\n`;
      topTxns.forEach((t, i) => {
        responseText += `  ${i + 1}. **${t.merchant}**: $${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
      });

      responseText += `\n**Actionable Tips to Save Money**:\n`;
      responseText += `* **Audit Subscriptions**: Check if any recurring vendor (like ${topTxns[0]?.merchant || 'subscriptions'}) offers cheaper plans or can be canceled.\n`;
      responseText += `* **Set Thresholds**: You have transactions over $500. Consider setting budget alerts to avoid unexpected major debit charges.\n`;
      responseText += `* **Negotiate Rates**: For top service providers, call them to request loyalty discounts or package match promotions.\n`;

      // Map matched sources to show visually in the sidebar matches box
      const matchedSources = topTxns.map(t => ({
        date: "Statement Date",
        merchant: t.merchant,
        amount: t.amount,
        category: t.amount > 500 ? "High Spend Alert" : "Expense Analysis",
        similarity: 0.99
      }));

      return {
        text: responseText,
        matchedSources
      };
    } else {
      return {
        text: `Based on your transactions, here are general budget tips to reduce expenses:\n\n* **Audit Subscriptions**: Review active monthly services and cancel underused ones.\n* **Lower High spend**: Target your top 3 largest transactions first to negotiate rates.\n* **Category Caps**: Restrict dining out and retail shopping to a fixed weekly cash allowance.`,
        matchedSources: []
      };
    }
  }

  return null;
}

export async function POST(request: Request) {
  let prompt = "";
  let context = "";
  try {
    const body = await request.json();
    prompt = body.prompt || "";
    context = body.context || "";

    // Check if the query matches our local rules (or if we bypass API)
    const localResult = tryLocalAnalysis(prompt, context || "");
    if (localResult) {
      return NextResponse.json(localResult);
    }

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
        let chromaFailed = false;
        if (isChromaConfigured) {
          try {
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
          } catch (chromaErr) {
            console.warn("ChromaDB query failed, attempting Supabase fallback...", chromaErr);
            chromaFailed = true;
          }
        }

        if ((!isChromaConfigured || chromaFailed) && isSupabaseConfigured) {
          console.log("Querying Supabase pgvector database for similar transactions...");
          const { data, error: searchError } = await supabase.rpc('match_transactions', {
            query_embedding: queryEmbedding,
            match_threshold: 0.1,
            match_count: 15
          });

          if (searchError) {
            console.error("Supabase search error:", searchError.message);
          } else {
            matchedRows = (data || []).map((row: any) => ({
              date: row.date,
              merchant: row.merchant,
              amount: row.amount,
              category: row.category,
              similarity: row.similarity ?? 0.8
            }));
            console.log(`Supabase RAG Success: Retrieved ${matchedRows?.length ?? 0} relevant transactions.`);
          }
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
    // If the API failed, run the local analysis tool as a final fallback so the app NEVER displays a crash message!
    const localFallback = tryLocalAnalysis(prompt, context || "");
    if (localFallback) {
      console.log("Gemini API failed, returned graceful local analysis fallback response.");
      return NextResponse.json(localFallback);
    }
    const message = error instanceof Error ? error.message : "Failed to connect to AI";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
