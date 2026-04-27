
export const AGREEMENT_TEMPLATE = `DOMESTIC CHANNEL PARTNER AGREEMENT
This Channel Partner Agreement (“Agreement”) is executed on {{today_date}} (“Effective Date”) by and between:

Pluckwalk Technologies Private Limited (Brick&Bolt), a company incorporated under the Companies Act, 2013, having its registered office at Ground Floor and First Floor, Urban Vault, Koramangala 57, 60 Feet Rd, KHB Colony, 6th Block, Koramangala, Bengaluru, Karnataka 560095. (“Company”);
AND
{{cp_name}}, an individual/entity having address at ___ (“Channel Partner” or “CP”).
The Company and the Channel Partner are collectively referred to as “Parties”.

1. APPOINTMENT & NATURE OF RELATIONSHIP
The Company hereby appoints the Channel Partner on a non-exclusive, principal-to-principal basis to identify, source, and refer prospective customers seeking construction services (“Leads”) to the Company.
Nothing contained herein shall be deemed to create any agency, partnership, joint venture, or employment relationship, and the Channel Partner shall have no authority to bind the Company in any manner whatsoever.

2. CONDITION PRECEDENT
The Channel Partner shall, wherever applicable, obtain and maintain valid registration under the Real Estate (Regulation and Development) Act, 2016 (RERA) and promptly furnish such details to the Company.
The continuation of this engagement is expressly contingent upon:
- Valid statutory compliance; and 
- Regular sharing of genuine and actionable Leads. 

3. SCOPE OF SERVICES & LEAD MANAGEMENT
The Channel Partner shall generate and share prospective customer Leads/data with the Company; 
The Leads classified are as follow: 
- Warm Leads (bulk/potential data), and 
- Direct Leads (customers actively intending to construct within ~3 months); 
Ensure that all Leads shared are accurate, genuine, and obtained through lawful means. 
The Company shall independently verify, engage, and convert Leads at its sole discretion and shall retain complete control over pricing, negotiations, and execution of projects. 

Restrictions:
- CP shall not make any representations, warranties, or commitments on behalf of the Company without prior written authorization;
- Any use of Company branding, marketing materials, or digital presence shall be strictly subject to prior written approval. 

Lead Ownership & Validity:
- In case of duplicate Leads, preference shall be determined based on quality of engagement and customer validation; 
- Failing which, the Lead shall be attributed on a first-registered basis, valid for 6 (six) months from the date of entry in the Company’s system. 

4. PAYMENT TERMS
The Parties agree on the following payment terms:

Project Value (INR) | Commission (%) | Condition | Payout Stage | Payout %
-------------------|----------------|-----------|--------------|---------
Upto ₹5 Crore      | 2%             | On successful conversion of Lead | At Booking (initial payment & survey) | 40%
                   |                |                                  | At Project Start (~20% received) | 60%
₹5Crore – ₹15 Crore| 2%             | On successful conversion of Lead | At Booking (initial payment & survey) | 40%
                   |                |                                  | At Project Start (~20% received) | 60%

5. TERM & TERMINATION
This Agreement shall remain valid for a period of 3 (three) financial years from the Effective Date. 
Either Party may terminate this Agreement without cause by providing 30 (thirty) days’ prior written notice. 
The Company reserves the right to terminate immediately in the event of: 
- Fraud, misrepresentation, or unethical conduct; 
- Violation of applicable laws or anti-corruption principles; 
- Misuse of Company’s brand or intellectual property; 
- Material breach not cured within 5 (five) working days, where curable.
Termination shall be without prejudice to rights and obligations accrued prior to termination.

6. COMMISSION & PAYMENT TERMS
The Channel Partner shall be entitled to a success-based commission of 2% of the project value (exclusive of applicable taxes) for Leads successfully converted by the Company. 
Payment Milestones:
- 40% upon booking (subject to receipt of initial payment and completion of internal milestones by the Company); 
- 60% upon project commencement and receipt of approximately 20% of project value by the Company. 
Conditions:
- Commission shall be payable only upon actual realization of payments by the Company. 
- In the event of cancellation, non-execution, or refund, no commission (or any unpaid portion thereof) shall be payable. 
- All payments shall be made in INR through banking channels, subject to applicable tax deductions (TDS). 

7. OBLIGATIONS & STANDARD OF PERFORMANCE
The Channel Partner shall:
- Perform services with due skill, care, diligence, and professionalism;
- Ensure strict compliance with applicable laws, regulations, and industry standards; 
- Not engage in any misleading, deceptive, or unethical practices;
- Promptly rectify, at its own cost, any deficiencies arising from its acts or omissions; 
- Protect and uphold the reputation and goodwill of the Company at all times. 

8. INTELLECTUAL PROPERTY RIGHTS
All intellectual property rights (“IPR”) of the Company, including trademarks, logos, branding, and proprietary materials, shall remain the sole and exclusive property of the Company.
CP is granted a limited, revocable, non-exclusive, non-transferable right to use such IPR solely for purposes of this Agreement, subject to prior written approval. 
Any unauthorized use, reproduction, or misrepresentation shall constitute a material breach, entitling the Company to immediate termination and legal remedies, including injunctive relief and damages. 

9. INDEMNITY & LIABILITY
The Channel Partner agrees to indemnify, defend, and hold harmless the Company and its representatives against any losses, claims, damages, or liabilities arising out of Breach of this Agreement, Misrepresentation or incorrect information provided by the CP, Non-compliance with applicable laws, Acts or omissions attributable to the CP. 
This obligation shall survive termination of the Agreement.

10. ASSIGNMENT
The Channel Partner shall not assign, transfer, or subcontract its rights or obligations under this Agreement without the prior written consent of the Company.

11. DISPUTE RESOLUTION
Any disputes arising out of or in connection with this Agreement shall first be resolved amicably. Failing such resolution within a reasonable period, the dispute shall be referred to arbitration- Sole Arbitrator appointed by the Company. In accordance with the Arbitration and Conciliation Act, 1996 and the Seat & venue should Bangalore and the language should be English. 

12. GOVERNING LAW & JURISDICTION
This Agreement shall be governed by the laws of India. Subject to arbitration, the courts at Bangalore shall have exclusive jurisdiction.

13. GENERAL PROVISIONS
Entire Agreement: This clause confirms that the Agreement constitutes the complete and final understanding between the Parties with respect to its subject matter. 
Amendments: Any modification, alteration, or addition to this Agreement shall be valid only if made in writing and duly executed by both Parties. 
Severability: If any provision of this Agreement is held to be invalid, illegal, or unenforceable, such provision shall be severed from the Agreement. 
Waiver: Failure or delay by either Party in enforcing any provision shall not be construed as a waiver of that provision or any future rights.
Execution: This Agreement may be executed in multiple counterparts, each of which shall be deemed an original. It may also be executed through electronic or digital signatures.
Costs: Stamp duty and execution costs shall be borne by the Company.

IN WITNESS WHEREOF
The Parties hereto have executed this Agreement on the day and year first written above, after fully understanding the terms and conditions contained herein.

For: Pluckwalk Technologies Private Limited
Akash Singhal
akash.singhal@bricknbolt.com

For: Channel Partner
{{cp_name}}
`;

export function generateAgreement(cpName: string) {
    const today = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
    return AGREEMENT_TEMPLATE
        .replace(/{{today_date}}/g, today)
        .replace(/{{cp_name}}/g, cpName);
}
