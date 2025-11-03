// Background service worker for ChatGPT Mass Delete/Export Chats
// Author: jarosciak@gmail.com

console.log('[BACKGROUND] Service worker loaded');

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'deleteConversationAPI') {
        console.log(`[BACKGROUND] Delete API request for: ${request.conversationId}`);
        console.log(`[BACKGROUND] Auth token available: ${request.authToken ? 'Yes' : 'No'}`);

        deleteConversationAPI(request.conversationId, request.authToken)
            .then(() => {
                console.log(`[BACKGROUND] ✓ API deletion successful for ${request.conversationId}`);
                sendResponse({ success: true });
            })
            .catch(error => {
                console.error(`[BACKGROUND] ✗ API deletion failed: ${error.message}`);
                sendResponse({ success: false, error: error.message });
            });
        return true; // Keep channel open for async response
    }
});

// Delete conversation via API using background service worker
async function deleteConversationAPI(conversationId, authToken) {
    console.log(`[BACKGROUND-API] Making PATCH request for: ${conversationId}`);
    console.log(`[BACKGROUND-API] Token provided: ${authToken ? 'Yes (' + authToken.substring(0, 20) + '...)' : 'No'}`);

    try {
        const headers = {
            'Content-Type': 'application/json'
        };

        // Use explicit auth token if available
        if (authToken) {
            // Ensure token has "Bearer " prefix if it's a JWT
            let finalToken = authToken;
            if (!authToken.includes('Bearer') && authToken.startsWith('eyJ')) {
                finalToken = 'Bearer ' + authToken;
                console.log(`[BACKGROUND-API] Added Bearer prefix to JWT token`);
            }

            headers['Authorization'] = finalToken;
            console.log(`[BACKGROUND-API] Using provided Authorization header`);
            console.log(`[BACKGROUND-API] Authorization starts with: ${finalToken.substring(0, 15)}...`);
        } else {
            console.log(`[BACKGROUND-API] No auth token provided, relying on credentials only`);
        }

        const fetchUrl = `https://chatgpt.com/backend-api/conversation/${conversationId}`;
        const fetchOptions = {
            method: 'PATCH',
            headers: headers,
            credentials: 'include',
            body: JSON.stringify({ is_visible: false })
        };

        console.log(`[BACKGROUND-API] Fetch URL: ${fetchUrl}`);
        console.log(`[BACKGROUND-API] Headers: ${JSON.stringify(headers)}`);

        const response = await fetch(fetchUrl, fetchOptions);

        console.log(`[BACKGROUND-API] Response status: ${response.status}`);
        console.log(`[BACKGROUND-API] Response statusText: ${response.statusText}`);

        if (!response.ok) {
            // Try to get error details from response
            let errorDetail = '';
            try {
                const errorData = await response.json();
                errorDetail = JSON.stringify(errorData);
            } catch (e) {
                errorDetail = await response.text();
            }
            console.error(`[BACKGROUND-API] Error response: ${errorDetail}`);
            throw new Error(`API error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`[BACKGROUND-API] Response body:`, data);
        console.log(`[BACKGROUND-API] ✓ Successfully deleted via API`);

        return true;
    } catch (error) {
        console.error(`[BACKGROUND-API] Fetch error: ${error.message}`);
        throw error;
    }
}
