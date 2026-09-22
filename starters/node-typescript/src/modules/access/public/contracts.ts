export const AccessPermissions = {
  EvaluatePolicy: 'access.evaluate_policy',
} as const;

export interface RolePermissions {
  role: string;
  permissions: string[];
}
