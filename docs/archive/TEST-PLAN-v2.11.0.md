# v2.11.0 smoke test
1. Sign in as the authorized admin and open `/reports`, `/reports/new`, and `/reports/jobs`; each should render.
2. Sign in as a normal Searching, Checking, or Evidence user and open those URLs directly; each must show Access Denied.
3. Confirm non-admin navigation and User Dashboard contain no Report Generator / New ZIP Analysis links.
4. Confirm admin navigation still contains Report Generator.
5. Do not consider ZIP export, organization reporting, MFP IDs, or bulk deletion fixed until their next implementation and backend tests are complete.
