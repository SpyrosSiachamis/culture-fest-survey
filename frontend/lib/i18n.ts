/**
 * EN / EL copy.
 *
 * The audience is split between Greek students and locals and foreign visitors, so every string
 * the user can see lives here in both languages. Survey question text is keyed by question id and
 * option value, which keeps `lib/survey.ts` to pure structure — order, kinds and branching.
 *
 * The Greek is a working translation and should get a native-speaker pass before it goes in front
 * of respondents.
 */

export type Lang = "en" | "el";

export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "el", label: "ΕΛ" },
];

type OptionCopy = { label: string; description?: string };
type QuestionCopy = {
  eyebrow: string;
  title: string;
  description?: string;
  note?: string;
  warning?: string;
  lowLabel?: string;
  highLabel?: string;
  options?: Record<string, OptionCopy>;
};

type Dictionary = {
  brand: { place: string; name: string; tagline: string[] };
  common: {
    next: string;
    back: string;
    skip: string;
    submit: string;
    sending: string;
    signIn: string;
    signingIn: string;
    optional: string;
    yourAnswer: string;
    stepOf: (current: number, total: number) => string;
    percentComplete: (percent: number) => string;
    anonymous: string;
    noAnswerLinked: string;
    step: string;
    question: string;
    status: string;
  };
  anon: { badgeTop: string; badgeMid: string; badgeBottom: string; blurb: string };
  eyebrows: { signup: string; verify: string; login: string; done: string };
  signup: {
    heading: string;
    intro: string;
    email: string;
    emailPlaceholder: string;
    phone: string;
    phonePlaceholder: string;
    password: string;
    passwordHint: (min: number) => string;
    submit: string;
    submitting: string;
    privacy: string;
    haveAccount: string;
    haveAccountLink: string;
  };
  verify: {
    heading: string;
    intro: string;
    sentTo: string;
    codeLabel: string;
    verify: string;
    verifying: string;
    resend: string;
    resendIn: (seconds: number) => string;
    footnote: string;
    verifiedHeading: string;
    verifiedBody: string;
    needAccount: string;
    needAccountLink: string;
    editEmail: string;
  };
  login: {
    heading: string;
    intro: string;
    email: string;
    password: string;
    noAccount: string;
    noAccountLink: string;
    enterCode: string;
    signedInHeading: string;
    signedInBody: string;
    startSurvey: string;
  };
  gate: { heading: string; body: string; createAccount: string };
  placeholders: { area: string; feedback: string };
  done: { heading: string; body: string; confirmation: string };
  errors: {
    emailRequired: string;
    emailInvalid: string;
    phoneRequired: string;
    phoneInvalid: string;
    phoneDigits: string;
    passwordRequired: string;
    passwordShort: (min: number) => string;
    passwordLong: string;
    codeRequired: string;
    codeFormat: string;
  };
  survey: Record<string, QuestionCopy>;
};

