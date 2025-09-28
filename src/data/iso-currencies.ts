export type ISOCurrency = { code: string; name: string };

// Minimal, extendable ISO 4217 list. Source: public domain listings (e.g., Wikipedia/ISO 4217).
// You can expand this list as needed.
export const ISO_CURRENCIES: ISOCurrency[] = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "RUB", name: "Russian Ruble" },
  { code: "RSD", name: "Serbian Dinar" },
  { code: "GBP", name: "British Pound" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "KZT", name: "Kazakhstani Tenge" },
  { code: "UAH", name: "Ukrainian Hryvnia" },
  { code: "BYN", name: "Belarusian Ruble" },
  { code: "PLN", name: "Polish Złoty" },
  { code: "TRY", name: "Turkish Lira" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "AZN", name: "Azerbaijani Manat" },
  { code: "GEL", name: "Georgian Lari" },
];

