/**
 * Interface translations. English is the source. Pidgin, Yoruba, Hausa and Igbo cover the
 * navigation, emergency screen, home and assistant. They should be reviewed by native speakers
 * before launch; first-aid steps stay in English until a clinician has checked each translation.
 */
export type Lang = 'en' | 'pcm' | 'yo' | 'ha' | 'ig'

export const LANGUAGES: { code: Lang; name: string; native: string }[] = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'pcm', name: 'Nigerian Pidgin', native: 'Naijá (Pidgin)' },
  { code: 'yo', name: 'Yoruba', native: 'Yorùbá' },
  { code: 'ha', name: 'Hausa', native: 'Hausa' },
  { code: 'ig', name: 'Igbo', native: 'Igbo' },
]

const en = {
  'nav.home': 'Home', 'nav.find': 'Find care', 'nav.findShort': 'Find', 'nav.bookings': 'Bookings', 'nav.vault': 'Health Vault', 'nav.vaultShort': 'Vault',
  'nav.wellness': 'Wellness', 'nav.firstAid': 'First aid', 'nav.symptoms': 'Check symptoms', 'nav.signIn': 'Sign in', 'nav.createAccount': 'Create account',
  'nav.emergency': 'Emergency', 'nav.assistant': 'Ask Medic AI', 'nav.assistantShort': 'Ask AI', 'nav.language': 'Language',
  'home.help': 'How can we help you today?', 'home.search': 'Find a hospital, doctor or service', 'home.searchBtn': 'Search',
  'home.findCare': 'Find Care', 'home.findCareSub': 'Hospitals near you', 'home.book': 'Book Appointment', 'home.bookSub': 'Earliest slots',
  'home.emergency': 'Emergency', 'home.emergencySub': 'Call 112 · first aid', 'home.vault': 'Health Vault', 'home.vaultSub': 'Your health info',
  'greet.morning': 'Good morning', 'greet.afternoon': 'Good afternoon', 'greet.evening': 'Good evening',
  'em.call': 'Call 112', 'em.national': 'National Emergency Number · free to call',
  'em.safety': "If someone is in immediate danger, call 112 now. Medic Hub gives guidance and helps you find care; it does not dispatch ambulances.",
  'em.findHospitals': 'Find emergency hospitals near me', 'em.findSub': 'Open emergency departments, closest first',
  'em.what': 'What happened?', 'em.tap': 'Tap for step-by-step first aid with video.', 'em.notSure': 'Not sure how serious it is?', 'em.library': 'First aid video library',
  'em.mode': 'Emergency mode', 'em.exit': 'Exit', 'em.askAi': 'Ask Medic AI in your language',
  'g.severe-bleeding': 'Severe bleeding', 'g.chest-pain': 'Chest pain', 'g.difficulty-breathing': 'Difficulty breathing', 'g.stroke': 'Stroke symptoms',
  'g.seizure': 'Seizure', 'g.burn': 'Burn', 'g.choking': 'Choking', 'g.allergic-reaction': 'Severe allergic reaction', 'g.unconscious': 'Fainting or unresponsive',
  'g.serious-injury': 'Serious injury', 'g.poisoning': 'Poisoning', 'g.electric-shock': 'Electric shock',
  'ai.title': 'Medic AI', 'ai.subtitle': 'Ask health questions in your language. General guidance, not a diagnosis.',
  'ai.placeholder': 'Ask about symptoms, medicines, first aid, pregnancy, nutrition…', 'ai.send': 'Send', 'ai.stop': 'Stop', 'ai.thinking': 'Thinking…',
  'ai.disclaimer': 'Medic AI gives general health information. It does not diagnose or prescribe. In an emergency, call 112.',
  'ai.useVault': 'Use my Health Vault to personalise answers', 'ai.new': 'New chat', 'ai.suggest': 'Try asking',
  'ai.redflag': 'This sounds like it could be an emergency. Call 112 now or go to the nearest emergency unit.',
  'ai.offline': 'Medic AI needs a connection to answer in full. Here is what our guides say:', 'ai.unavailable': 'The AI assistant isn’t available right now. Here is what our guides say:',
  'lang.title': 'Language', 'lang.sub': 'Choose the language for Medic Hub and Medic AI.', 'lang.note': 'Translations are being reviewed by native speakers. First-aid steps stay in English until a clinician checks them.',
}
type Dict = typeof en
export type Key = keyof Dict

