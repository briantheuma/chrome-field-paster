# Field Paster

A Chrome extension for storing commonly used text values and copying them to your clipboard with a single click. Fully customisable — add, remove, reorder, and rename any field you like.

---

## Features

- **One-click copy** — click any field to instantly copy its value to the clipboard
- **Fully editable fields** — add, rename, reorder, or delete any field
- **Drag to reorder** — grab the grip handle in edit mode to rearrange fields
- **Export / Import** — transfer your fields between computers as a JSON file
- **Auto dark/light theme** — follows your system appearance setting
- **Synced storage** — fields are stored in Chrome's sync storage, so they follow you across devices when signed into Chrome

---

## Installation

This extension is not on the Chrome Web Store. Load it manually as an unpacked extension.

1. Clone or download this repository
   ```
   git clone https://github.com/briantheuma/chrome-field-paster.git
   ```

2. Open Chrome and go to `chrome://extensions`

3. Enable **Developer mode** using the toggle in the top-right corner

4. Click **Load unpacked** and select the `field-paster` folder

5. The Field Paster icon will appear in your Chrome toolbar — click the puzzle piece icon and pin it for easy access

---

## Usage

### Copying a field

Click any field in the popup to copy its value to the clipboard. A "Copied!" badge appears on the field and a toast notification confirms the action.

### Editing fields

1. Click the **pencil icon** in the top-right of the popup to enter edit mode
2. Edit any label or value by clicking directly on the text
3. Click **Save** to persist your changes, or **Cancel** to discard them

### Adding a field

In edit mode, click **+ Add Field** at the bottom of the list. A new empty row is added — fill in the label (e.g. "LinkedIn URL") and the value.

### Removing a field

In edit mode, click the **×** button on the right side of any row.

### Reordering fields

In edit mode, grab the **grip handle** (⠿) on the left side of any row and drag it up or down. A blue line shows where the field will be dropped.

---

## Export & Import

Use this to back up your fields or move them to another computer.

### Export

1. Open the popup and click the **pencil icon** to enter edit mode
2. Click **Export JSON**
3. A file named `field-paster.json` will be downloaded

### Import

1. Open the popup and click the **pencil icon** to enter edit mode
2. Click **Import JSON** and select a `field-paster.json` file
3. The fields are loaded into the editor — click **Save** to apply them

> **Note:** Importing replaces all current fields. Export first if you want to keep a backup.

### JSON format

The exported file is a plain JSON array. You can edit it manually if needed:

```json
[
  { "id": "f1", "label": "Portfolio URL", "value": "https://yoursite.com" },
  { "id": "f2", "label": "LinkedIn URL", "value": "https://linkedin.com/in/yourname" },
  { "id": "f3", "label": "Address", "value": "123 Main St, City, Country" },
  { "id": "f4", "label": "Email", "value": "you@example.com" },
  { "id": "f5", "label": "Phone", "value": "+1 555 000 0000" }
]
```

The `id` field is optional when importing — one will be generated automatically if missing.

---

## Updating the extension

After pulling new changes from the repo:

1. Go to `chrome://extensions`
2. Find Field Paster and click the **refresh icon**

---

## Project structure

```
field-paster/
├── manifest.json   # Chrome extension manifest (v3)
├── popup.html      # Popup markup
├── popup.css       # Styles (light + dark theme)
└── popup.js        # All extension logic
```

No build step required — plain HTML, CSS, and JavaScript.

---

## Development

Edit any of the four files directly. After saving changes, reload the extension in `chrome://extensions` by clicking the refresh icon on the Field Paster card.

The extension uses:
- **Manifest V3** — the current Chrome extension standard
- **`chrome.storage.sync`** — persists fields and syncs them across Chrome sign-in devices
- **`navigator.clipboard`** — used for copying values; falls back to `execCommand` if unavailable
- **HTML5 Drag and Drop API** — handles field reordering in edit mode
