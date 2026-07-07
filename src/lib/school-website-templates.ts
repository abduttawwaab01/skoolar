export interface WebsiteTemplate {
  heroTitle: string;
  heroSubtitle: string;
  aboutTitle: string;
  aboutContent: string;
  admissionsTitle: string;
  admissionsContent: string;
  featureCards: string;
  extraSections: string;
  sectionVisibility: string;
  themePreset: string;
  metaTitle: string;
  metaDescription: string;
}

let blockCounter = 0;
function uid() {
  return `gen_${++blockCounter}_${Date.now()}`;
}

function textBlock(heading: string, text: string): object {
  return {
    id: uid(),
    type: 'text',
    content: JSON.stringify({ heading, text }),
    order: 0,
  };
}

function textImageBlock(side: 'left' | 'right', heading: string, text: string): object {
  return {
    id: uid(),
    type: 'text-image',
    content: JSON.stringify({ side, heading, text, imageUrl: '' }),
    order: 0,
  };
}

function ctaBlock(heading: string, description: string, buttonText: string, buttonUrl: string): object {
  return {
    id: uid(),
    type: 'cta',
    content: JSON.stringify({ heading, description, buttonText, buttonUrl }),
    order: 0,
  };
}

const defaultSectionVisibility = JSON.stringify({
  hero: true,
  about: true,
  admissions: true,
  contact: true,
  featureCards: true,
  entranceExam: true,
  extraSections: true,
});

