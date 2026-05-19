export interface PlacementSeed {
  id: string; sw: string; en: string; pr: string; pos: string;
  senses: Array<{ english: string; pos?: string }>;
  tags: string[]; diff: number; rank: number;
  ex: { swahili: string; english: string };
}

export const PLACEMENT_SEEDS: PlacementSeed[] = [
  // Tier 1 — absolute basics (ranks 1–10)
  { id:'pl-001', sw:'jambo',     en:'hello',      pr:'JAM-bo',         pos:'interjection', senses:[{english:'hello'},{english:'hi'}], tags:['greetings'], diff:0.2, rank:1,  ex:{swahili:'Jambo, rafiki!', english:'Hello, friend!'} },
  { id:'pl-002', sw:'asante',    en:'thank you',  pr:'a-SAN-te',       pos:'interjection', senses:[{english:'thank you'},{english:'thanks'}], tags:['greetings'], diff:0.2, rank:2,  ex:{swahili:'Asante sana!', english:'Thank you very much!'} },
  { id:'pl-003', sw:'ndiyo',     en:'yes',        pr:'NDI-yo',         pos:'particle',     senses:[{english:'yes'},{english:'correct'}], tags:['basics'], diff:0.2, rank:3,  ex:{swahili:'Ndiyo, ninajua.', english:'Yes, I know.'} },
  { id:'pl-004', sw:'hapana',    en:'no',         pr:'ha-PA-na',       pos:'particle',     senses:[{english:'no'},{english:'not at all'}], tags:['basics'], diff:0.2, rank:4,  ex:{swahili:'Hapana, sijui.', english:'No, I don\'t know.'} },
  { id:'pl-005', sw:'maji',      en:'water',      pr:'MA-ji',          pos:'noun',         senses:[{english:'water'}], tags:['food','nouns'], diff:0.2, rank:5,  ex:{swahili:'Ninataka maji.', english:'I want water.'} },
  { id:'pl-006', sw:'chakula',   en:'food',       pr:'cha-KU-la',      pos:'noun',         senses:[{english:'food'},{english:'meal'}], tags:['food','nouns'], diff:0.25, rank:6,  ex:{swahili:'Chakula kizuri.', english:'Good food.'} },
  { id:'pl-007', sw:'mzuri',     en:'good',       pr:'m-ZU-ri',        pos:'adjective',    senses:[{english:'good'},{english:'fine'},{english:'nice'},{english:'well'}], tags:['adjectives','basics'], diff:0.25, rank:7,  ex:{swahili:'Niko mzuri.', english:'I am fine.'} },
  { id:'pl-008', sw:'sawa',      en:'okay',       pr:'SA-wa',          pos:'adjective',    senses:[{english:'okay'},{english:'alright'},{english:'fine'},{english:'equal'}], tags:['basics'], diff:0.25, rank:8,  ex:{swahili:'Sawa, tutaenda.', english:'Okay, we will go.'} },
  { id:'pl-009', sw:'karibu',    en:'welcome',    pr:'ka-RI-bu',       pos:'interjection', senses:[{english:'welcome'},{english:'come in'},{english:'you\'re welcome'},{english:'near'}], tags:['greetings'], diff:0.25, rank:9,  ex:{swahili:'Karibu nyumbani!', english:'Welcome home!'} },
  { id:'pl-010', sw:'tafadhali', en:'please',     pr:'ta-fa-DHA-li',   pos:'adverb',       senses:[{english:'please'},{english:'kindly'}], tags:['greetings','basics'], diff:0.3, rank:10, ex:{swahili:'Tafadhali nisaidie.', english:'Please help me.'} },
  // Tier 2 — basic nouns (ranks 11–20)
  { id:'pl-011', sw:'nyumba',    en:'house',      pr:'NYUM-ba',        pos:'noun',         senses:[{english:'house'},{english:'home'},{english:'building'}], tags:['housing','nouns'], diff:0.3, rank:11, ex:{swahili:'Nyumba yangu ni kubwa.', english:'My house is big.'} },
  { id:'pl-012', sw:'mtu',       en:'person',     pr:'M-tu',           pos:'noun',         senses:[{english:'person'},{english:'man'},{english:'human'}], tags:['people','nouns'], diff:0.3, rank:12, ex:{swahili:'Mtu huyu ni mzuri.', english:'This person is good.'} },
  { id:'pl-013', sw:'jina',      en:'name',       pr:'JI-na',          pos:'noun',         senses:[{english:'name'}], tags:['basics','nouns'], diff:0.3, rank:13, ex:{swahili:'Jina lako ni nani?', english:'What is your name?'} },
  { id:'pl-014', sw:'mwalimu',   en:'teacher',    pr:'mwa-LI-mu',      pos:'noun',         senses:[{english:'teacher'},{english:'instructor'}], tags:['professions','nouns'], diff:0.3, rank:14, ex:{swahili:'Mwalimu wangu ni mzuri.', english:'My teacher is good.'} },
  { id:'pl-015', sw:'mama',      en:'mother',     pr:'MA-ma',          pos:'noun',         senses:[{english:'mother'},{english:'mom'}], tags:['family','nouns'], diff:0.3, rank:15, ex:{swahili:'Mama yangu anafanya kazi.', english:'My mother works.'} },
  { id:'pl-016', sw:'baba',      en:'father',     pr:'BA-ba',          pos:'noun',         senses:[{english:'father'},{english:'dad'}], tags:['family','nouns'], diff:0.3, rank:16, ex:{swahili:'Baba yangu ni mwalimu.', english:'My father is a teacher.'} },
  { id:'pl-017', sw:'mtoto',     en:'child',      pr:'m-TO-to',        pos:'noun',         senses:[{english:'child'},{english:'baby'},{english:'kid'}], tags:['family','nouns'], diff:0.3, rank:17, ex:{swahili:'Mtoto anacheza.', english:'The child is playing.'} },
  { id:'pl-018', sw:'siku',      en:'day',        pr:'SI-ku',          pos:'noun',         senses:[{english:'day'}], tags:['time','nouns'], diff:0.35, rank:18, ex:{swahili:'Siku ya leo ni nzuri.', english:'Today is a nice day.'} },
  { id:'pl-019', sw:'mji',       en:'town',       pr:'M-ji',           pos:'noun',         senses:[{english:'town'},{english:'city'}], tags:['places','nouns'], diff:0.35, rank:19, ex:{swahili:'Ninaishi mjini.', english:'I live in town.'} },
  { id:'pl-020', sw:'nchi',      en:'country',    pr:'N-chi',          pos:'noun',         senses:[{english:'country'},{english:'land'},{english:'nation'}], tags:['places','nouns'], diff:0.35, rank:20, ex:{swahili:'Nchi yangu ni Tanzania.', english:'My country is Tanzania.'} },
  // Tier 3 — basic infinitives (ranks 21–30)
  { id:'pl-021', sw:'kwenda',    en:'to go',      pr:'KWEN-da',        pos:'verb',         senses:[{english:'to go'},{english:'to travel'}], tags:['verbs','movement'], diff:0.35, rank:21, ex:{swahili:'Ninataka kwenda Nairobi.', english:'I want to go to Nairobi.'} },
  { id:'pl-022', sw:'kuja',      en:'to come',    pr:'KU-ja',          pos:'verb',         senses:[{english:'to come'},{english:'to arrive'}], tags:['verbs','movement'], diff:0.35, rank:22, ex:{swahili:'Tafadhali kuja hapa.', english:'Please come here.'} },
  { id:'pl-023', sw:'kula',      en:'to eat',     pr:'KU-la',          pos:'verb',         senses:[{english:'to eat'}], tags:['verbs','food'], diff:0.35, rank:23, ex:{swahili:'Ninapenda kula matunda.', english:'I like to eat fruit.'} },
  { id:'pl-024', sw:'kunywa',    en:'to drink',   pr:'KU-nywa',        pos:'verb',         senses:[{english:'to drink'}], tags:['verbs','food'], diff:0.35, rank:24, ex:{swahili:'Ninakunywa maji.', english:'I am drinking water.'} },
  { id:'pl-025', sw:'kulala',    en:'to sleep',   pr:'ku-LA-la',       pos:'verb',         senses:[{english:'to sleep'},{english:'to lie down'}], tags:['verbs','daily-life'], diff:0.4, rank:25, ex:{swahili:'Ninataka kulala.', english:'I want to sleep.'} },
  { id:'pl-026', sw:'kufanya',   en:'to do',      pr:'ku-FA-nya',      pos:'verb',         senses:[{english:'to do'},{english:'to make'}], tags:['verbs'], diff:0.4, rank:26, ex:{swahili:'Unafanya nini?', english:'What are you doing?'} },
  { id:'pl-027', sw:'kusema',    en:'to speak',   pr:'ku-SE-ma',       pos:'verb',         senses:[{english:'to speak'},{english:'to say'},{english:'to talk'}], tags:['verbs','communication'], diff:0.4, rank:27, ex:{swahili:'Ninasema Kiswahili.', english:'I speak Swahili.'} },
  { id:'pl-028', sw:'kuona',     en:'to see',     pr:'ku-O-na',        pos:'verb',         senses:[{english:'to see'},{english:'to look'},{english:'to find'}], tags:['verbs'], diff:0.4, rank:28, ex:{swahili:'Ninaona nyumba kubwa.', english:'I see a big house.'} },
  { id:'pl-029', sw:'kujua',     en:'to know',    pr:'ku-JU-a',        pos:'verb',         senses:[{english:'to know'}], tags:['verbs'], diff:0.4, rank:29, ex:{swahili:'Sijui Kiswahili vizuri.', english:'I don\'t know Swahili well.'} },
  { id:'pl-030', sw:'kupenda',   en:'to love',    pr:'ku-PEN-da',      pos:'verb',         senses:[{english:'to love'},{english:'to like'},{english:'to want'}], tags:['verbs','emotions'], diff:0.4, rank:30, ex:{swahili:'Ninapenda muziki.', english:'I love music.'} },
  // Tier 4 — basic conjugations & high-frequency vocabulary (ranks 31–40)
  { id:'pl-031', sw:'ninapenda', en:'I love',     pr:'ni-na-PEN-da',   pos:'verb',         senses:[{english:'I love'},{english:'I like'}], tags:['conjugation','emotions','present-tense'], diff:0.45, rank:31, ex:{swahili:'Ninapenda kahawa.', english:'I love coffee.'} },
  { id:'pl-032', sw:'ninakwenda',en:'I am going', pr:'ni-na-KWEN-da',  pos:'verb',         senses:[{english:'I am going'},{english:'I go'}], tags:['conjugation','movement','present-tense'], diff:0.45, rank:32, ex:{swahili:'Ninakwenda shuleni.', english:'I am going to school.'} },
  { id:'pl-033', sw:'sijui',     en:"I don't know", pr:'si-JU-i',      pos:'phrase',       senses:[{english:"I don't know"},{english:'I do not know'}], tags:['phrases','negation'], diff:0.45, rank:33, ex:{swahili:'Sijui jibu.', english:"I don't know the answer."} },
  { id:'pl-034', sw:'haraka',    en:'quickly',    pr:'ha-RA-ka',       pos:'adverb',       senses:[{english:'quickly'},{english:'fast'},{english:'hurry'}], tags:['adverbs'], diff:0.45, rank:34, ex:{swahili:'Nenda haraka!', english:'Go quickly!'} },
  { id:'pl-035', sw:'polepole',  en:'slowly',     pr:'po-le-PO-le',    pos:'adverb',       senses:[{english:'slowly'},{english:'carefully'},{english:'take it easy'}], tags:['adverbs'], diff:0.45, rank:35, ex:{swahili:'Nenda polepole.', english:'Go slowly.'} },
  { id:'pl-036', sw:'sasa',      en:'now',        pr:'SA-sa',          pos:'adverb',       senses:[{english:'now'},{english:'right now'},{english:'currently'}], tags:['time','adverbs'], diff:0.45, rank:36, ex:{swahili:'Nifanye nini sasa?', english:'What should I do now?'} },
  { id:'pl-037', sw:'kesho',     en:'tomorrow',   pr:'KE-sho',         pos:'adverb',       senses:[{english:'tomorrow'},{english:'the next day'}], tags:['time','adverbs'], diff:0.5, rank:37, ex:{swahili:'Tutaonana kesho.', english:'We will meet tomorrow.'} },
  { id:'pl-038', sw:'jana',      en:'yesterday',  pr:'JA-na',          pos:'adverb',       senses:[{english:'yesterday'}], tags:['time','adverbs'], diff:0.5, rank:38, ex:{swahili:'Jana nilikwenda sokoni.', english:'Yesterday I went to the market.'} },
  { id:'pl-039', sw:'leo',       en:'today',      pr:'LE-o',           pos:'adverb',       senses:[{english:'today'}], tags:['time','adverbs'], diff:0.5, rank:39, ex:{swahili:'Leo ni siku nzuri.', english:'Today is a nice day.'} },
  { id:'pl-040', sw:'jioni',     en:'evening',    pr:'ji-O-ni',        pos:'noun',         senses:[{english:'evening'},{english:'late afternoon'}], tags:['time','nouns'], diff:0.5, rank:40, ex:{swahili:'Jioni tunakula pamoja.', english:'In the evening we eat together.'} },
  // Tier 5 — upper intermediate (ranks 41–50)
  { id:'pl-041', sw:'nilikwenda',  en:'I went',        pr:'ni-li-KWEN-da',  pos:'verb', senses:[{english:'I went'},{english:'I traveled'}], tags:['conjugation','movement','past-tense'], diff:0.55, rank:41, ex:{swahili:'Nilikwenda Mombasa wiki iliyopita.', english:'I went to Mombasa last week.'} },
  { id:'pl-042', sw:'nitakwenda',  en:'I will go',     pr:'ni-ta-KWEN-da',  pos:'verb', senses:[{english:'I will go'},{english:'I am going to go'}], tags:['conjugation','movement','future-tense'], diff:0.55, rank:42, ex:{swahili:'Nitakwenda kesho asubuhi.', english:'I will go tomorrow morning.'} },
  { id:'pl-043', sw:'amefanya',    en:'he has done',   pr:'a-me-FA-nya',    pos:'verb', senses:[{english:'he has done'},{english:'she has done'},{english:'has done'}], tags:['conjugation','perfect-tense'], diff:0.6, rank:43, ex:{swahili:'Amefanya kazi nzuri.', english:'He has done good work.'} },
  { id:'pl-044', sw:'ningependa',  en:'I would like',  pr:'nin-ge-PEN-da',  pos:'verb', senses:[{english:'I would like'},{english:'I would love'},{english:'I would want'}], tags:['conjugation','conditional'], diff:0.6, rank:44, ex:{swahili:'Ningependa kahawa, tafadhali.', english:'I would like coffee, please.'} },
  { id:'pl-045', sw:'wakati',      en:'time',          pr:'wa-KA-ti',       pos:'noun', senses:[{english:'time'},{english:'when'},{english:'period'},{english:'moment'}], tags:['time','nouns'], diff:0.6, rank:45, ex:{swahili:'Wakati ni muhimu.', english:'Time is important.'} },
  { id:'pl-046', sw:'ingawa',      en:'although',      pr:'in-GA-wa',       pos:'conjunction', senses:[{english:'although'},{english:'even though'},{english:'despite'}], tags:['conjunctions'], diff:0.65, rank:46, ex:{swahili:'Ingawa ninachoka, nitaendelea.', english:'Although I am tired, I will continue.'} },
  { id:'pl-047', sw:'lakini',      en:'but',           pr:'la-KI-ni',       pos:'conjunction', senses:[{english:'but'},{english:'however'},{english:'yet'}], tags:['conjunctions'], diff:0.65, rank:47, ex:{swahili:'Nataka kula, lakini sijala bado.', english:'I want to eat, but I haven\'t eaten yet.'} },
  { id:'pl-048', sw:'kwa sababu',  en:'because',       pr:'kwa sa-BA-bu',   pos:'conjunction', senses:[{english:'because'},{english:'since'},{english:'for'}], tags:['conjunctions'], diff:0.65, rank:48, ex:{swahili:'Ninafurahi kwa sababu umefika.', english:'I am happy because you arrived.'} },
  { id:'pl-049', sw:'pamoja',      en:'together',      pr:'pa-MO-ja',       pos:'adverb',      senses:[{english:'together'},{english:'along with'},{english:'as well'}], tags:['adverbs'], diff:0.65, rank:49, ex:{swahili:'Tutafanya kazi pamoja.', english:'We will work together.'} },
  { id:'pl-050', sw:'badala ya',   en:'instead of',    pr:'ba-DA-la ya',    pos:'phrase',      senses:[{english:'instead of'},{english:'in place of'},{english:'rather than'}], tags:['phrases'], diff:0.7, rank:50, ex:{swahili:'Badala ya chai, ninakunywa maji.', english:'Instead of tea, I drink water.'} },
];

