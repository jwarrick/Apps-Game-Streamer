# Google Apps Script Setup: Direct Resumable Uploads

This upgrade transforms your Apps Script into a **Session Broker**. The video files bypass Apps Script entirely and stream directly from the browser to Google Drive in **1 MB binary chunks**, completely eliminating the 50 MB limit and 60-second timeouts.

---

### Step-by-Step Instructions

1. Open your Google Apps Script project:
   - Go to [script.google.com](https://script.google.com) and open your `GameStreamer Mail Slot` project.

2. Replace `Code.gs`:
   - Open `Code.gs` in the editor.
   - Replace its entire contents with the code inside [`apps_script/Code.gs`](file:///Users/jaywarrick/Documents/GitHub/GameStreamer/apps_script/Code.gs).

3. (Optional) Enable Drive Scopes in `appsscript.json`:
   - Click the **Gear icon (Project Settings)** on the left sidebar.
   - Check the box for **"Show 'appsscript.json' manifest file in editor"**.
   - Return to the **Editor (< >)** tab, click on `appsscript.json`, and make sure the `oauthScopes` includes:
     ```json
     "oauthScopes": [
       "https://www.googleapis.com/auth/drive",
       "https://www.googleapis.com/auth/script.external_request"
     ]
     ```

4. Deploy the New Version:
   - In the top right corner, click **Deploy > Manage deployments**.
   - Click the **Pencil icon (Edit)** next to your active Web App deployment.
   - Under **Version**, select **New version**.
   - Ensure:
     - **Execute as**: `Me`
     - **Who has access**: `Anyone`
   - Click **Deploy**.

---

### How GameStreamer Handles This Automatically:
- GameStreamer automatically detects the new `createResumableUpload` capability.
- As soon as the new deployment is active, all uploads automatically stream directly to Google Drive via 1 MB binary chunks.
- If the script is ever rolled back or during the update period, GameStreamer automatically falls back to standard mode so nothing ever breaks.
