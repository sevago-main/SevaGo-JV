'use strict';
/**
 * Hyperlocal landing-page content. Every factual claim here is taken from SevaGo's own Google Play
 * listings (checked 24 Nov 2026) or from app screens. Nothing about partner counts, response times,
 * prices per task or neighbourhood-level coverage is claimed, because SevaGo has not published it.
 * Local-area context (landmarks, roads) is general public knowledge: verify before publishing changes.
 *
 * Markup allowed in strings: [text](/path) links and **bold**.
 */
const UPDATED = '2026-11-24';

const HOW_POSTER = [
  '**Post your task.** Describe what you need done, add the location and your requirements.',
  '**Find local help.** Partners nearby can take up your request and send offers.',
  '**Follow progress.** Stay informed through task updates and in-app communication.',
  '**Complete the task.** Review the work and confirm completion. Your payment stays protected until you approve.',
];
const HOW_PARTNER = [
  '**Sign up and complete verification.** Every Partner is KYC verified.',
  '**Choose the kinds of tasks you can do** and go online.',
  '**Get offers near you** and accept the ones you want.',
  '**Do the work, add a completion photo** and submit it.',
  '**Get paid.** When the Poster approves, the money is added to your balance. Payouts are processed every Tuesday and Friday.',
];
const AVAIL = 'SevaGo is live in Coimbatore and Bengaluru. Availability depends on your location and the partners available nearby, so some tasks may get offers faster than others.';
const BUDGET = 'You set the budget and partners respond with offers. The minimum task budget in the app is ₹199, and any service fee is shown before you confirm. Budgets that match the distance, time and effort involved tend to attract better-matched offers.';

const AREAS = [
  { slug: 'saravanampatti', name: 'Saravanampatti' },
  { slug: 'rs-puram', name: 'RS Puram' },
  { slug: 'peelamedu', name: 'Peelamedu' },
];

