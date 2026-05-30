export function sanitizeError(error: any): string {
  if (error?.code === 'P2002') {
    const field = error?.meta?.target?.join(', ') || 'field';
    return `A record with that ${field} already exists.`;
  }
  if (error?.code === 'P2025') {
    return 'Record not found.';
  }
  if (error?.code === 'P2003') {
    return 'Related record not found.';
  }
  return 'An internal error occurred.';
}
