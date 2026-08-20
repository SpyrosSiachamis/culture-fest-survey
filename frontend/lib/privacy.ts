/**
 * The privacy policy, as structured content rather than markup.
 *
 * This is the one piece of user-facing copy that does not live in `locales/*.json`, and the reason
 * is shape: every other string in the app is a short, flat label, whereas this is a twelve-section
 * legal document whose paragraphs, sub-headings and lists have to stay in a specific order. JSON
 * can hold that, but `Dictionary = typeof en` would infer the block tags as plain `string`, so the
 * page could not narrow on them without casting. A discriminated union here keeps the renderer
 * exhaustive — a new block kind is a type error until the page handles it.
 *
 * The English text is the version supplied by the project team and is authoritative; the Greek is a
 * translation of it, which is what `privacy.translationNote` tells the reader in both locales.
 * Update the two together, and move the `updated` date whenever the wording changes — section 11
 * promises exactly that.
 */

import type { Lang } from "@/lib/i18n";

export type PolicyBlock =
  /** A paragraph. */
  | { kind: "p"; text: string }
  /** A sub-heading inside a numbered section. */
  | { kind: "h3"; text: string }
  /** A bulleted list. */
  | { kind: "list"; items: string[] }
  /** Label/value pairs. `href` turns the value into a link (mailto: or https:). */
  | { kind: "contact"; rows: { label: string; value: string; href?: string }[] };

export type PolicySection = {
  /** Stable anchor id — deliberately not derived from the heading, which is translated. */
  id: string;
  heading: string;
  blocks: PolicyBlock[];
};

export type Policy = {
  updated: string;
  status: string;
  intro: string;
  sections: PolicySection[];
};

const PRIVACY_EMAIL = "culturefestgreece@outlook.com";
const PRIVACY_MAILTO = `mailto:${PRIVACY_EMAIL}`;
const WEBSITE = "https://culturefestgreece.gr/";

