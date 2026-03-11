# Mewgenics Breeding Planner

A small Flask app for managing Mewgenics cat rows, parsing cat screenshots, and generating structured breeding recommendations with the OpenAI API. The planner also supports user-managed skill mappings so screenshot parsing can normalize new mutation wording into consistent tokens.

## Requirements

- Python 3.10+
- An OpenAI API key for screenshot parsing and planner recommendation features

## Get An OpenAI API Key

1. Sign in or create an account on the OpenAI Developer Platform.
2. Open the API keys page and create a new secret key.
3. Open the billing page, add a payment method, and add credits or configure billing.
4. Put the key in your local `.env` file.

Links:
- API keys: `https://platform.openai.com/api-keys`
- Developer quickstart: `https://platform.openai.com/docs/quickstart`
- Billing: `https://platform.openai.com/settings/organization/billing/overview`

Important:
- This project uses the OpenAI API, not just the ChatGPT web app.
- When you run this app locally - the key will only be used on your local environment
- DO NOT SHARE, COMMIT, OR POST YOUR API KEY ANYWHERE

## Cost Warning

Only the OpenAI-powered features cost money:
- Parsing a screenshot
- Running a recommendation
- Sending a follow-up recommendation request

All other features are local and do not cost money, including:
- importing spreadsheet rows
- editing cat rows
- moving, deleting, dragging, and undoing rows
- changing planner customization fields
- storing cat data in browser storage

Rough cost estimates for the current codebase are:
- Screenshot parse: about `$0.005` to `$0.015` per image
- Recommendation run: about `$0.01` to `$0.04` per analysis
- Follow-up recommendation: usually about `$0.01` to `$0.05` each

These are estimates, not fixed prices. Actual cost depends on:
- the current model price
- screenshot size and image detail level
- how many cat rows you send
- how long the model's response is

If you want tighter cost control, set OpenAI billing limits and keep an eye on your usage dashboard.


## Install

1. If you do not already have Python installed, download it from the official Python site:

- Python downloads: `https://www.python.org/downloads/`

On Windows:
- Download a current Python 3 release
- Run the installer
- Make sure `Add python.exe to PATH` is checked during installation

After installation, open a new PowerShell window and verify it:

```powershell
python --version
pip --version
```

2. Create and activate a virtual environment.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

3. Install dependencies.

```powershell
pip install -r requirements.txt
```

4. Create your local environment file from the template.

```powershell
Copy-Item .env.example .env
```

5. Edit `.env` and set your real API key.

```env
OPENAI_API_KEY=your_real_openai_api_key
```

If you do not set a valid API key:
- the app still starts
- spreadsheet import and local cat editing still work
- screenshot parsing is locked
- ChatGPT planner recommendation is locked

## Run

Start the Flask server from the project root:

```powershell
python server.py
```

The app runs on `http://localhost:5000`.

Useful routes:
- `/` redirects to the planner
- `/planner` opens the breeding planner UI
- `/parse` accepts an image upload for cat-row extraction
- `/analyze` generates planner recommendations
- `/analyze-followup` continues the recommendation flow with follow-up input
- `/openai-status` reports whether GPT-powered features are currently available

## How To Use

### 1. Open the planner

Go to http://localhost:5000/planner.

### 2. Add cat data

You can add cats in two ways:
- Paste spreadsheet rows into Import Excel Data, then click Save to Browser Data
- Click Add Cat and either fill out the fields manually or paste/upload a screenshot for parsing

Expected import format:
- Tab-separated rows
- 25 columns per cat
- Optional room labels such as A, B, C, D, Room A, and similar variants

### 3. Review and organize current cats

After saving data, Current Cat Rows shows the cats stored in browser storage. From there you can:
- Edit cells inline
- Move cats between rooms
- Drag to reorder rows or move them between rooms
- Delete cats
- Undo recent row actions
- See inline red highlights on invalid mutation cells that need correction before analysis

### 4. Customize recommendation inputs

Inside ChatGPT Planner Recommendation, you can expand and change:
- Mutation priority order
- Room A focus
- Room B focus
- Room C focus
- Room D focus

If you leave those fields alone, the app uses the backend defaults.

You can also maintain Skill Mapping entries there. Each row contains:
- Original screenshot text
- Mapped token

Example mappings:
- `10% chance to reflect projectiles => reflect`
- `Your basic attack inflicts Leech => leech`

This is useful when the screenshot parser encounters wording that is not already part of the built-in mutation dictionary. Keeping this list updated helps make future parses more consistent.

### 5. Analyze cats

Click Analyze Cats to send the normalized cat data and planner settings to the backend. The response is streamed live first, then rendered into structured sections such as:
- Summary
- Recommended Trims
- Potential Trims
- Move
- Planner Follow-up, if the model asks for more input

### 6. Continue with follow-up requests

If the planner returns a follow-up prompt, type your response in the follow-up box and submit it. The app will send the previous analysis back along with your reply so the response stays in the same structure.

## Notes

- Cat rows are stored in browser localStorage, not in a database.
- Screenshot parsing and planner analysis both require a valid OpenAI API key.
- If the API key is missing or invalid, GPT-powered sections are visually locked and disabled in the UI.
- Pasting an image into the page will only auto-start screenshot parsing when GPT features are available.
- The optional /save endpoint in the screenshot parser appends rows to cats.csv, which is ignored by git.
- This is a fan-made tool and is not affiliated with or endorsed by Mewgenics or its creators.
