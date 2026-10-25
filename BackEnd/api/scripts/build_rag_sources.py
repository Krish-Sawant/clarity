"""Build BackEnd/api/app/fixtures/rag_sources.json from a curated URL list.

Every URL is fetched; pages that don't return HTTP 200 or have under MIN_WORDS of
readable text are dropped and reported, and titles come from each page's <h1> so
nothing is hand-typed. The nine lesson sources in sources_fallback.json keep their ids.

Usage (from the repo root):
    python3 BackEnd/api/scripts/build_rag_sources.py
then rebuild the search index:
    npm --prefix ui/clarity-editorial run rag:index

To add a source, append a tuple to CURATED. consumerfinance.gov rejects Python's
urllib with HTTP 403, so pages are fetched with curl.
"""
import html, json, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

FIXTURES = Path(__file__).resolve().parents[1] / "app" / "fixtures"
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else FIXTURES / "rag_sources.json"
EXISTING = json.loads((Path(sys.argv[2]) if len(sys.argv) > 2 else FIXTURES / "sources_fallback.json").read_text())["sources"]

ALL = ["job-offer", "car", "grad-school", "move-out", "debt-vs-save"]
CFPB = "https://www.consumerfinance.gov"
ASK = CFPB + "/ask-cfpb/"

# (source_id, url, domain, concept_ids, scenario_ids, kind)
CURATED = [
    # Saving and budgeting
    ("cfpb-unexpected-job-loss", CFPB + "/consumer-tools/unexpected-job-loss/", "saving", ["emergency_buffer"], ["job-offer", "move-out", "debt-vs-save"], "guidance"),
    ("cfpb-money-safe-1005", ASK + "how-can-i-be-sure-my-money-is-safe-in-my-bank-account-en-1005/", "saving", ["savings_account"], ["move-out", "debt-vs-save"], "guidance"),
    ("cfpb-money-market-1007", ASK + "what-is-a-money-market-account-en-1007/", "saving", ["savings_account"], ["debt-vs-save", "job-offer"], "guidance"),
    ("cfpb-autopay-2021", ASK + "how-do-automatic-payments-from-a-bank-account-work-en-2021/", "budget", ["fixed_vs_variable"], ["move-out", "debt-vs-save"], "guidance"),
    ("cfpb-avoid-overdrafts-1053", ASK + "how-can-i-avoid-debit-card-overdrafts-en-1053/", "budget", ["overdraft_fees"], ["move-out"], "guidance"),
    ("cfpb-overdraft-options", CFPB + "/consumer-tools/bank-accounts/know-your-overdraft-options/", "budget", ["overdraft_fees"], ["move-out"], "rights"),
    # Credit cards and debt payoff
    ("cfpb-card-interest-calc-51", ASK + "how-does-my-credit-card-company-calculate-the-amount-of-interest-i-owe-en-51/", "interest", ["credit_apr", "compound_interest"], ["debt-vs-save", "job-offer"], "guidance"),
    ("cfpb-fixed-variable-apr-45", ASK + "what-is-the-difference-between-a-fixed-apr-and-a-variable-apr-en-45/", "interest", ["credit_apr"], ["debt-vs-save"], "guidance"),
    ("cfpb-grace-period-47", ASK + "what-is-a-grace-period-for-a-credit-card-en-47/", "credit", ["credit_apr"], ["debt-vs-save"], "guidance"),
    ("cfpb-payoff-box-36", ASK + "a-box-on-my-credit-card-bill-says-that-i-will-pay-off-the-balance-in-three-years-if-i-pay-a-certain-amount-what-does-that-mean-do-i-have-to-pay-that-much-if-i-pay-that-much-and-make-new-purchases-will-i-still-owe-nothing-after-three-years-en-36/", "credit", ["minimum_payment"], ["debt-vs-save"], "guidance"),
    ("cfpb-balance-transfer-49", ASK + "do-i-pay-interest-on-new-purchases-after-i-get-a-zero-or-low-rate-balance-transfer-en-49/", "interest", ["credit_apr"], ["debt-vs-save"], "guidance"),
    ("cfpb-cant-pay-cards-1697", ASK + "what-should-i-do-if-i-cant-pay-my-credit-card-bills-en-1697/", "credit", ["minimum_payment"], ["debt-vs-save", "job-offer"], "guidance"),
    ("cfpb-consolidate-cards-1861", ASK + "what-do-i-need-to-know-if-im-thinking-about-consolidating-my-credit-card-debt-en-1861/", "debt", ["debt_consolidation"], ["debt-vs-save"], "guidance"),
    ("cfpb-consolidation-ads-1859", ASK + "ive-seen-a-lot-of-advertisements-for-companies-that-consolidate-credit-card-debt-are-these-legitimate-en-1859/", "debt", ["debt_consolidation", "fraud_scams"], ["debt-vs-save"], "rights"),
    ("cfpb-counselor-vs-settlement-1449", ASK + "whats-the-difference-between-a-credit-counselor-and-a-debt-settlement-company-en-1449/", "debt", ["debt_consolidation"], ["debt-vs-save"], "guidance"),
    ("cfpb-rate-increase-69", ASK + "when-can-my-credit-card-company-increase-my-interest-rate-what-can-i-do-to-get-the-rate-back-down-en-69/", "credit", ["credit_apr"], ["debt-vs-save"], "rights"),
    ("cfpb-change-terms-70", ASK + "can-my-credit-card-company-change-the-terms-of-my-account-en-70/", "credit", ["credit_apr"], ["debt-vs-save"], "rights"),
    # Credit reports and scores
    ("cfpb-report-vs-score-2069", ASK + "what-is-the-difference-between-a-credit-report-and-a-credit-score-en-2069/", "credit", ["credit_report"], ["debt-vs-save", "car", "move-out"], "guidance"),
    ("cfpb-free-reports-5", ASK + "how-do-i-get-a-free-copy-of-my-credit-reports-en-5/", "credit", ["credit_report"], ["debt-vs-save", "car", "move-out"], "rights"),
    ("cfpb-dispute-report-314", ASK + "how-do-i-dispute-an-error-on-my-credit-report-en-314/", "credit", ["credit_report"], ["debt-vs-save", "car", "move-out"], "rights"),
    ("cfpb-soft-inquiry-321", ASK + "what-kind-of-credit-inquiry-has-no-effect-on-my-credit-score-en-321/", "credit", ["credit_report"], ["car", "move-out"], "guidance"),
    ("cfpb-tenant-screening-2102", ASK + "what-is-a-tenant-screening-report-en-2102/", "housing", ["credit_report"], ["move-out", "job-offer"], "guidance"),
    ("cfpb-tenant-denied-2105", ASK + "what-should-i-do-if-my-rental-application-is-denied-because-of-a-tenant-screening-report-en-2105/", "housing", ["credit_report"], ["move-out", "job-offer"], "rights"),
    # Auto loans
    ("cfpb-auto-afford-751", ASK + "how-much-can-i-afford-to-borrow-for-a-car-or-auto-loan-en-751/", "auto", ["auto_loan_cost"], ["car"], "guidance"),
    ("cfpb-auto-compare-753", ASK + "how-do-i-compare-auto-loan-offers-what-should-i-look-at-besides-the-monthly-payment-en-753/", "auto", ["auto_loan_cost", "credit_apr"], ["car"], "guidance"),
    ("cfpb-auto-before-shop-755", ASK + "what-should-i-know-before-i-shop-for-auto-loan-at-a-bank-credit-union-dealership-or-other-lender-en-755/", "auto", ["auto_loan_cost"], ["car"], "guidance"),
    ("cfpb-auto-finance-ways-759", ASK + "what-is-the-difference-between-dealer-arranged-and-bank-financing-en-759/", "auto", ["auto_loan_cost"], ["car"], "guidance"),
    ("cfpb-auto-negotiate-2132", ASK + "what-things-can-i-negotiate-when-shopping-for-a-car-or-auto-loan-en-2132/", "auto", ["auto_loan_cost"], ["car"], "guidance"),
    ("cfpb-auto-finalize-2131", ASK + "what-should-i-know-before-i-finalize-a-car-or-auto-loan-en-2131/", "auto", ["auto_loan_cost"], ["car"], "guidance"),
    ("cfpb-auto-trade-in-2045", ASK + "should-i-trade-in-my-car-if-its-not-paid-off-en-2045/", "auto", ["auto_loan_cost", "asset_depreciation"], ["car"], "guidance"),
    ("cfpb-rate-vs-apr-733", ASK + "what-is-the-difference-between-a-loan-interest-rate-and-the-apr-en-733/", "interest", ["credit_apr", "auto_loan_cost"], ["car", "grad-school"], "guidance"),
    ("cfpb-car-price-723", ASK + "what-factors-into-the-price-of-a-car-or-vehicle-en-723/", "auto", ["auto_loan_cost"], ["car"], "guidance"),
    ("cfpb-auto-warranty-729", ASK + "what-is-an-extended-warranty-or-vehicle-service-contract-en-729/", "auto", ["auto_loan_cost"], ["car"], "guidance"),
    ("cfpb-auto-insurance-731", ASK + "what-kind-of-auto-insurance-options-are-available-when-financing-a-car-en-731/", "auto", ["auto_loan_cost"], ["car"], "guidance"),
    ("cfpb-auto-shopping-credit-763", ASK + "how-will-shopping-for-an-auto-loan-affect-my-credit-en-763/", "auto", ["credit_report"], ["car"], "guidance"),
    ("cfpb-auto-rate-decided-765", ASK + "how-does-a-lender-decide-what-interest-rate-to-offer-me-on-an-auto-loan-en-765/", "auto", ["credit_apr", "credit_report"], ["car"], "guidance"),
    ("cfpb-auto-cant-pay-849", ASK + "what-should-i-do-if-i-cant-make-my-car-payments-en-849/", "auto", ["auto_loan_cost"], ["car"], "rights"),
    # Student loans and grad school
    ("cfpb-pay-for-grad-545", ASK + "what-are-the-different-ways-to-pay-for-college-or-graduate-school-en-545/", "education", ["student_loan_repayment"], ["grad-school"], "guidance"),
    ("cfpb-federal-vs-private-567", ASK + "should-i-choose-federal-student-loans-or-private-student-loans-en-567/", "education", ["student_loan_repayment"], ["grad-school"], "guidance"),
    ("cfpb-how-much-borrow-579", ASK + "how-much-should-i-borrow-in-student-loans-en-579/", "education", ["student_loan_repayment"], ["grad-school"], "guidance"),
    ("cfpb-student-rates-571", ASK + "what-are-the-interest-rates-on-my-student-loans-en-571/", "education", ["credit_apr", "student_loan_repayment"], ["grad-school"], "guidance"),
    ("cfpb-in-school-interest-593", ASK + "how-does-interest-accrue-while-i-am-in-school-en-593/", "education", ["compound_interest", "student_loan_repayment"], ["grad-school"], "guidance"),
    ("cfpb-start-paying-585", ASK + "when-and-how-do-i-start-paying-my-student-loans-en-585/", "education", ["student_loan_repayment"], ["grad-school"], "guidance"),
    ("cfpb-idr-1555", ASK + "what-are-income-driven-repayment-idr-plans-and-how-do-i-qualify-en-1555/", "education", ["student_loan_repayment"], ["grad-school"], "guidance"),
    ("cfpb-refinance-student-561", ASK + "should-i-consolidate-refinance-student-loans-en-561/", "education", ["student_loan_repayment", "debt_consolidation"], ["grad-school"], "guidance"),
    ("cfpb-student-credit-581", ASK + "do-student-loans-affect-my-credit-score-en-581/", "education", ["credit_report"], ["grad-school"], "guidance"),
    ("cfpb-student-job-loss-639", ASK + "do-i-need-to-pay-my-student-loans-if-i-lose-my-job-en-639/", "education", ["student_loan_repayment", "emergency_buffer"], ["grad-school", "job-offer"], "rights"),
    ("cfpb-repay-student-debt", CFPB + "/paying-for-college/repay-student-debt/", "education", ["student_loan_repayment"], ["grad-school"], "guidance"),
    ("cfpb-choose-student-loan", CFPB + "/paying-for-college/choose-a-student-loan/", "education", ["student_loan_repayment"], ["grad-school"], "guidance"),
    # Pay, taxes and retirement (job offer)
    ("irs-withholding-estimator", "https://www.irs.gov/individuals/tax-withholding-estimator", "income", ["take_home_pay"], ["job-offer", "grad-school"], "guidance"),
    ("cfpb-filing-taxes", CFPB + "/consumer-tools/guide-to-filing-your-taxes/", "income", ["take_home_pay"], ["job-offer"], "guidance"),
    ("irs-401k-overview", "https://www.irs.gov/retirement-plans/plan-participant-employee/401k-resource-guide-plan-participants-401k-plan-overview", "retirement", ["retirement_savings"], ["job-offer"], "guidance"),
    ("investor-401k", "https://www.investor.gov/introduction-investing/investing-basics/glossary/401k-plans", "retirement", ["retirement_savings", "compound_interest"], ["job-offer"], "guidance"),
    ("cfpb-retirement-on-track", CFPB + "/about-us/blog/three-things-to-keep-your-retirement-plan-on-track/", "retirement", ["retirement_savings"], ["job-offer"], "guidance"),
    # Risky borrowing, collections and scams
    ("cfpb-payday-should-1583", ASK + "should-i-get-a-payday-loan-if-i-need-money-now-en-1583/", "debt", ["high_cost_borrowing"], ["debt-vs-save", "move-out"], "guidance"),
    ("cfpb-payday-apr-1625", ASK + "what-is-an-annual-percentage-rate-apr-and-why-is-it-higher-than-the-interest-rate-for-my-payday-loan-en-1625/", "interest", ["high_cost_borrowing", "credit_apr"], ["debt-vs-save"], "guidance"),
    ("cfpb-installment-loan-2114", ASK + "what-is-a-personal-installment-loan-en-2114/", "debt", ["high_cost_borrowing", "debt_consolidation"], ["debt-vs-save", "car"], "guidance"),
    ("cfpb-bnpl-2116", ASK + "what-happens-if-i-cant-pay-back-a-buy-now-pay-later-bnpl-loan-en-2116/", "debt", ["high_cost_borrowing"], ["debt-vs-save", "move-out"], "rights"),
    ("cfpb-collector-contact-1695", ASK + "what-should-i-do-when-a-debt-collector-contacts-me-en-1695/", "debt", ["debt_collection"], ["debt-vs-save"], "rights"),
    ("cfpb-collector-limits-329", ASK + "are-there-laws-that-limit-what-debt-collectors-can-say-or-do-en-329/", "debt", ["debt_collection"], ["debt-vs-save"], "rights"),
    ("cfpb-scam-warning-signs-2094", ASK + "what-are-some-classic-warning-signs-of-possible-fraud-and-scams-en-2094/", "safety", ["fraud_scams"], ALL, "guidance"),
    ("cfpb-student-scams-2100", ASK + "how-do-i-avoid-student-loan-scams-en-2100/", "safety", ["fraud_scams", "student_loan_repayment"], ["grad-school"], "guidance"),
]

