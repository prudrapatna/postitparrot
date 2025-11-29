(function () {
  if (window.smartBookmarkOrganizerLoaded) return;
  window.smartBookmarkOrganizerLoaded = true;

  if (typeof window.lastRightClickedElement === 'undefined') {
    window.lastRightClickedElement = null;
    document.addEventListener('contextmenu', (event) => {
      window.lastRightClickedElement = event.target;
    }, true);
  }

  window.extractContent = function (isSpecific = false) {
    let url = window.location.href;
    let source = "Article";
    let content = "";
    let author = "";
    let title = document.title;
    let avatarUrl = "";

    if (url.includes("linkedin.com")) {
      source = "LinkedIn";
      let postElement = null;
      if (isSpecific && window.lastRightClickedElement) {
        postElement = window.lastRightClickedElement.closest('.feed-shared-update-v2, [data-urn]');
      } else {
        postElement = document.querySelector('.feed-shared-update-v2');
      }

      if (postElement) {
        // Try to find the post content
        const postContent = postElement.querySelector('.feed-shared-update-v2__description-wrapper, .update-components-text, .feed-shared-text');
        if (postContent) {
          content = postContent.innerText.trim().substring(0, 200) + '...';
        } else {
          content = postElement.innerText; // Fallback to full text if specific elements not found
        }

        // Try to find author
        const actorElement = postElement.querySelector('.update-components-actor__name, .feed-shared-actor__name');
        if (actorElement) {
          author = actorElement.innerText.trim();
        } else {
          author = "";
        }

        // Try to find post image (content image)
        const postImage = postElement.querySelector('.feed-shared-image__image, .update-components-article__image img, .update-components-image__image');
        if (postImage && postImage.src) {
          avatarUrl = postImage.src; // Using avatarUrl for now as it's our main image field
        } else {
          // Fallback to author image if no post image
          const authorImage = postElement.querySelector('.update-components-actor__image img, .feed-shared-actor__image img');
          if (authorImage && authorImage.src) {
            avatarUrl = authorImage.src;
          }
        }

        // Try to find specific post URL
        const linkElement = postElement.querySelector('a[href*="/feed/update/urn:li:activity:"]');
        if (linkElement) {
          url = linkElement.href;
        } else {
          const urn = postElement.getAttribute('data-urn');
          if (urn) {
            url = `https://www.linkedin.com/feed/update/${urn}`;
          }
        }
      } else {
        // Fallback for LinkedIn when no specific post is found
        if (url.includes("/notifications")) {
          title = "LinkedIn Notifications";
          content = "Your LinkedIn notifications and updates.";
        } else if (url.includes("/messaging")) {
          title = "LinkedIn Messages";
          content = "Your LinkedIn direct messages.";
        } else if (url.includes("/jobs")) {
          title = "LinkedIn Jobs";
          content = "LinkedIn job opportunities and applications.";
        } else if (url.includes("/mynetwork")) {
          title = "LinkedIn Network";
          content = "Your LinkedIn professional network and connections.";
        } else {
          // General fallback, but avoid "0 notifications"
          title = document.title;
          content = "LinkedIn page - " + title;
          const mainContent = document.querySelector('main');
          if (mainContent) {
            const text = mainContent.innerText.substring(0, 200).trim();
            if (text && !text.includes("0 notifications")) {
              content = text + "...";
            }
          }
        }
      }
    } else if (url.includes("twitter.com") || url.includes("x.com")) {
      source = "Twitter";
      let tweetElement = null;
      if (isSpecific && window.lastRightClickedElement) {
        tweetElement = window.lastRightClickedElement.closest('article[role="article"]');
      } else {
        tweetElement = document.querySelector('article[role="article"]');
      }

      if (tweetElement) {
        // Try to get tweet text
        const tweetTextOpt = tweetElement.querySelector('[data-testid="tweetText"]');
        if (tweetTextOpt) {
          content = tweetTextOpt.innerText.trim().substring(0, 200) + '...';
        } else {
          content = tweetElement.innerText.substring(0, 200) + '...';
        }

        author = tweetElement.querySelector('[data-testid="User-Name"]')?.innerText || "";

        // Try to find tweet image (content image)
        const tweetImage = tweetElement.querySelector('[data-testid="tweetPhoto"] img');
        if (tweetImage && tweetImage.src) {
          avatarUrl = tweetImage.src;
        } else {
          // Fallback to profile image
          const imgElement = tweetElement.querySelector('img[src*="profile_images"]');
          if (imgElement) {
            avatarUrl = imgElement.src;
          }
        }

        // Try to find specific tweet URL
        const linkElement = tweetElement.querySelector('a[href*="/status/"]');
        if (linkElement) {
          const href = linkElement.getAttribute('href');
          if (href) {
            url = (href.startsWith('http')) ? href : `https://twitter.com${href}`;
          }
        }
      } else {
        content = document.body.innerText.substring(0, 500);
      }
    } else if (url.includes("youtube.com") || url.includes("youtu.be")) {
      console.log("YouTube detected");
      source = "YouTube";

      let videoElement = null;
      if (isSpecific && window.lastRightClickedElement) {
        // Try to find the video container from the clicked element
        videoElement = window.lastRightClickedElement.closest('ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-rich-grid-media, ytd-reel-item-renderer');
        console.log("YouTube video element found:", videoElement);
      }

      if (videoElement) {
        // Extract from the video container (Home page, Search results, etc.)
        const titleElement = videoElement.querySelector('#video-title, #video-title-link');
        if (titleElement) {
          title = titleElement.innerText || titleElement.title;
        }

        const linkElement = videoElement.querySelector('a#video-title-link, a#thumbnail, a#video-title, a.ytd-command-run-renderer');
        if (linkElement && linkElement.href) {
          url = linkElement.href;
        }

        const channelElement = videoElement.querySelector('#channel-name a, #text-container a, .ytd-channel-name a');
        if (channelElement) {
          author = channelElement.innerText;
        }

        // Try to get thumbnail as avatar
        const imgElement = videoElement.querySelector('img');
        if (imgElement) {
          avatarUrl = imgElement.src;
        }

        content = "YouTube Video"; // Default content for list items

      } else {
        // Fallback to video page logic (existing)
        const videoTitle = document.querySelector('meta[name="title"]')?.content || document.title;
        title = videoTitle;
        console.log("YouTube title:", title);

        const channelName = document.querySelector('link[itemprop="name"]')?.getAttribute('content') ||
          document.querySelector('#upload-info #channel-name a')?.innerText ||
          document.querySelector('.ytd-channel-name a')?.innerText ||
          "Unknown Channel";
        author = channelName;
        console.log("YouTube author:", author);

        // Get video ID for thumbnail
        let videoId = null;
        if (url.includes("youtube.com/watch")) {
          const urlParams = new URLSearchParams(window.location.search);
          videoId = urlParams.get('v');
        } else if (url.includes("youtu.be/")) {
          videoId = url.split('/').pop();
        }
        console.log("YouTube videoId:", videoId);

        if (videoId) {
          avatarUrl = `https://img.youtube.com/vi/${videoId}/default.jpg`;
        } else {
          // Fallback to og:image
          const ogImage = document.querySelector('meta[property="og:image"]');
          if (ogImage) avatarUrl = ogImage.content;
        }
        console.log("YouTube avatarUrl:", avatarUrl);

        content = document.querySelector('meta[name="description"]')?.content ||
          document.querySelector('#description-inline-expander')?.innerText ||
          document.querySelector('ytd-text-inline-expander span')?.innerText ||
          "YouTube Video";
      }
      console.log("YouTube content length:", content.length);
    } else {
      // Generic article extraction remains same
      const article = document.querySelector('article');
      if (article) {
        content = article.innerText;
        // Try to find a representative image for the article
        const ogImage = document.querySelector('meta[property="og:image"]');
        if (ogImage) {
          avatarUrl = ogImage.content;
        }
      } else {
        content = document.body.innerText.substring(0, 500);
      }
    }

    // Post-processing for titles to avoid generic ones
    if (source === 'LinkedIn' || source === 'Twitter') {
      if (title.includes('LinkedIn') || title.includes('Twitter') || title.includes('X.com') || title.includes('Feed') || !title) {
        if (content && content.length > 0) {
          // Use first 50 chars of content as title
          title = content.substring(0, 50).trim();
          if (content.length > 50) title += '...';
        }
      }
    }

    return {
      url: url,
      title: title,
      content: content.substring(0, 1000),
      author: author,
      source: source,
      avatarUrl: avatarUrl
    };
  };

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Content script received message:", request);
    if (request.action === "extract") {
      const content = window.extractContent(false);
      console.log("Extracted content (general):", content);
      sendResponse(content);
    } else if (request.action === "extract_specific") {
      const content = window.extractContent(true);
      console.log("Extracted content (specific):", content);
      sendResponse(content);
    }
    return true; // Keep connection open just in case, although currently synchronous
  });
  console.log("Smart Bookmark Organizer content script loaded and initialized.");
})();
