// Simple keyword-based topic classification
const topics = {
  "AI/ML": ["ai", "ml", "artificial intelligence", "machine learning", "neural", "model", "llm", "gpt", "openai", "claude", "gemini", "chatgpt", "deep learning", "transformers"],
  "Health": ["health", "medical", "fitness", "nutrition", "wellness", "disease", "treatment", "therapy", "doctor", "patient", "clinical", "glucose", "diabetes", "exercise", "diet", "medication"],
  "Prototyping": ["build", "demo", "how to", "tutorial", "prototype", "coding", "programming", "development", "framework", "library", "github", "code"],
  "Product Strategy": ["product", "strategy", "roadmap", "vision", "growth", "metrics", "business", "market", "startup", "founder"],
  "News": ["news", "announcement", "breaking", "update", "latest", "report", "trends"],
  "Prompt": ["prompt", "system prompt", "instruction", "chain of thought", "prompting"],
  "Other": []
};

function classifyTopic(text) {
  if (!text) return "Other";
  text = text.toLowerCase();
  for (const [topic, keywords] of Object.entries(topics)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return topic;
    }
  }
  return "Other";
}

// Handle YouTube's SPA navigation
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.url && (details.url.includes("youtube.com") || details.url.includes("youtu.be"))) {
    console.log("YouTube navigation detected, injecting content script...");
    chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      files: ['content.js']
    }).catch(err => console.log("Injection failed (expected on some pages):", err));
  }
});

// Create context menu on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "bookmarkPost",
      title: "Bookmark this Post/Tweet",
      contexts: ["all"] // Show on all elements to allow clicking anywhere on a post
    });
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log("Context menu clicked", info, tab);
  if (info.menuItemId === "bookmarkPost") {
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('https://chrome.google.com/webstore')) {
      console.log("Cannot run on privileged tab");
      return;
    }

    function injectAndSend() {
      console.log("Injecting content script...");
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }).then(() => {
        console.log("Content script injected successfully. Sending message...");
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { action: "extract_specific" }, (response) => {
            if (chrome.runtime.lastError) {
              console.error("Error sending message after injection:", chrome.runtime.lastError);
            }
            if (response) {
              console.log("Received response after injection:", response);
              saveBookmark(response);
            } else {
              console.log("No response received after injection");
            }
          });
        }, 500); // Increased timeout to 500ms for safety
      }).catch(err => {
        console.error("Failed to inject content script:", err);
      });
    }

    // Always try to inject first on YouTube to be safe, as SPA navigation can break things
    if (tab.url.includes("youtube.com") || tab.url.includes("youtu.be")) {
      injectAndSend();
    } else {
      chrome.tabs.sendMessage(tab.id, { action: "extract_specific" }, (response) => {
        if (chrome.runtime.lastError) {
          console.log("Content script not ready, injecting...", chrome.runtime.lastError);
          injectAndSend();
          return;
        }
        if (response) {
          saveBookmark(response);
        }
      });
    }
  }
});

async function fetchImageAsBase64(url) {
  if (!url || url.startsWith('data:')) return url;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("Failed to fetch image:", e);
    return url; // Fallback to original URL
  }
}

async function saveBookmark(data, callback) {
  console.log("Saving bookmark called with data:", data);
  if (!data) {
    console.error("No data provided to saveBookmark");
    return;
  }

  // Try to convert image to base64 for reliable storage
  let avatarUrl = data.avatarUrl || "";
  if (avatarUrl && !avatarUrl.startsWith('data:')) {
    avatarUrl = await fetchImageAsBase64(avatarUrl);
  }

  const bookmark = {
    id: Date.now().toString(),
    url: data.url || "",
    title: data.title || "No Title",
    content: data.content || "",
    author: data.author || "Unknown",
    avatarUrl: avatarUrl,
    date: new Date().toISOString(),
    source: data.source || "Unknown",
    topic: classifyTopic(data.content || data.title)
  };

  chrome.storage.local.get({ bookmarks: [] }, (result) => {
    const bookmarks = result.bookmarks;
    bookmarks.push(bookmark);
    chrome.storage.local.set({ bookmarks: bookmarks }, () => {
      console.log("Bookmark saved successfully");
      if (callback) callback(bookmark);
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "bookmark") {
    saveBookmark(request.data, (bookmark) => {
      sendResponse({ status: "success", bookmark: bookmark });
    });
    return true; // Keep connection open for async response
  }
});