function primaryTemplate(name: string, motto: string): WebsiteTemplate {
  const metaTitle = `${name} — A Leading Nursery & Primary School`;
  const metaDesc = `Welcome to ${name}. We provide quality early childhood and primary education in a nurturing environment. ${motto ? `Motto: ${motto}` : ''} Enrol your child today.`;
  return {
    heroTitle: `${name} — Where Every Child Discovers the Joy of Learning`,
    heroSubtitle: motto || 'Nurturing young minds through quality education, creativity, and care',
    aboutTitle: `About ${name}`,
    aboutContent: `<h3>Our Mission</h3>
<p>At ${name}, we are dedicated to providing a nurturing, safe, and stimulating environment where every child can thrive academically, socially, and emotionally. We believe that the early years are the foundation upon which a lifetime of learning is built.</p>
<h3>Our Vision</h3>
<p>To be a leading nursery and primary school that inspires a lifelong love of learning, fosters creativity, and prepares children to become confident, compassionate, and responsible members of society.</p>
<h3>Our Core Values</h3>
<ul>
<li><strong>Excellence:</strong> We strive for the highest standards in teaching, learning, and personal development.</li>
<li><strong>Care:</strong> Every child is valued, supported, and encouraged to reach their full potential in a warm, family-like atmosphere.</li>
<li><strong>Creativity:</strong> We nurture imagination and self-expression through arts, music, drama, and exploratory play.</li>
<li><strong>Community:</strong> We build strong partnerships between school, home, and the wider community to support each child's growth.</li>
<li><strong>Integrity:</strong> We uphold honesty, respect, and responsibility in all we do.</li>
</ul>
<h3>Why Choose ${name}?</h3>
<p>With experienced and caring teachers, modern and well-equipped classrooms, a rich and balanced curriculum, and a strong emphasis on character development, ${name} offers an exceptional foundation for your child's educational journey. We provide a blend of academic excellence, creative arts, sports, and moral education in a safe and welcoming environment.</p>
<p>We also offer a variety of extracurricular activities including sports, music, dance, taekwondo, and coding clubs to ensure every child discovers and develops their unique talents.</p>`,
    admissionsTitle: 'Admissions — Join Our School Family',
    admissionsContent: `<h3>Admissions Process</h3>
<p>We warmly welcome families who are seeking a high-quality educational foundation for their children. Our admissions process is designed to be simple, transparent, and supportive.</p>
<ol>
<li><strong>Inquiry & Visit:</strong> Contact our admissions office to schedule a school tour. We encourage parents to visit our campus, meet our staff, and see our learning environment firsthand.</li>
<li><strong>Application Submission:</strong> Complete and submit the application form along with the required documents.</li>
<li><strong>Assessment & Interaction:</strong> We invite your child for a brief age-appropriate assessment and interactive session to help us understand their needs and personality.</li>
<li><strong>Admission Decision:</strong> You will receive an admission decision within one week of the assessment.</li>
<li><strong>Enrollment & Onboarding:</strong> Complete the enrollment process by submitting the necessary forms and fees. Welcome to the ${name} family!</li>
</ol>
<h3>Age Requirements</h3>
<ul>
<li><strong>Creche:</strong> 3 months — 1 year</li>
<li><strong>Playgroup:</strong> 1 — 2 years</li>
<li><strong>Pre-Nursery:</strong> 2 — 3 years</li>
<li><strong>Nursery:</strong> 3 — 5 years</li>
<li><strong>Primary:</strong> 5 — 11 years</li>
</ul>
<h3>Required Documents</h3>
<ul>
<li>Completed application form</li>
<li>Child's birth certificate or age declaration</li>
<li>Recent passport photographs (2 copies)</li>
<li>Previous school reports (if applicable)</li>
<li>Medical/health records including immunization card</li>
<li>Parent/guardian identification documents</li>
</ul>
<h3>School Hours</h3>
<p><strong>Nursery:</strong> 8:00 AM — 2:00 PM<br />
<strong>Primary:</strong> 7:30 AM — 2:30 PM<br />
<strong>After-School Care:</strong> Available until 5:00 PM at an additional fee.</p>
<p>For more information or to schedule a visit, please contact our admissions office. We look forward to welcoming your family to ${name}.</p>`,
    featureCards: JSON.stringify([
      { icon: 'Heart', title: 'Nurturing Environment', description: 'Warm, caring atmosphere where every child feels safe, valued, and supported.' },
      { icon: 'GraduationCap', title: 'Qualified Teachers', description: 'Experienced and passionate educators dedicated to early childhood development.' },
      { icon: 'BookOpen', title: 'Rich Curriculum', description: 'Balanced blend of academics, creative arts, sports, and character education.' },
      { icon: 'Shield', title: 'Safe & Modern Facilities', description: 'Secure, child-friendly campus with modern classrooms, playgrounds, and learning resources.' },
    ]),
    extraSections: JSON.stringify([
      {
        ...textBlock('What Parents Say About Us', `At ${name}, we take pride in the trust parents place in us. Here is what some of our wonderful parents have to say about their experience with our school.\n\n"Our daughter has blossomed since joining ${name}. The teachers are incredibly caring and the learning environment is exceptional. She looks forward to school every single day!" — Mrs. Adebayo, Parent\n\n"${name} has provided our son with the perfect foundation. The balance of academics, sports, and character development is outstanding. We couldn't be happier with our choice." — Mr. & Mrs. Okafor, Parents`),
        order: 0,
      },
      {
        ...textImageBlock('left', 'A Day in the Life at Our School', `Every day at ${name} is filled with discovery, creativity, and joy. From morning circle time and interactive lessons to outdoor play, arts and crafts, and story sessions, our carefully structured daily program ensures that children are engaged, inspired, and continuously learning.\n\nOur classrooms are vibrant spaces where curiosity is encouraged, questions are welcomed, and every achievement — no matter how small — is celebrated. We believe that learning should be an adventure, and we make sure it is.`),
        order: 1,
      },
      {
        ...ctaBlock('Begin Your Child\'s Journey With Us', 'Schedule a school tour today and experience the difference.', 'Contact Us Today', '/contact'),
        order: 2,
      },
    ]),
    sectionVisibility: defaultSectionVisibility,
    themePreset: 'emerald',
    metaTitle: metaTitle,
    metaDescription: metaDesc,
  };
}

