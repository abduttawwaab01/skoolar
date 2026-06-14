export const CARD_DIMENSIONS = {
  CR80_WIDTH: 85.6,
  CR80_HEIGHT: 53.98,
  PREVIEW_SCALE: 4.2,
  EXPORT_SCALE: 8,
  ROUNDED: 3.5,
} as const;

export const MM = (mm: number) => Math.round((mm / 25.4) * 600);
export const PW = MM(53.98);
export const PH = MM(85.6);
export const LW = MM(85.6);
export const LH = MM(53.98);

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const FONT_SIZES = [
  { value: 'sm', label: 'Small', base: 1.7, name: 3.0, title: 2.2 },
  { value: 'md', label: 'Medium', base: 2.0, name: 3.6, title: 2.6 },
  { value: 'lg', label: 'Large', base: 2.4, name: 4.2, title: 3.2 },
] as const;

export const CARD_TYPES = [
  { value: 'student', label: 'Student', icon: 'GraduationCap' },
  { value: 'teacher', label: 'Teacher', icon: 'Chalkboard' },
  { value: 'staff', label: 'Staff', icon: 'Briefcase' },
  { value: 'executive', label: 'Executive', icon: 'Crown' },
] as const;

export const ORIENTATIONS = [
  { value: 'landscape', label: 'Landscape', icon: 'Maximize2' },
  { value: 'portrait', label: 'Portrait', icon: 'Maximize2' },
] as const;

export const QR_ACTIONS = {
  arrival: 'Mark Arrival',
  departure: 'Mark Departure',
  attendance: 'Mark Attendance',
  check_in: 'Check In',
  check_out: 'Check Out',
  verify: 'Verify Identity',
} as const;

export const CARD_STATUS = {
  active: 'Active',
  expired: 'Expired',
  suspended: 'Suspended',
  replaced: 'Replaced',
} as const;

export const STUDENT_FIELDS = [
  { key: 'fullName', label: 'Full Name', required: true },
  { key: 'admissionNo', label: 'Admission Number', required: true },
  { key: 'studentId', label: 'Student ID', required: true },
  { key: 'className', label: 'Class', required: true },
  { key: 'section', label: 'Section', required: false },
  { key: 'department', label: 'Department', required: false },
  { key: 'house', label: 'House', required: false },
  { key: 'gender', label: 'Gender', required: false },
  { key: 'dateOfBirth', label: 'Date of Birth', required: false },
  { key: 'bloodGroup', label: 'Blood Group', required: false },
  { key: 'academicSession', label: 'Academic Session', required: false },
] as const;

export const TEACHER_FIELDS = [
  { key: 'fullName', label: 'Full Name', required: true },
  { key: 'staffId', label: 'Staff ID', required: true },
  { key: 'department', label: 'Department', required: true },
  { key: 'designation', label: 'Designation', required: true },
  { key: 'dateJoined', label: 'Date Joined', required: false },
  { key: 'bloodGroup', label: 'Blood Group', required: false },
  { key: 'phone', label: 'Contact Number', required: false },
] as const;

export const STAFF_FIELDS = [
  { key: 'fullName', label: 'Full Name', required: true },
  { key: 'employeeId', label: 'Employee ID', required: true },
  { key: 'department', label: 'Department', required: true },
  { key: 'position', label: 'Position', required: true },
  { key: 'phone', label: 'Contact Number', required: false },
  { key: 'dateJoined', label: 'Date Joined', required: false },
] as const;

export const ELEMENT_TYPES = [
  { value: 'photo', label: 'Photo', icon: 'Camera' },
  { value: 'logo', label: 'Logo', icon: 'Building2' },
  { value: 'qr', label: 'QR Code', icon: 'QrCode' },
  { value: 'barcode', label: 'Barcode', icon: 'Hash' },
  { value: 'name', label: 'Name', icon: 'Type' },
  { value: 'idNumber', label: 'ID Number', icon: 'Hash' },
  { value: 'role', label: 'Role/Badge', icon: 'Award' },
  { value: 'details', label: 'Details Fields', icon: 'List' },
  { value: 'signature', label: 'Signature', icon: 'Pen' },
  { value: 'schoolName', label: 'School Name', icon: 'School' },
  { value: 'motto', label: 'Motto', icon: 'Quote' },
  { value: 'address', label: 'Address', icon: 'MapPin' },
  { value: 'watermark', label: 'Watermark', icon: 'FileImage' },
] as const;
