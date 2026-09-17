import type { Manual } from "./types";

export const manualEn: Manual = {
  title: "TodorovNET manual",
  subtitle: "Everything organizers, timekeepers, GPS judges and the jury need to know – from creating an event to official results.",
  updated: "Edition for the 2026 season",
  contents: "Contents",
  quickStart: {
    title: "Quick start by role",
    items: [
      { role: "Organizer", text: "Creates the event, entries, stages and staff.", anchor: "prepare" },
      { role: "Timekeeper", text: "Records times from a phone, even without coverage.", anchor: "timing" },
      { role: "GPS judge", text: "Checks tracks and proposes penalties.", anchor: "gps" },
      { role: "Jury", text: "Confirms penalties, decides protests, publishes.", anchor: "jury" },
    ],
  },
  roles: {
    title: "Who can do what",
    intro: "Roles are given per event in the “Staff” tab. One person can hold several roles. The super admin can do everything.",
    columns: ["Organizer", "Timekeeper", "GPS judge", "Jury", "Chair"],
    rows: [
      { task: "Settings, classes, entries, stages", marks: ["✓", "", "", "", ""] },
      { task: "Adding timekeepers and GPS judges", marks: ["✓", "", "", "", ""] },
      { task: "Recording and voiding times", marks: ["✓", "✓", "", "", ""] },
      { task: "Starting a heat and the red flag", marks: ["✓", "✓", "", "", ""] },
      { task: "GPS check and proposing a penalty", marks: ["✓", "", "✓", "✓", "✓"] },
      { task: "Confirming penalties", marks: ["", "", "", "✓", "✓"] },
      { task: "DNS / DNF / DSQ statuses", marks: ["✓", "✓", "", "✓", "✓"] },
      { task: "Neutralised time (adjustments)", marks: ["✓", "", "", "✓", "✓"] },
      { task: "Protests", marks: ["✓", "", "", "✓", "✓"] },
      { task: "Provisional results", marks: ["✓", "✓", "", "", "✓"] },
      { task: "Official results", marks: ["", "", "", "", "✓"] },
      { task: "SOS and course messages", marks: ["✓", "✓", "✓", "✓", "✓"] },
    ],
    legend: "Chair = jury chair. Permissions are enforced by the database – a button you are not allowed to use will not work.",
  },
  chapters: [
    {
      id: "overview",
      icon: "🧭",
      title: "How the system works",
      summary: "Four steps: preparation, race, checks and publishing.",
      sections: [
        {
          title: "The path of a result",
          steps: [
            "The organizer creates the event, classes, entries and stages and generates the start list.",
            "Timekeepers record start, checkpoints and finish from their phones. Every record is kept on the phone first and sent afterwards.",
            "Standings on the site are computed live from the recorded times, penalties and statuses.",
            "GPS judges check tracks and propose penalties; the jury confirms them and decides protests.",
            "The jury chair publishes provisional results and, after the protest window, official results with a PDF.",
          ],
        },
        {
          title: "Three principles",
          bullets: [
            "Nothing is deleted: a wrong record is voided with a reason and stays in the history.",
            "Every change is logged – who and when – so the jury can check everything.",
            "Published results are frozen as a numbered version. The PDF is always made from that frozen copy.",
          ],
        },
      ],
    },
    {
      id: "prepare",
      icon: "🛠️",
      title: "Preparing an event (organizer)",
      summary: "From an empty system to a ready start list.",
      sections: [
        {
          title: "1. The event",
          steps: [
            "Admin → “New event”. Fill in name, location, dates and kind.",
            "For a championship round choose the season and round number. Afterwards only the super admin can change these.",
            "Choose ranking “By points (BG-X)”, or “By total time” for free events.",
            "Status: “Draft (hidden)” while preparing; “Upcoming” when it should be visible; “Live” on race day; “Finished” at the end.",
            "In “Settings” press “Upload photo” – it appears on the home page and in the archive.",
          ],
          tip: "The photo is resized in the browser, so you can upload straight from a phone.",
        },
        {
          title: "2. Classes and entries",
          steps: [
            "“Classes”: tick the classes that race and set their start order.",
            "“Entries”: add riders with “Add entry” or press “Import from Excel or CSV”.",
            "Review entries flagged for checking – age, licence, club, registered number or a ban from the previous round.",
          ],
          bullets: [
            "Columns the import recognises: number, first name, last name (or “rider”), class, club, country, birth date, phone, email, licence.",
            "CSV files saved by Excel on Bulgarian Windows (Cyrillic) are read correctly.",
          ],
        },
        {
          title: "3. Stages and the start list",
          steps: [
            "“Stages” → “New stage”. For navigation set the first start, interval, riders per slot and course close.",
            "Open the stage. In “Per-class settings” set order, gap before the class, distance or a different interval.",
            "Add checkpoints with “Add control” (CP1, CP2 …).",
            "Press “Generate the start list” and check it on the public page.",
          ],
          warning: "Once the first time is recorded for a stage, its start list is locked. Check it before the race.",
        },
        {
          title: "4. Enduro-cross",
          steps: [
            "Create an “Enduro-cross” stage and press “Create qualifying and 2 heats for every class”.",
            "With more than 20 riders in a class press “Qualifying groups A/B (more than 20 riders)”.",
            "After qualifying press “Finals grid (top 12 from qualifying)”.",
          ],
        },
        {
          title: "5. Staff",
          steps: [
            "“Staff” → enter the person's email and role → “Add to staff”.",
            "The person must already have an account. Accounts are created by the super admin.",
          ],
          tip: "The super admin sees every current event in the timing app without being added to “Staff”.",
        },
      ],
    },
    {
      id: "timing",
      icon: "⏱️",
      title: "Timing from a phone",
      summary: "Fast recording, working without coverage, nothing lost.",
      sections: [
        {
          title: "Before the race – required",
          steps: [
            "Open the site on the phone → “Timing” and sign in while you have internet.",
            "Install the app: on Android the “📲 Install the app” button; on iPhone in Safari “Share” → “Add to Home Screen”.",
            "Open the app from its icon and sign in again (on iPhone the installed app has its own sign-in).",
            "Choose the event. From then on it opens without coverage too.",
          ],
          warning: "Do not install or sign in for the first time on the course without internet – the app has no way to load the entries.",
        },
        {
          title: "Recording a time",
          steps: [
            "Choose the stage and point – “Start”, a checkpoint or “Finish”. In enduro-cross choose the heat.",
            "Type the number. The rider's name and class appear – check it is the right person.",
            "Press “Record”. The phone vibrates and a green banner shows the number and time.",
          ],
          bullets: [
            "The time is the moment you press, matched to the server clock.",
            "“⏱ Fix the time” catches the moment before you type the number – handy for groups arriving together.",
            "“Manual time” – for a time from a paper sheet.",
            "A double tap records once. The “Record” button always stays on screen.",
            "With a Bluetooth keyboard: digits, Enter = record, Backspace = delete, Esc = clear.",
            "☀ switches on sunlight mode – black on white, readable in direct sun.",
          ],
        },
        {
          title: "Without coverage",
          text: [
            "Records stay on the phone marked “Waiting for connection” and are sent automatically as soon as possible. You can close the app – nothing is lost.",
            "If the session expires, a red banner appears at the top – tap it and sign in again. Records wait on the phone.",
          ],
        },
        {
          title: "A wrong record",
          steps: [
            "In “Recent records” press “Void” next to the wrong record.",
            "Wait a second and press “Confirm void”. A connection is needed.",
            "Record the correct time again.",
          ],
          bullets: [
            "“Rejected” means the record conflicts with the data – for example this number already has a time at this point.",
            "“Resend rejected” sends rejected records again after the jury fixes the entry.",
          ],
        },
        {
          title: "Enduro-cross: start and red flag",
          steps: [
            "Choose the heat and press “▶ Start” exactly at the start.",
            "In danger press “⚑ Red flag”. In the admin panel the jury chooses “Classify at the flag” or “Restart the heat”.",
          ],
        },
        {
          title: "SOS and messages",
          steps: [
            "Type the injured rider's number (optional) and press “🆘 SOS / Message”.",
            "Describe what is happening and press “Send SOS” or “Send message”.",
          ],
          text: ["The organizer and jury see it at once in the “Messages” tab with a map. An SOS sent without coverage goes first as soon as there is signal."],
          warning: "For a serious incident without coverage call 112 – the SOS in the app does not replace the emergency number.",
        },
      ],
    },
    {
      id: "gps",
      icon: "🛰️",
      title: "GPS check",
      summary: "Deviations, signal gaps and missed waypoints – with evidence.",
      sections: [
        {
          title: "Checking a track",
          steps: [
            "“GPS check” → choose the stage → “Upload official track (GPX)” (once per stage).",
            "Tick the mandatory waypoints and press “Save mandatory waypoints”.",
            "Enter the number, choose the rider's GPX file and press “Check”.",
            "For a violation press “Propose penalty” – the map and a section of the track are attached as evidence.",
          ],
          bullets: [
            "Deviation 100–500 m = 30 minutes; 500–1000 m = 2 hours; over 1000 m = disqualification (Rule XIX.4).",
            "Under 100 m there is no penalty. The same thresholds apply to signal gaps.",
            "The rider's file is not uploaded anywhere until you propose a penalty.",
          ],
          tip: "A proposed penalty does not count until the jury confirms it.",
        },
      ],
    },
    {
      id: "jury",
      icon: "⚖️",
      title: "Jury and publishing",
      summary: "Penalties, protests and the road to official results.",
      sections: [
        {
          title: "Penalties and statuses",
          steps: [
            "“Penalties”: review proposals and press “Confirm” or “Reject”.",
            "For an enduro-cross violation choose the heat in the “Stage” field – a time penalty is added to that heat.",
            "“Rider status”: DNS, DNF, DSQ or NC for a stage or heat → “Set status”.",
          ],
          text: ["A confirmed penalty can be changed only by the jury."],
        },
        {
          title: "Times and adjustments",
          bullets: [
            "“Times” lists every record. Manual times from paper and voids with a reason are done by the organizer or a timekeeper.",
            "“Add adjustment” – neutralised time for one rider or a whole class (e.g. helping an injured rider). Done by the jury or organizer.",
          ],
        },
        {
          title: "Protests",
          steps: [
            "“Protests” → “File a protest”: type, fact, who files and against whom, whether the 80 € fee is paid.",
            "The system shows the deadline and whether the protest was filed in time.",
            "Decide with “Uphold” or “Reject” and write the reasons. An upheld protest refunds the fee.",
          ],
        },
        {
          title: "Publishing",
          steps: [
            "“Publishing” → set the protest window → “Publish provisional”.",
            "After the window and decided protests, the chair presses “Declare official”.",
            "Each publication is a numbered version with a PDF; the site shows its status and deadline.",
          ],
          warning: "Official results cannot be edited. If there is a mistake – fix the data and publish a new version.",
        },
      ],
    },
    {
      id: "season",
      icon: "🏆",
      title: "Season, registry and teams",
      summary: "How the championship standings are computed.",
      sections: [
        {
          title: "Championship standings",
          bullets: [
            "During the season the standings are the sum of all rounds.",
            "After the last round the super admin presses “Mark the season final” in the race number registry – then the worst round is dropped and a missed round counts as the worst (Rule XVIII.3).",
            "Ties: more navigation (Day 1) points, then Day 2 points, then better placings (Rule XVIII.2).",
          ],
        },
        {
          title: "Team standings",
          bullets: [
            "Each round a club adds up the points of its best rider in Pro, Expert and Standard.",
            "Clubs with more classes rank first, then by total; the place earns 30, 25, 22 … team points.",
            "A rider who changed club during the season scores for the club of their first round.",
          ],
        },
        {
          title: "Race number registry",
          text: ["The super admin registers season numbers by hand or by import. An entry using someone else's number is flagged."],
        },
      ],
    },
    {
      id: "public",
      icon: "📣",
      title: "What fans see",
      summary: "The public site and how it handles crowds.",
      sections: [
        {
          title: "Public pages",
          bullets: [
            "Home: the live or next event, photo cards and championships.",
            "Event: standings per stage and class, podium, start list, overall and PDF.",
            "Championship standings, rider profiles and a yearly archive – in Bulgarian and English.",
          ],
          text: ["Standings update by themselves. With a very large audience the page switches to refreshing every 15 seconds – results keep coming."],
        },
      ],
    },
  ],
  checklist: {
    title: "Race-day checklist",
    groups: [
      {
        title: "The day before",
        items: [
          "The start list is generated and checked.",
          "All timekeepers and GPS judges are in “Staff”.",
          "Everyone has signed in and installed the app with internet.",
          "The official track is uploaded in “GPS check”.",
          "The event is “Upcoming” and has a photo.",
        ],
      },
      {
        title: "In the morning",
        items: [
          "Status “Live”.",
          "Phones charged, power banks packed.",
          "The app clock shows a small offset (±ms).",
          "Sunlight mode on if needed.",
          "Everyone has the emergency number and the organizer's phone.",
        ],
      },
      {
        title: "After the finish",
        items: [
          "No “Waiting for connection” records left on phones.",
          "GPS checks done, penalties confirmed.",
          "Provisional results published with a protest window.",
          "Protests decided, official results published.",
          "Status “Finished”.",
        ],
      },
    ],
  },
  faq: {
    title: "Problems and solutions",
    items: [
      { q: "The phone says “No current events for you”.", a: "Ask the organizer to add you as a timekeeper in “Staff”. Also check the event is not “Finished”." },
      { q: "Records stay “Waiting for connection” for a long time.", a: "That is normal without coverage – they will be sent automatically. If a red expired-session banner is shown, tap it and sign in again." },
      { q: "A record is “Rejected”.", a: "Read the reason under the record. Most often this number already has a time at this point – void the wrong one and record again, or after a fix press “Resend rejected”." },
      { q: "I typed the wrong number.", a: "Void the record and record the right number. The voided one stays visible, struck through, for the jury." },
      { q: "I can't see a button mentioned in this manual.", a: "You don't have the role for that action in this event. Ask the organizer or the super admin." },
      { q: "The standings on the site don't update.", a: "Check the status next to the table. “Updates every 15 s” is fine – there is simply a large audience." },
      { q: "A mistake in official results.", a: "Fix the data (time, penalty, status) and publish a new version. The old one stays in the history." },
    ],
  },
  tipLabel: "Tip",
  warningLabel: "Important",
  back: "Back to top",
};
