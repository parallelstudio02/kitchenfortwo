# Kitchen for Two — Setup Guide

Two parts: put the app on GitHub so it has a permanent link, then connect the Google Sheet so recipes are shared and saved for good. The app already works with sample recipes even before part 2 is done.

## Part 1: Put it on GitHub Pages (free hosting, nothing needs to run on your computer)

1. Go to github.com and log in (or create a free account).
2. Click the + in the top right, choose "New repository".
3. Name it something like `kitchen-for-two`. Keep it Public. Do not add a README (we already have the files).
4. Click "Create repository".
5. On the new repo page, click "uploading an existing file".
6. Drag in these five files: `index.html`, `style.css`, `app.js`, `config.js`, `Code.gs` (Code.gs is just kept for reference, it is not part of the website itself, but fine to upload).
7. Click "Commit changes".
8. Go to Settings (top of the repo) > Pages (left sidebar).
9. Under "Build and deployment", set Source to "Deploy from a branch", Branch to `main`, folder `/ (root)`. Click Save.
10. Wait about a minute, then refresh. GitHub will show a link like `https://yourusername.github.io/kitchen-for-two/`. That is the permanent app link for both of you, works on phone and desktop.

## Part 2: Connect the Google Sheet (so recipes are shared and permanent)

1. Go to sheets.google.com, create a new blank sheet.
2. Rename the first tab (bottom left) to exactly: `Recipes`
3. In row 1, type these headers exactly, one per column: `id`, `name`, `cuisine`, `recipeText`, `ingredients`, `notes`, `lastCooked`
4. Go to Extensions > Apps Script.
5. Delete anything in the editor, paste in the contents of `Code.gs` (included here).
6. Click Deploy > New deployment.
7. Click the gear icon next to "Select type", choose "Web app".
8. Set "Execute as" to Me, and "Who has access" to Anyone. (This does not make your recipes public to strangers, it just means the link itself does not force a Google login popup for you and Amethyst. Nobody can find this link unless you share it.)
9. Click Deploy. Google may ask you to authorize it, since it is your own script touching your own sheet, that is normal, click through Authorize.
10. Copy the Web app URL it gives you (looks like `https://script.google.com/macros/s/.../exec`).
11. Open `config.js` in your GitHub repo, click the pencil/edit icon, replace `PASTE_YOUR_APPS_SCRIPT_URL_HERE` with the URL you copied, keeping the quote marks. Commit changes.
12. Refresh the app link from Part 1. It should now load from the Sheet instead of the sample recipes, and anything either of you saves will show up in the Sheet.

## Notes

- Both of you open the same app link, so you are both reading and writing the same Google Sheet automatically.
- If you ever want to edit a recipe directly, you can also just edit it in the Google Sheet itself, it will show up in the app.
- Logging a recipe with a name that already exists overwrites that recipe rather than creating a duplicate, this is intentional so the notes field always reflects the latest version.
- If the app ever shows "Could not reach the Google Sheet", double check the URL in `config.js` and that "Who has access" is still set to Anyone.
- If Code.gs is ever updated after you already deployed it once (for example, when delete support was added), go back to Deploy > Manage deployments > pencil/edit icon > select "New version" > Deploy, so the live link picks up the change. You do not need a new URL or to touch config.js again for this.