export interface PhraseSeed {
  id: string; sw: string; en: string; pr: string;
  tags: string[]; register: string;
  senses: Array<{ english: string }>;
  note?: string;
  ex: { swahili: string; english: string };
}

export const PHRASE_SEEDS: PhraseSeed[] = [
  // ── Extended greetings ──────────────────────────────────────────────────────
  { id:'phr-001', sw:'Habari za asubuhi?',       en:'Good morning?',                pr:'ha-BA-ri za a-su-BU-hi',         tags:['phrases','greetings'], register:'neutral',  senses:[{english:'Good morning?'},{english:'How are things this morning?'}], note:'Literally "News of the morning?" Reply: "Nzuri" or "Nzuri sana, asante".', ex:{swahili:'Habari za asubuhi? — Nzuri sana!', english:'Good morning? — Very well!'} },
  { id:'phr-002', sw:'Habari za jioni?',          en:'Good evening?',                pr:'ha-BA-ri za ji-O-ni',             tags:['phrases','greetings'], register:'neutral',  senses:[{english:'Good evening?'},{english:'How are things this evening?'}], ex:{swahili:'Habari za jioni, mama.', english:"Good evening, ma'am."} },
  { id:'phr-003', sw:'Habari yako?',              en:'How are you?',                 pr:'ha-BA-ri YA-ko',                 tags:['phrases','greetings'], register:'neutral',  senses:[{english:'How are you?'},{english:'How are things with you?'}], note:'Singular "you". Reply: "Nzuri" or "Sijambo".', ex:{swahili:'Habari yako? Habari za kazi?', english:"How are you? How's work?"} },
  { id:'phr-004', sw:'Hujambo?',                 en:'How are you?',                 pr:'hu-JAM-bo',                      tags:['phrases','greetings'], register:'neutral',  senses:[{english:'How are you?'},{english:'Are you well?'}], note:'Literally "You have no problems?" Standard greeting for one person.', ex:{swahili:'Hujambo, rafiki yangu?', english:'How are you, my friend?'} },
  { id:'phr-005', sw:'Sijambo',                  en:"I'm fine",                     pr:'si-JAM-bo',                      tags:['phrases','greetings'], register:'neutral',  senses:[{english:"I'm fine"},{english:'I have no problems'},{english:"I'm well"}], note:'Standard reply to "Hujambo?". Literally "I have no problems."', ex:{swahili:'Sijambo, asante. Na wewe?', english:"I'm fine, thank you. And you?"} },
  { id:'phr-006', sw:'Hamjambo?',                en:'How are you all?',             pr:'ham-JAM-bo',                     tags:['phrases','greetings'], register:'neutral',  senses:[{english:'How are you all?'},{english:'How are you? (plural)'}], note:'Plural form of Hujambo — use when greeting more than one person.', ex:{swahili:'Hamjambo, watu wote!', english:'How are you all, everyone!'} },
  { id:'phr-007', sw:'Hatujambo',                en:"We're all fine",               pr:'ha-tu-JAM-bo',                   tags:['phrases','greetings'], register:'neutral',  senses:[{english:"We're fine"},{english:'We are all well'}], ex:{swahili:'Hatujambo, asante sana.', english:"We're all fine, thank you very much."} },
  { id:'phr-008', sw:'Shikamoo',                 en:'Respectful greeting to elders', pr:'shi-ka-MO-o',                   tags:['phrases','greetings','formal'], register:'formal', senses:[{english:'Respectful greeting'},{english:'I hold your feet'}], note:'Used by younger people greeting elders. Essential in formal and traditional contexts. The elder replies "Marahaba".', ex:{swahili:'Shikamoo, bibi.', english:'Respectful greetings, grandmother.'} },
  { id:'phr-009', sw:'Marahaba',                 en:'Response to shikamoo',         pr:'ma-ra-HA-ba',                    tags:['phrases','greetings','formal'], register:'formal', senses:[{english:'Thank you for the respect'},{english:'I accept your greeting'}], note:"The elder's response to Shikamoo. Only said by the elder being greeted.", ex:{swahili:'Shikamoo. — Marahaba, mtoto.', english:'Respectful greetings. — Thank you, child.'} },
  { id:'phr-010', sw:'Karibu tena',              en:'Welcome again',                pr:'ka-RI-bu TE-na',                 tags:['phrases','greetings'], register:'neutral',  senses:[{english:'Welcome again'},{english:'Come again'},{english:"You're welcome back"}], ex:{swahili:'Karibu tena dukani kwetu!', english:'Welcome back to our shop!'} },
  { id:'phr-011', sw:'Habari ya kazi?',          en:"How's work?",                  pr:'ha-BA-ri ya KA-zi',              tags:['phrases','greetings'], register:'neutral',  senses:[{english:"How's work?"},{english:'How are things at work?'}], ex:{swahili:'Habari yako? — Nzuri. Habari ya kazi?', english:"How are you? — Fine. How's work?"} },

  // ── Farewells ───────────────────────────────────────────────────────────────
  { id:'phr-012', sw:'Kwaheri ya kuonana',       en:'Goodbye until we meet again',  pr:'kwa-HE-ri ya ku-o-NA-na',        tags:['phrases','farewells'], register:'neutral',  senses:[{english:'Goodbye until we meet again'},{english:'Farewell till we see each other'}], note:'More heartfelt than plain "Kwaheri" — implies you look forward to meeting again.', ex:{swahili:'Kwaheri ya kuonana, safari njema!', english:'Goodbye until we meet again, safe travels!'} },
  { id:'phr-013', sw:'Tutaonana',                en:"We'll meet again",             pr:'tu-ta-o-NA-na',                  tags:['phrases','farewells'], register:'neutral',  senses:[{english:"We'll meet again"},{english:'See you'},{english:"I'll see you"}], ex:{swahili:'Tutaonana kesho asubuhi.', english:"We'll see each other tomorrow morning."} },
  { id:'phr-014', sw:'Lala salama',              en:'Good night',                   pr:'LA-la sa-LA-ma',                 tags:['phrases','farewells'], register:'neutral',  senses:[{english:'Good night'},{english:'Sleep well'},{english:'Sleep peacefully'}], note:'Literally "Sleep in peace/safety". Warmer than "Usiku mwema".', ex:{swahili:'Lala salama, mtoto wangu.', english:'Good night, my child.'} },
  { id:'phr-015', sw:'Usiku mwema',              en:'Good night',                   pr:'u-SI-ku MWE-ma',                 tags:['phrases','farewells'], register:'neutral',  senses:[{english:'Good night'},{english:'Good evening'}], ex:{swahili:'Usiku mwema, tutaonana kesho.', english:'Good night, see you tomorrow.'} },
  { id:'phr-016', sw:'Safari njema',             en:'Safe travels',                 pr:'sa-FA-ri NJE-ma',                tags:['phrases','farewells'], register:'neutral',  senses:[{english:'Safe travels'},{english:'Have a good journey'},{english:'Bon voyage'}], note:'Said to someone who is travelling. A warm and common farewell.', ex:{swahili:'Safari njema! Uwasiliane natuoni ukifika.', english:'Safe travels! Let us know when you arrive.'} },
  { id:'phr-017', sw:'Baadaye',                  en:'Later',                        pr:'ba-a-DA-ye',                     tags:['phrases','farewells'], register:'neutral',  senses:[{english:'Later'},{english:'See you later'},{english:'Goodbye for now'}], ex:{swahili:'Ninahangaika sasa — baadaye!', english:"I'm busy now — later!"} },
  { id:'phr-018', sw:'Tutaonana baadaye',        en:'See you later',                pr:'tu-ta-o-NA-na ba-a-DA-ye',       tags:['phrases','farewells'], register:'neutral',  senses:[{english:'See you later'},{english:"We'll meet later"}], ex:{swahili:'Lazima niende sasa — tutaonana baadaye.', english:"I have to go now — see you later."} },

  // ── Politeness ──────────────────────────────────────────────────────────────
  { id:'phr-019', sw:'Samahani',                 en:'Excuse me',                    pr:'sa-ma-HA-ni',                    tags:['phrases','politeness'], register:'neutral', senses:[{english:'Excuse me'},{english:"I'm sorry"},{english:'Pardon me'},{english:'Forgive me'}], note:'Used both to get attention and to apologise. Very versatile.', ex:{swahili:'Samahani, unajua hoteli iko wapi?', english:'Excuse me, do you know where the hotel is?'} },
  { id:'phr-020', sw:'Pole sana',                en:"I'm very sorry",               pr:'PO-le SA-na',                    tags:['phrases','politeness'], register:'neutral', senses:[{english:"I'm very sorry"},{english:'So sorry'},{english:'My condolences'}], note:"Expresses sympathy for someone's misfortune or loss — not just a generic apology. Very important culturally.", ex:{swahili:'Pole sana kwa habari hiyo mbaya.', english:"I'm so sorry to hear that bad news."} },
  { id:'phr-021', sw:'Asante sana',              en:'Thank you very much',           pr:'a-SAN-te SA-na',                 tags:['phrases','politeness'], register:'neutral', senses:[{english:'Thank you very much'},{english:'Thanks a lot'},{english:'Many thanks'}], ex:{swahili:'Asante sana kwa msaada wako!', english:'Thank you very much for your help!'} },
  { id:'phr-022', sw:'Karibu sana',              en:"You're very welcome",           pr:'ka-RI-bu SA-na',                 tags:['phrases','politeness'], register:'neutral', senses:[{english:"You're very welcome"},{english:"Don't mention it"},{english:'My pleasure'}], ex:{swahili:'Asante. — Karibu sana!', english:"Thank you. — You're very welcome!"} },
  { id:'phr-023', sw:'Unaweza kunisaidia?',      en:'Can you help me?',             pr:'u-na-WE-za ku-ni-sa-i-DI-a',     tags:['phrases','requests'],   register:'neutral', senses:[{english:'Can you help me?'},{english:'Would you be able to help me?'}], ex:{swahili:'Unaweza kunisaidia kupata gari?', english:'Can you help me get a car?'} },
  { id:'phr-024', sw:'Tafadhali nisaidie',       en:'Please help me',               pr:'ta-fa-DHA-li ni-sa-i-DI-e',      tags:['phrases','requests'],   register:'neutral', senses:[{english:'Please help me'},{english:'Help me please'}], ex:{swahili:'Tafadhali nisaidie kubeba mzigo huu.', english:'Please help me carry this luggage.'} },

  // ── Understanding & communication ────────────────────────────────────────────
  { id:'phr-025', sw:'Naelewa',                  en:'I understand',                 pr:'na-e-LE-wa',                     tags:['phrases','communication'], register:'neutral', senses:[{english:'I understand'},{english:'I see'},{english:'I get it'}], ex:{swahili:'Naelewa, asante kwa maelezo.', english:'I understand, thank you for the explanation.'} },
  { id:'phr-026', sw:'Sijaelewa',                en:"I don't understand",           pr:'si-ja-e-LE-wa',                  tags:['phrases','communication'], register:'neutral', senses:[{english:"I don't understand"},{english:"I haven't understood"},{english:"I'm not following"}], ex:{swahili:"Sijaelewa vizuri — unaweza kusema tena?", english:"I don't quite understand — can you say it again?"} },
  { id:'phr-027', sw:'Tena tafadhali',           en:'Again please',                 pr:'TE-na ta-fa-DHA-li',             tags:['phrases','communication'], register:'neutral', senses:[{english:'Again please'},{english:'Could you repeat that?'},{english:'Say it again please'}], ex:{swahili:'Tena tafadhali, polepole zaidi.', english:'Again please, more slowly.'} },
  { id:'phr-028', sw:'Polepole zaidi',           en:'More slowly please',           pr:'po-le-PO-le ZA-i-di',            tags:['phrases','communication'], register:'neutral', senses:[{english:'More slowly'},{english:'Slower please'},{english:'Take it a bit slower'}], ex:{swahili:'Unaweza kusema polepole zaidi?', english:'Can you speak more slowly?'} },
  { id:'phr-029', sw:'Unamaanisha nini?',        en:'What do you mean?',            pr:'u-na-ma-a-NI-sha NI-ni',         tags:['phrases','communication'], register:'neutral', senses:[{english:'What do you mean?'},{english:'What are you saying?'}], ex:{swahili:'Unamaanisha nini kwa "baadaye"?', english:'What do you mean by "later"?'} },
  { id:'phr-030', sw:'Ninasema Kiswahili kidogo',en:'I speak a little Swahili',      pr:'ni-na-SE-ma ki-swa-HI-li ki-DO-go', tags:['phrases','communication'], register:'neutral', senses:[{english:'I speak a little Swahili'},{english:'My Swahili is limited'}], ex:{swahili:'Ninasema Kiswahili kidogo — pole!', english:"I speak a little Swahili — sorry!"} },
  { id:'phr-031', sw:'Ninajaribu kujifunza',     en:'I am trying to learn',         pr:'ni-na-ja-RI-bu ku-ji-FU-nza',    tags:['phrases','communication'], register:'neutral', senses:[{english:'I am trying to learn'},{english:"I'm studying"}], note:'Saying this usually earns encouragement and patience from native speakers.', ex:{swahili:'Ninajaribu kujifunza Kiswahili.', english:'I am trying to learn Swahili.'} },

  // ── Practical questions ──────────────────────────────────────────────────────
  { id:'phr-032', sw:'Ni saa ngapi?',            en:'What time is it?',             pr:'ni sa-a NGA-pi',                 tags:['phrases','time'],       register:'neutral', senses:[{english:'What time is it?'},{english:'What hour is it?'}], note:'Swahili clock (saa) starts at 6am = saa moja (hour one). Add 6 hours to convert to Western time.', ex:{swahili:'Samahani, ni saa ngapi sasa?', english:'Excuse me, what time is it now?'} },
  { id:'phr-033', sw:'Hii ni nini?',             en:'What is this?',                pr:'HI-i ni NI-ni',                  tags:['phrases','questions'],   register:'neutral', senses:[{english:'What is this?'},{english:'What is it?'}], ex:{swahili:'Hii ni nini? Sijawahi kuona.', english:"What is this? I've never seen it before."} },
  { id:'phr-034', sw:'Ni bei gani?',             en:"What's the price?",            pr:'ni BE-i GA-ni',                  tags:['phrases','shopping'],    register:'neutral', senses:[{english:"What's the price?"},{english:'How much does it cost?'},{english:'How much?'}], ex:{swahili:'Embe hizi ni bei gani?', english:"What's the price of these mangoes?"} },
  { id:'phr-035', sw:'Naweza kukaa hapa?',       en:'Can I sit here?',              pr:'na-WE-za ku-KA-a HA-pa',         tags:['phrases','questions'],   register:'neutral', senses:[{english:'Can I sit here?'},{english:'May I sit here?'},{english:'Is this seat taken?'}], ex:{swahili:'Samahani, naweza kukaa hapa?', english:'Excuse me, can I sit here?'} },
  { id:'phr-036', sw:'Naweza kupita?',           en:'Can I pass?',                  pr:'na-WE-za ku-PI-ta',              tags:['phrases','questions'],   register:'neutral', senses:[{english:'Can I pass?'},{english:'May I come through?'},{english:'Excuse me, coming through'}], ex:{swahili:'Naweza kupita, tafadhali?', english:'Can I pass through, please?'} },
  { id:'phr-037', sw:'Uko wapi?',                en:'Where are you?',               pr:'U-ko WA-pi',                     tags:['phrases','questions'],   register:'neutral', senses:[{english:'Where are you?'},{english:'Where are you located?'}], ex:{swahili:'Uko wapi? Nimekungoja kwa muda.', english:"Where are you? I've been waiting for you for a while."} },

  // ── Daily expressions ────────────────────────────────────────────────────────
  { id:'phr-038', sw:'Niko tayari',              en:'I am ready',                   pr:'NI-ko ta-YA-ri',                 tags:['phrases','daily-life'], register:'neutral',  senses:[{english:'I am ready'},{english:"I'm all set"},{english:'Ready to go'}], ex:{swahili:'Niko tayari — twende!', english:"I'm ready — let's go!"} },
  { id:'phr-039', sw:'Bado',                     en:'Not yet',                      pr:'BA-do',                          tags:['phrases','daily-life'], register:'neutral',  senses:[{english:'Not yet'},{english:'Still'},{english:'Not done yet'}], ex:{swahili:'Umekwisha kula? — Bado.', english:'Have you eaten yet? — Not yet.'} },
  { id:'phr-040', sw:'Sawa sawa',                en:"It's fine",                    pr:'SA-wa SA-wa',                    tags:['phrases','daily-life'], register:'informal', senses:[{english:"It's fine"},{english:'Alright alright'},{english:'No problem'}], note:'Informal, slightly casual — more emphatic version of "sawa". Very common in everyday speech.', ex:{swahili:'Pole kwa kuchelewa. — Sawa sawa!', english:"Sorry for being late. — It's totally fine!"} },
  { id:'phr-041', sw:'Hakuna matata',            en:'No worries',                   pr:'ha-KU-na ma-TA-ta',              tags:['phrases','daily-life'], register:'neutral',  senses:[{english:'No worries'},{english:'No problem'},{english:'No trouble'}], note:'Genuine everyday expression widely used across East Africa — not just a film phrase.', ex:{swahili:'Samahani kwa usumbufu. — Hakuna matata!', english:'Sorry for the inconvenience. — No worries!'} },
  { id:'phr-042', sw:'Hakuna shida',             en:'No problem',                   pr:'ha-KU-na SHI-da',                tags:['phrases','daily-life'], register:'neutral',  senses:[{english:'No problem'},{english:'No difficulty'},{english:"That's fine"}], ex:{swahili:'Asante kwa subira. — Hakuna shida.', english:'Thank you for your patience. — No problem.'} },
  { id:'phr-043', sw:'Subiri kidogo',            en:'Wait a moment',                pr:'su-BI-ri ki-DO-go',              tags:['phrases','daily-life'], register:'neutral',  senses:[{english:'Wait a moment'},{english:'Just a moment'},{english:'Hold on a second'}], ex:{swahili:'Subiri kidogo, ninakuja!', english:"Wait a moment, I'm coming!"} },
  { id:'phr-044', sw:'Niko sawa',                en:"I'm okay",                     pr:'NI-ko SA-wa',                    tags:['phrases','daily-life'], register:'neutral',  senses:[{english:"I'm okay"},{english:"I'm fine"},{english:"I'm alright"}], ex:{swahili:'Una hali gani? — Niko sawa, asante.', english:"How are you doing? — I'm okay, thanks."} },
  { id:'phr-045', sw:'Ninahitaji msaada',        en:'I need help',                  pr:'ni-na-hi-TA-ji m-SA-a-da',       tags:['phrases','requests'],   register:'neutral',  senses:[{english:'I need help'},{english:'I need assistance'}], ex:{swahili:"Ninahitaji msaada — nimepotea.", english:"I need help — I'm lost."} },
  { id:'phr-046', sw:'Lazima',                   en:'It is necessary',              pr:'la-ZI-ma',                       tags:['phrases','daily-life'], register:'neutral',  senses:[{english:'It is necessary'},{english:'Must'},{english:'Have to'},{english:'Obligatory'}], ex:{swahili:'Lazima twende sasa hivi.', english:'We must go right now.'} },
  { id:'phr-047', sw:'Sijali',                   en:"I don't mind",                 pr:'si-JA-li',                       tags:['phrases','daily-life'], register:'neutral',  senses:[{english:"I don't mind"},{english:"It doesn't matter to me"},{english:"Either is fine"}], ex:{swahili:"Chai au kahawa? — Sijali, vyote vizuri.", english:"Tea or coffee? — I don't mind, both are fine."} },
  { id:'phr-048', sw:'Niko hapa',                en:'I am here',                    pr:'NI-ko HA-pa',                    tags:['phrases','daily-life'], register:'neutral',  senses:[{english:'I am here'},{english:"I'm present"},{english:'Over here'}], ex:{swahili:'Uko wapi? — Niko hapa, nyuma yako!', english:"Where are you? — I'm here, behind you!"} },
  { id:'phr-049', sw:'Ninaangalia tu',           en:'Just looking',                 pr:'ni-na-a-NGA-li-a TU',            tags:['phrases','shopping'],   register:'neutral',  senses:[{english:'Just looking'},{english:'Just browsing'},{english:'Only looking'}], ex:{swahili:'Ninaweza kukusaidia? — Ninaangalia tu, asante.', english:'Can I help you? — Just looking, thank you.'} },
  { id:'phr-050', sw:'Nipe muda kidogo',         en:'Give me a little time',        pr:'NI-pe MU-da ki-DO-go',           tags:['phrases','requests'],   register:'neutral',  senses:[{english:'Give me a little time'},{english:'Just a moment'},{english:'Bear with me'}], ex:{swahili:'Nipe muda kidogo — ninafikiria.', english:'Give me a little time — I am thinking.'} },

  // ── Discourse markers ────────────────────────────────────────────────────────
  { id:'phr-051', sw:'Kwa kweli',                en:'Truly',                        pr:'kwa KWE-li',                     tags:['phrases','discourse'],  register:'neutral',  senses:[{english:'Truly'},{english:'Really'},{english:'Indeed'},{english:'In truth'}], ex:{swahili:'Kwa kweli, sikujua hivyo.', english:"Truly, I didn't know that."} },
  { id:'phr-052', sw:'Bila shaka',               en:'Without doubt',                pr:'BI-la SHA-ka',                   tags:['phrases','discourse'],  register:'neutral',  senses:[{english:'Without doubt'},{english:'Certainly'},{english:'Definitely'},{english:'Of course'}], ex:{swahili:'Bila shaka, atakuja.', english:'Without doubt, he will come.'} },
  { id:'phr-053', sw:'Hata hivyo',               en:'Even so',                      pr:'HA-ta HI-vyo',                   tags:['phrases','discourse'],  register:'neutral',  senses:[{english:'Even so'},{english:'Nevertheless'},{english:'However'},{english:'Despite that'}], ex:{swahili:'Hata hivyo, tutaendelea.', english:'Even so, we will continue.'} },
  { id:'phr-054', sw:'Kwa hiyo',                 en:'Therefore',                    pr:'kwa HI-yo',                      tags:['phrases','discourse'],  register:'neutral',  senses:[{english:'Therefore'},{english:'So'},{english:'For that reason'},{english:'Thus'}], ex:{swahili:'Nilichelewa, kwa hiyo nilikimbia.', english:'I was late, so I ran.'} },
  { id:'phr-055', sw:'Kisha',                    en:'Then',                         pr:'KI-sha',                         tags:['phrases','discourse'],  register:'neutral',  senses:[{english:'Then'},{english:'After that'},{english:'Next'},{english:'Subsequently'}], ex:{swahili:'Kwanza osha mikono, kisha ule.', english:'First wash your hands, then eat.'} },
  { id:'phr-056', sw:'Mwishowe',                 en:'Finally',                      pr:'mwi-SHO-we',                     tags:['phrases','discourse'],  register:'neutral',  senses:[{english:'Finally'},{english:'At the end'},{english:'Ultimately'},{english:'Last of all'}], ex:{swahili:'Mwishowe, tulipata jibu.', english:'Finally, we got the answer.'} },
  { id:'phr-057', sw:'Kwa bahati nzuri',         en:'Fortunately',                  pr:'kwa ba-HA-ti NZU-ri',            tags:['phrases','discourse'],  register:'neutral',  senses:[{english:'Fortunately'},{english:'Luckily'},{english:'By good luck'}], ex:{swahili:'Kwa bahati nzuri, mvua haikuanza.', english:"Fortunately, the rain didn't start."} },
  { id:'phr-058', sw:'Kwa bahati mbaya',         en:'Unfortunately',                pr:'kwa ba-HA-ti MBA-ya',            tags:['phrases','discourse'],  register:'neutral',  senses:[{english:'Unfortunately'},{english:'Sadly'},{english:'By bad luck'}], ex:{swahili:'Kwa bahati mbaya, tikiti hazikuwepo.', english:'Unfortunately, there were no tickets.'} },
  { id:'phr-059', sw:'Kwa mfano',                en:'For example',                  pr:'kwa m-FA-no',                    tags:['phrases','discourse'],  register:'neutral',  senses:[{english:'For example'},{english:'For instance'},{english:'Such as'}], ex:{swahili:'Kuna matunda mengi, kwa mfano maembe na ndizi.', english:'There are many fruits, for example mangoes and bananas.'} },

  // ── Requests ────────────────────────────────────────────────────────────────
  { id:'phr-060', sw:'Niambie',                  en:'Tell me',                      pr:'ni-am-BI-e',                     tags:['phrases','requests'],   register:'neutral',  senses:[{english:'Tell me'},{english:'Let me know'}], ex:{swahili:'Niambie ukweli, tafadhali.', english:'Tell me the truth, please.'} },
  { id:'phr-061', sw:'Nionyeshe',                en:'Show me',                      pr:'ni-o-NYE-she',                   tags:['phrases','requests'],   register:'neutral',  senses:[{english:'Show me'},{english:'Demonstrate to me'},{english:'Let me see'}], ex:{swahili:'Nionyeshe jinsi ya kufanya hivyo.', english:'Show me how to do that.'} },
  { id:'phr-062', sw:'Ninaomba',                 en:'I humbly request',             pr:'ni-na-OM-ba',                    tags:['phrases','requests'],   register:'formal',   senses:[{english:'I request'},{english:'I ask'},{english:'I humbly ask'}], note:'More formal or humble than "ninataka". Common in official contexts or when being very polite.', ex:{swahili:'Ninaomba msamaha kwa ucheleweshaji.', english:'I ask for forgiveness for the delay.'} },

  // ── Shopping ────────────────────────────────────────────────────────────────
  { id:'phr-063', sw:'Ni ghali sana',            en:"It's very expensive",          pr:'ni GHA-li SA-na',                tags:['phrases','shopping'],   register:'neutral',  senses:[{english:"It's very expensive"},{english:"That's too expensive"},{english:'Very pricey'}], ex:{swahili:'Elfu thelathini? Ni ghali sana!', english:"Thirty thousand? That's very expensive!"} },
  { id:'phr-064', sw:'Punguza bei',              en:'Reduce the price',             pr:'pu-NGU-za BE-i',                 tags:['phrases','shopping'],   register:'neutral',  senses:[{english:'Reduce the price'},{english:'Give a discount'},{english:'Lower the cost'}], note:'Common phrase in market bargaining — politely asking for a discount.', ex:{swahili:'Unaweza punguza bei kidogo?', english:'Can you reduce the price a little?'} },

  // ── Health & emergency ───────────────────────────────────────────────────────
  { id:'phr-065', sw:'Msaada!',                  en:'Help!',                        pr:'m-SA-a-da',                      tags:['phrases','emergency'],  register:'neutral',  senses:[{english:'Help!'},{english:'Assistance!'},{english:'Aid!'}], ex:{swahili:'Msaada! Mtu amepotea!', english:'Help! Someone is missing!'} },
  { id:'phr-066', sw:'Ninahisi vibaya',          en:'I feel unwell',                pr:'ni-na-HI-si vi-BA-ya',           tags:['phrases','health'],     register:'neutral',  senses:[{english:'I feel unwell'},{english:'I feel bad'},{english:"I don't feel well"}], ex:{swahili:"Ninahisi vibaya — ninahitaji daktari.", english:"I feel unwell — I need a doctor."} },
  { id:'phr-067', sw:'Ninahisi vizuri',          en:'I feel well',                  pr:'ni-na-HI-si vi-ZU-ri',           tags:['phrases','health'],     register:'neutral',  senses:[{english:'I feel well'},{english:'I feel good'},{english:"I'm feeling fine"}], ex:{swahili:"Habari ya afya? — Ninahisi vizuri, asante.", english:"How's your health? — I feel well, thank you."} },
  { id:'phr-068', sw:'Nimepotea',                en:"I'm lost",                     pr:'ni-me-po-TE-a',                  tags:['phrases','emergency'],  register:'neutral',  senses:[{english:"I'm lost"},{english:'I have lost my way'}], ex:{swahili:"Samahani, nimepotea — unaweza kunisaidia?", english:"Excuse me, I'm lost — can you help me?"} },

  // ── Encouragement & social ───────────────────────────────────────────────────
  { id:'phr-069', sw:'Hongera!',                 en:'Congratulations!',             pr:'hon-GE-ra',                      tags:['phrases','emotions'],   register:'neutral',  senses:[{english:'Congratulations!'},{english:'Well done!'},{english:'Bravo!'}], note:'Used for achievements, births, graduations, weddings — any positive milestone.', ex:{swahili:'Hongera kwa kuhitimu!', english:'Congratulations on graduating!'} },
  { id:'phr-070', sw:'Kazi nzuri!',              en:'Good work!',                   pr:'KA-zi NZU-ri',                   tags:['phrases','encouragement'], register:'neutral', senses:[{english:'Good work!'},{english:'Well done!'},{english:'Nice job!'}], ex:{swahili:"Umefanikisha kazi hiyo — kazi nzuri!", english:"You've accomplished that task — good work!"} },
  { id:'phr-071', sw:'Endelea',                  en:'Continue',                     pr:'en-de-LE-a',                     tags:['phrases','encouragement'], register:'neutral', senses:[{english:'Continue'},{english:'Keep going'},{english:'Carry on'},{english:'Go ahead'}], ex:{swahili:'Endelea, unafanya vizuri sana!', english:"Keep going, you're doing very well!"} },
  { id:'phr-072', sw:'Usijali',                  en:"Don't worry",                  pr:'u-si-JA-li',                     tags:['phrases','encouragement'], register:'neutral', senses:[{english:"Don't worry"},{english:"Don't stress"},{english:"Don't be troubled"}], ex:{swahili:'Usijali, kila kitu kitakuwa sawa.', english:"Don't worry, everything will be okay."} },

  // ── Conversation fillers ─────────────────────────────────────────────────────
  { id:'phr-073', sw:'Kwa kweli?',               en:'Really?',                      pr:'kwa KWE-li',                     tags:['phrases','conversation'], register:'neutral', senses:[{english:'Really?'},{english:'Is that so?'},{english:'Truly?'}], ex:{swahili:'Alifaulu mitihani yote. — Kwa kweli?', english:'He passed all the exams. — Really?'} },
  { id:'phr-074', sw:'Si mbaya',                 en:'Not bad',                      pr:'si MBA-ya',                      tags:['phrases','conversation'], register:'informal',senses:[{english:'Not bad'},{english:'Pretty good'},{english:'Not too bad'}], ex:{swahili:'Ulifanya vipi mtihani? — Si mbaya!', english:'How did the exam go? — Not bad!'} },
  { id:'phr-075', sw:'Ndiyo, kweli',             en:'Yes, really',                  pr:'NDI-yo KWE-li',                  tags:['phrases','conversation'], register:'neutral', senses:[{english:'Yes, really'},{english:'Yes, indeed'},{english:'Yes, truly'}], ex:{swahili:'Nilimwona Jana. — Ndiyo, kweli?', english:'I saw him yesterday. — Yes, really?'} },
];

