# Privacy Policy

This document is a practical template for anyone hosting this project publicly. It is not legal advice.

## Summary

This project stores cat row data in the user's local browser by default. If you host the app for other users, some user-provided data may also be sent to OpenAI when GPT-powered features are used.

## Data The App Uses

The app may process:
- spreadsheet rows pasted by the user
- cat names, rooms, stats, and mutation text entered by the user
- screenshots uploaded or pasted by the user for screenshot parsing
- planner customization text and follow-up prompts entered by the user

## Local Browser Storage

The frontend stores the main planner state in the browser's local storage, including:
- current cat rows
- planner configuration
- manual add-cat draft state

This data stays in that browser on that machine unless the user exports or copies it elsewhere.

## Server-Side Processing

If GPT-powered features are enabled, the server may process:
- screenshot images uploaded for parsing
- normalized cat spreadsheet data
- planner customization fields
- follow-up prompts and prior analysis context

## OpenAI Processing

When a user uses:
- screenshot parsing
- planner recommendations
- planner follow-up requests

the relevant request data is sent to OpenAI for processing.

If you host this project publicly, your public privacy policy should clearly state that these features send user-provided data to OpenAI.

## Data Retention

By default, this project does not include a database-backed user account system.

The app can optionally append rows to `cats.csv` through the `/save` endpoint if that endpoint is used. If you host the project publicly and keep that behavior enabled, your public privacy policy should disclose:
- what is written
- why it is written
- how long it is retained
- who can access it

## Third-Party Services

If hosted with GPT features enabled, OpenAI is a third-party service provider involved in processing some requests.

You should review and reference OpenAI's current terms and policies before publishing a hosted version:
- https://platform.openai.com/policies/terms-of-use
- https://openai.com/policies/usage-policies/

## Your Responsibility If You Host It

Before hosting publicly, you should decide and document:
- whether screenshots are logged or discarded
- whether request bodies are logged by your server or hosting provider
- whether `cats.csv` is used at all
- how users can request deletion of any retained data
- who to contact for privacy questions

## Contact

Replace this section with your preferred contact method before publishing a hosted version.
