# Ludget
## Budget Tracker

## Tech Stack
- **Next.js**
- **TypeScript**
- **Firebase**
- **Shadcn/UI**

## About the Project
A personal budget management app that allows users to log expenses and view detailed spending statistics.  
It helps track financial activity and analyze spending patterns with ease.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Icon Storage (Amazon S3)

Account icons are uploaded to Amazon S3 under the `ludget/icons/{ownerUid}/{accountId}` prefix. Configure the following environment variables before running the app:

- `AWS_S3_BUCKET` – name of the destination bucket.
- `AWS_S3_REGION` – region of the bucket.
- `AWS_S3_PUBLIC_URL` *(optional)* – base URL for serving files (defaults to the standard `https://{bucket}.s3.{region}.amazonaws.com`).
- Standard AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and, if required, `AWS_SESSION_TOKEN`).

Ensure the bucket policy allows the application to upload and (optionally) read the files, and grant public read access if icons should be accessible without authentication.

## Workspace Sharing

To let several users share one workspace:

1. In Firestore open the `userProfiles` collection and find the document of the primary user. Note the value of the `workspaceUid` field (by default it equals the user UID).
2. Create or update a document for the second user (its ID must be that user’s Firebase Auth UID) in the same collection. Set `workspaceUid` to the value from step 1 and add `showOnlyMyAccounts` (usually `false` initially).
3. Make sure all existing documents in `accounts`, `currencies`, `categories`, `incomeSources`, and `transactions` contain the `ownerUid` field equal to the common `workspaceUid`. For legacy entries update the field manually; new documents will be created with it automatically.

After these steps each invited user will see the shared workspace and can toggle the “Показывать только мои счета” setting on `/settings/sharing` to filter account pickers to their own records.
