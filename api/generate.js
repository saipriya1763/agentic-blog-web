export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const body = req.body || {};

    const action = body.action;
    const mode = body.mode;
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const tone = typeof body.tone === "string" ? body.tone.trim() : "Professional & Engaging";
    const pages = body.pages;
    const plan = body.plan;

    const apiKey = String(process.env.GROQ_API_KEY || "")
      .replace(/[^\x00-\x7F]/g, "")
      .trim();

    if (!apiKey) {
      return res.status(500).json({
        error: "GROQ_API_KEY is not configured. Add it to your Vercel/local development environment."
      });
    }

    if (action === "plan") {
      return await createPlan({
        res,
        apiKey,
        mode,
        topic,
        tone,
        pages
      });
    }

    if (action === "generate") {
      return await generateFinalContent({
        res,
        apiKey,
        topic,
        tone,
        pages,
        plan
      });
    }

    return res.status(400).json({
      error: "Invalid generation action."
    });
  } catch (error) {
    console.error("EZERV Forge:", error);

    const message = getSafeErrorMessage(error);

    return res.status(error?.statusCode || 500).json({
      error: message
    });
  }
}

/* =========================================================
   GROQ STANDARD MODEL CALL
========================================================= */

async function callGroq({
  apiKey,
  messages,
  maxTokens = 4000,
  temperature = 0.6,
  responseFormat = null
}) {
  const models = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "llama-3.3-70b-versatile"
  ];

  let lastError = "Unknown Groq error.";

  for (const model of models) {
    try {
      const payload = {
        model,
        messages,
        temperature,
        max_completion_tokens: maxTokens
      };

      if (responseFormat) {
        payload.response_format = responseFormat;
      }

      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      const text = await response.text();

      let data = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        lastError = `Groq returned a non-JSON response (${response.status}).`;
        continue;
      }

      if (response.ok && data.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
      }

      lastError =
        data.error?.message ||
        `Groq model ${model} failed with HTTP ${response.status}.`;

      // Do not retry request-size errors with another standard model.
      if (response.status === 413) {
        break;
      }
    } catch (error) {
      lastError = error?.message || "Network error while contacting Groq.";
    }
  }

  throw new Error(`Groq generation failed: ${lastError}`);
}

/* =========================================================
   AUTOMATIC TOPIC DISCOVERY

   Uses Groq Compound Mini because it supports one real-time web
   search per request and is designed for low-latency single-search
   use cases.
========================================================= */

async function discoverTopic(apiKey) {
  const prompt = `
Use ONE live web search to identify one genuinely current, high-interest technology topic for a technical article.

Focus on AI, agentic AI, machine learning, software engineering, data engineering, cybersecurity, IoT, robotics, cloud, quantum computing, astronomy, space technology, mathematics, computer science, semiconductors, scientific computing, or emerging technologies.

Prefer recent announcements, releases, research breakthroughs, engineering developments, or important technical trends. Do not invent a trend.

After the web search, return ONLY a JSON object with this structure:
{
  "topic": "one specific article topic",
  "domain": "one domain",
  "reason": "why it is timely and valuable",
  "trendSignals": ["signal 1", "signal 2", "signal 3"]
}

Keep every field concise.
`;

  // IMPORTANT:
  // Do not use groq/compound or compound-mini here. Groq's browser_search
  // tool is supported directly by GPT-OSS models and avoids the request-size
  // failure we were seeing with Compound.
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2,
        max_completion_tokens: 900,
        tool_choice: "required",
        tools: [
          {
            type: "browser_search"
          }
        ]
      })
    }
  );

  const text = await response.text();

  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    const error = new Error(
      `Automatic web research returned an invalid Groq response (HTTP ${response.status}).`
    );
    error.statusCode = response.status;
    throw error;
  }

  if (!response.ok) {
    const message = data.error?.message || "Automatic web research failed.";
    const error = new Error(
      `Automatic topic research failed (${response.status}): ${message}`
    );
    error.statusCode = response.status;
    throw error;
  }

  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(
      "Automatic topic research returned no topic."
    );
  }

  const result = parseJSON(content);

  if (!result.topic) {
    throw new Error(
      "Automatic topic research returned an incomplete topic result."
    );
  }

  return {
    topic: String(result.topic).trim(),
    domain: String(result.domain || "Emerging Technology").trim(),
    reason: String(
      result.reason ||
        "A current technology development was identified from live web research."
    ).trim(),
    trendSignals: Array.isArray(result.trendSignals)
      ? result.trendSignals.map(String).slice(0, 5)
      : []
  };
}

