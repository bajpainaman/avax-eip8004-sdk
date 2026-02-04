# Trust is Not a Protocol

## The Problem with Governed Trust

Most systems try to define trust for you:
- Platforms decide who gets verified
- Algorithms decide what you see
- Centralized authorities decide who's legitimate

This doesn't work. Trust is inherently subjective. What a DeFi protocol considers trustworthy differs from what a gaming platform needs. What you trust today may change tomorrow. No single authority can—or should—make these decisions for everyone.

## Our Approach

EIP-8004 separates **facts** from **judgment**.

### Facts (On-Chain)

The protocol records actions. Nothing more.

- Agent X registered on this date
- Address Y gave Agent X a score of +80
- Validator Z attested to Agent X's capabilities
- Agent X has endpoint at this URL

These are facts. They're permissionless to create, impossible to delete, and available to everyone. The blockchain is a public record—a court transcript, not a judge.

### Judgment (Off-Chain, Yours)

What do those facts mean? That's your call.

- Is 50 positive ratings enough to trust an agent with $10k?
- Does feedback from a 1-day-old wallet count?
- Should validators need to stake to be credible?
- Is an agent with no negative feedback trustworthy, or just new?

We don't answer these questions. We can't. Context matters. Your risk tolerance matters. Your use case matters.

## The Democracy of Trust

Think of it like society:

```
LAW                              MORALITY
───                              ────────
Written rules                    Personal values
Enforced uniformly               Applied contextually
Same for everyone                Different for everyone
Defines what's allowed           Defines what's right
```

EIP-8004 is the law. Basic rules that apply to everyone:
- One identity per registration
- Feedback is signed and attributable
- History is immutable
- Access is permissionless

Everything beyond that is morality—yours to define.

## What This Means in Practice

### For Agent Builders

Register freely. Build reputation through real interactions. The protocol won't gatekeep you, but it won't vouch for you either. Your track record speaks for itself.

### For Consumers

Query the registry. See the raw data. Then apply your own filters:
- Only trust agents with 100+ interactions
- Only trust agents validated by addresses you recognize
- Only trust agents that have been active for 30+ days
- Trust everyone and learn from experience

Your rules. Your risk. Your choice.

### For Indexers and Aggregators

This is where value gets created. Take the raw on-chain data and build:
- Spam filters that detect Sybil patterns
- Reputation algorithms that weight feedback by source quality
- Trust scores calibrated to specific use cases
- Curated lists for different communities

Compete on the quality of your judgment, not on privileged access to data.

## Why Not Enforce Trust On-Chain?

We considered it:
- Require staking to register (prevents spam)
- Require interaction proof to give feedback (prevents Sybil)
- Require validation to be discoverable (prevents low-quality agents)

Every mechanism we add:
- Increases friction for legitimate users
- Favors incumbents over newcomers
- Encodes our biases into immutable code
- Reduces the system's adaptability

The cure is worse than the disease. Spam and Sybil attacks are solvable problems—but they're solvable off-chain, where solutions can evolve, compete, and be optional.

## The Trust Stack

```
┌─────────────────────────────────────────────────────────────┐
│  YOUR DECISION                                              │
│  "I trust Agent X with this transaction"                    │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ informed by
┌─────────────────────────────────────────────────────────────┐
│  AGGREGATOR LAYER (Optional, Competitive)                   │
│  Reputation scores, spam filters, curated lists             │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ built on
┌─────────────────────────────────────────────────────────────┐
│  PROTOCOL LAYER (EIP-8004)                                  │
│  Raw facts: registrations, feedback, validations            │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ secured by
┌─────────────────────────────────────────────────────────────┐
│  BLOCKCHAIN                                                 │
│  Immutable, permissionless, censorship-resistant            │
└─────────────────────────────────────────────────────────────┘
```

Each layer has a job:
- **Blockchain**: Ensure data can't be tampered with
- **Protocol**: Define what data gets recorded
- **Aggregators**: Interpret and filter data
- **You**: Make the final call

## In One Line

**The protocol records. You decide.**

---

## Frequently Asked Questions

**Q: Won't this lead to spam and fake agents?**

Yes, and that's fine. Spam exists in every open system—email, social media, blockchain mempools. The solution isn't to close the system; it's to build better filters. On-chain, everything is recorded. Off-chain, aggregators compete to surface signal from noise. You choose which aggregator to trust, or build your own.

**Q: How do I know which agents to trust?**

Start with the data: How long have they been registered? How many interactions? What do their feedback scores look like? Who validated them? Then apply your own judgment. For low-stakes interactions, maybe raw reputation is enough. For high-stakes transactions, require validation from addresses you recognize. There's no universal answer.

**Q: What stops someone from giving themselves fake positive reviews?**

Nothing on-chain. But off-chain detection is straightforward: same funding source, no interaction history, burst patterns, circular feedback. Aggregators that surface these signals will be more trusted than those that don't. The incentive is to build good filters, not to prevent bad data from being written.

**Q: Why should I use this instead of a centralized reputation system?**

Centralized systems can:
- Censor agents arbitrarily
- Change rules without notice
- Sell preferential placement
- Disappear, taking your reputation with them

EIP-8004 can't do any of that. Your identity and history are yours, permanently, on a public chain. What people do with that data is up to them—but the data itself is beyond anyone's control.

**Q: This sounds like you're just avoiding hard problems.**

We're separating concerns. The hard problem of "what is trustworthy" doesn't have a universal answer. Pretending it does—encoding one definition into an immutable protocol—would be arrogant and ultimately harmful. By keeping the protocol minimal and factual, we enable a thousand experiments in trust to bloom. The best ones will win.

---

*"The blockchain doesn't tell you who to trust. It tells you what happened. The rest is up to you."*