function secondaryTemplate(name: string, motto: string): WebsiteTemplate {
  const metaTitle = `${name} — A Premier Secondary School`;
  const metaDesc = `${name} offers world-class secondary education focused on academic excellence, character development, and leadership. ${motto ? `Motto: ${motto}` : ''}`;
  return {
    heroTitle: `${name} — Building Future Leaders Through Excellence in Education`,
    heroSubtitle: motto || 'Empowering students to achieve academic excellence, develop strong character, and lead with purpose',
    aboutTitle: `About ${name}`,
    aboutContent: `<h3>Our Mission</h3>
<p>At ${name}, our mission is to provide a rigorous, holistic, and character-based secondary education that prepares students for leadership, higher education, and lifelong success. We are committed to developing young people who are intellectually curious, morally grounded, and socially responsible.</p>
<h3>Our Vision</h3>
<p>To be a centre of academic excellence and character formation, producing graduates who excel in their chosen fields, contribute meaningfully to society, and lead with integrity and compassion.</p>
<h3>Our Core Values</h3>
<ul>
<li><strong>Academic Excellence:</strong> We set high standards and provide the support every student needs to achieve their personal best.</li>
<li><strong>Character & Integrity:</strong> We cultivate honesty, responsibility, respect, and ethical leadership in every student.</li>
<li><strong>Innovation:</strong> We embrace modern teaching methods, technology, and creative thinking to prepare students for a rapidly changing world.</li>
<li><strong>Service:</strong> We encourage students to give back to their community through service learning and outreach programs.</li>
<li><strong>Resilience:</strong> We build grit, determination, and a growth mindset in our students.</li>
</ul>
<h3>Why Choose ${name}?</h3>
<p>${name} offers a comprehensive secondary education that goes beyond textbooks. Our experienced and dedicated teachers, modern science and computer laboratories, well-stocked library, sports facilities, and vibrant co-curricular programs create an environment where students can discover their passions and develop their full potential.</p>
<p>We offer a wide range of subjects across the Sciences, Arts, and Commercial streams, preparing students for WASSCE, NECO, JAMB, and international examinations. Our students consistently achieve outstanding results and gain admission to top universities both locally and abroad.</p>
<p>Beyond academics, we offer leadership training, debate and public speaking, sports, cultural activities, and community service programs that build well-rounded, confident, and capable young leaders.</p>`,
    admissionsTitle: 'Admissions — Apply to Join Our School',
    admissionsContent: `<h3>Admissions Process</h3>
<p>Thank you for your interest in ${name}. We are currently accepting applications for the upcoming academic session. Our admissions process is designed to identify motivated students who will thrive in our academic environment.</p>
<ol>
<li><strong>Application:</strong> Complete the online or paper application form and submit it with all required documents.</li>
<li><strong>Entrance Examination:</strong> All applicants are required to sit for our entrance examination, which covers English, Mathematics, and General Knowledge.</li>
<li><strong>Interview:</strong> Shortlisted candidates and their parents/guardians will be invited for an interview with our admissions team.</li>
<li><strong>Admission Decision:</strong> Successful candidates will receive an offer of admission within two weeks of the interview.</li>
<li><strong>Acceptance & Enrollment:</strong> Accept your offer by completing the enrollment forms and paying the required fees.</li>
</ol>
<h3>Subject Tracks</h3>
<p>Students can choose from the following subject tracks based on their interests and career aspirations:</p>
<ul>
<li><strong>Science:</strong> Physics, Chemistry, Biology, Mathematics, Further Mathematics</li>
<li><strong>Arts:</strong> Literature in English, Government, History, Christian Religious Studies, French</li>
<li><strong>Commercial:</strong> Accounting, Commerce, Economics, Business Studies, Mathematics</li>
</ul>
<h3>Entry Requirements</h3>
<ul>
<li><strong>JSS1 (Year 7):</strong> Successful completion of primary education with satisfactory Continuous Assessment records. Age 10-12 years.</li>
<li><strong>SS1 (Year 10):</strong> Successful completion of Junior Secondary education with at least a Credit pass in English and Mathematics.</li>
<li><strong>Transfer Students:</strong> Students transferring from other schools must provide transfer certificates and academic records from their previous school.</li>
</ul>
<h3>Required Documents</h3>
<ul>
<li>Completed application form</li>
<li>Birth certificate or age declaration</li>
<li>Previous school reports (last 2 terms)</li>
<li>Passport photographs (2 copies)</li>
<li>Transfer certificate (for transfer students)</li>
<li>Medical/health records</li>
</ul>
<p><strong>School Hours:</strong> 7:30 AM — 3:00 PM (Monday to Friday)<br />
<strong>After-School Activities:</strong> 3:00 PM — 5:00 PM</p>
<p>For enquiries, please contact our admissions office. We look forward to welcoming you to ${name}.</p>`,
    featureCards: JSON.stringify([
      { icon: 'Award', title: 'Academic Excellence', description: 'Consistently outstanding results in WASSCE, NECO, and national examinations.' },
      { icon: 'Users', title: 'Leadership Development', description: 'Student council, prefectship, and leadership training programs that build confident leaders.' },
      { icon: 'Rocket', title: 'Science & Technology', description: 'Modern laboratories, computer science, robotics, and innovation programs.' },
      { icon: 'Zap', title: 'Sports & Athletics', description: 'Comprehensive sports program including football, basketball, athletics, and swimming.' },
    ]),
    extraSections: JSON.stringify([
      {
        ...textBlock('Our Students\' Achievements', `At ${name}, our students consistently distinguish themselves in academics, sports, and leadership. Our students have won numerous awards in national and regional competitions, including science fairs, debate championships, sports tournaments, and cultural festivals.\n\nWe are particularly proud of our 100% pass rate in WASSCE and NECO examinations over the past five years, with over 80% of our students achieving five credits or more, including English and Mathematics. Many of our graduates have gone on to attend top universities around the world.\n\nBeyond examinations, our students lead community service initiatives, organize charity events, and participate in Model United Nations conferences. We believe in developing the whole person — mind, body, and character.`),
        order: 0,
      },
      {
        ...textImageBlock('right', 'Our Dedicated Faculty', `The quality of a school is defined by the quality of its teachers. At ${name}, we are privileged to have a team of highly qualified, experienced, and passionate educators who are committed to bringing out the best in every student.\n\nOur teachers undergo continuous professional development and are trained in modern pedagogical approaches. They serve not just as instructors but as mentors, role models, and guides who support each student's academic and personal growth journey. With a favourable student-to-teacher ratio, every student receives the individual attention they deserve.`),
        order: 1,
      },
      {
        ...ctaBlock(`Join ${name} Today`, 'Apply now for the upcoming academic session and take the first step towards a bright future.', 'Apply Now', '/admissions'),
        order: 2,
      },
    ]),
    sectionVisibility: defaultSectionVisibility,
    themePreset: 'royal',
    metaTitle: metaTitle,
    metaDescription: metaDesc,
  };
}

