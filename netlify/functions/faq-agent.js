export async function handler(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // 1. Handle Preflight
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

  try {
    const { question } = JSON.parse(event.body || "{}");
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("Missing GEMINI_API_KEY");
      return { statusCode: 500, headers, body: JSON.stringify({ answer: "Config Error: Key Missing." }) };
    }

    // 2. The Request to Gemini 1.5 Flash
    const requestBody = {
      // This tells the AI who it is and how to behave
      system_instruction: {
        parts: [{
          text: "You are a professional assistant for a Web Design Agency that specializes in Landscapers. Be helpful, professional, and try to encourage landscapers to improve their online presence. If asked about pricing, say it depends on the project but starts around £999."
        }]
      },
      contents: [{
        role: "user",
        parts: [{ text: question }]
      }]
    };

    console.log("Request to Gemini:", JSON.stringify(requestBody, null, 2));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json();
    console.log("Response from Gemini:", JSON.stringify(data, null, 2));

    // 3. Robust "Answer Extraction" 
    // This looks deep into the data to find the text, even if the format changes slightly.
    let aiAnswer = "";

    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      aiAnswer = data.candidates[0].content.parts[0].text;
    } else if (data.error) {
      console.error("Gemini API Error:", data.error.message);
      aiAnswer = "I'm having a small technical hiccup. Please try asking again in a moment!";
    } else {
      console.log("Unexpected Data Structure:", JSON.stringify(data));
      aiAnswer = "I heard you, but I'm not sure how to answer that. Could you rephrase?";
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ answer: aiAnswer }),
    };

  } catch (error) {
    console.error("Function Crash:", error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ answer: "Sorry, the server is acting up. Let me check the logs!" }),
    };
  }
}