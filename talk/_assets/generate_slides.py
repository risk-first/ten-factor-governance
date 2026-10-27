#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

CHROME = """      <footer class="chrome">
        <span>AI Governance With FDC3 and Fluxnova</span>
        <nav class="nav">
          <a class="prev" rel="prev" aria-label="Previous">←</a>
          <span class="num"></span>
          <a class="next" rel="next" aria-label="Next">→</a>
        </nav>
      </footer>"""


def page(title, body, cite=None, extra_class=""):
    cite_html = f'      <footer class="cite">{cite}</footer>\n' if cite else ""
    cls = f' class="slide {extra_class}"' if extra_class else ' class="slide"'
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <link rel="stylesheet" href="../css/talk.css">
</head>
<body>
  <main class="stage">
    <article{cls}>
{body}
{cite_html}{CHROME}
    </article>
  </main>
  <script src="../js/talk.js"></script>
</body>
</html>
"""


def notes(title, say, dont, cites=None, timing="2 min"):
    cite_block = "\n".join(f"- {c}" for c in (cites or ["None on this slide."]))
    say_block = "\n".join(f"- {s}" for s in say)
    dont_block = "\n".join(f"- {d}" for d in dont)
    return f"""# {title}

## Say

{say_block}

## Don't put on the slide

{dont_block}

## Citations

{cite_block}

## Timing

