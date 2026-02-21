'use strict';

// Pre-populate history with the bot's opening message so Gemini has context
// when the user replies to the hardcoded greeting shown on page load.
const OPENING_MESSAGE =
  "Good day. I'm the Landscale Digital Assistant — here to help qualify your garden project and get you connected with Milán's team.\n\n" +
  "Whether you're after a full patio build, soft landscaping, timber work, or ongoing maintenance, we can help.\n\n" +
  "To get started, could I take the postcode for the property?";

// Conversation history in Gemini multi-turn format.
// Seeded with a synthetic first exchange so the model knows its opening line.
const history = [
  { role: 'user',  parts: [{ text: 'Hello, I have a garden project I would like to discuss.' }] },
  { role: 'model', parts: [{ text: JSON.stringify({ message: OPENING_MESSAGE, lead: null }) }] },
];

const chatMessages = document.getElementById('chatMessages');
const messageInput  = document.getElementById('messageInput');
const sendButton    = document.getElementById('sendButton');
const typingIndicator = document.getElementById('typingIndicator');

// Allow Enter key to submit
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendButton.addEventListener('click', sendMessage);

let leadAlreadySent = false; // ensures only one email per conversation

async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || sendButton.disabled) return;

  messageInput.value = '';
  appendMessage(text, 'user');
  setLoading(true);

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history, leadAlreadySent }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const reply = data.reply || "Apologies — something went wrong on my end. Please try again.";

    if (data.leadSent) leadAlreadySent = true;

    // Append this exchange to history for the next turn
    history.push(
      { role: 'user',  parts: [{ text }] },
      { role: 'model', parts: [{ text: data.rawResponse || JSON.stringify({ message: reply, lead: null }) }] }
    );

    appendMessage(reply, 'bot');
  } catch (err) {
    console.error('Chat error:', err);
    appendMessage("Apologies — I'm having trouble connecting at the moment. Please try again shortly.", 'bot');
  } finally {
    setLoading(false);
    messageInput.focus();
  }
}

function appendMessage(text, role) {
  const wrapper = document.createElement('div');
  wrapper.className = `message ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = formatMessage(text);

  wrapper.appendChild(bubble);
  chatMessages.appendChild(wrapper);
  scrollToBottom();
}

function formatMessage(text) {
  // 1. Escape HTML entities in plain text segments (before linkifying)
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Linkify URLs (safe after escaping — URLs won't contain < >)
  const linked = escaped.replace(
    /(https?:\/\/[^\s<"]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // 3. Bold **text**
  const bolded = linked.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 4. Newlines to <br>
  return bolded.replace(/\n/g, '<br>');
}

function setLoading(loading) {
  sendButton.disabled   = loading;
  messageInput.disabled = loading;
  typingIndicator.style.display = loading ? 'block' : 'none';
  if (loading) scrollToBottom();
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
