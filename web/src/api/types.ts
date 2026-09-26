/** Shapes returned by the Java API. Keep in sync with the records in api/. */

export type UserStatus = "NONE" | "PENDING" | "MEMBER" | "DECLINED";

export type Me = {
  email: string;
  name: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  admin: boolean;
};

export type AccessRequestView = {
  id: number;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  message: string | null;
  createdAt: string;
};

export type MemberView = {
  id: number;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  admin: boolean;
};
