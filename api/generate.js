export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { mode, topic, tone } = req.body || {};
    
    // Sanitize key
    const rawKey = process.env.GROQ_API_KEY || '';
    const apiKey = rawKey.replace(/[^\x00-\x7F]/g, '').trim();

    if (!apiKey) {
      return res.status(500).json({ error: 'GROQ_API_KEY environment variable is not configured in Vercel.' });
    }

    let finalTopic = topic && topic.trim() ? topic : "Autonomous AI Agents & Modern Tech Workflows";

    const systemPrompt = `You are an expert AI content creator generating viral, high-engagement content for LinkedIn.
Tone: ${tone || 'Professional & Engaging'}.

Formatting Rules:
1. Structure the post like a professional LinkedIn article with catchy headlines, clear sections, bullet points, and relevant emojis.
2. Add [INFOGRAPHIC: description] or [CHART: description] callouts where visual aids add key value.
3. Include a clean Markdown summary table where appropriate.`;

    const userPrompt = `Generate a comprehensive, engaging LinkedIn post on the topic: "${finalTopic}".`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    const textResponse = await groqRes.text();
    let data;
    try {
      data = JSON.parse(textResponse);
    } catch (e) {
      return res.status(500).json({ error: `Groq API raw response error: ${textResponse}` });
    }

    if (!groqRes.ok) {
      return res.status(groqRes.status).json({ 
        error: data.error?.message || 'Groq API request failed.' 
      });
    }

    const finalPost = data.choices?.[0]?.message?.content || "No content generated.";

    return res.status(200).json({
      topicUsed: finalTopic,
      finalPost
    });

  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}