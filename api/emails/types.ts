export type BaseEmailPayload = {
  to: string; // customer email
  name: string;
  phone?: string;
  service?: string;
  price?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
};
