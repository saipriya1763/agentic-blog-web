import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { topic, tone } = req.body;
  const model = "llama-3.3-70b-versatile";

  try {
    // Agent 1: Planner
    const plannerRes = await groq.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are an expert AI content planner.' },
        { role: 'user', content: `Create a brief outline for topic: ${topic}` }
      ]
    });
    const outline = plannerRes.choices[0].message.content;

    // Agent 2: Writer
    const writerRes = await groq.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: `You are a technical content writer. Tone: ${tone}` },
        { role: 'user', content: `Topic: ${topic}\nOutline:\n${outline}` }
      ]
    });
    const draft = writerRes.choices[0].message.content;

    // Agent 3: Editor
    const editorRes = await groq.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are a senior editor. Refine formatting and clarity.' },
        { role: 'user', content: `Draft:\n${draft}` }
      ]
    });
    const finalPost = editorRes.choices[0].message.content;

    return res.status(200).json({ outline, finalPost });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}