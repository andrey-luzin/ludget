export type Account = {
  id: string;
  name: string;
  color?: string;
  iconUrl?: string;
  createdBy?: string | null;
};

export type Balance = {
  id: string;
  currencyId: string;
  amount: number;
};

export type Currency = {
  id: string;
  name: string;
};

export type Category = {
  id: string;
  name: string;
  parentId?: string | null;
};

export type Source = {
  id: string;
  name: string;
  parentId?: string | null;
};
