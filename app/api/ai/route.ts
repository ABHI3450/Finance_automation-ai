import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { prompt, context } = await request.json();

    // Using Gemini 2.5 Flash - fast, accurate, and completely free in the tier
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
                  text: `${context}\n\nSystem Instructions: You are a smart financial advisor AI inside a finance dashboard. Be concise, friendly, and actionable. Use bullet points. Keep replies under 120 words.\n\nUser question: ${prompt}`
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

    return NextResponse.json({ text });
  } catch (error) {
    console.error("AI Route Error:", error);
    return NextResponse.json({ error: "Failed to connect to AI" }, { status: 500 });
  }
}
