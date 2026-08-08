const API_URL = "http://localhost:3000";

let messages = [];
let generatedReply = "";


/* =========================
   DOM
========================= */

const messagesContainer =
    document.getElementById("messages");

const instructionInput =
    document.getElementById("instruction");

const generateBtn =
    document.getElementById("generateBtn");

const statusElement =
    document.getElementById("status");

const refreshBtn =
    document.getElementById("refreshBtn");

const last5Btn =
    document.getElementById("last5Btn");

const selectAllBtn =
    document.getElementById("selectAllBtn");

const clearAllBtn =
    document.getElementById("clearAllBtn");


/* =========================
   STATUS
========================= */

function setStatus(text) {
    statusElement.textContent = text;
}


/* =========================
   WHATSAPP TAB
========================= */

async function getWhatsAppTab() {

    const tabs =
        await chrome.tabs.query({
            url: "https://web.whatsapp.com/*"
        });

    if (!tabs.length) {
        throw new Error(
            "WhatsApp Web is not open."
        );
    }

    return tabs[0];
}


/* =========================
   SEND MESSAGE TO CONTENT
========================= */

async function sendToWhatsApp(
    message
) {

    const tab =
        await getWhatsAppTab();

    try {

        return await chrome.tabs.sendMessage(
            tab.id,
            message
        );

    } catch (error) {

        console.error(
            "Content script error:",
            error
        );

        throw new Error(
            "WhatsApp connection failed. Reload WhatsApp Web and try again."
        );
    }
}


/* =========================
   LOAD CHAT
========================= */

async function loadMessages() {

    try {

        setStatus(
            "Reading conversation..."
        );


        const response =
            await sendToWhatsApp({
                type: "GET_MESSAGES"
            });


        if (!response?.success) {

            throw new Error(
                response?.error ||
                "Could not read WhatsApp."
            );
        }


        messages =
            response.messages || [];


        if (!messages.length) {

            messagesContainer.innerHTML = `
        <div class="empty">
          No messages found in this chat.
        </div>
      `;

            setStatus(
                "No messages found"
            );

            return;
        }


        renderMessages();


        setStatus(
            `${messages.length} messages`
        );


    } catch (error) {

        console.error(
            "loadMessages:",
            error
        );


        messagesContainer.innerHTML = `
      <div class="empty">
        ${escapeHtml(error.message)}
        <br><br>
        Try refreshing WhatsApp Web.
      </div>
    `;


        setStatus(
            "Connection error"
        );
    }
}


/* =========================
   RENDER CHAT
========================= */

function renderMessages(
    selectedIndexes = null
) {

    messagesContainer.innerHTML = "";


    if (!messages.length) {

        messagesContainer.innerHTML = `
      <div class="empty">
        No messages found.
      </div>
    `;

        return;
    }


    messages.forEach(
        (message, index) => {

            const wrapper =
                document.createElement("label");

            wrapper.className =
                "message";


            const checked =
                selectedIndexes === null ||
                selectedIndexes.includes(index);


            wrapper.innerHTML = `
        <input
          type="checkbox"
          data-index="${index}"
          ${checked ? "checked" : ""}
        >

        <div class="message-content">

          <div class="sender">
            ${escapeHtml(message.sender)}
          </div>

          <div class="message-text">
            ${escapeHtml(message.text)}
          </div>

        </div>
      `;


            messagesContainer.appendChild(
                wrapper
            );
        }
    );


    /*
     * Always start at the newest message.
     */

    requestAnimationFrame(() => {

        messagesContainer.scrollTop =
            messagesContainer.scrollHeight;

    });
}


/* =========================
   SELECTED MESSAGES
========================= */

function getSelectedMessages() {

    const checkboxes =
        messagesContainer.querySelectorAll(
            'input[type="checkbox"]'
        );


    const selected = [];


    checkboxes.forEach(
        checkbox => {

            if (!checkbox.checked) {
                return;
            }


            const index =
                Number(
                    checkbox.dataset.index
                );


            if (messages[index]) {
                selected.push(
                    messages[index]
                );
            }
        }
    );


    return selected;
}


