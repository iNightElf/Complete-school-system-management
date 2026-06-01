// School financial year configuration
// Change FISCAL_YEAR_START_MONTH to match your school's financial year start month:
//   0=Jan, 1=Feb, ..., 8=Sep (default for schools), 11=Dec
export const FISCAL_YEAR_START_MONTH = 8;
export const FISCAL_START_LABEL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][FISCAL_YEAR_START_MONTH];
export const FISCAL_END_LABEL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][(FISCAL_YEAR_START_MONTH + 11) % 12];

export const API_URL = '/api';

export const TERM_NAMES: Record<string, string> = {
  '1': '1st Term',
  '2': '2nd Term',
  '3': '3rd Term',
};
