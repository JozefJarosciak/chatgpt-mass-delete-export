// Popup script for ChatGPT Mass Delete/Export Chats
// Author: jarosciak@gmail.com

// Delete Tab Elements
const deleteBtn = document.getElementById('deleteBtn');
const refreshBtn = document.getElementById('refreshBtn');
const selectAllBtn = document.getElementById('selectAllBtn');
const selectNoneBtn = document.getElementById('selectNoneBtn');
const pageStatusDiv = document.getElementById('pageStatus');
const conversationsContainer = document.getElementById('conversationsContainer');
const selectedCountDiv = document.getElementById('selectedCount');
const statusDiv = document.getElementById('status');
const progressDiv = document.getElementById('progress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

// Export Tab Elements
const exportBtn = document.getElementById('exportBtn');
const exportRefreshBtn = document.getElementById('exportRefreshBtn');
const exportSelectAllBtn = document.getElementById('exportSelectAllBtn');
const exportSelectNoneBtn = document.getElementById('exportSelectNoneBtn');
const exportPageStatusDiv = document.getElementById('exportPageStatus');
const exportConversationsContainer = document.getElementById('exportConversationsContainer');
const exportSelectedCountDiv = document.getElementById('exportSelectedCount');
const exportStatusDiv = document.getElementById('exportStatus');
const exportProgressDiv = document.getElementById('exportProgress');
const exportProgressFill = document.getElementById('exportProgressFill');
const exportProgressText = document.getElementById('exportProgressText');

let allConversations = [];
let isDeleting = false;
let isExporting = false;

// Tab switching
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', (e) => {
        const tabName = e.target.getAttribute('data-tab');
        switchTab(tabName);
    });
});

function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Deactivate all tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(tabName).classList.add('active');

    // Activate selected tab button
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Change heading icon based on tab
    const headingIcon = document.getElementById('headingIcon');
    if (tabName === 'delete-tab') {
        headingIcon.textContent = '🗑️';
    } else if (tabName === 'export-tab') {
        headingIcon.textContent = '📦';
    }
}

// Load conversations when popup opens
window.addEventListener('load', async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab.url.includes('chatgpt.com') && !tab.url.includes('chat.openai.com')) {
            pageStatusDiv.className = 'status-box error';
            pageStatusDiv.innerHTML = '❌ Not on ChatGPT - Go to chatgpt.com first';
            conversationsContainer.innerHTML = '<div class="empty-message">Please navigate to ChatGPT to load conversations</div>';
            exportPageStatusDiv.className = 'status-box error';
            exportPageStatusDiv.innerHTML = '❌ Not on ChatGPT - Go to chatgpt.com first';
            exportConversationsContainer.innerHTML = '<div class="empty-message">Please navigate to ChatGPT to load conversations</div>';
            deleteBtn.disabled = true;
            exportBtn.disabled = true;
            return;
        }

        await loadConversations(tab.id);
        await loadConversationsForExport(tab.id);
    } catch (error) {
        pageStatusDiv.className = 'status-box error';
        pageStatusDiv.textContent = `Error: ${error.message}`;
        exportPageStatusDiv.className = 'status-box error';
        exportPageStatusDiv.textContent = `Error: ${error.message}`;
    }
});

