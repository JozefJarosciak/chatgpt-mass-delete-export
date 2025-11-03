# ChatGPT Mass Delete/Export Chats

A powerful Chrome extension to manage your ChatGPT conversations efficiently. Delete multiple conversations in bulk or export them to ZIP files for backup.

## Features

### 🗑️ Delete Tab
- **Bulk Delete**: Select and delete multiple ChatGPT conversations at once
- **Fast API Method**: Conversations deleted in ~50-100ms using ChatGPT's backend API
- **UI Fallback**: Automatic fallback to UI simulation if API method fails
- **Auto Refresh**: Page automatically refreshes after deletion to update conversation list
- **Parallel Processing**: All deletions run in parallel for maximum speed
- **Smart Selection**: Select all, select none, or individually toggle conversations

### 📦 Export Tab
- **Batch Export**: Export multiple conversations to a single ZIP file
- **Full Content**: Includes all messages (user and assistant) from each conversation
- **Organized Format**: Each conversation saved as a separate text file with formatted content
- **Auto-Download**: ZIP file automatically downloads with timestamp: `ChatGPT_Export_YYYY-MM-DD.zip`
- **Smart Fallback**: API retrieval with DOM extraction fallback for reliability

## Installation

1. **Clone or download** this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the `gpt-cleaner` folder
6. Extension appears in your Chrome menu!

## Usage

### Delete Conversations
1. Open ChatGPT (https://chatgpt.com)
2. Click the extension icon
3. Click the **Delete** tab (default)
4. Select conversations you want to delete using checkboxes
5. Click **"Delete Selected"**
6. Confirm the deletion
7. Page automatically refreshes after completion

### Export Conversations
1. Open ChatGPT (https://chatgpt.com)
2. Click the extension icon
3. Click the **Export** tab
4. Select conversations you want to export
5. Click **"Export as ZIP"**
6. Wait for the progress bar to complete
7. ZIP file automatically downloads
8. Extract to access all conversations as text files

## Technical Details

### How It Works

#### Delete Method
- **Primary**: ChatGPT backend API (`/backend-api/conversation/{id}`)
  - Sends PATCH request with `{is_visible: false}`
  - Speed: 50-100ms per conversation
  - Requires valid authentication token

- **Fallback**: UI-based deletion via DOM automation
  - Simulates right-click menu interaction
  - Clicks "Delete" button
  - Speed: 500-800ms per conversation
  - Works even if API fails

#### Export Method
- **Retrieves content** from ChatGPT API (`/backend-api/conversation/{id}`)
- **Extracts** all messages with role (USER/ASSISTANT)
- **Formats** with separators for readability
- **Packages** into ZIP using JSZip library
- **Auto-downloads** with date timestamp

#### Authentication
- **Token Capture**: Automatically captures auth token from `/api/auth/session`
- **Proactive Capture**: Runs multiple times on page load
- **Event-Driven**: Also triggered by user interactions
- **Fallback Methods**: Cookie extraction and storage checking if needed

### Files Included

- `manifest.json` - Extension configuration
- `popup.html` - User interface with tabbed design
- `popup.js` - Tab switching and export logic
- `content-script.js` - Token capture and deletion logic
- `background.js` - Background service worker for API calls
- `icon-*.png` - Extension icons (16x16, 32x32, 48x48, 128x128)
- `jszip.min.js` - ZIP file creation library

## Permissions

This extension requires:
- `activeTab` - To access the active ChatGPT tab
- `scripting` - To inject content script
- Host permissions for `https://chatgpt.com/*` and `https://chat.openai.com/*`

The extension **only** communicates with ChatGPT servers. No data is sent elsewhere.

## Performance

### Deletion Speed
- **API Method**: ~50-100ms per conversation
- **UI Fallback**: ~500-800ms per conversation
- **Batch Processing**: All deletions run in parallel
- **Example**: 10 conversations deleted in ~1 second with API method

### Export Speed
- **Single Conversation**: ~500-800ms
- **10 Conversations**: ~5-8 seconds
- **Speed depends on**: Conversation size and content complexity

## Security & Privacy

✅ **No data sent to external services**

✅ **All processing happens locally in your browser**

✅ **Authentication tokens not stored**

✅ **No server-side storage or logging**

✅ **No tracking or analytics**

## Requirements

- Chrome 88+ (Manifest V3 support)
- Active ChatGPT account
- Internet connection

## Troubleshooting

### Token Not Captured?
- Refresh the ChatGPT page
- Send a message in ChatGPT (forces authentication)
- Wait 2-3 seconds before opening extension

### API Deletion Failing?
- Check if you're logged into ChatGPT
- Try refreshing the page
- UI fallback will automatically activate

### Export Not Working?
- Ensure conversations have content
- Check browser console for errors
- Verify you have write permissions for downloads

## Known Limitations

- Requires being on ChatGPT page to function
- Batch deletion speed depends on internet connection
- Export file size limited by available disk space
- Conversations must be accessible in your account

## Future Improvements

- [ ] Selective deletion (by date, title pattern)
- [ ] Export to different formats (JSON, CSV, PDF)
- [ ] Schedule automatic cleanup
- [ ] Conversation filtering and search
- [ ] Custom export templates

## Support

For issues or feature requests:
- Contact: jarosciak@gmail.com

## License

MIT License - Free to use and modify

---

**Version**: 1.0.0
**Author**: jarosciak@gmail.com
**Last Updated**: November 2024
