// Content script for ChatGPT Mass Delete/Export Chats
// Author: jarosciak@gmail.com

// Prevent duplicate loading
if (window.__gptCleanerLoaded) {
    console.log('[INIT] Content script already loaded, skipping...');
} else {
    window.__gptCleanerLoaded = true;

// Script loaded

// Store auth token globally
let authToken = null;
let capturedTokens = new Set();

// Proactively try to capture auth token by calling /api/auth/session directly
function proactivelyCaptureToken() {
    try {

        // Try to get token directly from the auth/session endpoint (most reliable method)
        fetch('/api/auth/session', {
            method: 'GET',
            credentials: 'include'
        }).then(response => {
            if (response.ok) {
                return response.json();
            } else {
                return null;
            }
        }).then(data => {
            if (data && data.accessToken) {
                if (!capturedTokens.has(data.accessToken)) {
                    authToken = data.accessToken;
                    capturedTokens.add(authToken);
                }
            } else if (data) {
            }
        }).catch(error => {
        });

        // Fallback: try multiple endpoints that will trigger token capture from headers
        setTimeout(() => {
            if (authToken) {
                return;
            }

            const endpoints = [
                '/backend-api/accounts/check',
                '/backend-api/conversations',
                '/api/user'
            ];

            endpoints.forEach(endpoint => {
                try {
                    fetch(endpoint, {
                        method: 'GET',
                        credentials: 'include'
                    }).catch(e => {
                        // Expected - endpoint might not exist, but token might be captured from request
                    });
                } catch (e) {}
            });
        }, 1000);
    } catch (e) {
        console.log('[TOKEN] Proactive capture failed:', e.message);
    }
}

// Try to capture token immediately when script loads
// Run multiple times to ensure we get it even if timing is off
setTimeout(proactivelyCaptureToken, 50);
setTimeout(proactivelyCaptureToken, 100);
setTimeout(proactivelyCaptureToken, 300);
setTimeout(proactivelyCaptureToken, 800);
setTimeout(proactivelyCaptureToken, 1500);
setTimeout(proactivelyCaptureToken, 3000);

// Also capture on user interactions
document.addEventListener('load', proactivelyCaptureToken, true);
document.addEventListener('click', proactivelyCaptureToken, true);
document.addEventListener('focus', proactivelyCaptureToken, true);

// Intercept fetch calls to capture authorization headers
const originalFetch = window.fetch;
window.fetch = function(...args) {
    const url = String(args[0]);
    const initObj = args[1];

    // Try to capture token from outgoing requests
    if (initObj) {
        let auth = null;

        // Check various header formats
        if (initObj.headers) {
            if (typeof initObj.headers === 'object' && !initObj.headers.get) {
                auth = initObj.headers.authorization || initObj.headers.Authorization;
            } else if (typeof initObj.headers.get === 'function') {
                auth = initObj.headers.get('authorization') || initObj.headers.get('Authorization');
            } else if (typeof initObj.headers[Symbol.iterator] === 'function') {
                try {
                    for (const [key, value] of initObj.headers) {
                        if (key.toLowerCase() === 'authorization') {
                            auth = value;
                            break;
                        }
                    }
                } catch (e) {}
            }
        }

        // Store token if found
        if (auth && !capturedTokens.has(auth)) {
            authToken = auth;
            capturedTokens.add(auth);
        }
    }

    // Make the actual fetch call
    const result = originalFetch.apply(this, args);

    // Try to capture from response headers
    if (result && typeof result.then === 'function') {
        result.then(response => {
            if (response && typeof response.headers === 'object') {
                try {
                    const authHeader = response.headers.get('authorization');
                    if (authHeader && !capturedTokens.has(authHeader)) {
                        authToken = authHeader;
                        capturedTokens.add(authHeader);
                    }
                } catch (e) {}
            }
        }).catch(() => {});
    }

    return result;
};

// Intercept XMLHttpRequest to capture authorization headers
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
const originalXHRSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._requestURL = url;
    this._requestMethod = method;
    this._requestHeaders = {};
    return originalXHROpen.apply(this, [method, url, ...rest]);
};

XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
    if (header.toLowerCase() === 'authorization' && !capturedTokens.has(value)) {
        authToken = value;
        capturedTokens.add(value);
    }
    this._requestHeaders = this._requestHeaders || {};
    this._requestHeaders[header] = value;
    return originalSetRequestHeader.apply(this, [header, value]);
};

XMLHttpRequest.prototype.send = function(data) {
    if (this._requestHeaders && this._requestHeaders['authorization']) {
        const authValue = this._requestHeaders['authorization'];
        if (!capturedTokens.has(authValue)) {
            authToken = authValue;
            capturedTokens.add(authValue);
        }
    }
    return originalXHRSend.apply(this, arguments);
};

// Try to extract token from page context and storage
function extractAuthToken() {
    // Already have a captured token
    if (authToken) {
            return authToken;
    }


    // Try to extract token from cookies - be permissive, look for any potential token
    try {
        const cookies = document.cookie.split(';');

        const priorityCookies = [
            '__Secure-next-auth.session-token',
            '__Host-next-auth.session-token',
            'auth_token',
            'access_token',
            'bearer_token',
            'jwt',
            'token'
        ];

        // First pass: Look for priority cookies
        for (const priorityName of priorityCookies) {
            for (const cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (!name || !value) continue;

                if (name.toLowerCase().includes(priorityName.toLowerCase())) {
                    const decodedValue = decodeURIComponent(value);
                    if ((decodedValue.length > 50 && decodedValue.includes('.')) ||
                        decodedValue.startsWith('eyJ')) {
                        if (!capturedTokens.has(decodedValue)) {
                            authToken = decodedValue;
                            capturedTokens.add(decodedValue);
                            return authToken;
                        }
                    }
                }
            }
        }

        // Second pass: Look for any cookie with a token-like value
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (!name || !value) continue;

            const decodedValue = decodeURIComponent(value);
            if ((decodedValue.length > 80 && decodedValue.includes('.')) ||
                (decodedValue.startsWith('eyJ') && decodedValue.length > 50)) {
                if (!capturedTokens.has(decodedValue)) {
                    authToken = decodedValue;
                    capturedTokens.add(decodedValue);
                    return authToken;
                }
            }
        }
    } catch (e) {
        // Silent fail - cookies not accessible
    }

    // Try to find token in common React/Next.js locations
    try {
        const tokenKeys = ['__INITIAL_STATE__', '__data', '__NEXT_DATA__', '__NUXT__', '_user', 'user', 'auth', 'token', '_auth'];
        for (const key of tokenKeys) {
            if (window[key]) {
                try {
                    const tokenStr = JSON.stringify(window[key]);
                    const tokenMatch = tokenStr.match(/bearer\s+eyJ[a-zA-Z0-9_\-]+/i);
                    if (tokenMatch && !capturedTokens.has(tokenMatch[0])) {
                        authToken = tokenMatch[0];
                        capturedTokens.add(authToken);
                        return authToken;
                    }
                    const jwtMatch = tokenStr.match(/(eyJ[a-zA-Z0-9_\-\.]+)/g);
                    if (jwtMatch) {
                        for (const jwt of jwtMatch) {
                            if (jwt.split('.').length === 3 && !capturedTokens.has(jwt)) {
                                authToken = jwt;
                                capturedTokens.add(jwt);
                                return authToken;
                            }
                        }
                    }
                } catch (e) {}
            }
        }
    } catch (e) {}

    // Try localStorage/sessionStorage
    try {
        const keys = ['auth_token', 'token', 'session', 'access_token', '_auth', 'bearer', '__auth__', 'openai_session', 'jwt'];
        for (const key of keys) {
            const stored = localStorage.getItem(key) || sessionStorage.getItem(key);
            if (stored && !capturedTokens.has(stored)) {
                authToken = stored;
                capturedTokens.add(stored);
                return authToken;
            }
        }
    } catch (e) {}

    return null;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getConversations') {
        if (!authToken) {
            extractAuthToken();
        }

        getConversations()
            .then(conversations => {
                sendResponse({ success: true, conversations });
            })
            .catch(error => {
                console.error(`[ERROR] Failed to get conversations: ${error.message}`);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }

    if (request.action === 'deleteConversation') {
        deleteConversation(request.conversationId)
            .then(() => {
                console.log(`[MESSAGE] ✓ Delete response sent`);
                sendResponse({ success: true });
            })
            .catch(error => {
                console.error(`[MESSAGE] ✗ Delete error: ${error.message}`);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }

    if (request.action === 'getConversationContent') {
        getConversationContent(request.conversationId)
            .then(result => {
                sendResponse({
                    success: true,
                    title: result.title,
                    messages: result.messages,
                    imageUrls: result.imageUrls
                });
            })
            .catch(error => {
                console.error(`[MESSAGE] ✗ Content fetch error: ${error.message}`);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }

    if (request.action === 'downloadImage') {
        downloadImage(request.fileId, request.fileName, request.conversationId)
            .then(result => {
                // Convert ArrayBuffer to Array for Chrome message passing
                // (ArrayBuffer is not JSON-serializable)
                const uint8Array = new Uint8Array(result.arrayBuffer);
                const dataArray = Array.from(uint8Array);

                sendResponse({
                    success: true,
                    dataArray: dataArray,  // Send as regular Array instead of ArrayBuffer
                    filename: result.filename,
                    mimeType: result.mimeType
                });
            })
            .catch(error => {
                // Use warn for expected failures (422 errors for files not in DOM)
                if (error.message.includes('422')) {
                    console.warn(`[MESSAGE] ⚠️ File download skipped: ${error.message}`);
                } else {
                    console.error(`[MESSAGE] ✗ Image download error: ${error.message}`);
                }
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
});

// Get all conversations from the ChatGPT sidebar
async function getConversations() {
    try {
        const conversations = [];
        const selectors = [
            'a[href*="/c/"]',
            'nav a[href*="/c/"]',
            '[role="button"] a[href*="/c/"]',
            'div[class*="sidebar"] a[href*="/c/"]',
            'li a[href*="/c/"]',
            'a[href^="/c/"]',
            '.overflow-y-auto a[href*="/c/"]'
        ];

        let foundElements = [];
        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                foundElements = Array.from(elements);
                break;
            }
        }

        foundElements.forEach((el) => {
            const href = el.getAttribute('href');
            if (href && href.match(/\/c\/[a-z0-9-]+/i)) {
                const match = href.match(/\/c\/([a-z0-9-]+)/i);
                if (match && match[1]) {
                    let title = el.textContent.trim() || el.innerText.trim();
                    if (!title || title.length === 0 || title.match(/^[a-z0-9-]+$/i)) {
                        const parent = el.closest('[role="button"]') || el.closest('li') || el.parentElement;
                        if (parent) {
                            title = parent.textContent.trim() || parent.innerText.trim();
                        }
                    }

                    title = title.replace(/\s+/g, ' ').substring(0, 100);
                    if (!conversations.find(c => c.id === match[1])) {
                        conversations.push({
                            id: match[1],
                            title: title || 'Conversation'
                        });
                    }
                }
            }
        });

        return conversations;
    } catch (error) {
        throw new Error(`Failed to get conversations: ${error.message}`);
    }
}

// Get conversation content by ID
async function getConversationContent(conversationId) {
    try {
        // Try to fetch from API first
        if (authToken) {
            const headers = { 'Content-Type': 'application/json' };
            let finalToken = authToken;
            if (!authToken.includes('Bearer') && authToken.startsWith('eyJ')) {
                finalToken = 'Bearer ' + authToken;
            }
            headers['Authorization'] = finalToken;

            try {
                const response = await fetch(
                    `https://chatgpt.com/backend-api/conversation/${conversationId}`,
                    {
                        method: 'GET',
                        headers: headers,
                        credentials: 'include'
                    }
                );

                if (response.ok) {
                    const data = await response.json();

                    if (data.title && data.mapping) {
                        // Extract all messages from the conversation
                        const messages = [];
                        const imageUrls = [];

                        for (const msgId in data.mapping) {
                            const item = data.mapping[msgId];
                            if (item.message && item.message.content) {
                                const role = item.message.author.role;
                                const content = item.message.content;
                                let text = '';
                                const msgImages = [];

                                // Extract text and file attachments from parts
                                if (content.parts && Array.isArray(content.parts)) {
                                    const textParts = [];
                                    content.parts.forEach((part, partIndex) => {
                                        if (typeof part === 'string') {
                                            // Text content
                                            textParts.push(part);
                                        } else if (typeof part === 'object' && part !== null) {
                                            // File attachment (image, document, code file, etc.)
                                            let fileId = null;
                                            let fileName = null;
                                            let mimeType = null;

                                            // Extract file ID from various formats
                                            if (part.asset_pointer) {
                                                fileId = part.asset_pointer.replace('file-', '').replace('sediment://', '');
                                            } else if (part.file_id) {
                                                fileId = part.file_id;
                                            } else if (part.image_url) {
                                                fileId = part.image_url;
                                            }

                                            // Get file metadata
                                            fileName = part.name;
                                            mimeType = part.mimeType || part.mime_type;

                                            // Add file to attachments
                                            if (fileId) {
                                                msgImages.push({
                                                    fileId: fileId,
                                                    fileName: fileName,
                                                    mimeType: mimeType,
                                                    contentType: part.content_type,
                                                    conversationId: conversationId
                                                });
                                                imageUrls.push(fileId);
                                            }
                                        }
                                    });
                                    text = textParts.join('\n');
                                }

                                // Check metadata for all attachments (that weren't already in parts)
                                if (item.message.metadata) {
                                    const metadata = item.message.metadata;
                                    if (metadata.attachments && Array.isArray(metadata.attachments)) {
                                        // Get existing file IDs to avoid duplicates
                                        const existingFileIds = new Set(msgImages.map(img => img.fileId));

                                        metadata.attachments.forEach(attachment => {
                                            if (attachment.id && !existingFileIds.has(attachment.id)) {
                                                msgImages.push({
                                                    fileId: attachment.id,
                                                    fileName: attachment.name || attachment.filename,
                                                    mimeType: attachment.mimeType || attachment.mime_type,
                                                    contentType: attachment.content_type,
                                                    conversationId: conversationId
                                                });
                                                imageUrls.push(attachment.id);
                                            }
                                        });
                                    }
                                }

                                if (text.trim() || msgImages.length > 0) {
                                    // Deduplicate images within this message
                                    const uniqueMsgImages = [];
                                    const seenFileIds = new Set();

                                    for (const img of msgImages) {
                                        if (!seenFileIds.has(img.fileId)) {
                                            uniqueMsgImages.push(img);
                                            seenFileIds.add(img.fileId);
                                        }
                                    }

                                    messages.push({
                                        role: role.toUpperCase(),
                                        text: text,
                                        images: uniqueMsgImages
                                    });
                                }
                            }
                        }

                        const uniqueImageUrls = Array.from(new Set(imageUrls));
                        console.log(`[EXTRACT] Extracted ${messages.length} messages, ${uniqueImageUrls.length} files`);

                        return {
                            title: data.title,
                            messages: messages,
                            imageUrls: uniqueImageUrls
                        };
                    }
                }
            } catch (apiError) {
                // Fall through to DOM extraction
            }
        }

        // Fallback: Navigate to conversation and extract content from DOM
        const currentUrl = window.location.href;
        const targetUrl = `https://chatgpt.com/c/${conversationId}`;

        // Check if we're already on this conversation
        if (!currentUrl.includes(conversationId)) {
            window.location.href = targetUrl;
            // Wait for page to load
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        // Extract content from the page
        const title = document.querySelector('[class*="title"]')?.textContent?.trim() || `Conversation_${conversationId}`;

        const messages = [];
        const imageUrls = [];
        const messageElements = document.querySelectorAll('[class*="message"], [role="article"]');

        messageElements.forEach(el => {
            const text = el.innerText?.trim();
            const msgImages = [];

            // Extract images from the message element
            const images = el.querySelectorAll('img');
            images.forEach(img => {
                if (img.src && !img.src.includes('data:image')) {
                    imageUrls.push(img.src);
                    msgImages.push(img.src);
                }
            });

            if ((text && text.length > 0) || msgImages.length > 0) {
                messages.push({
                    role: 'UNKNOWN',
                    text: text || '',
                    images: msgImages
                });
            }
        });

        return {
            title: title.substring(0, 100),
            messages: messages,
            imageUrls: Array.from(new Set(imageUrls))
        };

    } catch (error) {
        console.error(`[CONTENT] Failed to get conversation content: ${error.message}`);
        return {
            title: `Conversation_${conversationId}`,
            messages: [{
                role: 'ERROR',
                text: `Error retrieving content: ${error.message}`,
                images: []
            }],
            imageUrls: []
        };
    }
}

// Delete conversation - try API first, fallback to UI
async function deleteConversation(conversationId) {
    try {
        // Try API call via background service worker first
        try {
            // Get the best available auth token
            let token = authToken || extractAuthToken();

            if (!token) {
                throw new Error('No authentication token available');
            }

            const response = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('API call timeout'));
                }, 5000);

                chrome.runtime.sendMessage(
                    {
                        action: 'deleteConversationAPI',
                        conversationId,
                        authToken: token
                    },
                    (response) => {
                        clearTimeout(timeout);
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve(response);
                        }
                    }
                );
            });

            if (response.success) {
                return true;
            } else {
                throw new Error(response.error || 'API returned error');
            }
        } catch (apiError) {
            // API failed, fall back to UI method
        }

        // Fallback: Delete via UI clicking
        const conversationLink = document.querySelector(`a[href*="/c/${conversationId}"]`);
        if (!conversationLink) {
            throw new Error(`Conversation not found: ${conversationId}`);
        }

        conversationLink.scrollIntoView({ behavior: 'auto', block: 'nearest' });
        await new Promise(resolve => setTimeout(resolve, 50));

        let optionsButton = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            conversationLink.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, view: window }));
            conversationLink.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, view: window }));
            const parent = conversationLink.parentElement;
            if (parent) {
                parent.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, view: window }));
            }

            await new Promise(resolve => setTimeout(resolve, 200));

            const allButtons = Array.from(document.querySelectorAll('button'));
            optionsButton = allButtons.find(btn => {
                const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                return ariaLabel.includes('conversation') && ariaLabel.includes('option') && btn.offsetParent !== null;
            });

            if (optionsButton) {
                optionsButton.click();
                optionsButton.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
                optionsButton.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
                await new Promise(resolve => setTimeout(resolve, 300));
                break;
            }

            if (attempt === 2) {
                const event = new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    buttons: 2
                });
                conversationLink.dispatchEvent(event);
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }

        let deleteOption = null;
        const allElements = Array.from(document.querySelectorAll('*')).filter(el => el.offsetParent !== null);

        for (const el of allElements) {
            const innerText = (el.innerText || '').toLowerCase().trim();
            if (innerText === 'delete') {
                let current = el;
                let depth = 0;
                while (current && depth < 5) {
                    const isClickable = current.onclick || current.tagName === 'BUTTON' || current.tagName === 'A' ||
                                       current.getAttribute('role') === 'button' || current.getAttribute('role') === 'menuitem' ||
                                       current.className?.toString().includes('cursor-pointer') ||
                                       current.className?.toString().includes('hover');
                    if (isClickable) {
                        deleteOption = current;
                        break;
                    }
                    current = current.parentElement;
                    depth++;
                }
                if (deleteOption) break;
            }
        }

        if (deleteOption) {
            deleteOption.click();
            await new Promise(resolve => setTimeout(resolve, 300));
        } else {
            const xpath = "//*[text()='Delete']";
            const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            if (result.singleNodeValue) {
                let parent = result.singleNodeValue.parentElement;
                while (parent && parent !== document.body) {
                    if (parent.onclick || parent.getAttribute('role') === 'button' || parent.getAttribute('role') === 'menuitem') {
                        parent.click();
                        await new Promise(resolve => setTimeout(resolve, 300));
                        break;
                    }
                    parent = parent.parentElement;
                }
            }
        }

        await new Promise(resolve => setTimeout(resolve, 300));

        const allButtons = Array.from(document.querySelectorAll('button'));
        let confirmButton = allButtons.find(btn => {
            const text = btn.textContent.toLowerCase().trim();
            return text === 'ok' || text === 'delete' || (text.includes('confirm') && text.includes('delete'));
        });

        if (confirmButton) {
            confirmButton.click();
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`[DELETE] ✓ Conversation ${conversationId} deleted via UI fallback`);
        return true;
    } catch (error) {
        console.error(`[DELETE] ✗ Failed to delete ${conversationId}: ${error.message}`);
        throw error;
    }
}

