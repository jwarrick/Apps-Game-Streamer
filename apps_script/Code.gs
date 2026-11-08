// ============================================================================
// GameStreamer Google Drive Mail Slot (v2 - Direct Resumable Chunking)
// Deploy as: Web App
// Execute as: Me (Your Google Account)
// Who has access: Anyone
// ============================================================================

var ROOT_FOLDER_NAME = 'VideoArchive';

function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : null;
  var fileId = e && e.parameter ? e.parameter.fileId : null;

  if (action === 'download' && fileId) {
    try {
      var file = DriveApp.getFileById(fileId);
      var blob = file.getBlob();
      return ContentService.createTextOutput(blob.getBytes())
        .setMimeType(ContentService.MimeType.OCTET_STREAM);
    } catch (err) {
      return jsonResponse({ success: false, error: err.message });
    }
  }

  return ContentService.createTextOutput('SUCCESS: Mail slot is online! Direct Resumable Uploads enabled.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: 'Empty POST body' });
    }

    var payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonResponse({ success: false, error: 'Invalid JSON body: ' + parseErr.message });
    }

    var action = payload.action;

    // ------------------------------------------------------------------------
    // Action 1: Create Resumable Upload Session (Direct Chunking to Google Drive)
    // ------------------------------------------------------------------------
    if (action === 'createResumableUpload') {
      var filename = payload.filename || 'Highlight.mp4';
      var mimeType = payload.mimeType || 'video/mp4';
      var fileSize = payload.fileSize || 0;
      var matchFolder = payload.matchFolder || 'Unsorted';

      var folderId = getOrCreateMatchFolderId(matchFolder);

      var token = ScriptApp.getOAuthToken();
      var initUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true';

      var metadata = {
        name: filename,
        mimeType: mimeType,
        parents: [folderId],
        description: 'Uploaded via GameStreamer Live'
      };

      var res = UrlFetchApp.fetch(initUrl, {
        method: 'post',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': mimeType,
          'X-Upload-Content-Length': String(fileSize)
        },
        payload: JSON.stringify(metadata),
        muteHttpExceptions: true
      });

      var headers = res.getHeaders();
      var uploadUrl = headers['Location'] || headers['location'];

      if (!uploadUrl) {
        return jsonResponse({
          success: false,
          error: 'Failed to initiate resumable session: HTTP ' + res.getResponseCode() + ' ' + res.getContentText()
        });
      }

      return jsonResponse({
        success: true,
        uploadUrl: uploadUrl,
        folderId: folderId,
        filename: filename
      });
    }

    // ------------------------------------------------------------------------
    // Action 2: Legacy Monolithic Base64 Upload (Backward-compatible fallback)
    // ------------------------------------------------------------------------
    if (payload.base64) {
      var matchFolder = payload.matchFolder || 'Unsorted';
      var filename = payload.filename || 'Highlight.mp4';
      var mimeType = payload.mimeType || 'video/mp4';
      var base64Data = payload.base64;

      var folderId = getOrCreateMatchFolderId(matchFolder);
      var folder = DriveApp.getFolderById(folderId);

      var decodedBytes = Utilities.base64Decode(base64Data);
      var blob = Utilities.newBlob(decodedBytes, mimeType, filename);
      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      return jsonResponse({
        success: true,
        fileId: file.getId(),
        filename: file.getName(),
        webViewLink: file.getUrl(),
        downloadUrl: 'https://drive.google.com/uc?export=download&id=' + file.getId()
      });
    }

    return jsonResponse({ success: false, error: 'Unrecognized action or missing payload' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function getOrCreateMatchFolderId(matchFolderName) {
  var root = getOrCreateRootFolder();
  var subfolders = root.getFoldersByName(matchFolderName);
  if (subfolders.hasNext()) {
    return subfolders.next().getId();
  }
  var newSub = root.createFolder(matchFolderName);
  newSub.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return newSub.getId();
}

function getOrCreateRootFolder() {
  var roots = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  if (roots.hasNext()) {
    return roots.next();
  }
  var newRoot = DriveApp.createFolder(ROOT_FOLDER_NAME);
  newRoot.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return newRoot;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