const pcm: Partial<Dict> = {
  'nav.home': 'Home', 'nav.find': 'Find hospital', 'nav.findShort': 'Find', 'nav.bookings': 'Booking dem', 'nav.vault': 'Health Vault', 'nav.vaultShort': 'Vault',
  'nav.wellness': 'Body wellness', 'nav.firstAid': 'First aid', 'nav.symptoms': 'Check wetin dey do you', 'nav.signIn': 'Enter', 'nav.createAccount': 'Open account',
  'nav.emergency': 'Emergency', 'nav.assistant': 'Ask Medic AI', 'nav.assistantShort': 'Ask AI', 'nav.language': 'Language',
  'home.help': 'Wetin we fit do for you today?', 'home.search': 'Find hospital, doctor or service', 'home.searchBtn': 'Search',
  'home.findCare': 'Find hospital', 'home.findCareSub': 'Hospital wey dey near you', 'home.book': 'Book appointment', 'home.bookSub': 'Time wey dey free',
  'home.emergency': 'Emergency', 'home.emergencySub': 'Call 112 · first aid', 'home.vault': 'Health Vault', 'home.vaultSub': 'Your health info',
  'greet.morning': 'Good morning', 'greet.afternoon': 'Good afternoon', 'greet.evening': 'Good evening',
  'em.call': 'Call 112', 'em.national': 'Na Nigeria emergency number · e free',
  'em.safety': 'If person life dey for danger, call 112 now now. Medic Hub go guide you and show you hospital; e no dey send ambulance.',
  'em.findHospitals': 'Find emergency hospital wey near me', 'em.findSub': 'Emergency unit wey open, the nearest first',
  'em.what': 'Wetin happen?', 'em.tap': 'Press am to see first aid step by step with video.', 'em.notSure': 'You no sure how e serious reach?', 'em.library': 'First aid video dem',
  'em.mode': 'Emergency mode', 'em.exit': 'Comot', 'em.askAi': 'Ask Medic AI for your language',
  'g.severe-bleeding': 'Blood wey no gree stop', 'g.chest-pain': 'Chest pain', 'g.difficulty-breathing': 'Breathing dey hard', 'g.stroke': 'Stroke signs',
  'g.seizure': 'Seizure (jerking)', 'g.burn': 'Burn', 'g.choking': 'Something hook for throat', 'g.allergic-reaction': 'Serious allergy', 'g.unconscious': 'Person faint or no dey answer',
  'g.serious-injury': 'Serious wound or accident', 'g.poisoning': 'Poison', 'g.electric-shock': 'Current shock',
  'ai.subtitle': 'Ask health question for your language. Na general advice, no be diagnosis.',
  'ai.placeholder': 'Ask about sickness, medicine, first aid, belle, food…', 'ai.send': 'Send', 'ai.stop': 'Stop', 'ai.thinking': 'E dey think…',
  'ai.disclaimer': 'Medic AI dey give general health info. E no fit diagnose or write drug. For emergency, call 112.',
  'ai.useVault': 'Use my Health Vault make answer fit me', 'ai.new': 'New chat', 'ai.suggest': 'Try ask',
  'ai.redflag': 'E be like emergency. Call 112 now or go the nearest emergency unit.',
  'lang.title': 'Language', 'lang.sub': 'Choose the language wey you want for Medic Hub and Medic AI.',
}