export interface GrammarSeed {
  id: string; sw: string; en: string; pr: string;
  tags: string[]; note: string;
  ex: { swahili: string; english: string };
}

export const GRAMMAR_SEEDS: GrammarSeed[] = [
  // ── Subject prefixes (1sg → 2sg → 3sg → 1pl → 2pl → 3pl) ───────────────────
  { id:'gr-001', sw:'ni-', en:'I — 1sg subject prefix', pr:'ni', tags:['grammar','subject-prefix','morphology'],
    note:'Always the first slot in a Swahili verb — it means "I". Verb slot order: SUBJECT + TENSE + (OBJECT) + ROOT + FINAL.\n\nExample build: ni- + na- + pend- + a = ninapenda (I love).\n\nNegative: replace ni- with si- (never add both).',
    ex:{swahili:'Ni-na-penda = ni + na + pend + a', english:'I love = I + [present] + love + [active]'} },

  { id:'gr-002', sw:'u-', en:'you — 2sg subject prefix', pr:'u', tags:['grammar','subject-prefix','morphology'],
    note:'The "you" slot — for talking to one person.\n\nAlso appears as the U-class noun prefix (u-furaha = happiness), but position in the verb makes it clear which is which.\n\nNegative: hau- (ha + u).',
    ex:{swahili:'U-na-kula = u + na + kul + a', english:'You are eating = you + [present] + eat + [active]'} },

  { id:'gr-003', sw:'a-', en:'he / she — 3sg subject prefix', pr:'a', tags:['grammar','subject-prefix','morphology'],
    note:'Swahili has no grammatical gender — one prefix covers both he and she. Context tells you which.\n\nAlso the subject concord for M-Wa class nouns (people/animals) in the singular.\n\nNegative: ha- (ha + a contracts to ha).',
    ex:{swahili:'A-na-kuja = a + na + kuj + a', english:'He/she is coming = he/she + [present] + come + [active]'} },

  { id:'gr-004', sw:'tu-', en:'we — 1pl subject prefix', pr:'tu', tags:['grammar','subject-prefix','morphology'],
    note:'The "we" slot. Often the easiest plural to remember — it mirrors the object infix -tu- (meaning "us").\n\nNegative: hatu- (ha + tu). Example: hatu-pendi = we don\'t like.',
    ex:{swahili:'Tu-ta-kwenda = tu + ta + kwend + a', english:'We will go = we + [future] + go + [active]'} },

  { id:'gr-005', sw:'m-', en:'you all — 2pl subject prefix', pr:'m', tags:['grammar','subject-prefix','morphology'],
    note:'The "you all" slot — for talking to a group (like Southern US "y\'all").\n\nDon\'t confuse with the M-Mi noun class prefix (m-ti = tree) — position in the verb distinguishes them.\n\nNegative: ham- (ha + m). Example: ham-somi = you all don\'t study.',
    ex:{swahili:'M-na-sema = m + na + sem + a', english:'You all are speaking = you(pl) + [present] + speak + [active]'} },

  { id:'gr-006', sw:'wa-', en:'they — 3pl subject prefix', pr:'wa', tags:['grammar','subject-prefix','morphology'],
    note:'The "they" slot — specifically for people (M-Wa class). Plural of a-.\n\nFor non-human subjects, the plural concord comes from the noun\'s class: vi- (things), zi- (N class), etc.\n\nNegative: hawa- (ha + wa). Example: hawa-somi = they don\'t study.',
    ex:{swahili:'Wa-ta-lala = wa + ta + lal + a', english:'They will sleep = they + [future] + sleep + [active]'} },

  // ── Tense markers ────────────────────────────────────────────────────────────
  { id:'gr-007', sw:'-na-', en:'present tense marker', pr:'na', tags:['grammar','tense-marker','morphology','present-tense'],
    note:'In English, we distinguish "I eat" (habit) from "I am eating" (right now). Swahili uses -na- for BOTH.\n\nPosition: always after the subject prefix. Slot: SUBJECT + -na- + ROOT + -a.\n\nImportant: drop -na- entirely in negative present. si-pend-i (not *si-na-pendi).',
    ex:{swahili:'Ni-na-soma vitabu', english:'I am reading books (right now, or as a habit)'} },

  { id:'gr-008', sw:'-li-', en:'simple past tense marker', pr:'li', tags:['grammar','tense-marker','morphology','past-tense'],
    note:'In English: simple past — "I ate", "she went", "we saw". The action is finished with no connection to the present moment.\n\nFor "I have eaten" (still relevant now), use -me- instead.\n\nNegative past: -li- is replaced by -ku-. a-li-kula (he ate) → ha-ku-kula (he didn\'t eat).',
    ex:{swahili:'A-li-maliza kazi', english:'He/she finished work (simple past — it\'s done)'} },

  { id:'gr-009', sw:'-ta-', en:'future tense marker', pr:'ta', tags:['grammar','tense-marker','morphology','future-tense'],
    note:'In English: "will" — "I will go", "they will see", "we will eat".\n\nSimply swap -na- for -ta- to shift any present sentence into the future.\n\nNegative future keeps -ta-: si-ta-kwenda = I will not go. (Notice si- replaces ni-, but ta- stays.)',
    ex:{swahili:'Tu-ta-ona kesho', english:'We will see each other tomorrow'} },

  { id:'gr-010', sw:'-me-', en:'perfect tense marker', pr:'me', tags:['grammar','tense-marker','morphology','perfect-tense'],
    note:'In English: "have" — "I have eaten" (I\'m full now), "she has arrived" (she\'s here).\n\nThe KEY difference from -li-: -me- means the past action STILL MATTERS RIGHT NOW. It has a present result.\n\nCompare: ni-li-kula jana (I ate yesterday — finished) vs. ni-me-kula (I have eaten — I\'m satisfied now).',
    ex:{swahili:'A-me-fika tayari', english:'He/she has already arrived (and is here now)'} },

  { id:'gr-011', sw:'-ki-', en:'"if / when" — conditional marker', pr:'ki', tags:['grammar','tense-marker','morphology','conditional'],
    note:'In English: "if" or "when" linking two events — "if you want it, take it" / "when I come, call me".\n\nConnects two actions happening together or conditionally. Very common in Swahili proverbs and everyday instructions.\n\nExample: u-ki-taka = if/when you want. (You can\'t use -na- here.)',
    ex:{swahili:'U-ki-taka, nipe', english:'If/when you want (it), give it to me'} },

  { id:'gr-012', sw:'-ka-', en:'"and then" — narrative sequential marker', pr:'ka', tags:['grammar','tense-marker','morphology','past-tense'],
    note:'In English: "and then..." in storytelling — "he ran, and then he fell".\n\nChains past events in sequence. The key rule: -ka- can NEVER start a sentence. It must always follow another verb.\n\nVery common in Swahili narratives, folktales, and Bible texts.',
    ex:{swahili:'Alikimbia, a-ka-anguka', english:'He ran, and then he fell'} },

  { id:'gr-013', sw:'-nge-', en:'"would" — hypothetical conditional marker', pr:'nge', tags:['grammar','tense-marker','morphology','conditional'],
    note:'In English: "would" — "I would love to", "I would go if..."\n\nUsed for hypotheticals, wishes, and polite requests (softer than -ta-).\n\nPast hypothetical adds -li-: ni-nge-li-kwenda = I would have gone (but didn\'t).\n\nTip: ningependa (I would like) is more polite than ninataka (I want) — use it in formal situations.',
    ex:{swahili:'Ni-nge-penda kwenda Paris', english:'I would like/love to go to Paris'} },

  // ── Negative markers (1sg → 2sg → 3sg → negative tense → negative ending) ───
  { id:'gr-014', sw:'si-', en:'I do not — 1sg negative prefix', pr:'si', tags:['grammar','negation','morphology'],
    note:'Replaces ni- entirely in negative present — never combine ni- + si-.\n\nsi-pendi = I don\'t like (correct). *ni-si-pendi = wrong.\n\nAlso standalone: "si" alone means "is not" — si mwalimu = he/she is not a teacher.\n\nFull negative paradigm: si- (I), hau- (you), ha- (he/she), hatu- (we), ham- (you all), hawa- (they).',
    ex:{swahili:'Si-pendi kahawa', english:"I don't like coffee (si- replaces ni-)"} },

  { id:'gr-015', sw:'hau-', en:'you do not — 2sg negative prefix', pr:'ha-u', tags:['grammar','negation','morphology'],
    note:'The "you don\'t" prefix — ha- + u- = hau-. The pattern "ha + subject prefix" works for all persons:\n\n• hau- (you don\'t)\n• hatu- (we don\'t)\n• ham- (you all don\'t)\n• hawa- (they don\'t)\n\nOnly 1sg is irregular: si- (not *ha-ni-).',
    ex:{swahili:'Hau-somi kwa bidii', english:"You don't study hard"} },

  { id:'gr-016', sw:'ha-', en:'he / she does not — 3sg negative prefix', pr:'ha', tags:['grammar','negation','morphology'],
    note:'The "he/she doesn\'t" prefix — ha- + a- contracts to just ha- (the double-a merges).\n\nFull negative paradigm for people:\n• si- → I don\'t\n• hau- → you don\'t\n• ha- → he/she doesn\'t\n• hatu- → we don\'t\n• ham- → you all don\'t\n• hawa- → they don\'t\n\nFor non-human nouns, ha- combines with the noun-class concord (e.g. ha-ki- for Ki class).',
    ex:{swahili:'Ha-kuli chakula', english:"He/she doesn't eat food (ha- + a- → ha-)"} },

  { id:'gr-017', sw:'-ku-', en:'negative past tense marker', pr:'ku', tags:['grammar','negation','morphology'],
    note:'In negative past, -li- is replaced by -ku-:\n\na-li-kula (he ate) → ha-ku-kula (he didn\'t eat)\nni-li-kwenda (I went) → si-ku-kwenda (I didn\'t go)\n\nAlso appears in timeless/habitual negatives: si-ku-penda = I don\'t/didn\'t like.\n\nWarning: -ku- has THREE meanings (infinitive prefix, negative past, 2sg object infix "you") — position in the verb reveals which.',
    ex:{swahili:'Ha-ku-maliza kazi', english:"He/she didn't finish work (-li- → -ku- in negative)"} },

  { id:'gr-018', sw:'-i', en:'negative ending (replaces -a)', pr:'i', tags:['grammar','negation','morphology'],
    note:'In negative present, the verb\'s final -a changes to -i. This is a clear signal that a verb is negative:\n\nku-pend-a (to love) → si-pend-i (I don\'t love)\nku-som-a (to read) → hau-som-i (you don\'t read)\n\nException: one-syllable roots keep -a — si-ji (I don\'t know, from kujua).\n\nPast negatives keep -a: ha-ku-kul-a (he didn\'t eat).',
    ex:{swahili:'Si-pend-i = si + pend + i', english:"I don't love = [not-I] + love + [negative ending]"} },

  // ── Object infixes (1sg → 2sg → 3sg → 1pl → 3pl) ───────────────────────────
  { id:'gr-019', sw:'-ni-', en:'me — 1sg object infix', pr:'ni', tags:['grammar','object-infix','morphology'],
    note:'Inserts "me" directly into the verb. Slot order: SUBJECT + TENSE + OBJECT + ROOT + FINAL.\n\na-na-ni-penda = he loves ME\n\nObject infixes are how Swahili embeds pronouns without needing separate words like "me", "him", "us".',
    ex:{swahili:'A-na-ni-ona = a + na + ni + on + a', english:'He/she sees ME = he/she + [present] + me + see + [active]'} },

  { id:'gr-020', sw:'-ku-', en:'you — 2sg object infix', pr:'ku', tags:['grammar','object-infix','morphology'],
    note:'Means "you" inside the verb: ni-na-ku-penda = I love YOU.\n\n-ku- has three identities — same spelling, different positions:\n• Infinitive prefix: ku-la (to eat)\n• Negative past marker: ha-ku-la (he didn\'t eat)\n• Object infix "you": ni-na-ku-ona (I see you)\n\nPosition in the verb reveals which.',
    ex:{swahili:'Ni-na-ku-penda', english:'I love you — ni(I) na(present) ku(you) pend(love) a(active)'} },

  { id:'gr-021', sw:'-m- / -mw-', en:'him / her — 3sg object infix', pr:'m / mw', tags:['grammar','object-infix','morphology'],
    note:'Inserts "him/her" into the verb — no gender distinction, just like the subject prefix a-.\n\n-m- before consonants: ni-na-m-penda (I love him/her)\n-mw- before vowels: ni-na-mw-ona (I see him/her)\n\nNote: -m- is very short and easy to miss when speaking quickly.',
    ex:{swahili:'A-na-m-saidia rafiki', english:'He/she is helping the friend (the friend = him/her)'} },

  { id:'gr-022', sw:'-tu-', en:'us — 1pl object infix', pr:'tu', tags:['grammar','object-infix','morphology'],
    note:'Inserts "us" into the verb. The same -tu- that is the subject prefix for "we" — just in the object slot.\n\na-na-tu-ambia = he tells US\nwa-li-tu-saidia = they helped US\n\nEasy to remember: tu = us (object) = we (subject).',
    ex:{swahili:'A-na-tu-ambia ukweli', english:'He/she tells us the truth'} },

  { id:'gr-023', sw:'-wa-', en:'them — 3pl object infix (people)', pr:'wa', tags:['grammar','object-infix','morphology'],
    note:'Inserts "them" (for people, M-Wa class) into the verb.\n\nni-na-wa-saidia = I am helping THEM\ntu-li-wa-ambia = we told THEM\n\nFor non-human objects, use the noun-class concord instead (-vi- for books, -zi- for N class, etc.).',
    ex:{swahili:'Ni-na-wa-saidia watoto', english:'I am helping the children (them)'} },

  // ── Infinitive & verb structure ──────────────────────────────────────────────
  { id:'gr-024', sw:'ku-', en:'infinitive prefix — "to [verb]"', pr:'ku', tags:['grammar','infinitive','morphology'],
    note:'Marks the infinitive "to [verb]": ku-penda (to love), ku-la (to eat), ku-sema (to speak).\n\nDropped when you conjugate: ku-penda → ni-na-pend-a.\n\nException: one-syllable roots KEEP ku- as a buffer even when conjugated:\nni-na-ku-la (I am eating — NOT *ni-na-la).\n\nku- also appears as the 2sg object infix "you" — position tells you which.',
    ex:{swahili:'Ninataka ku-lala', english:'I want to sleep (ku- = infinitive marker before lala)'} },

  { id:'gr-025', sw:'SUBJ + TENSE + (OBJ) + ROOT + FINAL', en:'Swahili verb template', pr:'', tags:['grammar','morphology','verb-structure'],
    note:'Every Swahili verb follows the same slot order. Learn this template once — it unlocks thousands of verb forms.\n\nSlots:\n• SUBJECT: ni/u/a/tu/m/wa\n• TENSE: na/li/ta/me/ki/ka/nge\n• (OBJECT): ni/ku/m/tu/wa (optional)\n• ROOT: the verb meaning\n• FINAL: -a (positive) or -i (negative present)\n\nExample: wa-ta-ni-ambia = they(wa) + will(ta) + me(ni) + tell(ambi) + active(a) = they will tell me.',
    ex:{swahili:'ni-li-m-pend-a', english:'I loved him/her — ni(I) li(past) m(him/her) pend(love) a(active)'} },

  // ── Final vowels ─────────────────────────────────────────────────────────────
  { id:'gr-026', sw:'-a', en:'affirmative final vowel', pr:'a', tags:['grammar','final-vowel','morphology'],
    note:'The default ending for all positive (affirmative) verbs. If unsure, -a is almost always right.\n\nChanges in two situations:\n• Negative present: -a → -i (si-pend-i)\n• Subjunctive/polite command: -a → -e (niamb-ie = tell me)\n\nAll three: anasoma (he reads), anaimba (he sings), anacheza (he plays) — always -a.',
    ex:{swahili:'Anasoma, anaimba, anacheza', english:'He reads, sings, plays — all affirmative verbs end in -a'} },

  { id:'gr-027', sw:'-e', en:'subjunctive / polite command ending', pr:'e', tags:['grammar','final-vowel','morphology','subjunctive'],
    note:'In English: "so that...", "let him...", "please..." — the polite and purposive ending.\n\nChanges final -a to -e: ambia → ambie, saidia → saidie.\n\nUsed after:\n• "ili" (so that): ili asome = so that he reads\n• Polite requests: tafadhali niambie = please tell me\n• "acha" (let): acha nipe = let me give\n\nMore polite and formal than the plain imperative (-a).',
    ex:{swahili:'Tafadhali ni-ambi-e', english:'Please tell me (ambia → ambie — subjunctive -e)'} },

  { id:'gr-028', sw:'-wa', en:'passive ending — "to be [verb-ed]"', pr:'wa', tags:['grammar','final-vowel','morphology','passive'],
    note:'In English: passive voice — "to be loved", "to be seen", "to be helped".\n\nReplaces the final -a: ku-pend-a (to love) → ku-pend-wa (to be loved).\n\nTo add "by someone", use "na": wa-na-pend-wa na wazazi wao = they are loved BY their parents.\n\nCommon forms: kupendwa (to be loved), kuonwa (to be seen), kusaidiwa (to be helped).',
    ex:{swahili:'Watoto wa-na-pend-wa', english:'The children are loved (kupenda → kupendwa)'} },

  // ── Noun classes ─────────────────────────────────────────────────────────────
  { id:'gr-029', sw:'M-Wa class: m- / wa-', en:'People noun class — m- (sg) / wa- (pl)', pr:'m / wa', tags:['grammar','noun-class','morphology'],
    note:'The most important noun class — all people, human roles, and some animals.\n\nSingular: m- or mw- before vowels → m-tu (person), mw-alimu (teacher)\nPlural: wa- → wa-tu (people), wa-limu (teachers)\n\nVerb agreement: a- (singular), wa- (plural)\na-na-kula (he eats), wa-na-kula (they eat)\n\nAdjective agreement: m-zuri (good person), wa-zuri (good people).',
    ex:{swahili:'m-tu → wa-tu, mw-alimu → wa-limu', english:'person → people, teacher → teachers'} },

  { id:'gr-030', sw:'M-Mi class: m- / mi-', en:'Plants & rivers noun class — m- (sg) / mi- (pl)', pr:'m / mi', tags:['grammar','noun-class','morphology'],
    note:'Trees, plants, rivers, and natural things. Singular looks the same as M-Wa class — the plural reveals the difference.\n\nSingular: m- → m-ti (tree), m-to (river)\nPlural: mi- → mi-ti (trees), mi-to (rivers)\n\nVerb agreement: u- (singular), i- (plural)\nm-ti u-na-anguka (the tree falls), mi-ti i-na-anguka (the trees fall)\n\nAdjective: m-zuri (singular), mi-zuri (plural).',
    ex:{swahili:'m-ti → mi-ti, m-to → mi-to', english:'tree → trees, river → rivers'} },

  { id:'gr-031', sw:'Ki-Vi class: ki- / vi-', en:'Things & languages noun class — ki- (sg) / vi- (pl)', pr:'ki / vi', tags:['grammar','noun-class','morphology'],
    note:'Things, tools, languages, and abstract concepts.\n\nSingular: ki- or ch- → ki-tabu (book), ki-tu (thing), ch-akula (food)\nPlural: vi- or vy- → vi-tabu (books), vi-tu (things), vy-akula (foods)\n\nNote: ALL Swahili language names are Ki- class — Ki-swahili, Ki-english, Ki-arabic.\n\nVerb agreement: ki- (singular), vi- (plural)\nki-tabu ki-na-anguka (the book falls), vi-tabu vi-na-anguka (the books fall).',
    ex:{swahili:'ki-tabu → vi-tabu, ki-tu → vi-tu', english:'book → books, thing → things'} },

  { id:'gr-032', sw:'N class: n- / n- (or Ø)', en:'Animals & loanwords noun class — same singular & plural', pr:'n', tags:['grammar','noun-class','morphology'],
    note:'Animals, insects, loanwords, and borrowed words. The tricky class — singular and plural look IDENTICAL.\n\nn-dizi can mean "a banana" OR "bananas". Context tells you which.\n\nMany English loanwords land here: simu (phone), basi (bus), kompyuta (computer), televisheni (TV).\n\nVerb agreement: i- (singular), zi- (plural)\nn-dizi i-na-anguka (the banana falls), n-dizi zi-na-anguka (the bananas fall).',
    ex:{swahili:'ndizi → ndizi, njiwa → njiwa', english:'banana = banana(s), dove = dove(s) — same form!'} },

  { id:'gr-033', sw:'Ma class: Ø / ma-', en:'Liquids & collectives noun class — no prefix (sg) / ma- (pl)', pr:'ma', tags:['grammar','noun-class','morphology'],
    note:'Liquids, fruits, collectives, body parts in pairs, and augmentatives (big versions).\n\nSingular: usually no visible prefix → tunda (fruit), ji-cho (eye)\nPlural: ma- → ma-tunda (fruits), ma-cho (eyes)\n\nVerb agreement: li- (singular), ya- (plural)\nma-cho ya-na-angaza (the eyes shine)\n\nSome singulars have ji-: ji-cho (eye), ji-we (stone) — the ji- drops in the plural.',
    ex:{swahili:'tunda → ma-tunda, ji-cho → ma-cho', english:'fruit → fruits, eye → eyes (ji- drops in plural)'} },

  { id:'gr-034', sw:'U class: u- / Ø or ny-', en:'Abstract & long things noun class — u- (sg) / various (pl)', pr:'u', tags:['grammar','noun-class','morphology'],
    note:'Abstract nouns, long thin things, and some body parts.\n\nAbstracts (usually no plural): u-furaha (happiness), u-weza (ability), u-gonjwa (illness)\nConcrete (has plural): u-kuta (wall) → kuta (walls), u-zi (thread) → nyu-zi (threads)\n\nVerb agreement: u- (singular concrete/abstract), zi- (plural concrete)\n\nThis class is less systematic than others — worth learning each noun individually.',
    ex:{swahili:'u-kuta → kuta, u-furaha (no plural)', english:'wall → walls, happiness (abstract — no plural form)'} },

  // ── Concord ──────────────────────────────────────────────────────────────────
  { id:'gr-035', sw:'M-Wa adjective concord: mzuri / wazuri', en:'M-Wa class adjective agreement', pr:'m / wa', tags:['grammar','concord','morphology'],
    note:'In English, adjectives never change: "a good person", "good people" — same word.\n\nIn Swahili, adjectives must match their noun\'s class AND number:\n\nm-tu m-zuri → wa-tu wa-zuri\n(a good person → good people)\n\nThe adjective prefix mirrors the noun prefix. This is called noun-class agreement (concord). Every noun class has its own adjective prefix.',
    ex:{swahili:'mtu m-zuri → watu wa-zuri', english:'a good person → good people (prefix changes with class)'} },

  { id:'gr-036', sw:'Ki-Vi adjective concord: kizuri / vizuri', en:'Ki-Vi class adjective agreement', pr:'ki / vi', tags:['grammar','concord','morphology'],
    note:'The same adjective root (-zuri = good) takes a different prefix for each noun class:\n\nM-Wa: mtu mzuri / watu wazuri\nKi-Vi: kitu ki-zuri / vitu vi-zuri\nM-Mi: mti mzuri / miti mizuri\n\nSo kizuri doesn\'t just mean "good" — it means "good" specifically for a Ki-class thing.\n\nThis is one of the biggest challenges of Swahili grammar for English speakers.',
    ex:{swahili:'kitu ki-zuri → vitu vi-zuri', english:'a good thing → good things (ki- → vi- with the noun)'} },

  { id:'gr-037', sw:'M-Mi subject concord: u-na / i-na', en:'M-Mi class subject-verb agreement', pr:'u / i', tags:['grammar','concord','morphology'],
    note:'When a plant, tree, or river (M-Mi class) is the subject, the verb uses u- or i- — NOT a- or wa-.\n\nm-ti u-na-anguka (the tree falls) — singular uses u-\nmi-ti i-na-anguka (the trees fall) — plural uses i-\n\nEach noun class has its own subject concord. This is why knowing a noun\'s class matters so much — it affects everything connected to it.',
    ex:{swahili:'m-ti u-na-anguka → mi-ti i-na-anguka', english:'the tree falls → the trees fall (u- sg, i- pl)'} },

  { id:'gr-038', sw:'Ki-Vi subject concord: ki-na / vi-na', en:'Ki-Vi class subject-verb agreement', pr:'ki / vi', tags:['grammar','concord','morphology'],
    note:'Things (Ki-Vi class) use ki- or vi- as subject concord — never a- or wa-.\n\nki-tabu ki-na-anguka (the book falls)\nvi-tabu vi-na-anguka (the books fall)\n\nIf you forget the concord and say *kitabu inanguka, a native speaker will understand, but it sounds like a grammar error. Getting concord right is what fluency sounds like.',
    ex:{swahili:'ki-tabu ki-na-anguka → vi-tabu vi-na-anguka', english:'the book falls → the books fall (ki- sg, vi- pl)'} },

  // ── Useful derivational morphology ───────────────────────────────────────────
  { id:'gr-039', sw:'-sha / -isha', en:'causative suffix — "to make/cause someone to [verb]"', pr:'sha / isha', tags:['grammar','derivation','morphology'],
    note:'Makes a verb causative: "to make/cause someone to [verb]".\n\nkula (eat) → ku-l-isha (to feed = to cause to eat)\nlala (sleep) → lal-isha (to put to sleep)\nsoma (study) → somesha (to teach = to cause to learn)\nona (see) → onesha (to show = to cause to see)\n\nExtremely productive — you can causativise almost any verb.',
    ex:{swahili:'kula → kulisha (to feed), lala → lalisha (to put to sleep)', english:'eat → to feed, sleep → to put to sleep'} },

  { id:'gr-040', sw:'-ni', en:'locative suffix — "at / in a place"', pr:'ni', tags:['grammar','locative','morphology'],
    note:'In English: "at" or "in" a place. Add to any place noun:\n\nnyumba (house) → nyumba-ni (at home)\nshule (school) → shule-ni (at school)\nsoko (market) → soko-ni (at the market)\nkazi (work) → kazi-ni (at work)\n\nMakes it easy to say location without a separate preposition. Just add -ni at the end.',
    ex:{swahili:'nyumba → nyumba-ni, shule → shule-ni', english:'house → at home, school → at school'} },

  { id:'gr-041', sw:'-ana', en:'reciprocal suffix — "each other"', pr:'a-na', tags:['grammar','derivation','morphology'],
    note:'In English: "each other" or "one another". Added to a verb root:\n\npenda (love) → pend-ana (love each other)\nona (see) → on-ana (see each other / meet up)\nsalimia (greet) → salim-ana (greet each other)\nambia (tell) → ambi-ana (tell each other)\n\nTutaonana (we\'ll see each other) is one of the most common farewells in Swahili.',
    ex:{swahili:'Tutaonana kesho', english:"We'll see each other tomorrow (ona + ana = onana)"} },

  { id:'gr-042', sw:'-eka / -ikana', en:'stative suffix — "able to be / in a state of"', pr:'e-ka / i-ka-na', tags:['grammar','derivation','morphology'],
    note:'Describes a state or inherent possibility — "able to be [verb-ed]" or "in a state of being [verb-ed]".\n\nfungua (open) → fungu-ka (be openable / can be opened)\nvunja (break) → vunj-ika (be breakable)\nomba (ask) → omb-eka (be askable / possible to ask)\n\nLess common than -sha but useful for describing whether something is possible or what state it\'s in.',
    ex:{swahili:'fungu-ka (be opened), vunj-ika (be broken)', english:'to be openable, to be breakable'} },
];