const en: Dictionary = {
  brand: {
    place: "Hersonissos · Crete",
    name: "Culture Fest",
    tagline: ["Music", "Lineup", "Nights", "You"],
  },
  common: {
    next: "Next",
    back: "Back",
    skip: "Skip this one",
    submit: "Submit",
    sending: "Sending",
    signIn: "Sign in",
    signingIn: "Signing in",
    optional: "Optional",
    yourAnswer: "Your answer",
    stepOf: (current, total) => `${String(current).padStart(2, "0")}/${total}`,
    percentComplete: (percent) => `${percent}% complete`,
    anonymous: "Anonymous",
    noAnswerLinked: "No answer is linked to you",
    step: "Step",
    question: "Question",
    status: "Status",
  },
  anon: {
    badgeTop: "100%",
    badgeMid: "Anon",
    badgeBottom: "No names",
    blurb:
      "Your answers are never linked back to your account. Not by ID, not by email — by nothing at all.",
  },
  eyebrows: {
    signup: "Create account",
    verify: "Verify email",
    login: "Welcome back",
    done: "All done",
  },
  signup: {
    heading: "Get set up",
    intro:
      "Email and phone are both needed — it's how we keep one person to one vote. Neither is ever attached to your answers.",
    email: "Email",
    emailPlaceholder: "you@example.com",
    phone: "Phone",
    phonePlaceholder: "+30 694 123 4567",
    password: "Password",
    passwordHint: (min) => `At least ${min} characters.`,
    submit: "Create account",
    submitting: "Creating",
    privacy:
      "Your email and phone are only ever stored as one-way hashes — they cannot be read back.",
    haveAccount: "Already signed up?",
    haveAccountLink: "Enter your code",
  },
  verify: {
    heading: "Check your email",
    intro: "Punch in the six-digit code we just sent and your account is live.",
    sentTo: "Code sent to",
    codeLabel: "Six-digit code",
    verify: "Verify email",
    verifying: "Verifying",
    resend: "Send a new code",
    resendIn: (seconds) => `Resend in ${seconds}s`,
    footnote:
      "Codes last 15 minutes and work once. Check your spam folder if nothing lands.",
    verifiedHeading: "You're in",
    verifiedBody:
      "Your address is confirmed and your account is active. Sign in and the survey is all yours.",
    needAccount: "Need an account?",
    needAccountLink: "Sign up here",
    editEmail: "Email",
  },
  login: {
    heading: "Sign in",
    intro: "Welcome back. Sign in to pick up where you left off.",
    email: "Email",
    password: "Password",
    noAccount: "No account yet?",
    noAccountLink: "Sign up here",
    enterCode: "Enter your code",
    signedInHeading: "You're in",
    signedInBody: "Signed in and ready. The survey takes about two minutes.",
    startSurvey: "Start the survey",
  },
  gate: {
    heading: "Sign in first",
    body: "The survey is one response per account, so we need you signed in before you start.",
    createAccount: "Create an account",
  },
  placeholders: {
    area: "e.g. Stalis",
    feedback: "Tell us what would make this worth your night out.",
  },
  done: {
    heading: "That's it",
    body: "Your answers are in. Thanks for helping shape the night.",
    confirmation:
      "Response submitted. It is stored with no link back to your account — we cannot tell which answers were yours.",
  },
  errors: {
    emailRequired: "Enter your email address.",
    emailInvalid: "Enter a valid email address.",
    phoneRequired: "Enter your phone number.",
    phoneInvalid: "Enter a valid phone number.",
    phoneDigits: "Phone number must contain between 7 and 15 digits.",
    passwordRequired: "Enter your password.",
    passwordShort: (min) => `Password must be at least ${min} characters.`,
    passwordLong: "Password must be at most 128 characters.",
    codeRequired: "Enter the code from your email.",
    codeFormat: "Enter the six-digit code from your email.",
  },
  survey: {
    audience_type: {
      eyebrow: "First up",
      title: "Which one's you?",
      description: "This decides which questions we ask later, so pick the closest fit.",
      options: {
        student: { label: "Student", description: "Studying here right now" },
        tourist: { label: "Tourist", description: "Visiting Crete on holiday" },
        local: { label: "Local", description: "I live around Hersonissos" },
      },
    },
    age_range: {
      eyebrow: "Optional",
      title: "How old are you?",
      options: {
        "18-20": { label: "18–20" },
        "21-24": { label: "21–24" },
        "25-29": { label: "25–29" },
        "30_plus": { label: "30 or over" },
      },
    },
    gender: {
      eyebrow: "About you",
      title: "How do you identify?",
      options: {
        male: { label: "Male" },
        female: { label: "Female" },
        other: { label: "Other" },
      },
    },
    interest_level: {
      eyebrow: "Be honest",
      title: "How keen are you on a night like this?",
      description: "1 is 'not my thing', 10 is 'tell me where to be'.",
      lowLabel: "Not really",
      highLabel: "Already there",
    },
    ticket_price_range: {
      eyebrow: "Money talk",
      title: "What would you pay?",
      description: "For a full night, with the lineup announced.",
      options: {
        "10-20": { label: "€10–20" },
        "20-30": { label: "€20–30" },
        "30-40": { label: "€30–40" },
        over_40: { label: "Over €40" },
      },
    },
    genre_preferences: {
      eyebrow: "The sound",
      title: "What should we play?",
      description: "Pick as many as you like.",
      options: {
        "greek-pop": { label: "Greek pop" },
        "hip-hop": { label: "Hip-hop" },
        trap: { label: "Trap" },
        "r&b": { label: "R&B" },
        reggaeton: { label: "Reggaeton" },
        house: { label: "House" },
        techno: { label: "Techno" },
        laiko: { label: "Laïkó" },
        rock: { label: "Rock" },
      },
    },
    date_preference: {
      eyebrow: "The date",
      title: "When works best?",
      description: "The festival is planned for September.",
      options: {
        "early-september": { label: "Early September", description: "First two weeks" },
        "late-september": { label: "Late September", description: "Last two weeks" },
        "weekend-only": { label: "Any weekend", description: "As long as it's Fri–Sun" },
        any: { label: "Any date works" },
      },
    },
    start_time_preference: {
      eyebrow: "The clock",
      title: "What time should it kick off?",
      options: {
        "20:00": { label: "Around 20:00" },
        "21:00": { label: "Around 21:00" },
        "22:00": { label: "Around 22:00" },
        "23:00_later": { label: "23:00 or later" },
      },
    },
    group_size: {
      eyebrow: "The crew",
      title: "Who are you coming with?",
      options: {
        alone: { label: "On my own" },
        "2-3": { label: "2–3 of us" },
        "4-5": { label: "4–5 of us" },
        "6_plus": { label: "6 or more" },
      },
    },
    recommend_likelihood: {
      eyebrow: "Word of mouth",
      title: "Would you tell a friend?",
      description: "How likely are you to recommend this to someone you know?",
      lowLabel: "Not likely",
      highLabel: "Definitely",
    },
    food_stall_interest: {
      eyebrow: "The extras",
      title: "Want food stalls?",
      options: {
        yes: { label: "Yes, feed me" },
        no: { label: "Not fussed" },
      },
    },
    alcohol_preference: {
      eyebrow: "Optional",
      title: "What are you drinking?",
      options: {
        beer: { label: "Beer" },
        wine: { label: "Wine" },
        spirits: { label: "Spirits / cocktails" },
        none: { label: "Nothing alcoholic" },
        "no-preference": { label: "No preference" },
      },
    },
    transport_interest: {
      eyebrow: "Getting there",
      title: "Would you use shuttle transport?",
      note: "Transport is €2 flat for visitors. Students with a valid pass travel free.",
      options: {
        yes: { label: "Yes" },
        maybe: { label: "Maybe" },
        no: { label: "No" },
      },
    },
    accommodation_area: {
      eyebrow: "Optional",
      title: "Where are you staying?",
      warning:
        "Optional, and worth thinking about: few people answer from any one area, so filling this in could make your response identifiable. Leave it blank and your answers stay anonymous.",
    },
    has_student_pass: {
      eyebrow: "Getting there",
      title: "Do you have a student transport pass?",
      note: "Students with a valid pass travel free. Everyone else pays €2 flat.",
      options: {
        yes: { label: "Yes, I have one" },
        no: { label: "No, I don't" },
      },
    },
    open_feedback: {
      eyebrow: "Last one",
      title: "Anything else?",
      description: "Artists you want, things we should avoid — all of it helps.",
    },
  },
};