// Load conversations from ChatGPT
async function loadConversations(tabId) {
    try {
        pageStatusDiv.className = 'status-box loading';
        pageStatusDiv.innerHTML = '<span class="loading-spinner"></span>Loading conversations...';

        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['content-script.js']
            });
        } catch (e) {
            // Script may already be loaded
        }

        await new Promise(resolve => setTimeout(resolve, 300));

        const result = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout waiting for conversations'));
            }, 8000);

            chrome.tabs.sendMessage(tabId, { action: 'getConversations' }, (response) => {
                clearTimeout(timeout);
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });

        if (!result || !result.success) {
            throw new Error(result?.error || 'Failed to get conversations');
        }

        allConversations = result.conversations || [];

        if (allConversations.length === 0) {
            pageStatusDiv.className = 'status-box';
            pageStatusDiv.textContent = '✓ Connected to ChatGPT';
            conversationsContainer.innerHTML = '<div class="empty-message">No conversations found</div>';
            deleteBtn.disabled = true;
            return;
        }

        pageStatusDiv.className = 'status-box success';
        pageStatusDiv.textContent = `✓ Found ${allConversations.length} conversations - Select which ones to delete`;

        displayConversations();
        deleteBtn.disabled = false;
    } catch (error) {
        console.error('[POPUP] Error loading conversations:', error);
        pageStatusDiv.className = 'status-box error';
        pageStatusDiv.textContent = `Error: ${error.message}`;
        conversationsContainer.innerHTML = `<div class="empty-message">Failed to load conversations<br><br>Try refreshing the ChatGPT page and clicking the extension again.</div>`;
        deleteBtn.disabled = true;
    }
}

// Display conversations with checkboxes
function displayConversations() {
    conversationsContainer.innerHTML = '';

    allConversations.forEach((conv, index) => {
        const item = document.createElement('div');
        item.className = 'conversation-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `conv-${index}`;

        // Handle both old format (string) and new format (object with id and title)
        const convId = typeof conv === 'string' ? conv : conv.id;
        const convTitle = typeof conv === 'string' ? `Conversation ${index + 1}` : (conv.title || `Conversation ${index + 1}`);

        checkbox.value = convId;
        checkbox.addEventListener('change', updateSelectedCount);

        const label = document.createElement('label');
        label.className = 'conversation-text';
        label.htmlFor = `conv-${index}`;
        label.textContent = convTitle;
        label.style.cursor = 'pointer';
        label.title = convTitle; // Show full title on hover if truncated

        item.appendChild(checkbox);
        item.appendChild(label);

        // Click anywhere on the item to toggle checkbox
        item.addEventListener('click', (e) => {
            if (e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
                updateSelectedCount();
            }
        });

        conversationsContainer.appendChild(item);
    });
}

// Load conversations for export tab
async function loadConversationsForExport(tabId) {
    try {
        exportPageStatusDiv.className = 'status-box loading';
        exportPageStatusDiv.innerHTML = '<span class="loading-spinner"></span>Loading conversations...';

        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['content-script.js']
            });
        } catch (e) {
            // Script may already be loaded
        }

        await new Promise(resolve => setTimeout(resolve, 300));

        const result = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout waiting for conversations'));
            }, 8000);

            chrome.tabs.sendMessage(tabId, { action: 'getConversations' }, (response) => {
                clearTimeout(timeout);
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });

        if (!result || !result.success) {
            throw new Error(result?.error || 'Failed to get conversations');
        }

        if (result.conversations.length === 0) {
            exportPageStatusDiv.className = 'status-box';
            exportPageStatusDiv.textContent = '✓ Connected to ChatGPT';
            exportConversationsContainer.innerHTML = '<div class="empty-message">No conversations found</div>';
            exportBtn.disabled = true;
            return;
        }

        exportPageStatusDiv.className = 'status-box success';
        exportPageStatusDiv.textContent = `✓ Found ${result.conversations.length} conversations - Select which ones to export`;

        displayConversationsForExport(result.conversations);
        exportBtn.disabled = false;
    } catch (error) {
        console.error('[POPUP] Error loading conversations for export:', error);
        exportPageStatusDiv.className = 'status-box error';
        exportPageStatusDiv.textContent = `Error: ${error.message}`;
        exportConversationsContainer.innerHTML = `<div class="empty-message">Failed to load conversations<br><br>Try refreshing the ChatGPT page and clicking the extension again.</div>`;
        exportBtn.disabled = true;
    }
}

