document.addEventListener("DOMContentLoaded", () => {
  const sendBtn = document.getElementById("sendBtn");
  const messageInput = document.getElementById("messageInput");
  const messages = document.getElementById("messages");

  function addMessage(content, sender) {
    const msg = document.createElement("div");
    msg.classList.add("message", sender);
    msg.textContent = content;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
  }

  sendBtn.addEventListener("click", () => {
    const text = messageInput.value.trim();
    if (text !== "") {
      addMessage(text, "user");
      messageInput.value = "";

      // Fake bot reply
      setTimeout(() => {
        addMessage("Got it! 👍", "bot");
      }, 500);
    }
  });

  messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendBtn.click();
    }
  });
});