const el: Dictionary = {
  brand: {
    place: "Χερσόνησος · Κρήτη",
    name: "Culture Fest",
    tagline: ["Μουσική", "Lineup", "Νύχτες", "Εσύ"],
  },
  common: {
    next: "Επόμενο",
    back: "Πίσω",
    skip: "Προσπέραση",
    submit: "Υποβολή",
    sending: "Αποστολή",
    signIn: "Σύνδεση",
    signingIn: "Σύνδεση",
    optional: "Προαιρετικό",
    yourAnswer: "Η απάντησή σου",
    stepOf: (current, total) => `${String(current).padStart(2, "0")}/${total}`,
    percentComplete: (percent) => `${percent}% ολοκληρώθηκε`,
    anonymous: "Ανώνυμο",
    noAnswerLinked: "Καμία απάντηση δεν συνδέεται με εσένα",
    step: "Βήμα",
    question: "Ερώτηση",
    status: "Κατάσταση",
  },
  anon: {
    badgeTop: "100%",
    badgeMid: "Ανών.",
    badgeBottom: "Χωρίς ονόματα",
    blurb:
      "Οι απαντήσεις σου δεν συνδέονται ποτέ με τον λογαριασμό σου. Ούτε με ID, ούτε με email — με τίποτα.",
  },
  eyebrows: {
    signup: "Δημιουργία λογαριασμού",
    verify: "Επιβεβαίωση email",
    login: "Καλώς ήρθες πίσω",
    done: "Ολοκληρώθηκε",
  },
  signup: {
    heading: "Ξεκίνα εδώ",
    intro:
      "Χρειάζονται και email και τηλέφωνο — έτσι κρατάμε μία ψήφο ανά άτομο. Κανένα από τα δύο δεν συνδέεται με τις απαντήσεις σου.",
    email: "Email",
    emailPlaceholder: "you@example.com",
    phone: "Τηλέφωνο",
    phonePlaceholder: "+30 694 123 4567",
    password: "Κωδικός",
    passwordHint: (min) => `Τουλάχιστον ${min} χαρακτήρες.`,
    submit: "Δημιουργία λογαριασμού",
    submitting: "Δημιουργία",
    privacy:
      "Το email και το τηλέφωνό σου αποθηκεύονται μόνο ως μονόδρομα hashes — δεν διαβάζονται ξανά.",
    haveAccount: "Έχεις ήδη εγγραφεί;",
    haveAccountLink: "Βάλε τον κωδικό σου",
  },
  verify: {
    heading: "Δες το email σου",
    intro: "Βάλε τον εξαψήφιο κωδικό που μόλις στείλαμε και ο λογαριασμός σου ενεργοποιείται.",
    sentTo: "Ο κωδικός στάλθηκε στο",
    codeLabel: "Εξαψήφιος κωδικός",
    verify: "Επιβεβαίωση email",
    verifying: "Επιβεβαίωση",
    resend: "Στείλε νέο κωδικό",
    resendIn: (seconds) => `Νέος κωδικός σε ${seconds}δ`,
    footnote:
      "Οι κωδικοί ισχύουν 15 λεπτά και χρησιμοποιούνται μία φορά. Δες και τα ανεπιθύμητα αν δεν έρθει.",
    verifiedHeading: "Είσαι μέσα",
    verifiedBody:
      "Το email σου επιβεβαιώθηκε και ο λογαριασμός σου είναι ενεργός. Συνδέσου και ξεκίνα την έρευνα.",
    needAccount: "Δεν έχεις λογαριασμό;",
    needAccountLink: "Κάνε εγγραφή",
    editEmail: "Email",
  },
  login: {
    heading: "Σύνδεση",
    intro: "Καλώς ήρθες πίσω. Συνδέσου για να συνεχίσεις από εκεί που έμεινες.",
    email: "Email",
    password: "Κωδικός",
    noAccount: "Δεν έχεις λογαριασμό;",
    noAccountLink: "Κάνε εγγραφή",
    enterCode: "Βάλε τον κωδικό σου",
    signedInHeading: "Είσαι μέσα",
    signedInBody: "Συνδέθηκες. Η έρευνα θέλει περίπου δύο λεπτά.",
    startSurvey: "Ξεκίνα την έρευνα",
  },
  gate: {
    heading: "Συνδέσου πρώτα",
    body: "Η έρευνα δέχεται μία απάντηση ανά λογαριασμό, οπότε χρειάζεται να είσαι συνδεδεμένος.",
    createAccount: "Δημιουργία λογαριασμού",
  },
  placeholders: {
    area: "π.χ. Σταλίδα",
    feedback: "Πες μας τι θα έκανε τη βραδιά να αξίζει.",
  },
  done: {
    heading: "Τελείωσε",
    body: "Οι απαντήσεις σου καταχωρήθηκαν. Ευχαριστούμε που βοηθάς να στηθεί η βραδιά.",
    confirmation:
      "Η απάντηση υποβλήθηκε. Αποθηκεύεται χωρίς καμία σύνδεση με τον λογαριασμό σου — δεν μπορούμε να ξέρουμε ποιες απαντήσεις ήταν δικές σου.",
  },
  errors: {
    emailRequired: "Συμπλήρωσε το email σου.",
    emailInvalid: "Βάλε ένα έγκυρο email.",
    phoneRequired: "Συμπλήρωσε το τηλέφωνό σου.",
    phoneInvalid: "Βάλε ένα έγκυρο τηλέφωνο.",
    phoneDigits: "Το τηλέφωνο πρέπει να έχει από 7 έως 15 ψηφία.",
    passwordRequired: "Συμπλήρωσε τον κωδικό σου.",
    passwordShort: (min) => `Ο κωδικός πρέπει να έχει τουλάχιστον ${min} χαρακτήρες.`,
    passwordLong: "Ο κωδικός δεν μπορεί να ξεπερνά τους 128 χαρακτήρες.",
    codeRequired: "Βάλε τον κωδικό από το email σου.",
    codeFormat: "Βάλε τον εξαψήφιο κωδικό από το email σου.",
  },
  survey: {
    audience_type: {
      eyebrow: "Πρώτα απ' όλα",
      title: "Ποιος είσαι;",
      description: "Αυτό καθορίζει τις επόμενες ερωτήσεις, οπότε διάλεξε ό,τι σου ταιριάζει.",
      options: {
        student: { label: "Φοιτητής", description: "Σπουδάζω εδώ αυτή την περίοδο" },
        tourist: { label: "Τουρίστας", description: "Επισκέπτομαι την Κρήτη για διακοπές" },
        local: { label: "Ντόπιος", description: "Μένω γύρω από τη Χερσόνησο" },
      },
    },
    age_range: {
      eyebrow: "Προαιρετικό",
      title: "Πόσων χρονών είσαι;",
      options: {
        "18-20": { label: "18–20" },
        "21-24": { label: "21–24" },
        "25-29": { label: "25–29" },
        "30_plus": { label: "30 και άνω" },
      },
    },
    gender: {
      eyebrow: "Για σένα",
      title: "Πώς προσδιορίζεσαι;",
      options: {
        male: { label: "Άνδρας" },
        female: { label: "Γυναίκα" },
        other: { label: "Άλλο" },
      },
    },
    interest_level: {
      eyebrow: "Ειλικρινά",
      title: "Πόσο σε ενδιαφέρει μια τέτοια βραδιά;",
      description: "Το 1 είναι «δεν είναι για μένα», το 10 «πες μου πού να είμαι».",
      lowLabel: "Όχι ιδιαίτερα",
      highLabel: "Είμαι ήδη εκεί",
    },
    ticket_price_range: {
      eyebrow: "Τα οικονομικά",
      title: "Πόσα θα έδινες;",
      description: "Για μια ολόκληρη βραδιά, με ανακοινωμένο lineup.",
      options: {
        "10-20": { label: "10–20 €" },
        "20-30": { label: "20–30 €" },
        "30-40": { label: "30–40 €" },
        over_40: { label: "Πάνω από 40 €" },
      },
    },
    genre_preferences: {
      eyebrow: "Ο ήχος",
      title: "Τι να παίξουμε;",
      description: "Διάλεξε όσα θέλεις.",
      options: {
        "greek-pop": { label: "Ελληνικό pop" },
        "hip-hop": { label: "Hip-hop" },
        trap: { label: "Trap" },
        "r&b": { label: "R&B" },
        reggaeton: { label: "Reggaeton" },
        house: { label: "House" },
        techno: { label: "Techno" },
        laiko: { label: "Λαϊκά" },
        rock: { label: "Rock" },
      },
    },
    date_preference: {
      eyebrow: "Η ημερομηνία",
      title: "Πότε σε βολεύει;",
      description: "Το φεστιβάλ σχεδιάζεται για τον Σεπτέμβριο.",
      options: {
        "early-september": { label: "Αρχές Σεπτεμβρίου", description: "Πρώτο δεκαπενθήμερο" },
        "late-september": { label: "Τέλη Σεπτεμβρίου", description: "Δεύτερο δεκαπενθήμερο" },
        "weekend-only": { label: "Όποιο Σαββατοκύριακο", description: "Αρκεί να είναι Παρ–Κυρ" },
        any: { label: "Οποιαδήποτε μέρα" },
      },
    },
    start_time_preference: {
      eyebrow: "Η ώρα",
      title: "Τι ώρα να ξεκινήσει;",
      options: {
        "20:00": { label: "Γύρω στις 20:00" },
        "21:00": { label: "Γύρω στις 21:00" },
        "22:00": { label: "Γύρω στις 22:00" },
        "23:00_later": { label: "23:00 ή αργότερα" },
      },
    },
    group_size: {
      eyebrow: "Η παρέα",
      title: "Με ποιους θα έρθεις;",
      options: {
        alone: { label: "Μόνος μου" },
        "2-3": { label: "2–3 άτομα" },
        "4-5": { label: "4–5 άτομα" },
        "6_plus": { label: "6 ή περισσότερα" },
      },
    },
    recommend_likelihood: {
      eyebrow: "Από στόμα σε στόμα",
      title: "Θα το έλεγες σε φίλο;",
      description: "Πόσο πιθανό είναι να το προτείνεις σε κάποιον που ξέρεις;",
      lowLabel: "Απίθανο",
      highLabel: "Σίγουρα",
    },
    food_stall_interest: {
      eyebrow: "Τα έξτρα",
      title: "Θέλεις σημεία με φαγητό;",
      options: {
        yes: { label: "Ναι, οπωσδήποτε" },
        no: { label: "Δεν με νοιάζει" },
      },
    },
    alcohol_preference: {
      eyebrow: "Προαιρετικό",
      title: "Τι πίνεις;",
      options: {
        beer: { label: "Μπύρα" },
        wine: { label: "Κρασί" },
        spirits: { label: "Ποτά / κοκτέιλ" },
        none: { label: "Τίποτα αλκοολούχο" },
        "no-preference": { label: "Χωρίς προτίμηση" },
      },
    },
    transport_interest: {
      eyebrow: "Η μετακίνηση",
      title: "Θα χρησιμοποιούσες μεταφορά;",
      note: "Η μεταφορά κοστίζει 2 € για τους επισκέπτες. Οι φοιτητές με κάρτα ταξιδεύουν δωρεάν.",
      options: {
        yes: { label: "Ναι" },
        maybe: { label: "Ίσως" },
        no: { label: "Όχι" },
      },
    },
    accommodation_area: {
      eyebrow: "Προαιρετικό",
      title: "Πού μένεις;",
      warning:
        "Προαιρετικό, και αξίζει να το σκεφτείς: λίγοι απαντούν από κάθε περιοχή, οπότε αν το συμπληρώσεις η απάντησή σου μπορεί να γίνει αναγνωρίσιμη. Άφησέ το κενό και παραμένει ανώνυμη.",
    },
    has_student_pass: {
      eyebrow: "Η μετακίνηση",
      title: "Έχεις φοιτητική κάρτα μεταφοράς;",
      note: "Οι φοιτητές με κάρτα ταξιδεύουν δωρεάν. Όλοι οι άλλοι πληρώνουν 2 €.",
      options: {
        yes: { label: "Ναι, έχω" },
        no: { label: "Όχι, δεν έχω" },
      },
    },
    open_feedback: {
      eyebrow: "Τελευταία",
      title: "Κάτι άλλο;",
      description: "Καλλιτέχνες που θέλεις, πράγματα που να αποφύγουμε — όλα βοηθούν.",
    },
  },
};

export const DICTIONARIES: Record<Lang, Dictionary> = { en, el };
export type { Dictionary, QuestionCopy };
