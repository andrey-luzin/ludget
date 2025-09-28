export type Account = {
  id: string;
  name: string;
  color?: string;
  iconUrl?: string;
  createdBy?: string | null;
  order?: number;
};

export type Balance = {
  id: string;
  currencyId: string;
  amount: number;
};

export type Currency = {
  id: string;
  name: string;
  code?: string; // ISO 4217 code, e.g., "USD"
  order?: number;
};

export type Category = {
  id: string;
  name: string;
  parentId?: string | null;
  order?: number;
};

export type Source = {
  id: string;
  name: string;
  parentId?: string | null;
  order?: number;
};
