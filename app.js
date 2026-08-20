async function generateContent() {
  const topic = document.getElementById('topic').value;
  const tone = document.getElementById('tone').value;
  const status = document.getElementById('status');
  const output = document.getElementById('output');
  const btn = document.getElementById('generateBtn');

  if (!topic) return alert('Please enter a topic');

  btn.disabled = true;
  status.innerText = '🤖 Agents are planning, writing, and editing...';
  output.style.display = 'none';

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, tone })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    status.innerText = '✅ Content generated successfully!';
    output.style.display = 'block';
    output.innerText = data.finalPost;
  } catch (err) {
    status.innerText = '❌ Error: ' + err.message;
  } finally {
    btn.disabled = false;
  }
}