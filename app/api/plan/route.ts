import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { distance, photos } = await req.json();

    const systemPrompt = `You are a lightning safety assistant. You will receive:
- An estimated distance to lightning (in miles, from flash-to-bang timing)
- Up to 4 photos of the user's surroundings

Your job: analyze the photos for lightning hazards (open fields, tall isolated trees, metal structures/bleachers, water, high exposed ground, lack of enclosed shelter), determine from the photos whether the user is INDOORS or OUTDOORS, combine that with the distance, and return a clear, prioritized safety plan.

IMPORTANT RULES:
- The distance is an ESTIMATE. Lightning can strike 10+ miles from a storm. Always advise seeking shelter regardless of distance.
- Determine from the photos if the user is INDOORS (walls, ceiling, room visible) or OUTDOORS. If indoors, give indoor lightning precautions (stay off corded electronics, avoid plumbing and water, stay away from windows). If outdoors, give shelter-seeking advice based on the hazards you see.
- Never claim to measure anything from the photos — only describe what you see.
- You ADVISE; the human makes the final decision. Recommend confirming with local emergency services.

Respond ONLY with valid JSON in exactly this format, no other text:
{
  "riskLevel": "Extreme" | "High" | "Caution" | "Low",
  "hazards": ["short hazard phrase", "..."],
  "steps": ["clear action step", "..."],
  "reasoning": "one or two sentences explaining the risk"
}`;

    const imageContent = (photos || []).map((p: string) => ({
      type: "image_url" as const,
      image_url: { url: p },
    }));

    const userText = `Distance to lightning: ${distance} miles. Analyze the ${photos?.length || 0} photos, decide if the user is indoors or outdoors, identify hazards, and give the safety plan.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [{ type: "text", text: userText }, ...imageContent],
        },
      ],
      max_tokens: 700,
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    const clean = raw.replace(/```json|```/g, "").trim();
    const plan = JSON.parse(clean);

    return NextResponse.json(plan);
  } catch (err) {
    console.error("plan route error:", err);
    return NextResponse.json({ error: "Could not generate plan" }, { status: 500 });
  }
}