function combinedTemplate(name: string, motto: string): WebsiteTemplate {
  const metaTitle = `${name} — A Complete Education from Primary to Graduation`;
  const metaDesc = `${name} offers seamless education from primary through secondary school. ${motto ? `Motto: ${motto}` : ''} Enrol your child for a complete educational journey.`;
  return {
    heroTitle: `${name} — A Complete Education Journey from Foundation to Graduation`,
    heroSubtitle: motto || 'Providing seamless,高质量 education from primary school through secondary school under one roof',
    aboutTitle: `About ${name}`,
    aboutContent: `<h3>Our Mission</h3>
<p>At ${name}, we are committed to providing a seamless, comprehensive education that takes students from their first day of primary school through to graduation from secondary school. We provide continuity of care, consistent values, and progressively challenging academics across all stages of a child's educational journey.</p>
<h3>Our Vision</h3>
<p>To be the leading choice for families seeking a complete, uninterrupted educational pathway for their children — producing well-rounded, confident, and academically excellent graduates who are prepared for the highest levels of tertiary education and beyond.</p>
<h3>Our Core Values</h3>
<ul>
<li><strong>Continuity:</strong> A unified curriculum and educational philosophy that spans both primary and secondary education, ensuring smooth transitions.</li>
<li><strong>Excellence:</strong> High academic standards at every stage, building a strong foundation in primary years and achieving outstanding results in secondary examinations.</li>
<li><strong>Holistic Development:</strong> We nurture every aspect of a child's development — intellectual, physical, social, emotional, and spiritual.</li>
<li><strong>Partnership:</strong> We work closely with parents as partners in their child's education journey.</li>
<li><strong>Innovation:</strong> Modern teaching methods, technology integration, and forward-thinking preparation for the future.</li>
</ul>
<h3>Why Choose ${name}?</h3>
<p>As a combined primary and secondary school, ${name} offers unique advantages. Your child experiences a consistent educational philosophy, familiar environment, and uninterrupted learning progression from primary through secondary school. There is no need to navigate the stressful transition to a new school at the critical secondary school entry point.</p>
<p>Our students benefit from long-term relationships with teachers who understand their strengths, challenges, and potential. Our curriculum is carefully designed to build year upon year, ensuring that foundations laid in primary school are strengthened and expanded in secondary school.</p>
<p>With modern facilities spanning both sections, a rich co-curricular program, and a track record of outstanding academic results, ${name} provides everything your child needs to succeed — all in one place.</p>`,
    admissionsTitle: 'Admissions — Begin Your Child\'s Journey With Us',
    admissionsContent: `<h3>Admissions Process</h3>
<p>We welcome applications from families seeking a quality education for their children. Whether joining us at the primary or secondary entry point, our admissions process is straightforward and supportive.</p>
<ol>
<li><strong>School Tour:</strong> Visit our campus to see our facilities, meet our staff, and experience our learning environment.</li>
<li><strong>Application:</strong> Submit the completed application form with all required documents.</li>
<li><strong>Assessment:</strong> Applicants undergo an age-appropriate assessment to help us place them in the right class.</li>
<li><strong>Interview:</strong> A meeting with the principal or head of section for the family.</li>
<li><strong>Admission & Enrollment:</strong> Receive your admission offer and complete the enrollment process.</li>
</ol>
<h3>Entry Points</h3>
<ul>
<li><strong>Primary Entry:</strong> Admission into Primary 1 — 6 (ages 5 — 11 years)</li>
<li><strong>Secondary Entry:</strong> Admission into JSS1 — SS3 (ages 10 — 17 years)</li>
<li><strong>Transfer Students:</strong> Students may transfer into any available class from other recognized schools</li>
</ul>
<h3>Required Documents</h3>
<ul>
<li>Completed application form</li>
<li>Birth certificate</li>
<li>Recent passport photographs (2 copies)</li>
<li>Previous school reports (last 2 terms)</li>
<li>Transfer certificate (if applicable)</li>
<li>Medical records</li>
</ul>
<p><strong>School Hours:</strong><br />
Primary Section: 7:30 AM — 2:00 PM<br />
Secondary Section: 7:30 AM — 3:00 PM</p>
<p>For more information, please contact our admissions office. We look forward to welcoming your family to ${name}.</p>`,
    featureCards: JSON.stringify([
      { icon: 'BookOpen', title: 'Continuous Curriculum', description: 'Seamless academic progression from primary through secondary with a unified educational approach.' },
      { icon: 'Rocket', title: 'Smooth Transition', description: 'No stressful school changes — your child progresses naturally through both sections.' },
      { icon: 'Star', title: 'Holistic Development', description: 'Academic, sporting, creative, and character development at every stage of education.' },
      { icon: 'Users', title: 'Expert Faculty', description: 'Dedicated teachers who guide students across their entire educational journey.' },
    ]),
    extraSections: JSON.stringify([
      {
        ...textBlock(`School Life at ${name}`, `Life at ${name} is vibrant, engaging, and full of opportunities. From the excited chatter of our youngest learners in the primary playground to the focused discussions in secondary school classrooms, our campus is alive with the energy of young people pursuing knowledge and personal growth.\n\nOur students participate in a wide array of activities including inter-house sports competitions, cultural days, science fairs, debate clubs, music and drama productions, community service projects, and educational excursions. There is always something happening at ${name}.\n\nWe believe that education extends beyond the classroom walls, and we provide countless opportunities for students to discover their talents, build friendships, and create memories that will last a lifetime.`),
        order: 0,
      },
      {
        ...textImageBlock('left', 'Upcoming Events & Open Days', `We regularly host open days, school tours, and information sessions for prospective families. These events are a wonderful opportunity to experience the ${name} community firsthand, meet our dedicated staff, tour our facilities, and learn about our educational programs.\n\nOpen days include classroom visits, interactions with current students, presentations by the principal and section heads, and a question-and-answer session. Refreshments are provided. We encourage all prospective families to attend an open day before applying.`),
        order: 1,
      },
      {
        ...ctaBlock('Schedule a School Tour', `Experience the ${name} difference firsthand. Book a tour of our campus today.`, 'Book a Tour', '/contact'),
        order: 2,
      },
    ]),
    sectionVisibility: defaultSectionVisibility,
    themePreset: 'purple',
    metaTitle: metaTitle,
    metaDescription: metaDesc,
  };
}

