async function sendPrompt() {
  const prompt = document.getElementById("prompt").value.trim();
  const output = document.getElementById("response");

  if (!prompt) {
    output.textContent = "Please enter a prompt.";
    return;
  }

  output.textContent = "Checking with Lakera and OpenAI...";

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: prompt }),
    });

    const data = await res.json();

    if (data.blocked) {
      output.textContent =
        "⚠ BLOCKED BY LAKERA\n\n" +
        data.assistant;
    } else {
      output.textContent =
        "✅ SAFE\n\n" +
        data.assistant;
    }
  } catch (error) {
    output.textContent = "Error: " + error.message;
  }
}