const en: Policy = {
  updated: "20 August 2026",
  status: "Draft for review",
  intro:
    "This Privacy Policy explains how the Project Team handles information collected " +
    "through the Culture Fest website, account system, and survey.",
  sections: [
    {
      id: "responsible",
      heading: "1. Who is responsible for the information?",
      blocks: [
        {
          kind: "p",
          text: "The Culture Fest website and survey are operated by the Project Team.",
        },
        {
          kind: "p",
          text: "For questions about privacy or personal information, users can contact:",
        },
        {
          kind: "contact",
          rows: [
            { label: "Privacy Contact", value: "Spyridon Siachamis" },
            { label: "Privacy Email", value: PRIVACY_EMAIL, href: PRIVACY_MAILTO },
          ],
        },
        {
          kind: "p",
          text:
            "The privacy contact receives privacy-related requests and coordinates with the " +
            "Project Team where necessary.",
        },
      ],
    },
    {
      id: "collect",
      heading: "2. What information do we collect?",
      blocks: [
        { kind: "h3", text: "Account information" },
        { kind: "p", text: "When you create an account, the service may collect:" },
        {
          kind: "list",
          items: [
            "Email address",
            "Phone number",
            "Password",
            "Account creation date",
            "Email verification status",
            "Survey participation status",
            "Eligibility and redemption status",
          ],
        },
        {
          kind: "p",
          text:
            "Passwords are never stored in plain text and are protected using secure password " +
            "hashing.",
        },
        {
          kind: "p",
          text:
            "For privacy and security purposes, email addresses and phone numbers are stored in a " +
            "protected, hashed form within the application database.",
        },
        { kind: "h3", text: "Survey information" },
        { kind: "p", text: "When you complete the Culture Fest survey, we may collect:" },
        {
          kind: "list",
          items: [
            "Audience type",
            "Gender",
            "Age range",
            "Interest level",
            "Likelihood of recommending the event",
            "Preferred ticket-price range",
            "Date preference",
            "Group size",
            "Interest in food stalls",
            "Interest in transportation",
            "Accommodation area",
            "Student-pass status",
            "Optional open feedback",
            "Survey submission date and time",
          ],
        },
      ],
    },
    {
      id: "separation",
      heading: "3. Separation of account and survey information",
      blocks: [
        {
          kind: "p",
          text:
            "Culture Fest is designed to keep survey responses separate from account identity.",
        },
        {
          kind: "p",
          text:
            "Survey responses do not contain your account ID, email address, or phone number.",
        },
        {
          kind: "p",
          text:
            "Your account does record whether you have submitted the survey. This is necessary to " +
            "prevent multiple submissions from the same account and, where applicable, determine " +
            "eligibility for an associated event benefit.",
        },
        {
          kind: "p",
          text:
            "As a result, the system can record that an account has submitted a survey without " +
            "storing that account's identity together with the specific answers submitted.",
        },
        {
          kind: "p",
          text:
            "Please avoid including unnecessary personal or sensitive information in the optional " +
            "open-feedback field.",
        },
      ],
    },
    {
      id: "why",
      heading: "4. Why do we use this information?",
      blocks: [
        {
          kind: "p",
          text:
            "The Culture Fest survey is being used as a trial run for the festival. Its purpose is " +
            "to help the Project Team understand attendee preferences, evaluate the " +
            "event, and develop the Culture Fest brand and future events.",
        },
        { kind: "p", text: "Information may be used to:" },
        {
          kind: "list",
          items: [
            "Create and manage attendee accounts",
            "Verify accounts",
            "Authenticate users",
            "Prevent duplicate survey submissions",
            "Analyze attendee preferences",
            "Evaluate the festival",
            "Plan future Culture Fest events",
            "Improve the attendee experience",
            "Determine eligibility for event benefits",
            "Manage digital passes and QR-based benefits",
            "Record redemption of eligible benefits",
            "Maintain and secure the website",
            "Prevent abuse or fraudulent activity",
            "Troubleshoot technical issues",
          ],
        },
        {
          kind: "p",
          text:
            "Survey information is intended for internal use by the Project Team and " +
            "is not intended to be shared with people outside the project team for their own " +
            "purposes.",
        },
      ],
    },
    {
      id: "cookies",
      heading: "5. Authentication and cookies",
      blocks: [
        {
          kind: "p",
          text:
            "The website uses JSON Web Tokens (JWTs) to maintain authenticated user sessions.",
        },
        {
          kind: "p",
          text:
            "The JWT is stored in an HttpOnly, Secure cookie and is used by the server to identify " +
            "the authenticated account.",
        },
        { kind: "p", text: "The authentication cookie:" },
        {
          kind: "list",
          items: [
            "Cannot normally be accessed by client-side JavaScript because it is HttpOnly",
            "Is transmitted only over HTTPS because it is Secure",
            "Uses SameSite protections to reduce cross-site request risks",
            "Contains authentication/session information rather than survey responses",
          ],
        },
        {
          kind: "p",
          text: "Administrative and other access permissions are determined by the server.",
        },
      ],
    },
    {
      id: "sharing",
      heading: "6. Sharing and service providers",
      blocks: [
        { kind: "p", text: "We do not sell your personal information." },
        {
          kind: "p",
          text:
            "Survey responses are intended for internal use by the Project Team.",
        },
        {
          kind: "p",
          text:
            "The technical operation of the website requires third-party infrastructure and " +
            "service providers. These currently include:",
        },
        {
          kind: "list",
          items: [
            "Vercel — website hosting and deployment",
            "Railway — application and database infrastructure",
            "Resend — transactional email delivery",
          ],
        },
        {
          kind: "p",
          text:
            "These services may process information as necessary to provide their services.",
        },
        {
          kind: "p",
          text:
            "Information may also be disclosed where required by applicable law or a lawful " +
            "request from a competent authority.",
        },
      ],
    },
    {
      id: "security",
      heading: "7. Data security",
      blocks: [
        {
          kind: "p",
          text:
            "The Culture Fest service uses technical measures designed to protect information " +
            "against unauthorized access, alteration, disclosure, or destruction.",
        },
        { kind: "p", text: "These measures include:" },
        {
          kind: "list",
          items: [
            "Secure password hashing",
            "Protected authentication sessions",
            "Server-side authorization",
            "Administrative access controls",
            "Rate limiting",
            "Input validation",
            "Request-size restrictions",
            "HTTPS",
            "Protection of application secrets",
            "Separation of account information from survey responses",
            "Database protections against concurrent duplicate survey submissions",
          ],
        },
        {
          kind: "p",
          text:
            "While we take reasonable measures to protect information, no internet-based service " +
            "can guarantee absolute security.",
        },
      ],
    },
    {
      id: "retention",
      heading: "8. How long is information retained?",
      blocks: [
        {
          kind: "p",
          text:
            "Account information and survey responses are retained for the operation of the " +
            "Culture Fest event and related event activities.",
        },
        {
          kind: "p",
          text:
            "The information will be deleted after the festival has concluded and the associated " +
            "event operations have been completed.",
        },
        {
          kind: "p",
          text:
            "Information may remain temporarily in technical backups or service-provider systems " +
            "according to their applicable retention and deletion procedures.",
        },
        { kind: "p", text: "Information may also be retained where required by law." },
      ],
    },
    {
      id: "rights",
      heading: "9. Your rights",
      blocks: [
        {
          kind: "p",
          text:
            "Depending on applicable law, you may have rights regarding your personal information, " +
            "including the right to:",
        },
        {
          kind: "list",
          items: [
            "Request access to your personal information",
            "Request correction of inaccurate information",
            "Request deletion of your information",
            "Request restriction of processing",
            "Object to certain processing",
            "Request data portability where applicable",
            "Withdraw consent where processing is based on consent",
          ],
        },
        { kind: "p", text: "Privacy requests can be submitted to:" },
        {
          kind: "contact",
          rows: [
            { label: "Privacy Contact", value: "Spyridon Siachamis" },
            { label: "Privacy Email", value: PRIVACY_EMAIL, href: PRIVACY_MAILTO },
          ],
        },
        {
          kind: "p",
          text:
            "Because survey responses are deliberately stored separately from account identity, it " +
            "may not always be technically possible to identify a particular survey response as " +
            "belonging to a specific account.",
        },
        {
          kind: "p",
          text:
            "You may also have the right to lodge a complaint with the relevant data-protection " +
            "supervisory authority.",
        },
      ],
    },
    {
      id: "feedback",
      heading: "10. Optional feedback",
      blocks: [
        { kind: "p", text: "The survey includes an optional open-feedback field." },
        {
          kind: "p",
          text:
            "Please do not include passwords, financial information, unnecessary contact " +
            "information, or other sensitive personal information in your response.",
        },
      ],
    },
    {
      id: "changes",
      heading: "11. Changes to this Privacy Policy",
      blocks: [
        {
          kind: "p",
          text:
            "We may update this Privacy Policy if the Culture Fest service, its data-processing " +
            "practices, or applicable requirements change.",
        },
        {
          kind: "p",
          text: "When changes are made, the “Last updated” date will be updated.",
        },
      ],
    },
    {
      id: "contact",
      heading: "12. Contact",
      blocks: [
        {
          kind: "p",
          text:
            "For questions about privacy, personal information, or this Privacy Policy:",
        },
        {
          kind: "contact",
          rows: [
            { label: "Team", value: "The Project Team" },
            { label: "Privacy Contact", value: "Spyridon Siachamis" },
            { label: "Privacy Email", value: PRIVACY_EMAIL, href: PRIVACY_MAILTO },
            { label: "Website", value: WEBSITE, href: WEBSITE },
          ],
        },
      ],
    },
  ],
};