const yo: Partial<Dict> = {
  'nav.home': 'Ilé', 'nav.find': 'Wá ilé ìwòsàn', 'nav.findShort': 'Wá', 'nav.bookings': 'Ìforúkọsílẹ̀', 'nav.vault': 'Àpótí Ìlera', 'nav.vaultShort': 'Àpótí',
  'nav.wellness': 'Àlàáfíà ara', 'nav.firstAid': 'Ìtọ́jú pàjáwìrì', 'nav.symptoms': 'Ṣàyẹ̀wò àmì àìsàn', 'nav.signIn': 'Wọlé', 'nav.createAccount': 'Ṣí àkántì',
  'nav.emergency': 'Pàjáwìrì', 'nav.assistant': 'Béèrè lọ́wọ́ Medic AI', 'nav.assistantShort': 'AI', 'nav.language': 'Èdè',
  'home.help': 'Báwo la ṣe lè ràn ọ́ lọ́wọ́ lónìí?', 'home.search': 'Wá ilé ìwòsàn, dókítà tàbí iṣẹ́', 'home.searchBtn': 'Wá',
  'home.findCare': 'Wá ìtọ́jú', 'home.findCareSub': 'Ilé ìwòsàn nítòsí rẹ', 'home.book': 'Gba àkókò', 'home.bookSub': 'Àkókò tó yá jù',
  'home.emergency': 'Pàjáwìrì', 'home.emergencySub': 'Pe 112 · ìtọ́jú pàjáwìrì', 'home.vault': 'Àpótí Ìlera', 'home.vaultSub': 'Ìwífún ìlera rẹ',
  'greet.morning': 'Ẹ káàárọ̀', 'greet.afternoon': 'Ẹ káàsán', 'greet.evening': 'Ẹ kúùrọ̀lẹ́',
  'em.call': 'Pe 112', 'em.national': 'Nọ́mbà pàjáwìrì orílẹ̀-èdè · ọ̀fẹ́ ni',
  'em.safety': 'Tí ẹ̀mí ẹnìkan bá wà nínú ewu, pe 112 báyìí. Medic Hub ń fúnni ní ìtọ́sọ́nà, kò rán ọkọ̀ aláìsàn.',
  'em.findHospitals': 'Wá ilé ìwòsàn pàjáwìrì nítòsí mi', 'em.findSub': 'Ẹ̀ka pàjáwìrì tó ṣí, èyí tó sún mọ́ jù lọ́kọ́',
  'em.what': 'Kí ló ṣẹlẹ̀?', 'em.tap': 'Tẹ̀ ẹ́ fún ìtọ́jú ní ìpele-ìpele pẹ̀lú fídíò.', 'em.notSure': 'Ṣé o kò dá ọ lójú bí ó ti le tó?', 'em.library': 'Àwọn fídíò ìtọ́jú pàjáwìrì',
  'em.mode': 'Ipò pàjáwìrì', 'em.exit': 'Jáde', 'em.askAi': 'Béèrè lọ́wọ́ Medic AI ní èdè rẹ',
  'g.severe-bleeding': 'Ẹ̀jẹ̀ tó ń ṣàn púpọ̀', 'g.chest-pain': 'Ìrora àyà', 'g.difficulty-breathing': 'Ìṣòro mímí', 'g.stroke': 'Àmì àrùn rọpárọsẹ̀',
  'g.seizure': 'Gìrì', 'g.burn': 'Iná jó', 'g.choking': 'Nǹkan há ní ọ̀fun', 'g.allergic-reaction': 'Ìfèsì ara tó le', 'g.unconscious': 'Dákú tàbí kò dáhùn',
  'g.serious-injury': 'Ọgbẹ́ tó lágbára', 'g.poisoning': 'Májèlé', 'g.electric-shock': 'Iná mọ̀nàmọ́ná gbé e',
  'ai.subtitle': 'Béèrè ìbéèrè ìlera ní èdè rẹ. Ìmọ̀ràn gbogbogbò ni, kì í ṣe àyẹ̀wò.',
  'ai.placeholder': 'Béèrè nípa àìsàn, oògùn, ìtọ́jú pàjáwìrì, oyún, oúnjẹ…', 'ai.send': 'Fi ránṣẹ́', 'ai.stop': 'Dúró', 'ai.thinking': 'Ó ń ronú…',
  'ai.disclaimer': 'Medic AI ń fún ọ ní ìwífún ìlera gbogbogbò. Kì í ṣe àyẹ̀wò tàbí ìwé oògùn. Ní pàjáwìrì, pe 112.',
  'ai.useVault': 'Lo Àpótí Ìlera mi láti ṣe ìdáhùn fún mi', 'ai.new': 'Ìjíròrò tuntun', 'ai.suggest': 'Gbìyànjú láti béèrè',
  'ai.redflag': 'Èyí dà bí pàjáwìrì. Pe 112 báyìí tàbí lọ sí ẹ̀ka pàjáwìrì tó sún mọ́ jù.',
  'lang.title': 'Èdè', 'lang.sub': 'Yan èdè fún Medic Hub àti Medic AI.',
}

