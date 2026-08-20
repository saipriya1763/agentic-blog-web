function handleModeChange() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const topicContainer = document.getElementById('topicContainer');
  topicContainer.style.display = mode === 'manual' ? 'block' : 'none';
}

function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  html.setAttribute('data-theme', currentTheme === 'dark' ? 'light' : 'dark');
}

async function generateContent() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const topic = document.getElementById('topic').value;
  const tone = document.getElementById('tone').value;
  const status = document.getElementById('status');
  const output = document.getElementById('output');
  const btn = document.getElementById('generateBtn');

  if (mode === 'manual' && !topic.trim()) {
    return alert('Please enter a content topic.');
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

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    status.innerHTML = '<div class="badge">✅ Generated Content for topic: <b>' + data.topicUsed + '</b></div>';
    
    // Parse Markdown into rich HTML (Tables, Emojis, Bold Text)
    output.innerHTML = marked.parse(data.finalPost);
    output.style.display = 'block';

  } catch (err) {
    status.innerHTML = '<div style="color:#ef4444; font-weight:bold;">❌ Error: ' + err.message + '</div>';
  } finally {
    btn.disabled = false;
  }
}