function higherInstitutionTemplate(name: string, motto: string): WebsiteTemplate {
  const metaTitle = `${name} — A Premier Higher Institution`;
  const metaDesc = `${name} offers accredited tertiary programs designed to prepare students for successful careers. ${motto ? `Motto: ${motto}` : ''} Apply now.`;
  return {
    heroTitle: `${name} — Empowering Minds, Transforming Futures`,
    heroSubtitle: motto || 'Providing quality higher education that prepares students for professional success and lifelong learning',
    aboutTitle: `About ${name}`,
    aboutContent: `<h3>Our Mission</h3>
<p>${name} is dedicated to providing accessible, high-quality tertiary education that equips students with the knowledge, skills, and values needed to excel in their chosen careers and contribute meaningfully to society. We bridge the gap between academic learning and professional practice.</p>
<h3>Our Vision</h3>
<p>To be a leading institution of higher learning recognized for academic excellence, innovative research, industry partnerships, and the production of highly skilled graduates who drive economic growth and social development.</p>
<h3>Our Core Values</h3>
<ul>
<li><strong>Academic Excellence:</strong> We maintain rigorous academic standards and continuously update our curriculum to meet industry demands.</li>
<li><strong>Innovation & Research:</strong> We foster a culture of inquiry, critical thinking, and practical research that addresses real-world challenges.</li>
<li><strong>Professionalism:</strong> We prepare students for the workplace through practical training, internships, and industry exposure.</li>
<li><strong>Inclusivity:</strong> We provide equal opportunity for all qualified students regardless of background.</li>
<li><strong>Integrity:</strong> We uphold the highest ethical standards in academics, administration, and community engagement.</li>
</ul>
<h3>Why Choose ${name}?</h3>
<p>${name} offers accredited programs delivered by experienced faculty members who combine academic expertise with practical industry experience. Our modern facilities include well-equipped lecture halls, computer laboratories, libraries, and workshops designed to provide students with a conducive learning environment.</p>
<p>We maintain strong partnerships with industries and organizations to provide our students with internship opportunities, industrial training, and job placement support. Our career services office works tirelessly to connect graduates with employers. Our alumni network spans various industries, providing valuable mentorship and networking opportunities for current students.</p>
<p>Beyond academics, we offer a vibrant campus life with student organizations, sports, cultural activities, and community service programs that ensure our students develop both professionally and personally.</p>`,
    admissionsTitle: `Admissions — Apply to Join ${name}`,
    admissionsContent: `<h3>Admissions Process</h3>
<p>Thank you for your interest in ${name}. We offer a range of programs designed to prepare you for a successful career. Our admissions process is transparent and merit-based.</p>
<ol>
<li><strong>Choose Your Program:</strong> Review our programs and select the one that aligns with your career goals.</li>
<li><strong>Submit Application:</strong> Complete the online application form and upload all required documents.</li>
<li><strong>Entrance Screening:</strong> Applicants may be required to sit for an entrance examination or screening exercise.</li>
<li><strong>Admission Review:</strong> Our admissions committee reviews all applications and makes admission decisions.</li>
<li><strong>Acceptance & Registration:</strong> Accept your offer, pay the required fees, and complete your registration.</li>
</ol>
<h3>Programs Offered</h3>
<ul>
<li><strong>Science & Technology:</strong> Computer Science, Information Technology, Software Engineering, Data Science</li>
<li><strong>Business & Management:</strong> Business Administration, Accounting, Banking & Finance, Entrepreneurship</li>
<li><strong>Arts & Humanities:</strong> Mass Communication, International Relations, Economics, Political Science</li>
<li><strong>Professional Studies:</strong> Law, Nursing, Medical Laboratory Science, Pharmacy</li>
</ul>
<h3>Entry Requirements</h3>
<ul>
<li><strong>Undergraduate Programs:</strong> Minimum of five credits in SSCE/GCE O-Level including English and Mathematics, obtained in not more than two sittings.</li>
<li><strong>Direct Entry:</strong> A-Level passes, ND, NCE, or equivalent qualifications in relevant fields.</li>
<li><strong>Postgraduate Programs:</strong> Bachelor's degree with at least Second Class Lower in a relevant discipline.</li>
</ul>
<h3>Required Documents</h3>
<ul>
<li>Completed application form</li>
<li>Academic transcripts and certificates</li>
<li>Birth certificate or age declaration</li>
<li>Passport photographs (2 copies)</li>
<li>Letter of recommendation (for postgraduate programs)</li>
<li>Statement of purpose (for postgraduate programs)</li>
</ul>
<p><strong>Academic Calendar:</strong> Two semesters per academic session with an optional summer school program.</p>
<p>For enquiries, please contact our admissions office. We look forward to welcoming you to ${name}.</p>`,
    featureCards: JSON.stringify([
      { icon: 'GraduationCap', title: 'Accredited Programs', description: 'All our programs are fully accredited by the relevant regulatory bodies and recognized by employers.' },
      { icon: 'Lightbulb', title: 'Research & Innovation', description: 'State-of-the-art laboratories and research centres driving innovation and discovery.' },
      { icon: 'Globe', title: 'Vibrant Student Life', description: 'Clubs, societies, sports, and cultural activities that enrich the student experience.' },
      { icon: 'Target', title: 'Career Services', description: 'Internships, job placement, career counselling, and strong industry partnerships.' },
    ]),
    extraSections: JSON.stringify([
      {
        ...textBlock('Departments & Programs', `${name} offers a diverse range of programs across multiple faculties and departments. Our curriculum is regularly reviewed and updated in consultation with industry experts to ensure that our graduates are equipped with the skills and knowledge demanded by today's employers.\n\nEach department is led by experienced faculty members who are experts in their fields. Our programs combine theoretical foundations with practical application, ensuring that students graduate not only with knowledge but with the ability to apply that knowledge effectively in professional settings.\n\nWe also offer short-term professional certification programs, workshops, and continuing education courses for working professionals looking to upgrade their skills.`),
        order: 0,
      },
      {
        ...textImageBlock('right', 'Campus Life & Student Support', `At ${name}, we believe that the tertiary education experience extends beyond the classroom. Our campus provides a vibrant, inclusive, and supportive environment where students can grow, connect, and thrive.\n\nWe offer comprehensive student support services including academic advising, counselling and wellness services, financial aid guidance, and career counselling. Our student affairs office organizes orientation programs, leadership retreats, cultural festivals, and community service initiatives that build a strong sense of community and belonging.`),
        order: 1,
      },
      {
        ...textBlock('Alumni Success Stories', `Our alumni are our greatest ambassadors. ${name} graduates have gone on to build successful careers in various fields including technology, finance, healthcare, education, government, and entrepreneurship. Many hold leadership positions in multinational corporations, government agencies, and non-profit organizations.\n\nOur alumni network is active and engaged, providing mentorship, internship opportunities, and career connections for current students. We regularly feature alumni success stories on our website and social media platforms, celebrating the achievements of our graduates and inspiring the next generation of ${name} students.`),
        order: 2,
      },
      {
        ...ctaBlock('Take the Next Step in Your Education', `Apply to ${name} today and begin your journey towards a successful career.`, 'Apply Now', '/admissions'),
        order: 3,
      },
    ]),
    sectionVisibility: defaultSectionVisibility,
    themePreset: 'slate',
    metaTitle: metaTitle,
    metaDescription: metaDesc,
  };
}

