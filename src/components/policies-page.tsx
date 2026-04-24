"use client"

import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"

export function PoliciesPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardContent className="p-8 md:p-12 space-y-8">
          {/* Header */}
          <header className="pb-6 border-b-2 border-foreground">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-6 leading-relaxed">
              <span className="block text-sm font-semibold text-foreground tracking-wider mb-1">Handled, Inc.</span>
              1590 Rosecrans Ave, Ste D, PMB 805<br />
              Manhattan Beach, CA 90266
            </div>
            <h1 className="text-3xl md:text-4xl font-light tracking-tight mb-3">
              Prohibited &amp; Restricted<br />
              <em className="text-primary">Inventory Policy</em>
            </h1>
            <div className="text-xs font-mono text-muted-foreground tracking-wide">
              Date of Last Revision: March 21, 2025
            </div>
          </header>

          {/* Preamble */}
          <div className="pb-6 border-b text-muted-foreground space-y-3 text-[15px] leading-relaxed italic">
            <p>
              This Prohibited and Restricted Inventory Policy (&ldquo;Policy&rdquo;) is incorporated into the Handled Terms of Service as published on Handled&rsquo;s website (&ldquo;Terms&rdquo;). In the event of any conflict or inconsistency between this Policy and the Terms, the Terms shall govern. All capitalized terms not otherwise defined in this Policy will have the meanings assigned to them in the Terms.
            </p>
            <p>
              References to &ldquo;Customer&rdquo; in this Policy mean Customer and its Authorized Users as defined in the Terms.
            </p>
          </div>

          {/* 1. General Disclaimer */}
          <section>
            <h2 className="text-xl font-medium tracking-tight pb-2 border-b mb-4">1. General Disclaimer</h2>
            <p className="text-[15px] leading-relaxed">
              Carriers, insurance providers, and product destinations may impose additional limitations, prohibitions, or fees beyond those set by Handled. Customer is solely responsible for ensuring compliance with all applicable restrictions and for any costs associated with non-compliance.
            </p>
          </section>

          {/* 2. Prohibited Products */}
          <section>
            <h2 className="text-xl font-medium tracking-tight pb-2 border-b mb-4">2. Prohibited Products</h2>
            <p className="text-[15px] leading-relaxed mb-4">
              For safety, legal, and operational reasons, Handled does not accept or handle the following types of inventory:
            </p>
            <ul className="list-disc ml-6 space-y-3 text-[15px] leading-relaxed">
              <li><strong>Illegal products</strong> — Any products related to illegal activities or prohibited by law in the place of origin, the destination, or any transit locations.</li>
              <li><strong>Products prohibited in the warehouse location</strong> — Any products that are illegal in the location where the Handled warehouse is located.</li>
              <li>
                <strong>Products requiring specific licenses to store or distribute,</strong> including but not limited to:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>Live plants and animals</li>
                  <li>Alcoholic beverages</li>
                  <li>Ammunition &amp; firearms</li>
                  <li>Tobacco</li>
                  <li>Prescription pharmaceuticals</li>
                  <li>Explosive or hazardous products</li>
                  <li>Unique or one-of-a-kind materials</li>
                  <li>Precious metals (e.g., gold, silver)</li>
                </ul>
              </li>
              <li><strong>Lithium battery products exceeding small lithium battery limitations</strong> — Products that must be shipped as fully regulated lithium batteries cannot be stored or shipped within the Handled network.</li>
            </ul>
            <p className="text-[15px] leading-relaxed mt-4">
              Handled reserves the right to refuse, return, or dispose of Prohibited Products at the Customer&rsquo;s expense.
            </p>
          </section>

          {/* 3. Conditional Use Products */}
          <section>
            <h2 className="text-xl font-medium tracking-tight pb-2 border-b mb-4">3. Conditional Use Products</h2>
            <p className="text-[15px] leading-relaxed mb-4">
              Certain types of inventory require prior written approval from Handled before being sent to any Handled location. These products have unique handling requirements, transportation restrictions, or regulatory limitations. Customer must execute a written addendum to the Handled Terms of Service before these products can be processed.
            </p>

            {/* Notice */}
            <div className="flex gap-3 bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-500 rounded-r p-4 mb-6">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm">
                Failure to obtain approval in advance may result in processing delays, additional fees, or rejection of the shipment.
              </p>
            </div>

            <h3 className="text-base font-medium italic mb-3">3.1 Conditional Use Categories</h3>
            <ul className="list-disc ml-6 space-y-3 text-[15px] leading-relaxed">
              <li>
                <strong>Inventory with specific transportation restrictions,</strong> including lithium batteries.
              </li>
              <li>
                <strong>High-value products or monetary equivalents,</strong> such as:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>Inventory with a replacement value over $500 per item</li>
                  <li>Cash equivalents</li>
                </ul>
              </li>
              <li>
                <strong>Non-conveyable products,</strong> including:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>Items exceeding 24 inches in any dimension</li>
                  <li>Items weighing more than 70 lbs (32 kg)</li>
                </ul>
              </li>
              <li>
                <strong>Hazardous and/or dangerous products,</strong> as defined under 49 U.S.C. 5103 and 49 CFR 172.101. Examples include:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>Aerosols and flammable liquids</li>
                  <li>Perfumes and fragrances</li>
                  <li>Weapons and knives</li>
                  <li>Any product requiring a Material Safety Data Sheet (MSDS) or Safety Data Sheet (SDS)</li>
                </ul>
              </li>
              <li>
                <strong>Products requiring regulatory approval, certification, or licensing for handling,</strong> including:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>Products intended for internal consumption or application to a body</li>
                </ul>
              </li>
              <li><strong>Used or previously owned products.</strong></li>
              <li>
                <strong>Adult-oriented or restricted products,</strong> including:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>Any products labeled as &ldquo;Adult Use Only&rdquo;</li>
                  <li>Products containing adult-themed packaging or images</li>
                </ul>
              </li>
              <li>
                <strong>Unprotected or perishable inventory,</strong> including:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>Inventory not in protective bags and susceptible to dust or contamination</li>
                  <li>Inventory containing perishable goods or liquids</li>
                </ul>
              </li>
              <li>
                <strong>Fragile or specialized packaging inventory,</strong> including:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>Posters, flyers, or other products requiring rolling or specialized packaging to prevent damage</li>
                </ul>
              </li>
              <li>
                <strong>Inventory susceptible to temperature, pressure, or humidity damage,</strong> including:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>Items that become brittle below specific temperatures</li>
                  <li>Items that melt or degrade above specific temperatures</li>
                  <li>Items sensitive to air transport conditions (e.g., pressure changes)</li>
                </ul>
              </li>
              <li>
                <strong>Inventory requiring durability verification.</strong> All products must be able to pass the following tests:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>Any product must pass a 4-foot drop test onto a hard surface without damage (five drops: base, top, longest side, shortest side, and corner).</li>
                  <li>Any product must pass a Full Minute Vigorous Shaking (FMVS) test without breakage or leakage.</li>
                </ul>
              </li>
            </ul>
          </section>

          {/* 4. Handling of Hazardous Materials */}
          <section>
            <h2 className="text-xl font-medium tracking-tight pb-2 border-b mb-4">4. Handling of Hazardous Materials (If Approved by Handled)</h2>
            <p className="text-[15px] leading-relaxed mb-4">
              If Handled agrees to process or ship a Hazardous Material under regulatory exceptions (e.g., limited quantity or small lithium battery, as per 49 CFR &sect;173.185(c)), Customer must provide the following before shipment:
            </p>

            <h3 className="text-base font-medium italic mb-3">4.1 Required Documentation</h3>
            <p className="text-[15px] leading-relaxed mb-3">
              <strong>Safety Data Sheet (SDS)</strong> — Must be current (not older than five years) and include:
            </p>
            <ul className="list-disc ml-6 space-y-1 text-[15px] leading-relaxed mb-4">
              <li>UN number</li>
              <li>Proper shipping name</li>
              <li>Hazard class</li>
              <li>Packing group</li>
              <li>(Not required for lithium batteries.)</li>
            </ul>

            <p className="text-[15px] leading-relaxed mb-3">
              <strong>Lithium Battery Requirements (if applicable):</strong>
            </p>
            <ul className="list-disc ml-6 space-y-1 text-[15px] leading-relaxed mb-4">
              <li>UN 38.3 lithium battery test summary</li>
              <li>Packaging description (internal &amp; total packaging, quantity, mass, and type)</li>
              <li>Proof of non-hazardous classification (if required)</li>
              <li>Lithium part number</li>
              <li>Grams of lithium or watt hours (as applicable)</li>
              <li>Battery format (coin cell, cell, or battery)</li>
              <li>Quantity of batteries per packaging type</li>
              <li>Total net weight of batteries</li>
              <li>UN 38.3 Lithium battery test summary report</li>
            </ul>

            <p className="text-[15px] leading-relaxed">
              Handled reserves the right to reject, quarantine, or dispose of any hazardous material that does not meet these requirements or is deemed unsafe for storage or transportation.
            </p>
          </section>

          {/* 5. Right to Refuse or Dispose of Inventory */}
          <section>
            <h2 className="text-xl font-medium tracking-tight pb-2 border-b mb-4">5. Right to Refuse or Dispose of Inventory</h2>
            <p className="text-[15px] leading-relaxed mb-4">
              Handled reserves the right to refuse, return, or dispose of any inventory at the Customer&rsquo;s expense under the following conditions:
            </p>
            <ul className="list-disc ml-6 space-y-2 text-[15px] leading-relaxed mb-4">
              <li>The inventory violates this Policy or any applicable law.</li>
              <li>The inventory arrives without required pre-approval for Conditional Use Products.</li>
              <li>The inventory is deemed unsafe, hazardous, or improperly packaged.</li>
              <li>Any required customs duties, fees, or taxes remain unpaid at the time of arrival.</li>
            </ul>
            <p className="text-[15px] leading-relaxed mb-4">
              For shipments held pending return instructions, Customer must provide return instructions within 72 hours of notification. Shipments held beyond 72 hours are subject to additional storage fees at Handled&rsquo;s standard rates. Customer will bear all handling and shipping costs incurred by Handled in returning the Inventory to Customer or the destination designated by Customer.
            </p>
            <p className="text-[15px] leading-relaxed">
              Handled is not liable for any losses, damages, or costs incurred due to the refusal or disposal of inventory that does not comply with this Policy.
            </p>
          </section>

          {/* 6. Compliance & Liability */}
          <section>
            <h2 className="text-xl font-medium tracking-tight pb-2 border-b mb-4">6. Compliance &amp; Liability</h2>
            <ul className="list-disc ml-6 space-y-2 text-[15px] leading-relaxed">
              <li>Customer is solely responsible for ensuring compliance with all applicable laws and regulations.</li>
              <li>Handled does not assume responsibility for inventory that is delayed, rejected, or disposed of due to non-compliance with this Policy.</li>
              <li>Any additional carrier, customs, or regulatory fees incurred due to non-compliance will be charged to the Customer&rsquo;s Account.</li>
            </ul>
          </section>
        </CardContent>
      </Card>
    </div>
  )
}
