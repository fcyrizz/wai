/* =========================
   CORS
========================= */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
};


function jsonResponse(data, status = 200) {

  return new Response(
    JSON.stringify(data),
    {
      status,

      headers: {
        "Content-Type": "application/json",
        ...CORS_HEADERS
      }
    }
  );
}


/* =========================
   GENERATE REPLY
========================= */

async function generateReply(
  body,
  env
) {

  const {
    conversation = "",
    instruction = ""
  } = body;


  if (!instruction.trim()) {

    return jsonResponse(
      {
        error:
          "Instruction is required."
      },
      400
    );
  }


  const context =
    conversation.trim()
      ? `
SELECTED CONVERSATION:

${conversation}

---

`
      : `
NO CONVERSATION CONTEXT WAS SELECTED.

---

`;


  const prompt = `
${context}

USER INSTRUCTION:

${instruction}

---

Generate ONLY the ready-to-send WhatsApp reply.
`;


  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": env.GEMINI_API_KEY
      },

      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: env.SYSTEM_PROMPT
            }
          ]
        },

        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],

        generationConfig: {
          temperature: 0.4
        }
      })
    }
  );


  const data =
    await response.json();


  if (!response.ok) {

    console.error(
      "Gemini error:",
      JSON.stringify(
        data,
        null,
        2
      )
    );


    return jsonResponse(
      {
        error:
          data?.error?.message ||
          "Gemini API request failed."
      },
      response.status
    );
  }


  const reply =
    data
      ?.candidates?.[0]
      ?.content?.parts?.[0]
      ?.text
      ?.trim();


  if (!reply) {

    return jsonResponse(
      {
        error:
          "Gemini returned an empty response."
      },
      500
    );
  }


  return jsonResponse({
    reply
  });
}


/* =========================
   WORKER
========================= */

export default {

  async fetch(
    request,
    env
  ) {

    const url =
      new URL(request.url);


    /* CORS */

    if (
      request.method ===
      "OPTIONS"
    ) {

      return new Response(
        null,
        {
          status: 204,
          headers:
            CORS_HEADERS
        }
      );
    }


    /* Health */

    if (
      request.method === "GET" &&
      url.pathname === "/health"
    ) {

      return jsonResponse({
        status: "ok",
        service:
          "whatsapp-ai-backend"
      });
    }


    /* Generate */

    if (
      request.method === "POST" &&
      url.pathname === "/generate"
    ) {

      try {

        const body =
          await request.json();


        return await generateReply(
          body,
          env
        );

      } catch (error) {

        console.error(error);


        return jsonResponse(
          {
            error:
              "Invalid request."
          },
          400
        );
      }
    }


    return jsonResponse(
      {
        error:
          "Route not found."
      },
      404
    );
  }
};