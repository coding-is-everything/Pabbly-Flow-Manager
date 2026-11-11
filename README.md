# Pabbly Flow Manager

An internal web app that keeps a record of every Pabbly Connect flow your team runs:

- **Every flow** with its Pabbly link, webhook URL, folder, status, owner, tags and notes
- **The full step tree:** trigger → actions → **routers → routes (with conditions) → their own steps**. Routers can sit inside routes to any depth, and steps are numbered like `3.2.1` so people can refer to them.
- **Login with roles** (Admin / Editor / Viewer), search across all flows and steps, CSV import, JSON backup, and a history of who changed what

Stack: **React + Vite + TypeScript + Tailwind** (frontend), **Express + MySQL** (API), deployed as **one Vercel project**.

> The app doesn't connect to Pabbly. Pabbly has no public API for listing workflows, so this is your team's documented copy of your flows. Deleting something here never changes anything in Pabbly.

---

## What's in the project

| Path | What it does |
|---|---|
| `src/` | React frontend |
| `src/pages/` | One file per screen: `DashboardPage`, `FlowsPage`, `FlowDetailPage`, `SearchPage`, `ImportExportPage`, `UsersPage`, `ActivityPage`, `AccountPage`, `LoginPage` |
| `src/components/StepTree.tsx` | Draws the step tree (routers, routes, nested steps) |
| `src/components/StepFormModal.tsx` | Add / edit step form |
| `src/components/FlowFormModal.tsx` | Add / edit flow form |
| `src/lib/constants.ts` | Step types, their colours and icons; status and role labels |
| `server/app.js` | Express app: security headers, CSRF guard, mounts all routes |
| `server/routes/` | API endpoints: `auth`, `users`, `flows`, `steps`, `search`, `io` (import/export), `meta`, `activity` |
| `server/lib/steps.js` | Step-tree rules (route only under router, etc.), tree building and numbering |
| `server/lib/auth.js` | Session cookie, login check and role checks |
| `server/migrations/001_init.sql` | Database tables |
| `server/scripts/migrate.js` | `npm run migrate`: creates or updates the tables |
| `server/scripts/create-admin.js` | `npm run create-admin`: creates the first admin |
| `api/index.js` | Vercel entry point (wraps the Express app) |
| `vercel.json` | Vercel build settings, URL rewrites, function region |
| `docs/example-flow-import.json` | Example of a full flow (with nested routers) in the import format |

---

## Step 1: Create the online MySQL database (TiDB Cloud, free)

Vercel doesn't host MySQL, so the database lives on TiDB Cloud. It's MySQL-compatible and free for this size. Any other hosted MySQL 8 also works.

1. Sign up at **tidbcloud.com** and create a **Starter / Serverless** cluster.
   - **Region:** pick **Mumbai (ap-south-1)** if it's offered, otherwise **Singapore**.
2. Open the cluster and click **Connect**:
   - Choose *"Connect with: General"*.
   - Click **Generate password**.
   - Note the **host**, **port** (4000), **user** (looks like `xxxxxxxx.root`) and the **password**.
3. Open **SQL Editor** in TiDB and run:
   ```sql
   CREATE DATABASE pabbly_flows;
   ```
4. Build your connection string from those values:
   ```
   mysql://USER:PASSWORD@HOST:4000/pabbly_flows
   ```
   If the password contains `@ : / ? #`, URL-encode it (for example `@` becomes `%40`).

## Step 2: Run it on your computer

You need **Node.js 20 or newer** (`node -v` to check).

```bash
cd pabbly-flow-manager
npm install
cp .env.example .env
```

Open `.env` and set:

```env
DATABASE_URL=mysql://xxxxxxxx.root:YOURPASSWORD@gateway01.ap-south-1.prod.aws.tidbcloud.com:4000/pabbly_flows
DB_SSL=true
JWT_SECRET=paste-a-long-random-string-here
```

Generate the `JWT_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Create the tables and your admin login. Both are one-time steps, and they write straight into the TiDB database:

```bash
npm run migrate
npm run create-admin -- "Your Name" you@yourcompany.com "ChooseAStrongPassword"
```

Start the app:

```bash
npm run dev
```

Open **http://localhost:5173** and log in. The API runs on port 4000; Vite forwards `/api` to it automatically.

> **Using a local MySQL instead?** Set `DATABASE_URL=mysql://root:password@127.0.0.1:3306/pabbly_flows` and `DB_SSL=false`, and create the `pabbly_flows` database first.

## Step 3: Put the code on GitHub

Create an **empty private** repository on GitHub, then:

```bash
git init
git add .
git commit -m "Pabbly Flow Manager"
git branch -M main
git remote add origin https://github.com/YOUR-ORG/pabbly-flow-manager.git
git push -u origin main
```

`.env` is in `.gitignore`, so your passwords are never pushed.

## Step 4: Deploy on Vercel

1. Go to **vercel.com → Add New → Project** and import the GitHub repo.
2. Framework preset: **Vite**. It's picked up from `vercel.json`, so leave the build settings as they are.
3. Open **Environment Variables** and add these three (same values as your `.env`):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | your TiDB connection string |
   | `DB_SSL` | `true` |
   | `JWT_SECRET` | the same long random string |

4. Click **Deploy**.
5. When it finishes, open `https://YOUR-PROJECT.vercel.app/api/health`. It should show `{"ok":true,"database":"connected"}`. Then open the main URL and log in.

**Function region:** `vercel.json` has `"regions": ["bom1"]` (Mumbai). This keeps the API next to a Mumbai database. If your TiDB cluster is in Singapore, change it to `"sin1"`, then commit and push. A mismatched region makes every page slow.