// Display conversations with checkboxes for export
function displayConversationsForExport(conversations) {
    exportConversationsContainer.innerHTML = '';

    conversations.forEach((conv, index) => {
        const item = document.createElement('div');
        item.className = 'conversation-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `export-conv-${index}`;

        const convId = typeof conv === 'string' ? conv : conv.id;
        const convTitle = typeof conv === 'string' ? `Conversation ${index + 1}` : (conv.title || `Conversation ${index + 1}`);

        checkbox.value = convId;
        checkbox.addEventListener('change', updateExportSelectedCount);

        const label = document.createElement('label');
        label.className = 'conversation-text';
        label.htmlFor = `export-conv-${index}`;
        label.textContent = convTitle;
        label.style.cursor = 'pointer';
        label.title = convTitle;

        item.appendChild(checkbox);
        item.appendChild(label);

        item.addEventListener('click', (e) => {
            if (e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
                updateExportSelectedCount();
            }
        });

        exportConversationsContainer.appendChild(item);
    });
}

// Update selected count display
function updateSelectedCount() {
    const checked = document.querySelectorAll('#delete-tab input[type="checkbox"]:checked').length;
    const total = allConversations.length;

    if (checked === 0) {
        selectedCountDiv.style.display = 'none';
    } else {
        selectedCountDiv.style.display = 'block';
        selectedCountDiv.textContent = `${checked} of ${total} conversations selected`;
    }
}

// Update selected count display for export
function updateExportSelectedCount() {
    const checked = document.querySelectorAll('#export-tab input[type="checkbox"]:checked').length;
    const total = document.querySelectorAll('#export-tab .conversation-item').length;

    if (checked === 0) {
        exportSelectedCountDiv.style.display = 'none';
    } else {
        exportSelectedCountDiv.style.display = 'block';
        exportSelectedCountDiv.textContent = `${checked} of ${total} conversations selected`;
    }
}

// Select all conversations (delete tab)
selectAllBtn.addEventListener('click', () => {
    document.querySelectorAll('#delete-tab input[type="checkbox"]').forEach(cb => {
        cb.checked = true;
    });
    updateSelectedCount();
});

// Deselect all conversations (delete tab)
selectNoneBtn.addEventListener('click', () => {
    document.querySelectorAll('#delete-tab input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    updateSelectedCount();
});

// Select all conversations (export tab)
exportSelectAllBtn.addEventListener('click', () => {
    document.querySelectorAll('#export-tab input[type="checkbox"]').forEach(cb => {
        cb.checked = true;
    });
    updateExportSelectedCount();
});

// Deselect all conversations (export tab)
exportSelectNoneBtn.addEventListener('click', () => {
    document.querySelectorAll('#export-tab input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    updateExportSelectedCount();
});

// Refresh conversations (delete tab)
refreshBtn.addEventListener('click', async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await loadConversations(tab.id);
    } catch (error) {
        pageStatusDiv.className = 'status-box error';
        pageStatusDiv.textContent = `Refresh error: ${error.message}`;
    }
});

// Refresh conversations (export tab)
exportRefreshBtn.addEventListener('click', async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await loadConversationsForExport(tab.id);
    } catch (error) {
        exportPageStatusDiv.className = 'status-box error';
        exportPageStatusDiv.textContent = `Refresh error: ${error.message}`;
    }
});