{timing}
"""


slides = []

slides.append((
    "00-title",
    page(
        "AI Governance With FDC3 and Fluxnova",
        """      <p class="kicker">FINOS</p>
      <h1>AI Governance With FDC3 and Fluxnova</h1>
      <p class="sub">Corporate governance applied to autonomous agents.</p>
      <p class="meta">
        <span data-empty="true">Speaker</span>
        <span data-empty="true">Event</span>
        <span data-empty="true">Date</span>
      </p>""",
        extra_class="title-slide",
    ),
    notes(
        "00 — Title",
        [
            "Open on the title. Name the talk: AI governance is not a new science. It is corporate governance applied to agents that can act.",
            "Say who you are, where this is, and that a live demo of Sail, FDC3 and Fluxnova comes later.",
        ],
        [
            "Goals list from the handwritten notes. Save that for the close if you want it.",
            "Do not preview the whole outline here.",
        ],
        timing="1 min",
    ),
))

slides.append((
    "01-humans-are-the-horses",
    page(
        "01 — Humans are the horses",
        """      <p class="kicker">01</p>
      <h1>Humans are the horses of the 21st century</h1>
      <div class="figure-full">
        <img src="hn-horses.png" alt="Hacker News thread: Are Humans the Horses of the 21st Century?">
      </div>""",
        cite="Hacker News (2011). Are Humans the Horses of the 21st Century? news.ycombinator.com/item?id=2708539",
        extra_class="image-led",
    ),
    notes(
        "01 — Humans are the horses",
        [
            "The fear is old. In 2011 people were already asking whether humans become the horses of the 21st century: displaced by cheaper, stronger machines.",
            "Hold the image. Do not argue yet. The talk returns to this question at the end.",
        ],
        [
            "Industrial-revolution economy circles from the handwritten preamble.",
            "The punchline 'No' belongs on slide 24.",
        ],
        [
            "Hacker News (2011). Are Humans the Horses of the 21st Century? https://news.ycombinator.com/item?id=2708539",
        ],
        "1–2 min",
    ),
))

slides.append((
    "02-no-more-jobs",
    page(
        "02 — No more jobs",
        """      <p class="kicker">02</p>
      <h1>No more jobs</h1>
      <div class="figure-full">
        <img src="independent.png" alt="The Independent: More than 1m young people are out of work, and AI is about to wipe out millions more jobs">
      </div>""",
        cite="Haygarth, D. (2026). More than 1m young people are out of work… The Independent.",
        extra_class="image-led",
    ),
    notes(
        "02 — No more jobs",
        [
            "This is the popular version of the same fear: AI wipes out work, starting with the young.",
            "Read the headline, not the article. The talk is not a labour-economics paper. It is about who is allowed to act.",
        ],
        [
            "IPPR job-loss numbers unless you want one figure. If you do: “nearly eight million UK jobs exposed, without intervention.”",
        ],
        [
            "Haygarth, D. (2026). More than 1m young people are out of work, and AI is about to wipe out millions more jobs. What should we do? The Independent. https://www.independent.co.uk/news/uk/home-news/ai-jobs-work-unemployment-b3048696.html",
        ],
        "1 min",
    ),
))

slides.append((
    "03-software-engineering-dead",
    page(
        "03 — Is software engineering dead?",
        """      <p class="kicker">03</p>
      <h1>Is software engineering dead?</h1>
      <div class="figure-full">
        <img src="hn-search.png" alt="Hacker News search results for software engineering dead">
      </div>""",
        cite="Hacker News (2025–2026). Search: “software engineering dead”. hn.algolia.com",
        extra_class="image-led",
    ),
    notes(
        "03 — Is software engineering dead?",
        [
            "The same anxiety now hits our own trade. Search HN and the obituaries write themselves.",
            "You do not need to settle it. The point is the mood: if code is cheap, what is left for humans, and what happens to power?",
        ],
        [
            "A defence of software engineering as a craft. Save that energy for later slides.",
        ],
        [
            "Hacker News search, “software engineering dead”, captured from the talk outline.",
        ],
        "1 min",
    ),
))

slides.append((
    "04-if-we-build-it",
    page(
        "04 — If we build it, everyone dies",
        """      <p class="kicker">04</p>
      <div class="split">
        <div>
          <h1>If we build it, everyone dies</h1>
          <p class="quote">Intelligence is not the same thing as power.</p>
        </div>
        <div class="visual">
          <img src="book-covers.jpg" alt="US and UK editions of If Anyone Builds It, Everyone Dies">
        </div>
      </div>""",
        cite="Yudkowsky, E. &amp; Soares, N. (2025). If Anyone Builds It, Everyone Dies. Little, Brown.",
    ),
    notes(
        "04 — If we build it, everyone dies",
        [
            "Name the argument: a superintelligence that can think better than us will take the resources it needs, and we lose.",
            "You are not here to litigate alignment theory. The rebuttal for this talk is simpler: in the real world, the smartest person in the room is rarely in charge.",
            "Kings, Einstein, bank quants — come back to them on slide 22.",
        ],
        [
            "A chapter summary of the book.",
            "A claim that AI risk is fake. You are going to argue that governance and resource control matter more than raw intelligence.",
        ],
        [
            "Yudkowsky, E. & Soares, N. (2025). If Anyone Builds It, Everyone Dies: Why Superhuman AI Would Kill Us All. Little, Brown and Company. https://ifanyonebuildsit.com/",
        ],
        "2 min",
    ),
))

slides.append((
    "05-a-simple-formula",
    page(
        "05 — A simple formula",
        """      <p class="kicker">05</p>
      <h1>A simple formula</h1>
      <p class="formula"><em>Effective agency</em> ∝ intelligence × resources × access</p>
      <p class="lede">Intelligence tells you what to do. Resources and access determine what you can actually do.</p>""",
        cite="Emerson, R. M. (1962). Power-Dependence Relations.\nPfeffer, J. &amp; Salancik, G. R. (1978). The External Control of Organizations.",
    ),
    notes(
        "05 — A simple formula",
        [
            "Introduce Emerson and Pfeffer & Salancik together. Power is dependence. Organisations are coalitions competing for resources.",
            "Then the model: intelligence is only one term. Without resources and access, a brilliant agent is a suggestion engine.",
            "This is why AI governance is not mainly about making the model wiser. It is about what it is allowed to touch.",
        ],
        [
            "A lecture on resource-dependence theory. One sentence each is enough.",
        ],
        [
            "Emerson, R. M. (1962). Power-Dependence Relations. American Sociological Review, 27(1), 31–41.",
            "Pfeffer, J. & Salancik, G. R. (1978). The External Control of Organizations: A Resource Dependence Perspective. Harper & Row.",
        ],
        "2–3 min",
    ),
))

slides.append((
    "06-corporate-vs-ai-governance",
    page(
        "06 — Corporate vs AI governance",
        """      <p class="kicker">06</p>
      <h1>Corporate governance vs AI governance</h1>
      <p class="quote">AI governance is a new face of the principal–agent problem.</p>
      <p class="lede">Intelligence is not authority. Organisations already govern agents who may know more than their principals.</p>""",
        cite="Jensen, M. C. &amp; Meckling, W. H. (1976). Theory of the Firm.",
    ),
    notes(
        "06 — Corporate vs AI governance",
        [
            "Our industry already knows how to govern agents: directors, traders, credit officers, model risk.",
            "The principal–agent problem is the old name. The agent has information and capability the principal does not. Governance constrains power, not intelligence, through delegated authority, separation of duties, approvals and accountability.",
            "An AI agent that can write the order is still just an agent. It does not become the firm.",
        ],
        [
            "A full definition of agency costs. One sentence is enough.",
        ],
        [
            "Jensen, M. C. & Meckling, W. H. (1976). Theory of the Firm: Managerial Behavior, Agency Costs and Ownership Structure. Journal of Financial Economics, 3(4), 305–360.",
        ],
        "2 min",
    ),
))

slides.append((
    "07-three-questions",
    page(
        "07 — Three questions",
        """      <p class="kicker">07</p>
      <h1>Three questions</h1>
      <ol class="questions">
        <li data-n="01">Is corporate governance applicable to AI governance?</li>
        <li data-n="02">What needs to change?</li>
        <li data-n="03">Does governance even work anyway?</li>
      </ol>""",
    ),
    notes(
        "07 — Three questions",
        [
            "These three questions structure the rest of the talk.",
            "You will answer 3 first: governance can work, as a brake, when the conditions are right.",
            "Then 1 and 2: yes, corporate governance applies; what must change is speed, machine-readability, and independence from the thing being governed.",
        ],
        [
            "Answers. Let the next slides do that.",
        ],
        timing="1 min",
    ),
))

slides.append((
    "08-governance-as-brake",
    page(
        "08 — Governance as brake",
        """      <p class="kicker">08 · Question 3</p>
      <h1>Governance is a brake</h1>
      <div class="cards">
        <div class="card"><h3>Independent information</h3><p>The monitor sees more than the actor’s own report.</p></div>
        <div class="card"><h3>Independence</h3><p>The monitor is not paid, promoted or captured by the actor.</p></div>
        <div class="card"><h3>Escalation</h3><p>There is a credible path that bypasses the person being watched.</p></div>
        <div class="card"><h3>Capacity</h3><p>Someone can actually investigate a technical system.</p></div>
        <div class="card"><h3>Enforceable authority</h3><p>Someone can impose costs, or stop the activity.</p></div>
      </div>""",
        cite="Moffat, R. Aspects of Good Governance. Ten Factor Governance supporting research.",
    ),
    notes(
        "08 — Governance as brake",
        [
            "Answer question 3 first. Governance does not have to be corrupt to fail. It also can constrain powerful or badly motivated actors.",
            "Walk the five conditions. These are the difference between a real brake and a compliance theatre.",
            "The principal–agent problem never goes away. Regulatory capture is what happens when these conditions fail.",
        ],
        [
            "Enron, Wells Fargo, Wirecard case studies unless someone asks. They are in the supporting research.",
        ],
        [
            "Moffat, R. Aspects of Good Governance. Ten Factor Governance. https://tenfactorgovernance.org/docs/supporting-research/aspects-of-good-governance",
        ],
        "3 min",
    ),
))

slides.append((
    "09-good-governance-in-finance",
    page(
        "09 — Good governance in finance",
        """      <p class="kicker">09</p>
      <h1>What good governance looks like</h1>
      <div class="cards three">
        <div class="card"><h3>Clear accountability</h3><p>A named owner for every sensitive activity.</p></div>
        <div class="card"><h3>Delegated authority</h3><p>Power is granted, limited, and can be withdrawn.</p></div>
        <div class="card"><h3>Segregation of duties</h3><p>No one proposes, approves and executes.</p></div>
        <div class="card"><h3>Independent oversight</h3><p>Second line does not mark its own homework.</p></div>
        <div class="card"><h3>Risk-based controls</h3><p>Effort follows material risk, not paperwork volume.</p></div>
        <div class="card"><h3>Transparency and audit</h3><p>Decisions leave a trail that someone else can read.</p></div>
        <div class="card"><h3>Continuous enforcement</h3><p>The brake works at runtime, not only at year-end.</p></div>
      </div>""",
    ),
    notes(
        "09 — Good governance in finance",
        [
            "This is the industry we already have. Seven properties, none of them AI-specific.",
            "Pick two to voice: segregation of duties, and independent oversight. Those two become the demo.",
        ],
        [
            "A walk through every card. Let people read.",
        ],
        timing="2 min",
    ),
))

slides.append((
    "10-governance-as-code",
    page(
        "10 — Moving towards governance as code",
        """      <p class="kicker">10</p>
      <h1>What breaks at AI speed</h1>
      <div class="cards three">
        <div class="card"><h3>Siloed governance</h3><p>Policies locked in spreadsheets and disconnected systems.</p></div>
        <div class="card"><h3>Manual bottlenecks</h3><p>Slow, expensive reviews, approvals and audits.</p></div>
        <div class="card"><h3>Inconsistent enforcement</h3><p>Different teams interpret the same policy differently.</p></div>
        <div class="card"><h3>Governance drift</h3><p>The written control and the running system diverge.</p></div>
        <div class="card"><h3>Point-in-time compliance</h3><p>Periodic assessments miss what changed this week.</p></div>
        <div class="card"><h3>Poor traceability</h3><p>Hard to join risk, control, decision and evidence.</p></div>
      </div>""",
    ),
    notes(
        "10 — Moving towards governance as code",
        [
            "This is what needs to change — question 2. The principles on the last slide are fine. The operating model is not.",
            "AI agents act continuously. A quarterly control assessment is not a brake.",
            "Governance as code is how those seven properties become fast enough.",
        ],
        [
            "A vendor tour of GRC tools.",
        ],
        timing="2 min",
    ),
))

slides.append((
    "11-ten-factor",
    page(
        "11 — Ten Factor Governance",
        """      <p class="kicker">11</p>
      <div class="split">
        <div>
          <h1>Ten Factor Governance</h1>
          <ol class="factor-list">
            <li><b>01</b> Govern Sensitive Activities</li>
            <li><b>02</b> Build a Governance Twin</li>
            <li><b>03</b> Governance is Version Controlled</li>
            <li><b>04</b> Govern Factory and Product Separately</li>
            <li><b>05</b> Context In, Decisions Out</li>
            <li><b>06</b> Evidence by Default</li>
            <li><b>07</b> Continuous Governance</li>
            <li><b>08</b> Govern Dependencies</li>
            <li><b>09</b> Governance Is Composable</li>
            <li><b>10</b> Governance Has Owners</li>
          </ol>
        </div>
        <div class="visual">
          <img src="site.png" alt="Ten Factor Governance homepage">
        </div>
      </div>""",
        cite="Ten Factor Governance. tenfactorgovernance.org",
    ),
    notes(
        "11 — Ten Factor Governance",
        [
            "This is the architectural vocabulary. Analogous to the Twelve-Factor App, for operable governance.",
            "Do not read all ten. Voice 1, 5, 6 and 7: sensitive activities, context in / decisions out, evidence by default, continuous governance.",
            "The whole example codebase lives in this repository.",
        ],
        [
            "A factor-by-factor lecture. Point people at the site.",
        ],
        [
            "Ten Factor Governance. https://tenfactorgovernance.org",
        ],
        "3 min",
    ),
))

slides.append((
    "12-ccc-and-gemara",
    page(
        "12 — CCC and Gemara",
        """      <p class="kicker">12</p>
      <h1>CCC and Gemara</h1>
      <div class="cards two">
        <div class="card">
          <h3>CCC · FINOS</h3>
          <p>Reusable, technology-agnostic threats, controls and assessment requirements. Written once, mapped across clouds.</p>
        </div>
        <div class="card">
          <h3>Gemara · OpenSSF</h3>
          <p>Schemas for expressing governance, risks, controls, policies and evidence as structured, machine-readable data.</p>
        </div>
      </div>
      <p class="lede" style="margin-top:1.4rem">Gemara links requirements to threats, controls, policies and assessments. That is what makes governance version-controlled, testable and reusable.</p>""",
        cite="FINOS Common Cloud Controls. ccc.finos.org\nOpenSSF Gemara. gemara.openssf.org",
    ),
    notes(
        "12 — CCC and Gemara",
        [
            "CCC is the control catalogue. Gemara is the data model.",
            "Together they turn the last slide from a manifesto into files you can diff, review and compose.",
            "The AI Portfolio Assistant example is already expressed this way.",
        ],
        [
            "A schema walkthrough. Stay at the connecting-the-dots level.",
        ],
        [
            "FINOS Common Cloud Controls. https://ccc.finos.org",
            "OpenSSF Gemara. https://gemara.openssf.org",
        ],
        "2 min",
    ),
))

slides.append((
    "13-governance-as-a-service",
    page(
        "13 — Governance as a service",
        """      <p class="kicker">13</p>
      <h1>Can we separate the application from its governance?</h1>
      <div class="cards two">
        <div class="card">
          <h3>Why split them</h3>
          <p>Intelligence proposes. Authority is elsewhere. The agent does not mark its own homework.</p>
        </div>
        <div class="card">
          <h3>What 10-Factor gives you</h3>
          <ul>
            <li>Govern what agents can <em>do</em>, not only what they say</li>
            <li>Propose without automatic permission to execute</li>
            <li>Context in, decisions out</li>
            <li>Enforce at runtime, with evidence</li>
          </ul>
        </div>
      </div>""",
    ),
    notes(
        "13 — Governance as a service",
        [
            "This is the design move. Put governance in a separate process, a separate team, eventually a separate firm.",
            "Banks already do this with first line / second line. In extremis, the failure mode is regulatory capture.",
            "For AI: the model can be clever. The policy engine does not have to be as clever. It has to be independent, informed, and able to say no.",
        ],
        [
            "The full six-bullet mapping unless you have time. The card is enough.",
        ],
        timing="2–3 min",
    ),
))

slides.append((
    "14-demo-stack-1",
    page(
        "14 — Demo stack",
        """      <p class="kicker">14</p>
      <h1>The sandbox</h1>
      <div class="cards three">
        <div class="card">
          <h3>FDC3</h3>
          <p>The open standard that lets desktop apps talk to each other — intents, context, channels.</p>
        </div>
        <div class="card">
          <h3>FDC3 Sail</h3>
          <p>A desktop-agent sandbox. Apps, and agents, run here.</p>
        </div>
        <div class="card">
          <h3>Fluxnova</h3>
          <p>Workflows that bring a third party into the loop. Human approval is a process, not a checkbox.</p>
        </div>
      </div>""",
    ),
    notes(
        "14 — Demo stack",
        [
            "Three building blocks only. FDC3 is the language. Sail is the room. Fluxnova is how a human outside the agent becomes part of the decision.",
            "The approval extension (fdc3.approval) is how Sail talks to Fluxnova without the app knowing it is BPMN.",
        ],
        [
            "A protocol history of FDC3.",
        ],
        timing="2 min",
    ),
))

slides.append((
    "15-demo-stack-2",
    page(
        "15 — Demo apps",
        """      <p class="kicker">15</p>
      <h1>The desk</h1>
      <div class="apps">
        <div class="app"><strong>Portfolio</strong><span>Holdings and positions</span></div>
        <div class="app"><strong>Risk</strong><span>Stress and metrics</span></div>
        <div class="app"><strong>Market Data</strong><span>Prices and charts</span></div>
        <div class="app"><strong>Agent</strong><span>Proposes actions</span></div>
        <div class="app"><strong>Order Entry</strong><span>Constructs the order</span></div>
        <div class="app"><strong>Execution</strong><span>Submits, if allowed</span></div>
      </div>""",
    ),
    notes(
        "15 — Demo apps",
        [
            "These are the AIPA specialist apps. An agent can see the book, ask for risk, draft an order.",
            "Notice the split: Order Entry constructs. Execution submits. The agent is not supposed to be both.",
        ],
        [
            "Port numbers, API keys, App Directory URLs.",
        ],
        timing="1–2 min",
    ),
))

slides.append((
    "16-sail-governance-plugin",
    page(
        "16 — Sail governance plugin",
        """      <p class="kicker">16</p>
      <h1>The Sail governance plugin</h1>
      <p class="quote">It inspects what the agent does.</p>
      <p class="lede">Then it decides what is allowed.</p>""",
    ),
    notes(
        "16 — Sail governance plugin",
        [
            "This is governance as a service in the sandbox. The plugin sits on the desktop agent, not inside the model.",
            "It sees intents and context as they cross the bus. That is independent information.",
        ],
        [
            "Implementation details of sail-extension unless asked.",
        ],
        timing="1 min",
    ),
))

slides.append((
    "17-how-it-decides",
    page(
        "17 — How it decides",
        """      <p class="kicker">17</p>
      <h1>How it decides</h1>
      <div class="chain">
        <div class="node">Controls</div>
        <div class="arrow">→</div>
        <div class="node">Risks</div>
        <div class="arrow">→</div>
        <div class="node">Threats</div>
        <div class="arrow">→</div>
        <div class="node">Policy</div>
      </div>
      <p class="lede" style="margin-top:1.8rem">Example: the assistant must not execute its own orders.</p>""",
        cite="AIPA control apa-ctl-006-execute-prohibit. Autonomous Execution Prohibition.\nfdc3.approval — human approval workflows via Fluxnova.",
    ),
    notes(
        "17 — How it decides",
        [
            "Trace one control. apa-ctl-006: the AI Portfolio Assistant identity must not initiate demo.SubmitOrders.",
            "apa-ctl-005 sits in front of that: an order proposal needs a recorded human approval. That is Fluxnova, via fdc3.approval.",
            "The plugin is not guessing. It is evaluating an action against a versioned policy that points at threats and risks.",
        ],
        [
            "The whole control YAML. One control is the story.",
        ],
        [
            "AI Portfolio Assistant Control Catalog, apa-ctl-006-execute-prohibit and apa-ctl-005-propose-human-approval.",
            "fdc3.approval extension. examples/aipa/fdc3-extensions/fdc3.approval/",
        ],
        "3 min",
    ),
))

slides.append((
    "18-demo",
    page(
        "18 — Demo",
        """      <p class="kicker">18</p>
      <h1>Demo</h1>
      <div class="placeholder">Live · or recording</div>""",
    ),
    notes(
        "18 — Demo",
        [
            "Show the agent trying to do something it should not — typically submitting or advancing its own order.",
            "Show governance interrupting. Show the approval landing in Fluxnova. A human decides. The agent does not.",
            "If the recording is not ready, narrate the path: propose → block → GetApproval → human task → execute only with a valid approval reference.",
        ],
        [
            "A tour of every AIPA app. Stay on the interruption.",
        ],
        timing="5–8 min",
    ),
))

slides.append((
    "19-workshop-recap",
    page(
        "19 — Workshop recap",
        """      <p class="kicker">19</p>
      <h1>From the workshop</h1>
      <div class="cards two">
        <div class="card">
          <h3>Poisoning</h3>
          <p>If the agent can be steered, you do not ask it to police itself.</p>
        </div>
        <div class="card">
          <h3>JEV for policy</h3>
          <p>A cheaper model can check a dearer one. Governance does not need to be as clever as the thing it governs.</p>
        </div>
      </div>""",
    ),
    notes(
        "19 — Workshop recap",
        [
            "Callback to the workshop. Poisoning is why independence matters: a compromised agent marking its own homework is capture.",
            "JEV — a small, cheap checker — is the departmental analogue. Second line is not smarter than first line. It is differently incentivised, and cheaper is fine.",
        ],
        [
            "A recap of every workshop exercise.",
        ],
        timing="2 min",
    ),
))

slides.append((
    "20-conclusions",
    page(
        "20 — Conclusions",
        """      <p class="kicker">20</p>
      <h1>Conclusions</h1>
      <p class="lede">What this means for how we govern AI.</p>""",
        extra_class="title-slide",
    ),
    notes(
        "20 — Conclusions",
        [
            "Section card. Pause. The remaining slides are the close, not new machinery.",
        ],
        [
            "Any new argument.",
        ],
        timing="15 sec",
    ),
))

slides.append((
    "21-governance-needs-to-grow-up",
    page(
        "21 — Governance needs to grow up",
        """      <p class="kicker">21</p>
      <h1>Governance needs to grow up</h1>
      <p class="lede">Releases. Code. Version control. Review. Promotion through environments.</p>
      <p class="lede">So it can move at AI speeds.</p>""",
        cite="Ten Factor Governance. The example codebase is this repository.",
    ),
    notes(
        "21 — Governance needs to grow up",
        [
            "Governance has to adopt software-engineering procedure. Not because it is fashionable. Because agents will not wait for the next committee cycle.",
            "Ten Factor is the how. This repo is a worked example, not a slideware framework.",
        ],
        [
            "A tools list. The point is the practice, not the stack.",
        ],
        [
            "Ten Factor Governance. https://tenfactorgovernance.org",
        ],
        "1–2 min",
    ),
))

slides.append((
    "22-best-tool-for-ai-risk",
    page(
        "22 — Best tool for AI risk",
        """      <p class="kicker">22</p>
      <h1>Governance is the tool we already have</h1>
      <p class="quote">Being more intelligent does not put you in charge.</p>
      <p class="lede">Kings. Einstein. Quant traders. Authority is allocated. It is not a property of IQ.</p>""",
        cite="FINOS AI Governance Framework. air-governance-framework.finos.org\nMoffat, R. Risk-First Software Development. riskfirst.org",
    ),
    notes(
        "22 — Best tool for AI risk",
        [
            "Close the Yudkowsky loop. Unlimited intelligence plus unlimited power is a choice, not a law of nature.",
            "Kings were rarely the smartest people in the room. Einstein did not run Austria. Quants are paid well and still not the bank.",
            "AIGF is the catalogue of AI-specific risks. Risk-First is the habit. The Lindy effect: practices that have lasted are the ones to bet on. Corporate governance has lasted.",
        ],
        [
            "A history of monarchy. Three names are enough.",
        ],
        [
            "FINOS AI Governance Framework v2 (2025). https://air-governance-framework.finos.org/",
            "Moffat, R. Risk-First Software Development. https://riskfirst.org",
            "Taleb, N. N. (2012). Antifragile — on the Lindy effect. (Optional if you name Lindy out loud.)",
        ],
        "2–3 min",
    ),
))

slides.append((
    "23-governance-used-to-be-harder",
    page(
        "23 — Governance used to be harder",
        """      <p class="kicker">23</p>
      <h1>Governance used to be a lot harder</h1>
      <p class="lede">ISO 42001. Policy packs. Evidence folders. Recreated by hand, every year.</p>
      <p class="lede">Machine-readable artefacts, plus the same AI tools, make the operating model cheaper than the alternative.</p>""",
        cite="ISO/IEC 42001:2023. Artificial intelligence management system.",
    ),
    notes(
        "23 — Governance used to be harder",
        [
            "Do not pretend ISO 42001 went away. The documentation load was the reason people treated governance as a tax.",
            "The twist: the same generation of AI tools that scare us also make it cheap to keep twins, mappings and evidence current.",
            "The AIPA ISO and Gemara catalogues in this repo are the exhibit.",
        ],
        [
            "A clause-by-clause ISO walkthrough.",
        ],
        [
            "ISO/IEC 42001:2023. Information technology — Artificial intelligence — Management system.",
        ],
        "1–2 min",
    ),
))

slides.append((
    "24-are-humans-the-new-horses",
    page(
        "24 — Are humans the new horses?",
        """      <p class="kicker">24</p>
      <div class="split">
        <div>
          <h1>Are humans the new horses?</h1>
          <p class="answer">No.</p>
          <p class="lede">Comparative advantage. Things only humans can do. Land, judgment, accountability.</p>
        </div>
        <div class="visual">
          <img src="venn.svg" alt="Venn diagram of human, machine and overlapping work">
        </div>
      </div>""",
    ),
    notes(
        "24 — Are humans the new horses?",
        [
            "Return to slide 1. The answer is no.",
            "Horses had no comparative advantage left once machines did the work cheaper. Humans still have land, judgment, and the right to say no.",
            "The Venn is the argument: some work is machine-only, some is shared, some remains human because it is authority, not intelligence.",
        ],
        [
            "A labour-economics lecture. The Venn is the whole slide.",
        ],
        timing="2 min",
    ),
))

slides.append((
    "25-how-to-get-involved",
    page(
        "25 — How to get involved",
        """      <p class="kicker">25</p>
      <h1>How to get involved</h1>
      <div class="links">
        <a href="https://fdc3-sail.finos.org/">Sail <span>fdc3-sail.finos.org</span></a>
        <a href="https://ai.finos.org/">FINOS AI <span>ai.finos.org</span></a>
        <a href="https://ccc.finos.org/">Common Cloud Controls <span>ccc.finos.org</span></a>
        <a href="https://tenfactorgovernance.org/">Ten Factor <span>tenfactorgovernance.org</span></a>
        <a href="https://gemara.openssf.org/">Gemara <span>gemara.openssf.org</span></a>
        <a href="https://calendar.finos.org/">Working groups <span>calendar.finos.org</span></a>
      </div>""",
    ),
    notes(
        "25 — How to get involved",
        [
            "Leave the URLs up. Invite people to Sail meetings and the FINOS AI project first — those are the places this demo lives.",
            "CCC, Ten Factor and Gemara are how they contribute controls rather than just watch a demo.",
        ],
        [
            "A membership pitch for FINOS unless that is why you are in the room.",
        ],
        timing="1 min",
    ),
))

slides.append((
    "26-belling-the-cat",
    page(
        "26 — Belling the cat",
        """      <p class="kicker">26</p>
      <div class="split">
        <div>
          <h1>How do we make sure AI is governed?</h1>
          <p class="lede">Someone has to put the bell on the cat.</p>
        </div>
        <div class="visual">
          <img src="dore-rats.jpg" alt="Gustave Doré, Conseil tenu par les rats — the mice debate who will bell the cat">
        </div>
      </div>""",
        cite="Doré, G. (c. 1868). Conseil tenu par les rats. Illustration to La Fontaine. Wikimedia Commons.",
    ),
    notes(
        "26 — Belling the cat",
        [
            "End on the fable. The mice all agree the cat should be belled. Nobody wants to be the mouse that does it.",
            "Governance as a service is an answer to that: make belling the cat a job, with independence, information, and the authority to stop the activity.",
            "Thank people. Point back to the URLs if the room is moving.",
        ],
        [
            "A history of the fable. One sentence if anyone asks: medieval, usually attributed to Aesop, popularised by La Fontaine.",
        ],
        [
            "Doré, G. (c. 1868). Conseil tenu par les rats. Illustration to Jean de La Fontaine, Fables. Public domain, Wikimedia Commons.",
        ],
        "1 min",
    ),
))


def main():
    for folder, html, md in slides:
        dest = ROOT / folder
        dest.mkdir(parents=True, exist_ok=True)
        (dest / "index.html").write_text(html)
        (dest / "notes.md").write_text(md)
        print(folder)


if __name__ == "__main__":
    main()
