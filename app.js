async function generateContent() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const topic = document.getElementById('topic').value;
  const tone = document.getElementById('tone').value;
  const status = document.getElementById('status');
  const output = document.getElementById('output');
  const btn = document.getElementById('generateBtn');

  if (mode === 'manual' && !topic.trim()) {
    return alert('Please enter a content topic for manual mode.');
  }

  btn.disabled = true;
  status.innerHTML = '<div class="badge">🚀 Starting EZERV Forge in ' + mode.toUpperCase() + ' mode...</div>';
  output.style.display = 'none';

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, topic, tone })
    });

    const rawText = await res.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      throw new Error(`Server returned non-JSON error. Check Vercel logs. (${res.status})`);
    }

    if (!res.ok || data.error) {
      throw new Error(data.error || 'Failed to generate content.');
    }

    status.innerHTML = '<div class="badge">✅ Generated Content for topic: <b>' + data.topicUsed + '</b></div>';
    
    output.innerHTML = marked.parse(data.finalPost);
    output.style.display = 'block';

  } catch (err) {
    status.innerHTML = '<div style="color:#ef4444; font-weight:bold;">❌ Error: ' + err.message + '</div>';
  } finally {
    btn.disabled = false;
  }
}