// Delete selected conversations
deleteBtn.addEventListener('click', async () => {
    try {
        const selected = Array.from(document.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);

        if (selected.length === 0) {
            statusDiv.className = 'status-box error';
            statusDiv.textContent = 'Please select at least one conversation to delete';
            statusDiv.style.display = 'block';
            return;
        }

        // Confirm deletion
        const confirmed = confirm(`Are you sure you want to permanently delete ${selected.length} conversation(s)? This cannot be undone.`);
        if (!confirmed) {
            return;
        }
        isDeleting = true;
        deleteBtn.disabled = true;
        refreshBtn.disabled = true;
        selectAllBtn.disabled = true;
        selectNoneBtn.disabled = true;
        progressDiv.style.display = 'block';
        statusDiv.style.display = 'none';

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const total = selected.length;

        statusDiv.className = 'status-box';
        statusDiv.textContent = `Deleting ${total} conversation(s)...`;
        statusDiv.style.display = 'block';

        // Send all deletion requests in parallel (fire and forget)
        const deletionPromises = selected.map(conversationId => {
            return new Promise((resolve) => {
                chrome.tabs.sendMessage(
                    tab.id,
                    { action: 'deleteConversation', conversationId },
                    (response) => {
                        resolve(response);
                    }
                );
            });
        });

        // Wait for all deletions to complete
        await Promise.all(deletionPromises);

        // Remove all deleted items from display
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        selected.forEach(conversationId => {
            checkboxes.forEach((cb, idx) => {
                if (cb.value === conversationId) {
                    cb.parentElement.remove();
                    allConversations.splice(idx, 1);
                }
            });
        });

        statusDiv.className = 'status-box success';
        statusDiv.textContent = `✓ Successfully deleted ${total} conversation(s)! Refreshing page...`;
        pageStatusDiv.className = 'status-box success';
        pageStatusDiv.textContent = `✓ Deleted ${total} conversation(s) - Refreshing page...`;

        isDeleting = false;
        deleteBtn.disabled = false;
        refreshBtn.disabled = false;
        selectAllBtn.disabled = false;
        selectNoneBtn.disabled = false;
        progressDiv.style.display = 'none';
        updateSelectedCount();

        // Refresh the ChatGPT page to update the conversation list
        setTimeout(async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                chrome.tabs.reload(tab.id);
                console.log('[POPUP] ✓ Page refresh triggered');
            } catch (error) {
                console.error('[POPUP] Failed to refresh page:', error);
            }
        }, 1500);
    } catch (error) {
        statusDiv.className = 'status-box error';
        statusDiv.textContent = `Error: ${error.message}`;
        statusDiv.style.display = 'block';

        isDeleting = false;
        deleteBtn.disabled = false;
        refreshBtn.disabled = false;
        selectAllBtn.disabled = false;
        selectNoneBtn.disabled = false;
        progressDiv.style.display = 'none';
    }
});

// Update progress bar
function updateProgress(current, total) {
    const percentage = Math.round((current / total) * 100);
    progressFill.style.width = percentage + '%';
    progressFill.textContent = percentage + '%';
    progressText.textContent = `Deleted ${current} of ${total}...`;
}