/* =========================================================
   CREATE PLAN
========================================================= */

async function createPlan({
  res,
  apiKey,
  mode,
  topic,
  tone,
  pages
}) {
  const pageCount = clampPages(pages);

  let finalTopic = topic;
  let topicReason = "";
  let domain = "";
  let trendSignals = [];

  if (mode === "automatic") {
    const discovered = await discoverTopic(apiKey);

    finalTopic = discovered.topic || "Emerging Technology Trends";
    topicReason = discovered.reason || "";
    domain = discovered.domain || "";
    trendSignals = discovered.trendSignals || [];
  }

  if (!finalTopic) {
    return res.status(400).json({
      error: "A topic is required."
    });
  }

  const planningPrompt = `
You are the Content Planning Agent of EZERV Forge.

Create a detailed, practical content architecture for a serious technical article.

TOPIC:
${finalTopic}

DOMAIN:
${domain || "User selected"}

TONE:
${tone}

TARGET LENGTH:
${pageCount} page${pageCount === 1 ? "" : "s"}

Create an appropriate number of sections for the requested length.

For every section provide:
- title
- purpose
- keyPoints (3 to 6 concise points)

Also provide useful visual ideas using these types when appropriate:
- infographic
- architecture diagram
- flowchart
- chart
- comparison table

Return ONLY JSON in this structure:
{
  "pageCount": ${pageCount},
  "sections": [
    {
      "title": "...",
      "purpose": "...",
      "keyPoints": ["...", "..."]
    }
  ],
  "visuals": [
    {
      "type": "diagram",
      "description": "..."
    }
  ]
}
`;

  const content = await callGroq({
    apiKey,
    messages: [
      {
        role: "user",
        content: planningPrompt
      }
    ],
    maxTokens: 3500,
    temperature: 0.35,
    responseFormat: {
      type: "json_object"
    }
  });

  const contentPlan = parseJSON(content);

  const normalizedPlan = normalizePlan(
    contentPlan,
    pageCount
  );

  return res.status(200).json({
    topicUsed: finalTopic,
    topicReason,
    domain,
    trendSignals,
    tone,
    pages: pageCount,
    plan: normalizedPlan
  });
}

/* =========================================================
   FINAL CONTENT
========================================================= */

async function generateFinalContent({
  res,
  apiKey,
  topic,
  tone,
  pages,
  plan
}) {
  const pageCount = clampPages(pages);

  // 1-2 pages = 1 call
  // 3-4 pages = 2 calls
  // 5-6 pages = 3 calls
  // 7-8 pages = 4 calls
  // 9-10 pages = 5 calls
  const generationCalls = Math.ceil(pageCount / 2);

  const sections = Array.isArray(plan?.sections)
    ? plan.sections
    : [];

  const usableSections = sections.length
    ? sections
    : [
        {
          title: "Main Content",
          purpose: "Develop the topic comprehensively.",
          keyPoints: []
        }
      ];

  const chunks = splitSections(
    usableSections,
    generationCalls
  );

  const generatedParts = [];

  for (let index = 0; index < chunks.length; index++) {
    const part = chunks[index];

    const prompt = `
You are the final Content Generation Agent inside EZERV Forge.

Generate part ${index + 1} of ${chunks.length} of a publication-ready technical article.

TOPIC:
${topic}

TONE:
${tone}

TOTAL TARGET LENGTH:
${pageCount} page${pageCount === 1 ? "" : "s"}

APPROVED CONTENT PLAN FOR THIS PART:
${JSON.stringify(part, null, 2)}

Requirements:
1. Follow the approved plan.
2. Do not change the topic.
3. Do not mention AI generation, prompts, agents, or these instructions.
4. Avoid filler and repetition.
5. Explain technical concepts accurately and clearly.
6. Use Markdown headings, paragraphs, lists, and tables where useful.
7. Include practical examples when appropriate.
8. Include methodology or implementation details when relevant.
9. Keep this part focused on its assigned sections.
10. The final part should end with a strong conclusion.
11. Use these exact visual placeholders where useful:
   [INFOGRAPHIC: description]
   [CHART: description]
   [DIAGRAM: description]
   [TABLE: description]
12. Return only Markdown content.
`;

    const result = await callGroq({
      apiKey,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      maxTokens: pageCount <= 2 ? 4500 : pageCount <= 6 ? 5500 : 6500,
      temperature: 0.65
    });

    generatedParts.push(result.trim());
  }

  const finalPost = generatedParts
    .filter(Boolean)
    .join("\n\n---\n\n");

  if (!finalPost) {
    throw new Error("Groq returned empty final content.");
  }

  return res.status(200).json({
    topicUsed: topic,
    pages: pageCount,
    generationCalls: generatedParts.length,
    finalPost
  });
}

