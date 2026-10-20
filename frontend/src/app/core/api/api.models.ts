/** Identifiers from ASP.NET Core Guid are transported as strings. */
export interface UserInfo { id: string; name: string; }
export interface UserDetails {
  id: string;
  firstName: string;
  lastName: string;
  postalAddress: string;
  monthlyExpenseLimit: number;
  isActive: boolean;
}
export type SaveUserRequest = Omit<UserDetails, 'id'>;
export interface CreateReportRequest { userId: string; year: number; month: number; }
export interface ReportDto { id: string; userId: string; year: number; month: number; title: string; }
/** date is a DateOnly string in YYYY-MM-DD form; avoid UTC conversion. */
export interface SaveExpenseRequest {
  date: string;
  description: string;
  amount: number;
  store: string;
  street: string;
  postalCode: string;
  city: string;
}
export interface ExpenseDto extends SaveExpenseRequest { id: string; expenseReportId: string; }
export interface ExpensePage { page: number; pageSize: number; totalCount: number; items: ExpenseDto[]; }
