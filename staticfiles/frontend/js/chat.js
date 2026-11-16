
document.addEventListener("DOMContentLoaded", () => {
    const chatArea = document.getElementById("chat-messages");
    const chatInput = document.getElementById("chat-input");
    const sendButton = document.getElementById("send-button");

    function addMessage(text, sender) {
        const message = document.createElement("div");
        message.className = `chat-message ${sender}`;
        message.textContent = text;
        chatArea.appendChild(message);
        chatArea.scrollTop = chatArea.scrollHeight;
        return message;
    }

    async function sendMessage() {
        const message = chatInput.value.trim();

        if (!message || sendButton.disabled) return;

        addMessage(message, "user");
        chatInput.value = "";

        sendButton.disabled = true;
        sendButton.textContent = "Thinking...";

        const loadingMessage = addMessage("Thinking...", "assistant");

        try {
            const response = await fetch("/api/chat/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCookie("csrftoken")
                },
                body: JSON.stringify({ message })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Something went wrong.");
            }

            if (typeof marked !== "undefined" && typeof DOMPurify !== "undefined") {
    loadingMessage.innerHTML = DOMPurify.sanitize(
        marked.parse(data.reply || "")
    );
} else {
    loadingMessage.textContent = data.reply || "";
}

        } catch (error) {
            loadingMessage.textContent = "Error: " + error.message;
        } finally {
            sendButton.disabled = false;
            sendButton.textContent = "Send";
            chatInput.focus();
        }
    }

    function getCookie(name) {
        const cookies = document.cookie.split(";");

        for (const cookie of cookies) {
            const trimmed = cookie.trim();

            if (trimmed.startsWith(name + "=")) {
                return decodeURIComponent(
                    trimmed.substring(name.length + 1)
                );
            }
        }

        return "";
    }

    sendButton.addEventListener("click", sendMessage);

    chatInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });
});