const ha: Partial<Dict> = {
  'nav.home': 'Gida', 'nav.find': 'Nemo asibiti', 'nav.findShort': 'Nemo', 'nav.bookings': 'Alƙawura', 'nav.vault': 'Ma’ajiyar Lafiya', 'nav.vaultShort': 'Ma’ajiya',
  'nav.wellness': 'Lafiyar jiki', 'nav.firstAid': 'Taimakon gaggawa', 'nav.symptoms': 'Duba alamomi', 'nav.signIn': 'Shiga', 'nav.createAccount': 'Buɗe asusu',
  'nav.emergency': 'Gaggawa', 'nav.assistant': 'Tambayi Medic AI', 'nav.assistantShort': 'AI', 'nav.language': 'Harshe',
  'home.help': 'Ta yaya za mu taimaka maka yau?', 'home.search': 'Nemo asibiti, likita ko sabis', 'home.searchBtn': 'Nemo',
  'home.findCare': 'Nemo kulawa', 'home.findCareSub': 'Asibitoci kusa da kai', 'home.book': 'Ɗauki alƙawari', 'home.bookSub': 'Lokutan farko',
  'home.emergency': 'Gaggawa', 'home.emergencySub': 'Kira 112 · taimakon gaggawa', 'home.vault': 'Ma’ajiyar Lafiya', 'home.vaultSub': 'Bayanan lafiyarka',
  'greet.morning': 'Ina kwana', 'greet.afternoon': 'Barka da rana', 'greet.evening': 'Barka da yamma',
  'em.call': 'Kira 112', 'em.national': 'Lambar gaggawa ta ƙasa · kyauta ce',
  'em.safety': 'Idan rayuwar wani na cikin haɗari, kira 112 yanzu. Medic Hub na ba da jagora, ba ya aika motar asibiti.',
  'em.findHospitals': 'Nemo asibitin gaggawa kusa da ni', 'em.findSub': 'Sassan gaggawa da ke buɗe, mafi kusa da farko',
  'em.what': 'Me ya faru?', 'em.tap': 'Danna don matakan taimakon gaggawa tare da bidiyo.', 'em.notSure': 'Ba ka tabbata ko yaya tsananin yake ba?', 'em.library': 'Bidiyoyin taimakon gaggawa',
  'em.mode': 'Yanayin gaggawa', 'em.exit': 'Fita', 'em.askAi': 'Tambayi Medic AI da harshenka',
  'g.severe-bleeding': 'Zubar jini mai tsanani', 'g.chest-pain': 'Ciwon ƙirji', 'g.difficulty-breathing': 'Wahalar numfashi', 'g.stroke': 'Alamomin shanyewar jiki',
  'g.seizure': 'Farfaɗiya', 'g.burn': 'Ƙuna', 'g.choking': 'Shaƙewa', 'g.allergic-reaction': 'Mummunan rashin lafiyar jiki', 'g.unconscious': 'Suma ko rashin amsawa',
  'g.serious-injury': 'Mummunan rauni', 'g.poisoning': 'Guba', 'g.electric-shock': 'Wutar lantarki ta kama',
  'ai.subtitle': 'Yi tambayoyin lafiya da harshenka. Shawara ce ta gaba ɗaya, ba ganewar cuta ba.',
  'ai.placeholder': 'Tambaya game da alamomi, magunguna, taimakon gaggawa, ciki, abinci…', 'ai.send': 'Aika', 'ai.stop': 'Tsaya', 'ai.thinking': 'Yana tunani…',
  'ai.disclaimer': 'Medic AI na ba da bayanan lafiya na gaba ɗaya. Ba ya gano cuta ko rubuta magani. A lokacin gaggawa, kira 112.',
  'ai.useVault': 'Yi amfani da Ma’ajiyar Lafiyata', 'ai.new': 'Sabuwar tattaunawa', 'ai.suggest': 'Gwada tambaya',
  'ai.redflag': 'Wannan na iya zama gaggawa. Kira 112 yanzu ko je sashen gaggawa mafi kusa.',
  'lang.title': 'Harshe', 'lang.sub': 'Zaɓi harshe don Medic Hub da Medic AI.',
}

