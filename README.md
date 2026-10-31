# CircleUp — CSC Winter Sparkathon MVP

**Tagline:** Learn together. Help each other. Grow together.

CircleUp helps college students across different branches find peers with complementary skills. Students list what they can teach and what they want to learn; the prototype recommends possible matches, explains the reciprocal fit, and lets users propose and track skill-exchange requests.

## Run it
1. Download and extract this folder.
2. Open `index.html` in a modern browser.
3. Edit the sample profile, discover matches, and create a request.

No build step is required.

## Working in this prototype
- Responsive dashboard
- Editable student profile and skills
- Sample students across branches
- Rule-based reciprocal skill matching with plain-language explanations
- Search, branch filter, and sorting
- Exchange request creation and local status updates
- Browser-local persistence with `localStorage`

## Prototype limitations
This is a **single-browser interactive prototype**. Demo profiles are sample data; requests do not reach another real user or sync across devices. It has no real authentication, shared backend, live notifications, or AI integration. The score is an illustrative heuristic, not a validated measure of compatibility.

## Recommended next phase
Add Supabase Auth and a PostgreSQL backend for profiles, skills, exchange requests, sessions, and feedback. Enable Row Level Security on every table, restrict profile edits to the owner, and ensure only request participants can view/respond to requests. Validate status transitions server-side. Never put a Supabase service-role key or private AI API key in frontend code.

## Team split
- Member 1: frontend UI, responsive layout, profile and request screens.
- Member 2: database, auth, reciprocal matching logic, security policies.
- Member 3: user research, skill categories, QA, accessibility, demo and submission; optionally build AI-assisted skill tagging after the core flow works.

## Built with
HTML, CSS, JavaScript, and browser `localStorage`.
