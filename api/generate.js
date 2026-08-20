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
      return res.status(500).json({ error: 'GROQ_API_KEY environment variable is missing in Vercel.' });
    }

    // 1. Fetch available models from Groq
    const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!modelsRes.ok) {
      const errData = await modelsRes.json().catch(() => ({}));
      return res.status(modelsRes.status).json({ 
        error: errData.error?.message || 'Invalid Groq API key or Groq service issue.' 
      });
    }

    const modelsData = await modelsRes.json();
    const availableModelIds = (modelsData.data || []).map(m => m.id);

    // Filter out safety, vision, audio, and guard models
    const chatModels = availableModelIds.filter(id => 
      !id.includes('guard') && 
      !id.includes('whisper') && 
      !id.includes('vision') &&
      !id.includes('safetensors')
    );

    // Prioritize high-speed models with generous free tier limits
    const priorityModels = [
      'llama-3.1-8b-instant',
      'gemma2-9b-it',
      'mixtral-8x7b-32768',
      'llama-3.3-70b-versatile'
    ];

    const modelQueue = [
      ...priorityModels.filter(m => chatModels.includes(m)),
      ...chatModels.filter(m => !priorityModels.includes(m))
    ];

    if (modelQueue.length === 0) {
      return res.status(500).json({ error: 'No standard chat generation models available on this Groq account.' });
    }

    let finalTopic = topic && topic.trim() ? topic : "Autonomous AI Agents & Modern Tech Workflows";

    const systemPrompt = `You are an expert AI content creator generating viral, high-engagement content for LinkedIn.
Tone: ${tone || 'Professional & Engaging'}.

Formatting Rules:
1. Structure the post like a professional LinkedIn article with catchy headlines, clear sections, bullet points, and relevant emojis.
2. Add [INFOGRAPHIC: description] or [CHART: description] callouts where visual aids add key value.
3. Include a clean Markdown summary table where appropriate.`;

    const userPrompt = `Generate a comprehensive, engaging LinkedIn post on the topic: "${finalTopic}".`;

    let finalPost = null;
    let lastErrorMessage = '';

    // Loop through model queue if 429 rate limit or error occurs
    for (const model of modelQueue) {
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
          max_tokens: 800
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
        break; // Success
      } else {
        lastErrorMessage = data.error?.message || `Model ${model} failed`;
      }
    }

    if (!finalPost) {
      return res.status(429).json({ error: `Groq Rate Limit: ${lastErrorMessage}. Please wait 15 seconds and try again.` });
    }

    return res.status(200).json({
      topicUsed: finalTopic,
      finalPost
    });

  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}