// Download file with authentication (images, documents, code files, etc.)
async function downloadImage(fileId, fileName = null, conversationId = null) {
    try {
        console.log(`[FILE] Attempting to download: ${fileName || fileId}...`);

        // First, try to find the actual file URL from the DOM (includes signature)
        let fileUrl = null;

        // Search in img tags (for images)
        const images = document.querySelectorAll('img');
        console.log(`[FILE] Searching ${images.length} img tags for ${fileId}...`);
        for (const img of images) {
            if (img.src && img.src.includes(fileId)) {
                fileUrl = img.src;
                console.log(`[FILE] ✓ Found in img tag: ${fileUrl.substring(0, 100)}...`);
                break;
            }
        }

        // Search in anchor/link tags (for downloadable files like PDFs, documents, etc.)
        if (!fileUrl) {
            const links = document.querySelectorAll('a[href*="estuary"], a[download], a[href*="' + fileId + '"]');
            console.log(`[FILE] Searching ${links.length} anchor tags...`);
            for (const link of links) {
                if (link.href && link.href.includes(fileId)) {
                    fileUrl = link.href;
                    console.log(`[FILE] ✓ Found in anchor tag: ${fileUrl.substring(0, 100)}...`);
                    break;
                }
            }
        }

        // Search in button/div elements (file download buttons)
        if (!fileUrl) {
            const buttons = document.querySelectorAll('button, div[role="button"], [class*="download"]');
            for (const btn of buttons) {
                const onclick = btn.getAttribute('onclick') || '';
                const dataFile = btn.getAttribute('data-file') || btn.getAttribute('data-file-id') || '';
                const ariaLabel = btn.getAttribute('aria-label') || '';

                if (onclick.includes(fileId) || dataFile.includes(fileId) || ariaLabel.includes(fileId)) {
                    const parent = btn.closest('[data-testid*="file"], [class*="attachment"]');
                    if (parent) {
                        const parentLinks = parent.querySelectorAll('a[href*="estuary"]');
                        for (const link of parentLinks) {
                            if (link.href.includes(fileId)) {
                                fileUrl = link.href;
                                break;
                            }
                        }
                    }
                }
                if (fileUrl) break;
            }
        }

        // Search all elements for data attributes that might contain file info
        if (!fileUrl) {
            const allElements = document.querySelectorAll('[data-file-id], [data-testid*="file"], [class*="file-"], [class*="attachment"]');
            for (const elem of allElements) {
                const attrs = elem.attributes;
                for (let i = 0; i < attrs.length; i++) {
                    const attr = attrs[i];
                    if (attr.value && attr.value.includes(fileId)) {
                        const nearbyLinks = elem.querySelectorAll('a[href*="estuary"]');
                        for (const link of nearbyLinks) {
                            if (link.href) {
                                fileUrl = link.href;
                                break;
                            }
                        }
                        if (fileUrl) break;
                    }
                }
                if (fileUrl) break;
            }
        }

        // If file not found, try to programmatically open it to load the signed URL
        if (!fileUrl) {
            console.log(`[FILE] Triggering preview for ${fileName || fileId}...`);

            const fileButtons = document.querySelectorAll('button, a, div[role="button"], [class*="attachment"]');
            for (const btn of fileButtons) {
                const text = btn.textContent || '';
                const ariaLabel = btn.getAttribute('aria-label') || '';
                const title = btn.getAttribute('title') || '';

                // Check if this button/link relates to our file
                const matchesFileName = fileName && (text.includes(fileName) || ariaLabel.includes(fileName) || title.includes(fileName));
                const matchesFileType = text.toLowerCase().includes('.pdf') || text.toLowerCase().includes('.docx') ||
                    text.toLowerCase().includes('.doc') || text.toLowerCase().includes('.pptx');
                const matchesFileId = ariaLabel.includes(fileId) || title.includes(fileId);

                if (matchesFileName || matchesFileType || matchesFileId) {
                    btn.click();
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Try searching for the URL again
                    const newImages = document.querySelectorAll('img');
                    for (const img of newImages) {
                        if (img.src && img.src.includes(fileId)) {
                            fileUrl = img.src;
                            break;
                        }
                    }

                    // Also check iframe sources (PDFs often load in iframes)
                    if (!fileUrl) {
                        const iframes = document.querySelectorAll('iframe');
                        for (const iframe of iframes) {
                            if (iframe.src && iframe.src.includes(fileId)) {
                                fileUrl = iframe.src;
                                break;
                            }
                        }
                    }

                    if (fileUrl) break;
                }
            }
        }

        // Fallback: construct URL with conversation ID and auth token
        if (!fileUrl) {
            // Determine file type parameter based on fileName or mimeType
            let fileParam = 'fs'; // default for images/files

            if (fileName) {
                const lowerName = fileName.toLowerCase();
                if (lowerName.endsWith('.pdf') || lowerName.endsWith('.doc') ||
                    lowerName.endsWith('.docx') || lowerName.endsWith('.pptx')) {
                    fileParam = 'fsns'; // for documents/PDFs
                }
            }

            // Construct URL with conversation ID if available
            if (conversationId) {
                fileUrl = `https://chatgpt.com/backend-api/conversation/${conversationId}/download/${fileId}`;
            } else {
                fileUrl = `https://chatgpt.com/backend-api/estuary/content?id=${fileId}&p=${fileParam}`;
            }
        }

        // Ensure we have auth token for fallback
        if (!authToken) {
            extractAuthToken();
        }

        const headers = {};

        // Add authorization if available (for fallback method)
        if (authToken) {
            let finalToken = authToken;
            if (!authToken.includes('Bearer') && authToken.startsWith('eyJ')) {
                finalToken = 'Bearer ' + authToken;
            }
            headers['Authorization'] = finalToken;
        }

        const response = await fetch(fileUrl, {
            method: 'GET',
            headers: headers,
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();

        // Detect file type from magic numbers if content-type is generic
        let contentType = response.headers.get('content-type') || 'application/octet-stream';

        // If content-type is generic, detect from file signature (magic numbers)
        if (contentType === 'application/octet-stream' || contentType === 'binary/octet-stream') {
            const bytes = new Uint8Array(arrayBuffer.slice(0, 12));

            // Check magic numbers for common image formats
            if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
                contentType = 'image/jpeg';
            } else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
                contentType = 'image/png';
            } else if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
                contentType = 'image/gif';
            } else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
                // RIFF container, check for WEBP
                if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
                    contentType = 'image/webp';
                }
            } else if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
                contentType = 'application/pdf';
            }
        }

        // Map content type to extension
        const mimeToExt = {
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'text/plain': 'txt',
            'text/markdown': 'md',
            'text/html': 'html',
            'text/css': 'css',
            'text/javascript': 'js',
            'text/x-python': 'py',
            'text/x-java': 'java',
            'text/x-c': 'c',
            'text/x-c++': 'cpp',
            'text/x-csharp': 'cs',
            'text/x-golang': 'go',
            'text/x-php': 'php',
            'text/x-ruby': 'rb',
            'text/x-tex': 'tex',
            'application/typescript': 'ts',
            'application/json': 'json',
            'application/pdf': 'pdf',
            'application/msword': 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
            'application/x-sh': 'sh'
        };

        let extension = mimeToExt[contentType] || 'bin';

        const filename = `${fileId}.${extension}`;
        console.log(`[FILE] ✓ Downloaded: ${fileName || filename} (${(arrayBuffer.byteLength / 1024).toFixed(1)}KB)`);

        return {
            arrayBuffer: arrayBuffer,
            filename: filename,
            mimeType: contentType
        };

    } catch (error) {
        if (error.message.includes('422')) {
            console.warn(`[FILE] ⚠️ ${fileName || fileId} not available (not loaded in page)`);
        } else {
            console.error(`[FILE] ✗ Download failed: ${error.message}`);
        }
        throw error;
    }
}

} // End of duplicate-load prevention block
