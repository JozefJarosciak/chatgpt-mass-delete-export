# ChatGPT Mass Delete/Export Chats

A Chrome extension to manage your ChatGPT conversations efficiently. Delete multiple conversations in bulk or export them to ZIP files for backup.

## Screenshot

<img width="1343" height="715" alt="image" src="https://github.com/user-attachments/assets/bcfe9151-b5a8-4d4a-b68f-a54872b96757" />


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
- **HTML Format**: Each conversation saved as a styled HTML file for better readability
- **Full Content**: Includes all messages (user and assistant) from each conversation
- **Attachment Support**: Downloads and embeds images, PDFs, and documents from conversations
  - ✅ Images (PNG, JPG, GIF, WebP) - Displayed inline in HTML
  - ✅ PDFs and Documents - Linked for download
  - Automatically detects file types using magic numbers
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
   - The extension will automatically navigate through conversations with attachments
   - This ensures all images and files are properly loaded and downloaded
7. ZIP file automatically downloads
8. **Extract the entire ZIP folder** to a location on your computer
9. Open the HTML files from the extracted folder to view conversations with images and attachments

**Note**: Images and attachments must be extracted from the ZIP before opening HTML files. Browsers cannot access files directly inside ZIP archives.

Export Screenshot:

<img width="610" height="213" alt="image" src="https://github.com/user-attachments/assets/8876db33-1f0c-4f8f-83b1-f180282d55ec" />


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
- **Automatic Navigation**: For conversations with attachments, navigates to each conversation to load files in the DOM
- **File Download**: Extracts authenticated file URLs with signature parameters from loaded page
- **Formats** with separators for readability in styled HTML
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
- `tabs` - To navigate between conversations during export
- Host permissions for `https://chatgpt.com/*` and `https://chat.openai.com/*`

The extension **only** communicates with ChatGPT servers. No data is sent elsewhere.

## Performance

### Deletion Speed
- **API Method**: ~50-100ms per conversation
- **UI Fallback**: ~500-800ms per conversation
- **Batch Processing**: All deletions run in parallel
- **Example**: 10 conversations deleted in ~1 second with API method

### Export Speed
- **Single Conversation (no attachments)**: ~500-800ms
- **Single Conversation (with attachments)**: ~5-10 seconds (includes page navigation and file loading)
- **Multiple Conversations**: 5-10 seconds per conversation with attachments
- **Speed depends on**: Conversation size, number of attachments, and page load time

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
- Be patient - the extension navigates through each conversation with attachments (this is normal)
- Don't close the popup or switch tabs during export
- Check browser console for errors
- Verify you have write permissions for downloads

## Known Limitations

- Requires being on ChatGPT page to function
- Batch deletion speed depends on internet connection
- Export with attachments is slower due to automatic page navigation (5-10 seconds per conversation with files)
- Export file size limited by available disk space
- Conversations must be accessible in your account
- Do not close the popup or navigate away during export

## Future Improvements

- [ ] Selective deletion (by date, title pattern)
- [ ] Export to different formats (JSON, CSV, PDF)
- [ ] Schedule automatic cleanup
- [ ] Conversation filtering and search
- [ ] Custom export templates

## Support

For issues or feature requests use https://github.com/JozefJarosciak/chatgpt-mass-delete-export/issues

## License

MIT License - Free to use and modify

---

**Version**: 1.0.0
**Last Updated**: November 2025