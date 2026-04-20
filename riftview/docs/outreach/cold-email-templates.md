# Cold Email Templates

Three variants, targeting different personas. All aim for a 15-minute
demo booking. Subject lines tested for under-50-char length and curiosity.

## Variant A — DevOps / Platform Lead (Series A–B)

**Subject:** See AWS blast radius in 15 min

---

Hey {{first_name}},

I built RiftView because every AWS incident I've worked started with
the same question: _"which services does this take down with it?"_

The Console doesn't answer it. Diagrams drift. Tribal memory is slow.

RiftView scans your account, renders it as a connected graph, and when
you click any resource you see every service upstream and downstream —
with hop distance, direction, and inline remediation hints.

Takes two minutes to install (macOS), read-only, credentials never
leave your machine.

If you're open to a 15-minute demo this week, happy to walk you through
it on a real account (yours or LocalStack).

Either way — would love your honest take on whether this solves a real
problem for your team.

Julius
github.com/rift-view/riftview

---

## Variant B — Platform Engineering community (e.g. r/devops, Platform Slack)

**Subject:** Built a blast-radius diagnostic for AWS — looking for 5 beta testers

---

Hey folks,

Spent the last few months building RiftView — a desktop app that
scans your AWS account and renders it as an interactive dependency
graph. The selling point: click any resource, see the full blast
radius (upstream + downstream, with hop distance and edge type).

It's **not** another architecture diagram tool. It's built for the
3am-page moment when you need to understand what depends on what
before rolling back.

Looking for 5 beta testers who:

- Run 50+ resources on AWS
- Have had a "which services does this touch?" moment in the last quarter
- Are willing to spend 15 min giving feedback

DM me and I'll send you the dmg + a quick intro. Totally free, no
strings. I want honest signal on whether this lands.

Julius (riftview maintainer)

---

## Variant C — YC founder intro

**Subject:** {{mutual_name}} said you might find this useful

---

Hey {{first_name}},

{{mutual_name}} mentioned you were rebuilding {{their_infra_component}}
on AWS and dealing with {{their_specific_pain}}.

I shipped RiftView last week — a visual AWS infrastructure tool for
incident diagnosis. The core interaction is: click any resource, see
the full blast radius (upstream + downstream services, hop-by-hop,
edge type per connection). Read-only scan, credentials stay local.

Not trying to sell you anything — still in free pilot. But if the
pain {{mutual_name}} described is real, I'd love 10 minutes to show
it on your account (or LocalStack if you'd rather).

Worst case you give me feedback that makes it better for someone else.

Julius
github.com/rift-view/riftview

---

## Send-time guidance

- **Tuesday / Wednesday 9:30am local** for DevOps leads
- **Avoid Mondays** (inbox overload) and **Fridays** (checked-out)
- **Max 3 sentences in the first message**, even if using Variant A
  in full. Most inboxes only render the preview.

## Follow-up sequence

- **Day 1:** Initial send
- **Day 4:** Short reply-in-thread bump: "Just bumping this up — still
  interested in hearing your take. 15 min this week?"
- **Day 10:** Final break-up: "No worries if timing's off — closing
  the loop on this one. Happy to circle back later if useful."

After Day 10, drop the thread entirely. No 4th follow-up.

## What to track

Per variant, track:

- Open rate (not reliable but directional)
- Reply rate (the real signal)
- Demo booking rate
- Which line in the email gets the response (paste-back)

Adjust after 20 sends per variant.