/* =========================
   BUILD CONTEXT
========================= */

function buildConversation() {

    const selected =
        getSelectedMessages();


    return selected
        .map(
            message =>
                `${message.sender}: ${message.text}`
        )
        .join("\n");
}


/* =========================
   GENERATE REPLY
========================= */

async function generateReply() {

    const conversation =
        buildConversation();


    const instruction =
        instructionInput.value.trim();


    if (!conversation && !instruction) {
        setStatus("Tell me what to reply.");
        instructionInput.focus();
        return;
    }


    if (!instruction) {

        setStatus(
            "Tell me what to reply."
        );

        instructionInput.focus();

        return;
    }


    generateBtn.disabled =
        true;

    generateBtn.textContent =
        "…";

    setStatus(
        "Generating..."
    );


    try {

        const response =
            await fetch(
                `${API_URL}/generate`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        conversation: conversation || "",
                        instruction
                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Generation failed."
            );
        }


        generatedReply =
            data.reply;


        if (!generatedReply) {

            throw new Error(
                "AI returned an empty reply."
            );
        }


        setStatus(
            "Inserting..."
        );


        /*
         * Automatically insert into WhatsApp.
         */

        const insertResponse =
            await sendToWhatsApp({
                type: "INSERT_REPLY",
                text: generatedReply
            });


        if (!insertResponse?.success) {

            throw new Error(
                insertResponse?.error ||
                "Could not insert reply."
            );
        }


        setStatus(
            "Reply inserted ✓"
        );


        /*
         * Clear instruction after successful
         * insertion.
         */

        instructionInput.value = "";

        autoResize();


    } catch (error) {

        console.error(
            "generateReply:",
            error
        );


        setStatus(
            error.message
        );


    } finally {

        generateBtn.disabled =
            false;

        generateBtn.textContent =
            "↑";
    }
}


/* =========================
   LAST 5
========================= */

function selectLast5() {

    if (!messages.length) {
        return;
    }


    const start =
        Math.max(
            0,
            messages.length - 5
        );


    const indexes = [];


    for (
        let i = start;
        i < messages.length;
        i++
    ) {

        indexes.push(i);
    }


    renderMessages(indexes);
}


/* =========================
   SELECT ALL
========================= */

function selectAll() {

    messagesContainer
        .querySelectorAll(
            'input[type="checkbox"]'
        )
        .forEach(
            checkbox => {
                checkbox.checked = true;
            }
        );
}


/* =========================
   CLEAR
========================= */

function clearAll() {

    messagesContainer
        .querySelectorAll(
            'input[type="checkbox"]'
        )
        .forEach(
            checkbox => {
                checkbox.checked = false;
            }
        );
}


/* =========================
   TEXTAREA AUTO RESIZE
========================= */

function autoResize() {

    instructionInput.style.height =
        "auto";

    instructionInput.style.height =
        Math.min(
            instructionInput.scrollHeight,
            110
        ) + "px";
}


/* =========================
   ESCAPE HTML
========================= */

function escapeHtml(text) {

    const div =
        document.createElement("div");

    div.textContent =
        text;

    return div.innerHTML;
}


/* =========================
   EVENTS
========================= */

generateBtn.addEventListener(
    "click",
    generateReply
);


refreshBtn.addEventListener(
    "click",
    loadMessages
);


last5Btn.addEventListener(
    "click",
    selectLast5
);


selectAllBtn.addEventListener(
    "click",
    selectAll
);


clearAllBtn.addEventListener(
    "click",
    clearAll
);


instructionInput.addEventListener(
    "input",
    autoResize
);


/*
 * Enter = generate
 * Shift + Enter = new line
 */

instructionInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            generateReply();
        }
    }
);


/* =========================
   INITIAL LOAD
========================= */

loadMessages();