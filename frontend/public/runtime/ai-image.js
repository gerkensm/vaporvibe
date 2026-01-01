class AIImage extends HTMLElement {
  static get observedAttributes() {
    return ["prompt", "ratio", "input-base64", "input-mime-type", "input-field"];
  }

  constructor() {
    super();
    this.style.display = "block";
    this.style.overflow = "hidden";
    this._lastRenderedPrompt = null;
    this._lastRenderedRatio = null;
    this._lastRenderedInput = null;
    this._isLoading = false;
  }

  connectedCallback() {
    const prompt = this.getAttribute("prompt") || "";
    const ratio = this.getAttribute("ratio") || "1:1";
    const inputBase64 = this.getAttribute("input-base64") || "";
    const inputMimeType = this.getAttribute("input-mime-type") || "image/png";
    const inputField = this.getAttribute("input-field") || "";

    // Skip if prompt is empty (waiting for reactive framework to populate it)
    if (!prompt.trim()) {
      return;
    }

    this.#render(prompt, ratio, {
      base64: inputBase64.trim(),
      mimeType: inputMimeType.trim() || "image/png",
      fieldName: inputField.trim() || undefined,
    });
  }

  attributeChangedCallback(name, oldValue, newValue) {
    // Skip if not connected to DOM yet or values haven't actually changed
    if (!this.isConnected || oldValue === newValue) {
      return;
    }

    const prompt = this.getAttribute("prompt") || "";
    const ratio = this.getAttribute("ratio") || "1:1";
    const inputBase64 = this.getAttribute("input-base64") || "";
    const inputMimeType = this.getAttribute("input-mime-type") || "image/png";
    const inputField = this.getAttribute("input-field") || "";

    // Skip if prompt is empty (waiting for reactive framework to populate it)
    if (!prompt.trim()) {
      return;
    }

    // Only re-render if prompt or ratio actually changed from what we last rendered
    if (
      prompt === this._lastRenderedPrompt &&
      ratio === this._lastRenderedRatio &&
      inputBase64 === this._lastRenderedInput
    ) {
      return;
    }

    this.#render(prompt, ratio, {
      base64: inputBase64.trim(),
      mimeType: inputMimeType.trim() || "image/png",
      fieldName: inputField.trim() || undefined,
    });
  }

  #render(prompt, ratio, input) {
    // Avoid concurrent requests for the same element
    if (this._isLoading) {
      return;
    }

    this._lastRenderedPrompt = prompt;
    this._lastRenderedRatio = ratio;
    this._lastRenderedInput = input?.base64 || "";
    this._isLoading = true;

    // Extract colors from page context
    const colors = this.#extractPageColors();

    // Create blob loading animation
    this.innerHTML = `
      <div class="ai-image-skeleton" style="
        aspect-ratio: ${this.#ratioToCss(ratio)};
        width: 100%;
        height: auto;
        background: ${colors.bg};
        border-radius: 10px;
        position: relative;
        overflow: hidden;
        border: 1px solid ${colors.border};
      ">
        ${this.#generateBlobs(colors.accents)}
        <span aria-live="polite" style="
          position: relative;
          z-index: 10;
          padding: 10px;
          text-align: center;
          color: ${colors.text};
          font-size: 0.85rem;
          text-shadow: 0 0 8px ${colors.bg}, 0 0 12px ${colors.bg};
          display: block;
          margin: auto;
        ">Generating...</span>
      </div>`;

    const payload = { prompt, ratio };
    if (input?.base64) {
      payload.inputImages = [
        {
          base64: input.base64,
          mimeType: input.mimeType || "image/png",
          fieldName: input.fieldName,
        },
      ];
    }

    fetch("/rest_api/image/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
          // Skip internal/specially-handled host attributes
          // We skip 'src' and 'id' to avoid conflicts or overwriting the generated URL
          if (["prompt", "ratio", "data-rendered", "src", "id"].includes(name)) {
            continue;
          }
          if (["input-base64", "input-mime-type", "input-field"].includes(name)) {
            continue;
          }

          if (name === "style") {
            // Merge styles: internal defaults first (set above), then user styles to allow overrides
            // Using cssText appending as a simple merge; later properties override earlier ones
            img.style.cssText += ";" + attr.value;
          } else {
            // Apply all other attributes (class, draggable, ondragstart, alt, aria-*, etc.)
            img.setAttribute(attr.name, attr.value);

            // Explicitly sync certain properties that may need it (like draggable)
            if (name === "draggable") {
              img.draggable = attr.value === "true";
            }
          }
        }

        this.innerHTML = "";
        this.appendChild(img);
        this._isLoading = false;
      })
      .catch((err) => {
        console.error("AI Image Generation Error:", err);

        // Extract colors for error state too
        const colors = this.#extractPageColors();
        const errorOverlay = this.#isLightColor(colors.bg)
          ? 'rgba(239, 68, 68, 0.08)'  // Light red tint on light backgrounds
          : 'rgba(239, 68, 68, 0.12)'; // Slightly more visible on dark backgrounds

        this.innerHTML = `
          <div style="
            aspect-ratio: ${this.#ratioToCss(this._lastRenderedRatio || '1:1')};
            width: 100%;
            height: auto;
            background: ${colors.bg};
            border-radius: 10px;
            position: relative;
            overflow: hidden;
            border: 1px solid rgba(239, 68, 68, 0.3);
          ">
            <div style="
              position: absolute;
              inset: 0;
              background: ${errorOverlay};
            "></div>
            <div class="ai-image-error-blob" style="
              position: absolute;
              width: 120px;
              height: 120px;
              left: 50%;
              top: 50%;
              background: #ef4444;
              border-radius: 50%;
              filter: blur(50px);
              opacity: 0.15;
              animation: ai-error-pulse 2s ease-in-out infinite;
              transform: translate(-50%, -50%);
            "></div>
            <div style="
              position: relative;
              z-index: 10;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100%;
              padding: 16px;
              text-align: center;
            ">
              <svg style="width: 32px; height: 32px; margin-bottom: 8px; opacity: 0.6;" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <div style="
                color: #dc2626;
                font-size: 0.9rem;
                font-weight: 500;
              ">Generation failed</div>
              <div style="
                color: ${colors.text};
                opacity: 0.6;
                font-size: 0.8rem;
                margin-top: 4px;
              ">Try again or check connection</div>
            </div>
          </div>`;
        this._isLoading = false;
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

  #extractPageColors() {
    // Sample colors from page context
    const computed = window.getComputedStyle(document.body);
    const bgColor = computed.backgroundColor || "#000000";

    // Try to extract accent colors from CSS variables or page elements
    const accents = [];

    // Check common CSS custom properties
    const root = getComputedStyle(document.documentElement);
    for (const prop of ['--primary', '--accent', '--secondary', '--color-primary', '--color-accent']) {
      const val = root.getPropertyValue(prop).trim();
      if (val && val !== '') accents.push(val);
    }

    // Sample from visible elements if we don't have enough colors
    if (accents.length < 2) {
      const elements = document.querySelectorAll('button, a, h1, h2, .accent, .primary, [class*="btn"]');
      for (let i = 0; i < Math.min(elements.length, 10); i++) {
        const el = elements[i];
        const color = getComputedStyle(el).backgroundColor;
        if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
          accents.push(color);
        }
      }
    }

    // Fallback colors
    const defaultAccents = ['#3b82f6', '#f59e0b', '#8b5cf6'];
    const finalAccents = accents.length > 0
      ? accents.slice(0, 3)
      : defaultAccents;

    // Determine text color based on background brightness
    const textColor = this.#isLightColor(bgColor) ? '#1f2937' : '#f3f4f6';
    const borderColor = this.#isLightColor(bgColor) ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';

    return {
      bg: bgColor,
      text: textColor,
      border: borderColor,
      accents: finalAccents
    };
  }

  #isLightColor(color) {
    // Simple brightness check
    const rgb = color.match(/\d+/g);
    if (!rgb || rgb.length < 3) return false;
    const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
    return brightness > 128;
  }

  #generateBlobs(colors) {
    const blobCount = 4 + Math.floor(Math.random() * 3); // 4-6 blobs
    let html = '';

    for (let i = 0; i < blobCount; i++) {
      const color = colors[i % colors.length];
      const size = 80 + Math.random() * 120; // 80-200px
      const left = Math.random() * 100;
      const top = Math.random() * 100;
      const delay = Math.random() * 3;
      const duration = 3 + Math.random() * 4; // 3-7s

      html += `<div class="ai-image-blob" style="
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${left}%;
        top: ${top}%;
        background: ${color};
        border-radius: 50%;
        filter: blur(40px);
        opacity: 0;
        animation: ai-blob-wave ${duration}s ease-in-out ${delay}s infinite;
        transform: translate(-50%, -50%);
      "></div>`;
    }

    return html;
  }
}

if (!customElements.get("ai-image")) {
  customElements.define("ai-image", AIImage);
}

if (!document.getElementById("ai-image-style")) {
  const style = document.createElement("style");
  style.id = "ai-image-style";
  style.textContent = `
    @keyframes ai-blob-wave {
      0%, 100% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.8);
      }
      15% {
        opacity: 0.3;
        transform: translate(-50%, -50%) scale(1);
      }
      50% {
        opacity: 0.5;
        transform: translate(-50%, -50%) scale(1.2);
      }
      85% {
        opacity: 0.3;
        transform: translate(-50%, -50%) scale(1);
      }
    }
    
    @keyframes ai-error-pulse {
      0%, 100% {
        opacity: 0.15;
        transform: translate(-50%, -50%) scale(1);
      }
      50% {
        opacity: 0.25;
        transform: translate(-50%, -50%) scale(1.1);
      }
    }
  `;
  document.head.appendChild(style);
}