**Custom domain (optional):** Vercel → Project → Settings → Domains → add e.g. `flows.thebatraanumerology.com`, then add the DNS record Vercel shows you.

From now on, every `git push` to `main` redeploys automatically. Run `npm run migrate` from your computer only when a new file appears in `server/migrations/`.

## Step 5: Add your team

Log in as admin → **Users → Add user**. Pick a role and share the generated password privately. Each person can change it under **My account**.

| Role | Can do |
|---|---|
| **Admin** | Everything: manage users, delete flows |
| **Editor** | Add and edit flows, steps, routers and routes; import CSV / JSON |
| **Viewer** | Read-only. Edit buttons are hidden and the API blocks edits too |

Deactivating a user or resetting their password logs them out of every device immediately.

## Step 6: Load your 100+ flows

1. **Import / Export → Download the CSV template.**
2. Fill in one row per Pabbly flow in Excel or Google Sheets. Only `name` is required. Useful columns: `folder`, `status` (active / inactive / draft; ON / OFF also work), `trigger_app`, `pabbly_url`, `webhook_url`, `owner`, `tags`, `description`, `notes`.
   - Header names are flexible: "Flow Name", "Pabbly URL" and "Webhook" are all recognised.
3. Save it as CSV, upload it, check the preview, and choose a mode:
   - **Skip existing** (default): flows whose name already exists are left alone.
   - **Update existing:** fills in or overwrites fields from the file. Empty cells are ignored.
   - **Always create new**
4. Open each flow and add its steps (next section).

To bring in **complete flows with all their routers in one go**, use **Restore from JSON backup** with a file in the format of `docs/example-flow-import.json`.

### How to record a Pabbly flow with routers

Go through the flow top to bottom in Pabbly and mirror it:

| In Pabbly | In the Flow Manager |
|---|---|
| Trigger (e.g. Razorpay → Payment Captured) | Step type **Trigger**, App = Razorpay, Event = Payment Captured |
| Action step | **Action**, with App and Action/event; put template or sheet names in **Notes** |
| Router | **Router** (give it a name like "Split by product"), then **Add route** for each branch |
| Each route's filter | **Route** → **Condition**, e.g. `Product Name (Text) Contains "Kundali"`. Leave it empty for the fallback route |
| Steps inside a route | The **Add step to this route** button inside that route, including another Router if Pabbly has one there |
| Filter / Delay / Text Formatter / Iterator / Code / API | The matching step type |

Use the ⬆ ⬇ buttons to reorder steps, and **Insert step below** to add one in the middle. Deleting a router also deletes its routes and their steps; you'll be warned with the count first.

---

## Common changes (where to edit)

**Add a new field to flows (e.g. "WhatsApp number used"):**

1. Create `server/migrations/002_add_whatsapp_number.sql`:
   ```sql
   ALTER TABLE flows ADD COLUMN whatsapp_number VARCHAR(30) NULL;
   ```
   Then run `npm run migrate`.
2. `server/lib/flows.js` → in `flowFields()`, add:
   `if (has('whatsapp_number')) out.whatsapp_number = optStr(body.whatsapp_number, 'WhatsApp number', 30);`
3. `server/routes/flows.js` → in `router.post('/')`, add the column to the `INSERT` column list, add one more `?`, and add `fields.whatsapp_number` to the values array. Do the same in `server/routes/io.js` (the insert in `/import`).
4. `src/lib/types.ts` → add `whatsapp_number: string | null;` to `FlowSummary`.
5. `src/components/FlowFormModal.tsx` → add `whatsapp_number: ''` to `EMPTY`, include it in the edit pre-fill, and add a `<Field>` with an `<Input>`.
6. `src/pages/FlowDetailPage.tsx` → add a `<Detail label="WhatsApp number">` in the Details card.

**Add a new step type (e.g. "Email Parser"):**

1. `server/lib/validate.js` → add `'parser'` to `STEP_KINDS`.
2. `src/lib/types.ts` → add `'parser'` to `StepKind`.
3. `src/lib/constants.ts` → add a `parser: { label, icon, hint, chip, iconBox, accent, hasApp, hasCondition }` entry to `KIND_META`. Copy an existing entry and change the colours.

**Change how long a login lasts:** set the `SESSION_DAYS` environment variable (default 7).

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `/api/health` shows `database: unreachable` | Check `DATABASE_URL` in Vercel (user, password, host, port 4000, database name) and that `DB_SSL=true` for TiDB. Then **Redeploy** (env changes need a redeploy). |
| Vercel function log says `Missing environment variable` | One of the three variables isn't set for the **Production** environment. |
| `npm run migrate` says access denied / SSL error | Wrong password, or `DB_SSL` isn't `true` for a cloud database. |
| Login says "Too many login attempts" | 20 wrong passwords in 15 minutes from one network. Wait 15 minutes. |
| Forgot the admin password | Run `npm run create-admin -- "Name" same@email.com "NewPassword"` from your computer. It resets the password and keeps the account an admin. |
| Pages feel slow on Vercel | The function region in `vercel.json` doesn't match the database region (see Step 4). |

## Security notes

- Passwords are stored as bcrypt hashes. The session lives in an **httpOnly, SameSite=Lax, Secure** cookie, so page scripts can't read it.
- Every write request needs an `X-Requested-With: pfm` header. Browsers can't add this header to requests from other sites, which blocks cross-site request forgery.
- Only `http(s)://` links are accepted for the Pabbly and webhook URLs, so links can't run scripts.
- Webhook URLs let anyone send data into a flow, which is why the whole app sits behind login. Give the Viewer role to people who only need to look.
- The site sends `noindex`, so search engines won't list it.
