# Feynduck

Feynduck helps you find the gaps in your understanding by using the Feynman Technique.

## Domain Setup

The project is designed to support the following domain structure:

- **feynduck.com**: Marketing & Landing site (serves `src/app/page.tsx`)
- **www.feynduck.com**: Marketing & Landing site (serves `src/app/page.tsx`)
- **app.feynduck.com**: Feynduck Study App (serves the study experience)
- **/study**: Fallback local route for development and testing of the study app

## Architecture

The study experience is encapsulated in the `StudyDemoPage` component located at `src/features/explanation/components/StudyDemoPage.tsx`. This allows the same UI to be rendered across different routes or host-based entry points without code duplication.

## Routing Note

For production deployment of `app.feynduck.com`:
- If using a dynamic Next.js deployment (e.g., Vercel), use `middleware.ts` to rewrite the subdomain to the `/study` route.
- Since the current configuration uses `output: "export"` for static hosting (e.g., Netlify), you should configure subdomain-based redirects at the hosting provider level (e.g., using Netlify Redirects or Edge Functions) to point `app.feynduck.com` to the study content.
