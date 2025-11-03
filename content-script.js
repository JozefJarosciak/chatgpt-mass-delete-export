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

    // Log backend API calls for debugging
    if (url.includes('backend-api') || url.includes('conversation')) {
        console.log('[FETCH] Backend API request detected');
    }

    // Try to capture token from outgoing requests
    if (initObj) {
        let auth = null;

        // Method 1: Direct headers object with lowercase key
        if (initObj.headers) {
            if (typeof initObj.headers === 'object' && !initObj.headers.get) {
                auth = initObj.headers.authorization;
            }
        }

        // Method 2: Try uppercase Authorization
        if (!auth && initObj.headers && typeof initObj.headers === 'object') {
            auth = initObj.headers.Authorization;
        }

        // Method 3: If headers is a Headers object, try get()
        if (!auth && initObj.headers && typeof initObj.headers.get === 'function') {
            auth = initObj.headers.get('authorization');
            if (!auth) {
                auth = initObj.headers.get('Authorization');
            }
        }

        // Method 4: If headers is a Headers object, iterate entries
        if (!auth && initObj.headers && typeof initObj.headers[Symbol.iterator] === 'function') {
            try {
                for (const [key, value] of initObj.headers) {
                    if (key.toLowerCase() === 'authorization') {
                        auth = value;
                        break;
                    }
                }
            } catch (e) {}
        }

        // If we found a token, store it (prefer Bearer tokens)
        if (auth && !capturedTokens.has(auth)) {
            authToken = auth;
            capturedTokens.add(auth);

            // Log with details
            if (auth.includes('Bearer') || auth.startsWith('eyJ')) {
                console.log('[TOKEN] ✓ Captured from fetch: Bearer token');
                console.log('[TOKEN] Token starts with: ' + auth.substring(0, 30) + '...');
            } else {
                console.log('[TOKEN] ✓ Captured from fetch (non-Bearer): ' + auth.substring(0, 30) + '...');
            }
        }
    }

    // Make the actual fetch call
    const result = originalFetch.apply(this, args);

    // Also try to capture from response headers
    if (result && typeof result.then === 'function') {
        result.then(response => {
            if (response && typeof response.headers === 'object') {
                try {
                    const authHeader = response.headers.get('authorization');
                    if (authHeader && !capturedTokens.has(authHeader)) {
                        authToken = authHeader;
                        capturedTokens.add(authHeader);
                        console.log('[TOKEN] ✓ Captured from response headers');
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

    // Log backend API calls
    if (String(url).includes('backend-api') || String(url).includes('conversation')) {
        console.log('[XHR] Request to backend API');
    }

    return originalXHROpen.apply(this, [method, url, ...rest]);
};

XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
    // Capture authorization headers
    if (header.toLowerCase() === 'authorization') {
        if (!capturedTokens.has(value)) {
            authToken = value;
            capturedTokens.add(value);
            console.log('[TOKEN] ✓ Captured from XHR setRequestHeader');
            console.log('[TOKEN] Token preview: ' + value.substring(0, 50) + '...');
        }
    }

    this._requestHeaders = this._requestHeaders || {};
    this._requestHeaders[header] = value;

    return originalSetRequestHeader.apply(this, [header, value]);
};

// Also intercept send to capture headers that might be added
XMLHttpRequest.prototype.send = function(data) {
    // Try to find authorization header in request
    if (this._requestHeaders && this._requestHeaders['authorization']) {
        const authValue = this._requestHeaders['authorization'];
        if (!capturedTokens.has(authValue)) {
            authToken = authValue;
            capturedTokens.add(authValue);
            console.log('[TOKEN] ✓ Captured from XHR send');
        }
    }

    // Continue with original send
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

                    // Accept if it looks like a token (long, has dots or eyJ prefix)
                    if ((decodedValue.length > 50 && decodedValue.includes('.')) ||
                        decodedValue.startsWith('eyJ')) {
                        if (!capturedTokens.has(decodedValue)) {
                            authToken = decodedValue;
                            capturedTokens.add(decodedValue);
                            console.log('[TOKEN] ✓ Found token in cookie: ' + name);
                            console.log('[TOKEN] Token preview: ' + decodedValue.substring(0, 40) + '...');
                            return authToken;
                        }
                    }
                }
            }
        }

        // Second pass: Look for any cookie with a token-like value (long, has dots, starts with eyJ)
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (!name || !value) continue;

            const decodedValue = decodeURIComponent(value);

            // Look for any long value with dots (could be JWT or session token)
            if (decodedValue.length > 80 && decodedValue.includes('.')) {
                if (!capturedTokens.has(decodedValue)) {
                    authToken = decodedValue;
                    capturedTokens.add(decodedValue);
                    console.log('[TOKEN] ✓ Found potential token in cookie: ' + name);
                    console.log('[TOKEN] Cookie name: ' + name + ', Length: ' + decodedValue.length);
                    return authToken;
                }
            }

            // Look for eyJ prefix (JWT tokens)
            if (decodedValue.startsWith('eyJ') && decodedValue.length > 50) {
                if (!capturedTokens.has(decodedValue)) {
                    authToken = decodedValue;
                    capturedTokens.add(decodedValue);
                    console.log('[TOKEN] ✓ Found JWT in cookie: ' + name);
                    return authToken;
                }
            }
        }
    } catch (e) {
        console.log('[TOKEN] Could not parse cookies');
    }

    // Try to find token in common React/Next.js locations
    try {
        const tokenKeys = [
            '__INITIAL_STATE__',
            '__data',
            '__NEXT_DATA__',
            '__NUXT__',
            '_user',
            'user',
            'auth',
            'token',
            '_auth'
        ];

        for (const key of tokenKeys) {
            if (window[key]) {
                try {
                    const tokenStr = JSON.stringify(window[key]);

                    // Look for JWT tokens (Bearer followed by eyJ...)
                    const tokenMatch = tokenStr.match(/bearer\s+eyJ[a-zA-Z0-9_\-]+/i);
                    if (tokenMatch && !capturedTokens.has(tokenMatch[0])) {
                        authToken = tokenMatch[0];
                        capturedTokens.add(authToken);
                        console.log('[TOKEN] ✓ Found Bearer token in window.' + key);
                        return authToken;
                    }

                    // Also look for just JWT tokens
                    const jwtMatch = tokenStr.match(/(eyJ[a-zA-Z0-9_\-\.]+)/g);
                    if (jwtMatch) {
                        for (const jwt of jwtMatch) {
                            if (jwt.split('.').length === 3 && !capturedTokens.has(jwt)) {
                                // Likely a valid JWT
                                authToken = jwt;
                                capturedTokens.add(jwt);
                                console.log('[TOKEN] ✓ Found JWT in window.' + key);
                                return authToken;
                            }
                        }
                    }
                } catch (e) {}
            }
        }
    } catch (e) {
        console.log('[TOKEN] Could not scan window object');
    }

    // Try localStorage keys
    try {
        const keys = [
            'auth_token',
            'token',
            'session',
            'access_token',
            '_auth',
            'bearer',
            '__auth__',
            'openai_session',
            'jwt'
        ];

        for (const key of keys) {
            const stored = localStorage.getItem(key);
            if (stored && !capturedTokens.has(stored)) {
                authToken = stored;
                capturedTokens.add(stored);
                console.log('[TOKEN] ✓ Found in localStorage.' + key);
                return authToken;
            }
        }
    } catch (e) {
        console.log('[TOKEN] Could not access localStorage');
    }

    // Try sessionStorage keys
    try {
        const keys = [
            'auth_token',
            'token',
            'session',
            'access_token',
            '_auth',
            'bearer',
            '__auth__',
            'openai_session',
            'jwt'
        ];

        for (const key of keys) {
            const stored = sessionStorage.getItem(key);
            if (stored && !capturedTokens.has(stored)) {
                authToken = stored;
                capturedTokens.add(stored);
                console.log('[TOKEN] ✓ Found in sessionStorage.' + key);
                return authToken;
            }
        }
    } catch (e) {
        console.log('[TOKEN] Could not access sessionStorage');
    }

    console.log('[TOKEN] [extractAuthToken] ✗ No token found in any source');
    console.log('[TOKEN] [extractAuthToken] Checked: cookies, window state, localStorage, sessionStorage');
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
                sendResponse({ success: true, title: result.title, content: result.content });
            })
            .catch(error => {
                console.error(`[MESSAGE] ✗ Content fetch error: ${error.message}`);
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
                        for (const msgId in data.mapping) {
                            const item = data.mapping[msgId];
                            if (item.message && item.message.content && item.message.content.parts) {
                                const role = item.message.author.role;
                                const text = item.message.content.parts.join('\n');
                                if (text.trim()) {
                                    messages.push(`[${role.toUpperCase()}]\n${text}`);
                                }
                            }
                        }
                        return {
                            title: data.title,
                            content: messages.join('\n\n---\n\n')
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
        const messageElements = document.querySelectorAll('[class*="message"], [role="article"]');

        messageElements.forEach(el => {
            const text = el.innerText?.trim();
            if (text && text.length > 0) {
                messages.push(text);
            }
        });

        const content = messages.join('\n\n---\n\n');

        return {
            title: title.substring(0, 100),
            content: content || 'No content found'
        };

    } catch (error) {
        console.error(`[CONTENT] Failed to get conversation content: ${error.message}`);
        return {
            title: `Conversation_${conversationId}`,
            content: `Error retrieving content: ${error.message}`
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

} // End of duplicate-load prevention block
