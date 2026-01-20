(function () {
  const FUNCTION_URL = "https://helpful-toffee-fd42c2.netlify.app/.netlify/functions/faq-agent";

  let chatOpen = false;
  let chatWindow = null;
  let messagesContainer = null;
  let inputElement = null;
  let sending = false;

  function createLauncher() {
    const btn = document.createElement("div");
    btn.className = "faq-chat-launcher";
    btn.textContent = "Ask a question";
    btn.onclick = toggleChat;
    document.body.appendChild(btn);
  }

  function toggleChat() {
    if (chatOpen) {
      chatWindow.remove();
      chatOpen = false;
    } else {
      openChat();
      chatOpen = true;
    }
  }

  function openChat() {
    chatWindow = document.createElement("div");
    chatWindow.className = "faq-chat-window";

    const header = document.createElement("div");
    header.className = "faq-chat-header";
    header.textContent = "Landscaping FAQ assistant";

    messagesContainer = document.createElement("div");
    messagesContainer.className = "faq-chat-messages";

    const inputBar = document.createElement("div");
    inputBar.className = "faq-chat-input";

    inputElement = document.createElement("input");
    inputElement.type = "text";
    inputElement.placeholder = "Ask a question about our services";

    const sendBtn = document.createElement("button");
    sendBtn.textContent = "Send";

    sendBtn.onclick = sendMessage;
    inputElement.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        sendMessage();
      }
    });

    inputBar.appendChild(inputElement);
    inputBar.appendChild(sendBtn);

    chatWindow.appendChild(header);
    chatWindow.appendChild(messagesContainer);
    chatWindow.appendChild(inputBar);

    document.body.appendChild(chatWindow);

    addMessage(
      "bot",
      "Hi. I can answer questions about our landscaping and garden services. How can I help you."
    );
  }

  function addMessage(sender, text) {
    const msg = document.createElement("div");
    msg.className = "faq-chat-message " + sender;
    msg.textContent = sender + ": " + text;
    messagesContainer.appendChild(msg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  async function sendMessage() {
    if (sending) return;
    const text = (inputElement.value || "").trim();
    if (!text) return;

    addMessage("user", text);
    inputElement.value = "";
    sending = true;

    addMessage("bot", "Thinking...");

    try {
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });

      const botMessages = messagesContainer.querySelectorAll(".faq-chat-message.bot");
      const lastBot = botMessages[botMessages.length - 1];
      if (lastBot && lastBot.textContent.endsWith("Thinking...")) {
        lastBot.remove();
      }

      if (!res.ok) {
        addMessage("bot", "Sorry, something went wrong. Please try again later.");
        sending = false;
        return;
      }

      const data = await res.json();
      addMessage("bot", data.answer || "Sorry, I could not find an answer.");
    } catch (err) {
      console.error(err);
      addMessage("bot", "Sorry, there was a problem connecting to the server.");
    } finally {
      sending = false;
    }
  }

  function init() {
    createLauncher();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
