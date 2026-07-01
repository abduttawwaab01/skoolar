export interface DocumentTemplate {
  id: string;
  title: string;
  description: string;
  category: DocumentCategory;
  icon: string;
  content: string;
}

export type DocumentCategory =
  | 'admission'
  | 'disciplinary'
  | 'correspondence'
  | 'meeting'
  | 'academic'
  | 'general';

export const CATEGORIES: { id: DocumentCategory; label: string; icon: string }[] = [
  { id: 'admission', label: 'Admission', icon: '🎓' },
  { id: 'disciplinary', label: 'Disciplinary', icon: '⚖️' },
  { id: 'correspondence', label: 'Correspondence', icon: '✉️' },
  { id: 'meeting', label: 'Meeting', icon: '📋' },
  { id: 'academic', label: 'Academic', icon: '📚' },
  { id: 'general', label: 'General', icon: '📄' },
];

export const PLACEHOLDER_DESCRIPTIONS: Record<string, string> = {
  '{{studentName}}': 'Full name of the student',
  '{{studentClass}}': 'Class/grade of the student',
  '{{schoolName}}': 'Name of the school',
  '{{schoolAddress}}': 'Full address of the school',
  '{{schoolPhone}}': 'School phone number',
  '{{schoolEmail}}': 'School email address',
  '{{principalName}}': 'Name of the school principal',
  '{{teacherName}}': 'Name of the teacher',
  '{{parentName}}': 'Name of parent/guardian',
  '{{date}}': 'Current date',
  '{{term}}': 'Current academic term',
  '{{session}}': 'Current academic session',
  '{{admissionNo}}': 'Student admission number',
  '{{guardianAddress}}': 'Address of parent/guardian',
  '{{amount}}': 'Amount in Naira (₦)',
  '{{feeDescription}}': 'Description of a fee',
  '{{meetingDate}}': 'Date of a meeting',
  '{{meetingTime}}': 'Time of a meeting',
  '{{meetingVenue}}': 'Venue/location of a meeting',
  '{{reason}}': 'Reason for the letter',
  '{{offence}}': 'Description of the offence',
  '{{daysSuspended}}': 'Number of suspension days',
  '{{eventName}}': 'Name of the event',
  '{{eventDate}}': 'Date of the event',
  '{{chairperson}}': 'Name of PTA chairperson',
};

export const ALL_PLACEHOLDERS = Object.keys(PLACEHOLDER_DESCRIPTIONS);

export function getPlaceholders(content: string): string[] {
  const matches = content.match(/\{\{[a-zA-Z_]+\}\}/g);
  if (!matches) return [];
  return [...new Set(matches)].sort();
}

