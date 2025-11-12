export interface User {
  id: string;
  email: string;
  name: string;
  push_token?: string;
  preferences: {
    email: boolean;
    push: boolean;
  };
  created_at: Date;
  updated_at: Date;
}