/* =========================================================
   PLAN NORMALIZATION
========================================================= */

function normalizePlan(plan, pageCount) {
  const sections = Array.isArray(plan?.sections)
    ? plan.sections
        .filter(Boolean)
        .map(section => ({
          title: String(section.title || "Section").trim(),
          purpose: String(section.purpose || "Develop this part of the article.").trim(),
          keyPoints: Array.isArray(section.keyPoints)
            ? section.keyPoints.map(String).slice(0, 8)
            : []
        }))
    : [];

  const visuals = Array.isArray(plan?.visuals)
    ? plan.visuals
        .filter(Boolean)
        .map(visual => ({
          type: String(visual.type || "Visual").trim(),
          description: String(visual.description || "Useful supporting visual.").trim()
        }))
        .slice(0, 12)
    : [];

  return {
    pageCount,
    sections: sections.length
      ? sections
      : [
          {
            title: "Introduction",
            purpose: "Introduce the topic and establish why it matters.",
            keyPoints: ["Context", "Importance", "Scope"]
          },
          {
            title: "Core Concepts",
            purpose: "Explain the essential technical concepts.",
            keyPoints: ["Definitions", "Architecture", "Key mechanisms"]
          },
          {
            title: "Applications and Examples",
            purpose: "Show how the concepts are applied in practice.",
            keyPoints: ["Use cases", "Examples", "Practical considerations"]
          },
          {
            title: "Challenges and Future Outlook",
            purpose: "Discuss limitations and future directions.",
            keyPoints: ["Challenges", "Open questions", "Future developments"]
          },
          {
            title: "Conclusion",
            purpose: "Summarize the key takeaways.",
            keyPoints: ["Main findings", "Practical takeaway", "Closing perspective"]
          }
        ],
    visuals
  };
}

/* =========================================================
   SPLIT PLAN
========================================================= */

function splitSections(sections, count) {
  const safeCount = Math.max(1, Number(count) || 1);

  const chunks = Array.from(
    { length: safeCount },
    () => []
  );

  sections.forEach((section, index) => {
    chunks[index % safeCount].push(section);
  });

  return chunks.filter(chunk => chunk.length > 0);
}

/* =========================================================
   PAGE LIMIT
========================================================= */

function clampPages(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 1;
  }

  return Math.min(
    Math.max(Math.round(number), 1),
    10
  );
}

/* =========================================================
   JSON PARSER
========================================================= */

function parseJSON(text) {
  const cleaned = String(text || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start !== -1 && end > start) {
      try {
        return JSON.parse(
          cleaned.substring(start, end + 1)
        );
      } catch {
        // Fall through to the clearer error below.
      }
    }

    throw new Error(
      "AI returned invalid JSON while creating the content plan."
    );
  }
}

/* =========================================================
   ERROR MESSAGE
========================================================= */

function getSafeErrorMessage(error) {
  const message = String(
    error?.message || "Internal Server Error"
  );

  if (message.includes("413") || /entity too large/i.test(message)) {
    return "Groq rejected the request as too large. EZERV Forge has been switched away from Compound for automatic research. Restart Vercel Dev and try Automatic mode again.";
  }

  if (/401|unauthorized|invalid api key/i.test(message)) {
    return "Groq authentication failed. Check GROQ_API_KEY in the Vercel environment without pasting the key into chat.";
  }

  if (/429|rate limit/i.test(message)) {
    return "Groq rate limit reached. Wait a moment and try again.";
  }

  return message.slice(0, 1000);
}