const ig: Partial<Dict> = {
  'nav.home': 'Ụlọ', 'nav.find': 'Chọọ ụlọ ọgwụ', 'nav.findShort': 'Chọọ', 'nav.bookings': 'Oge ndebanye', 'nav.vault': 'Igbe Ahụike', 'nav.vaultShort': 'Igbe',
  'nav.wellness': 'Ahụ isi ike', 'nav.firstAid': 'Enyemaka mbụ', 'nav.symptoms': 'Lelee ihe mgbaàmà', 'nav.signIn': 'Banye', 'nav.createAccount': 'Mepee akaụntụ',
  'nav.emergency': 'Ihe mberede', 'nav.assistant': 'Jụọ Medic AI', 'nav.assistantShort': 'AI', 'nav.language': 'Asụsụ',
  'home.help': 'Kedu ka anyị ga-esi nyere gị aka taa?', 'home.search': 'Chọọ ụlọ ọgwụ, dọkịta ma ọ bụ ọrụ', 'home.searchBtn': 'Chọọ',
  'home.findCare': 'Chọọ nlekọta', 'home.findCareSub': 'Ụlọ ọgwụ dị gị nso', 'home.book': 'Debanye oge', 'home.bookSub': 'Oge mbụ dị',
  'home.emergency': 'Ihe mberede', 'home.emergencySub': 'Kpọọ 112 · enyemaka mbụ', 'home.vault': 'Igbe Ahụike', 'home.vaultSub': 'Ozi ahụike gị',
  'greet.morning': 'Ụtụtụ ọma', 'greet.afternoon': 'Ehihie ọma', 'greet.evening': 'Mgbede ọma',
  'em.call': 'Kpọọ 112', 'em.national': 'Nọmba ihe mberede nke mba · n’efu',
  'em.safety': 'Ọ bụrụ na ndụ mmadụ nọ n’ihe ize ndụ, kpọọ 112 ugbu a. Medic Hub na-enye ntụziaka, ọ naghị eziga ụgbọ ala ndị ọrịa.',
  'em.findHospitals': 'Chọọ ụlọ ọgwụ ihe mberede dị m nso', 'em.findSub': 'Ngalaba ihe mberede meghere, nke kacha nso na mbụ',
  'em.what': 'Gịnị mere?', 'em.tap': 'Pịa maka enyemaka mbụ n’usoro na vidiyo.', 'em.notSure': 'Ị maghị ka o si dị njọ?', 'em.library': 'Vidiyo enyemaka mbụ',
  'em.mode': 'Ọnọdụ ihe mberede', 'em.exit': 'Pụọ', 'em.askAi': 'Jụọ Medic AI n’asụsụ gị',
  'g.severe-bleeding': 'Ọbara na-agba nke ukwuu', 'g.chest-pain': 'Mgbu obi', 'g.difficulty-breathing': 'Nsogbu iku ume', 'g.stroke': 'Ihe mgbaàmà strok',
  'g.seizure': 'Akwụkwụ', 'g.burn': 'Ọkụ gbara', 'g.choking': 'Ihe kpachiri akpịrị', 'g.allergic-reaction': 'Nfụkasị ahụ siri ike', 'g.unconscious': 'Ịda mbà ma ọ bụ anaghị aza',
  'g.serious-injury': 'Mmerụ ahụ siri ike', 'g.poisoning': 'Nsi', 'g.electric-shock': 'Ọkụ eletrik kụrụ',
  'ai.subtitle': 'Jụọ ajụjụ ahụike n’asụsụ gị. Ndụmọdụ izugbe, ọ bụghị nchọpụta ọrịa.',
  'ai.placeholder': 'Jụọ maka ihe mgbaàmà, ọgwụ, enyemaka mbụ, ime, nri…', 'ai.send': 'Ziga', 'ai.stop': 'Kwụsị', 'ai.thinking': 'Ọ na-eche echiche…',
  'ai.disclaimer': 'Medic AI na-enye ozi ahụike izugbe. Ọ naghị achọpụta ọrịa ma ọ bụ ide ọgwụ. N’oge ihe mberede, kpọọ 112.',
  'ai.useVault': 'Jiri Igbe Ahụike m', 'ai.new': 'Mkparịta ụka ọhụrụ', 'ai.suggest': 'Nwaa ịjụ',
  'ai.redflag': 'Nke a nwere ike ịbụ ihe mberede. Kpọọ 112 ugbu a ma ọ bụ gaa ngalaba ihe mberede kacha nso.',
  'lang.title': 'Asụsụ', 'lang.sub': 'Họrọ asụsụ maka Medic Hub na Medic AI.',
}

export const DICTS: Record<Lang, Partial<Dict>> = { en, pcm, yo, ha, ig }
export const EN = en