function defaultTemplate(name: string, motto: string): WebsiteTemplate {
  const metaTitle = `${name} — Excellence in Education`;
  const metaDesc = `Welcome to ${name}, a school committed to providing quality education and developing well-rounded students. ${motto ? `Motto: ${motto}` : ''}`;
  return {
    heroTitle: `${name} — Excellence in Education`,
    heroSubtitle: motto || 'Providing quality education that nurtures talents, builds character, and prepares students for a successful future',
    aboutTitle: `About ${name}`,
    aboutContent: `<h3>Our Mission</h3>
<p>At ${name}, we are committed to providing a well-rounded education that develops the whole person — academically, socially, morally, and physically. We believe that every student has unique talents and potential waiting to be discovered and nurtured.</p>
<h3>Our Vision</h3>
<p>To be a school of choice where students are equipped with the knowledge, skills, and values to excel in their chosen paths and make meaningful contributions to society.</p>
<h3>Our Core Values</h3>
<ul>
<li><strong>Excellence:</strong> We strive for the highest standards in everything we do.</li>
<li><strong>Respect:</strong> We treat everyone with dignity, kindness, and consideration.</li>
<li><strong>Responsibility:</strong> We take ownership of our learning, our actions, and our community.</li>
<li><strong>Perseverance:</strong> We encourage resilience, determination, and a never-give-up attitude.</li>
</ul>
<h3>Why Choose ${name}?</h3>
<p>With dedicated teachers, a supportive learning environment, modern facilities, and a commitment to developing the whole child, ${name} provides an educational experience that prepares students not just for examinations, but for life.</p>`,
    admissionsTitle: 'Admissions',
    admissionsContent: `<h3>Admissions Process</h3>
<p>We welcome applications from families seeking a quality education for their children. Our admissions process is simple and transparent.</p>
<ol>
<li>Submit a completed application form</li>
<li>Provide previous academic records</li>
<li>Schedule an entrance assessment/interview</li>
<li>Receive admission decision</li>
<li>Complete enrollment and fee payment</li>
</ol>
<h3>Required Documents</h3>
<ul>
<li>Completed application form</li>
<li>Birth certificate</li>
<li>Previous school reports</li>
<li>Passport photographs (2 copies)</li>
<li>Medical/health records</li>
</ul>
<p>For more information, please contact the school office.</p>`,
    featureCards: JSON.stringify([
      { icon: 'GraduationCap', title: 'Quality Education', description: 'Comprehensive curriculum delivered by qualified and experienced teachers.' },
      { icon: 'Users', title: 'Caring Community', description: 'A warm, inclusive environment where every student feels they belong.' },
      { icon: 'Star', title: 'Holistic Development', description: 'Balanced focus on academics, sports, arts, and character education.' },
      { icon: 'Shield', title: 'Safe Environment', description: 'A secure campus where students can learn, play, and grow with confidence.' },
    ]),
    extraSections: JSON.stringify([
      {
        ...textBlock(`Welcome to ${name}`, `At ${name}, we are dedicated to providing an exceptional educational experience for every student. Our school is a place where academic achievement, personal growth, and community spirit come together.\n\nWe invite you to explore our website, learn about our programs, and discover what makes ${name} a special place for learning and growth. Whether you are a prospective family, a current parent, or a member of our community, we are glad you are here.`),
        order: 0,
      },
      {
        ...ctaBlock('Ready to Join Us?', 'Contact us today to learn more about our programs or schedule a visit.', 'Contact Us', '/contact'),
        order: 1,
      },
    ]),
    sectionVisibility: defaultSectionVisibility,
    themePreset: 'emerald',
    metaTitle: metaTitle,
    metaDescription: metaDesc,
  };
}

export function getWebsiteTemplate(schoolType: string, schoolName: string, schoolMotto: string): WebsiteTemplate {
  const name = schoolName || 'Your School';
  const motto = schoolMotto || '';

  switch (schoolType.toLowerCase().trim()) {
    case 'primary':
      return primaryTemplate(name, motto);
    case 'secondary':
      return secondaryTemplate(name, motto);
    case 'primary_secondary':
      return combinedTemplate(name, motto);
    case 'higher_institution':
      return higherInstitutionTemplate(name, motto);
    default:
      return defaultTemplate(name, motto);
  }
}
