// Medic AI's built-in knowledge and app links.
// Used to (1) answer common questions when the online AI is not available, and (2) attach the right
// app actions to every answer: matching hospitals to book, the emergency call, or a first-aid guide.
// Content is general health information for Nigeria, written to be safe and conservative.

export interface Topic {
  id: string
  keys: RegExp
  specialties: string[]
  guide?: string
  answer: string
}

export const TOPICS: Topic[] = [
  { id: 'child-fever', keys: /(child|baby|pikin|ọmọ|omo|yaro|nwa).*(fever|hot|temperature|ibà|iba|zazza|ahụ ọkụ)|(fever|hot body|ibà).*(child|baby|pikin)/i, specialties: ['Pediatrics', 'General practice'],
    answer: '**Fever in a child**\n\n1. Check the temperature if you can. 38°C or more is a fever.\n2. Give paracetamol syrup at the dose printed on the pack for the child\'s age or weight. Do not give aspirin to children.\n3. Keep them in light clothing, give plenty of fluids or breast milk, and sponge with lukewarm (not cold) water.\n4. In Nigeria, a fever can be malaria. Get a malaria test (RDT) at a clinic or pharmacy the same day, especially for children under 5.\n\n**Go to an emergency unit now if** the child is very drowsy or hard to wake, has a fit (convulsion), is breathing fast or struggling, is not drinking, has a stiff neck or a rash that does not fade, or is under 3 months old with any fever.' },
  { id: 'malaria-typhoid', keys: /malaria|typhoid|iba|ibà|typho/i, specialties: ['General practice', 'Laboratory'],
    answer: '**Malaria or typhoid?**\n\nBoth can cause fever, headache and weakness, so you cannot tell them apart by symptoms alone.\n\n1. **Malaria** usually comes with fever that rises and falls, chills, sweating and body pains. A quick malaria test (RDT) or blood film confirms it.\n2. **Typhoid** tends to cause a fever that climbs over several days, stomach pain, constipation or diarrhoea. It needs a proper test; the Widal test alone is often misleading.\n3. Don\'t treat yourself for both "just in case". Wrong or half doses of antibiotics and antimalarials cause resistance.\n\n**See a doctor today** for any fever lasting more than 2 days. Go to emergency for confusion, fits, very dark urine, yellow eyes, severe vomiting or bleeding.' },
  { id: 'bp', keys: /blood pressure|hypertension|\bbp\b|high blood|ẹ̀jẹ̀ ríru|eje riru|hawan jini|ọbara mgbali/i, specialties: ['Cardiology', 'General practice'],
    answer: '**Lowering blood pressure**\n\n1. Cut down on salt and seasoning cubes; taste food before adding more. Limit processed and fried foods.\n2. Eat more vegetables (ugu, efo, okra), fruits, beans and whole grains.\n3. Walk briskly for 30 minutes on most days, keep a healthy weight, limit alcohol and stop smoking.\n4. If you have been prescribed BP medicine, take it every day even when you feel well. Don\'t stop it on your own.\n5. Check your BP regularly; many pharmacies can measure it.\n\n**Go to emergency now** for a severe headache with blurred vision, chest pain, weakness on one side, confused speech or difficulty breathing.' },
  { id: 'diabetes', keys: /diabet|sugar level|blood sugar|sugar don high/i, specialties: ['General practice', 'Laboratory'],
    answer: '**Living with diabetes**\n\n1. Take your medicines or insulin exactly as prescribed and check your sugar as advised.\n2. Choose smaller portions of swallow, rice and bread; add vegetables and protein; avoid sugary drinks and malt.\n3. Stay active and check your feet daily for cuts or sores.\n4. Get regular check-ups for eyes, kidneys and blood pressure.\n\n**Get help urgently** for very high or very low sugar: confusion, sweating and shaking, drowsiness, deep fast breathing or vomiting.' },
  { id: 'sickle', keys: /sickle|\bSS\b|genotype|crisis/i, specialties: ['General practice', 'Pediatrics'],
    answer: '**Sickle cell (SS)**\n\n1. Drink plenty of water every day, avoid getting too hot or too cold, and rest when tired.\n2. Gentle, regular exercise is good; build up slowly, drink extra water and stop if you feel pain or breathless.\n3. Take folic acid and malaria prevention as prescribed, keep vaccinations up to date, and attend your sickle cell clinic.\n4. Treat infections early.\n\n**Go to emergency** for severe pain not helped by usual medicine, chest pain or breathing difficulty, fever, sudden weakness, a painful erection lasting over 2 hours, or very pale or yellow skin.' },
  { id: 'pregnancy', keys: /pregnan|antenatal|belle woman|oyún|oyun|ciki|ime\b|expecting/i, specialties: ['Obstetrics & Gynecology', 'Radiology'],
    answer: '**Pregnancy: what to watch**\n\n1. Start antenatal care early and attend every visit; you\'ll get checks, scans, tetanus vaccination and malaria prevention.\n2. Take folic acid and iron as advised, sleep under a treated mosquito net, eat well and drink plenty of water.\n\n**Go to an emergency unit immediately for:** bleeding from the vagina, severe headache or blurred vision, swelling of the face or hands, fits, severe belly pain, fluid leaking, high fever, or the baby moving much less than usual.' },
  { id: 'diarrhoea', keys: /diarr|running stomach|purg|vomit|stooling|cholera/i, specialties: ['General practice', 'Pediatrics'],
    answer: '**Diarrhoea and vomiting**\n\n1. Prevent dehydration: give ORS (oral rehydration salts) little and often. For children, also give zinc for 10 days as advised by a health worker.\n2. Keep eating light food and breastfeeding babies.\n3. Wash hands with soap and drink safe water.\n4. Don\'t take antibiotics unless a health worker prescribes them.\n\n**Get help urgently** for blood in stool, signs of dehydration (very little urine, sunken eyes, very drowsy), a baby who can\'t feed, or vomiting everything.' },
  { id: 'headache', keys: /headache|head dey pain|migraine|ori fifo/i, specialties: ['General practice'],
    answer: '**Headache**\n\n1. Rest in a quiet place, drink water and eat if you haven\'t.\n2. Paracetamol at the pack dose usually helps.\n3. Common causes include dehydration, stress, eye strain, lack of sleep, malaria and high blood pressure; have your BP checked if headaches keep coming back.\n\n**Go to emergency** for a sudden, severe "worst ever" headache, headache with fever and stiff neck, confusion, weakness, trouble speaking, or after a head injury.' },
  { id: 'cough', keys: /cough|catarrh|cold|flu|chest infection|tb\b|tuberculosis/i, specialties: ['General practice'],
    answer: '**Cough and catarrh**\n\n1. Most colds clear in 7–10 days: rest, warm fluids, honey and lemon (not for babies under 1).\n2. Antibiotics don\'t help colds.\n3. A cough lasting more than 2 weeks, with weight loss, night sweats or blood, needs a TB test; testing and treatment are free at many public clinics.\n\n**Get urgent help** for fast or difficult breathing, chest pain, lips turning blue, or a baby who can\'t feed.' },
  { id: 'dental', keys: /tooth|teeth|dental|dentist|gum/i, specialties: ['Dental'],
    answer: '**Toothache**\n\n1. Rinse with warm salt water and take paracetamol or ibuprofen at the pack dose.\n2. Avoid very hot, cold or sugary food on that side.\n3. Book a dentist; pain usually means decay or infection that won\'t heal by itself.\n\n**Go urgently** if your face or jaw is swelling, you have a fever, or trouble swallowing or breathing.' },
  { id: 'mental', keys: /stress|anxi|depress|sad|can't sleep|mental|panic|suicid|kill myself|self.?harm/i, specialties: ['Mental health', 'General practice'],
    answer: '**Your mental health matters**\n\nFeeling stressed, low or anxious is common, and help works.\n\n1. Talk to someone you trust about how you feel.\n2. Keep a simple routine: sleep, meals, a short walk, less alcohol.\n3. A doctor or mental health professional can help; it is a normal part of healthcare.\n\n**If you are thinking of ending your life or harming yourself, please get help now:** go to the nearest hospital emergency unit or ask someone to take you, and don\'t stay alone.' },
  { id: 'scan', keys: /scan|ultrasound|x-?ray|ct\b|mri/i, specialties: ['Radiology'],
    answer: '**Getting a scan**\n\nScans like ultrasound, X-ray, CT and MRI are done in the radiology (imaging) unit. Bring your doctor\'s request form if you have one, and ask whether you need to prepare (for example a full bladder for some pelvic scans). Below are hospitals near you that offer imaging. Book a time to avoid waiting.' },
  { id: 'lab', keys: /blood test|lab test|laboratory|test result|check my blood|full blood count/i, specialties: ['Laboratory'],
    answer: '**Lab tests**\n\nMost blood tests are done in the hospital laboratory. Some tests need fasting (often 8–12 hours for sugar or cholesterol), so ask first. Bring your request form. Below are hospitals near you with a laboratory.' },
  { id: 'eye', keys: /eye|vision|apollo|conjunctivitis|glasses/i, specialties: ['Ophthalmology', 'General practice'],
    answer: '**Eye problems**\n\nRed, itchy or sticky eyes are often an infection ("Apollo"). Wash hands often, don\'t share towels, and don\'t put urine, breast milk or herbs in the eyes. See a health worker for drops.\n\n**Go urgently** for sudden loss of vision, severe eye pain, or an injury or chemical in the eye (rinse with clean water for 15 minutes first).' },
]

export function matchTopic(q: string): Topic | null {
  return TOPICS.find((t) => t.keys.test(q)) ?? null
}
