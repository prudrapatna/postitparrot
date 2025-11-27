document.addEventListener('DOMContentLoaded', () => {
  const bookmarksGrid = document.getElementById('bookmarks-grid');
  const searchInput = document.getElementById('search-input');
  const sourceFilterTop = document.getElementById('source-filter-top');
  const topicFilterTop = document.getElementById('topic-filter-top');
  const bookmarkCount = document.getElementById('bookmark-count');
  const noResults = document.getElementById('no-results');

  let allBookmarks = [];
  let currentFilters = {
    topic: 'all',
    source: 'all',
    search: ''
  };

  // Load bookmarks
  function loadBookmarks() {
    chrome.storage.local.get({ bookmarks: [] }, (result) => {
      allBookmarks = result.bookmarks;
      applyFilters();
    });
  }

  function renderBookmarks(bookmarks) {
    bookmarksGrid.innerHTML = '';

    if (bookmarks.length === 0) {
      bookmarksGrid.style.display = 'none';
      noResults.style.display = 'flex';
      bookmarkCount.textContent = '0 Bookmarks';
      return;
    }

    bookmarksGrid.style.display = 'flex';
    noResults.style.display = 'none';
    bookmarkCount.textContent = `${bookmarks.length} Bookmark${bookmarks.length !== 1 ? 's' : ''}`;

    // Sort by date descending
    bookmarks.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Group bookmarks by topic
    const groupedByTopic = {};
    const topicOrder = ['AI/ML', 'Health', 'Prototyping', 'Product Strategy', 'News', 'Prompt', 'Other'];

    bookmarks.forEach(bookmark => {
      const topic = bookmark.topic || 'Other';
      if (!groupedByTopic[topic]) {
        groupedByTopic[topic] = [];
      }
      groupedByTopic[topic].push(bookmark);
    });

    // Render each category group
    topicOrder.forEach(topic => {
      if (!groupedByTopic[topic] || groupedByTopic[topic].length === 0) return;

      const categorySection = document.createElement('section');
      categorySection.className = 'category-section';

      const sectionHeader = document.createElement('div');
      sectionHeader.className = 'section-header';

      const topicClass = getTopicClass(topic);
      sectionHeader.innerHTML = `
        <h2>${topic}</h2>
      `;
      categorySection.appendChild(sectionHeader);

      const cardGrid = document.createElement('div');
      cardGrid.className = 'card-grid';

      groupedByTopic[topic].forEach(bookmark => {
        const card = createBookmarkCard(bookmark, topicClass);
        cardGrid.appendChild(card);
      });

      categorySection.appendChild(cardGrid);
      bookmarksGrid.appendChild(categorySection);
    });

    // Add event listeners
    attachEventListeners();
  }

  function getTopicClass(topic) {
    const map = {
      'AI/ML': 'ai',
      'Health': 'health',
      'Prototyping': 'proto',
      'Product Strategy': 'product',
      'News': 'news',
      'Prompt': 'prompt',
      'Other': 'other'
    };
    return map[topic] || 'other';
  }

  function createBookmarkCard(bookmark, topicClass) {
    const card = document.createElement('article');
    card.className = 'card';

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

    const isSocial = bookmark.source === 'Twitter' || bookmark.source === 'LinkedIn';
    // For LinkedIn, if we have an image, it might be a content image now.
    // We'll trust our new scraping logic to put content images in avatarUrl when available.
    // If it's just an author image, it will still show here, which is better than empty.
    let mainImage = bookmark.avatarUrl;
    let authorImage = isSocial ? (bookmark.avatarUrl || defaultIcon) : defaultIcon;

    // If it's social and we have a main image, we use it. 
    // If we wanted to be perfect, we'd need separate fields for author and content images.
    // For now, if it's social, we show the image in both places if it's the only image we have.
    // But to satisfy "personal image at bottom", we should keep main tile empty if it's just an author image.
    // Since we can't easily tell, we'll show it in main tile for now as requested "else it looks empty".
    // Special handling for YouTube to get high-res thumbnail
    if (bookmark.source === 'YouTube') {
      const ytMatch = bookmark.url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([^& \n<]+)/);
      if (ytMatch && ytMatch[1]) {
        mainImage = `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg`;
      }
    }

    const fallbackImage = ['ai', 'proto', 'product', 'health', 'news', 'prompt', 'other'].includes(topicClass)
      ? chrome.runtime.getURL(`images/${topicClass}.png`)
      : defaultIcon;

    card.innerHTML = `
      ${mainImage ? `
      <div class="card-image">
        <img src="${mainImage}" alt="Thumbnail" onerror="this.onerror=null; this.src='${defaultIcon}'; this.style.objectFit='contain'; this.style.padding='20px';">
        <div class="tag-overlay tag-${topicClass}">
          <select class="topic-select-card" data-id="${bookmark.id}">
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
      ` : `
      <div class="card-image no-image">
        <img src="${fallbackImage}" alt="${bookmark.topic || 'Bookmark'}" onerror="this.onerror=null; this.src='${defaultIcon}'; this.style.opacity='0.3'; this.style.filter='grayscale(100%)'; this.style.padding='40px';" style="object-fit: cover; width: 100%; height: 100%;">
        <div class="tag-overlay tag-${topicClass}">
          <select class="topic-select-card" data-id="${bookmark.id}">
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
      `}
      <div class="card-body">
        <a href="${bookmark.url}" target="_blank" class="card-title-link">
          <h3>${bookmark.title || 'No Title'}</h3>
        </a>
        <p>${bookmark.content || 'No description available'}</p>
      </div>
      <div class="card-footer">
        <div class="meta-info">
          <img src="${authorImage}" class="author-icon" alt="Icon" onerror="this.onerror=null; this.src='${defaultIcon}';">
          <span class="meta-text">${authorName} • ${date}</span>
        </div>
      </div>
      <button class="delete-btn" data-id="${bookmark.id}" title="Delete">×</button>
    `;

    // Add custom hover color based on topic
    const titleLink = card.querySelector('.card-title-link h3');
    titleLink.style.color = 'var(--text-primary)';
    titleLink.addEventListener('mouseover', () => {
      titleLink.style.color = `var(--color-${topicClass})`;
    });
    titleLink.addEventListener('mouseout', () => {
      titleLink.style.color = 'var(--text-primary)';
    });

    return card;
  }

  function attachEventListeners() {
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const id = e.target.getAttribute('data-id');
        deleteBookmark(id);
      });
    });

    document.querySelectorAll('.topic-select-card').forEach(select => {
      select.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        const newTopic = e.target.value;
        updateBookmarkTopic(id, newTopic);
      });
    });
  }

  function deleteBookmark(id) {
    if (confirm('Are you sure you want to delete this bookmark?')) {
      chrome.storage.local.get({ bookmarks: [] }, (result) => {
        const bookmarks = result.bookmarks.filter(b => b.id !== id);
        chrome.storage.local.set({ bookmarks: bookmarks }, () => {
          allBookmarks = bookmarks;
          applyFilters();
        });
      });
    }
  }

  function updateBookmarkTopic(id, newTopic) {
    chrome.storage.local.get({ bookmarks: [] }, (result) => {
      const bookmarks = result.bookmarks.map(b => {
        if (b.id === id) return { ...b, topic: newTopic };
        return b;
      });
      chrome.storage.local.set({ bookmarks: bookmarks }, () => {
        allBookmarks = bookmarks;
        applyFilters();
      });
    });
  }

  function applyFilters() {
    const filtered = allBookmarks.filter(b => {
      const matchesSearch = (b.title && b.title.toLowerCase().includes(currentFilters.search)) ||
        (b.content && b.content.toLowerCase().includes(currentFilters.search));
      const matchesTopic = currentFilters.topic === 'all' || b.topic === currentFilters.topic;
      const matchesSource = currentFilters.source === 'all' || b.source === currentFilters.source;
      return matchesSearch && matchesTopic && matchesSource;
    });
    renderBookmarks(filtered);
  }

  // Event Listeners
  searchInput.addEventListener('input', (e) => {
    currentFilters.search = e.target.value.toLowerCase();
    applyFilters();
  });

  // Top filter dropdowns
  sourceFilterTop.addEventListener('change', (e) => {
    currentFilters.source = e.target.value;
    applyFilters();
  });

  topicFilterTop.addEventListener('change', (e) => {
    currentFilters.topic = e.target.value;
    applyFilters();
  });

  // Listen for storage changes from popup
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.bookmarks) {
      allBookmarks = changes.bookmarks.newValue;
      applyFilters();
    }
  });

  loadBookmarks();
});
