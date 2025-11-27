document.addEventListener('DOMContentLoaded', () => {
  const bookmarkBtn = document.getElementById('bookmark-current');
  const searchInput = document.getElementById('search-input');
  const sourceFilter = document.getElementById('source-filter');
  const topicFilter = document.getElementById('topic-filter');
  const bookmarkList = document.getElementById('bookmark-list');

  let allBookmarks = [];

  // Load bookmarks
  function loadBookmarks() {
    chrome.storage.local.get({ bookmarks: [] }, (result) => {
      allBookmarks = result.bookmarks;
      renderBookmarks(allBookmarks);
    });
  }

  function renderBookmarks(bookmarks) {
    bookmarkList.innerHTML = '';
    bookmarks.sort((a, b) => new Date(b.date) - new Date(a.date));

    bookmarks.forEach(bookmark => {
      const item = document.createElement('div');
      item.className = `bookmark-item ${bookmark.source.toLowerCase()}`;

      const date = new Date(bookmark.date).toLocaleDateString();
      
      // Get the domain from the bookmark URL
      let domain = '';
      try {
        const url = new URL(bookmark.url);
        domain = url.hostname;
      } catch (e) {
        domain = 'example.com';
      }
      
      const defaultIcon = bookmark.source === 'YouTube' ? 'https://www.google.com/s2/favicons?domain=youtube.com&sz=64' :
        bookmark.source === 'Twitter' ? 'https://www.google.com/s2/favicons?domain=twitter.com&sz=64' :
          bookmark.source === 'LinkedIn' ? 'https://www.google.com/s2/favicons?domain=linkedin.com&sz=64' :
            `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

      const authorName = (bookmark.author && bookmark.author !== 'Unknown') ? bookmark.author : bookmark.source;

      item.innerHTML = `
        <div class="bookmark-image-container">
          ${bookmark.avatarUrl ? `<img src="${bookmark.avatarUrl}" class="bookmark-image" alt="Thumbnail" onerror="this.onerror=null; this.src='${defaultIcon}'; this.style.width='40px'; this.style.height='40px';">` : `<img src="${defaultIcon}" class="bookmark-image" style="width: 40px; height: 40px; object-fit: contain;">`}
        </div>
        <div class="bookmark-details">
          <div class="bookmark-header">
            <a href="${bookmark.url}" target="_blank" class="bookmark-title" title="${bookmark.title}">${bookmark.title || 'No Title'}</a>
            <button class="delete-btn" data-id="${bookmark.id}" title="Delete">×</button>
          </div>
          <div class="bookmark-content-preview">${bookmark.content || 'No content extracted'}</div>
          <div class="bookmark-meta">
            <div class="meta-left">
              <img src="${defaultIcon}" class="meta-icon" alt="Icon" onerror="this.style.display='none'">
              <span class="meta-text">${authorName} • ${date}</span>
            </div>
            <select class="topic-select" data-id="${bookmark.id}">
              <option value="Prototyping" ${bookmark.topic === 'Prototyping' ? 'selected' : ''}>Prototyping</option>
              <option value="AI/ML" ${bookmark.topic === 'AI/ML' ? 'selected' : ''}>AI/ML</option>
              <option value="Product Strategy" ${bookmark.topic === 'Product Strategy' ? 'selected' : ''}>Product Strategy</option>
              <option value="Health" ${bookmark.topic === 'Health' ? 'selected' : ''}>Health</option>
              <option value="News" ${bookmark.topic === 'News' ? 'selected' : ''}>News</option>
              <option value="Prompt" ${bookmark.topic === 'Prompt' ? 'selected' : ''}>Prompt</option>
              <option value="Other" ${bookmark.topic === 'Other' ? 'selected' : ''}>Other</option>
            </select>
          </div>
        </div>
      `;
      bookmarkList.appendChild(item);
    });

    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const id = e.target.getAttribute('data-id');
        deleteBookmark(id);
      });
    });

    // Add event listeners to topic selectors
    document.querySelectorAll('.topic-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        const newTopic = e.target.value;
        updateBookmarkTopic(id, newTopic);
      });
    });

    if (bookmarks.length === 0) {
      bookmarkList.innerHTML = '<div class="no-bookmarks">No bookmarks found.</div>';
    }
  }

  function updateBookmarkTopic(id, newTopic) {
    chrome.storage.local.get({ bookmarks: [] }, (result) => {
      const bookmarks = result.bookmarks.map(b => {
        if (b.id === id) {
          return { ...b, topic: newTopic };
        }
        return b;
      });
      chrome.storage.local.set({ bookmarks: bookmarks }, () => {
        allBookmarks = bookmarks;
        // No need to re-render everything, just update the internal state
        // But if we want to respect current filters, we should re-filter
        filterBookmarks();
      });
    });
  }

  function deleteBookmark(id) {
    chrome.storage.local.get({ bookmarks: [] }, (result) => {
      const bookmarks = result.bookmarks.filter(b => b.id !== id);
      chrome.storage.local.set({ bookmarks: bookmarks }, () => {
        allBookmarks = bookmarks;
        filterBookmarks(); // Re-render with current filters
      });
    });
  }

  function filterBookmarks() {
    const searchText = searchInput.value.toLowerCase();
    const source = sourceFilter.value;
    const topic = topicFilter.value;

    const filtered = allBookmarks.filter(b => {
      const matchesSearch = (b.title && b.title.toLowerCase().includes(searchText)) ||
        (b.content && b.content.toLowerCase().includes(searchText));
      const matchesSource = source === 'all' || b.source === source;
      const matchesTopic = topic === 'all' || b.topic === topic;
      return matchesSearch && matchesSource && matchesTopic;
    });
    renderBookmarks(filtered);
  }

  // Event Listeners
  bookmarkBtn.addEventListener('click', () => {
    console.log("Bookmark button clicked");
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      console.log("Active tab:", activeTab);
      if (activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('https://chrome.google.com/webstore')) {
        alert("Extensions cannot run on this page.");
        return;
      }
      function injectAndSend() {
        console.log("Injecting content script from popup...");
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['content.js']
        }).then(() => {
          console.log("Content script injected successfully from popup. Sending message...");
          setTimeout(() => {
            chrome.tabs.sendMessage(activeTab.id, { action: "extract" }, (response) => {
              if (chrome.runtime.lastError || !response) {
                console.error("Error or no response after injection, using fallback");
                useFallback(activeTab);
              } else {
                console.log("Sending bookmark to background script (after injection):", response);
                chrome.runtime.sendMessage({ action: "bookmark", data: response }, (res) => {
                  if (res && res.status === "success") loadBookmarks();
                });
              }
            });
          }, 500);
        }).catch(err => {
          console.error("Failed to inject content script from popup, using fallback:", err);
          useFallback(activeTab);
        });
      }

      function useFallback(tab) {
        const fallbackData = {
          url: tab.url,
          title: tab.title,
          content: "Content could not be extracted (possibly due to security policy).",
          author: "Unknown",
          source: tab.url.includes("youtube.com") ? "YouTube" : (tab.url.includes("twitter.com") || tab.url.includes("x.com") ? "Twitter" : "Article"),
          avatarUrl: tab.favIconUrl || ""
        };
        console.log("Using fallback data:", fallbackData);
        chrome.runtime.sendMessage({ action: "bookmark", data: fallbackData }, (res) => {
          if (res && res.status === "success") loadBookmarks();
        });
      }

      // Always try to inject first on YouTube
      if (activeTab.url.includes("youtube.com") || activeTab.url.includes("youtu.be")) {
        injectAndSend();
      } else {
        chrome.tabs.sendMessage(activeTab.id, { action: "extract" }, (response) => {
          console.log("Response from content script:", response);
          if (chrome.runtime.lastError || !response) {
            console.log("Content script not ready, trying injection...", chrome.runtime.lastError);
            injectAndSend();
          } else {
            console.log("Sending bookmark to background script:", response);
            chrome.runtime.sendMessage({ action: "bookmark", data: response }, (res) => {
              console.log("Response from background script:", res);
              loadBookmarks();
            });
          }
        });
      }
    });
  });

  // Listen for storage changes to update UI if open
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.bookmarks) {
      console.log("Storage changed, reloading bookmarks");
      loadBookmarks();
    }
  });

  searchInput.addEventListener('input', filterBookmarks);
  sourceFilter.addEventListener('change', filterBookmarks);
  topicFilter.addEventListener('change', filterBookmarks);

  loadBookmarks();
});
