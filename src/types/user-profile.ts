export enum UserStatus {
  Demo = "demo",
  Default = "default",
  Premium = "premium",
}

export type UserProfile = {
  workspaceUid?: string | null;
  showOnlyMyAccounts?: boolean;
  status?: UserStatus; // demo | default | premium
  language?: "en" | "ru";
  createdAt?: string;
  updatedAt?: string;
};
