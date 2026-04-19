// Pricing data sourced from AWS Price List API (https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/)
// These are representative on-demand baseline estimates for the cheapest common tier per service,
// not exact quotes. Regenerate with:
//   aws pricing get-products --service-code AmazonEC2 --region us-east-1
// EC2: t3.micro on-demand. RDS: db.t3.micro on-demand. NAT: per-gateway/hr * 720h. ALB: base charge.
// S3/Lambda/SQS/SNS etc: typical low-usage monthly cost.
import pricing from '../assets/pricing.json'
import type { NodeType } from '../types/cloud'

export function getMonthlyEstimate(nodeType: NodeType, region: string): number | null {
  const regionMap = (pricing as Record<string, Record<string, number>>)[nodeType]
  if (!regionMap) return null
  // Fall back to us-east-1 if the specific region is not listed
  const price = regionMap[region] ?? regionMap['us-east-1'] ?? null
  return price === 0 ? 0 : (price ?? null)
}

export function formatPrice(dollars: number | null): string {
  if (dollars === null) return 'Price unavailable'
  if (dollars === 0) return 'Free'
  return `~$${dollars.toFixed(2)}/mo`
}