const pages = [
  {
    slug: '', // /coimbatore/
    kind: 'hub',
    title: 'SevaGo in Coimbatore: Errands, Queue Help & Local Tasks',
    description: 'Post errands, pickups, queue-standing and everyday tasks in Coimbatore, or earn as a SevaGo Partner. Android app available now, iOS waitlist open.',
    h1: 'Errands and local help in Coimbatore',
    crumb: 'Coimbatore',
    cta: 'poster',
    intro: [
      'SevaGo connects people in Coimbatore who need something done with local partners who can do it: pickups, drop-offs, waiting in a queue, collecting documents and other everyday tasks that need a person on the ground.',
      AVAIL,
    ],
    sections: [
      { h2: 'What you can get done in Coimbatore', list: [
        '[Errand services](/coimbatore/errand-services): pickups, drop-offs, shopping pickups and small errands',
        '[Queue standing](/coimbatore/queue-standing-services): someone to wait in line or be present for you',
        '[Document pickup and delivery](/coimbatore/document-pickup-delivery)',
        '[Personal assistance](/coimbatore/personal-assistance) for day-to-day tasks',
        '[Odd jobs](/coimbatore/odd-jobs): practical small tasks',
      ] },
      { h2: 'Earn in Coimbatore as a Partner', paras: ['Prefer to be the helper? Choose the tasks you can do, accept the ones you want and get paid for finished work. See [part-time earning with SevaGo](/coimbatore/part-time-jobs).'] },
      { h2: 'Coimbatore neighbourhoods', paras: ['Tasks can be posted from anywhere in the city. These guides cover common tasks and local context for three busy areas:'], list: AREAS.map((a) => '[' + a.name + '](/coimbatore/' + a.slug + ')') },
      { h2: 'How it works', ol: HOW_POSTER },
    ],
    faqs: [
      { q: 'Is SevaGo available in Coimbatore?', a: 'Yes. SevaGo is live in Coimbatore and Bengaluru. Availability depends on your location and the partners available nearby.' },
      { q: 'Is there an iPhone app?', a: 'Not yet. The Android app is available on Google Play and an iOS waitlist is open on the [SevaGo home page](/#download).' },
      { q: 'How do I pay?', a: 'Payments are made in the app. A Poster’s payment is protected until the work is approved.' },
    ],
    related: ['errand-services', 'queue-standing-services', 'part-time-jobs'],
  },
  {
    slug: 'errand-services',
    kind: 'service',
    service: 'Errand services',
    title: 'Errand Services in Coimbatore: Pickups, Drop-offs & More | SevaGo',
    description: 'Get errands done in Coimbatore: parcel pickups, shopping pickups, drop-offs and small local tasks. Post on SevaGo, compare partner offers, pay in the app.',
    h1: 'Errand services in Coimbatore',
    crumb: 'Errand services',
    cta: 'poster',
    intro: [
      'Short on time? Post an errand on SevaGo and a local partner can pick it up, drop it off or handle it in person while you get on with your day.',
      AVAIL,
    ],
    sections: [
      { h2: 'Errands people post', list: [
        'Pick up or drop off parcels and personal items',
        'Shopping pickups and small purchases',
        'Collect documents from nearby locations',
        'Local deliveries and drop-offs',
        'Small tasks that need someone physically present',
      ] },
      { h2: 'How to get a good result', list: [
        'Give exact pickup and drop locations, and the time you need it by',
        'Describe the item (size, how many, anything fragile)',
        'Say what proof you want, such as a photo on completion',
        'Keep personal details out of the task description; use in-app messages for specifics',
      ] },
      { h2: 'Budget guide', paras: [BUDGET] },
      { h2: 'How it works', ol: HOW_POSTER },
      { h2: 'Staying safe', paras: ['Every SevaGo Partner is KYC verified, and your payment is protected until you approve the work. Use in-app messages so task updates stay in one place.'] },
    ],
    faqs: [
      { q: 'Can I get an errand done today?', a: 'It depends on the partners available near you at that moment. Add the time you need it by, and partners decide whether they can take it.' },
      { q: 'What does an errand cost?', a: 'You set the budget and partners send offers. The minimum budget in the app is ₹199 and any service fee is shown before you confirm.' },
      { q: 'How do I know the errand was done?', a: 'Partners add a completion photo when they submit the work. You review it and confirm before payment is released.' },
      { q: 'Is SevaGo only for Coimbatore?', a: 'No. SevaGo is live in Coimbatore and Bengaluru, and growing city by city.' },
    ],
    related: ['queue-standing-services', 'document-pickup-delivery', 'odd-jobs'],
  },
  {
    slug: 'queue-standing-services',
    kind: 'service',
    service: 'Queue standing service',
    title: 'Queue Standing Service in Coimbatore | SevaGo',
    description: 'Need someone to wait in line or be present for you in Coimbatore? Post the task on SevaGo and get help from a verified local partner.',
    h1: 'Queue standing service in Coimbatore',
    crumb: 'Queue standing',
    cta: 'poster',
    intro: [
      'Waiting in line costs hours. On SevaGo you can ask a local partner to wait in a queue or be present for an in-person task so you don’t have to.',
      AVAIL,
    ],
    sections: [
      { h2: 'When people use it', list: [
        'Waiting in a queue for a counter, collection or launch',
        'Being present for an appointment, visit or follow-up',
        'Document collection that needs someone in person',
        'Arranging someone to be present for an everyday task',
      ] },
      { h2: 'Before you post', list: [
        'Check that the place allows someone to act on your behalf for what you need',
        'State the place, the time window and what the partner should do when they reach the front',
        'Say if the partner should call or message you at a particular point',
      ] },
      { h2: 'Budget guide', paras: [BUDGET + ' Longer waits usually mean more of the partner’s time, so budget accordingly.'] },
      { h2: 'How it works', ol: HOW_POSTER },
    ],
    faqs: [
      { q: 'Can a partner act on my behalf at any office?', a: 'Not necessarily. Rules differ by office and service. Check what the place allows before you post, and describe the task clearly.' },
      { q: 'How is payment handled?', a: 'Payment is made in the app and protected until you approve the work.' },
      { q: 'How long will the partner wait?', a: 'Set the time window in the task description and agree it through the in-app messages before the partner starts.' },
    ],
    related: ['errand-services', 'personal-assistance', 'document-pickup-delivery'],
  },
  {
    slug: 'document-pickup-delivery',
    kind: 'service',
    service: 'Document pickup and delivery',
    title: 'Document Pickup & Delivery in Coimbatore | SevaGo',
    description: 'Collect or deliver documents across Coimbatore. Post a pickup or drop task on SevaGo, pick a verified partner and confirm when it is done.',
    h1: 'Document pickup and delivery in Coimbatore',
    crumb: 'Document pickup',
    cta: 'poster',
    intro: [
      'Need papers collected from one place and delivered to another? Post the task on SevaGo and a local partner can pick them up and drop them off.',
      AVAIL,
    ],
    sections: [
      { h2: 'Typical document tasks', list: [
        'Collect documents from nearby locations',
        'Deliver documents and packages to an address',
        'On-ground visits and verification assistance',
        'Simple administrative errands for individuals and small businesses',
      ] },
      { h2: 'Tips for sensitive paperwork', list: [
        'Share only what the partner needs to complete the task',
        'Use the in-app messages instead of public places or other channels for details',
        'Ask for a completion photo and review it before you confirm',
      ] },
      { h2: 'Budget guide', paras: [BUDGET] },
      { h2: 'How it works', ol: HOW_POSTER },
    ],
    faqs: [
      { q: 'Are SevaGo partners verified?', a: 'Yes. Every Partner is KYC verified before they can accept tasks.' },
      { q: 'Can I get proof of delivery?', a: 'Partners add a completion photo when they submit the work, and you confirm completion in the app.' },
      { q: 'Does SevaGo serve areas outside Coimbatore?', a: 'SevaGo is live in Coimbatore and Bengaluru today.' },
    ],
    related: ['errand-services', 'queue-standing-services', 'personal-assistance'],
  },
  {
    slug: 'personal-assistance',
    kind: 'service',
    service: 'Personal assistance',
    title: 'Personal Assistance in Coimbatore: Everyday Task Help | SevaGo',
    description: 'Get day-to-day help in Coimbatore: visits, follow-ups, pickups and routine tasks. Post on SevaGo and choose from partner offers.',
    h1: 'Personal assistance in Coimbatore',
    crumb: 'Personal assistance',
    cta: 'poster',
    intro: [
      'A personal assistant for one task at a time. Describe what you need, and a local partner can take it on, with no retainer and no long-term commitment.',
      AVAIL,
    ],
    sections: [
      { h2: 'Everyday help people ask for', list: [
        'Small personal tasks and day-to-day assistance',
        'Help with appointments, visits and follow-ups',
        'Practical jobs when you’re busy',
        'Local support for routine activities',
      ] },
      { h2: 'Who uses SevaGo', paras: ['SevaGo’s own listing describes students, working professionals, busy parents and business owners. If it is a task that needs time, effort or someone physically present, you can post it.'] },
      { h2: 'Budget guide', paras: [BUDGET] },
      { h2: 'How it works', ol: HOW_POSTER },
    ],
    faqs: [
      { q: 'Is this a full-time personal assistant?', a: 'No. SevaGo is task-based: you post a task, a partner does it, and you confirm completion.' },
      { q: 'Can I post digital or admin tasks?', a: 'SevaGo supports simple administrative and digital tasks as well as in-person ones. Describe clearly what you need.' },
    ],
    related: ['errand-services', 'queue-standing-services', 'odd-jobs'],
  },
  {
    slug: 'odd-jobs',
    kind: 'service',
    service: 'Odd jobs and small tasks',
    title: 'Odd Jobs in Coimbatore: Post or Do Small Tasks | SevaGo',
    description: 'Have a small task that needs a person? Post it on SevaGo, or pick up odd jobs near you in Coimbatore as a Partner and get paid in the app.',
    h1: 'Odd jobs in Coimbatore',
    crumb: 'Odd jobs',
    cta: 'poster',
    intro: [
      'Odd jobs are the small, practical tasks that don’t fit any service category. SevaGo is built for exactly those: post anything legal that needs a person nearby, or earn by taking on the ones that suit you.',
      AVAIL,
    ],
    sections: [
      { h2: 'If you need a job done', paras: ['Post the task with a clear description, location and budget. Compare offers from local partners and pick the one you trust. [See how errands work](/coimbatore/errand-services).'] },
      { h2: 'If you want to earn', paras: ['Partners choose the kinds of tasks they can handle and skip the rest. There are no listed salaries or fixed hours: earnings depend on the tasks available near you. [Read about earning with SevaGo](/coimbatore/part-time-jobs).'] },
      { h2: 'How it works for Posters', ol: HOW_POSTER },
    ],
    faqs: [
      { q: 'Does SevaGo list jobs with fixed pay?', a: 'No. SevaGo is a task marketplace. Posters set a budget, partners send offers and the agreed amount is paid when the work is approved.' },
      { q: 'What kinds of tasks are allowed?', a: 'Anything legal that needs a person nearby. SevaGo’s [Terms](/terms) list prohibited conduct.' },
    ],
    related: ['part-time-jobs', 'errand-services', 'personal-assistance'],
  },
  {
    slug: 'part-time-jobs',
    kind: 'service',
    cta: 'partner',
    service: 'Task-based earning for local partners',
    title: 'Earn in Your Free Time in Coimbatore: SevaGo Partner | SevaGo',
    description: 'Choose tasks near you in Coimbatore, work when you want and get paid in the app. SevaGo Partner is KYC verified, with payouts every Tuesday and Friday.',
    h1: 'Earn in your free time in Coimbatore',
    crumb: 'Part-time earning',
    intro: [
      'SevaGo Partner is for people who want to earn by helping others with everyday tasks near them. You choose the tasks you can do, accept the ones you want and get paid for finished work.',
      'This is task-based earning, not a salaried job or a list of vacancies. What you earn depends on the tasks available near you and the budgets Posters set.',
    ],
    sections: [
      { h2: 'Why people choose it', list: [
        'Keep up to 92% of every task budget. You see what you will earn before you accept',
        'You choose the tasks and skip the rest',
        'Offers come from people near you, so you spend your time working instead of travelling',
        'Every Partner is KYC verified, and every Poster’s payment is protected until the work is approved',
        'Support is inside the app',
      ] },
      { h2: 'How to start', ol: HOW_PARTNER },
      { h2: 'Good for', paras: ['Students, people between jobs and anyone with spare hours who wants flexible, task-by-task earning. The Partner app is Android-only for now.'] },
      { h2: 'Things to know', list: [
        'Fees apply and the amount you earn depends on the task budget',
        AVAIL,
      ] },
    ],
    faqs: [
      { q: 'How and when do I get paid?', a: 'When the Poster approves your work, the money is added to your balance. Payouts are processed every Tuesday and Friday.' },
      { q: 'Is this a job with a fixed salary?', a: 'No. You choose tasks and earn per completed task.' },
      { q: 'Do I need an iPhone or Android?', a: 'The Partner app is available on Android.' },
      { q: 'Who can I contact for help?', a: 'Support is inside the app, and you can email [team@sevago.co.in](mailto:team@sevago.co.in).' },
    ],
    related: ['odd-jobs', 'errand-services', 'personal-assistance'],
  },
  {
    slug: 'saravanampatti',
    kind: 'area',
    area: 'Saravanampatti',
    title: 'Errands & Local Help in Saravanampatti, Coimbatore | SevaGo',
    description: 'Get errands, pickups and queue help from Saravanampatti, Coimbatore, or earn nearby as a SevaGo Partner. Post a task and compare offers.',
    h1: 'Errands and local help in Saravanampatti',
    crumb: 'Saravanampatti',
    cta: 'poster',
    intro: [
      'Saravanampatti is a busy northern suburb of Coimbatore on Sathy Road, with IT offices and many working professionals and students living nearby. When days are full, it helps to hand off the small things.',
      'You can post a task from Saravanampatti on SevaGo, and partners can accept it. Whether someone nearby can take it depends on who is available at the time.',
    ],
    sections: [
      { h2: 'Tasks that suit a busy commuter area', list: [
        'Parcel and courier pickups while you are at work',
        'Collecting documents or items and delivering them to your door',
        'Waiting in a queue or being present for a visit',
        'Everyday personal tasks you don’t have time for',
      ] },
      { h2: 'Posting from Saravanampatti', list: [
        'Add the exact address or a clear landmark, and the time window',
        'Say whether the task is on your way to or from the office',
        'Agree timing through the in-app messages',
      ] },
      { h2: 'Earning nearby', paras: ['Partners can pick tasks that fit their own schedule and area. See [how earning with SevaGo works](/coimbatore/part-time-jobs).'] },
      { h2: 'How it works', ol: HOW_POSTER },
    ],
    faqs: [
      { q: 'Does SevaGo have partners in Saravanampatti?', a: 'SevaGo is live in Coimbatore. Neighbourhood-level availability depends on the partners nearby at the time you post.' },
      { q: 'What is the minimum budget?', a: 'The minimum task budget in the app is ₹199.' },
    ],
    related: ['errand-services', 'document-pickup-delivery', 'part-time-jobs'],
  },
  {
    slug: 'rs-puram',
    kind: 'area',
    area: 'RS Puram',
    title: 'Errands & Local Help in RS Puram, Coimbatore | SevaGo',
    description: 'Get pickups, errands and queue help in RS Puram, Coimbatore, or earn nearby as a SevaGo Partner. Post a task and compare offers.',
    h1: 'Errands and local help in RS Puram',
    crumb: 'RS Puram',
    cta: 'poster',
    intro: [
      'RS Puram is one of Coimbatore’s central residential and shopping neighbourhoods, centred around DB Road. With so much happening close together, small errands are common and so is the need to be in two places at once.',
      'Post a task from RS Puram on SevaGo and local partners can respond. Whether a partner is nearby depends on who is available when you post.',
    ],
    sections: [
      { h2: 'Common tasks around a busy shopping area', list: [
        'Shopping pickups and small purchases',
        'Parcel pickups and drop-offs to other parts of the city',
        'Document collection and delivery',
        'Waiting in line or being present for an appointment',
      ] },
      { h2: 'Tips for a quick match', list: [
        'Name the shop, building or landmark and the easiest entrance',
        'Describe the item or paperwork and any handling needs',
        'Set a fair budget for the distance and time involved',
      ] },
      { h2: 'Earning nearby', paras: ['Prefer to be the helper? [Read how Partners earn](/coimbatore/part-time-jobs).'] },
      { h2: 'How it works', ol: HOW_POSTER },
    ],
    faqs: [
      { q: 'Is SevaGo available in RS Puram?', a: 'SevaGo is live in Coimbatore. Neighbourhood-level availability depends on the partners nearby at the time you post.' },
      { q: 'How is payment protected?', a: 'A Poster’s payment is protected until the work is approved.' },
    ],
    related: ['errand-services', 'queue-standing-services', 'document-pickup-delivery'],
  },
  {
    slug: 'peelamedu',
    kind: 'area',
    area: 'Peelamedu',
    title: 'Errands & Local Help in Peelamedu, Coimbatore | SevaGo',
    description: 'Get errands, pickups and everyday help in Peelamedu, Coimbatore, or earn nearby as a SevaGo Partner, including students. Post a task on SevaGo.',
    h1: 'Errands and local help in Peelamedu',
    crumb: 'Peelamedu',
    cta: 'poster',
    intro: [
      'Peelamedu, on the east side of Coimbatore along Avinashi Road, is home to colleges such as PSG College of Technology, the city’s airport and busy retail streets, so students and travellers both have errands to run.',
      'Post a task from Peelamedu on SevaGo and local partners can respond. Whether someone is nearby depends on who is available when you post.',
    ],
    sections: [
      { h2: 'Tasks that fit a student and travel area', list: [
        'Campus errands and local pickups',
        'Parcel pickups and drop-offs, for example when you are travelling',
        'Document collection and delivery',
        'Small personal tasks and everyday assistance',
      ] },
      { h2: 'For students who want to earn', paras: ['Partners choose the tasks and the hours that fit around classes. SevaGo is task-based, so there are no fixed shifts. [See how earning works](/coimbatore/part-time-jobs).'] },
      { h2: 'Posting from Peelamedu', list: [
        'Add the exact address, hostel or landmark and a time window',
        'Say if the item is time-sensitive, such as something needed before a journey',
      ] },
      { h2: 'How it works', ol: HOW_POSTER },
    ],
    faqs: [
      { q: 'Can students use SevaGo?', a: 'Posters need to be 18 or older. Check the [Terms](/terms) for eligibility. Students who are eligible can post tasks or earn as Partners.' },
      { q: 'Does SevaGo have partners in Peelamedu?', a: 'SevaGo is live in Coimbatore. Neighbourhood-level availability depends on the partners nearby at the time you post.' },
    ],
    related: ['part-time-jobs', 'errand-services', 'odd-jobs'],
  },
];

module.exports = { pages, UPDATED, AREAS };