# Scenario tags for the 9 sources already used by lessons (ids kept stable).
EXISTING_TAGS = {
    "cfpb-budgeting-blog": (ALL, "guidance"),
    "cfpb-ymyg": (ALL, "guidance"),
    "fdic-money-smart": (ALL, "guidance"),
    "cfpb-credit-score-318": (["debt-vs-save", "car", "move-out"], "guidance"),
    "cfpb-credit-cards": (["debt-vs-save", "job-offer"], "guidance"),
    "cfpb-apr-44": (["debt-vs-save", "car"], "guidance"),
    "cfpb-emergency-fund-guide": (ALL, "guidance"),
    "investor-compound-interest": (["debt-vs-save", "job-offer", "grad-school"], "guidance"),
    "investor-compound-calculator": (["debt-vs-save", "job-offer"], "guidance"),
}

PUBLISHERS = {
    "consumerfinance.gov": "Consumer Financial Protection Bureau",
    "studentaid.gov": "U.S. Department of Education, Federal Student Aid",
    "irs.gov": "Internal Revenue Service",
    "investor.gov": "U.S. Securities and Exchange Commission — Investor.gov",
    "fdic.gov": "Federal Deposit Insurance Corporation",
}
H1 = re.compile(r"<h1\b[^>]*>(.*?)</h1>", re.S | re.I)


