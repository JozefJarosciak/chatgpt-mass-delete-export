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
                        content: result.content || ''
                    });
                }
            } catch (error) {
                console.error(`[EXPORT] Failed to get content for conversation ${conversationId}:`, error);
            }

            // Update progress
            const percentage = Math.round(((i + 1) / total) * 100);
            exportProgressFill.style.width = percentage + '%';
            exportProgressFill.textContent = percentage + '%';
            exportProgressText.textContent = `Fetched ${i + 1} of ${total}...`;
        }

        // Create ZIP using JSZip
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip library not loaded. Please reload the extension.');
        }

        const zip = new JSZip();
        conversations.forEach((conv, index) => {
            const filename = `${conv.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
            zip.file(filename, conv.content);
        });

        // Generate ZIP file
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ChatGPT_Export_${new Date().toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

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
