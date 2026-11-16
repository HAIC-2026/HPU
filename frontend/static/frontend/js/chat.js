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
    
 // Chat history (saved in this browser)
    const historyList = document.getElementById("history");
    const CHATS_KEY = "kyd-chats";
    let chats = loadChats();
    let currentChatId = null;
    let messages = [];
 
    function loadChats() {
        try {
            const saved = JSON.parse(localStorage.getItem(CHATS_KEY) || "[]");
            return Array.isArray(saved) ? saved : [];
        } catch (e) {
            return [];
        }
    }
 
    function persistChats() {
        try {
            localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
        } catch (e) {
            // Storage full or unavailable: history just won't be saved
        }
    }
 
    function cancelRequest() {
        if (currentRequest) {
            currentRequest.abort();
            currentRequest = null;
        }
    }
 
    function showReply(element, text) {
        if (typeof marked !== "undefined" && typeof DOMPurify !== "undefined") {
            element.innerHTML = DOMPurify.sanitize(marked.parse(text));
        } else {
            element.textContent = text;
        }
    }
 
    function saveCurrentChat() {
        if (messages.length === 0) return;
 
        let chat = chats.find((c) => c.id === currentChatId);
 
        if (!chat) {
            currentChatId = String(Date.now());
            const first = messages[0].text;
            chat = {
                id: currentChatId,
                title: first.length > 40 ? first.slice(0, 40) + "\u2026" : first,
                messages: []
            };
        }
 
        chat.messages = messages;
        chats = [chat, ...chats.filter((c) => c !== chat)];
        persistChats();
        renderHistory();
    }
 
    function startNewChat() {
        cancelRequest();
        currentChatId = null;
        messages = [];
        chatArea.innerHTML = "";
        chatInput.value = "";
        renderHistory();
        chatInput.focus();
    }
 
    function openChat(id) {
        const chat = chats.find((c) => c.id === id);
        if (!chat) return;
 
        cancelRequest();
        currentChatId = id;
        messages = chat.messages;
        chatArea.innerHTML = "";
 
        messages.forEach((m) => {
            const element = addMessage("", m.sender);
            if (m.sender === "assistant") {
                showReply(element, m.text);
            } else {
                element.textContent = m.text;
            }
        });
 
        renderHistory();
        chatInput.focus();
    }
 
    function deleteChat(id) {
        chats = chats.filter((c) => c.id !== id);
        persistChats();
 
        if (id === currentChatId) {
            startNewChat();
        } else {
            renderHistory();
        }
    }
 
    function renderHistory() {
        historyList.innerHTML = "";
 
        if (chats.length === 0) {
            const empty = document.createElement("p");
            empty.className = "history-empty";
            empty.textContent = "No saved chats yet.";
            historyList.appendChild(empty);
            return;
        }
 
        chats.forEach((chat) => {
            const row = document.createElement("div");
            row.className = "history-item";
            const isActive = chat.id === currentChatId;
            if (isActive) row.classList.add("active");
 
            const open = document.createElement("button");
            open.type = "button";
            open.className = "history-open";
            open.textContent = chat.title;
            open.title = chat.title;
            if (isActive) open.setAttribute("aria-current", "true");
            open.addEventListener("click", () => openChat(chat.id));
 
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "history-delete";
            remove.textContent = "\u00d7";
            remove.setAttribute("aria-label", "Delete chat: " + chat.title);
            remove.addEventListener("click", () => deleteChat(chat.id));
 
            row.append(open, remove);
            historyList.appendChild(row);
        });
    }
 
    renderHistory();

    //Accessibility menu
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

    //New chat
    newChatButton.addEventListener("click", startNewChat);

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

            const reply = data.reply || "";
            showReply(loadingMessage, reply);
 
            // Save this exchange to the current chat's history
            messages.push(
                { sender: "user", text: message },
                { sender: "assistant", text: reply }
            );
            saveCurrentChat();

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
