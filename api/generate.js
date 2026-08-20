export default async function handler(req, res) {
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

    // Candidate active Groq models in order of priority
    const models = [
      'mixtral-8x7b-32768',
      'gemma2-9b-it',
      'llama-3.3-70b-versatile'
    ];

    let finalPost = null;
    let lastErrorMessage = '';

    for (const model of models) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model,
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
          continue;
        }

        if (groqRes.ok && data.choices?.[0]?.message?.content) {
          finalPost = data.choices[0].message.content;
          break; // Stop loop on successful generation
        } else {
          lastErrorMessage = data.error?.message || `Model ${model} failed`;
        }
      } catch (err) {
        lastErrorMessage = err.message;
      }
    }

    if (!finalPost) {
      return res.status(500).json({ error: `Groq error: ${lastErrorMessage}` });
    }

    return res.status(200).json({
      topicUsed: finalTopic,
      finalPost
    });

  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}