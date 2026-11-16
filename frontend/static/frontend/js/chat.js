//Accessibility settings
const A11Y_KEY = "kyd-accessibility";
const FONT_SIZES = ["small", "medium", "large"];
const a11y = { fontSize: "medium", colorblind: false };

try {
    const saved = JSON.parse(localStorage.getItem(A11Y_KEY) || "{}");
    if (FONT_SIZES.includes(saved.fontSize)) a11y.fontSize = saved.fontSize;
    a11y.colorblind = saved.colorblind === true;
} catch (e) {
}

function applyA11y() {
    const root = document.documentElement;
    root.setAttribute("data-font-size", a11y.fontSize);
    root.setAttribute("data-colorblind", String(a11y.colorblind));

    try {
        localStorage.setItem(A11Y_KEY, JSON.stringify(a11y));
    } catch (e) {
    }
}

applyA11y();

document.addEventListener("DOMContentLoaded", () => {
    const chatArea = document.getElementById("chat-messages");
    const chatInput = document.getElementById("chat-input");
    const sendButton = document.getElementById("send-button");
    const newChatButton = document.getElementById("new-chat-button");
    const a11yButton = document.getElementById("accessibility-button");
    const a11yPanel = document.getElementById("accessibility-panel");
    const colorblindToggle = document.getElementById("colorblind-toggle");
    const fontRadios = document.querySelectorAll('input[name="font-size"]');

    let currentRequest = null;

    // ---- Accessibility menu ----
    fontRadios.forEach((radio) => {
        radio.checked = radio.value === a11y.fontSize;
        radio.addEventListener("change", () => {
            if (radio.checked) {
                a11y.fontSize = radio.value;
                applyA11y();
            }
        });
    });

    colorblindToggle.checked = a11y.colorblind;
    colorblindToggle.addEventListener("change", () => {
        a11y.colorblind = colorblindToggle.checked;
        applyA11y();
    });

    function setPanelOpen(open) {
        a11yPanel.hidden = !open;
        a11yButton.setAttribute("aria-expanded", String(open));
    }

    a11yButton.addEventListener("click", () => {
        setPanelOpen(a11yPanel.hidden);
    });

    document.addEventListener("click", (event) => {
        if (!a11yPanel.hidden &&
            !a11yPanel.contains(event.target) &&
            !a11yButton.contains(event.target)) {
            setPanelOpen(false);
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !a11yPanel.hidden) {
            setPanelOpen(false);
            a11yButton.focus();
        }
    });

    // ---- New chat ----
    newChatButton.addEventListener("click", () => {
        if (currentRequest) {
            currentRequest.abort();
            currentRequest = null;
        }

        chatArea.innerHTML = "";
        chatInput.value = "";
        chatInput.focus();
    });

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

        const controller = new AbortController();
        currentRequest = controller;

        try {
            const response = await fetch("/api/chat/", {
                method: "POST", signal: controller.signal,
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
          if (error.name !== "AbortError") {
        loadingMessage.textContent = "Error: " + error.message;
          }
        } finally {
            if (currentRequest === controller) currentRequest = null;
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