export function fillPlaceholders(content: string, values: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(values)) {
    result = result.replaceAll(key, value);
  }
  return result;
}

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  // ─── ADMISSION ──────────────────────────────────────────
  {
    id: 'admission-offer',
    title: 'Admission Offer Letter',
    description: 'Formal letter offering admission to a new student',
    category: 'admission',
    icon: '🎓',
    content: `<div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 40px; line-height: 1.8;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0;">{{schoolName}}</h1>
    <p style="font-size: 13px; margin: 4px 0;">{{schoolAddress}}</p>
    <p style="font-size: 13px; margin: 4px 0;">Phone: {{schoolPhone}} | Email: {{schoolEmail}}</p>
    <hr style="border: 1px solid #000; margin: 15px 0;" />
    <h2 style="font-size: 16px; font-weight: bold; text-transform: uppercase; margin: 0;">ADMISSION OFFER LETTER</h2>
  </div>

  <p style="font-size: 14px;">Date: <strong>{{date}}</strong></p>
  <p style="font-size: 14px;">Admission No: <strong>{{admissionNo}}</strong></p>

  <p style="font-size: 14px;">Dear <strong>{{parentName}}</strong>,</p>

  <p style="font-size: 14px; text-align: justify;">
    <strong>RE: ADMISSION OFFER FOR {{studentName}}</strong>
  </p>

  <p style="font-size: 14px; text-align: justify;">
    Following the successful completion of our entrance examination and interview, I am pleased to inform you that your child/ward,
    <strong>{{studentName}}</strong>, has been offered provisional admission into <strong>{{studentClass}}</strong>
    of <strong>{{schoolName}}</strong> for the <strong>{{session}}</strong> academic session.
  </p>

  <p style="font-size: 14px; text-align: justify;">
    This offer is subject to the following conditions:
  </p>

  <ol style="font-size: 14px; text-align: justify;">
    <li>Payment of the required acceptance fee and other charges on or before the resumption date.</li>
    <li>Submission of original and photocopies of the following documents:
      <ul>
        <li>Previous school's transfer certificate</li>
        <li>Birth certificate</li>
        <li>Passport photograph (2 copies)</li>
        <li>Immunization/health records</li>
      </ul>
    </li>
    <li>Adherence to the school's rules and regulations as stated in the student handbook.</li>
  </ol>

  <p style="font-size: 14px; text-align: justify;">
    We look forward to welcoming {{studentName}} to our school community and trust that
    the time spent here will be rewarding and fulfilling.
  </p>

  <p style="font-size: 14px;">Yours sincerely,</p>
  <br /><br />
  <p style="font-size: 14px; font-weight: bold;">{{principalName}}</p>
  <p style="font-size: 14px;"><strong>Principal</strong></p>
</div>`,
  },
  {
    id: 'admission-acceptance',
    title: 'Admission Acceptance Form',
    description: 'Acceptance form for newly admitted students',
    category: 'admission',
    icon: '📝',
    content: `<div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 40px; line-height: 1.8;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h1 style="font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0;">{{schoolName}}</h1>
    <p style="font-size: 13px; margin: 4px 0;">{{schoolAddress}}</p>
    <hr style="border: 1px solid #000; margin: 12px 0;" />
    <h2 style="font-size: 16px; font-weight: bold; text-transform: uppercase;">ACCEPTANCE OF ADMISSION FORM</h2>
  </div>

  <p style="font-size: 14px;">Date: <strong>{{date}}</strong></p>

  <p style="font-size: 14px;">I, <strong>{{parentName}}</strong>, parent/guardian of <strong>{{studentName}}</strong>,</p>

  <p style="font-size: 14px; text-align: justify;">
    hereby accept the offer of admission into <strong>{{studentClass}}</strong> of <strong>{{schoolName}}</strong>
    for the <strong>{{session}}</strong> academic session.
  </p>

  <p style="font-size: 14px; text-align: justify;">
    I have read and understood the terms and conditions of this admission and I undertake to:
  </p>

  <ol style="font-size: 14px;">
    <li>Ensure regular payment of school fees as at when due.</li>
    <li>Provide all necessary learning materials for my child.</li>
    <li>Support the school's policies and disciplinary measures.</li>
    <li>Attend PTA meetings and school events as required.</li>
    <li>Ensure my child's regular attendance and punctuality.</li>
  </ol>

  <br />
  <div style="display: flex; justify-content: space-between; margin-top: 40px;">
    <div>
      <p style="font-size: 14px;">___________________________</p>
      <p style="font-size: 14px;"><strong>Parent/Guardian Signature</strong></p>
    </div>
    <div>
      <p style="font-size: 14px;">___________________________</p>
      <p style="font-size: 14px;"><strong>Date</strong></p>
    </div>
  </div>
</div>`,
  },
  {
    id: 'transfer-certificate',
    title: 'Transfer Certificate',
    description: 'School leaving/transfer certificate for students moving to another school',
    category: 'admission',
    icon: '📜',
    content: `<div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 40px; line-height: 1.8;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h1 style="font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0;">{{schoolName}}</h1>
    <p style="font-size: 13px; margin: 4px 0;">{{schoolAddress}}</p>
    <hr style="border: 1px solid #000; margin: 12px 0;" />
    <h2 style="font-size: 16px; font-weight: bold; text-transform: uppercase;">TRANSFER CERTIFICATE</h2>
  </div>

  <p style="font-size: 14px;">Date: <strong>{{date}}</strong></p>

  <p style="font-size: 14px; text-align: justify;">
    This is to certify that <strong>{{studentName}}</strong>, who was a student of
    <strong>{{schoolName}}</strong> from <strong>{{term}}</strong> to the end of the
    <strong>{{session}}</strong> session, is hereby granted transfer to another school.
  </p>

  <table style="width: 100%; font-size: 14px; border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 6px;"><strong>Name of Student:</strong></td><td style="padding: 6px;">{{studentName}}</td></tr>
    <tr><td style="padding: 6px;"><strong>Last Class Attended:</strong></td><td style="padding: 6px;">{{studentClass}}</td></tr>
    <tr><td style="padding: 6px;"><strong>Admission No:</strong></td><td style="padding: 6px;">{{admissionNo}}</td></tr>
    <tr><td style="padding: 6px;"><strong>Conduct:</strong></td><td style="padding: 6px;">Good</td></tr>
  </table>

  <p style="font-size: 14px; text-align: justify;">
    {{studentName}} is of good character and has no outstanding financial obligations to the school.
    I recommend {{pronoun_him}} for admission into any reputable institution.
  </p>

  <br />
  <div style="display: flex; justify-content: space-between; margin-top: 40px;">
    <div>
      <p style="font-size: 14px;">___________________________</p>
      <p style="font-size: 14px;"><strong>{{principalName}}</strong></p>
      <p style="font-size: 13px;">Principal</p>
    </div>
    <div>
      <p style="font-size: 14px;">___________________________</p>
      <p style="font-size: 14px;"><strong>School Stamp</strong></p>
    </div>
  </div>
</div>`,
  },

  // ─── DISCIPLINARY ────────────────────────────────────────
  {
    id: 'query-letter-student',
    title: 'Query Letter (Student)',
    description: 'Letter of query issued to a student for misconduct',
    category: 'disciplinary',
    icon: '⚠️',
    content: `<div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 40px; line-height: 1.8;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h1 style="font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0;">{{schoolName}}</h1>
    <p style="font-size: 13px; margin: 4px 0;">{{schoolAddress}}</p>
    <hr style="border: 1px solid #000; margin: 12px 0;" />
    <h2 style="font-size: 16px; font-weight: bold; text-transform: uppercase;">LETTER OF QUERY</h2>
  </div>

  <p style="font-size: 14px;">Date: <strong>{{date}}</strong></p>

  <p style="font-size: 14px;">To: <strong>{{studentName}}</strong> — {{studentClass}}</p>
  <p style="font-size: 14px;">Through: <strong>{{parentName}}</strong></p>

  <p style="font-size: 14px; text-align: justify;">
    <strong>RE: {{reason}}</strong>
  </p>

  <p style="font-size: 14px; text-align: justify;">
    It has come to the attention of the school management that you were involved in
    <strong>{{offence}}</strong> on <strong>{{date}}</strong>. This act constitutes
    a serious violation of the school's code of conduct.
  </p>

  <p style="font-size: 14px; text-align: justify;">
    You are hereby required to show cause in writing within <strong>48 hours</strong>
    of receipt of this letter why disciplinary action should not be taken against you.
    Please submit your written explanation through your class teacher to the Principal's office.
  </p>

  <p style="font-size: 14px; text-align: justify;">
    Failure to respond within the stipulated time will be considered an admission of guilt,
    and appropriate disciplinary measures will be applied.
  </p>

  <br />
  <p style="font-size: 14px;">Yours sincerely,</p>
  <br /><br />
  <p style="font-size: 14px; font-weight: bold;">{{principalName}}</p>
  <p style="font-size: 14px;"><strong>Principal</strong></p>
</div>`,
  },
  {
    id: 'query-letter-staff',
    title: 'Query Letter (Staff)',
    description: 'Formal query letter issued to a staff member',
    category: 'disciplinary',
    icon: '⚠️',
    content: `<div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 40px; line-height: 1.8;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h1 style="font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0;">{{schoolName}}</h1>
    <p style="font-size: 13px; margin: 4px 0;">{{schoolAddress}}</p>
    <hr style="border: 1px solid #000; margin: 12px 0;" />
    <h2 style="font-size: 16px; font-weight: bold; text-transform: uppercase;">LETTER OF QUERY</h2>
  </div>

  <p style="font-size: 14px;">Date: <strong>{{date}}</strong></p>

  <p style="font-size: 14px;">To: <strong>{{teacherName}}</strong></p>

  <p style="font-size: 14px; text-align: justify;">
    <strong>RE: {{reason}}</strong>
  </p>

  <p style="font-size: 14px; text-align: justify;">
    The school management has noted with concern that you were involved in
    <strong>{{offence}}</strong>. This conduct is inconsistent with the standards
    expected of a staff member of this institution and is in violation of the
    staff conditions of service.
  </p>

  <p style="font-size: 14px; text-align: justify;">
    You are hereby required to submit a written explanation within <strong>72 hours</strong>
    of receipt of this letter. Your response should be addressed to the Principal.
  </p>

  <p style="font-size: 14px; text-align: justify;">
    Please be advised that failure to provide a satisfactory explanation may lead to
    further disciplinary action, including suspension or dismissal.
  </p>

  <br />
  <p style="font-size: 14px;">Yours sincerely,</p>
  <br /><br />
  <p style="font-size: 14px; font-weight: bold;">{{principalName}}</p>
  <p style="font-size: 14px;"><strong>Principal</strong></p>
</div>`,
  },
  {
    id: 'warning-letter',
    title: 'Warning Letter',
    description: 'Formal warning letter for student misconduct',
    category: 'disciplinary',
    icon: '🔶',
    content: `<div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 40px; line-height: 1.8;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h1 style="font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0;">{{schoolName}}</h1>
    <p style="font-size: 13px; margin: 4px 0;">{{schoolAddress}}</p>
    <hr style="border: 1px solid #000; margin: 12px 0;" />
    <h2 style="font-size: 16px; font-weight: bold; text-transform: uppercase;">FORMAL WARNING LETTER</h2>
  </div>

  <p style="font-size: 14px;">Date: <strong>{{date}}</strong></p>
  <p style="font-size: 14px;">To: <strong>{{studentName}}</strong> — {{studentClass}}</p>
  <p style="font-size: 14px;">Through: <strong>{{parentName}}</strong></p>

  <p style="font-size: 14px; text-align: justify;">
    <strong>RE: FIRST OFFICIAL WARNING — {{offence}}</strong>
  </p>

  <p style="font-size: 14px; text-align: justify;">
    This letter serves as an official warning regarding your conduct
    as a student of {{schoolName}}.
  </p>

  <p style="font-size: 14px; text-align: justify;">
    You are hereby advised to desist from any further acts of misconduct.
    Kindly note that any recurrence of this behaviour will attract more
    severe disciplinary consequences, including possible suspension or expulsion.
  </p>

  <p style="font-size: 14px; text-align: justify;">
    We trust that you will take this warning seriously and work towards
    becoming a better and more responsible student.
  </p>

  <br />
  <p style="font-size: 14px;">Yours sincerely,</p>
  <br /><br />
  <p style="font-size: 14px; font-weight: bold;">{{principalName}}</p>
  <p style="font-size: 14px;"><strong>Principal</strong></p>
</div>`,
  },
  {
    id: 'suspension-letter',
    title: 'Suspension Letter',
    description: 'Letter of suspension issued to a student',
    category: 'disciplinary',
    icon: '⛔',
    content: `<div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 40px; line-height: 1.8;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h1 style="font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0;">{{schoolName}}</h1>
    <p style="font-size: 13px; margin: 4px 0;">{{schoolAddress}}</p>
    <hr style="border: 1px solid #000; margin: 12px 0;" />
    <h2 style="font-size: 16px; font-weight: bold; text-transform: uppercase;">LETTER OF SUSPENSION</h2>
  </div>

  <p style="font-size: 14px;">Date: <strong>{{date}}</strong></p>
  <p style="font-size: 14px;">To: <strong>{{studentName}}</strong> — {{studentClass}}</p>
  <p style="font-size: 14px;">Cc: <strong>{{parentName}}</strong></p>

  <p style="font-size: 14px; text-align: justify;">
    <strong>RE: SUSPENSION FROM SCHOOL</strong>
  </p>

  <p style="font-size: 14px; text-align: justify;">
    Following the query letter issued to you on <strong>{{date}}</strong> regarding
    <strong>{{offence}}</strong>, and after a careful review of your response,
    the school management has decided to suspend you from school for a period of
    <strong>{{daysSuspended}} school days</strong>, effective from today.
  </p>

  <p style="font-size: 14px; text-align: justify;">
    During this period:
  </p>
  <ol style="font-size: 14px;">
    <li>You are not permitted to be on school premises.</li>
    <li>You are required to complete all assignments given by your teachers.</li>
    <li>You must be accompanied by your parent/guardian when you return to school.</li>
  </ol>

  <p style="font-size: 14px; text-align: justify;">
    Please note that further misconduct after this suspension will result in
    <strong>expulsion</strong> from the school.
  </p>

  <br />
  <p style="font-size: 14px;">Yours sincerely,</p>
  <br /><br />
  <p style="font-size: 14px; font-weight: bold;">{{principalName}}</p>
  <p style="font-size: 14px;"><strong>Principal</strong></p>
</div>`,
  },

  // ─── CORRESPONDENCE ───────────────────────────────────────
  {
    id: 'invitation-event',
    title: 'Invitation Letter (Event)',
    description: 'Invitation to parents for a school event',
    category: 'correspondence',
    icon: '🎉',
    content: `<div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 40px; line-height: 1.8;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h1 style="font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0;">{{schoolName}}</h1>
    <p style="font-size: 13px; margin: 4px 0;">{{schoolAddress}}</p>
    <hr style="border: 1px solid #000; margin: 12px 0;" />
    <h2 style="font-size: 16px; font-weight: bold; text-transform: uppercase;">LETTER OF INVITATION</h2>
  </div>

  <p style="font-size: 14px;">Date: <strong>{{date}}</strong></p>
  <p style="font-size: 14px;">Dear <strong>{{parentName}},</strong></p>

  <p style="font-size: 14px; text-align: justify;">
    <strong>RE: INVITATION TO {{eventName}}</strong>
  </p>

  <p style="font-size: 14px; text-align: justify;">
    On behalf of the management, staff, and students of <strong>{{schoolName}}</strong>,
    I am pleased to invite you to <strong>{{eventName}}</strong>, scheduled as follows:
  </p>

  <table style="width: 100%; font-size: 14px; border-collapse: collapse; margin: 15px 0;">
    <tr><td style="padding: 8px;"><strong>Date:</strong></td><td style="padding: 8px;">{{eventDate}}</td></tr>
    <tr><td style="padding: 8px;"><strong>Time:</strong></td><td style="padding: 8px;">{{meetingTime}}</td></tr>
    <tr><td style="padding: 8px;"><strong>Venue:</strong></td><td style="padding: 8px;">{{meetingVenue}}</td></tr>
  </table>

  <p style="font-size: 14px; text-align: justify;">
    Your presence and participation will be greatly appreciated. We look forward
    to welcoming you.
  </p>

  <p style="font-size: 14px;">Thank you.</p>
  <br />
  <p style="font-size: 14px;">Yours sincerely,</p>
  <br /><br />
  <p style="font-size: 14px; font-weight: bold;">{{principalName}}</p>
  <p style="font-size: 14px;"><strong>Principal</strong></p>
</div>`,
  },
  {
    id: 'appointment-letter',
    title: 'Appointment Letter (Staff)',
    description: 'Offer of employment for teaching or non-teaching staff',
    category: 'correspondence',
    icon: '📋',
    content: `<div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 40px; line-height: 1.8;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h1 style="font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0;">{{schoolName}}</h1>
    <p style="font-size: 13px; margin: 4px 0;">{{schoolAddress}}</p>
    <hr style="border: 1px solid #000; margin: 12px 0;" />
    <h2 style="font-size: 16px; font-weight: bold; text-transform: uppercase;">LETTER OF APPOINTMENT</h2>
  </div>

  <p style="font-size: 14px;">Date: <strong>{{date}}</strong></p>
  <p style="font-size: 14px;">Dear <strong>{{teacherName}}</strong>,</p>

  <p style="font-size: 14px; text-align: justify;">
    <strong>RE: APPOINTMENT AS A STAFF MEMBER</strong>
  </p>

  <p style="font-size: 14px; text-align: justify;">
    Following your application and successful interview, I am pleased to inform you
    that you have been offered the position of a staff member at
    <strong>{{schoolName}}</strong>, effective from <strong>{{date}}</strong>.
  </p>

  <p style="font-size: 14px; text-align: justify;">
    Your terms of employment are as follows:
  </p>
  <ul style="font-size: 14px;">
    <li>Subject to a probation period of three (3) months.</li>
    <li>Remuneration as discussed during the interview.</li>
    <li>Working hours: Monday to Friday, 7:30 AM — 3:30 PM.</li>
  </ul>

  <p style="font-size: 14px; text-align: justify;">
    Please report to the Principal's office on your resumption date with the
    following documents:
  </p>
  <ol style="font-size: 14px;">
    <li>Valid identification document</li>
    <li>Original certificates and credentials</li>
    <li>Two (2) passport photographs</li>
    <li>Letter of reference from previous employer (if applicable)</li>
  </ol>

  <p style="font-size: 14px;">We look forward to a rewarding working relationship.</p>
  <br />
  <p style="font-size: 14px;">Yours sincerely,</p>
  <br /><br />
  <p style="font-size: 14px; font-weight: bold;">{{principalName}}</p>
  <p style="font-size: 14px;"><strong>Principal</strong></p>
</div>`,
  },
  {
    id: 'recommendation-letter',
    title: 'Letter of Recommendation',
    description: 'Recommendation letter for a student or staff member',
    category: 'correspondence',
    icon: '📜',
    content: `<div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 40px; line-height: 1.8;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h1 style="font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0;">{{schoolName}}</h1>
    <p style="font-size: 13px; margin: 4px 0;">{{schoolAddress}}</p>
    <hr style="border: 1px solid #000; margin: 12px 0;" />
    <h2 style="font-size: 16px; font-weight: bold; text-transform: uppercase;">LETTER OF RECOMMENDATION</h2>
  </div>

  <p style="font-size: 14px;">Date: <strong>{{date}}</strong></p>
  <p style="font-size: 14px;">To Whom It May Concern,</p>

  <p style="font-size: 14px; text-align: justify;">
    I am pleased to write this letter of recommendation for
    <strong>{{studentName}}</strong>, who has been a student at
    <strong>{{schoolName}}</strong> in <strong>{{studentClass}}</strong>
    during the <strong>{{session}}</strong> academic session.
  </p>

  <p style="font-size: 14px; text-align: justify;">
    {{studentName}} has consistently demonstrated excellent academic performance,
    strong leadership qualities, and exemplary character. {{studentName}} is
    hardworking, disciplined, and shows great potential in academic pursuits.
  </p>

  <p style="font-size: 14px; text-align: justify;">
    I have no doubt that {{studentName}} will excel in any future academic
    or professional endeavours and I recommend {{pronoun_them}} without reservation.
  </p>

  <p style="font-size: 14px;">Please feel free to contact me should you require further information.</p>
  <br />
  <p style="font-size: 14px;">Yours faithfully,</p>
  <br /><br />
  <p style="font-size: 14px; font-weight: bold;">{{principalName}}</p>
  <p style="font-size: 14px;"><strong>Principal, {{schoolName}}</strong></p>
</div>`,
  },

  // ─── MEETING ──────────────────────────────────────────────
  {
    id: 'pta-meeting-notice',
    title: 'PTA Meeting Notice',
    description: 'Notice to parents about upcoming PTA meeting',
    category: 'meeting',
    icon: '👥',
    content: `<div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 40px; line-height: 1.8;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h1 style="font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0;">{{schoolName}}</h1>
    <p style="font-size: 13px; margin: 4px 0;">{{schoolAddress}}</p>
    <hr style="border: 1px solid #000; margin: 12px 0;" />
    <h2 style="font-size: 16px; font-weight: bold; text-transform: uppercase;">NOTICE OF PTA MEETING</h2>
  </div>

  <p style="font-size: 14px;">Date: <strong>{{date}}</strong></p>
  <p style="font-size: 14px;">Dear <strong>{{parentName}}</strong>,</p>

  <p style="font-size: 14px; text-align: justify;">
    This is to kindly inform you that the <strong>{{term}}</strong> term Parent-Teacher
    Association (PTA) meeting of <strong>{{schoolName}}</strong> has been scheduled
    as follows:
  </p>

  <table style="width: 100%; font-size: 14px; border-collapse: collapse; margin: 15px 0;">
    <tr><td style="padding: 8px;"><strong>Date:</strong></td><td style="padding: 8px;">{{meetingDate}}</td></tr>
    <tr><td style="padding: 8px;"><strong>Time:</strong></td><td style="padding: 8px;">{{meetingTime}}</td></tr>
    <tr><td style="padding: 8px;"><strong>Venue:</strong></td><td style="padding: 8px;">{{meetingVenue}}</td></tr>
    <tr><td style="padding: 8px;"><strong>Chairperson:</strong></td><td style="padding: 8px;">{{chairperson}}</td></tr>
  </table>

  <p style="font-size: 14px; text-align: justify;">
    <strong>Agenda:</strong>
  </p>
  <ol style="font-size: 14px;">
    <li>Opening prayer and welcome address</li>
    <li>Minutes of last meeting</li>
    <li>Principal's report on academic progress</li>
    <li>Financial report from PTA Treasurer</li>
    <li>Proposed school development projects</li>
    <li>Matters arising and general discussions</li>
    <li>Date of next meeting</li>
    <li>Closing</li>
  </ol>

  <p style="font-size: 14px; text-align: justify;">
    Your attendance is mandatory as important decisions affecting the welfare
    and academic progress of your children will be discussed.
  </p>

  <p style="font-size: 14px;">Thank you.</p>
  <br />
  <p style="font-size: 14px; font-weight: bold;">{{principalName}}</p>
  <p style="font-size: 14px;"><strong>Principal</strong></p>
</div>`,
  },
  {
    id: 'meeting-reminder',
    title: 'Meeting Reminder',
    description: 'Reminder notice for an upcoming meeting',
    category: 'meeting',
    icon: '🔔',
    content: `<div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 40px; line-height: 1.8;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h1 style="font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0;">{{schoolName}}</h1>
    <p style="font-size: 13px; margin: 4px 0;">{{schoolAddress}}</p>
    <hr style="border: 1px solid #000; margin: 12px 0;" />
    <h2 style="font-size: 16px; font-weight: bold; text-transform: uppercase;">MEETING REMINDER</h2>
  </div>

  <p style="font-size: 14px;">Date: <strong>{{date}}</strong></p>
  <p style="font-size: 14px;">Dear <strong>{{parentName}}</strong>,</p>

  <p style="font-size: 14px; text-align: justify;">
    This is a gentle reminder of our upcoming meeting scheduled for:
  </p>

  <table style="width: 100%; font-size: 14px; border-collapse: collapse; margin: 15px 0;">
    <tr><td style="padding: 8px;"><strong>Date:</strong></td><td style="padding: 8px;">{{meetingDate}}</td></tr>
    <tr><td style="padding: 8px;"><strong>Time:</strong></td><td style="padding: 8px;">{{meetingTime}}</td></tr>
    <tr><td style="padding: 8px;"><strong>Venue:</strong></td><td style="padding: 8px;">{{meetingVenue}}</td></tr>
    <tr><td style="padding: 8px;"><strong>Purpose:</strong></td><td style="padding: 8px;">{{reason}}</td></tr>
  </table>

  <p style="font-size: 14px; text-align: justify;">
    Your presence is highly valued and we look forward to seeing you there.
    Please endeavour to be punctual.
  </p>

  <p style="font-size: 14px;">Thank you.</p>
  <br />
  <p style="font-size: 14px; font-weight: bold;">{{principalName}}</p>
  <p style="font-size: 14px;"><strong>Principal</strong></p>
</div>`,
  },
  {
    id: 'meeting-minutes',
    title: 'Meeting Minutes Template',
    description: 'Template for recording minutes of school meetings',
    category: 'meeting',
    icon: '📝',
    content: `<div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 40px; line-height: 1.8;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h1 style="font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0;">{{schoolName}}</h1>
    <hr style="border: 1px solid #000; margin: 12px 0;" />
    <h2 style="font-size: 16px; font-weight: bold; text-transform: uppercase;">MEETING MINUTES</h2>
  </div>

  <table style="width: 100%; font-size: 14px; border-collapse: collapse; margin: 15px 0;">
    <tr><td style="padding: 6px;"><strong>Date:</strong></td><td style="padding: 6px;">{{meetingDate}}</td></tr>
    <tr><td style="padding: 6px;"><strong>Time:</strong></td><td style="padding: 6px;">{{meetingTime}}</td></tr>
    <tr><td style="padding: 6px;"><strong>Venue:</strong></td><td style="padding: 6px;">{{meetingVenue}}</td></tr>
    <tr><td style="padding: 6px;"><strong>Chairperson:</strong></td><td style="padding: 6px;">_________________________________</td></tr>
    <tr><td style="padding: 6px;"><strong>Secretary:</strong></td><td style="padding: 6px;">_________________________________</td></tr>
    <tr><td style="padding: 6px;"><strong>Purpose:</strong></td><td style="padding: 6px;">{{reason}}</td></tr>
  </table>

  <h3 style="font-size: 14px; font-weight: bold; margin-top: 20px;">ATTENDEES</h3>
  <p style="font-size: 14px;">List of attendees:</p>
  <p style="font-size: 14px;">1. _________________________________</p>
  <p style="font-size: 14px;">2. _________________________________</p>
  <p style="font-size: 14px;">3. _________________________________</p>
  <p style="font-size: 14px;">4. _________________________________</p>
  <p style="font-size: 14px;">5. _________________________________</p>

  <h3 style="font-size: 14px; font-weight: bold; margin-top: 20px;">AGENDA ITEMS & DISCUSSION</h3>
  <ol style="font-size: 14px;">
    <li><strong>Opening:</strong> The meeting commenced with an opening prayer at {{meetingTime}}.</li>
    <li><strong>Minutes of Last Meeting:</strong> The minutes of the previous meeting were read and adopted.</li>
    <li><strong>Matters Arising:</strong> _________________________________________________</li>
    <li><strong>New Business:</strong> ___________________________________________________</li>
    <li><strong>Other Matters:</strong> _________________________________________________</li>
  </ol>

  <h3 style="font-size: 14px; font-weight: bold; margin-top: 20px;">RESOLUTIONS</h3>
  <ol style="font-size: 14px;">
    <li>_________________________________________________________________</li>
    <li>_________________________________________________________________</li>
    <li>_________________________________________________________________</li>
  </ol>

  <h3 style="font-size: 14px; font-weight: bold; margin-top: 20px;">ACTION ITEMS</h3>
  <table style="width: 100%; font-size: 14px; border-collapse: collapse; border: 1px solid #000;">
    <tr style="border: 1px solid #000;"><th style="border: 1px solid #000; padding: 6px;">Action</th><th style="border: 1px solid #000; padding: 6px;">Responsible</th><th style="border: 1px solid #000; padding: 6px;">Deadline</th></tr>
    <tr><td style="border: 1px solid #000; padding: 6px;">&nbsp;</td><td style="border: 1px solid #000; padding: 6px;">&nbsp;</td><td style="border: 1px solid #000; padding: 6px;">&nbsp;</td></tr>
    <tr><td style="border: 1px solid #000; padding: 6px;">&nbsp;</td><td style="border: 1px solid #000; padding: 6px;">&nbsp;</td><td style="border: 1px solid #000; padding: 6px;">&nbsp;</td></tr>
    <tr><td style="border: 1px solid #000; padding: 6px;">&nbsp;</td><td style="border: 1px solid #000; padding: 6px;">&nbsp;</td><td style="border: 1px solid #000; padding: 6px;">&nbsp;</td></tr>
  </table>

  <br />
  <p style="font-size: 14px;"><strong>Next Meeting:</strong> _________________________________</p>
  <p style="font-size: 14px;">The meeting was adjourned at ________________.</p>
  <br />
  <div style="display: flex; justify-content: space-between;">
    <div>
      <p style="font-size: 14px;">_________________________</p>
      <p style="font-size: 13px;"><strong>Secretary</strong></p>
    </div>
    <div>
      <p style="font-size: 14px;">_________________________</p>
      <p style="font-size: 13px;"><strong>Chairperson</strong></p>
    </div>
  </div>
</div>`,
  },

  // ─── ACADEMIC ─────────────────────────────────────────────
  {
    id: 'excuse-duty-letter',
    title: 'Excuse Duty Letter',
    description: 'Parental excuse note for student absence',
    category: 'academic',
    icon: '📝',
    content: `<div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 40px; line-height: 1.8;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h1 style="font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0;">{{schoolName}}</h1>
    <p style="font-size: 13px; margin: 4px 0;">{{schoolAddress}}</p>
    <hr style="border: 1px solid #000; margin: 12px 0;" />
    <h2 style="font-size: 16px; font-weight: bold; text-transform: uppercase;">EXCUSE DUTY LETTER</h2>
  </div>

  <p style="font-size: 14px;">Date: <strong>{{date}}</strong></p>
  <p style="font-size: 14px;">Dear <strong>{{principalName}}</strong>,</p>

  <p style="font-size: 14px; text-align: justify;">
    <strong>RE: EXCUSE DUTY FOR {{studentName}} — {{studentClass}}</strong>
  </p>

  <p style="font-size: 14px; text-align: justify;">
    I write to respectfully request that <strong>{{studentName}}</strong> of
    <strong>{{studentClass}}</strong> be excused from school on
    <strong>{{date}}</strong> due to {{reason}}.
  </p>

  <p style="font-size: 14px; text-align: justify;">
    I will ensure that {{studentName}} collects all assignments and notes
    from classmates to stay up-to-date with schoolwork during this period.
  </p>

  <p style="font-size: 14px;">Thank you for your understanding.</p>
  <br />
  <p style="font-size: 14px;">Yours sincerely,</p>
  <br /><br />
  <p style="font-size: 14px; font-weight: bold;">{{parentName}}</p>
  <p style="font-size: 14px;"><strong>Parent/Guardian</strong></p>
</div>`,
  },
  {
    id: 'field-trip-permission',
    title: 'Field Trip Permission Slip',
    description: 'Parental consent form for school field trips',
    category: 'academic',
    icon: '🚌',
    content: `<div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 40px; line-height: 1.8;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h1 style="font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0;">{{schoolName}}</h1>
    <p style="font-size: 13px; margin: 4px 0;">{{schoolAddress}}</p>
    <hr style="border: 1px solid #000; margin: 12px 0;" />
    <h2 style="font-size: 16px; font-weight: bold; text-transform: uppercase;">FIELD TRIP PERMISSION SLIP</h2>
  </div>

  <p style="font-size: 14px;">Date: <strong>{{date}}</strong></p>

  <h3 style="font-size: 14px; font-weight: bold;">TRIP DETAILS</h3>
  <table style="width: 100%; font-size: 14px; border-collapse: collapse; margin: 10px 0;">
    <tr><td style="padding: 6px;"><strong>Destination:</strong></td><td style="padding: 6px;">{{reason}}</td></tr>
    <tr><td style="padding: 6px;"><strong>Date:</strong></td><td style="padding: 6px;">{{eventDate}}</td></tr>
    <tr><td style="padding: 6px;"><strong>Departure Time:</strong></td><td style="padding: 6px;">{{meetingTime}}</td></tr>
    <tr><td style="padding: 6px;"><strong>Return Time:</strong></td><td style="padding: 6px;">_________________________________</td></tr>
    <tr><td style="padding: 6px;"><strong>Cost:</strong></td><td style="padding: 6px;">{{amount}}</td></tr>
  </table>

  <hr style="border: 1px dashed #000; margin: 15px 0;" />

  <h3 style="font-size: 14px; font-weight: bold;">PARENTAL CONSENT</h3>

  <p style="font-size: 14px;">I, <strong>{{parentName}}</strong>, parent/guardian of <strong>{{studentName}}</strong> of <strong>{{studentClass}}</strong>,</p>

  <p style="font-size: 14px; text-align: justify;">
    ☐ <strong>GIVE</strong> permission for my child to participate in the above-named field trip.
  </p>
  <p style="font-size: 14px; text-align: justify;">
    ☐ <strong>DO NOT GIVE</strong> permission for my child to participate.
  </p>

  <p style="font-size: 14px; text-align: justify;">
    I understand that reasonable precautions will be taken by the school to ensure
    the safety of all students during the trip.
  </p>

  <br />
  <div style="display: flex; justify-content: space-between; margin-top: 20px;">
    <div>
      <p style="font-size: 14px;">_________________________</p>
      <p style="font-size: 14px;"><strong>Parent/Guardian Signature</strong></p>
    </div>
    <div>
      <p style="font-size: 14px;">_________________________</p>
      <p style="font-size: 14px;"><strong>Date</strong></p>
    </div>
  </div>
  <div style="margin-top: 10px;">
    <p style="font-size: 14px;">Phone: {{schoolPhone}}</p>
  </div>
</div>`,
  },
  {
    id: 'exam-malpractice-notice',
    title: 'Exam Malpractice Notice',
    description: 'Notice issued to a student involved in examination malpractice',
    category: 'academic',
    icon: '📋',
    content: `<div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 40px; line-height: 1.8;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h1 style="font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0;">{{schoolName}}</h1>
    <p style="font-size: 13px; margin: 4px 0;">{{schoolAddress}}</p>
    <hr style="border: 1px solid #000; margin: 12px 0;" />
    <h2 style="font-size: 16px; font-weight: bold; text-transform: uppercase;">NOTICE OF EXAMINATION MALPRACTICE</h2>
  </div>

  <p style="font-size: 14px;">Date: <strong>{{date}}</strong></p>
  <p style="font-size: 14px;">To: <strong>{{studentName}}</strong> — {{studentClass}}</p>
  <p style="font-size: 14px;">Through: <strong>{{parentName}}</strong></p>

  <p style="font-size: 14px; text-align: justify;">
    This is to formally notify you that you have been caught in the act of
    <strong>{{offence}}</strong> during the <strong>{{term}}</strong> term
    examinations conducted on <strong>{{date}}</strong>.
  </p>

  <p style="font-size: 14px; text-align: justify;">
    In accordance with the school's examination regulations, the following
    sanctions have been applied:
  </p>
  <ol style="font-size: 14px;">
    <li>The examination paper for which the malpractice occurred has been <strong>cancelled</strong> and will be marked zero (0).</li>
    <li>A <strong>warning letter</strong> has been placed in your disciplinary file.</li>
    <li>You are required to write a letter of undertaking promising not to repeat such an act.</li>
  </ol>

  <p style="font-size: 14px; text-align: justify;">
    Please note that any recurrence will lead to <strong>outright suspension</strong>
    from the school.
  </p>

  <br />
  <p style="font-size: 14px;">Yours sincerely,</p>
  <br /><br />
  <p style="font-size: 14px; font-weight: bold;">{{principalName}}</p>
  <p style="font-size: 14px;"><strong>Principal</strong></p>
</div>`,
  },

  // ─── GENERAL ──────────────────────────────────────────────
  {
    id: 'fee-reminder',
    title: 'Fee Reminder Letter',
    description: 'Reminder notice for outstanding school fees',
    category: 'general',
    icon: '💰',
    content: `<div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 40px; line-height: 1.8;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h1 style="font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0;">{{schoolName}}</h1>
    <p style="font-size: 13px; margin: 4px 0;">{{schoolAddress}}</p>
    <hr style="border: 1px solid #000; margin: 12px 0;" />
    <h2 style="font-size: 16px; font-weight: bold; text-transform: uppercase;">REMINDER: OUTSTANDING SCHOOL FEES</h2>
  </div>

  <p style="font-size: 14px;">Date: <strong>{{date}}</strong></p>
  <p style="font-size: 14px;">Dear <strong>{{parentName}}</strong>,</p>

  <p style="font-size: 14px; text-align: justify;">
    <strong>RE: OUTSTANDING SCHOOL FEES FOR {{studentName}} ({{studentClass}})</strong>
  </p>

  <p style="font-size: 14px; text-align: justify;">
    This is to kindly remind you that the school fees for
    <strong>{{studentName}}</strong> for the <strong>{{term}} term,
    {{session}}</strong> session, amounting to <strong>{{amount}}</strong>,
    remains unpaid.
  </p>

  <p style="font-size: 14px; text-align: justify;">
    We kindly request that you settle this payment as soon as possible to avoid
    any disruption to your child's academic activities. Payment can be made at
    the school's accounts office or via the school's payment portal.
  </p>

  <p style="font-size: 14px; text-align: justify;">
    Should you have any questions regarding the fee breakdown, please do not
    hesitate to contact the accounts department.
  </p>

  <p style="font-size: 14px;">Thank you for your prompt attention to this matter.</p>
  <br />
  <p style="font-size: 14px;">Yours sincerely,</p>
  <br /><br />
  <p style="font-size: 14px; font-weight: bold;">{{principalName}}</p>
  <p style="font-size: 14px;"><strong>Principal</strong></p>
</div>`,
  },
  {
    id: 'school-closure-notice',
    title: 'School Closure Notice',
    description: 'Notice informing parents about school closure or holiday',
    category: 'general',
    icon: '📢',
    content: `<div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 40px; line-height: 1.8;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h1 style="font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0;">{{schoolName}}</h1>
    <p style="font-size: 13px; margin: 4px 0;">{{schoolAddress}}</p>
    <hr style="border: 1px solid #000; margin: 12px 0;" />
    <h2 style="font-size: 16px; font-weight: bold; text-transform: uppercase;">SCHOOL CLOSURE NOTICE</h2>
  </div>

  <p style="font-size: 14px;">Date: <strong>{{date}}</strong></p>
  <p style="font-size: 14px;">Dear Parents/Guardians,</p>

  <p style="font-size: 14px; text-align: justify;">
    <strong>RE: {{reason}}</strong>
  </p>

  <p style="font-size: 14px; text-align: justify;">
    This is to inform all parents and guardians that <strong>{{schoolName}}</strong>
    will be closed as from <strong>{{eventDate}}</strong> due to {{reason}}.
  </p>

  <p style="font-size: 14px; text-align: justify;">
    School activities will resume on <strong>{{date}}</strong>. All students
    are expected to resume on this date.
  </p>

  <p style="font-size: 14px; text-align: justify;">
    Please ensure that your children/wards use the break period productively
    and complete any assignments given by their teachers.
  </p>

  <p style="font-size: 14px;">Thank you for your continued support.</p>
  <br />
  <p style="font-size: 14px;">Yours sincerely,</p>
  <br /><br />
  <p style="font-size: 14px; font-weight: bold;">{{principalName}}</p>
  <p style="font-size: 14px;"><strong>Principal</strong></p>
</div>`,
  },
  {
    id: 'uniform-policy',
    title: 'Uniform Policy Reminder',
    description: 'Reminder to parents about school uniform/dress code policy',
    category: 'general',
    icon: '👔',
    content: `<div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 40px; line-height: 1.8;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h1 style="font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0;">{{schoolName}}</h1>
    <p style="font-size: 13px; margin: 4px 0;">{{schoolAddress}}</p>
    <hr style="border: 1px solid #000; margin: 12px 0;" />
    <h2 style="font-size: 16px; font-weight: bold; text-transform: uppercase;">UNIFORM/DRESS CODE POLICY REMINDER</h2>
  </div>

  <p style="font-size: 14px;">Date: <strong>{{date}}</strong></p>
  <p style="font-size: 14px;">Dear Parents/Guardians,</p>

  <p style="font-size: 14px; text-align: justify;">
    This is to remind all parents and guardians of the school's uniform and
    dress code policy at <strong>{{schoolName}}</strong>.
  </p>

  <p style="font-size: 14px; text-align: justify;">
    All students are expected to:
  </p>
  <ul style="font-size: 14px;">
    <li>Wear the complete approved school uniform daily.</li>
    <li>Wear only black or brown polished school shoes.</li>
    <li>Keep hair neatly cut and styled (no outrageous hairstyles).</li>
    <li>Not wear jewellery, makeup, or nail polish to school.</li>
    <li>Wear the full P.E. kit on designated sports days.</li>
  </ul>

  <p style="font-size: 14px; text-align: justify;">
    <strong>Note:</strong> Students who come to school improperly dressed will be
    sent home. Your cooperation in enforcing these standards is greatly appreciated.
  </p>

  <p style="font-size: 14px;">Thank you for your understanding and support.</p>
  <br />
  <p style="font-size: 14px; font-weight: bold;">{{principalName}}</p>
  <p style="font-size: 14px;"><strong>Principal</strong></p>
</div>`,
  },
  {
    id: 'late-coming-notice',
    title: 'Late Coming Notice',
    description: 'Notice to parents about student lateness to school',
    category: 'general',
    icon: '⏰',
    content: `<div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 40px; line-height: 1.8;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h1 style="font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0;">{{schoolName}}</h1>
    <p style="font-size: 13px; margin: 4px 0;">{{schoolAddress}}</p>
    <hr style="border: 1px solid #000; margin: 12px 0;" />
    <h2 style="font-size: 16px; font-weight: bold; text-transform: uppercase;">NOTICE: CHRONIC LATENESS</h2>
  </div>

  <p style="font-size: 14px;">Date: <strong>{{date}}</strong></p>
  <p style="font-size: 14px;">Dear <strong>{{parentName}}</strong>,</p>

  <p style="font-size: 14px; text-align: justify;">
    <strong>RE: CHRONIC LATENESS OF {{studentName}} ({{studentClass}})</strong>
  </p>

  <p style="font-size: 14px; text-align: justify;">
    This is to bring to your attention that your child/ward,
    <strong>{{studentName}}</strong> of <strong>{{studentClass}}</strong>,
    has been consistently late to school over the past several days.
  </p>

  <p style="font-size: 14px; text-align: justify;">
    The school day begins at <strong>7:45 AM</strong> prompt. Repeated lateness
    disrupts not only your child's learning but also the class as a whole.
  </p>

  <p style="font-size: 14px; text-align: justify;">
    We kindly request that you ensure {{studentName}} arrives at school on time.
    Continued lateness may result in disciplinary action.
  </p>

  <p style="font-size: 14px;">Thank you for your cooperation.</p>
  <br />
  <p style="font-size: 14px; font-weight: bold;">{{principalName}}</p>
  <p style="font-size: 14px;"><strong>Principal</strong></p>
</div>`,
  },
];