def publisher(url):
    return next(name for host, name in PUBLISHERS.items() if host in url)


MIN_WORDS = 150
TITLE = re.compile(r"<title\b[^>]*>(.*?)</title>", re.S | re.I)


def clean(fragment):
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", fragment)).split())


def fetch(url):
    # consumerfinance.gov rejects Python's urllib with 403 but serves curl normally.
    proc = subprocess.run(
        ["curl", "-sL", "--max-time", "30", "-A", "Mozilla/5.0 (Clarity source verifier)", "-w", "\n%{http_code}", url],
        capture_output=True, text=True, errors="ignore",
    )
    body, _, status = proc.stdout.rpartition("\n")
    words = len(clean(re.sub(r"<(script|style)\b[^>]*>.*?</\1>", "", body, flags=re.S | re.I)).split())
    if words < MIN_WORDS:  # JS-rendered shells have nothing to index
        return f"only {words} words", None
    m = H1.search(body)
    title = clean(m.group(1)) if m else None
    if not title and (m := TITLE.search(body)):
        title = re.split(r"\s+[|–-]\s+", clean(m.group(1)))[0]
    return int(status) if status.isdigit() else status, title


def main():
    ids = [c[0] for c in CURATED] + list(EXISTING_TAGS)
    assert len(ids) == len(set(ids)), "duplicate source_id"
    urls = [c[1] for c in CURATED]
    with ThreadPoolExecutor(3) as pool:
        results = dict(zip(urls, pool.map(fetch, urls)))

    sources, dropped = [], []
    for s in EXISTING:
        scenarios, kind = EXISTING_TAGS[s["source_id"]]
        sources.append({**s, "scenario_ids": scenarios, "kind": kind})
    for sid, url, domain, concepts, scenarios, kind in CURATED:
        status, title = results[url]
        if status != 200 or not title:
            dropped.append((sid, status, url))
            continue
        sources.append({
            "source_id": sid, "title": title, "publisher": publisher(url), "url": url,
            "domain": domain, "concept_ids": concepts, "scenario_ids": scenarios, "kind": kind,
            "license_or_use_notes": "U.S. federal government work; retrieved, chunked and cited with attribution.",
        })

    OUT.write_text(json.dumps({
        "origin": "curated_rag_corpus",
        "note": "Retrieval corpus for decision explanations. Titles are each page's <h1>; every URL returned HTTP 200 when this file was built. Ids shared with sources_fallback.json refer to the same pages.",
        "scenario_ids": ALL,
        "sources": sources,
    }, indent=2, ensure_ascii=False) + "\n")

    print(f"kept {len(sources)} sources ({len(EXISTING)} existing + {len(sources) - len(EXISTING)} new)")
    for sid, status, url in dropped:
        print(f"DROPPED {sid}: {status} {url}")


main()
