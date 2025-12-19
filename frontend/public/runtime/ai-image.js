class AIImage extends HTMLElement {
  constructor() {
    super();
    this.style.display = "block";
    this.style.overflow = "hidden";
  }

  connectedCallback() {
    if (this.hasAttribute("data-rendered")) {
      return;
    }
    this.setAttribute("data-rendered", "true");

    const prompt = this.getAttribute("prompt") || "";
    const ratio = this.getAttribute("ratio") || "1:1";

    this.innerHTML = `
      <div class="ai-image-skeleton" style="
        aspect-ratio: ${this.#ratioToCss(ratio)};
        width: 100%;
        height: auto;
        background: #f3f4f6;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #9ca3af;
        font-size: 0.85rem;
        border: 1px solid #e5e7eb;
        animation: ai-image-pulse 2s infinite;
        overflow: hidden;
      ">
         <span aria-live="polite" style="padding: 10px; text-align: center;">Generating: ${this.#escape(prompt).slice(0, 20)}...</span>
      </div>`;

    fetch("/rest_api/image/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, ratio }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (!data || !data.url) {
          throw new Error("Missing image URL");
        }

        const img = document.createElement("img");
        img.src = data.url;
        img.alt = prompt;
        img.loading = "lazy";

        // Internal display defaults
        img.style.width = "100%";
        img.style.height = "auto";
        img.style.borderRadius = "10px";
        img.style.display = "block";

        // Default to non-draggable to prevent native image drag from interfering with swipes/UI
        img.setAttribute("draggable", "false");

        // Overwrite/Add attributes from the host <ai-image>
        for (const attr of this.attributes) {
          const name = attr.name.toLowerCase();
          // Skip internal/already-handled attributes
          if (["prompt", "ratio", "data-rendered", "src", "alt"].includes(name)) {
            continue;
          }

          if (name === "style") {
            // Merge styles: internal defaults first, then user styles to allow overrides
            img.style.cssText += ";" + attr.value;
          } else {
            img.setAttribute(attr.name, attr.value);
          }
        }

        this.innerHTML = "";
        this.appendChild(img);
      })
      .catch((err) => {
        console.error("AI Image Generation Error:", err);
        this.innerHTML = `<div style="background: #fef2f2; color: #b91c1c; padding: 12px; border-radius: 10px; border: 1px solid #fecdd3; font-size: 0.9rem;">Image generation failed. Try again.</div>`;
      });
  }

  #ratioToCss(ratio) {
    const map = {
      "1:1": "1 / 1",
      "16:9": "16 / 9",
      "9:16": "9 / 16",
      "4:3": "4 / 3",
      "3:4": "3 / 4",
    };
    return map[ratio] || map["1:1"];
  }

  #escape(value) {
    return (value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  }
}

if (!customElements.get("ai-image")) {
  customElements.define("ai-image", AIImage);
}

if (!document.getElementById("ai-image-style")) {
  const style = document.createElement("style");
  style.id = "ai-image-style";
  style.textContent = `@keyframes ai-image-pulse { 0% { opacity: 1; } 50% { opacity: 0.65; } 100% { opacity: 1; } }`;
  document.head.appendChild(style);
}