const el: Policy = {
  updated: "20 Αυγούστου 2026",
  status: "Προσχέδιο προς αναθεώρηση",
  intro:
    "Η παρούσα Πολιτική Απορρήτου εξηγεί πώς η Ομάδα Έργου διαχειρίζεται τις " +
    "πληροφορίες που συλλέγονται μέσω του ιστότοπου, του συστήματος λογαριασμών και της έρευνας " +
    "του Culture Fest.",
  sections: [
    {
      id: "responsible",
      heading: "1. Ποιος είναι υπεύθυνος για τις πληροφορίες;",
      blocks: [
        {
          kind: "p",
          text:
            "Ο ιστότοπος και η έρευνα του Culture Fest λειτουργούν από την Ομάδα Έργου.",
        },
        {
          kind: "p",
          text:
            "Για ερωτήσεις σχετικά με το απόρρητο ή τα προσωπικά δεδομένα, οι χρήστες μπορούν να " +
            "επικοινωνούν:",
        },
        {
          kind: "contact",
          rows: [
            { label: "Υπεύθυνος απορρήτου", value: "Spyridon Siachamis" },
            { label: "Email απορρήτου", value: PRIVACY_EMAIL, href: PRIVACY_MAILTO },
          ],
        },
        {
          kind: "p",
          text:
            "Ο υπεύθυνος απορρήτου λαμβάνει τα αιτήματα που αφορούν το απόρρητο και συνεργάζεται " +
            "με την Ομάδα Έργου όπου χρειάζεται.",
        },
      ],
    },
    {
      id: "collect",
      heading: "2. Ποιες πληροφορίες συλλέγουμε;",
      blocks: [
        { kind: "h3", text: "Στοιχεία λογαριασμού" },
        { kind: "p", text: "Όταν δημιουργείς λογαριασμό, η υπηρεσία ενδέχεται να συλλέξει:" },
        {
          kind: "list",
          items: [
            "Διεύθυνση email",
            "Αριθμό τηλεφώνου",
            "Κωδικό πρόσβασης",
            "Ημερομηνία δημιουργίας λογαριασμού",
            "Κατάσταση επιβεβαίωσης email",
            "Κατάσταση συμμετοχής στην έρευνα",
            "Κατάσταση επιλεξιμότητας και εξαργύρωσης",
          ],
        },
        {
          kind: "p",
          text:
            "Οι κωδικοί πρόσβασης δεν αποθηκεύονται ποτέ σε απλό κείμενο και προστατεύονται με " +
            "ασφαλή κρυπτογραφική σύνοψη (hashing).",
        },
        {
          kind: "p",
          text:
            "Για λόγους απορρήτου και ασφάλειας, οι διευθύνσεις email και οι αριθμοί τηλεφώνου " +
            "αποθηκεύονται σε προστατευμένη μορφή σύνοψης (hash) μέσα στη βάση δεδομένων της " +
            "εφαρμογής.",
        },
        { kind: "h3", text: "Στοιχεία έρευνας" },
        {
          kind: "p",
          text: "Όταν συμπληρώνεις την έρευνα του Culture Fest, ενδέχεται να συλλέξουμε:",
        },
        {
          kind: "list",
          items: [
            "Τύπο κοινού",
            "Φύλο",
            "Ηλικιακή ομάδα",
            "Επίπεδο ενδιαφέροντος",
            "Πιθανότητα να προτείνεις την εκδήλωση",
            "Προτιμώμενο εύρος τιμής εισιτηρίου",
            "Προτίμηση ημερομηνίας",
            "Μέγεθος παρέας",
            "Ενδιαφέρον για σημεία φαγητού",
            "Ενδιαφέρον για μεταφορά",
            "Περιοχή διαμονής",
            "Κατοχή φοιτητικού πάσου",
            "Προαιρετικά ελεύθερα σχόλια",
            "Ημερομηνία και ώρα υποβολής της έρευνας",
          ],
        },
      ],
    },
    {
      id: "separation",
      heading: "3. Διαχωρισμός στοιχείων λογαριασμού και έρευνας",
      blocks: [
        {
          kind: "p",
          text:
            "Το Culture Fest έχει σχεδιαστεί ώστε οι απαντήσεις της έρευνας να παραμένουν χωριστά " +
            "από την ταυτότητα του λογαριασμού.",
        },
        {
          kind: "p",
          text:
            "Οι απαντήσεις της έρευνας δεν περιέχουν το αναγνωριστικό του λογαριασμού σου, τη " +
            "διεύθυνση email ή τον αριθμό τηλεφώνου σου.",
        },
        {
          kind: "p",
          text:
            "Ο λογαριασμός σου καταγράφει ωστόσο αν έχεις υποβάλει την έρευνα. Αυτό είναι " +
            "απαραίτητο για να αποτρέπονται πολλαπλές υποβολές από τον ίδιο λογαριασμό και, όπου " +
            "ισχύει, για να προσδιορίζεται η επιλεξιμότητα για σχετικό προνόμιο της εκδήλωσης.",
        },
        {
          kind: "p",
          text:
            "Ως αποτέλεσμα, το σύστημα μπορεί να καταγράψει ότι ένας λογαριασμός υπέβαλε την " +
            "έρευνα, χωρίς να αποθηκεύει την ταυτότητα του λογαριασμού μαζί με τις συγκεκριμένες " +
            "απαντήσεις που υποβλήθηκαν.",
        },
        {
          kind: "p",
          text:
            "Παρακαλούμε απόφυγε να συμπεριλάβεις περιττά προσωπικά ή ευαίσθητα στοιχεία στο " +
            "προαιρετικό πεδίο ελεύθερων σχολίων.",
        },
      ],
    },
    {
      id: "why",
      heading: "4. Γιατί χρησιμοποιούμε αυτές τις πληροφορίες;",
      blocks: [
        {
          kind: "p",
          text:
            "Η έρευνα του Culture Fest χρησιμοποιείται ως δοκιμαστική εφαρμογή για το φεστιβάλ. " +
            "Σκοπός της είναι να βοηθήσει την Ομάδα Έργου να κατανοήσει τις " +
            "προτιμήσεις του κοινού, να αξιολογήσει την εκδήλωση και να αναπτύξει τη μάρκα " +
            "Culture Fest και μελλοντικές εκδηλώσεις.",
        },
        { kind: "p", text: "Οι πληροφορίες ενδέχεται να χρησιμοποιηθούν για:" },
        {
          kind: "list",
          items: [
            "Δημιουργία και διαχείριση λογαριασμών επισκεπτών",
            "Επιβεβαίωση λογαριασμών",
            "Ταυτοποίηση χρηστών",
            "Αποτροπή διπλών υποβολών της έρευνας",
            "Ανάλυση των προτιμήσεων του κοινού",
            "Αξιολόγηση του φεστιβάλ",
            "Σχεδιασμό μελλοντικών εκδηλώσεων Culture Fest",
            "Βελτίωση της εμπειρίας των επισκεπτών",
            "Προσδιορισμό επιλεξιμότητας για προνόμια της εκδήλωσης",
            "Διαχείριση ψηφιακών πάσων και προνομίων μέσω QR",
            "Καταγραφή της εξαργύρωσης των προνομίων",
            "Συντήρηση και ασφάλεια του ιστότοπου",
            "Αποτροπή κατάχρησης ή δόλιας δραστηριότητας",
            "Αντιμετώπιση τεχνικών προβλημάτων",
          ],
        },
        {
          kind: "p",
          text:
            "Τα στοιχεία της έρευνας προορίζονται για εσωτερική χρήση από την Ομάδα Έργου και " +
            "δεν προορίζονται να κοινοποιηθούν σε άτομα εκτός της ομάδας για δικούς τους σκοπούς.",
        },
      ],
    },
    {
      id: "cookies",
      heading: "5. Ταυτοποίηση και cookies",
      blocks: [
        {
          kind: "p",
          text:
            "Ο ιστότοπος χρησιμοποιεί JSON Web Tokens (JWT) για τη διατήρηση των συνεδριών των " +
            "συνδεδεμένων χρηστών.",
        },
        {
          kind: "p",
          text:
            "Το JWT αποθηκεύεται σε cookie τύπου HttpOnly και Secure και χρησιμοποιείται από τον " +
            "διακομιστή για την αναγνώριση του συνδεδεμένου λογαριασμού.",
        },
        { kind: "p", text: "Το cookie ταυτοποίησης:" },
        {
          kind: "list",
          items: [
            "Δεν είναι κανονικά προσβάσιμο από JavaScript στην πλευρά του προγράμματος περιήγησης, επειδή είναι HttpOnly",
            "Μεταδίδεται μόνο μέσω HTTPS, επειδή είναι Secure",
            "Χρησιμοποιεί προστασίες SameSite για τη μείωση των κινδύνων από αιτήματα άλλων ιστότοπων",
            "Περιέχει πληροφορίες ταυτοποίησης/συνεδρίας και όχι απαντήσεις της έρευνας",
          ],
        },
        {
          kind: "p",
          text: "Τα δικαιώματα διαχειριστικής και λοιπής πρόσβασης καθορίζονται από τον διακομιστή.",
        },
      ],
    },
    {
      id: "sharing",
      heading: "6. Κοινοποίηση και πάροχοι υπηρεσιών",
      blocks: [
        { kind: "p", text: "Δεν πουλάμε τα προσωπικά σου δεδομένα." },
        {
          kind: "p",
          text:
            "Οι απαντήσεις της έρευνας προορίζονται για εσωτερική χρήση από την Ομάδα Έργου.",
        },
        {
          kind: "p",
          text:
            "Η τεχνική λειτουργία του ιστότοπου απαιτεί υποδομές και παρόχους υπηρεσιών τρίτων. " +
            "Αυτή τη στιγμή περιλαμβάνουν:",
        },
        {
          kind: "list",
          items: [
            "Vercel — φιλοξενία και ανάπτυξη του ιστότοπου",
            "Railway — υποδομή εφαρμογής και βάσης δεδομένων",
            "Resend — αποστολή email συναλλαγών",
          ],
        },
        {
          kind: "p",
          text:
            "Οι υπηρεσίες αυτές ενδέχεται να επεξεργάζονται πληροφορίες όπως απαιτείται για την " +
            "παροχή των υπηρεσιών τους.",
        },
        {
          kind: "p",
          text:
            "Πληροφορίες ενδέχεται επίσης να κοινοποιηθούν όπου απαιτείται από την ισχύουσα " +
            "νομοθεσία ή κατόπιν νόμιμου αιτήματος αρμόδιας αρχής.",
        },
      ],
    },
    {
      id: "security",
      heading: "7. Ασφάλεια δεδομένων",
      blocks: [
        {
          kind: "p",
          text:
            "Η υπηρεσία Culture Fest χρησιμοποιεί τεχνικά μέτρα σχεδιασμένα να προστατεύουν τις " +
            "πληροφορίες από μη εξουσιοδοτημένη πρόσβαση, αλλοίωση, κοινοποίηση ή καταστροφή.",
        },
        { kind: "p", text: "Τα μέτρα αυτά περιλαμβάνουν:" },
        {
          kind: "list",
          items: [
            "Ασφαλή κρυπτογραφική σύνοψη κωδικών πρόσβασης",
            "Προστατευμένες συνεδρίες ταυτοποίησης",
            "Έλεγχο εξουσιοδότησης στην πλευρά του διακομιστή",
            "Ελέγχους διαχειριστικής πρόσβασης",
            "Περιορισμό ρυθμού αιτημάτων",
            "Έλεγχο εγκυρότητας των δεδομένων εισόδου",
            "Περιορισμούς στο μέγεθος των αιτημάτων",
            "HTTPS",
            "Προστασία των μυστικών κλειδιών της εφαρμογής",
            "Διαχωρισμό των στοιχείων λογαριασμού από τις απαντήσεις της έρευνας",
            "Προστασίες της βάσης δεδομένων έναντι ταυτόχρονων διπλών υποβολών της έρευνας",
          ],
        },
        {
          kind: "p",
          text:
            "Παρότι λαμβάνουμε εύλογα μέτρα προστασίας, καμία υπηρεσία στο διαδίκτυο δεν μπορεί να " +
            "εγγυηθεί απόλυτη ασφάλεια.",
        },
      ],
    },
    {
      id: "retention",
      heading: "8. Για πόσο διάστημα διατηρούνται οι πληροφορίες;",
      blocks: [
        {
          kind: "p",
          text:
            "Τα στοιχεία λογαριασμού και οι απαντήσεις της έρευνας διατηρούνται για τη λειτουργία " +
            "της εκδήλωσης Culture Fest και των σχετικών δραστηριοτήτων.",
        },
        {
          kind: "p",
          text:
            "Οι πληροφορίες θα διαγραφούν αφού ολοκληρωθεί το φεστιβάλ και οι σχετικές λειτουργίες " +
            "της εκδήλωσης.",
        },
        {
          kind: "p",
          text:
            "Πληροφορίες ενδέχεται να παραμείνουν προσωρινά σε τεχνικά αντίγραφα ασφαλείας ή στα " +
            "συστήματα των παρόχων υπηρεσιών, σύμφωνα με τις ισχύουσες διαδικασίες διατήρησης και " +
            "διαγραφής τους.",
        },
        {
          kind: "p",
          text: "Πληροφορίες ενδέχεται επίσης να διατηρηθούν όπου απαιτείται από τον νόμο.",
        },
      ],
    },
    {
      id: "rights",
      heading: "9. Τα δικαιώματά σου",
      blocks: [
        {
          kind: "p",
          text:
            "Ανάλογα με την ισχύουσα νομοθεσία, ενδέχεται να έχεις δικαιώματα σχετικά με τα " +
            "προσωπικά σου δεδομένα, όπως το δικαίωμα:",
        },
        {
          kind: "list",
          items: [
            "Πρόσβασης στα προσωπικά σου δεδομένα",
            "Διόρθωσης ανακριβών στοιχείων",
            "Διαγραφής των δεδομένων σου",
            "Περιορισμού της επεξεργασίας",
            "Εναντίωσης σε ορισμένες επεξεργασίες",
            "Φορητότητας των δεδομένων, όπου ισχύει",
            "Ανάκλησης της συγκατάθεσης, όπου η επεξεργασία βασίζεται σε συγκατάθεση",
          ],
        },
        { kind: "p", text: "Τα αιτήματα για θέματα απορρήτου μπορούν να υποβληθούν στη διεύθυνση:" },
        {
          kind: "contact",
          rows: [
            { label: "Υπεύθυνος απορρήτου", value: "Spyridon Siachamis" },
            { label: "Email απορρήτου", value: PRIVACY_EMAIL, href: PRIVACY_MAILTO },
          ],
        },
        {
          kind: "p",
          text:
            "Επειδή οι απαντήσεις της έρευνας αποθηκεύονται σκόπιμα χωριστά από την ταυτότητα του " +
            "λογαριασμού, ενδέχεται να μην είναι πάντα τεχνικά εφικτό να ταυτοποιηθεί μια " +
            "συγκεκριμένη απάντηση ως ανήκουσα σε συγκεκριμένο λογαριασμό.",
        },
        {
          kind: "p",
          text:
            "Έχεις επίσης το δικαίωμα να υποβάλεις καταγγελία στην αρμόδια εποπτική αρχή " +
            "προστασίας δεδομένων.",
        },
      ],
    },
    {
      id: "feedback",
      heading: "10. Προαιρετικά σχόλια",
      blocks: [
        { kind: "p", text: "Η έρευνα περιλαμβάνει ένα προαιρετικό πεδίο ελεύθερων σχολίων." },
        {
          kind: "p",
          text:
            "Παρακαλούμε μη συμπεριλαμβάνεις κωδικούς πρόσβασης, οικονομικά στοιχεία, περιττά " +
            "στοιχεία επικοινωνίας ή άλλα ευαίσθητα προσωπικά δεδομένα στην απάντησή σου.",
        },
      ],
    },
    {
      id: "changes",
      heading: "11. Αλλαγές στην παρούσα Πολιτική Απορρήτου",
      blocks: [
        {
          kind: "p",
          text:
            "Ενδέχεται να επικαιροποιήσουμε την παρούσα Πολιτική Απορρήτου αν αλλάξει η υπηρεσία " +
            "Culture Fest, οι πρακτικές επεξεργασίας δεδομένων της ή οι ισχύουσες απαιτήσεις.",
        },
        {
          kind: "p",
          text: "Όταν γίνονται αλλαγές, ενημερώνεται η ημερομηνία «Τελευταία ενημέρωση».",
        },
      ],
    },
    {
      id: "contact",
      heading: "12. Επικοινωνία",
      blocks: [
        {
          kind: "p",
          text:
            "Για ερωτήσεις σχετικά με το απόρρητο, τα προσωπικά δεδομένα ή την παρούσα Πολιτική " +
            "Απορρήτου:",
        },
        {
          kind: "contact",
          rows: [
            { label: "Ομάδα", value: "The Project Team" },
            { label: "Υπεύθυνος απορρήτου", value: "Spyridon Siachamis" },
            { label: "Email απορρήτου", value: PRIVACY_EMAIL, href: PRIVACY_MAILTO },
            { label: "Ιστότοπος", value: WEBSITE, href: WEBSITE },
          ],
        },
      ],
    },
  ],
};

export const POLICIES: Record<Lang, Policy> = { en, el };
