export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mode, topic, tone } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY is missing in Vercel environment variables.' });
  }

  let finalTopic = topic && topic.trim() ? topic : "Autonomous AI Agents & Modern Tech Workflows";

  const systemPrompt = `You are an expert AI content creator generating viral, high-engagement content for LinkedIn.
Tone: ${tone}.

Formatting Rules:
1. Structure the post like a professional LinkedIn article with catchy headlines, clear sections, bullet points, and relevant emojis.
2. Add [INFOGRAPHIC: description] or [CHART: description] callouts where visual aids add key value.
3. Include a clean Markdown summary table where appropriate.`;

  const userPrompt = `Generate a comprehensive, engaging LinkedIn post on the topic: "${finalTopic}".`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2048
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to fetch from Groq API');
    }

    const finalPost = data.choices[0]?.message?.content || "No content generated.";

    return res.status(200).json({
      topicUsed: finalTopic,
      finalPost
    });

  } catch (error) {
    return res.status(500).json({ error: error.message || "Connection error occurred." });
  }
}