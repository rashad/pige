export type SolidtimeProject = {
  id: string;
  name: string;
  color?: string;
  client_id?: string | null;
  is_archived?: boolean;
};

export type SolidtimeMe = {
  id: string;
  name: string;
  email: string;
};

export type SolidtimeMembership = {
  id: string;
  organization: { id: string; name: string };
  role: string;
};

export type TimeEntry = {
  id: string;
  start: string;
  end: string | null;
  duration: number | null;
  projectId: string;
  description: string;
  billable: boolean;
};