// Create HTML content for a conversation
function createHtmlContent(conversation, imageCache) {
    const title = conversation.title || 'Conversation';
    const messages = conversation.messages || [];

    let htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
            color: #333;
        }
        h1 {
            text-align: center;
            color: #2c3e50;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
        }
        .message {
            background-color: white;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .role {
            font-weight: bold;
            color: #3498db;
            margin-bottom: 10px;
            text-transform: uppercase;
            font-size: 0.9em;
        }
        .role.user {
            color: #27ae60;
        }
        .role.assistant {
            color: #3498db;
        }
        .role.system {
            color: #e74c3c;
        }
        .text {
            white-space: pre-wrap;
            word-wrap: break-word;
            line-height: 1.6;
        }
        .images {
            margin-top: 15px;
        }
        .images img {
            max-width: 100%;
            height: auto;
            border-radius: 4px;
            margin: 5px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .images a {
            color: #3498db;
            text-decoration: none;
            font-weight: 500;
        }
        .images a:hover {
            text-decoration: underline;
        }
        .timestamp {
            text-align: center;
            color: #7f8c8d;
            margin: 20px 0;
            font-size: 0.9em;
        }
        .notice {
            background-color: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 4px;
            padding: 10px 15px;
            margin: 15px 0;
            color: #856404;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <h1>${escapeHtml(title)}</h1>
    <div class="notice">
        <strong>Note:</strong> If images or attachments are not displaying, make sure you've <strong>extracted the entire ZIP file</strong> before opening this HTML. Browsers cannot access files when viewing HTML directly from within a ZIP archive.
    </div>
    <div class="timestamp">Exported on ${new Date().toLocaleString()}</div>
`;

    messages.forEach((message, index) => {
        const roleClass = message.role.toLowerCase();
        htmlContent += `    <div class="message">
        <div class="role ${roleClass}">${escapeHtml(message.role)}</div>
`;

        if (message.text && message.text.trim()) {
            htmlContent += `        <div class="text">${escapeHtml(message.text)}</div>
`;
        }

        if (message.images && message.images.length > 0) {
            htmlContent += `        <div class="images">
`;
            message.images.forEach(attachment => {
                // Handle both old format (string) and new format (object)
                const fileId = typeof attachment === 'string' ? attachment : attachment.fileId;
                const fileName = typeof attachment === 'object' ? attachment.fileName : null;
                const mimeType = typeof attachment === 'object' ? attachment.mimeType : null;

                const filePath = imageCache.get(fileId);

                if (filePath) {
                    // Check if it's an image
                    const isImage = filePath.match(/\.(jpg|jpeg|png|gif|webp)$/i);

                    if (isImage) {
                        // Display image inline
                        htmlContent += `            <img src="attachments/${filePath}" alt="${escapeHtml(fileName || 'Attachment')}" loading="lazy">
`;
                    } else {
                        // Display as download link for non-image files
                        const displayName = fileName || filePath;
                        htmlContent += `            <p>📎 <a href="attachments/${filePath}" download="${filePath}">${escapeHtml(displayName)}</a></p>
`;
                    }
                } else {
                    // File couldn't be downloaded - provide helpful message
                    const displayName = fileName || fileId;
                    htmlContent += `            <p><em>⚠️ Attachment not available: ${escapeHtml(displayName)}</em><br>
                <small style="color: #666;">This file may need to be manually downloaded from the ChatGPT conversation. Try opening the PDF/document in ChatGPT first, then re-export to ensure it's loaded in the page.</small></p>
`;
                }
            });
            htmlContent += `        </div>
`;
        }

        htmlContent += `    </div>
`;
    });

    htmlContent += `</body>
</html>`;

    return htmlContent;
}

// HTML escape function to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Export selected conversations
exportBtn.addEventListener('click', async () => {
    try {
        const selected = Array.from(document.querySelectorAll('#export-tab input[type="checkbox"]:checked')).map(cb => cb.value);

        if (selected.length === 0) {
            exportStatusDiv.className = 'status-box error';
            exportStatusDiv.textContent = 'Please select at least one conversation to export';
            exportStatusDiv.style.display = 'block';
            return;
        }

        isExporting = true;
        exportBtn.disabled = true;
        exportRefreshBtn.disabled = true;
        exportSelectAllBtn.disabled = true;
        exportSelectNoneBtn.disabled = true;
        exportProgressDiv.style.display = 'block';
        exportStatusDiv.style.display = 'none';

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const total = selected.length;

        exportStatusDiv.className = 'status-box';
        exportStatusDiv.textContent = `Exporting ${total} conversation(s)...`;
        exportStatusDiv.style.display = 'block';

        // Fetch conversation contents
        const conversations = [];
        for (let i = 0; i < selected.length; i++) {
            const conversationId = selected[i];
            try {
                const result = await new Promise((resolve) => {
                    chrome.tabs.sendMessage(
                        tab.id,
                        { action: 'getConversationContent', conversationId },
                        (response) => {
                            resolve(response);
                        }
                    );
                });

                if (result && result.success) {
                    conversations.push({
                        id: conversationId,
                        title: result.title || `Conversation_${i + 1}`,
                        messages: result.messages || [],
                        imageUrls: result.imageUrls || []
                    });
                }
            } catch (error) {
                console.error(`[EXPORT] Failed to get content for conversation ${conversationId}:`, error);
            }

            // Update progress
            const percentage = Math.round(((i + 1) / total) * 50); // First 50% for fetching content
            exportProgressFill.style.width = percentage + '%';
            exportProgressFill.textContent = percentage + '%';
            exportProgressText.textContent = `Fetched ${i + 1} of ${total}...`;
        }

        // Create ZIP using JSZip
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip library not loaded. Please reload the extension.');
        }

        const zip = new JSZip();
        const imageCache = new Map(); // Cache downloaded images to avoid duplicates
        let downloadedImages = 0;

        // Group files by conversation ID for efficient navigation
        const filesByConversation = new Map(); // conversationId -> [{fileId, fileName, mimeType}]
        conversations.forEach(conv => {
            conv.messages.forEach(msg => {
                if (msg.images && Array.isArray(msg.images)) {
                    msg.images.forEach(img => {
                        const fileId = typeof img === 'string' ? img : img.fileId;
                        const conversationId = typeof img === 'object' ? img.conversationId : conv.id;

                        if (fileId && conversationId) {
                            if (!filesByConversation.has(conversationId)) {
                                filesByConversation.set(conversationId, []);
                            }

                            // Check if file already added for this conversation
                            const convFiles = filesByConversation.get(conversationId);
                            if (!convFiles.find(f => f.fileId === fileId)) {
                                convFiles.push({
                                    fileId: fileId,
                                    fileName: typeof img === 'object' ? img.fileName : null,
                                    mimeType: typeof img === 'object' ? img.mimeType : null,
                                    conversationId: conversationId
                                });
                            }
                        }
                    });
                }
            });
        });

        // Count total files
        let totalImages = 0;
        for (const files of filesByConversation.values()) {
            totalImages += files.length;
        }

        console.log(`[EXPORT] Downloading ${totalImages} file(s) from ${filesByConversation.size} conversation(s)...`);

        if (totalImages > 0) {
            // Navigate to each conversation and download its files
            let conversationIndex = 0;
            for (const [conversationId, files] of filesByConversation) {
                conversationIndex++;

                // Navigate to this conversation using chrome.tabs.update (doesn't break popup connection)
                exportProgressText.textContent = `Loading conversation ${conversationIndex}/${filesByConversation.size}...`;

                try {
                    // Navigate to the conversation
                    await chrome.tabs.update(tab.id, {
                        url: `https://chatgpt.com/c/${conversationId}`
                    });

                    // Wait for page to load
                    await new Promise((resolve) => {
                        const listener = (tabId, changeInfo) => {
                            if (tabId === tab.id && changeInfo.status === 'complete') {
                                chrome.tabs.onUpdated.removeListener(listener);
                                resolve();
                            }
                        };
                        chrome.tabs.onUpdated.addListener(listener);

                        // Timeout after 10 seconds
                        setTimeout(() => {
                            chrome.tabs.onUpdated.removeListener(listener);
                            resolve();
                        }, 10000);
                    });

                    // Re-inject content script after navigation
                    try {
                        await chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ['content-script.js']
                        });
                    } catch (e) {
                        // May already be injected
                    }

                    // Wait for content script to initialize
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    // Now download all files from this conversation
                    for (const fileMetadata of files) {
                        try {
                            exportProgressText.textContent = `Downloading files (${downloadedImages + 1}/${totalImages})...`;

                            const result = await new Promise((resolve, reject) => {
                                chrome.tabs.sendMessage(
                                    tab.id,
                                    {
                                        action: 'downloadImage',
                                        fileId: fileMetadata.fileId,
                                        fileName: fileMetadata.fileName,
                                        conversationId: fileMetadata.conversationId
                                    },
                                    (response) => {
                                        if (chrome.runtime.lastError) {
                                            reject(chrome.runtime.lastError);
                                        } else if (response && response.success) {
                                            resolve(response);
                                        } else {
                                            reject(new Error(response?.error || 'Failed to download file'));
                                        }
                                    }
                                );
                            });

                            if (result.dataArray && result.filename) {
                                // Convert Array back to Uint8Array then to Blob
                                const uint8Array = new Uint8Array(result.dataArray);
                                const blob = new Blob([uint8Array], { type: result.mimeType || 'application/octet-stream' });

                                imageCache.set(fileMetadata.fileId, result.filename);
                                zip.file(`attachments/${result.filename}`, blob);
                                downloadedImages++;

                                // Update progress (50-80% range for files)
                                const percentage = 50 + Math.round((downloadedImages / totalImages) * 30);
                                exportProgressFill.style.width = percentage + '%';
                                exportProgressFill.textContent = percentage + '%';
                            }
                        } catch (error) {
                            const displayName = fileMetadata.fileName || fileMetadata.fileId;
                            console.warn(`[EXPORT] ⚠️ Skipped "${displayName}": ${error.message}`);
                        }
                    }
                } catch (error) {
                    console.warn(`[EXPORT] ⚠️ Failed to load conversation ${conversationId}: ${error.message}`);
                }
            }

            console.log(`[EXPORT] Downloaded ${downloadedImages} of ${totalImages} file(s)`);
        }

        exportProgressText.textContent = `Creating HTML files...`;

        // Create HTML files for each conversation
        conversations.forEach((conv, index) => {
            const filename = `${conv.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
            const htmlContent = createHtmlContent(conv, imageCache);
            zip.file(filename, htmlContent);

            // Update progress (80-90% range for HTML creation)
            const percentage = 80 + Math.round(((index + 1) / conversations.length) * 10);
            exportProgressFill.style.width = percentage + '%';
            exportProgressFill.textContent = percentage + '%';
        });

        exportProgressText.textContent = `Generating ZIP file...`;
        exportProgressFill.style.width = '95%';
        exportProgressFill.textContent = '95%';

        // Log ZIP contents before generating
        console.log('[EXPORT] ========== ZIP FILE CONTENTS ==========');
        const zipFiles = [];
        zip.forEach((relativePath, file) => {
            zipFiles.push(relativePath);
        });
        console.log('[EXPORT] Files in ZIP:', zipFiles);
        console.log('[EXPORT] Total files in ZIP:', zipFiles.length);
        console.log('[EXPORT] ==========================================');

        // Generate ZIP file
        const blob = await zip.generateAsync({ type: 'blob' });
        console.log('[EXPORT] ZIP blob generated, size:', blob.size, 'bytes');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ChatGPT_Export_${new Date().toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        exportProgressFill.style.width = '100%';
        exportProgressFill.textContent = '100%';

        exportStatusDiv.className = 'status-box success';
        exportStatusDiv.textContent = `✓ Successfully exported ${total} conversation(s)!`;
        exportPageStatusDiv.className = 'status-box success';
        exportPageStatusDiv.textContent = `✓ Exported ${total} conversation(s)!`;

        isExporting = false;
        exportBtn.disabled = false;
        exportRefreshBtn.disabled = false;
        exportSelectAllBtn.disabled = false;
        exportSelectNoneBtn.disabled = false;
        exportProgressDiv.style.display = 'none';
        updateExportSelectedCount();

    } catch (error) {
        exportStatusDiv.className = 'status-box error';
        exportStatusDiv.textContent = `Error: ${error.message}`;
        exportStatusDiv.style.display = 'block';

        isExporting = false;
        exportBtn.disabled = false;
        exportRefreshBtn.disabled = false;
        exportSelectAllBtn.disabled = false;
        exportSelectNoneBtn.disabled = false;
        exportProgressDiv.style.display = 'none';
    }
});
