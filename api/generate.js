import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mode, topic, tone } = req.body;
  const model = "llama-3.3-70b-versatile";

  try {
    let selectedTopic = topic;

    // Automatic Mode Topic Discovery
    if (mode === 'automatic') {
      const topicDiscovery = await groq.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are an AI trend analyst. Output ONLY one trending topic name in Data Science, Software Engineering, Quantum Computing, AI, Aerospace, or Cloud Tech.'
          },
          {
            role: 'user',
            content: 'Select 1 single high-impact on-demand tech topic for a viral LinkedIn blog post.'
          }
        ]
      });
      selectedTopic = topicDiscovery.choices[0].message.content.trim();
    }

    // Agent 1: Planner
    const plannerRes = await groq.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert AI Content Planner for high-performing LinkedIn posts.'
        },
        {
          role: 'user',
          content: `Create a structured outline with key takeaways, hook ideas, and target sections for topic: ${selectedTopic}`
        }
      ]
    });
    const outline = plannerRes.choices[0].message.content;

    // Agent 2 & 3: Writer & Editor Chained with LinkedIn + Visual Prompts
    const contentRes = await groq.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are a viral LinkedIn Tech Content Creator and Senior Editor. Tone: ${tone}.
          Follow these formatting guidelines:
          1. Use engaging LinkedIn style formatting (catchy title, emojis, concise paragraphs, bullet points, and key takeaways).
          2. Insert visual callouts like [INFOGRAPHIC: description] or [CHART: description] where visual representations add value.
          3. Include structured Markdown tables for key comparisons or summaries wherever applicable.`
        },
        {
          role: 'user',
          content: `Topic: ${selectedTopic}\nOutline:\n${outline}\n\nWrite and edit the final post now.`
        }
      ]
    });

    const finalPost = contentRes.choices[0].message.content;

    return res.status(200).json({ 
      topicUsed: selectedTopic,
      finalPost 
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}