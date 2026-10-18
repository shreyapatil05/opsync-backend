# OpSync demo data

The seed adds 6 users, 2 teams, 3 projects, 15 tasks, 4 conversations, 9 messages, 5 activities, and 2 inactive automation rules. Task dates are relative to the day you run it, so the boards and analytics show current work. The rules are inactive to avoid sending demo notifications.

## Import into your MongoDB database

From `D:\OpSync\backend` in PowerShell:

```powershell
$env:MONGO_URI = 'mongodb://127.0.0.1:27017/opsync'
$env:DEMO_SEED_PASSWORD = 'ChooseYourOwnPassword123!'
node scripts/seedDemo.js
node scripts/seedDemo.js --apply
```

The first command previews counts without connecting or writing. Replace `MONGO_URI` with the database used by your running backend. The script never drops collections or overwrites existing documents. It has fixed IDs, so rerunning a complete seed is a no-op. It stops if a partial seed or conflicting demo email is found.

If you run the app with Docker Compose, execute the script in the backend container after the services start:

```powershell
docker compose exec -e DEMO_SEED_PASSWORD='ChooseYourOwnPassword123!' backend node scripts/seedDemo.js --apply
```

This uses the container's configured `MONGO_URI`. Change the password before sharing or deploying the demo. Use this only in a demo database.

## Accounts

All accounts use the value you set in `DEMO_SEED_PASSWORD`.

| Role | Email | What to show |
| --- | --- | --- |
| Admin | avery.admin@opsync-demo.test | Admin dashboard, teams, rules, all projects |
| Manager | jordan.manager@opsync-demo.test | Product Launch projects and tasks |
| Manager | priya.manager@opsync-demo.test | Operations and onboarding |
| Employee | sam.employee@opsync-demo.test | Assigned work, analytics, chat, activity |
| Employee | maya.employee2@opsync-demo.test | Mobile and reporting tasks |
| Employee | leo.employee3@opsync-demo.test | Onboarding tasks |

The seed does not create fake file metadata, because downloads and deletes require real Cloudinary files. Upload one real sample PDF or image through the app if you want to demonstrate the Files screen.
