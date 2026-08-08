function getMessages() {
  const elements = Array.from(
    document.querySelectorAll(
      'div.copyable-text[data-pre-plain-text]'
    )
  );

  return elements
    .map((element, index) => {

      const metadata =
        element.getAttribute(
          "data-pre-plain-text"
        ) || "";

      const textElement =
        element.querySelector(
          ".selectable-text"
        );

      const text =
        textElement?.innerText?.trim() ||
        element.innerText?.trim() ||
        "";

      if (!text) {
        return null;
      }

      let sender = "CREATOR";

      const match =
        metadata.match(
          /\]\s*(.*?):\s*$/
        );

      if (match) {
        sender =
          match[1].trim();
      }

      const container =
        element.closest(
          '[data-testid="msg-container"]'
        );

      const isMe =
        container?.classList.contains(
          "message-out"
        ) ||
        element.closest(
          ".message-out"
        ) !== null;

      if (isMe) {
        sender = "ME";
      }

      return {
        id: index,
        sender,
        text
      };
    })
    .filter(Boolean);
}


function findMessageInput() {

  return (
    document.querySelector(
      'footer div[contenteditable="true"]'
    ) ||
    document.querySelector(
      'div[contenteditable="true"][role="textbox"]'
    )
  );
}


function insertReply(text) {
  const input = findMessageInput();

  if (!input) {
    return {
      success: false,
      error: "WhatsApp message input not found."
    };
  }

  input.focus();

  /*
   * Use WhatsApp's contenteditable directly.
   * execCommand inserts the text only once and
   * behaves much more reliably with WhatsApp Web.
   */

  const inserted =
    document.execCommand(
      "insertText",
      false,
      text
    );

  if (!inserted) {
    return {
      success: false,
      error: "Could not insert text into WhatsApp."
    };
  }

  return {
    success: true
  };
}

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {

    if (
      message.type ===
      "GET_MESSAGES"
    ) {

      sendResponse({
        success: true,
        messages:
          getMessages()
      });

      return true;
    }


    if (
      message.type ===
      "INSERT_REPLY"
    ) {

      sendResponse(
        insertReply(
          message.text
        )
      );

      return true;
    }
  }
);