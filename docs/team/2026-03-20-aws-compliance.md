# AWS Compliance Review
**Date:** 2026-03-20
**Status:** No current violations. Preventive actions required before 1.0.

---

## Confirmed Compliant — No Changes Needed
- **AWS SDK v3 + CLI usage:** explicitly permitted developer tooling
- **Credential handling:** stays in main process, never transmitted externally
- **Service name labels** (EC2, S3, Lambda, etc.): permitted in descriptive/functional context
- **LocalStack integration:** third-party tool, no affiliation claimed

---

## Required Before 1.0

### Pricing Data
- **MUST use the AWS Price List API** — not web scraping of aws.amazon.com/pricing
- API: `https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/index.json`
- Acceptable: use API at build time to generate static `pricing.json`, or at runtime
- Not acceptable: scraping the AWS website

### Trademark Disclaimer
Add to: About screen + README.md

> "Cloudblocks is not affiliated with, endorsed by, or sponsored by Amazon Web Services.
> AWS, Amazon EC2, and all related marks are trademarks of Amazon.com, Inc."

### NOTICE.md
Create `cloudblocks/NOTICE.md` with:
- AWS trademark acknowledgment
- Third-party OSS license attributions (from package.json)
- LocalStack relationship note

**Owner:** QA

---

## DO NOT DO
- Scrape aws.amazon.com for pricing data
- Use the AWS logo or smile arrow in UI or marketing
- Name the product "AWS [anything]" or imply official AWS affiliation
- Alter AWS Architecture Icons in ways that misrepresent services

---

## Opportunity — AWS Architecture Icons
- AWS officially permits use of their Architecture Icons in architecture diagrams and tools
- Source: https://aws.amazon.com/architecture/icons/
- Benefit: professional node visuals, explicit compliance documentation
- Usage terms: do not alter icons to misrepresent services; follow AWS icon guidelines
- **Owner:** Canvas — evaluate for 1.0 visual polish pass

---

## What We CAN Do
- Say "works with AWS," "for AWS infrastructure," "built for Amazon Web Services"
- Use AWS service names (EC2, S3, Lambda) as UI labels — functional, not brand identity
- Use `#FF9900` as a node color (functional color for AWS resources, not primary brand identity)
- Display the word "AWS" in descriptive context

---

## References
- AWS Trademark Guidelines: https://aws.amazon.com/trademark-guidelines/
- AWS Architecture Icons: https://aws.amazon.com/architecture/icons/
- AWS Price List API: https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/price-changes.html
